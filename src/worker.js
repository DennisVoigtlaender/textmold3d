import { buildMeshes } from './mesher.js';

self.onmessage = (e) => {
  const { id, layers, h, mode } = e.data;
  try {
    let last = 0;
    const meshes = buildMeshes(layers, {
      h,
      mode,
      onProgress: (p) => {
        const now = performance.now();
        if (now - last > 80) { last = now; self.postMessage({ id, progress: p }); }
      },
    });
    const transfer = meshes.flatMap((m) => [m.positions.buffer, m.indices.buffer]);
    self.postMessage({ id, meshes }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
