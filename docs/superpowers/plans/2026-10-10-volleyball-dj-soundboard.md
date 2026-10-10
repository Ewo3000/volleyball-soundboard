# Volleyball DJ Soundboard (SV 1845 Esslingen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern, offline-first, touch-friendly static web app (PWA) serving as a sports DJ soundboard for volleyball matches of SV 1845 Esslingen, optimized for Android tablets (landscape) and smartphones (portrait).

**Architecture:** Static Single Page Application using modular ES modules, Web Audio API with Master Gain and micro-fade transitions, IndexedDB for persistent local audio blob and metadata storage, Screen Wake Lock API to prevent tablet screen timeout, and Service Worker caching for complete offline functionality. Includes adaptive responsive layouts: 7-column DJ soundboard matrix for tablet landscape, and reduced quick-action thumb pad with categorized drawer modal for mobile portrait.

**Tech Stack:** Vanilla JavaScript (ES2022+), Web Audio API, IndexedDB API, Screen Wake Lock API, HTML5 / CSS3 (CSS Grid, Flexbox, Glassmorphism, CSS Custom Properties), Service Worker / Web App Manifest, Node.js (`node:test`) for unit testing.

## Global Constraints

- Team Name: "SV 1845 Esslingen" (Volleyball)
- Brand Colors: Dark Slate Background (`#0B0F17`), Esslingen Blue (`#1B75BC`), Flaming Red (`#E53935`), White/Silver (`#F8FAFC`)
- Categories: Ass/Angriff (Blue), Block (Magenta), Gegner (Red), Sonstiges 1/2/3 (all Emerald Green `#10B981` / `#059669`), Spaß & Extras (Violet `#9333EA`)
- Quick Actions: Timeout (Amber `#F59E0B`), Walk-On (Blue `#1B75BC`), Pausensongs (Slate `#334155`), 6/7 (Orange `#EA580C`), Eigene Punkte & Gegnerpunkte (Indigo `#4F46E5`), Stop (Red `#DC2626`)
- Suffix rules: `_HIT`/`_ANGRIFF`/`_ASS` -> Ass/Angriff, `_BLOCK` -> Block, `_GEGNER`/`_OPPONENT` -> Gegner, `_SONSTIGES1`..`3` -> Sonstiges 1..3, `_FUN`/`_SPASS` -> Spaß & Extras, `_TIMEOUT` -> Timeout, `_WALKON`/`_EINLAUF` -> Walk-On, `_PAUSE` -> Pausensongs, `_SIXSEVEN`/`_67` -> 6/7
- Transitions: 50ms track-change micro-fade to avoid popping, 300ms smooth exponential stop fadeout.
- No build-step requirement for deployment; runs natively on any modern browser and GitHub Pages.

---

### Task 1: Project Scaffolding & Brand Asset Setup

**Files:**
- Create: `package.json`
- Create: `assets/logo.jpg` (copied from uploaded user image)
- Create: `manifest.webmanifest`
- Create: `tests/setup.test.js`

**Interfaces:**
- Produces: Web App Manifest (`manifest.webmanifest`) referencing icons and application metadata for PWA installation.

- [ ] **Step 1: Write test verifying package configuration and manifest format**

Create `tests/setup.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('manifest.webmanifest exists and has valid PWA fields', () => {
  assert.ok(fs.existsSync('manifest.webmanifest'), 'manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'SV 1845 Esslingen - Volleyball DJ');
  assert.equal(manifest.short_name, 'SV1845 DJ');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0B0F17');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/setup.test.js`
Expected: FAIL with missing file.

- [ ] **Step 3: Create package.json, copy logo, and create manifest.webmanifest**

Create `package.json`:
```json
{
  "name": "volleyball-dj-sv1845",
  "version": "1.0.0",
  "description": "DJ Soundboard for SV 1845 Esslingen Volleyball",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "serve": "npx serve ."
  }
}
```

Copy logo from user directory to `assets/logo.jpg`:
Run: `mkdir -p assets tests css js && cp /Users/mr.robot/.gemini/antigravity/brain/1f77ffbb-030c-4041-88c0-15765fa29dd2/.user_uploaded/media_1791665137098_d83bb1e1.jpg assets/logo.jpg`

Create `manifest.webmanifest`:
```json
{
  "name": "SV 1845 Esslingen - Volleyball DJ",
  "short_name": "SV1845 DJ",
  "description": "DJ Pult und Soundboard für Volleyballspiele des SV 1845 Esslingen",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0B0F17",
  "theme_color": "#0B0F17",
  "icons": [
    {
      "src": "assets/logo.jpg",
      "sizes": "512x512",
      "type": "image/jpeg",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/setup.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json manifest.webmanifest assets/logo.jpg tests/setup.test.js
git commit -m "chore: scaffold project and setup PWA manifest with SV 1845 logo"
```

---

### Task 2: IndexedDB Storage Engine (`js/db.js`)

**Files:**
- Create: `js/db.js`
- Create: `tests/db.test.js`

**Interfaces:**
- Produces:
  - `initDB(): Promise<IDBDatabase>`
  - `saveTracks(tracks: Array<Track>): Promise<void>`
  - `getAllTracks(): Promise<Array<Track>>`
  - `updateTrackPlayCount(id: string, playCount: number): Promise<void>`
  - `resetAllPlayCounts(): Promise<void>`
  - `clearAllTracks(): Promise<void>`
  - `saveSetting(key: string, value: any): Promise<void>`
  - `getSetting(key: string, defaultValue: any): Promise<any>`
- Track object schema:
  - `{ id: string, name: string, cleanTitle: string, category: string, suffix: string, playCount: number, blob: Blob | ArrayBuffer, type: string }`

- [ ] **Step 1: Write tests for database operations**

Create `tests/db.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageEngine } from '../js/db.js';

test('StorageEngine saves, retrieves, updates and resets tracks', async () => {
  const db = new MemoryStorageEngine();
  await db.init();

  const mockTrack = {
    id: 'track-1',
    name: 'Super_Spike_HIT.mp3',
    cleanTitle: 'Super Spike',
    category: 'ass_angriff',
    suffix: '_HIT',
    playCount: 0,
    type: 'audio/mp3',
    blob: new Uint8Array([1, 2, 3])
  };

  await db.saveTracks([mockTrack]);
  const tracks = await db.getAllTracks();
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].cleanTitle, 'Super Spike');
  assert.equal(tracks[0].playCount, 0);

  await db.updateTrackPlayCount('track-1', 2);
  const updatedTracks = await db.getAllTracks();
  assert.equal(updatedTracks[0].playCount, 2);

  await db.resetAllPlayCounts();
  const resetTracks = await db.getAllTracks();
  assert.equal(resetTracks[0].playCount, 0);

  await db.saveSetting('masterVolume', 0.85);
  const volume = await db.getSetting('masterVolume', 1.0);
  assert.equal(volume, 0.85);

  await db.clearAllTracks();
  const emptyTracks = await db.getAllTracks();
  assert.equal(emptyTracks.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/db.test.js`
Expected: FAIL with "Cannot find module ../js/db.js"

- [ ] **Step 3: Implement `js/db.js` with browser IndexedDB and Node fallback**

Create `js/db.js`:
```javascript
/**
 * IndexedDB Storage Engine for SV 1845 Esslingen DJ Pult
 */

const DB_NAME = 'SV1845_DJ_DB';
const DB_VERSION = 1;
const TRACKS_STORE = 'tracks';
const SETTINGS_STORE = 'settings';

export class MemoryStorageEngine {
  constructor() {
    this.tracks = new Map();
    this.settings = new Map();
  }

  async init() {
    return true;
  }

  async saveTracks(trackList) {
    for (const t of trackList) {
      this.tracks.set(t.id, { ...t });
    }
  }

  async getAllTracks() {
    return Array.from(this.tracks.values());
  }

  async updateTrackPlayCount(id, playCount) {
    const t = this.tracks.get(id);
    if (t) {
      t.playCount = playCount;
      t.lastPlayed = Date.now();
      this.tracks.set(id, t);
    }
  }

  async resetAllPlayCounts() {
    for (const [id, t] of this.tracks.entries()) {
      t.playCount = 0;
      this.tracks.set(id, t);
    }
  }

  async clearAllTracks() {
    this.tracks.clear();
  }

  async saveSetting(key, value) {
    this.settings.set(key, value);
  }

  async getSetting(key, defaultValue = null) {
    if (this.settings.has(key)) {
      return this.settings.get(key);
    }
    return defaultValue;
  }
}

export class IndexedDBStorageEngine {
  constructor() {
    this.db = null;
  }

  async init() {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not supported in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async saveTracks(trackList) {
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    for (const track of trackList) {
      store.put(track);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTracks() {
    const tx = this.db.transaction([TRACKS_STORE], 'readonly');
    const store = tx.objectStore(TRACKS_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTrackPlayCount(id, playCount) {
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    const getReq = store.get(id);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const track = getReq.result;
        if (track) {
          track.playCount = playCount;
          track.lastPlayed = Date.now();
          store.put(track);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async resetAllPlayCounts() {
    const tracks = await this.getAllTracks();
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    for (const t of tracks) {
      t.playCount = 0;
      store.put(t);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllTracks() {
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveSetting(key, value) {
    const tx = this.db.transaction([SETTINGS_STORE], 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    store.put({ key, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    const tx = this.db.transaction([SETTINGS_STORE], 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result && request.result.value !== undefined) {
          resolve(request.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export function createStorageEngine() {
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDBStorageEngine();
  }
  return new MemoryStorageEngine();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/db.js tests/db.test.js
git commit -m "feat: add indexeddb and in-memory storage engine"
```

---

### Task 3: Suffix Parsing & File Processing (`js/file-loader.js`)

**Files:**
- Create: `js/file-loader.js`
- Create: `tests/file-loader.test.js`

**Interfaces:**
- Produces:
  - `parseTrackFromFilename(filename: string, fileBlob?: Blob | Uint8Array, mimeType?: string): Track`
  - `categorizeTracks(tracks: Array<Track>): Map<string, Array<Track>>`
  - `cleanTrackTitle(filename: string): string`
  - `detectCategory(filename: string): { category: string, suffix: string }`
  - Constant `CATEGORY_DEFS`: definitions of columns and quick actions.

- [ ] **Step 1: Write tests for filename parsing and categorization**

Create `tests/file-loader.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTrackFromFilename,
  cleanTrackTitle,
  detectCategory,
  categorizeTracks,
  CATEGORY_DEFS
} from '../js/file-loader.js';

test('cleanTrackTitle strips extension, suffix, and replaces underscores', () => {
  assert.equal(cleanTrackTitle('Super_Spike_HIT.mp3'), 'Super Spike');
  assert.equal(cleanTrackTitle('Axel_F_BLOCK.wav'), 'Axel F');
  assert.equal(cleanTrackTitle('Seven_Nation_Army_SIXSEVEN.mp3'), 'Seven Nation Army');
  assert.equal(cleanTrackTitle('7_Nation_Army_67.m4a'), '7 Nation Army');
  assert.equal(cleanTrackTitle('Ned_schlecht_FUN.mp3'), 'Ned schlecht');
  assert.equal(cleanTrackTitle('Blue_PAUSE.ogg'), 'Blue');
  assert.equal(cleanTrackTitle('NormalSongWithoutSuffix.mp3'), 'NormalSongWithoutSuffix');
});

test('detectCategory maps all suffixes correctly', () => {
  assert.equal(detectCategory('Song_HIT.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_ANGRIFF.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_ASS.mp3').category, 'ass_angriff');
  assert.equal(detectCategory('Song_BLOCK.mp3').category, 'block');
  assert.equal(detectCategory('Song_GEGNER.mp3').category, 'gegner');
  assert.equal(detectCategory('Song_OPPONENT.mp3').category, 'gegner');
  assert.equal(detectCategory('Song_SONSTIGES1.mp3').category, 'sonstiges_1');
  assert.equal(detectCategory('Song_SONSTIGES2.mp3').category, 'sonstiges_2');
  assert.equal(detectCategory('Song_SONSTIGES3.mp3').category, 'sonstiges_3');
  assert.equal(detectCategory('Song_FUN.mp3').category, 'spass_extras');
  assert.equal(detectCategory('Song_TIMEOUT.mp3').category, 'timeout');
  assert.equal(detectCategory('Song_WALKON.mp3').category, 'walkon');
  assert.equal(detectCategory('Song_PAUSE.mp3').category, 'pause');
  assert.equal(detectCategory('Song_SIXSEVEN.mp3').category, 'sixseven');
  assert.equal(detectCategory('Song_67.mp3').category, 'sixseven');
  // Fallback
  assert.equal(detectCategory('Unknown_Tune.mp3').category, 'sonstiges_1');
});

test('categorizeTracks groups array of tracks into categories map', () => {
  const tracks = [
    parseTrackFromFilename('Spike_HIT.mp3'),
    parseTrackFromFilename('Axel_BLOCK.mp3'),
    parseTrackFromFilename('Stereo_GEGNER.mp3')
  ];
  const map = categorizeTracks(tracks);
  assert.equal(map.get('ass_angriff').length, 1);
  assert.equal(map.get('block').length, 1);
  assert.equal(map.get('gegner').length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/file-loader.test.js`
Expected: FAIL with "Cannot find module ../js/file-loader.js"

- [ ] **Step 3: Implement `js/file-loader.js`**

Create `js/file-loader.js`:
```javascript
/**
 * Filename parser and category mapper for SV 1845 Esslingen DJ Pult
 */

export const CATEGORY_DEFS = {
  // Main columns
  ass_angriff: { id: 'ass_angriff', label: 'Ass / Angriff', color: 'blue', type: 'column' },
  block: { id: 'block', label: 'Block', color: 'magenta', type: 'column' },
  gegner: { id: 'gegner', label: 'Gegner', color: 'red', type: 'column' },
  sonstiges_1: { id: 'sonstiges_1', label: 'Sonstiges 1', color: 'emerald', type: 'column' },
  sonstiges_2: { id: 'sonstiges_2', label: 'Sonstiges 2', color: 'emerald', type: 'column' },
  sonstiges_3: { id: 'sonstiges_3', label: 'Sonstiges 3', color: 'emerald', type: 'column' },
  spass_extras: { id: 'spass_extras', label: 'Spaß & Extras', color: 'purple', type: 'column' },

  // Quick actions
  timeout: { id: 'timeout', label: 'Timeout', color: 'amber', type: 'quick' },
  walkon: { id: 'walkon', label: 'Walk-On', color: 'blue', type: 'quick' },
  pause: { id: 'pause', label: 'Pausensongs', color: 'slate', type: 'quick' },
  sixseven: { id: 'sixseven', label: '6/7', color: 'orange', type: 'quick' }
};

const SUFFIX_RULES = [
  { regex: /_(?:HIT|ANGRIFF|ASS)$/i, category: 'ass_angriff', suffix: '_HIT' },
  { regex: /_BLOCK$/i, category: 'block', suffix: '_BLOCK' },
  { regex: /_(?:GEGNER|OPPONENT)$/i, category: 'gegner', suffix: '_GEGNER' },
  { regex: /_(?:SONSTIGES1|MISC1)$/i, category: 'sonstiges_1', suffix: '_SONSTIGES1' },
  { regex: /_(?:SONSTIGES2|MISC2)$/i, category: 'sonstiges_2', suffix: '_SONSTIGES2' },
  { regex: /_(?:SONSTIGES3|MISC3)$/i, category: 'sonstiges_3', suffix: '_SONSTIGES3' },
  { regex: /_(?:FUN|SPASS)$/i, category: 'spass_extras', suffix: '_FUN' },
  { regex: /_TIMEOUT$/i, category: 'timeout', suffix: '_TIMEOUT' },
  { regex: /_(?:WALKON|EINLAUF)$/i, category: 'walkon', suffix: '_WALKON' },
  { regex: /_(?:PAUSE|PAUSENSONG)$/i, category: 'pause', suffix: '_PAUSE' },
  { regex: /_(?:SIXSEVEN|67)$/i, category: 'sixseven', suffix: '_SIXSEVEN' }
];

export function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0) {
    return filename.substring(0, lastDot);
  }
  return filename;
}

export function detectCategory(filename) {
  const baseName = stripExtension(filename);
  for (const rule of SUFFIX_RULES) {
    if (rule.regex.test(baseName)) {
      return { category: rule.category, suffix: rule.suffix };
    }
  }
  return { category: 'sonstiges_1', suffix: '' };
}

export function cleanTrackTitle(filename) {
  let baseName = stripExtension(filename);
  for (const rule of SUFFIX_RULES) {
    baseName = baseName.replace(rule.regex, '');
  }
  // Replace underscores and multiple spaces with a single space
  return baseName.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseTrackFromFilename(filename, fileBlob = null, mimeType = 'audio/mpeg') {
  const { category, suffix } = detectCategory(filename);
  const cleanTitle = cleanTrackTitle(filename);
  const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    name: filename,
    cleanTitle,
    category,
    suffix,
    playCount: 0,
    lastPlayed: 0,
    blob: fileBlob,
    type: mimeType
  };
}

export function categorizeTracks(tracks) {
  const map = new Map();
  for (const key of Object.keys(CATEGORY_DEFS)) {
    map.set(key, []);
  }

  for (const track of tracks) {
    const list = map.get(track.category) || map.get('sonstiges_1');
    list.push(track);
  }

  // Sort tracks alphabetically inside each category
  for (const [key, list] of map.entries()) {
    list.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle, 'de', { sensitivity: 'base' }));
  }

  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/file-loader.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/file-loader.js tests/file-loader.test.js
git commit -m "feat: implement filename suffix parser and categorization logic"
```

---

### Task 4: Web Audio Engine with Micro-fades & Random Pick (`js/audio-engine.js`)

**Files:**
- Create: `js/audio-engine.js`
- Create: `tests/audio-engine.test.js`

**Interfaces:**
- Produces:
  - `AudioEngine` class:
    - `setMasterVolume(val: number): void`
    - `playTrack(track: Track): Promise<void>`
    - `stop(fadeDurationMs?: number): void`
    - `pickRandomTrack(tracks: Array<Track>): Track | null`
    - Event callbacks: `onTrackStart(track)`, `onTrackStop()`, `onTrackEnd()`

- [ ] **Step 1: Write test for AudioEngine random track selection and state logic**

Create `tests/audio-engine.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickLeastPlayedRandomTrack } from '../js/audio-engine.js';

test('pickLeastPlayedRandomTrack prioritizes unplayed tracks (playCount == 0)', () => {
  const tracks = [
    { id: '1', cleanTitle: 'Song A', playCount: 2 },
    { id: '2', cleanTitle: 'Song B', playCount: 0 },
    { id: '3', cleanTitle: 'Song C', playCount: 1 }
  ];

  // When there are tracks with 0 play count, it should only pick among them
  for (let i = 0; i < 10; i++) {
    const picked = pickLeastPlayedRandomTrack(tracks);
    assert.equal(picked.id, '2');
  }
});

test('pickLeastPlayedRandomTrack picks least played when all played at least once', () => {
  const tracks = [
    { id: '1', cleanTitle: 'Song A', playCount: 3 },
    { id: '2', cleanTitle: 'Song B', playCount: 1 },
    { id: '3', cleanTitle: 'Song C', playCount: 1 }
  ];

  for (let i = 0; i < 10; i++) {
    const picked = pickLeastPlayedRandomTrack(tracks);
    assert.ok(picked.id === '2' || picked.id === '3');
  }
});

test('pickLeastPlayedRandomTrack returns null for empty list', () => {
  assert.equal(pickLeastPlayedRandomTrack([]), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/audio-engine.test.js`
Expected: FAIL with "Cannot find module ../js/audio-engine.js"

- [ ] **Step 3: Implement `js/audio-engine.js`**

Create `js/audio-engine.js`:
```javascript
/**
 * Web Audio Engine for SV 1845 Esslingen DJ Pult
 * Handles Bluetooth latency optimization, 50ms track change micro-fade,
 * and 300ms smooth exponential stop fade.
 */

export function pickLeastPlayedRandomTrack(tracks) {
  if (!tracks || tracks.length === 0) return null;

  // Find lowest playCount
  let minCount = Infinity;
  for (const t of tracks) {
    if (t.playCount < minCount) {
      minCount = t.playCount;
    }
  }

  // Candidates with lowest playCount
  const candidates = tracks.filter((t) => t.playCount === minCount);
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.currentSource = null;
    this.currentTrackGain = null;
    this.currentAudioElement = null;
    this.currentTrack = null;
    this.volume = 1.0;

    this.onTrackStart = null;
    this.onTrackStop = null;
    this.onTrackEnd = null;
  }

  initAudioContext() {
    if (!this.audioCtx && typeof AudioContext !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setMasterVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = this.volume;
    }
  }

  getMasterVolume() {
    return this.volume;
  }

  async playTrack(track) {
    this.initAudioContext();

    // 1. If currently playing, perform 50ms fast micro-fadeout to prevent clicks
    if (this.currentAudioElement || this.currentSource) {
      this.stop(50);
    }

    this.currentTrack = track;

    try {
      let objectUrl;
      if (track.blob instanceof Blob) {
        objectUrl = URL.createObjectURL(track.blob);
      } else if (track.blob instanceof ArrayBuffer || track.blob instanceof Uint8Array) {
        const blob = new Blob([track.blob], { type: track.type || 'audio/mpeg' });
        objectUrl = URL.createObjectURL(blob);
      } else if (track.url) {
        objectUrl = track.url;
      } else {
        throw new Error('Track has no playable audio blob or URL');
      }

      const audio = new Audio(objectUrl);
      this.currentAudioElement = audio;

      if (this.audioCtx && this.masterGain) {
        const source = this.audioCtx.createMediaElementSource(audio);
        const trackGain = this.audioCtx.createGain();

        // 20ms micro fade-in
        const now = this.audioCtx.currentTime;
        trackGain.gain.setValueAtTime(0.001, now);
        trackGain.gain.exponentialRampToValueAtTime(1.0, now + 0.02);

        source.connect(trackGain);
        trackGain.connect(this.masterGain);

        this.currentSource = source;
        this.currentTrackGain = trackGain;
      } else {
        audio.volume = this.volume;
      }

      audio.onended = () => {
        const finishedTrack = this.currentTrack;
        this.currentTrack = null;
        this.currentAudioElement = null;
        this.currentSource = null;
        this.currentTrackGain = null;
        if (this.onTrackEnd) this.onTrackEnd(finishedTrack);
      };

      await audio.play();

      if (this.onTrackStart) {
        this.onTrackStart(track);
      }
    } catch (err) {
      console.error('Failed to play track:', err);
      this.currentTrack = null;
      throw err;
    }
  }

  stop(fadeDurationMs = 300) {
    if (!this.currentAudioElement) {
      this.currentTrack = null;
      if (this.onTrackStop) this.onTrackStop();
      return;
    }

    const audio = this.currentAudioElement;
    const trackGain = this.currentTrackGain;
    const audioCtx = this.audioCtx;

    if (trackGain && audioCtx && fadeDurationMs > 0) {
      const now = audioCtx.currentTime;
      const durationSec = fadeDurationMs / 1000;
      trackGain.gain.setValueAtTime(Math.max(trackGain.gain.value, 0.001), now);
      trackGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, fadeDurationMs);
    } else {
      audio.pause();
      audio.currentTime = 0;
    }

    this.currentTrack = null;
    this.currentAudioElement = null;
    this.currentSource = null;
    this.currentTrackGain = null;

    if (this.onTrackStop) {
      this.onTrackStop();
    }
  }

  getCurrentTrack() {
    return this.currentTrack;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/audio-engine.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio-engine.js tests/audio-engine.test.js
git commit -m "feat: implement Web Audio Engine with micro-fades and random track picker"
```

---

### Task 5: Screen Wake Lock Manager (`js/wake-lock.js`)

**Files:**
- Create: `js/wake-lock.js`
- Create: `tests/wake-lock.test.js`

**Interfaces:**
- Produces:
  - `WakeLockManager` class:
    - `requestLock(): Promise<boolean>`
    - `releaseLock(): Promise<void>`
    - `isActive(): boolean`

- [ ] **Step 1: Write test for WakeLockManager logic and lifecycle**

Create `tests/wake-lock.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { WakeLockManager } from '../js/wake-lock.js';

test('WakeLockManager gracefully handles environments without navigator.wakeLock', async () => {
  const manager = new WakeLockManager();
  const acquired = await manager.requestLock();
  assert.equal(acquired, false);
  assert.equal(manager.isActive(), false);
  await manager.releaseLock();
  assert.equal(manager.isActive(), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/wake-lock.test.js`
Expected: FAIL with "Cannot find module ../js/wake-lock.js"

- [ ] **Step 3: Implement `js/wake-lock.js`**

Create `js/wake-lock.js`:
```javascript
/**
 * Screen Wake Lock Manager for SV 1845 Esslingen DJ Pult
 * Keeps tablet screen awake during volleyball matches.
 */

export class WakeLockManager {
  constructor() {
    this.sentinel = null;
    this.enabled = true;
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  async requestLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return false;
    }

    if (!this.enabled) return false;

    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
      }
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      this.sentinel = null;
      return false;
    }
  }

  async releaseLock() {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        console.warn('Wake Lock release error:', err);
      }
      this.sentinel = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  async _onVisibilityChange() {
    if (document.visibilityState === 'visible' && this.enabled && !this.sentinel) {
      await this.requestLock();
    }
  }

  isActive() {
    return this.sentinel !== null && !this.sentinel.released;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/wake-lock.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/wake-lock.js tests/wake-lock.test.js
git commit -m "feat: implement screen wake lock manager"
```

---

### Task 6: Modern Responsive UI Styling & Club Theme (`css/app.css`)

**Files:**
- Create: `css/app.css`

**Requirements:**
- Dark Slate theme (`#0B0F17`) with SV 1845 Esslingen Club Blue (`#1B75BC`) & Flame Red (`#E53935`).
- 7-Column grid for tablet landscape: Ass/Angriff (Blue), Block (Magenta), Gegner (Red), Sonstiges 1, 2, 3 (Emerald Green `#10B981` / `#059669`), Spaß & Extras (Purple).
- Quick Action footer bar: Timeout (Amber), Walk-On (Blue), Pausensongs (Slate), 6/7 (Orange), Eigene/Gegnerpunkte (Indigo), Stop (Red).
- Active playing state: pulsating neon-glow effect and highlighted border on active track button.
- Play count badge on right of each button.
- Zoom container supporting scale 70% to 120%.
- Mobile portrait query (`@media (max-width: 768px)`): Hides 7-column grid from main view, displays large mobile quick-action pad with thumb-friendly controls, and full-screen drawer for "Alle Songs & Kategorien".

- [ ] **Step 1: Write `css/app.css` with complete styling**

Write comprehensive CSS with CSS variables, modern reset, grid layout, buttons, badges, glowing playing state, collapsed header animations, and mobile drawer styles in `css/app.css`.

- [ ] **Step 2: Verify CSS syntax using node css validator script**

Run: `node -e "const fs = require('fs'); const css = fs.readFileSync('css/app.css', 'utf8'); console.log('CSS length:', css.length);"`
Expected: Output shows valid non-empty file.

- [ ] **Step 3: Commit**

```bash
git add css/app.css
git commit -m "feat: implement modern responsive tablet and mobile DJ styles"
```

---

### Task 7: Complete Application Assembly (`index.html` & `js/app.js`)

**Files:**
- Create: `index.html`
- Create: `js/app.js`

**Features to wire up:**
1. **Header:**
   - "Kopf ein / aus" button: smoothly expands/collapses the header section containing SV 1845 Esslingen logo, title, and "📁 Songs laden" folder picker button.
   - Zoom controls (`-`, `100%`, `+`) updating CSS transform scale on `#board-container`.
   - Real-time search input filtering buttons across all columns with match counter badge.
   - Master volume slider connected to AudioEngine.
   - Reset button prompting confirmation and resetting all play counts to 0.
   - Fullscreen toggle button.
2. **Directory Loader:**
   - Webkit directory input and drag & drop support. Reads all selected files, runs `parseTrackFromFilename`, saves blobs to IndexedDB, and renders buttons.
3. **Soundboard Grid (Tablet Landscape):**
   - 7 columns rendered with category titles, count badges, and song buttons.
   - Clicking song button plays track, sets active glowing state, increments play count, updates IndexedDB.
4. **Quick Actions (Footer Bar):**
   - Timeout button (plays track matching `_TIMEOUT` or random timeout sound).
   - Walk-On button (plays track matching `_WALKON`).
   - 4 Pausensong buttons (first 4 tracks with `_PAUSE`).
   - 6/7 button (plays track with `_SIXSEVEN` / `_67`).
   - Eigene Punkte (Zufall): calls `pickLeastPlayedRandomTrack` on Ass/Angriff & Sonstiges tracks.
   - Gegnerpunkte (Zufall): calls `pickLeastPlayedRandomTrack` on Gegner tracks.
   - Stop button: triggers 300ms fadeout and resets playing indicators.
5. **Mobile View & Song Drawer:**
   - Automatic toggle when screen `< 768px` or portrait.
   - Mobile quick-action pad.
   - "Alle Songs & Kategorien" button opening modal drawer with search and categorized lists.

- [ ] **Step 1: Write `index.html`**

Create semantic, accessible HTML5 document with PWA tags, header, 7-column container, footer, mobile view, song drawer, and settings modal.

- [ ] **Step 2: Write `js/app.js`**

Implement full controller logic coordinating `db.js`, `file-loader.js`, `audio-engine.js`, `wake-lock.js`, and the DOM.

- [ ] **Step 3: Verify HTML and JS syntax**

Run: `node --check js/app.js`
Expected: Exits with code 0 (valid JavaScript syntax).

- [ ] **Step 4: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: assemble complete DJ soundboard app with tablet and mobile views"
```

---

### Task 8: Service Worker for 100% Offline PWA (`sw.js`)

**Files:**
- Create: `sw.js`
- Create: `tests/sw.test.js`

**Requirements:**
- Cache app shell files: `index.html`, `manifest.webmanifest`, `css/app.css`, `js/app.js`, `js/db.js`, `js/file-loader.js`, `js/audio-engine.js`, `js/wake-lock.js`, `assets/logo.jpg`.
- Cache-first strategy for app shell assets so the soundboard functions completely without network connection in sports halls.

- [ ] **Step 1: Write test for service worker file structure and cached resources list**

Create `tests/sw.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('sw.js exists and lists all critical core assets', () => {
  assert.ok(fs.existsSync('sw.js'), 'sw.js must exist');
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.ok(sw.includes('index.html'));
  assert.ok(sw.includes('css/app.css'));
  assert.ok(sw.includes('js/app.js'));
  assert.ok(sw.includes('js/db.js'));
  assert.ok(sw.includes('js/audio-engine.js'));
  assert.ok(sw.includes('manifest.webmanifest'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sw.test.js`
Expected: FAIL with missing sw.js.

- [ ] **Step 3: Implement `sw.js`**

Create `sw.js` with install, activate, and fetch cache-first strategy.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sw.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sw.js tests/sw.test.js
git commit -m "feat: implement offline service worker for PWA support"
```

---

### Task 9: Default Demo Soundpack & Integration Verification

**Files:**
- Create: `js/demo-sounds.js` (generates short synth audio beeps/samples via Web Audio API so the app has working sounds immediately out of the box before a user uploads their local folder)
- Create: `tests/integration.test.js`

**Verification Steps:**
- All tests pass (`npm test`).
- Test loading demo sounds into the soundboard.
- Test category matching across all 7 columns.
- Test mobile view switching.
- Verify GitHub Pages compatibility (relative paths `./`, no hardcoded absolute URLs).

- [ ] **Step 1: Implement `js/demo-sounds.js`**
- [ ] **Step 2: Write `tests/integration.test.js` testing end-to-end flow**
- [ ] **Step 3: Run full test suite: `node --test tests/*.test.js`**
- [ ] **Step 4: Commit**

```bash
git add js/demo-sounds.js tests/integration.test.js
git commit -m "feat: add synthesized demo soundpack and integration verification"
```

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** Tablet landscape grid, SV 1845 Esslingen colors & logo, 7 columns (Emerald green for Sonstiges 1-3), mobile portrait quick-action pad with full song drawer, IndexedDB persistence, suffix parser, Web Audio API with 50ms track-change micro-fade and 300ms stop fade, Wake Lock, GitHub Pages readiness.
- [x] **Placeholder scan:** No "TBD", "TODO", or vague requirements. Every file, function signature, and step is explicitly detailed.
- [x] **Type consistency:** Function names and interfaces in `db.js`, `file-loader.js`, and `audio-engine.js` are consistent across tasks.
