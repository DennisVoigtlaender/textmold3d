# TextMold 3D

Namen und Texte im Browser in 3D-Buchstaben verwandeln (aufgeblasen als Bubble Letters oder flach) und als STL oder 3MF für den 3D-Drucker sichern.

## Starten

```bash
python3 -m http.server 8000
```

Im Projektordner ausführen, dann <http://localhost:8000> öffnen. Alle Libraries (three.js, opentype.js, clipper-lib) liegen lokal in `vendor/`, die Schriften in `fonts/`. Die Seite lädt nichts von Drittanbietern. Einzige Ausnahme: Die cookiefreie Besucherstatistik von GoatCounter (`vendor/goatcounter/count.js`, lokal gehostet) sendet Zählungen an `textmold3d.goatcounter.com`. Auf localhost zählt sie nicht.

## Funktionen

- **Stil:** *Aufgeblasen* (jeder Buchstabe als eigener Ballon, flache Unterseite) oder *Flach* (extrudiert mit runder Oberkante)
- **Vorlagen:** Bubble-Name, Namensschild (mit Sockelplatte), Anhänger (mit Outline und Öse)
- **Extras:** Outline-Rand, Sockelplatte, Schlüsselanhänger-Öse (links oder oben), eigene TTF/OTF-Schrift
- **Sprachen:** Deutsch und Englisch. Die Sprache wird aus dem Browser erkannt, per DE/EN-Schalter gewählt oder über `?lang=de` / `?lang=en` festgelegt. Alle Texte stehen in `src/i18n.js`.
- **Export:**
  - **STL:** ein einzelner, wasserdichter Körper, ideal für Einfarbdruck
  - **3MF:** ein Objekt mit mehreren Teilen (Buchstaben / Outline / Sockel). Bambu Studio lädt es als ein Objekt, und du weist jedem Teil ein Filament zu.

## Druck-Tipps

- Flach aufs Bett legen (Unterseite ist eben), Stützen sind nicht nötig.
- Bei kleiner Randhöhe (< 1 mm) einen Brim verwenden.
- Für glatte Kuppeln: 0,12–0,16 mm Schichthöhe, eventuell „Ironing“ für Sockel und Outline.
- Mehrfarbig ohne AMS: Sockel/Outline in Farbe A drucken und bei Beginn der Buchstaben-Schichthöhe einen Filamentwechsel (Pause) einfügen.

## Aufbau

| Datei | Aufgabe |
| --- | --- |
| `src/geometry2d.js` | Text → Glyph-Konturen → Bubble-Form, Outline, Sockel, Öse (clipper-lib) |
| `src/mesher.js` | Distanzfelder + Marching Cubes → wasserdichte Meshes (läuft im Web Worker) |
| `src/export.js` | Binäres STL und 3MF (fflate) |
| `src/app.js` | Oberfläche, three.js-Vorschau, Export |
| `src/i18n.js` | Übersetzungen (DE/EN), Spracherkennung, Zahlenformat |

Schriften: Titan One, Lilita One, Sniglet (SIL Open Font License, je eine `fonts/*-OFL.txt`) und Chewy (Apache 2.0, `fonts/Chewy-LICENSE-Apache2.txt`).
