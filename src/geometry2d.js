// 2D stage: text → glyph outlines → bubble shape → printable layers (all in mm).
// Uses the globals `ClipperLib` (clipper-lib) and font objects from opentype.js.

const S = 1000; // Clipper integer units per mm (or per font unit during layout)
const CL = () => globalThis.ClipperLib;

// ---------- Clipper helpers ----------

function toPaths(contours) {
  return contours.map((c) => c.map(([x, y]) => ({ X: Math.round(x * S), Y: Math.round(y * S) })));
}

function union(paths) {
  const L = CL();
  const c = new L.Clipper();
  c.AddPaths(paths, L.PolyType.ptSubject, true);
  const out = new L.Paths();
  c.Execute(L.ClipType.ctUnion, out, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero);
  return out;
}

function difference(a, b) {
  const L = CL();
  const c = new L.Clipper();
  c.AddPaths(a, L.PolyType.ptSubject, true);
  c.AddPaths(b, L.PolyType.ptClip, true);
  const out = new L.Paths();
  c.Execute(L.ClipType.ctDifference, out, L.PolyFillType.pftNonZero, L.PolyFillType.pftNonZero);
  return out;
}

function offset(paths, delta, arcTol = 0.02 * S) {
  if (!delta) return paths;
  const L = CL();
  const co = new L.ClipperOffset(2, arcTol);
  co.AddPaths(paths, L.JoinType.jtRound, L.EndType.etClosedPolygon);
  const out = new L.Paths();
  co.Execute(out, delta);
  return out;
}

const area = (p) => CL().Clipper.Area(p);

function bounds(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) for (const q of p) {
    if (q.X < minX) minX = q.X; if (q.X > maxX) maxX = q.X;
    if (q.Y < minY) minY = q.Y; if (q.Y > maxY) maxY = q.Y;
  }
  return { minX, minY, maxX, maxY };
}

function transform(paths, s, tx, ty) {
  return paths.map((p) => p.map((q) => ({ X: Math.round(q.X * s + tx), Y: Math.round(q.Y * s + ty) })));
}

function circle(cx, cy, r, n = 72) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    p.push({ X: Math.round(cx + Math.cos(a) * r), Y: Math.round(cy + Math.sin(a) * r) });
  }
  return p;
}

// ---------- Font outlines ----------

function flattenCommands(cmds, tol) {
  const out = [];
  let cur = null, px = 0, py = 0;
  const push = (x, y) => cur.push([x, -y]); // opentype is y-down; we work y-up
  for (const c of cmds) {
    switch (c.type) {
      case 'M':
        if (cur && cur.length > 2) out.push(cur);
        cur = []; push(c.x, c.y); px = c.x; py = c.y; break;
      case 'L':
        push(c.x, c.y); px = c.x; py = c.y; break;
      case 'Q': {
        const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1);
        const n = Math.max(2, Math.min(24, Math.ceil(len / tol)));
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          push(u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y);
        }
        px = c.x; py = c.y; break;
      }
      case 'C': {
        const len = Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2);
        const n = Math.max(2, Math.min(32, Math.ceil(len / tol)));
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
          push(a * px + b * c.x1 + d * c.x2 + e * c.x, a * py + b * c.y1 + d * c.y2 + e * c.y);
        }
        px = c.x; py = c.y; break;
      }
      case 'Z':
        if (cur && cur.length > 2) out.push(cur);
        cur = null; break;
    }
  }
  if (cur && cur.length > 2) out.push(cur);
  return out;
}

/**
 * Lays out the text, inflates every glyph and merges them into one bubble shape.
 * Returns Clipper paths in mm·S, centred on the origin and scaled to p.width.
 */
export function buildLetterShape(font, p) {
  const fs = 100; // layout size in "units"; result is scaled to the target width afterwards
  const sc = fs / font.unitsPerEm;
  const spacing = (p.spacing / 100) * fs;
  const lineH = fs * 0.95;
  const bubble = (p.bubble / 100) * fs * S; // negative = thinner letters
  // stretch is applied to the outlines before inflating, so the rounding stays round
  const sx = (p.stretchX ?? 100) / 100, sy = (p.stretchY ?? 100) / 100;

  const lines = String(p.text || '').replace(/\r/g, '').split('\n');
  const glyphShapes = [];

  lines.forEach((line, li) => {
    const glyphs = font.stringToGlyphs(line);
    let x = 0;
    const items = [];
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i];
      const contours = flattenCommands(g.getPath(x, 0, fs).commands, 0.6);
      if (contours.length) items.push(contours);
      let adv = (g.advanceWidth || 0) * sc;
      if (i < glyphs.length - 1) adv += (font.getKerningValue(g, glyphs[i + 1]) || 0) * sc;
      x += adv + spacing;
    }
    const w = x - spacing;
    for (const contours of items) {
      const shifted = contours.map((c) => c.map(([cx, cy]) => [(cx - w / 2) * sx, (cy - li * lineH) * sy]));
      glyphShapes.push(union(toPaths(shifted)));
    }
  });

  if (!glyphShapes.length) return null;

  // every letter is inflated on its own, so each one becomes its own balloon
  let glyphs = glyphShapes.map((g) => offset(g, bubble, 0.05 * S)).filter((g) => g.length);
  const b = bounds(glyphs.flat());
  // p.width is the width at 100 % horizontal stretch; stretching makes the text wider/narrower
  const k = (p.width * sx) / ((b.maxX - b.minX) / S);
  const tx = -((b.minX + b.maxX) / 2) * k, ty = -((b.minY + b.maxY) / 2) * k;
  // drop holes that are too small to print nicely (< 3 mm²)
  const clean = (paths) => paths.filter((path) => area(path) > 0 || -area(path) > 3 * S * S);
  glyphs = glyphs.map((g) => clean(transform(g, k, tx, ty)));
  return { glyphs, union: clean(union(glyphs.flat())) };
}

// ---------- Layer stack ----------

function edgePointAlong(paths, side) {
  // Where a line through the centre of the shape leaves it on the given side.
  const b = bounds(paths);
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  let best = null;
  for (const p of paths) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length];
      if (side === 'left') {
        if ((a.Y > cy) !== (c.Y > cy)) {
          const x = a.X + ((cy - a.Y) * (c.X - a.X)) / (c.Y - a.Y);
          if (!best || x < best.X) best = { X: x, Y: cy };
        }
      } else if ((a.X > cx) !== (c.X > cx)) {
        const y = a.Y + ((cx - a.X) * (c.Y - a.Y)) / (c.X - a.X);
        if (!best || y > best.Y) best = { X: cx, Y: y };
      }
    }
  }
  if (best) return best;
  // fallback: extreme vertex
  for (const p of paths) for (const q of p) {
    if (!best || (side === 'left' ? q.X < best.X : q.Y > best.Y)) best = q;
  }
  return best;
}

function toFlat(paths) {
  return paths.map((p) => {
    const a = new Float64Array(p.length * 2);
    p.forEach((q, i) => { a[2 * i] = q.X / S; a[2 * i + 1] = q.Y / S; });
    return a;
  });
}

/**
 * Builds the printable layer stack from the letter shape.
 * Each layer: { id, label, paths (Float64Array[] in mm), z0, height, profile, edge, puff|fillet, color }
 */
export function buildLayers(shape, p) {
  const warnings = [];
  const layers = [];
  if (!shape || !shape.union.length) return { layers, warnings, info: null };
  const letters = shape.union;

  const islands = letters.filter((q) => area(q) > 0).length;

  let outline = p.outline.on ? offset(letters, p.outline.width * S) : null;
  const footprint = outline || letters;

  let plate = null;
  if (p.plate.on) {
    const b = bounds(footprint);
    const m = p.plate.margin * S;
    const r = Math.min(p.plate.radius * S, (b.maxX - b.minX) / 2 + m - 1, (b.maxY - b.minY) / 2 + m - 1);
    const x0 = b.minX - m + r, x1 = b.maxX + m - r, y0 = b.minY - m + r, y1 = b.maxY + m - r;
    plate = offset([[{ X: x0, Y: y0 }, { X: x1, Y: y0 }, { X: x1, Y: y1 }, { X: x0, Y: y1 }]], r);
  }

  let hole = null, tabOnly = null;
  if (p.keyring.on) {
    const target = plate || footprint;
    const side = p.keyring.side;
    const e = edgePointAlong(target, side);
    const dir = side === 'left' ? { x: -1, y: 0 } : { x: 0, y: 1 };
    const ri = (p.keyring.hole / 2) * S;
    const ro = ri + p.keyring.wall * S;
    const cx = e.X + dir.x * (ri + 1.6 * S), cy = e.Y + dir.y * (ri + 1.6 * S);
    const hw = ro * 0.8;
    const inX = e.X - dir.x * 2 * S, inY = e.Y - dir.y * 2 * S;
    const px = -dir.y, py = dir.x;
    const bridge = [
      { X: Math.round(cx + px * hw), Y: Math.round(cy + py * hw) },
      { X: Math.round(inX + px * hw), Y: Math.round(inY + py * hw) },
      { X: Math.round(inX - px * hw), Y: Math.round(inY - py * hw) },
      { X: Math.round(cx - px * hw), Y: Math.round(cy - py * hw) },
    ];
    const tab = union([circle(cx, cy, ro), bridge]);
    hole = [circle(cx, cy, ri)];
    if (plate) plate = union([...plate, ...tab]);
    else if (outline) outline = union([...outline, ...tab]);
    else tabOnly = difference(tab, letters);
    if (p.keyring.hole < 3) warnings.push({ id: 'warn.smallHole' });
  }

  const cut = (paths) => (hole ? difference(paths, hole) : paths);
  let z = 0;
  if (plate) {
    layers.push({ id: 'plate', label: 'Sockel', paths: toFlat(cut(plate)), z0: z, height: p.plate.thickness, profile: 'flat', fillet: 0.8, color: p.colors.base });
    z += p.plate.thickness;
  }
  if (outline) {
    layers.push({ id: 'outline', label: 'Outline', paths: toFlat(cut(outline)), z0: z, height: p.outline.height, profile: 'flat', fillet: 0.8, color: p.colors.base });
    z += p.outline.height;
  }
  if (tabOnly) {
    layers.push({ id: 'tab', label: 'Öse', paths: toFlat(cut(tabOnly)), z0: 0, height: Math.min(3, p.height), profile: 'flat', fillet: 0.6, color: p.colors.base });
  }
  const glyphs = shape.glyphs.map((g) => toFlat(cut(g))).filter((g) => g.length);
  layers.push(p.style === 'inflated'
    ? { id: 'letters', label: 'Buchstaben', paths: toFlat(cut(letters)), glyphs, z0: z, height: p.height, profile: 'dome', edge: Math.min(p.edge, p.height), puff: p.puff / 100, color: p.colors.letters }
    : { id: 'letters', label: 'Buchstaben', paths: toFlat(cut(letters)), glyphs, z0: z, height: p.height, profile: 'flat', fillet: Math.min(1.2, p.height / 2), color: p.colors.letters });

  if (islands > 1 && !plate && !outline) {
    warnings.push({ id: 'warn.islands', n: islands });
  }
  if (p.style === 'inflated' && p.edge < 0.6) {
    warnings.push({ id: 'warn.thinEdge' });
  }

  const b = bounds(plate || footprint);
  const info = {
    width: (b.maxX - b.minX) / S,
    depth: (b.maxY - b.minY) / S,
    height: z + p.height,
  };
  if (p.keyring.on && !plate) {
    // the tab extends the footprint
    const all = bounds([...(outline || []), ...(tabOnly || []), ...letters]);
    info.width = (all.maxX - all.minX) / S;
    info.depth = (all.maxY - all.minY) / S;
  }
  if (info.width > p.bed || info.depth > p.bed) {
    warnings.push({ id: 'warn.oversize', bed: p.bed });
  }
  return { layers, warnings, info };
}
