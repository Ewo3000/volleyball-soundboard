# Specification: Automatic Loudness Normalization & Per-Track Volume Control

**Date:** 2026-11-08  
**Status:** Approved  
**Target Version:** 1.12.0  
**Repository:** SV 1845 Esslingen - Volleyball DJ Soundboard  

---

## 1. Overview & Objectives

Songs loaded into the DJ soundboard often originate from different sources and masterings, resulting in noticeable loudness differences during matchday playback. This specification defines a two-stage automatic loudness normalization system and per-track manual volume trim:

1. **Automatic RMS Loudness Normalization (`normGain`)**:
   - Computes the active Root Mean Square (RMS) loudness and true sample peak of each track's audio buffer (excluding silence below `-50 dBFS`).
   - Calculates a compensating gain factor `normGain` targeting `-16 dBFS` (`~0.1585` linear RMS), clamped to `[0.35, 2.5]` and bounded by peak headroom (`0.95 / peak`) to prevent hard digital clipping.
   - Persists `normGain` on each track record in IndexedDB so analysis only runs once per track and works seamlessly with already-loaded tracks without re-importing.
2. **Real-Time Mastering Limiter (`DynamicsCompressorNode`)**:
   - Routes audio through a Web Audio `DynamicsCompressorNode` (`threshold: -14 dB`, `knee: 10 dB`, `ratio: 4:1`, `attack: 0.003s`, `release: 0.20s`) when auto-normalization is enabled, taming transients and keeping hall output punchy and consistent.
3. **Header Auto-Normalization Toggle (`#btn-auto-norm`)**:
   - Located in `#header-controls` right next to the Master Volume slider.
   - Enabled by default (`autoNormalize = true`), persisted via `saveSetting('autoNormalize', boolean)`.
   - Toggles normalization and compressor routing live, even mid-playback.
4. **Per-Track Volume Slider in Scrubber Popup (`#scrubber-gain-slider`)**:
   - Located inside `#scrubber-modal` below the `-5s` / `+5s` buttons.
   - Allows adjusting `customGain` for the currently playing track from `20%` (`0.2`) to `200%` (`2.0`), default `100%` (`1.0`), with a quick `Reset` button (`#btn-reset-track-gain`).
   - Saved persistently per track in IndexedDB (`updateTrackGain(id, { normGain, customGain })`).

---

## 2. Architecture & Components

### 2.1 Audio Analysis & Engine (`js/audio-engine.js`)
- **`computeNormalizationGain(audioBuffer)`**:
  - Pure helper function taking an `AudioBuffer` (or mock object with `numberOfChannels`, `getChannelData(ch)`).
  - Divides samples into blocks of 1024 samples; computes block RMS and filters out silent blocks (`rms < 0.00316`, i.e., `-50 dBFS`).
  - Computes overall active RMS and peak amplitude across channels.
  - Target RMS: `TARGET_RMS = 0.1585` (`-16 dBFS`).
  - Raw gain: `TARGET_RMS / activeRms`.
  - Peak limiter bound: if `peak > 0`, `maxPeakGain = 0.98 / peak`. Since the `DynamicsCompressorNode` catches transients, allow up to `Math.min(2.5, Math.max(maxPeakGain * 1.35, 1.0))` when boosting quiet tracks, clamped overall to `[0.35, 2.5]`.
  - Returns rounded factor (e.g., `Math.round(gain * 1000) / 1000`), or `1.0` if buffer is empty/silent.
- **`AudioEngine` Enhancements**:
  - State properties:
    - `this.autoNormalize = true`
    - `this.compressor = null`
    - `this.currentTargetGain = 1.0`
  - `setAutoNormalize(enabled)`: sets `this.autoNormalize = Boolean(enabled)` and updates active playback gain & routing immediately via `updateCurrentTrackGain()`.
  - `getAutoNormalize()`: returns `this.autoNormalize`.
  - `getEffectiveTrackGain(track)`:
    - `const norm = (this.autoNormalize && typeof track?.normGain === 'number') ? track.normGain : 1.0;`
    - `const custom = (typeof track?.customGain === 'number') ? track.customGain : 1.0;`
    - `return Math.max(0.05, Math.min(4.0, norm * custom));`
  - `updateCurrentTrackGain()`:
    - Updates `this.currentTrackGain.gain` (when Web Audio context is active) or `this.currentAudioElement.volume` (fallback) in real time when `autoNormalize` or `customGain` changes during playback.
  - `analyzeTrackLoudness(track)`:
    - Decodes `track.blob` (if `ArrayBuffer`, `Uint8Array`, or `Blob`) via `this.audioCtx.decodeAudioData`, runs `computeNormalizationGain(audioBuffer)`, sets `track.normGain`, updates current track gain if `this.currentTrack?.id === track.id`, and returns `normGain`.

### 2.2 Storage Persistence (`js/db.js`)
- Add `updateTrackGain(id, { normGain, customGain })` to both `MemoryStorageEngine` and `IndexedDBStorageEngine` (and module-level export `updateTrackGain`):
  - Updates `normGain` (if provided) and `customGain` (if provided) on the stored track without overwriting `playCount` or `blob`.

### 2.3 UI Controls (`index.html`, `css/app.css`, `js/app.js`)
- **Header Toggle (`#btn-auto-norm`)**:
  - Placed in `.controls-right` right after `.volume-group`:
    ```html
    <button type="button" class="btn-header-tool btn-auto-norm is-active" id="btn-auto-norm" aria-pressed="true" title="Automatische Lautstärke-Angleichung ein-/ausschalten">
      ⚖️ Auto-Pegel
    </button>
    ```
- **Scrubber Popup Per-Track Gain Control**:
  - Inside `#scrubber-modal` `.scrubber-body`, below `.scrubber-actions`:
    ```html
    <div class="scrubber-gain-section">
      <div class="scrubber-gain-header">
        <label for="scrubber-gain-slider" class="scrubber-gain-label">🔊 Song-Lautstärke</label>
        <div class="scrubber-gain-meta">
          <span class="scrubber-gain-value" id="scrubber-gain-value">100%</span>
          <button type="button" class="btn-reset-track-gain" id="btn-reset-track-gain" title="Song-Lautstärke auf 100% zurücksetzen">Reset</button>
        </div>
      </div>
      <input type="range" class="scrubber-slider scrubber-gain-slider" id="scrubber-gain-slider" min="20" max="200" value="100" step="5" aria-label="Song-Lautstärke">
    </div>
    ```

---

## 3. Versioning & Verification

- Bump version to **1.12.0** in `version.json`, `sw.js` (`sv1845-dj-v1.12.0`), and `js/app.js` (`APP_VERSION = '1.12.0'`).
- Add comprehensive test suite in `tests/volume-normalization.test.js`.
