import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';

/** Binary STL from one indexed mesh (z-up, mm). */
export function toSTL(mesh) {
  const { positions: P, indices: I } = mesh;
  const n = I.length / 3;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const header = 'TextMold 3D';
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const v of [nx, ny, nz, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]]) {
      dv.setFloat32(o, v, true); o += 4;
    }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

const hex = (c) => '#' + c.replace('#', '').toUpperCase().padEnd(6, '0') + 'FF';
const esc = (s) => s.replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);

/**
 * 3MF with one object made of several parts (one per layer), so a slicer such as
 * Bambu Studio can assign a filament to each part. Placed in the centre of the bed.
 */
export function to3MF(meshes, { name = 'Bubble Letters', bed = 256 } = {}) {
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="de-DE" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">');
  out.push(`<metadata name="Title">${esc(name)}</metadata><metadata name="Application">TextMold 3D</metadata>`);
  out.push('<resources><basematerials id="1">');
  meshes.forEach((m) => out.push(`<base name="${esc(m.label)}" displaycolor="${hex(m.color)}"/>`));
  out.push('</basematerials>');
  meshes.forEach((m, i) => {
    out.push(`<object id="${i + 2}" type="model" name="${esc(m.label)}" pid="1" pindex="${i}"><mesh><vertices>`);
    const P = m.positions;
    const parts = [];
    for (let v = 0; v < P.length; v += 3) {
      parts.push(`<vertex x="${P[v].toFixed(4)}" y="${P[v + 1].toFixed(4)}" z="${P[v + 2].toFixed(4)}"/>`);
    }
    out.push(parts.join(''));
    out.push('</vertices><triangles>');
    const I = m.indices;
    const tris = [];
    for (let t = 0; t < I.length; t += 3) tris.push(`<triangle v1="${I[t]}" v2="${I[t + 1]}" v3="${I[t + 2]}"/>`);
    out.push(tris.join(''));
    out.push('</triangles></mesh></object>');
  });
  const asm = meshes.length + 2;
  out.push(`<object id="${asm}" type="model" name="${esc(name)}"><components>`);
  meshes.forEach((m, i) => out.push(`<component objectid="${i + 2}"/>`));
  out.push('</components></object></resources>');
  out.push(`<build><item objectid="${asm}" transform="1 0 0 0 1 0 0 0 1 ${bed / 2} ${bed / 2} 0"/></build></model>`);

  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(out.join('')),
  };
  return new Blob([zipSync(files, { level: 6 })], { type: 'model/3mf' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
