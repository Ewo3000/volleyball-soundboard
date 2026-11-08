# Implementation Plan: Audio-Stabilität, Transparenter Auto-Pegel, 5-Preset Equalizer, 3s Fade-Out & Broadcast-VFX (v1.13.0)

**Goal:** Behebung des Web-Audio-Node-Lecks nach längerer Nutzung, transparenter Auto-Pegel ohne dumpfen Klang, Verlängerung des Stop-Fade-Outs auf 3 Sekunden, 5-Preset-Equalizer-Popup-Menü inkl. Auto-Pegel-Option sowie Aufwertung aller Animationen (Startup-Splash, Ass, Block, 6/7).

**Architecture:**
- `js/audio-engine.js`: `cleanupAudioResources()` für lückenloses `.disconnect()` und MediaElement-Freigabe; `TARGET_RMS = 0.26` + transparenter Brickwall-Limiter (`-2 dB`); 3-Band-Equalizer (`BiquadFilterNode`: Low-Shelf 80 Hz, Mid-Peaking 1 kHz, High-Shelf 4 kHz) mit 5 Presets (`EQ_PRESETS`); Standard-Fade-Out `stop(fadeDurationMs = 3000)`.
- `index.html`, `js/app.js`, `css/app.css`: Sound/EQ-Button (`#btn-eq-menu`) + `#eq-modal` mit Auto-Pegel-Schalter (`#btn-auto-norm`) und 5 EQ-Preset-Buttons; verbesserte Broadcast-VFX für `#startup-splash`, `triggerAceAnimation()`, `triggerBlockAnimation()`, `triggerSixSevenAnimation()`; `stopAudio()` mit `3000ms` Fade-Out.
- `js/db.js`: Speicherung von `normVersion` neben `normGain` in `updateTrackGain()`.

---

### Task 1: AudioEngine – Resource-Leak-Fix, 3s Fade-Out, Transparenter Auto-Pegel & 5-Preset Equalizer

**Files:**
- Modify: `js/audio-engine.js`
- Modify: `js/db.js`
- Test: `tests/audio-engine.test.js`, `tests/volume-normalization.test.js`

- [x] Step 1: `EQ_PRESETS` und `NORM_VERSION = 2` in `js/audio-engine.js` definieren und exportieren.
- [x] Step 2: `TARGET_RMS = 0.26`, `MIN_NORM_GAIN = 0.75`, `MAX_NORM_GAIN = 2.4` und Brickwall-Limiter (`threshold: -2`, `knee: 3`, `ratio: 12`, `attack: 0.015`, `release: 0.15`) aktualisieren.
- [x] Step 3: 3-Band-EQ (`eqLow`, `eqMid`, `eqHigh`) in `initAudioContext()` erstellen, `setEqPreset(presetId)` / `getEqPreset()` implementieren und in die Signalkette einbinden.
- [x] Step 4: `cleanupAudioResources({ audio, source, trackGain, objectUrl })` implementieren, sodass bei `onended` und nach Ablauf von `stop(fadeDurationMs = 3000)` alle Web-Audio-Nodes via `.disconnect()` getrennt und `<audio>`-Elemente + Object-URLs sauber aufgeräumt werden.

### Task 2: Sound/EQ Popup-Menü & 3s Stop-Fade-Out in UI & App-Controller

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/app.css`
- Test: `tests/adjustments.test.js`, `tests/volume-normalization.test.js`

- [x] Step 1: In `index.html` den Header-Button `#btn-eq-menu` (`🎛️ Sound / EQ`) und das Popup-Modal `#eq-modal` (mit `#btn-auto-norm` und den 5 `.eq-preset-btn`-Optionen) einfügen.
- [x] Step 2: In `js/app.js` `openEqModal()`, `closeEqModal()`, `applyEqPreset(presetId)`, `stopAudio()` (`audioEngine.stop(3000)`) sowie das schonende Pausieren der Hintergrund-Normalisierung während laufender Wiedergabe implementieren.
- [x] Step 3: Styles für `.btn-eq-menu` und `.eq-modal` in `css/app.css` ergänzen.

### Task 3: Broadcast-VFX für Startup-Splash, Ass, Block & 6/7

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/app.css`
- Test: `tests/fx.test.js`, `tests/startup-splash.test.js`

- [x] Step 1: `#startup-splash` in `index.html` und `css/app.css` mit Arena-Spotlights, 3D-Ring und 9-Band-Soundwave ausstatten.
- [x] Step 2: `triggerAceAnimation()`, `triggerBlockAnimation()` und `triggerSixSevenAnimation()` in `js/app.js` und `css/app.css` mit hochwertigen SVG-Icons, Partikel-Funken, Schockwellen und 3D-Broadcast-Bannern erweitern.

### Task 4: Version Bump auf `1.13.0` & Gesamttestlauf

**Files:**
- Modify: `js/app.js`, `version.json`, `package.json`, `sw.js`
- Test: `npm test`
