# Design Specification: Audio-Stabilität, Transparenter Auto-Pegel, 5-Preset Equalizer, 3s Fade-Out & Broadcast-VFX (v1.13.0)

**Datum:** 2026-11-08  
**Projekt:** SV 1845 Esslingen – Volleyball DJ Soundboard  
**Zielversion:** `1.13.0`

---

## 1. Übersicht & Ziele

1. **Behebung des Audio-Knarzens nach ~1 Stunde Nutzung (Web Audio Resource Leak Fix):**
   - Vollständiges Trennen (`.disconnect()`) verwaister `MediaElementAudioSourceNode`- und `GainNode`-Instanzen sowie sauberes Entladen von `<audio>`-Elementen (`pause()`, `removeAttribute('src')`, `load()`) und verzögertes `URL.revokeObjectURL()` erst nach Ende des Fade-Outs.
   - Verhindern von Hintergrund-`decodeAudioData()`-Aufrufen während ein Song aktiv abgespielt wird, damit der Echtzeit-Audio-Thread zu keinem Zeitpunkt durch MP3-Dekodierung blockiert wird.
2. **Arena-Broadcast-Animationen (Ass, Block, 6/7 & Startup-Splash):**
   - Aufwertung von `triggerAceAnimation()`, `triggerBlockAnimation()`, `triggerSixSevenAnimation()` sowie `#startup-splash` mit mehrschichtigen SVG/CSS-Effekten (Vektor-Feuerball + Glut-Partikel, Hexagon-Energieschild + Einschlag-Blitze, 6/7 Scoreboard-Neon-Burst + Lichtfunken, Arena-Scheinwerfer + 9-Balken-Spektrum im Splash-Screen).
3. **Transparenter, druckvoller Auto-Pegel (ohne dumpfen/leisen Klang):**
   - Anheben von `TARGET_RMS` auf `0.26` (~`-11.7 dBFS` Stadion-Referenzpegel), `MIN_NORM_GAIN = 0.75`, `MAX_NORM_GAIN = 2.4`.
   - Ersetzen des stark komprimierenden Kompressors (`-14 dB`) durch einen transparenten Brickwall-Ceiling-Limiter (`threshold: -2.0 dB`, `knee: 3 dB`, `ratio: 12:1`, `attack: 0.015s`, `release: 0.15s`), sodass Transienten und Höhen kristallklar bleiben.
   - Versionierung (`NORM_VERSION = 2`), damit alte, zu leise berechnete `normGain`-Werte automatisch neu berechnet werden.
4. **Verlängerung des Stop-Fade-Outs um 1 Sekunde:**
   - Standard-Fade-Out-Dauer in `audioEngine.stop(fadeDurationMs = 3000)` und `stopAudio()` von `2000ms` auf **`3000ms` (3,0 Sekunden)** erhöhen.
5. **5-Preset Equalizer + Auto-Pegel im Popup-Menü (`#eq-modal`):**
   - Der Header-Button `#btn-eq-menu` (`🎛️ Sound / EQ`) öffnet ein kompaktes Popup-Dialogfenster (`#eq-modal`), das den Auto-Pegel-Schalter (`#btn-auto-norm`) und 5 wählbare Equalizer-Vorlagen (`neutral`, `stadium`, `bass`, `punch`, `warm`) enthält.
   - Echte 3-Band-Klangregelung (`BiquadFilterNode`: `lowshelf` 80 Hz, `peaking` 1000 Hz, `highshelf` 4000 Hz) in `AudioEngine`.

---

## 2. Architektur & Komponenten

### 2.1 AudioEngine (`js/audio-engine.js`)
- **Signal-Kette:**
  `MediaElementAudioSourceNode` -> `trackGain (GainNode)` -> `eqLow (BiquadFilterNode)` -> `eqMid (BiquadFilterNode)` -> `eqHigh (BiquadFilterNode)` -> `compressor (Limiter)` (oder direkt `masterGain`) -> `masterGain` -> `audioCtx.destination`.
- **5 Equalizer-Vorlagen (`EQ_PRESETS`):**
  1. `neutral`: `{ id: 'neutral', name: 'Neutral (Original)', icon: '🎚️', desc: 'Unveränderter Originalklang (0 dB)', low: 0, mid: 0, high: 0 }`
  2. `stadium`: `{ id: 'stadium', name: 'Stadion / Halle', icon: '🏟️', desc: 'Weniger Hallen-Dröhnen, satter Kick-Bass & klare Höhen', low: 3.5, mid: -2.0, high: 3.0 }`
  3. `bass`: `{ id: 'bass', name: 'Bass Boost', icon: '🔥', desc: 'Kräftiger Tiefbass-Schub für Warm-Up & Einlauf', low: 6.0, mid: 0.0, high: 2.0 }`
  4. `punch`: `{ id: 'punch', name: 'Punch & Klarheit', icon: '⚡', desc: 'Maximale Durchsetzungskraft für Jingles & Rock', low: 3.0, mid: 2.0, high: 4.0 }`
  5. `warm`: `{ id: 'warm', name: 'Warm / Lounge', icon: '🎙️', desc: 'Sanfte Höhen & warmer Klang für Satzpausen', low: 2.5, mid: 0.5, high: -2.5 }`
- **Resource-Cleanup (`cleanupAudioResources`):**
  - Hilfsmethode trennt `source.disconnect()` und `trackGain.disconnect()`, pausiert `audio`, entfernt `src` (`audio.removeAttribute?.('src')`, `audio.load?.()`) und gibt `objectUrl` via `URL.revokeObjectURL()` frei.
  - Bei `stop(fadeDurationMs)`: Wenn `fadeDurationMs > 0` und Web Audio aktiv ist, wird `cleanupAudioResources` nach Ablauf von `fadeDurationMs` im Timer ausgeführt; bei `fadeDurationMs === 0` oder `onended` sofort.

### 2.2 Sound & Equalizer Popup (`index.html`, `js/app.js`, `css/app.css`)
- **Header-Button:** `#btn-eq-menu` in `.controls-right` (ersetzt den bisherigen einzelnen Button in der Leiste), zeigt `🎛️ Sound / EQ` bzw. den Namen des aktiven Presets (`#eq-active-badge`).
- **Modal `#eq-modal`:**
  - Enthält den Toggle-Button `#btn-auto-norm` (`⚖️ Auto-Pegel`) mit Status-Badge (`EIN` / `AUS`).
  - Enthält die 5 Preset-Buttons (`.eq-preset-btn[data-eq-preset="..."]`) mit Namen, Icon und Kurzbeschreibung.
  - Schließt per Klick auf `#btn-close-eq`, `#eq-backdrop` oder `Escape`.
  - Speichert `eqPreset` und `autoNormalize` in `IndexedDB` (`settings`-Store).

### 2.3 Broadcast-Animationen (`index.html`, `js/app.js`, `css/app.css`)
- **Startup-Splash (`#startup-splash`):**
  - Zusätzliche Arena-Scheinwerfer (`.splash-spotlight`), Waben-Hintergrund (`.splash-hex-grid`), rotierender 3D-Energiering (`.splash-ring`), 9 Equalizer-Balken (`.sw-bar`).
- **Ass (`triggerAceAnimation`):**
  - Vektor-Feuerball-Volleyball (`.fx-flame-svg`), 4 Feuer-Säulen, 8 aufsteigende Glut-Partikel (`.fx-ember`), Schockwelle und 3D-Text `🔥 ASS! 🔥` + Subline `UNHALTBARER AUFSCHLAG`.
- **Block (`triggerBlockAnimation`):**
  - Vektor-Hexagon-Energieschild (`.fx-shield-svg`), 2 Schockwellen, Energie-Blitze (`.fx-shield-spark`) und 3D-Text `🛡️ BLOCK! 🛡️` + Subline `EISerne WAND`.
- **6 / 7 (`triggerSixSevenAnimation`):**
  - Strahlen-Burst, 2 rotierende Neon-Ringe, 8 Lichtfunken-Partikel (`.fx-hype-spark`), 3D-Scoreboard-Badge `6 / 7` + `ARENA HYPE!`.
