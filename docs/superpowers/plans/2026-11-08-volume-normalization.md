# Automatic Loudness Normalization & Per-Track Gain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically equalize loudness differences across songs using RMS normalization (`normGain`) and a Web Audio `DynamicsCompressorNode`, with a header toggle (`#btn-auto-norm`) and a per-song volume slider (`#scrubber-gain-slider`) inside the scrubber popup.

**Architecture:** Extend `js/db.js` with `updateTrackGain(id, { normGain, customGain })`. Add `computeNormalizationGain(audioBuffer)`, `DynamicsCompressorNode` routing, `analyzeTrackLoudness(track)`, and live gain updates to `AudioEngine` in `js/audio-engine.js`. Add the `#btn-auto-norm` button and `#scrubber-gain-slider` markup in `index.html` and styles in `css/app.css`. Wire live toggling, background/on-play analysis, and per-track gain persistence in `js/app.js`. Bump version to v1.12.0.

**Tech Stack:** Vanilla JavaScript (ES Modules), Web Audio API (`GainNode`, `DynamicsCompressorNode`, `decodeAudioData`), IndexedDB, HTML5, CSS3, Node.js test runner (`node --test`).

## Global Constraints

- Target version: 1.12.0
- Cache name in `sw.js`: `sv1845-dj-v1.12.0`
- Header auto-norm toggle button ID: `#btn-auto-norm` (default active: `autoNormalize = true`)
- Scrubber per-track volume controls: `#scrubber-gain-slider` (`min="20" max="200" value="100" step="5"`), `#scrubber-gain-value`, `#btn-reset-track-gain`
- Normalization gain clamped to `[0.35, 2.5]` with target active RMS `0.1585` (`-16 dBFS`)
- Zero external build dependencies; all tests run via `npm test` (`node --test tests/*.test.js`)

---

### Task 1: Storage Engine Gain Persistence (`js/db.js`)

**Files:**
- Modify: `js/db.js`
- Create: `tests/volume-normalization.test.js`

**Interfaces:**
- Produces: `updateTrackGain(id, { normGain, customGain })` on `MemoryStorageEngine`, `IndexedDBStorageEngine`, and module export in `js/db.js`

- [ ] **Step 1: Write failing test in `tests/volume-normalization.test.js` for `updateTrackGain`**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageEngine, IndexedDBStorageEngine, setDefaultStorage, updateTrackGain } from '../js/db.js';

describe('StorageEngine Track Gain Persistence', () => {
  it('MemoryStorageEngine.updateTrackGain updates normGain and customGain while preserving other fields', async () => {
    const engine = new MemoryStorageEngine();
    await engine.init();
    setDefaultStorage(engine);

    await engine.saveTracks([
      { id: 't1', name: 'Song1.mp3', playCount: 3, blob: new Uint8Array([1, 2]) }
    ]);

    await updateTrackGain('t1', { normGain: 1.45 });
    let tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].playCount, 3);

    await updateTrackGain('t1', { customGain: 0.8 });
    tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].customGain, 0.8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/volume-normalization.test.js`  
Expected: FAIL (`updateTrackGain` is not exported)

- [ ] **Step 3: Implement `updateTrackGain` in `js/db.js`**

Add `updateTrackGain(id, { normGain, customGain } = {})` to `MemoryStorageEngine`, `IndexedDBStorageEngine`, and module-level exports in `js/db.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/volume-normalization.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/volume-normalization.test.js
git commit -m "feat: add updateTrackGain persistence to storage engines"
```

---

### Task 2: Audio Loudness Analysis, Compressor Routing & Per-Track Gain (`js/audio-engine.js`)

**Files:**
- Modify: `js/audio-engine.js`
- Modify: `tests/volume-normalization.test.js`

**Interfaces:**
- Produces: `computeNormalizationGain(audioBuffer)` export, and `AudioEngine` methods `setAutoNormalize(enabled)`, `getAutoNormalize()`, `getEffectiveTrackGain(track)`, `updateCurrentTrackGain()`, `analyzeTrackLoudness(track)`

- [ ] **Step 1: Add failing tests for `computeNormalizationGain` and `AudioEngine` normalization in `tests/volume-normalization.test.js`**

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/volume-normalization.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement `computeNormalizationGain` and `AudioEngine` normalization/compressor logic in `js/audio-engine.js`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/volume-normalization.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio-engine.js tests/volume-normalization.test.js
git commit -m "feat: add RMS loudness normalization and dynamics compressor to AudioEngine"
```

---

### Task 3: UI Markup & Styling for Auto-Pegel Button and Scrubber Song-Gain Slider (`index.html`, `css/app.css`)

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `tests/volume-normalization.test.js`

**Interfaces:**
- Produces: `#btn-auto-norm` in `#header-controls`, and `.scrubber-gain-section` with `#scrubber-gain-slider`, `#scrubber-gain-value`, `#btn-reset-track-gain` inside `#scrubber-modal`

- [ ] **Step 1: Add failing markup and CSS tests to `tests/volume-normalization.test.js`**

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/volume-normalization.test.js`  
Expected: FAIL

- [ ] **Step 3: Update `index.html` and `css/app.css`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/volume-normalization.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html css/app.css tests/volume-normalization.test.js
git commit -m "feat: add header auto-norm toggle and scrubber song-volume controls"
```

---

### Task 4: App Controller Integration, Background Analysis & Live Gain Adjustment (`js/app.js`)

**Files:**
- Modify: `js/app.js`
- Modify: `tests/volume-normalization.test.js`

**Interfaces:**
- Produces: `toggleAutoNormalize()`, `setTrackCustomGain(trackId, customGain)`, `scheduleBackgroundNormalization()` exported in `js/app.js`

- [ ] **Step 1: Add failing controller integration tests to `tests/volume-normalization.test.js`**

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/volume-normalization.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement auto-norm toggle, scrubber gain slider binding, and background/on-play normalization in `js/app.js`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/volume-normalization.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/app.js tests/volume-normalization.test.js
git commit -m "feat: wire auto-normalization toggle, background RMS queue, and per-track gain slider"
```

---

### Task 5: Version Bump (v1.12.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js`
- Modify: `js/app.js`

- [ ] **Step 1: Bump version to `1.12.0` in `version.json`, `sw.js` (`sv1845-dj-v1.12.0`), and `js/app.js` (`APP_VERSION = '1.12.0'`)**
- [ ] **Step 2: Run full test suite (`npm test`) and verify 100% pass**
- [ ] **Step 3: Commit version bump**
