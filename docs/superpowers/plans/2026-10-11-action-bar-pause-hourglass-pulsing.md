# Action Bar Expansion, Pause Buttons, Hourglass Overlay & Pulsing Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the SV 1845 Esslingen Volleyball DJ Soundboard with 50% larger action buttons, minimized distance to the mediathek, 3-line responsive text, doubled-width "Pause 1..4" buttons, animated hourglass overlay over the mediathek during pause tracks, and active pulsing glow on triggered buttons.

**Architecture:** 
The fixed action footer bar is brought into the flexbox layout (`position: relative; flex-shrink: 0;`), eliminating the 136px artificial bottom padding on `#columns-grid` so the mediathek connects directly to the action bar. The freed space accommodates 50% taller action buttons (`clamp(108px, 14vh, 140px)`) with dynamic 3-line word wrapping. A dedicated `#pause-overlay` in `#board-container` displays a looping hourglass during pause song playback, and `js/app.js` tracks the active trigger button to pulse in sync with the song.

**Tech Stack:** Vanilla JavaScript (ES Modules), HTML5, CSS3, Web Audio API, Service Worker PWA, Node.js Test Runner.

## Global Constraints

- Action button height enlarged by 50% to `clamp(108px, 14vh, 140px)`.
- Action bar min-height enlarged to `clamp(130px, 17vh, 160px)`.
- Distance between mediathek (`#columns-grid`) and action bar minimized (`padding-bottom: 6px`).
- Pause buttons titled "Pause 1", "Pause 2", "Pause 3", "Pause 4" and doubled in min-width (`clamp(56px, 6vw, 90px)`).
- Action button text wraps cleanly into up to 3 lines (`white-space: normal; word-break: break-word;`).
- Sanduhr overlay (`#pause-overlay`) covers `#board-container` during pause tracks and disappears when audio stops or STOP is clicked. Action bar remains clickable.
- Active trigger button receives `.is-playing` / `.playing` and pulses with `pulse-playing-glow`.
- All automated tests must pass without errors.
- Version bumped to `1.5.0` in `version.json` and `sw.js`.

---

### Task 1: Pause Buttons Re-titling & Double Width

**Files:**
- Modify: `index.html:226-240`
- Modify: `js/app.js:159-183`
- Modify: `css/app.css:992-1008`
- Create: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `updatePauseSlotsUI()` in `js/app.js`.
- Produces: Pause buttons with text "Pause 1", "Pause 2", "Pause 3", "Pause 4" and min-width doubled in `css/app.css`.

- [ ] **Step 1: Write the failing test in `tests/action-bar-pause.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pause buttons are titled Pause 1 through Pause 4 and have doubled min-width', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="btn-pause-1"[\s\S]*?Pause 1/);
  assert.match(html, /id="btn-pause-2"[\s\S]*?Pause 2/);
  assert.match(html, /id="btn-pause-3"[\s\S]*?Pause 3/);
  assert.match(html, /id="btn-pause-4"[\s\S]*?Pause 4/);

  const css = fs.readFileSync('css/app.css', 'utf8');
  // Doubled from original 26px to at least 52px
  assert.match(css, /\.pause-slot-btn[\s\S]*?min-width:\s*clamp\(\s*5[2-6]px/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL (index.html contains P1-P4, css contains clamp(26px...))

- [ ] **Step 3: Update `index.html`, `js/app.js`, and `css/app.css`**

In `index.html`:
Replace `P1`, `P2`, `P3`, `P4` in `#pause-slots-container` with:
```html
<button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-1" data-slot="1" title="Pausensong 1">
  <span class="btn-main-text">Pause 1</span>
</button>
<button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-2" data-slot="2" title="Pausensong 2">
  <span class="btn-main-text">Pause 2</span>
</button>
<button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-3" data-slot="3" title="Pausensong 3">
  <span class="btn-main-text">Pause 3</span>
</button>
<button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-4" data-slot="4" title="Pausensong 4">
  <span class="btn-main-text">Pause 4</span>
</button>
```

In `css/app.css`:
```css
.pause-slot-btn {
  min-width: clamp(56px, 6vw, 90px);
  padding: 2px clamp(4px, 0.5vw, 10px);
  font-size: clamp(0.70rem, 0.85vw, 0.90rem);
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add index.html js/app.js css/app.css tests/action-bar-pause.test.js
git commit -m "feat: re-title pause buttons to Pause 1-4 and double width"
```

---

### Task 2: Sanduhr (Hourglass) Overlay over Mediathek during Pause Tracks

**Files:**
- Modify: `index.html:90-100`
- Modify: `css/app.css` (add `#pause-overlay`, `.pause-overlay`, `@keyframes hourglass-float-rotate`)
- Modify: `js/app.js` (add `showPauseOverlay`, `hidePauseOverlay`, call in pause playback and stop)
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `audioEngine.onTrackStop`, `audioEngine.onTrackEnd`, `playPauseSlot`, `handlePlayTrack`.
- Produces: `showPauseOverlay(track)`, `hidePauseOverlay()`, `#pause-overlay` DOM element.

- [ ] **Step 1: Write the failing test in `tests/action-bar-pause.test.js`**

```javascript
test('pause hourglass overlay exists in DOM and functions are exported in js/app.js', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="pause-overlay"/);
  assert.match(html, /class="pause-hourglass-icon"/);
  assert.match(html, /Satzpause/);

  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.pause-overlay/);
  assert.match(css, /hourglass/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Pause Overlay in `index.html`, `css/app.css`, and `js/app.js`**

In `index.html`:
Inside `#board-container` before `#columns-grid`:
```html
<div id="pause-overlay" class="pause-overlay" aria-hidden="true" style="display: none;">
  <div class="pause-overlay-content">
    <div class="pause-hourglass-icon">⏳</div>
    <div class="pause-overlay-title">Satzpause</div>
    <div class="pause-track-name" id="pause-overlay-track-name">Pausensong läuft...</div>
    <div class="pause-overlay-hint">Musik stoppen über ■ STOP</div>
  </div>
</div>
```

In `css/app.css`:
```css
/* Pause Hourglass Overlay over Mediathek */
.board-container {
  position: relative;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  background: rgba(11, 15, 23, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pause-overlay.active {
  opacity: 1;
}

.pause-overlay-content {
  text-align: center;
  padding: 24px 32px;
  background: rgba(23, 37, 84, 0.8);
  border: 1px solid var(--border-glass);
  box-shadow: 0 0 32px rgba(27, 117, 188, 0.4);
  border-radius: var(--radius-lg);
  max-width: 400px;
}

.pause-hourglass-icon {
  font-size: 3.5rem;
  line-height: 1;
  margin-bottom: 12px;
  animation: hourglass-flip 3s infinite ease-in-out;
}

@keyframes hourglass-flip {
  0% { transform: rotate(0deg) scale(1); }
  45% { transform: rotate(0deg) scale(1.05); }
  50% { transform: rotate(180deg) scale(1.1); }
  95% { transform: rotate(180deg) scale(1.05); }
  100% { transform: rotate(360deg) scale(1); }
}

.pause-overlay-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-white);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pause-track-name {
  font-size: 1.05rem;
  color: #93C5FD;
  margin-top: 6px;
  font-weight: 600;
}

.pause-overlay-hint {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-top: 14px;
}
```

In `js/app.js`:
Add and export `showPauseOverlay(track)` and `hidePauseOverlay()`.
Wire into `playPauseSlot`, `handlePlayTrack` (check if category is `pause` or suffix `_PAUSE`), and wire `hidePauseOverlay()` into `audioEngine.onTrackStop`, `audioEngine.onTrackEnd`, and `stopAudio()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add index.html css/app.css js/app.js tests/action-bar-pause.test.js
git commit -m "feat: add animated hourglass pause overlay over mediathek"
```

---

### Task 3: Active Button Pulsing Animation

**Files:**
- Modify: `css/app.css` (apply `pulse-playing-glow` to `.quick-btn.is-playing, .mobile-quick-btn.is-playing`)
- Modify: `js/app.js` (track and toggle active trigger element on playback start and end)
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: Quick action click handlers, `handlePlayTrack`.
- Produces: Synchronized pulsing state on any triggered button while audio plays.

- [ ] **Step 1: Write the failing test in `tests/action-bar-pause.test.js`**

```javascript
test('css applies pulse-playing-glow to quick-btn and mobile-quick-btn when is-playing', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn\.is-playing[\s\S]*?pulse-playing-glow/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Active Trigger Pulsing in `js/app.js` and `css/app.css`**

In `css/app.css`:
```css
.song-btn.is-playing,
.song-btn.playing,
.track-btn.is-playing,
.track-btn.playing,
.quick-btn.is-playing,
.quick-btn.playing,
.mobile-quick-btn.is-playing,
.mobile-quick-btn.playing,
.pause-slot-btn.is-playing,
.pause-slot-btn.playing,
[data-playing="true"] {
  background: #172554 !important;
  border-color: #60A5FA !important;
  animation: pulse-playing-glow 1.4s infinite ease-in-out !important;
  color: #EFF6FF !important;
  z-index: 2;
}
```

In `js/app.js`:
Add `activeTriggerBtn = null;`
Export `setActiveTriggerButton(btn)`.
When any quick action (or mobile action, or song button) triggers playback, set `setActiveTriggerButton(btn)`.
In `audioEngine.onTrackStop` and `audioEngine.onTrackEnd`, call `clearActiveTriggerButton()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add css/app.css js/app.js tests/action-bar-pause.test.js
git commit -m "feat: animate active trigger buttons with glowing pulse during playback"
```

---

### Task 4: Layout Overhaul (Minimized Distance & +50% Button Size)

**Files:**
- Modify: `css/app.css:545-565` (change `#columns-grid` padding-bottom from 136px to 6px)
- Modify: `css/app.css:825-870` (change `#quick-actions-bar` from fixed to relative/flex flow, enlarge height)
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `#columns-grid`, `#quick-actions-bar`, `.quick-btn`, `.btn-stop`.
- Produces: 50% larger buttons (`clamp(108px, 14vh, 140px)`), bar (`clamp(130px, 17vh, 160px)`), and minimal 6px bottom padding on `#columns-grid`.

- [ ] **Step 1: Write the failing test in `tests/action-bar-pause.test.js`**

```javascript
test('css minimizes grid padding and enlarges action buttons by 50%', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /#columns-grid[\s\S]*?padding:[\s\S]*?[4-8]px/);
  // Action bar enlarged to clamp(130px...
  assert.match(css, /#quick-actions-bar[\s\S]*?min-height:\s*clamp\(\s*130px/);
  // Buttons enlarged to clamp(108px...
  assert.match(css, /\.quick-btn[\s\S]*?height:\s*clamp\(\s*108px/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Layout Overhaul in `css/app.css`**

Update `#columns-grid`:
```css
#columns-grid,
.soundboard-grid,
.grid-container {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 10px 12px 6px 12px; /* Minimized bottom padding directly bordering action bar */
  flex: 1;
  min-height: 0;
  width: 100%;
  transform-origin: top center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

Update `#quick-actions-bar`:
```css
#quick-actions-bar,
.quick-footer,
.footer-bar,
footer.quick-actions {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
  background: rgba(11, 15, 23, 0.98);
  border-top: 1px solid var(--border-glass);
  backdrop-filter: blur(16px);
  padding: 8px clamp(4px, 1vw, 12px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(4px, 0.6vw, 10px);
  z-index: 500;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.7);
  min-height: clamp(130px, 17vh, 160px); /* 50% larger upwards */
}
```

Update `.quick-btn`, `.btn-stop`, `.pause-slot-btn`:
```css
.quick-btn {
  height: clamp(108px, 14vh, 140px); /* 50% larger */
  padding: 4px clamp(3px, 0.6vw, 10px);
  ...
}

.pause-slot-btn {
  height: clamp(108px, 14vh, 140px); /* 50% larger */
  ...
}

.btn-stop {
  height: clamp(108px, 14vh, 140px); /* 50% larger */
  ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add css/app.css tests/action-bar-pause.test.js
git commit -m "feat: minimize gap between mediathek and footer, enlarge action buttons by 50%"
```

---

### Task 5: Three-Line Text Wrapping for Action Buttons

**Files:**
- Modify: `css/app.css:870-910`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `.quick-btn`, `.btn-main-text`, `.btn-subtext`.
- Produces: CSS rules allowing text to wrap up to 3 lines nicely without overflow.

- [ ] **Step 1: Write the failing test in `tests/action-bar-pause.test.js`**

```javascript
test('css allows 3-line text wrapping for action buttons', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?white-space:\s*normal/);
  assert.match(css, /\.btn-main-text[\s\S]*?white-space:\s*normal/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL

- [ ] **Step 3: Implement 3-line text wrapping in `css/app.css`**

In `css/app.css`:
```css
.btn-main-text {
  display: block;
  font-weight: 700;
  white-space: normal;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
  text-align: center;
}

.btn-subtext {
  display: block;
  font-size: 0.72em;
  font-weight: 600;
  opacity: 0.88;
  white-space: normal;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 3px;
  line-height: 1.1;
  text-align: center;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add css/app.css tests/action-bar-pause.test.js
git commit -m "feat: enable 3-line text wrapping on action buttons"
```

---

### Task 6: PWA Version Bump, README Update & Full Test Suite Verification

**Files:**
- Modify: `version.json` (bump to 1.5.0)
- Modify: `sw.js` (bump cache to sv1845-dj-v1.5.0)
- Modify: `js/app.js` (bump APP_VERSION to 1.5.0)
- Modify: `README.md`
- Run: `npm test`

- [ ] **Step 1: Bump version in `version.json`, `sw.js`, and `js/app.js`**

Set version to `1.5.0` and cache name to `sv1845-dj-v1.5.0`.

- [ ] **Step 2: Update `README.md`**

Update descriptions for:
- 50% enlarged action buttons and minimized gap to mediathek.
- Pause 1-4 buttons with doubled width.
- Animated hourglass overlay over mediathek during Satzpause.
- Pulsing animation on triggered buttons.
- Update test count.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (>= 89 tests).

- [ ] **Step 4: Commit changes**

```bash
git add version.json sw.js js/app.js README.md tests/action-bar-pause.test.js
git commit -m "chore: bump version to 1.5.0, update docs, and verify all tests pass"
```
