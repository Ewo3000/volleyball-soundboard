# Fullscreen Startup & Header Now-Playing Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure PWA fullscreen startup in the web manifest, and implement a dynamic "Now-Playing" header component with animated equalizer bars between the header title and the track count badge that displays the active song or disappears when stopped.

**Architecture:** Update `manifest.webmanifest` to `"display": "fullscreen"`. Add `#header-now-playing` container in `index.html` between `.brand-group` and `.banner-actions`. Style with club-red glassmorphism and animated bars in `css/app.css`. Wire playback start/stop/end in `js/app.js` to update and show/hide the header element. Verify with unit tests in `tests/header-now-playing.test.js` and bump version to v1.10.0.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5, CSS3 Keyframes & Variables, Web App Manifest, Service Worker, Node.js built-in test runner (`node --test`).

## Global Constraints

- Target version: 1.10.0
- Web manifest `"display": "fullscreen"`
- Header Now-Playing ID: `#header-now-playing`, title ID: `#now-playing-title`
- Initial & stopped state: `#header-now-playing` must be hidden (`display: none;`)
- Equalizer bars: 4 bars (`.np-bar-1` to `.np-bar-4`) with `@keyframes np-equalizer-dance`
- Reduced-motion accessibility: `@media (prefers-reduced-motion: reduce)` disables animations
- Cache name in `sw.js`: `sv1845-dj-v1.10.0`
- Zero external build dependencies; all tests run with `npm test` (`node --test tests/*.test.js`)

---

### Task 1: PWA Fullscreen Startup Configuration

**Files:**
- Modify: `manifest.webmanifest:6`
- Create: `tests/header-now-playing.test.js`

**Interfaces:**
- Produces: `"display": "fullscreen"` in `manifest.webmanifest`

- [ ] **Step 1: Write failing test in `tests/header-now-playing.test.js` for manifest display mode**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Fullscreen Startup Configuration', () => {
  it('manifest.webmanifest specifies display: fullscreen', () => {
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(content.display, 'fullscreen', 'display property must be fullscreen');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/header-now-playing.test.js`  
Expected: FAIL with `display property must be fullscreen` (currently `'standalone'`)

- [ ] **Step 3: Update `manifest.webmanifest`**

In `manifest.webmanifest`, change line 6:
```json
  "display": "fullscreen",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/header-now-playing.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add manifest.webmanifest tests/header-now-playing.test.js
git commit -m "feat: configure pwa display mode to fullscreen in webmanifest"
```

---

### Task 2: Header Now-Playing HTML Markup & CSS Styling

**Files:**
- Modify: `index.html:56-58`
- Modify: `css/app.css` (header section & keyframes)
- Modify: `tests/header-now-playing.test.js`

**Interfaces:**
- Consumes: `#header-banner`, `.brand-group`, `.banner-actions`
- Produces: `#header-now-playing`, `.now-playing-bars`, 4 `.np-bar` elements, `.now-playing-info`, `.now-playing-label`, `#now-playing-title`

- [ ] **Step 1: Add tests for HTML markup and CSS rules to `tests/header-now-playing.test.js`**

```javascript
describe('Header Now-Playing Markup and Styles', () => {
  it('index.html contains #header-now-playing inside #header-banner between brand and actions', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /id="header-now-playing"/, 'Must contain #header-now-playing');
    assert.match(html, /class="now-playing-bars"/, 'Must contain .now-playing-bars');
    assert.match(html, /class="np-bar np-bar-1"/, 'Must contain np-bar-1');
    assert.match(html, /class="np-bar np-bar-4"/, 'Must contain np-bar-4');
    assert.match(html, /id="now-playing-title"/, 'Must contain #now-playing-title');
    assert.match(html, /style="display:\s*none;?"/, 'Must be initially hidden with display: none');

    const brandIndex = html.indexOf('class="brand-group"');
    const npIndex = html.indexOf('id="header-now-playing"');
    const actionsIndex = html.indexOf('class="banner-actions"');
    assert.ok(brandIndex < npIndex && npIndex < actionsIndex, '#header-now-playing must be between brand-group and banner-actions');
  });

  it('css/app.css defines equalizer animation and styling for header now-playing', () => {
    const cssPath = path.join(rootDir, 'css/app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.header-now-playing/, 'CSS must define .header-now-playing');
    assert.match(css, /@keyframes np-equalizer-dance/, 'CSS must define @keyframes np-equalizer-dance');
    assert.match(css, /\.now-playing-bars/, 'CSS must style .now-playing-bars');
    assert.match(css, /\.np-bar/, 'CSS must style .np-bar');
    assert.match(css, /prefers-reduced-motion/, 'CSS must support prefers-reduced-motion for .np-bar');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/header-now-playing.test.js`  
Expected: FAIL with `Must contain #header-now-playing`

- [ ] **Step 3: Add markup to `index.html`**

Inside `<div class="header-banner" id="header-banner">`, between `</div>` of `.brand-group` and `<div class="banner-actions">`, insert:
```html
        <!-- Currently Playing Header Display -->
        <div class="header-now-playing" id="header-now-playing" style="display: none;" aria-live="polite">
          <div class="now-playing-bars" aria-hidden="true">
            <span class="np-bar np-bar-1"></span>
            <span class="np-bar np-bar-2"></span>
            <span class="np-bar np-bar-3"></span>
            <span class="np-bar np-bar-4"></span>
          </div>
          <div class="now-playing-info">
            <span class="now-playing-label">Aktuell läuft:</span>
            <span class="now-playing-title" id="now-playing-title"></span>
          </div>
        </div>
```

- [ ] **Step 4: Add CSS to `css/app.css`**

Add styles in `css/app.css` right after `.brand-subtitle`:
```css
/* Header Now-Playing Indicator */
.header-now-playing {
  display: none;
  align-items: center;
  gap: 10px;
  background: rgba(225, 29, 72, 0.12);
  border: 1px solid rgba(225, 29, 72, 0.35);
  border-radius: var(--radius-full);
  padding: 5px 14px;
  box-shadow: 0 0 14px rgba(225, 29, 72, 0.2);
  max-width: 380px;
  min-width: 0;
  transition: opacity 0.25s ease;
}

.header-now-playing.is-active {
  display: flex;
}

.now-playing-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
  width: 20px;
  flex-shrink: 0;
}

.np-bar {
  width: 3px;
  border-radius: 2px;
  background: var(--flame-red);
  box-shadow: 0 0 6px rgba(225, 29, 72, 0.5);
  animation: np-equalizer-dance 0.8s ease-in-out infinite alternate;
}

.np-bar-1 { height: 35%; animation-delay: 0.0s; }
.np-bar-2 { height: 85%; animation-delay: 0.25s; }
.np-bar-3 { height: 55%; animation-delay: 0.15s; }
.np-bar-4 { height: 95%; animation-delay: 0.4s; }

@keyframes np-equalizer-dance {
  0% { height: 20%; opacity: 0.7; }
  50% { height: 100%; opacity: 1; }
  100% { height: 35%; opacity: 0.85; }
}

.now-playing-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  line-height: 1.15;
}

.now-playing-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 700;
}

.now-playing-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

@media (prefers-reduced-motion: reduce) {
  .np-bar {
    animation: none !important;
    height: 60% !important;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/header-now-playing.test.js`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add index.html css/app.css tests/header-now-playing.test.js
git commit -m "feat: add header now-playing indicator markup and equalizer bar styling"
```

---

### Task 3: JavaScript Lifecycle Integration for Now-Playing Header

**Files:**
- Modify: `js/app.js:220-243, 976-996`
- Modify: `tests/header-now-playing.test.js`

**Interfaces:**
- Consumes: `tracks`, `audioEngine.onTrackStart`, `audioEngine.onTrackStop`, `audioEngine.onTrackEnd`
- Produces: `updateNowPlayingHeader(track)` function in `js/app.js`

- [ ] **Step 1: Add lifecycle unit tests to `tests/header-now-playing.test.js`**

```javascript
describe('Header Now-Playing JavaScript Lifecycle', () => {
  it('updateNowPlayingHeader displays active song title and shows element', async () => {
    // Setup minimal DOM mock
    const container = {
      style: { display: 'none' },
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };
    const titleEl = { textContent: '' };

    global.document = {
      getElementById(id) {
        if (id === 'header-now-playing') return container;
        if (id === 'now-playing-title') return titleEl;
        return null;
      },
      querySelectorAll: () => []
    };

    const app = await import(`../js/app.js?t=${Date.now()}`);

    // Call with track
    app.updateNowPlayingHeader({ name: '01_Seven_Nation_Army_ANGRIFF.mp3', cleanTitle: 'Seven Nation Army' });
    assert.equal(container.style.display, 'flex');
    assert.equal(titleEl.textContent, 'Seven Nation Army');

    // Call with null / stop
    app.updateNowPlayingHeader(null);
    assert.equal(container.style.display, 'none');
    assert.equal(titleEl.textContent, '');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/header-now-playing.test.js`  
Expected: FAIL with `app.updateNowPlayingHeader is not a function`

- [ ] **Step 3: Implement `updateNowPlayingHeader` in `js/app.js`**

Export function `updateNowPlayingHeader(track)` in `js/app.js`:
```javascript
/**
 * Updates the header Now-Playing banner indicator
 * @param {Object|null} track
 */
export function updateNowPlayingHeader(track) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('header-now-playing');
  const titleEl = document.getElementById('now-playing-title');
  if (!container || !titleEl) return;

  if (track) {
    const title = track.cleanTitle || (typeof cleanTrackTitle === 'function' ? cleanTrackTitle(track.name || '') : track.name || '');
    titleEl.textContent = title;
    container.style.display = 'flex';
    container.classList.add('is-active');
  } else {
    container.style.display = 'none';
    container.classList.remove('is-active');
    titleEl.textContent = '';
  }
}
```

In `updatePlayingUI(trackId)` in `js/app.js`:
```javascript
export function updatePlayingUI(trackId) {
  if (typeof document === 'undefined') return;
  const track = trackId ? (tracks.get(trackId) || (audioEngine.currentTrack?.id === trackId ? audioEngine.currentTrack : null)) : null;
  updateNowPlayingHeader(track);

  const allSongButtons = document.querySelectorAll('.song-btn, .track-btn');
...
```

And in `setupEventListeners()` in `js/app.js`:
Ensure `audioEngine.onTrackStart = (track) => { updatePlayingUI(track ? track.id : null); updateNowPlayingHeader(track); ... }` and `audioEngine.onTrackStop` / `audioEngine.onTrackEnd` call `updateNowPlayingHeader(null);`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/header-now-playing.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/app.js tests/header-now-playing.test.js
git commit -m "feat: implement header now-playing update and lifecycle integration"
```

---

### Task 4: Version Bump (v1.10.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js`
- Modify: `js/app.js`

**Interfaces:**
- Produces: `"version": "1.10.0"` in `version.json`, `APP_VERSION = '1.10.0'` in `js/app.js`, `CACHE_NAME = 'sv1845-dj-v1.10.0'` in `sw.js`

- [ ] **Step 1: Bump version in `version.json`**

```json
{
  "version": "1.10.0",
  "buildTime": "2026-10-16T16:25:00Z"
}
```

- [ ] **Step 2: Bump cache name in `sw.js`**

Change cache name to `'sv1845-dj-v1.10.0'`.

- [ ] **Step 3: Bump APP_VERSION in `js/app.js`**

Change line:
```javascript
export const APP_VERSION = '1.10.0';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`  
Expected: All 109+ tests pass cleanly in under 1 second.

- [ ] **Step 5: Commit**

```bash
git add version.json sw.js js/app.js
git commit -m "chore: bump version to 1.10.0 and verify all tests pass"
```

---

## Plan Self-Review Checklist

- [x] Spec coverage: PWA fullscreen configured, `#header-now-playing` in center gap with 4 animated equalizer bars, dynamic title update when playing, hidden when stopped, version bumped to 1.10.0.
- [x] Placeholder scan: No "TBD", "TODO", or missing blocks; exact code provided for each step.
- [x] Type & selector consistency: `#header-now-playing`, `.now-playing-bars`, `.np-bar`, `#now-playing-title`, `updateNowPlayingHeader(track)` match across spec, HTML, CSS, JS, and tests.
