// Tiny i18n: German + English. Language comes from ?lang=, then the saved choice,
// then the browser. Static texts are tagged in the HTML with data-i18n attributes.

export const LANGS = ['de', 'en'];
const LANG_KEY = 'textmold3d:lang';

const STRINGS = {
  de: {
    'meta.title': 'TextMold 3D – Namen & Bubble Letters als STL/3MF für den 3D-Druck',
    'meta.description': 'Verwandle Namen und Texte in druckfertige 3D-Buchstaben – aufgeblasen als Bubble Letters oder flach. Kostenlos, direkt im Browser, Export als STL und 3MF für Bambu Lab, Prusa & Co.',
    'viewport': '3D-Vorschau',
    'sub': 'Text eingeben, anpassen, drucken.',
    'lang.label': 'Sprache',
    'text': 'Text',
    'preset': 'Vorlage',
    'preset.name': 'Bubble-Name',
    'preset.sign': 'Namensschild',
    'preset.keychain': 'Anhänger',
    'font': 'Schrift',
    'font.custom': 'Eigene …',
    'style': 'Stil',
    'style.inflated': 'Aufgeblasen',
    'style.flat': 'Flach',
    'width': 'Breite',
    'height': 'Höhe der Buchstaben',
    'bubble': 'Rundung',
    'spacing': 'Buchstabenabstand',
    'stretchX': 'Horizontal strecken',
    'stretchY': 'Vertikal strecken',
    'dome': 'Wölbung',
    'edge': 'Randhöhe',
    'puff': 'Prallheit',
    'puff.hint': 'Weniger Prallheit gibt eine flachere Oberseite mit runden Kanten – wie ein Kissen.',
    'on': 'An',
    'outline': 'Outline',
    'outline.switch': 'Outline-Rand',
    'outline.width': 'Randbreite',
    'outline.height': 'Randhöhe',
    'plate': 'Sockelplatte',
    'plate.margin': 'Rand',
    'plate.thickness': 'Dicke',
    'plate.radius': 'Eckenradius',
    'keyring': 'Schlüsselanhänger',
    'keyring.switch': 'Öse anfügen',
    'keyring.side': 'Position der Öse',
    'keyring.left': 'Links',
    'keyring.top': 'Oben',
    'keyring.hole': 'Loch-Ø',
    'keyring.wall': 'Ringstärke',
    'colors': 'Farben',
    'colors.letters': 'Buchstaben',
    'colors.base': 'Outline & Sockel',
    'colors.hint': 'Nur für die Vorschau und das 3MF. Einfarbig drucken: STL nehmen.',
    'print': 'Druck',
    'quality': 'Exportqualität',
    'quality.draft': 'Entwurf',
    'quality.standard': 'Standard',
    'quality.fine': 'Fein',
    'bed': 'Druckbett',
    'tips': 'Druckempfehlung',
    'tips.hint': 'Für PLA mit 0,4-mm-Düse (z.B. Bambu Studio). Die Werte passen sich an dein Modell an.',
    'foot.privacy': 'Datenschutz',
    'foot.licenses': 'Schriften & Lizenzen',
    'export.3mf.title': 'Mehrere Teile – im Slicer je eigenes Filament',
    'export.stl': 'STL sichern',
    'resetView': 'Ansicht zurücksetzen',
    'in': 'in',

    'status.enterText': 'Text eingeben',
    'status.loadingFont': 'Schrift wird geladen …',
    'status.computing': 'Berechne Vorschau …',
    'status.refining': 'Verfeinere …',
    'status.preview': 'Vorschau',
    'status.exportBtn': 'Berechne …',
    'status.exporting': (v) => `Export mit ${v.h} mm Auflösung …`,
    'status.saved': (v) => `${v.kind} gesichert · ${v.k}k Dreiecke`,
    'status.exportFailed': (v) => `Export fehlgeschlagen: ${v.msg}`,
    'status.loadingFile': (v) => `Lade ${v.name} …`,
    'status.badFont': 'Diese Schriftdatei kann nicht gelesen werden.',
    'err.fontMissing': (v) => `Schrift ${v.name} nicht gefunden`,

    'warn.smallHole': 'Loch unter 3 mm – der Ring passt evtl. nicht durch.',
    'warn.islands': (v) => `Das Modell zerfällt in ${v.n} Einzelteile (einzelne Buchstaben oder i-Punkte) – Rundung erhöhen, Abstand verringern oder Outline/Sockel einschalten.`,
    'warn.thinEdge': 'Randhöhe unter 0,6 mm – die dünne Kante kann sich vom Bett lösen.',
    'warn.oversize': (v) => `Größer als das Druckbett (${v.bed} mm) – im Slicer zerschneiden (Schneidewerkzeug) und in Teilen drucken.`,

    'tip.orientation': 'Ausrichtung', 'tip.orientation.v': 'Flach aufs Bett', 'tip.orientation.n': 'Unterseite ist eben – keine Stützen nötig.',
    'tip.layer': 'Schichthöhe', 'tip.layer.nInflated': 'Feine Schichten machen die Kuppeln glatt (Profil „0.12mm Fine“).', 'tip.layer.nFlat': 'Profil „0.16mm Optimal“.',
    'tip.walls': 'Wände', 'tip.walls.nSmall': 'Kleine Teile werden dadurch stabil.',
    'tip.top': 'Obere Schichten', 'tip.top.n': 'Auf flach geneigten Kuppeln scheint sonst die Füllung durch.',
    'tip.infill': 'Füllung',
    'tip.brim.nThin': 'Die Randhöhe ist niedrig – der Brim hält die Kante am Bett.', 'tip.brim.nSmall': 'Kleine Grundfläche – hilft gegen Ablösen.', 'tip.brim.no': 'Nicht nötig',
    'tip.outer': 'Außenwand', 'tip.outer.n': 'Langsamer = glattere Rundungen.',
    'tip.seam': 'Naht', 'tip.seam.v': 'Hinten', 'tip.seam.n': 'Versteckt die Naht auf der Rückseite der Buchstaben.',
    'tip.ironing': 'Bügeln', 'tip.ironing.v': 'Oberste Flächen', 'tip.ironing.nPlate': 'Macht die Sockelplatte glatt.', 'tip.ironing.nFlat': 'Für glatte flache Oberseiten.',
    'tip.color': 'Farbwechsel', 'tip.color.v': (v) => `ab ${v.z}`,
    'tip.color.n': (v) => `Ohne AMS: in der Slicer-Vorschau auf der ersten Schicht über ${v.z} eine Pause/Farbwechsel einfügen. Mit AMS: 3MF laden und jedem Teil ein Filament geben.`,
    'tip.plate': 'Druckplatte', 'tip.plate.v': 'Glatte PEI', 'tip.plate.n': 'Glänzende Unterseite; texturierte PEI gibt eine Struktur.',
  },
  en: {
    'meta.title': 'TextMold 3D – Names & Bubble Letters as STL/3MF for 3D Printing',
    'meta.description': 'Turn names and text into print-ready 3D letters – puffy bubble letters or flat. Free, right in your browser, export as STL and 3MF for Bambu Lab, Prusa & co.',
    'viewport': '3D preview',
    'sub': 'Type, tweak, print.',
    'lang.label': 'Language',
    'text': 'Text',
    'preset': 'Template',
    'preset.name': 'Bubble name',
    'preset.sign': 'Name sign',
    'preset.keychain': 'Keychain',
    'font': 'Font',
    'font.custom': 'Custom …',
    'style': 'Style',
    'style.inflated': 'Puffy',
    'style.flat': 'Flat',
    'width': 'Width',
    'height': 'Letter height',
    'bubble': 'Roundness',
    'spacing': 'Letter spacing',
    'stretchX': 'Stretch horizontally',
    'stretchY': 'Stretch vertically',
    'dome': 'Dome',
    'edge': 'Edge height',
    'puff': 'Puffiness',
    'puff.hint': 'Less puffiness gives a flatter top with rounded edges – like a cushion.',
    'on': 'On',
    'outline': 'Outline',
    'outline.switch': 'Outline border',
    'outline.width': 'Border width',
    'outline.height': 'Border height',
    'plate': 'Base plate',
    'plate.margin': 'Margin',
    'plate.thickness': 'Thickness',
    'plate.radius': 'Corner radius',
    'keyring': 'Keychain',
    'keyring.switch': 'Add a loop',
    'keyring.side': 'Loop position',
    'keyring.left': 'Left',
    'keyring.top': 'Top',
    'keyring.hole': 'Hole Ø',
    'keyring.wall': 'Ring thickness',
    'colors': 'Colors',
    'colors.letters': 'Letters',
    'colors.base': 'Outline & base',
    'colors.hint': 'Only for the preview and the 3MF. For single-color prints, use the STL.',
    'print': 'Print',
    'quality': 'Export quality',
    'quality.draft': 'Draft',
    'quality.standard': 'Standard',
    'quality.fine': 'Fine',
    'bed': 'Print bed',
    'tips': 'Print settings',
    'tips.hint': 'For PLA with a 0.4 mm nozzle (e.g. Bambu Studio). The values adapt to your model.',
    'foot.privacy': 'Privacy',
    'foot.licenses': 'Fonts & licenses',
    'export.3mf.title': 'Multiple parts – one filament each in the slicer',
    'export.stl': 'Save STL',
    'resetView': 'Reset view',
    'in': 'in',

    'status.enterText': 'Type some text',
    'status.loadingFont': 'Loading font …',
    'status.computing': 'Computing preview …',
    'status.refining': 'Refining …',
    'status.preview': 'Preview',
    'status.exportBtn': 'Computing …',
    'status.exporting': (v) => `Exporting at ${v.h} mm resolution …`,
    'status.saved': (v) => `${v.kind} saved · ${v.k}k triangles`,
    'status.exportFailed': (v) => `Export failed: ${v.msg}`,
    'status.loadingFile': (v) => `Loading ${v.name} …`,
    'status.badFont': 'This font file can’t be read.',
    'err.fontMissing': (v) => `Font ${v.name} not found`,

    'warn.smallHole': 'Hole under 3 mm – a key ring may not fit through.',
    'warn.islands': (v) => `The model falls apart into ${v.n} separate pieces (single letters or i-dots) – increase roundness, reduce spacing or turn on outline/base plate.`,
    'warn.thinEdge': 'Edge height under 0.6 mm – the thin edge may lift off the bed.',
    'warn.oversize': (v) => `Larger than the print bed (${v.bed} mm) – cut it in the slicer (cut tool) and print in parts.`,

    'tip.orientation': 'Orientation', 'tip.orientation.v': 'Flat on the bed', 'tip.orientation.n': 'The bottom is flat – no supports needed.',
    'tip.layer': 'Layer height', 'tip.layer.nInflated': 'Fine layers make the domes smooth (profile “0.12mm Fine”).', 'tip.layer.nFlat': 'Profile “0.16mm Optimal”.',
    'tip.walls': 'Walls', 'tip.walls.nSmall': 'Makes small parts sturdy.',
    'tip.top': 'Top layers', 'tip.top.n': 'Otherwise the infill shows through on gently sloped domes.',
    'tip.infill': 'Infill',
    'tip.brim.nThin': 'The edge is low – the brim keeps it on the bed.', 'tip.brim.nSmall': 'Small footprint – helps against lifting.', 'tip.brim.no': 'Not needed',
    'tip.outer': 'Outer wall', 'tip.outer.n': 'Slower = smoother curves.',
    'tip.seam': 'Seam', 'tip.seam.v': 'Back', 'tip.seam.n': 'Hides the seam on the back of the letters.',
    'tip.ironing': 'Ironing', 'tip.ironing.v': 'Topmost surfaces', 'tip.ironing.nPlate': 'Makes the base plate smooth.', 'tip.ironing.nFlat': 'For smooth flat tops.',
    'tip.color': 'Color change', 'tip.color.v': (v) => `at ${v.z}`,
    'tip.color.n': (v) => `Without AMS: in the slicer preview, add a pause/color change on the first layer above ${v.z}. With AMS: load the 3MF and give each part its own filament.`,
    'tip.plate': 'Build plate', 'tip.plate.v': 'Smooth PEI', 'tip.plate.n': 'Glossy bottom; textured PEI gives a texture.',
  },
};

function detect() {
  const param = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(param)) return param;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  const browser = (navigator.languages || [navigator.language || 'en']).map((l) => l.slice(0, 2).toLowerCase());
  return browser.find((l) => LANGS.includes(l)) || 'en';
}

export let lang = detect();
export let fmt = makeFmt();
function makeFmt() { return new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }); }

export function t(key, vars = {}) {
  const v = STRINGS[lang][key] ?? STRINGS.de[key] ?? key;
  return typeof v === 'function' ? v(vars) : v;
}

// Parse a typed number. Both "1,5" and "1.5" mean one and a half; in English
// "1,000" (comma + exactly three digits) is read as a thousands separator.
export function parseNum(s) {
  s = String(s).replace(/\s/g, '');
  if (lang === 'en' && /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  return s === '' ? NaN : Number(s);
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  if (STRINGS[lang]['meta.title'] && document.querySelector('meta[name="description"]')) {
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]').content = t('meta.description');
  }
}

const listeners = [];
export function onLangChange(fn) { listeners.push(fn); }

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  fmt = makeFmt();
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  history.replaceState(null, '', url);
  applyStatic();
  listeners.forEach((fn) => fn(next));
}
