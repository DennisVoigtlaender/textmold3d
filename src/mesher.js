// 3D stage: layers (2D polygons + height profile) → watertight triangle meshes.
// Each layer becomes an implicit solid (wall + elliptic rounded top, flat bottom)
// (negative = inside), meshed with marching cubes. Pure JS, runs in a worker or in Node.

import { edgeTable, triTable } from './mcTables.js';

// ---------- 2D signed distance (positive inside) ----------

function distanceField(paths, g, innerClamp, outerClamp) {
  let n = 0;
  for (const p of paths) n += p.length / 2;
  const ax = new Float64Array(n), ay = new Float64Array(n), bx = new Float64Array(n), by = new Float64Array(n);
  let s = 0;
  for (const p of paths) {
    const m = p.length / 2;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      ax[s] = p[2 * i]; ay[s] = p[2 * i + 1]; bx[s] = p[2 * j]; by[s] = p[2 * j + 1]; s++;
    }
  }

  // bucket grid for nearest-segment queries
  const B = Math.max(g.h * 4, 1.5);
  const ox = g.x0 - B, oy = g.y0 - B;
  const cnx = Math.ceil((g.nx * g.h + 2 * B) / B) + 1;
  const cny = Math.ceil((g.ny * g.h + 2 * B) / B) + 1;
  const cell = (v, o, nmax) => Math.min(nmax - 1, Math.max(0, Math.floor((v - o) / B)));
  const counts = new Int32Array(cnx * cny + 1);
  const range = (k) => [
    cell(Math.min(ax[k], bx[k]), ox, cnx), cell(Math.max(ax[k], bx[k]), ox, cnx),
    cell(Math.min(ay[k], by[k]), oy, cny), cell(Math.max(ay[k], by[k]), oy, cny),
  ];
  for (let k = 0; k < n; k++) {
    const [i0, i1, j0, j1] = range(k);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) counts[j * cnx + i + 1]++;
  }
  for (let i = 1; i < counts.length; i++) counts[i] += counts[i - 1];
  const fillPos = counts.slice();
  const list = new Int32Array(counts[counts.length - 1]);
  for (let k = 0; k < n; k++) {
    const [i0, i1, j0, j1] = range(k);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) list[fillPos[j * cnx + i]++] = k;
  }

  function segDist2(k, px, py) {
    const dx = bx[k] - ax[k], dy = by[k] - ay[k];
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax[k]) * dx + (py - ay[k]) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax[k] + t * dx - px, ey = ay[k] + t * dy - py;
    return ex * ex + ey * ey;
  }

  function nearest(px, py, clamp) {
    let best2 = clamp * clamp;
    const ci = Math.floor((px - ox) / B), cj = Math.floor((py - oy) / B);
    const maxR = Math.ceil(clamp / B) + 1;
    const visit = (i, j) => {
      if (i < 0 || j < 0 || i >= cnx || j >= cny) return;
      const c = j * cnx + i;
      for (let q = counts[c]; q < counts[c + 1]; q++) {
        const d2 = segDist2(list[q], px, py);
        if (d2 < best2) best2 = d2;
      }
    };
    for (let r = 0; r <= maxR; r++) {
      const lb = (r - 1) * B;
      if (lb > 0 && lb * lb >= best2) break;
      if (r === 0) { visit(ci, cj); continue; }
      for (let i = ci - r; i <= ci + r; i++) { visit(i, cj - r); visit(i, cj + r); }
      for (let j = cj - r + 1; j <= cj + r - 1; j++) { visit(ci - r, j); visit(ci + r, j); }
    }
    return Math.sqrt(best2);
  }

  const field = new Float32Array(g.nx * g.ny);
  const xs = [];
  for (let j = 0; j < g.ny; j++) {
    const y = g.y0 + j * g.h;
    xs.length = 0;
    for (let k = 0; k < n; k++) {
      if ((ay[k] > y) !== (by[k] > y)) xs.push(ax[k] + ((y - ay[k]) * (bx[k] - ax[k])) / (by[k] - ay[k]));
    }
    xs.sort((a, b) => a - b);
    let c = 0;
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.h;
      while (c < xs.length && xs[c] < x) c++;
      const inside = (c & 1) === 1;
      const d = nearest(x, y, inside ? innerClamp : outerClamp);
      field[j * g.nx + i] = inside ? d : -d;
    }
  }
  return field;
}

// ---------- Marching cubes over slices ----------

function marchingCubes(g, nz, zAt, fillSlice, onSlice) {
  const { nx, ny, h, x0, y0 } = g;
  const N = nx * ny;
  let s0 = new Float32Array(N), s1 = new Float32Array(N);
  let xe0 = new Int32Array(N).fill(-1), ye0 = new Int32Array(N).fill(-1);
  let xe1 = new Int32Array(N), ye1 = new Int32Array(N);
  const ze = new Int32Array(N);
  const pos = [];
  const idx = [];
  const ev = new Int32Array(12);

  const vx = (cache, q, i, j, z, a, b) => {
    if (cache[q] < 0) { const t = a / (a - b); cache[q] = pos.length / 3; pos.push(x0 + (i + t) * h, y0 + j * h, z); }
    return cache[q];
  };
  const vy = (cache, q, i, j, z, a, b) => {
    if (cache[q] < 0) { const t = a / (a - b); cache[q] = pos.length / 3; pos.push(x0 + i * h, y0 + (j + t) * h, z); }
    return cache[q];
  };
  let za = 0, zb = 0;
  const vz = (q, i, j, a, b) => {
    if (ze[q] < 0) { const t = a / (a - b); ze[q] = pos.length / 3; pos.push(x0 + i * h, y0 + j * h, za + t * (zb - za)); }
    return ze[q];
  };

  fillSlice(s0, zAt(0));
  for (let k = 0; k < nz - 1; k++) {
    za = zAt(k); zb = zAt(k + 1);
    fillSlice(s1, zb);
    xe1.fill(-1); ye1.fill(-1); ze.fill(-1);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const q = j * nx + i;
        const v0 = s0[q], v1 = s0[q + 1], v2 = s0[q + 1 + nx], v3 = s0[q + nx];
        const v4 = s1[q], v5 = s1[q + 1], v6 = s1[q + 1 + nx], v7 = s1[q + nx];
        const ci = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0)
          | (v4 < 0 ? 16 : 0) | (v5 < 0 ? 32 : 0) | (v6 < 0 ? 64 : 0) | (v7 < 0 ? 128 : 0);
        if (ci === 0 || ci === 255) continue;
        const bits = edgeTable[ci];
        if (bits & 1) ev[0] = vx(xe0, q, i, j, za, v0, v1);
        if (bits & 2) ev[1] = vy(ye0, q + 1, i + 1, j, za, v1, v2);
        if (bits & 4) ev[2] = vx(xe0, q + nx, i, j + 1, za, v3, v2);
        if (bits & 8) ev[3] = vy(ye0, q, i, j, za, v0, v3);
        if (bits & 16) ev[4] = vx(xe1, q, i, j, zb, v4, v5);
        if (bits & 32) ev[5] = vy(ye1, q + 1, i + 1, j, zb, v5, v6);
        if (bits & 64) ev[6] = vx(xe1, q + nx, i, j + 1, zb, v7, v6);
        if (bits & 128) ev[7] = vy(ye1, q, i, j, zb, v4, v7);
        if (bits & 256) ev[8] = vz(q, i, j, v0, v4);
        if (bits & 512) ev[9] = vz(q + 1, i + 1, j, v1, v5);
        if (bits & 1024) ev[10] = vz(q + 1 + nx, i + 1, j + 1, v2, v6);
        if (bits & 2048) ev[11] = vz(q + nx, i, j + 1, v3, v7);
        const base = ci << 4;
        for (let t = 0; triTable[base + t] !== -1; t += 3) {
          const a = ev[triTable[base + t]], b = ev[triTable[base + t + 1]], c = ev[triTable[base + t + 2]];
          if (a !== b && b !== c && a !== c) idx.push(a, b, c);
        }
      }
    }
    [s0, s1] = [s1, s0];
    [xe0, xe1] = [xe1, xe0];
    [ye0, ye1] = [ye1, ye0];
    if (onSlice) onSlice(k / (nz - 2));
  }

  const positions = new Float32Array(pos);
  const indices = new Uint32Array(idx);
  // make the winding point outwards (positive signed volume)
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    vol += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
      - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
      + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (vol < 0) {
    for (let t = 0; t < indices.length; t += 3) { const x = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = x; }
  }
  return { positions, indices, volume: Math.abs(vol) / 6 };
}

// ---------- Public API ----------

function boxBlur(a, nx, ny, r, horizontal) {
  const n = horizontal ? nx : ny, lines = horizontal ? ny : nx;
  const stride = horizontal ? 1 : nx;
  const tmp = new Float32Array(n);
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * nx : l;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += a[base + Math.min(n - 1, Math.max(0, k)) * stride];
    for (let k = 0; k < n; k++) {
      tmp[k] = sum / (2 * r + 1);
      sum += a[base + Math.min(n - 1, k + r + 1) * stride] - a[base + Math.max(0, k - r) * stride];
    }
    for (let k = 0; k < n; k++) a[base + k * stride] = tmp[k];
  }
}

// A layer may consist of several overlapping solids (one per letter); they are unioned.
function prepareLayer(layer, g) {
  const shapes = layer.glyphs && layer.glyphs.length ? layer.glyphs : [layer.paths];
  return { solids: shapes.map((paths) => prepareSolid(layer, paths, g)), zTop: layer.z0 + layer.height };
}

// Smooth minimum: like Math.min but without a kink where a and b cross.
function smin(a, b, k) {
  const t = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - t * t * k * 0.25;
}

/*
 * The cross-section of every solid is a vertical wall up to zE, topped by a quarter ellipse
 * (horizontal radius R, vertical radius Hd) that ends in the crown at z0 + height.
 * Storing u = how far a sample is from the crown (0 … 1) lets the 3D field be evaluated as
 * a smooth, near-Euclidean ellipse distance – no terraces where the rim is steep.
 */
function prepareSolid(layer, paths, g) {
  const h = g.h;
  const d = distanceField(paths, g, layer.profile === 'dome' ? 200 : Math.max(layer.fillet, 2 * h) + h, 2 * h);
  const u = new Float32Array(d.length);
  let R, Hd, zE;
  if (layer.profile === 'dome') {
    // The distance field has a sharp ridge along the letter's centre line; blurring it
    // turns that ridge into a soft, balloon-like crown.
    let maxD = 0;
    for (let i = 0; i < d.length; i++) if (d[i] > maxD) maxD = d[i];
    const soft = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++) soft[i] = d[i] > 0 ? d[i] : 0;
    const rc = Math.max(1, Math.round((0.45 * maxD) / h));
    for (let pass = 0; pass < 3; pass++) { boxBlur(soft, g.nx, g.ny, rc, true); boxBlur(soft, g.nx, g.ny, rc, false); }
    let maxS = 0;
    const k = Math.max(h, 0.3 * maxD);
    for (let i = 0; i < d.length; i++) {
      // true distance near the rim (exact edge height), blurred distance in the crown
      soft[i] = d[i] <= 0 ? 0 : Math.max(0, smin(soft[i], d[i], k));
      if (soft[i] > maxS) maxS = soft[i];
    }
    R = Math.max(h, layer.puff * maxS);
    zE = layer.z0 + Math.min(layer.edge, layer.height - 0.05);
    Hd = layer.z0 + layer.height - zE;
    for (let i = 0; i < d.length; i++) u[i] = Math.max(0, R - soft[i]) / R;
  } else {
    R = Math.max(0.05, Math.min(layer.fillet, layer.height / 2));
    zE = layer.z0 + layer.height - R;
    Hd = R;
    for (let i = 0; i < d.length; i++) u[i] = Math.max(0, R - Math.max(d[i], 0)) / R;
  }
  return { d, u, R, Hd, zE, z0: layer.z0 };
}

function layerBounds(layers) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0;
  for (const l of layers) {
    for (const p of l.paths) for (let i = 0; i < p.length; i += 2) {
      if (p[i] < minX) minX = p[i]; if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1]; if (p[i + 1] > maxY) maxY = p[i + 1];
    }
    maxZ = Math.max(maxZ, l.z0 + l.height);
  }
  return { minX, minY, maxX, maxY, maxZ };
}

/**
 * layers: see geometry2d.buildLayers. opts.h = voxel size in mm,
 * opts.mode = 'parts' (one mesh per layer) | 'union' (one merged watertight body).
 */
export function buildMeshes(layers, { h, mode = 'parts', smooth = 4, onProgress } = {}) {
  const b = layerBounds(layers);
  const m = 2 * h;
  const g = {
    h,
    x0: b.minX - m, y0: b.minY - m,
    nx: Math.ceil((b.maxX - b.minX + 2 * m) / h) + 1,
    ny: Math.ceil((b.maxY - b.minY + 2 * m) / h) + 1,
  };
  const prepared = layers.map((l) => prepareLayer(l, g));
  if (onProgress) onProgress(0.15);

  const zAt = (k) => (k - 0.5) * h;
  const nzFor = (zTop) => Math.ceil(zTop / h) + 3;

  const fillFor = (list) => {
    const solids = list.flatMap((L) => L.solids);
    return (out, z) => {
      out.fill(Infinity);
      for (const L of solids) {
        const { d, u, R, Hd, zE, z0 } = L;
        if (z <= zE) {
          const below = z0 - z;
          for (let i = 0; i < out.length; i++) {
            const v = below > -d[i] ? below : -d[i];
            if (v < out[i]) out[i] = v;
          }
        } else {
          const w = (z - zE) / Hd, w2 = w * w, gz = w / Hd;
          for (let i = 0; i < out.length; i++) {
            const ui = u[i];
            const r = Math.sqrt(ui * ui + w2);
            const gx = ui / R;
            let v = ((r - 1) * r) / Math.sqrt(gx * gx + gz * gz); // ellipse level set / |gradient|
            if (-d[i] > v) v = -d[i];
            if (v < out[i]) out[i] = v;
          }
        }
      }
      for (let i = 0; i < out.length; i++) if (out[i] === 0) out[i] = 1e-7;
    };
  };

  if (mode === 'union') {
    const zTop = Math.max(...prepared.map((L) => L.zTop));
    const mesh = marchingCubes(g, nzFor(zTop), zAt, fillFor(prepared), (t) => onProgress && onProgress(0.15 + 0.8 * t));
    taubin(mesh.positions, mesh.indices, smooth);
    return [{ id: 'all', label: 'Modell', color: layers[layers.length - 1].color, ...mesh }];
  }

  return prepared.map((L, i) => {
    const mesh = marchingCubes(g, nzFor(L.zTop), zAt, fillFor([L]),
      (t) => onProgress && onProgress(0.15 + 0.8 * ((i + t) / prepared.length)));
    taubin(mesh.positions, mesh.indices, smooth);
    return { id: layers[i].id, label: layers[i].label, color: layers[i].color, ...mesh };
  });
}

/**
 * Taubin smoothing (λ/μ): removes the faint grid pattern of marching cubes without
 * shrinking the model. Vertices on the bottom plane keep their height so it stays flat.
 */
function taubin(P, I, iterations) {
  if (!iterations) return;
  const n = P.length / 3;
  const start = new Uint32Array(n + 1);
  for (let t = 0; t < I.length; t++) start[I[t] + 1] += 2;
  for (let v = 0; v < n; v++) start[v + 1] += start[v];
  const fill = start.slice(0, n);
  const adj = new Uint32Array(start[n]);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    adj[fill[a]++] = b; adj[fill[a]++] = c;
    adj[fill[b]++] = a; adj[fill[b]++] = c;
    adj[fill[c]++] = a; adj[fill[c]++] = b;
  }
  let zMin = Infinity;
  for (let v = 0; v < n; v++) if (P[3 * v + 2] < zMin) zMin = P[3 * v + 2];
  const tmp = new Float32Array(P.length);
  const step = (f) => {
    for (let v = 0; v < n; v++) {
      let sx = 0, sy = 0, sz = 0;
      const s0 = start[v], s1 = start[v + 1];
      for (let k = s0; k < s1; k++) { const q = 3 * adj[k]; sx += P[q]; sy += P[q + 1]; sz += P[q + 2]; }
      const m = s1 - s0 || 1, o = 3 * v;
      tmp[o] = P[o] + f * (sx / m - P[o]);
      tmp[o + 1] = P[o + 1] + f * (sy / m - P[o + 1]);
      tmp[o + 2] = P[o + 2] - zMin < 1e-4 ? P[o + 2] : P[o + 2] + f * (sz / m - P[o + 2]);
    }
    P.set(tmp);
  };
  for (let i = 0; i < iterations; i++) { step(0.5); step(-0.53); }
}

/** Counts edges that are not shared by exactly two triangles (0 = closed 2-manifold). */
export function checkManifold(indices) {
  const edges = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
      const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
      edges.set(key, (edges.get(key) || 0) + (a < b ? 1 : 1000));
    }
  }
  let bad = 0;
  for (const v of edges.values()) if (v !== 1001) bad++; // exactly one edge in each direction
  return { edges: edges.size, bad };
}
