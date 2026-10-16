# Android Fullscreen & Header Scrubber Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure guaranteed fullscreen mode on Android devices via manifest `display_override` and first-gesture activation, and add an interactive scrubber popup modal triggered by clicking the "Aktuell läuft" header field to seek/scrub through the active track.

**Architecture:** Update `manifest.webmanifest` with `"display_override": ["fullscreen", "standalone"]`. Add a one-time gesture hook in `js/app.js` to request fullscreen on first user touch. Add seeking methods (`getCurrentTime`, `getDuration`, `seek`, `seekRelative`) to `AudioEngine` in `js/audio-engine.js`. Add `#scrubber-modal` markup in `index.html` and modal/slider styles in `css/app.css`. Implement modal opening, live timestamp/slider syncing, and seek event listeners in `js/app.js`. Verify with unit tests in `tests/scrubber-popup.test.js` and bump version to v1.11.0.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5 Audio / Web Audio API, Range Input Slider, CSS3 Glassmorphism & Keyframes, Web App Manifest, Service Worker, Node.js built-in test runner (`node --test`).

## Global Constraints

- Target version: 1.11.0
- Web manifest contains `"display": "fullscreen"` and `"display_override": ["fullscreen", "standalone"]`
- Scrubber modal ID: `#scrubber-modal`, title ID: `#scrubber-title`, slider ID: `#scrubber-slider`, close button: `#btn-close-scrubber`
- Quick scrub buttons: `#btn-scrub-back` (-5s) and `#btn-scrub-fwd` (+5s)
- Timestamps formatted as `M:SS` (e.g. `1:05`, `2:30`) via `formatTime(seconds)`
- Auto-close scrubber modal when playback stops or ends
- Cache name in `sw.js`: `sv1845-dj-v1.11.0`
- Zero external build dependencies; all tests run with `npm test` (`node --test tests/*.test.js`)

---

### Task 1: Android Fullscreen Manifest & First-Gesture Hook

**Files:**
- Modify: `manifest.webmanifest:6-8`
- Modify: `js/app.js:1010-1035`
- Create: `tests/scrubber-popup.test.js`

**Interfaces:**
- Produces: `"display_override": ["fullscreen", "standalone"]` in `manifest.webmanifest`, and `requestAutoFullscreen()` in `js/app.js`

- [ ] **Step 1: Write failing test in `tests/scrubber-popup.test.js` for manifest display_override**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Android Fullscreen Manifest and Gesture Hook', () => {
  it('manifest.webmanifest contains display_override with fullscreen and standalone', () => {
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(content.display_override, ['fullscreen', 'standalone']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: FAIL with missing `display_override`

- [ ] **Step 3: Update `manifest.webmanifest` and `js/app.js`**

In `manifest.webmanifest`, add `display_override`:
```json
  "display": "fullscreen",
  "display_override": ["fullscreen", "standalone"],
```

In `js/app.js`, add `requestAutoFullscreen()` and wire to first pointerdown on `#app` and inside `dismissStartupSplash()`:
```javascript
export function requestAutoFullscreen() {
  if (typeof document === 'undefined') return;
  if (!document.fullscreenElement && document.documentElement?.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}
```
In `setupEventListeners()`:
```javascript
  if (typeof document !== 'undefined') {
    const appEl = document.getElementById('app') || document.body;
    appEl.addEventListener('pointerdown', () => {
      requestAutoFullscreen();
    }, { once: true });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest js/app.js tests/scrubber-popup.test.js
git commit -m "feat: add android display_override and first-gesture auto-fullscreen hook"
```

---

### Task 2: AudioEngine Seeking Capabilities

**Files:**
- Modify: `js/audio-engine.js:225-231`
- Modify: `tests/scrubber-popup.test.js`

**Interfaces:**
- Produces: `AudioEngine.prototype.getCurrentTime()`, `AudioEngine.prototype.getDuration()`, `AudioEngine.prototype.seek(seconds)`, `AudioEngine.prototype.seekRelative(deltaSeconds)`

- [ ] **Step 1: Add failing unit tests for AudioEngine seeking methods in `tests/scrubber-popup.test.js`**

```javascript
describe('AudioEngine Seeking Methods', () => {
  it('getCurrentTime, getDuration, seek, and seekRelative function properly', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    // With no active audio element
    assert.equal(engine.getCurrentTime(), 0);
    assert.equal(engine.getDuration(), 0);

    // Mock active audio element
    engine.currentAudioElement = {
      currentTime: 10,
      duration: 100,
      play: () => Promise.resolve(),
      pause: () => {}
    };

    assert.equal(engine.getCurrentTime(), 10);
    assert.equal(engine.getDuration(), 100);

    // Absolute seek
    engine.seek(45);
    assert.equal(engine.currentAudioElement.currentTime, 45);

    // Clamp to bounds
    engine.seek(-10);
    assert.equal(engine.currentAudioElement.currentTime, 0);

    engine.seek(150);
    assert.equal(engine.currentAudioElement.currentTime, 100);

    // Relative seek
    engine.currentAudioElement.currentTime = 50;
    engine.seekRelative(-5);
    assert.equal(engine.currentAudioElement.currentTime, 45);

    engine.seekRelative(10);
    assert.equal(engine.currentAudioElement.currentTime, 55);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: FAIL with `engine.getCurrentTime is not a function`

- [ ] **Step 3: Implement seeking methods in `js/audio-engine.js`**

Add methods to `AudioEngine`:
```javascript
  getCurrentTime() {
    return this.currentAudioElement ? this.currentAudioElement.currentTime || 0 : 0;
  }

  getDuration() {
    return this.currentAudioElement && !isNaN(this.currentAudioElement.duration)
      ? this.currentAudioElement.duration
      : 0;
  }

  seek(seconds) {
    if (!this.currentAudioElement) return;
    const duration = this.getDuration();
    const target = duration > 0 ? Math.max(0, Math.min(seconds, duration)) : Math.max(0, seconds);
    try {
      this.currentAudioElement.currentTime = target;
    } catch (err) {
      console.warn('Seeking audio failed:', err);
    }
  }

  seekRelative(deltaSeconds) {
    this.seek(this.getCurrentTime() + deltaSeconds);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/audio-engine.js tests/scrubber-popup.test.js
git commit -m "feat: implement getCurrentTime, getDuration, seek and seekRelative in AudioEngine"
```

---

### Task 3: Scrubber Modal Markup & CSS Styling

**Files:**
- Modify: `index.html` (header now playing attributes & scrubber modal markup)
- Modify: `css/app.css` (header hover effects, scrubber modal, slider, buttons)
- Modify: `tests/scrubber-popup.test.js`

**Interfaces:**
- Consumes: `#header-now-playing`
- Produces: `#scrubber-modal`, `#scrubber-backdrop`, `#scrubber-title`, `#btn-close-scrubber`, `#scrubber-time-current`, `#scrubber-time-duration`, `#scrubber-slider`, `#btn-scrub-back`, `#btn-scrub-fwd`

- [ ] **Step 1: Add tests for HTML markup and CSS classes to `tests/scrubber-popup.test.js`**

```javascript
describe('Scrubber Modal Markup and Styling', () => {
  it('index.html contains #scrubber-modal with all required controls and attributes', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /id="scrubber-modal"/, 'Must contain #scrubber-modal');
    assert.match(html, /id="scrubber-backdrop"/, 'Must contain #scrubber-backdrop');
    assert.match(html, /id="scrubber-title"/, 'Must contain #scrubber-title');
    assert.match(html, /id="btn-close-scrubber"/, 'Must contain #btn-close-scrubber');
    assert.match(html, /id="scrubber-time-current"/, 'Must contain #scrubber-time-current');
    assert.match(html, /id="scrubber-time-duration"/, 'Must contain #scrubber-time-duration');
    assert.match(html, /id="scrubber-slider"/, 'Must contain #scrubber-slider');
    assert.match(html, /id="btn-scrub-back"/, 'Must contain #btn-scrub-back');
    assert.match(html, /id="btn-scrub-fwd"/, 'Must contain #btn-scrub-fwd');

    // Header now-playing should have button role and tabindex
    assert.match(html, /id="header-now-playing"[^>]*role="button"/, '#header-now-playing must have role="button"');
    assert.match(html, /id="header-now-playing"[^>]*tabindex="0"/, '#header-now-playing must have tabindex="0"');
  });

  it('css/app.css styles #scrubber-modal, .scrubber-card, and range slider', () => {
    const cssPath = path.join(rootDir, 'css/app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.scrubber-modal/, 'CSS must define .scrubber-modal');
    assert.match(css, /\.scrubber-card/, 'CSS must define .scrubber-card');
    assert.match(css, /\.scrubber-slider/, 'CSS must define .scrubber-slider');
    assert.match(css, /\.btn-scrub-step/, 'CSS must define .btn-scrub-step');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: FAIL with `Must contain #scrubber-modal`

- [ ] **Step 3: Update `index.html`**

In `index.html`, update `#header-now-playing`:
```html
        <div class="header-now-playing" id="header-now-playing" style="display: none;" aria-live="polite" role="button" tabindex="0" title="Klicken zum Spulen" aria-haspopup="dialog">
```

And before `</body>`, insert `#scrubber-modal`:
```html
    <!-- Scrubber Popup Modal -->
    <div id="scrubber-modal" class="scrubber-modal" style="display: none;" aria-hidden="true">
      <div class="scrubber-backdrop" id="scrubber-backdrop"></div>
      <div class="scrubber-card" role="dialog" aria-modal="true" aria-labelledby="scrubber-title">
        <div class="scrubber-header">
          <div class="scrubber-header-left">
            <span class="scrubber-badge">SPULEN</span>
            <h3 class="scrubber-title" id="scrubber-title">Kein Track</h3>
          </div>
          <button type="button" class="btn-close-scrubber" id="btn-close-scrubber" aria-label="Schließen">✕</button>
        </div>
        <div class="scrubber-body">
          <div class="scrubber-time-row">
            <span class="scrubber-time-current" id="scrubber-time-current">0:00</span>
            <span class="scrubber-time-duration" id="scrubber-time-duration">0:00</span>
          </div>
          <div class="scrubber-slider-wrapper">
            <input type="range" class="scrubber-slider" id="scrubber-slider" min="0" max="100" value="0" step="0.1" aria-label="Songposition">
          </div>
          <div class="scrubber-actions">
            <button type="button" class="btn-scrub-step" id="btn-scrub-back" title="5 Sekunden zurück">
              ⏪ -5s
            </button>
            <button type="button" class="btn-scrub-step" id="btn-scrub-fwd" title="5 Sekunden vor">
              +5s ⏩
            </button>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Update `css/app.css`**

Add CSS for interactive `#header-now-playing` and `#scrubber-modal`:
```css
/* Interactive Header Now-Playing button */
.header-now-playing {
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
}

.header-now-playing:hover,
.header-now-playing:focus-visible {
  transform: scale(1.03);
  background: rgba(225, 29, 72, 0.22);
  box-shadow: 0 0 18px rgba(225, 29, 72, 0.4);
  outline: none;
}

.header-now-playing:active {
  transform: scale(0.97);
}

/* Scrubber Modal Overlay */
.scrubber-modal {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.scrubber-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.scrubber-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: rgba(15, 23, 42, 0.95);
  border: 2px solid var(--flame-red);
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(225, 29, 72, 0.35);
  padding: 20px 24px;
  animation: scrubber-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scrubber-pop {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.scrubber-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
}

.scrubber-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.scrubber-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  background: var(--flame-red);
  color: #fff;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  flex-shrink: 0;
}

.scrubber-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-white);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-close-scrubber {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-silver);
  font-size: 1.1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.btn-close-scrubber:hover {
  background: rgba(225, 29, 72, 0.3);
  color: #fff;
  border-color: var(--flame-red);
}

.scrubber-time-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-silver);
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}

.scrubber-time-current {
  color: var(--flame-red);
}

.scrubber-slider-wrapper {
  margin-bottom: 20px;
}

.scrubber-slider {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  accent-color: var(--flame-red);
  cursor: pointer;
  outline: none;
}

.scrubber-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-scrub-step {
  flex: 1;
  padding: 10px 16px;
  font-size: 1rem;
  font-weight: 800;
  border-radius: var(--radius-md);
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text-white);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.btn-scrub-step:hover {
  background: rgba(225, 29, 72, 0.25);
  border-color: var(--flame-red);
  color: #fff;
  transform: translateY(-1px);
}

.btn-scrub-step:active {
  transform: translateY(1px);
}

@media (prefers-reduced-motion: reduce) {
  .scrubber-card {
    animation: none !important;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add index.html css/app.css tests/scrubber-popup.test.js
git commit -m "feat: add scrubber modal markup, styles, and interactive now-playing trigger"
```

---

### Task 4: Scrubber Modal Controller & Event Integration

**Files:**
- Modify: `js/app.js`
- Modify: `tests/scrubber-popup.test.js`

**Interfaces:**
- Consumes: `audioEngine`, `#scrubber-modal`, `#header-now-playing`
- Produces: `formatTime(seconds)`, `openScrubberModal()`, `closeScrubberModal()` exported in `js/app.js`

- [ ] **Step 1: Add unit tests for scrubber controller functions in `tests/scrubber-popup.test.js`**

```javascript
describe('Scrubber Modal Controller Lifecycle', () => {
  it('formatTime formats seconds into M:SS correctly', async () => {
    const { formatTime } = await import('../js/app.js');
    assert.equal(formatTime(0), '0:00');
    assert.equal(formatTime(5), '0:05');
    assert.equal(formatTime(65), '1:05');
    assert.equal(formatTime(125.7), '2:05');
    assert.equal(formatTime(null), '0:00');
    assert.equal(formatTime(NaN), '0:00');
  });

  it('openScrubberModal and closeScrubberModal toggle modal state and sync timer', async () => {
    const modalEl = { style: { display: 'none' }, setAttribute: () => {} };
    const titleEl = { textContent: '' };
    const curTimeEl = { textContent: '' };
    const durTimeEl = { textContent: '' };
    const sliderEl = { value: 0 };

    global.document = {
      getElementById(id) {
        if (id === 'scrubber-modal') return modalEl;
        if (id === 'scrubber-title') return titleEl;
        if (id === 'scrubber-time-current') return curTimeEl;
        if (id === 'scrubber-time-duration') return durTimeEl;
        if (id === 'scrubber-slider') return sliderEl;
        return null;
      },
      querySelectorAll: () => []
    };

    const app = await import(`../js/app.js?t=${Date.now()}`);
    app.openScrubberModal();
    assert.equal(modalEl.style.display, 'flex');

    app.closeScrubberModal();
    assert.equal(modalEl.style.display, 'none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: FAIL with `formatTime is not a function`

- [ ] **Step 3: Implement `formatTime`, `openScrubberModal`, `closeScrubberModal` and event bindings in `js/app.js`**

Implement in `js/app.js`:
```javascript
let scrubberInterval = null;
let isUserScrubbing = false;

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function openScrubberModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('scrubber-modal');
  if (!modal) return;

  const track = audioEngine.currentTrack;
  const titleEl = document.getElementById('scrubber-title');
  if (titleEl) {
    titleEl.textContent = track ? (track.cleanTitle || cleanTrackTitle(track.name || '')) : 'Kein Track läuft';
  }

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  syncScrubberUI();
  if (scrubberInterval) clearInterval(scrubberInterval);
  scrubberInterval = setInterval(syncScrubberUI, 150);
}

export function closeScrubberModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('scrubber-modal');
  if (!modal) return;

  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  if (scrubberInterval) {
    clearInterval(scrubberInterval);
    scrubberInterval = null;
  }
}

function syncScrubberUI() {
  if (typeof document === 'undefined' || isUserScrubbing) return;
  const curTime = audioEngine.getCurrentTime();
  const dur = audioEngine.getDuration();

  const curEl = document.getElementById('scrubber-time-current');
  const durEl = document.getElementById('scrubber-time-duration');
  const slider = document.getElementById('scrubber-slider');

  if (curEl) curEl.textContent = formatTime(curTime);
  if (durEl) durEl.textContent = formatTime(dur);
  if (slider && dur > 0) {
    slider.value = ((curTime / dur) * 100).toFixed(1);
  } else if (slider) {
    slider.value = 0;
  }
}
```

In `setupEventListeners()` in `js/app.js`:
- Attach click to `#header-now-playing` to call `openScrubberModal()` if a track is active.
- Keydown `Enter` or `Space` on `#header-now-playing` opens modal.
- Click on `#btn-close-scrubber` or `#scrubber-backdrop` calls `closeScrubberModal()`.
- Keyboard `Escape` calls `closeScrubberModal()`.
- Slider `input`: sets `isUserScrubbing = true`, updates `#scrubber-time-current` preview.
- Slider `change`: sets `isUserScrubbing = false`, calculates `targetSeconds = (slider.value / 100) * audioEngine.getDuration()`, calls `audioEngine.seek(targetSeconds)`.
- Click on `#btn-scrub-back`: calls `audioEngine.seekRelative(-5); syncScrubberUI();`.
- Click on `#btn-scrub-fwd`: calls `audioEngine.seekRelative(5); syncScrubberUI();`.
- In `audioEngine.onTrackStop` and `audioEngine.onTrackEnd`: call `closeScrubberModal()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/scrubber-popup.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/app.js tests/scrubber-popup.test.js
git commit -m "feat: implement scrubber modal controller, time syncing, and seeking events"
```

---

### Task 5: Version Bump (v1.11.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js`
- Modify: `js/app.js`

**Interfaces:**
- Produces: `"version": "1.11.0"` in `version.json`, `CACHE_NAME = 'sv1845-dj-v1.11.0'` in `sw.js`, `APP_VERSION = '1.11.0'` in `js/app.js`

- [ ] **Step 1: Bump version in `version.json`**

```json
{
  "version": "1.11.0",
  "buildTime": "2026-10-16T18:40:00Z"
}
```

- [ ] **Step 2: Bump cache name in `sw.js`**

Change cache name to `'sv1845-dj-v1.11.0'`.

- [ ] **Step 3: Bump APP_VERSION in `js/app.js`**

Change line:
```javascript
export const APP_VERSION = '1.11.0';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`  
Expected: All tests pass cleanly in under 2 seconds.

- [ ] **Step 5: Commit**

```bash
git add version.json sw.js js/app.js
git commit -m "chore: bump version to 1.11.0 and verify all tests pass"
```

---

## Plan Self-Review Checklist

- [x] Spec coverage: Android manifest `display_override`, first-gesture fullscreen trigger, `AudioEngine` seeking methods, `#scrubber-modal` markup, slider & button styling, controller lifecycle, and version bump to 1.11.0.
- [x] Placeholder scan: No "TBD" or missing implementation code; every step contains exact snippets and commands.
- [x] Consistency: Selectors (`#scrubber-modal`, `#scrubber-title`, `#scrubber-slider`, `#btn-scrub-back`, `#btn-scrub-fwd`, `#btn-close-scrubber`) match across files and tests.
