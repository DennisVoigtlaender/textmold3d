import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildLetterShape, buildLayers } from './geometry2d.js';
import { toSTL, to3MF, download } from './export.js';
import { t, fmt, parseNum, applyStatic, setLang, onLangChange, lang } from './i18n.js';

// ---------------------------------------------------------------- state

const FONTS = [
  { id: 'TitanOne', name: 'Titan One', file: 'TitanOne-Regular.ttf' },
  { id: 'LilitaOne', name: 'Lilita One', file: 'LilitaOne-Regular.ttf' },
  { id: 'Sniglet', name: 'Sniglet', file: 'Sniglet-ExtraBold.ttf' },
  { id: 'Chewy', name: 'Chewy', file: 'Chewy-Regular.ttf' },
];

const DEFAULTS = {
  text: lang === 'de' ? 'Hallo' : 'Hello',
  font: 'TitanOne',
  style: 'inflated',
  width: 120,
  height: 14,
  bubble: 1,
  spacing: -2,
  stretchX: 100,
  stretchY: 100,
  edge: 2,
  puff: 100,
  outline: { on: false, width: 3, height: 4 },
  plate: { on: false, margin: 6, thickness: 3, radius: 6 },
  keyring: { on: false, side: 'left', hole: 4.5, wall: 2.5 },
  colors: { letters: '#ff5fa2', base: '#f2f2f7' },
  quality: 'standard',
  bed: 256,
};

const PRESETS = {
  name: { style: 'inflated', width: 120, height: 14, bubble: 1, spacing: -2, stretchX: 100, stretchY: 100, edge: 2, puff: 100,
    outline: { on: false }, plate: { on: false }, keyring: { on: false } },
  sign: { style: 'inflated', width: 140, height: 8, bubble: 0.8, spacing: -1, stretchX: 100, stretchY: 100, edge: 1.4, puff: 70,
    outline: { on: false }, plate: { on: true, margin: 8, thickness: 3, radius: 8 }, keyring: { on: false } },
  keychain: { style: 'inflated', width: 60, height: 7, bubble: 1, spacing: -2, stretchX: 100, stretchY: 100, edge: 1.2, puff: 90,
    outline: { on: true, width: 2.5, height: 3 }, plate: { on: false }, keyring: { on: true, side: 'left', hole: 4.5, wall: 2.5 } },
};

const QUALITY = { draft: 0.35, standard: 0.2, fine: 0.13 };
const STORE_KEY = 'textmold3d:v1';

const clone = (o) => JSON.parse(JSON.stringify(o));
function merge(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') merge(target[k], v);
    else if (k in target) target[k] = v;
  }
  return target;
}
let state = clone(DEFAULTS);
try { merge(state, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch { /* storage unavailable */ }
if (!FONTS.some((f) => f.id === state.font)) state.font = DEFAULTS.font;
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ } };

const getKey = (path) => path.split('.').reduce((o, k) => o?.[k], state);
function setKey(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], state)[last] = value;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- 3D viewer

const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
camera.position.set(0, 140, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !reduceMotion.matches; // momentum after a flick
controls.dampingFactor = 0.075;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 20;
controls.maxDistance = 2000;

// Studio lighting: soft key light with a contact shadow, a cool rim light from behind.
const sun = new THREE.DirectionalLight(0xfff6ee, 2.2);
sun.position.set(-90, 260, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 8;
sun.shadow.blurSamples = 16;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.4;
renderer.shadowMap.type = THREE.VSMShadowMap;
const rim = new THREE.DirectionalLight(0xdfe9ff, 1.1);
rim.position.set(120, 90, -220);
scene.add(sun, sun.target, rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9aa2, 0.45));

const bedGroup = new THREE.Group();
scene.add(bedGroup);
const model = new THREE.Group();
model.rotation.x = -Math.PI / 2; // geometry is z-up (printer space), three.js is y-up
scene.add(model);

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function buildBed() {
  bedGroup.clear();
  const size = Number(state.bed);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const line = new THREE.Color(dark ? 0xffffff : 0x1d1d1f);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size * 3, size * 3), new THREE.ShadowMaterial({ opacity: dark ? 0.45 : 0.16 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.receiveShadow = true;
  bedGroup.add(shadow);
  const grid = new THREE.GridHelper(size, size / 10, line, line);
  grid.material.transparent = true;
  grid.material.opacity = dark ? 0.08 : 0.07;
  grid.position.y = 0.02;
  bedGroup.add(grid);
  const r = 10, s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s); shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s); shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r); shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(shape.getPoints(8)),
    new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: dark ? 0.3 : 0.22 }));
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.03;
  bedGroup.add(edge);
}
buildBed();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { buildBed(); });

// The panel covers part of the window, so centre the scene in the visible area.
function layoutCamera() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const panel = document.getElementById('panel').getBoundingClientRect();
  if (w > 760) camera.setViewOffset(w, h, -(panel.right) / 2, 0, w, h);
  else camera.setViewOffset(w, h, 0, (h - panel.top) / 2 - 20, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', layoutCamera);
layoutCamera();

// Critically damped spring (damping 1.0, response 0.4 s) for the "reset view" motion.
const spring = { active: false, from: null };
function springTo(pos, target) {
  if (reduceMotion.matches) {
    camera.position.copy(pos); controls.target.copy(target); controls.update(); return;
  }
  spring.active = true;
  spring.goal = [...pos.toArray(), ...target.toArray()];
  spring.vel = spring.vel && spring.vel.length === 6 ? spring.vel : new Array(6).fill(0);
}
controls.addEventListener('start', () => { spring.active = false; spring.vel = null; }); // grabbing interrupts it

function stepSpring(dt) {
  if (!spring.active) return;
  const omega = (2 * Math.PI) / 0.4, zeta = 1;
  const cur = [...camera.position.toArray(), ...controls.target.toArray()];
  let settled = true;
  for (let i = 0; i < 6; i++) {
    const a = -omega * omega * (cur[i] - spring.goal[i]) - 2 * zeta * omega * spring.vel[i];
    spring.vel[i] += a * dt;
    cur[i] += spring.vel[i] * dt;
    if (Math.abs(cur[i] - spring.goal[i]) > 0.02 || Math.abs(spring.vel[i]) > 0.05) settled = false;
  }
  camera.position.fromArray(cur, 0);
  controls.target.fromArray(cur, 3);
  if (settled) { spring.active = false; spring.vel = null; }
}

let lastInfo = null;
let reframe = false;
function framing(info) {
  const w = info.width, d = info.depth, h = info.height;
  // visible area = window minus the panel
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const panel = document.getElementById('panel').getBoundingClientRect();
  const freeW = vw > 760 ? vw - panel.right - 16 : vw;
  const freeH = vw > 760 ? vh : panel.top;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * (freeW / vh);
  const sizeW = Math.hypot(w, d) * 0.5 + 6;
  const sizeH = Math.max(d * 0.85, h) * 0.5 + 6;
  const dist = Math.max(sizeW / tanH, sizeH / (tanV * (freeH / vh))) * (vw > 760 ? 1.08 : 1.3);
  const target = new THREE.Vector3(0, h * 0.35, 0);
  const dir = new THREE.Vector3(0, 1.25, 1).normalize();
  return { pos: target.clone().addScaledVector(dir, dist), target };
}
document.getElementById('resetView').addEventListener('click', () => {
  if (!lastInfo) return;
  const f = framing(lastInfo);
  springTo(f.pos, f.target);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  stepSpring(dt);
  controls.update();
  renderer.render(scene, camera);
});

function showMeshes(meshes) {
  for (const child of [...model.children]) {
    child.geometry.dispose();
    child.material.dispose();
    model.remove(child);
  }
  for (const m of meshes) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    geo.computeVertexNormals();
    // glossy, slightly translucent-looking plastic – reads like a balloon
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(m.color),
      roughness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      sheen: 0.15,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
      envMapIntensity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    model.add(mesh);
  }
}

function fitShadow(info) {
  const s = Math.max(info.width, info.depth) * 0.75 + 20;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 800 });
  sun.shadow.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- worker

class Mesher {
  constructor() {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.seq = 0;
    this.jobs = new Map();
    this.worker.onmessage = (e) => {
      const { id, progress, meshes, error } = e.data;
      const job = this.jobs.get(id);
      if (!job) return;
      if (progress != null && !meshes && !error) { job.onProgress?.(progress); return; }
      this.jobs.delete(id);
      if (error) job.reject(new Error(error)); else job.resolve(meshes);
    };
  }
  run(layers, h, mode, onProgress) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.jobs.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, layers, h, mode });
    });
  }
}
const previewMesher = new Mesher();
const exportMesher = new Mesher();

// ---------------------------------------------------------------- fonts

const fontCache = new Map();
let customFont = null;
for (const f of FONTS) {
  const face = new FontFace(f.id, `url(fonts/${f.file})`);
  face.load().then((ff) => document.fonts.add(ff)).catch(() => {});
}
async function getFont(id) {
  if (id === 'custom') return customFont?.font;
  if (!fontCache.has(id)) {
    const f = FONTS.find((x) => x.id === id);
    fontCache.set(id, fetch(`fonts/${f.file}`).then((r) => {
      if (!r.ok) throw new Error(t('err.fontMissing', { name: f.name }));
      return r.arrayBuffer();
    }).then((b) => opentype.parse(b)));
  }
  return fontCache.get(id);
}

// ---------------------------------------------------------------- pipeline

const $status = document.getElementById('status');
const $dims = document.getElementById('dims');
const $warnings = document.getElementById('warnings');

// Status line: remember the key so a language switch can re-render it.
let lastStatus = null;
function setStatus(key, vars) {
  lastStatus = key ? [key, vars] : null;
  $status.textContent = key ? t(key, vars) : '';
}
function setStatusRaw(text) { lastStatus = null; $status.textContent = text; }

let shapeCache = { key: '', shape: null };
async function compute2D() {
  const font = await getFont(state.font);
  if (!font) return null;
  const key = JSON.stringify([state.font, customFont?.name, state.text, state.bubble, state.spacing, state.width, state.stretchX, state.stretchY]);
  if (shapeCache.key !== key) shapeCache = { key, shape: buildLetterShape(font, state) };
  return buildLayers(shapeCache.shape, { ...state, bed: Number(state.bed) });
}

let lastWarnings = [];
function showWarnings(codes, force = false) {
  lastWarnings = codes;
  const list = codes.map((w) => t(w.id, { ...w, bed: w.bed != null ? fmt.format(w.bed) : undefined }));
  const current = [...$warnings.children].map((li) => li.textContent);
  if (force) current.length = 0;
  if (current.join('|') === list.join('|')) return;
  $warnings.replaceChildren(...list.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
}

let busy = false, dirty = false;
function requestPreview() {
  dirty = true;
  if (!busy) pump();
}
async function pump() {
  busy = true;
  while (dirty) {
    dirty = false;
    try { await rebuild(); } catch (err) { console.error(err); setStatusRaw(err.message); }
  }
  busy = false;
}

async function rebuild() {
  const result = await compute2D();
  if (!result || !result.layers.length) {
    showMeshes([]);
    $dims.textContent = '–';
    showWarnings([]);
    setStatus(result ? 'status.enterText' : 'status.loadingFont');
    return;
  }
  const { layers, warnings, info } = result;
  $dims.textContent = `${fmt.format(info.width)} × ${fmt.format(info.depth)} × ${fmt.format(info.height)} mm`;
  showWarnings(warnings);
  renderTips(info);
  // Respond fast with a coarse mesh, then refine once the input has settled.
  const maxDim = Math.max(info.width, info.depth);
  const vol = info.width * info.depth * info.height;
  const coarse = Math.max(Math.min(0.9, Math.max(0.3, maxDim / 200)), Math.cbrt(vol / 2e6));
  const fine = Math.max(Math.min(0.4, Math.max(0.16, maxDim / 520)), Math.cbrt(vol / 12e6));
  setStatus('status.computing');
  const meshes = await previewMesher.run(layers, coarse, 'parts');
  if (dirty) return; // a newer request is waiting – don't flash stale geometry
  showMeshes(meshes);
  placeCamera(info);
  setStatus('status.refining');
  await new Promise((r) => setTimeout(r, 120));
  if (dirty) return;
  const detailed = await previewMesher.run(layers, fine, 'parts');
  if (dirty) return;
  showMeshes(detailed);
  setStatus('status.preview');
}

function placeCamera(info) {
  fitShadow(info);
  const first = !lastInfo;
  lastInfo = info;
  if (first) { const f = framing(info); camera.position.copy(f.pos); controls.target.copy(f.target); }
  else if (reframe) { const f = framing(info); springTo(f.pos, f.target); }
  reframe = false;
}

// ---------------------------------------------------------------- print recommendations

const $tips = document.getElementById('tips');
let lastTipsInfo = null;
function renderTips(info) {
  lastTipsInfo = info;
  const inflated = state.style === 'inflated';
  const small = Math.max(info.width, info.depth) < 80;
  const hasBase = state.plate.on || state.outline.on;
  const layer = inflated ? 0.12 : 0.16;
  const mm = (v) => `${fmt.format(v)} mm`;
  const rows = [];
  if (info.pieces > 1) rows.push([t('tip.parts'), t('tip.parts.v', { n: info.pieces }), t('tip.parts.n')]);
  rows.push(
    [t('tip.orientation'), t('tip.orientation.v'), t('tip.orientation.n')],
    [t('tip.layer'), mm(layer), inflated ? t('tip.layer.nInflated') : t('tip.layer.nFlat')],
    [t('tip.walls'), small ? '4' : '3', small ? t('tip.walls.nSmall') : ''],
    [t('tip.top'), inflated ? '7' : '5', inflated ? t('tip.top.n') : ''],
    [t('tip.infill'), `${small || state.keyring.on ? 20 : 12} % Gyroid`, ''],
  );
  const thinEdge = inflated && state.edge < 1 && !hasBase;
  if (thinEdge) rows.push(['Brim', '5 mm', t('tip.brim.nThin')]);
  else if (small && !state.plate.on) rows.push(['Brim', '3 mm', t('tip.brim.nSmall')]);
  else rows.push(['Brim', t('tip.brim.no'), '']);
  if (inflated) rows.push([t('tip.outer'), '≤ 60 mm/s', t('tip.outer.n')]);
  rows.push([t('tip.seam'), t('tip.seam.v'), t('tip.seam.n')]);
  if (hasBase || !inflated) rows.push([t('tip.ironing'), t('tip.ironing.v'), state.plate.on ? t('tip.ironing.nPlate') : t('tip.ironing.nFlat')]);
  if (hasBase) {
    const z = state.plate.on ? state.plate.thickness : 0;
    const zl = z + (state.outline.on ? state.outline.height : 0);
    rows.push([t('tip.color'), t('tip.color.v', { z: mm(zl) }), t('tip.color.n', { z: mm(zl) })]);
  }
  rows.push([t('tip.plate'), t('tip.plate.v'), t('tip.plate.n')]);
  $tips.replaceChildren(...rows.map(([k, v, note]) => {
    const row = document.createElement('div');
    row.className = 'tip';
    const head = document.createElement('div');
    head.className = 'tip-head';
    head.append(Object.assign(document.createElement('span'), { textContent: k }),
      Object.assign(document.createElement('strong'), { textContent: v }));
    row.append(head);
    if (note) row.append(Object.assign(document.createElement('p'), { textContent: note }));
    return row;
  }));
}

// ---------------------------------------------------------------- export

function fileBase() {
  const slug = state.text.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '');
  return (slug || 'bubble') + '-bubble';
}

async function exportFile(kind, btn) {
  if (btn.classList.contains('busy')) return;
  const result = await compute2D();
  if (!result || !result.layers.length) return;
  const { layers, info } = result;
  let h = QUALITY[state.quality] || 0.25;
  h = Math.max(h, Math.cbrt((info.width * info.depth * info.height) / 60e6));
  const label = btn.textContent;
  btn.classList.add('busy');
  btn.style.setProperty('--p', 0);
  btn.textContent = t('status.exportBtn');
  setStatus('status.exporting', { h: fmt.format(h) });
  try {
    const meshes = await exportMesher.run(layers, h, kind === 'stl' ? 'union' : 'parts',
      (p) => btn.style.setProperty('--p', p.toFixed(3)));
    btn.style.setProperty('--p', 1);
    const tris = meshes.reduce((s, m) => s + m.indices.length / 3, 0);
    if (kind === 'stl') download(toSTL(meshes[0]), `${fileBase()}.stl`);
    else download(to3MF(meshes, { name: state.text.trim() || 'Bubble Letters', bed: Number(state.bed) }), `${fileBase()}.3mf`);
    setStatus('status.saved', { kind: kind.toUpperCase(), k: fmt.format(Math.round(tris / 1000)) });
  } catch (err) {
    console.error(err);
    setStatus('status.exportFailed', { msg: err.message });
  } finally {
    btn.classList.remove('busy');
    btn.textContent = btn.dataset.i18n ? t(btn.dataset.i18n) : label;
  }
}
document.getElementById('exportStl').addEventListener('click', (e) => exportFile('stl', e.currentTarget));
document.getElementById('export3mf').addEventListener('click', (e) => exportFile('3mf', e.currentTarget));

// ---------------------------------------------------------------- controls

function setRangeFill(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--p', `${p}%`);
}

function renderOutput(key) {
  const num = document.querySelector(`input.num[data-for="${key}"]`);
  if (num && document.activeElement !== num) num.value = fmt.format(getKey(key));
}

// Every slider gets a small number field next to its label for typing exact values.
// Typed values may go beyond the slider's range where data-input-min/max allow it
// (e.g. a width larger than the print bed).
function setupNumberFields() {
  document.querySelectorAll('output[data-for]').forEach((out) => {
    const key = out.dataset.for;
    const range = document.querySelector(`input[type="range"][data-key="${key}"]`);
    const wrap = document.createElement('span');
    wrap.className = 'num-wrap';
    const num = document.createElement('input');
    num.type = 'text';
    num.inputMode = 'decimal';
    num.className = 'num';
    num.dataset.for = key;
    num._range = range;
    wrap.append(num, Object.assign(document.createElement('span'), { className: 'unit', textContent: range.dataset.unit || '' }));
    out.replaceWith(wrap);

    const min = Number(range.dataset.inputMin ?? range.min);
    const max = Number(range.dataset.inputMax ?? range.max);
    const step = Number(range.step) || 1;
    const parse = () => parseNum(num.value);
    const commit = (value) => {
      if (!Number.isFinite(value)) { num.classList.add('invalid'); return; }
      num.classList.remove('invalid');
      value = Math.min(max, Math.max(min, Math.round(value / step) * step));
      value = Number(value.toFixed(3));
      setKey(key, value);
      range.value = value; // the thumb parks at the end when the value is beyond the slider
      setRangeFill(range);
      num.value = fmt.format(value);
      if (key === 'width' || key.startsWith('stretch')) reframe = true; // a typed size can jump a lot – glide to a fitting view
      changed();
    };
    num.addEventListener('focus', () => num.select());
    num.addEventListener('input', () => num.classList.toggle('invalid', !Number.isFinite(parse())));
    num.addEventListener('change', () => commit(parse()));
    num.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(parse()); num.blur(); }
      else if (e.key === 'Escape') { num.value = fmt.format(getKey(key)); num.classList.remove('invalid'); num.blur(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const base = Number.isFinite(parse()) ? parse() : getKey(key);
        commit(base + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
        num.select();
      }
    });
  });
}

function syncSeg(seg) {
  const value = String(getKey(seg.dataset.key));
  const buttons = [...seg.querySelectorAll('button')];
  const i = Math.max(0, buttons.findIndex((b) => b.dataset.value === value));
  buttons.forEach((b, j) => b.setAttribute('aria-checked', String(j === i)));
  const thumb = seg.querySelector('.seg-thumb');
  thumb.style.width = `calc((100% - 4px) / ${buttons.length})`;
  thumb.style.transform = `translateX(${i * 100}%)`;
}

function syncVisibility() {
  document.querySelectorAll('[data-show]').forEach((el) => {
    const [k, v] = el.dataset.show.split('=');
    el.hidden = String(getKey(k)) !== v;
  });
  document.querySelectorAll('[data-enable]').forEach((el) => el.classList.toggle('off', !getKey(el.dataset.enable)));
  document.querySelectorAll('[data-badge]').forEach((el) => { el.hidden = !getKey(el.dataset.badge); });
}

function syncAll() {
  document.querySelectorAll('[data-key]').forEach((el) => {
    const key = el.dataset.key;
    const v = getKey(key);
    if (el.classList.contains('seg')) syncSeg(el);
    else if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
    if (el.type === 'range') { setRangeFill(el); renderOutput(key); }
  });
  syncFonts();
  syncVisibility();
}

function changed() {
  syncVisibility();
  save();
  requestPreview();
}

document.querySelectorAll('[data-key]').forEach((el) => {
  const key = el.dataset.key;
  if (el.classList.contains('seg')) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      setKey(key, b.dataset.value);
      syncSeg(el);
      changed();
    });
    return;
  }
  el.addEventListener('input', () => {
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'range') v = Number(el.value);
    else v = el.value;
    setKey(key, v);
    if (el.type === 'range') { setRangeFill(el); renderOutput(key); }
    if (key === 'bed') buildBed();
    changed();
  });
});

// Presets
document.getElementById('presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  merge(state, clone(PRESETS[b.dataset.preset]));
  syncAll();
  reframe = true; // glide to a view that fits the new size
  changed();
});

// Fonts
const $fonts = document.getElementById('fonts');
const $fontFile = document.getElementById('fontFile');
function renderFonts() {
  const chips = FONTS.map((f) => {
    const b = document.createElement('button');
    b.className = 'chip font';
    b.dataset.font = f.id;
    b.textContent = f.name;
    b.style.fontFamily = `"${f.id}", system-ui`;
    return b;
  });
  const own = document.createElement('button');
  own.className = 'chip';
  own.dataset.font = 'custom';
  own.textContent = customFont ? customFont.name : t('font.custom');
  chips.push(own);
  $fonts.replaceChildren(...chips);
  syncFonts();
}
function syncFonts() {
  $fonts.querySelectorAll('[data-font]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.font === state.font)));
}
$fonts.addEventListener('click', (e) => {
  const b = e.target.closest('[data-font]');
  if (!b) return;
  if (b.dataset.font === 'custom' && (!customFont || state.font === 'custom')) { $fontFile.click(); return; }
  state.font = b.dataset.font;
  syncFonts();
  if (state.font !== 'custom') save();
  requestPreview();
});
$fontFile.addEventListener('change', async () => {
  const file = $fontFile.files[0];
  if (!file) return;
  setStatus('status.loadingFile', { name: file.name });
  try {
    const font = opentype.parse(await file.arrayBuffer());
    customFont = { name: file.name.replace(/\.(ttf|otf)$/i, ''), font };
    state.font = 'custom';
    renderFonts();
    requestPreview();
  } catch (err) {
    setStatus('status.badFont');
  }
  $fontFile.value = '';
});

// Disclosure groups: open and close along the same path, interruptible mid-way.
document.querySelectorAll('details.group').forEach((det) => {
  const summary = det.querySelector('summary');
  const content = det.querySelector('.content');
  let anim = null;
  summary.addEventListener('click', (e) => {
    e.preventDefault();
    const opening = !det.open || det.dataset.closing === '1';
    const start = content.getBoundingClientRect().height;
    anim?.cancel();
    if (reduceMotion.matches) { det.open = opening; delete det.dataset.closing; return; }
    if (opening) {
      det.open = true;
      delete det.dataset.closing;
      const end = content.scrollHeight;
      anim = content.animate({ height: [`${start}px`, `${end}px`], opacity: [start ? 1 : 0, 1] },
        { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      anim.onfinish = () => { anim = null; };
    } else {
      det.dataset.closing = '1';
      anim = content.animate({ height: [`${start}px`, '0px'], opacity: [1, 0] },
        { duration: 240, easing: 'cubic-bezier(0.8, 0, 0.8, 0.2)' });
      anim.onfinish = () => { det.open = false; delete det.dataset.closing; anim = null; };
    }
  });
});

// Number fields get their accessible name from the slider label (re-done on language change).
function labelNumberFields() {
  document.querySelectorAll('input.num').forEach((num) => {
    const r = num._range;
    num.setAttribute('aria-label', `${r.labels?.[0]?.textContent || num.dataset.for} ${t('in')} ${r.dataset.unit || ''}`);
  });
}

// Language switch
const $langButtons = document.querySelectorAll('[data-lang]');
function syncLangButtons() {
  $langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  // keep the language when following the footer links
  document.querySelectorAll('.panel-foot a').forEach((a) => {
    a.href = `rechtliches.html?lang=${lang}${a.hash}`;
  });
}
$langButtons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
onLangChange(() => {
  syncLangButtons();
  labelNumberFields();
  renderFonts();
  document.querySelectorAll('input[type="range"][data-key]').forEach((r) => renderOutput(r.dataset.key));
  if (lastTipsInfo) renderTips(lastTipsInfo);
  showWarnings(lastWarnings, true);
  if (lastStatus) setStatus(...lastStatus);
  if (lastInfo) $dims.textContent = `${fmt.format(lastInfo.width)} × ${fmt.format(lastInfo.depth)} × ${fmt.format(lastInfo.height)} mm`;
});

document.body.classList.add('no-anim'); // no transitions for the initial layout
applyStatic();
syncLangButtons();
setupNumberFields();
labelNumberFields();
renderFonts();
syncAll();
requestPreview();
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-anim')));
