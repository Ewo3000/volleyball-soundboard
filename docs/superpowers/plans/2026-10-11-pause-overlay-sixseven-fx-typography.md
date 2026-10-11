# Pause Overlay Fix, 6/7 Fullscreen FX, Typography Scaling & Coffee Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the pause hourglass overlay visibility, add coffee cup emoji ☕ to action bar pause buttons, enlarge action button font sizes, create fullscreen 6/7 animation with screen shake and haptic feedback, and bump version to 1.8.0.

**Architecture:** Vanilla JS module updates in `js/app.js`, HTML updates in `index.html`, responsive styling and keyframe animations in `css/app.css`, and automated test coverage in `tests/action-bar-pause.test.js` and `tests/fx.test.js`.

**Tech Stack:** Vanilla JavaScript (ES modules), CSS3 (keyframes, flexbox, grid, transforms), HTML5, Service Worker caching, Node.js built-in test runner (`node:test`, `node:assert/strict`).

## Global Constraints

- Pause hourglass overlay (`#pause-overlay`) must cover `#board-container` reliably during pause song playback with `top: 0; left: 0; width: 100%; height: 100%; z-index: 450; opacity: 1 !important; visibility: visible !important`.
- Pause buttons in action bar must display `☕ Pause 1`, `☕ Pause 2`, `☕ Pause 3`, and `☕ Pause 4`.
- Timeout & Walk-On buttons (`.stacked-btn`) font size: `clamp(0.95rem, 1.30vw, 1.35rem)` with `font-weight: 800`.
- Pause slot buttons (`.pause-slot-btn`) font size: `clamp(0.95rem, 1.30vw, 1.30rem)` with `font-weight: 800`.
- Base action buttons (`.quick-btn`) font size: `clamp(0.80rem, 1.05vw, 1.10rem)`.
- Fullscreen 6/7 animation exported as `triggerSixSevenAnimation()` in `js/app.js`, creating big center "6 / 7" text with shockwave and visual screen shake on `#app`.
- Full automated test suite must pass (`npm test`).
- Version bumped to `1.8.0` across `version.json`, `sw.js`, and `js/app.js`.

---

### Task 1: Pause Hourglass Overlay Bugfix & Hardening

**Files:**
- Modify: `css/app.css:530-542, 1582-1606`
- Modify: `js/app.js:567-595, 928-942, 532-565`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `#pause-overlay`, `showPauseOverlay(track)`, `hidePauseOverlay()`, `audioEngine.onTrackStart`
- Produces: Reliable overlay visibility and resilient lifecycle hooks

- [ ] **Step 1: Write failing test for overlay CSS and lifecycle**

In `tests/action-bar-pause.test.js`, add test assertions that `#pause-overlay` has explicit `width: 100%; height: 100%` and `z-index: 450`:

```javascript
test('pause hourglass overlay has full container dimensions and high z-index', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.pause-overlay[\s\S]*?width:\s*100%/);
  assert.match(css, /\.pause-overlay[\s\S]*?height:\s*100%/);
  assert.match(css, /\.pause-overlay[\s\S]*?z-index:\s*450/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL because `width: 100%` and `z-index: 450` are not yet on `.pause-overlay`.

- [ ] **Step 3: Update CSS for pause overlay**

In `css/app.css`:
```css
#board-container,
.board-container,
.zoom-container {
  position: relative;
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  width: 100%;
  transform-origin: top center;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```
And:
```css
#pause-overlay,
.pause-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: rgba(11, 15, 23, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 450;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

#pause-overlay.active,
.pause-overlay.active {
  opacity: 1 !important;
  pointer-events: auto !important;
  visibility: visible !important;
}
```

- [ ] **Step 4: Update JavaScript for pause overlay lifecycle**

In `js/app.js`:
In `showPauseOverlay(track)`:
```javascript
export function showPauseOverlay(track) {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('pause-overlay');
  if (!overlay) return;
  const trackNameEl = document.getElementById('pause-overlay-track-name');
  if (trackNameEl) {
    const title = track?.name || track?.title;
    trackNameEl.textContent = title ? cleanTrackTitle(title) : 'Pausensong läuft...';
  }
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('active');
}
```

In `setupEventListeners()`:
```javascript
  audioEngine.onTrackStart = (track) => {
    updatePlayingUI(track ? track.id : null);
    const isPause =
      track &&
      (track.category === 'pause' ||
        /_PAUSE[_\s-]?\d*$/i.test(track.suffix || '') ||
        /_(?:PAUSE[_\s-]?\d*|PAUSENSONG)$/i.test(stripExtension(track.name || '')));
    if (isPause) {
      showPauseOverlay(track);
    }
  };
```

In `playPauseSlot(slotIndex, triggerBtn)`:
When no pause tracks exist:
```javascript
  } else {
    clearActiveTriggerButton();
    console.warn(`Kein Pausensong für Slot ${slotIndex} vorhanden`);
    if (typeof alert === 'function') {
      alert(`Kein Pausensong für Slot ${slotIndex} geladen. Bitte Song mit Suffix _PAUSE${slotIndex} hochladen oder 'Demo-Sounds laden' klicken.`);
    }
  }
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add css/app.css js/app.js tests/action-bar-pause.test.js
git commit -m "fix: harden pause hourglass overlay lifecycle and dimensions"
```

---

### Task 2: Coffee Cup Emoji ☕ for Pause Buttons

**Files:**
- Modify: `index.html:235-248`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: Action bar pause buttons `#btn-pause-1`..`#btn-pause-4`
- Produces: Button text displaying `☕ Pause 1`..`☕ Pause 4`

- [ ] **Step 1: Update test with coffee emoji assertion**

In `tests/action-bar-pause.test.js`:
```javascript
test('pause buttons are titled with coffee emoji ☕ Pause 1 through ☕ Pause 4', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="btn-pause-1"[\s\S]*?☕ Pause 1/);
  assert.match(html, /id="btn-pause-2"[\s\S]*?☕ Pause 2/);
  assert.match(html, /id="btn-pause-3"[\s\S]*?☕ Pause 3/);
  assert.match(html, /id="btn-pause-4"[\s\S]*?☕ Pause 4/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL because buttons currently say `Pause 1` without emoji.

- [ ] **Step 3: Update index.html**

In `index.html`:
```html
      <!-- Pause 1–4: 2×2 grid (half height, two columns) -->
      <div class="quick-group pause-slots-group" id="pause-slots-container">
        <button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-1" data-slot="1" title="Pausensong 1">
          <span class="btn-main-text">☕ Pause 1</span>
        </button>
        <button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-2" data-slot="2" title="Pausensong 2">
          <span class="btn-main-text">☕ Pause 2</span>
        </button>
        <button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-3" data-slot="3" title="Pausensong 3">
          <span class="btn-main-text">☕ Pause 3</span>
        </button>
        <button type="button" class="quick-btn btn-pause pause-slot-btn" id="btn-pause-4" data-slot="4" title="Pausensong 4">
          <span class="btn-main-text">☕ Pause 4</span>
        </button>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html tests/action-bar-pause.test.js
git commit -m "feat: add coffee cup emoji to action bar pause buttons"
```

---

### Task 3: Typography Scaling for Action Buttons

**Files:**
- Modify: `css/app.css:872-905, 1024-1035`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `.quick-btn`, `.stacked-btn`, `.pause-slot-btn`
- Produces: Larger font sizes across all action buttons

- [ ] **Step 1: Write test for enlarged font sizes**

In `tests/action-bar-pause.test.js`:
```javascript
test('action button typography is enlarged per specification', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?font-size:\s*clamp\(\s*0\.80rem/);
  assert.match(css, /\.stacked-btn[\s\S]*?font-size:\s*clamp\(\s*0\.95rem/);
  assert.match(css, /\.pause-slot-btn[\s\S]*?font-size:\s*clamp\(\s*0\.95rem/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL due to existing font size values.

- [ ] **Step 3: Update font sizes in css/app.css**

In `css/app.css`:
```css
.quick-btn {
  height: clamp(108px, 14vh, 140px); /* 50% larger */
  padding: 4px clamp(3px, 0.6vw, 10px);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: clamp(0.80rem, 1.05vw, 1.10rem); /* +1 step */
  letter-spacing: 0.01em;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
  color: var(--text-white);
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
  box-shadow: var(--shadow-sm);
  white-space: normal;
  flex: 2.25 1 0px;
  min-width: clamp(75px, 8.5vw, 120px);
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

/* Stacked buttons (Timeout + Walk-On): +3 steps font-size */
.stacked-btn {
  height: clamp(50px, 6.5vh, 66px);
  flex: 1 1 auto;
  width: 100%;
  min-width: clamp(120px, 14vw, 200px);
  font-size: clamp(0.95rem, 1.30vw, 1.35rem);
  font-weight: 800;
}
```
And in `.pause-slot-btn`:
```css
.pause-slot-btn {
  height: clamp(50px, 6.5vh, 66px);
  min-width: clamp(88px, 10vw, 144px);
  padding: 2px clamp(4px, 0.5vw, 10px);
  font-size: clamp(0.95rem, 1.30vw, 1.30rem); /* +4 steps */
  font-weight: 800;
  flex: unset;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add css/app.css tests/action-bar-pause.test.js
git commit -m "feat: enlarge typography of action bar buttons"
```

---

### Task 4: 6/7 Fullscreen Animation & Screen Shake

**Files:**
- Modify: `js/app.js:605-625`
- Modify: `css/app.css:1570-1590`
- Test: `tests/fx.test.js`

**Interfaces:**
- Consumes: `#fx-overlay`, `#app`, `navigator.vibrate`
- Produces: `triggerSixSevenAnimation()` export, screen shake effect, wired into `playSixSeven()`

- [ ] **Step 1: Write test for 6/7 animation and screen shake**

In `tests/fx.test.js`:
```javascript
test('triggerSixSevenAnimation injects 6/7 FX overlay and applies screen-shake class', async () => {
  const { triggerSixSevenAnimation } = await import('../js/app.js');
  assert.equal(typeof triggerSixSevenAnimation, 'function');

  const originalDoc = globalThis.document;
  try {
    const overlay = {
      innerHTML: '',
      appendChild(el) { this.children.push(el); },
      children: []
    };
    const appEl = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'fx-overlay') return overlay;
        if (id === 'app') return appEl;
        return null;
      },
      createElement(tag) {
        return {
          tagName: tag,
          className: '',
          innerHTML: '',
          classList: {
            add() {},
            remove() {}
          },
          remove() {}
        };
      }
    };

    const fx = triggerSixSevenAnimation();
    assert.ok(fx);
    assert.ok(fx.className.includes('fx-sixseven'));
    assert.ok(appEl.classList.contains('screen-shake'));
  } finally {
    globalThis.document = originalDoc;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/fx.test.js`
Expected: FAIL because `triggerSixSevenAnimation` is not yet exported.

- [ ] **Step 3: Implement triggerSixSevenAnimation in js/app.js**

In `js/app.js`:
```javascript
/**
 * Triggers fullscreen hype animation with screen shake on 6/7 action
 */
export function triggerSixSevenAnimation() {
  if (typeof document === 'undefined') return null;
  const overlay = document.getElementById('fx-overlay');
  const appContainer = document.getElementById('app') || document.body;

  if (appContainer?.classList) {
    appContainer.classList.add('screen-shake');
    setTimeout(() => {
      appContainer.classList.remove('screen-shake');
    }, 700);
  }

  // Haptic feedback if supported by browser/device
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }
  } catch (_) {}

  if (!overlay) return null;

  overlay.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fx-sixseven-container fx-sixseven';
  container.innerHTML = `
    <div class="fx-sixseven-burst"></div>
    <div class="fx-sixseven-ring"></div>
    <div class="fx-sixseven-ring-outer"></div>
    <div class="fx-sixseven-content">
      <div class="fx-sixseven-number">6 / 7</div>
      <div class="fx-sixseven-subtitle">HYPE!</div>
    </div>
  `;

  overlay.appendChild(container);

  setTimeout(() => {
    container.classList.add('fx-fade-out');
    setTimeout(() => {
      container?.remove?.();
    }, 400);
  }, 1400);

  return container;
}
```
And call `triggerSixSevenAnimation()` inside `playSixSeven(triggerBtn)`:
```javascript
export function playSixSeven(triggerBtn) {
  triggerSixSevenAnimation();
  const sixSevenTracks = allTracks.filter(
    (t) => t.category === 'sixseven' || t.suffix === '_SIXSEVEN' || /_(?:SIXSEVEN|67)$/i.test(stripExtension(t.name))
  );
  ...
```

- [ ] **Step 4: Add CSS styles in css/app.css**

```css
/* Screen Shake Animation */
@keyframes screen-shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(-5px, 3px) rotate(-0.5deg); }
  20% { transform: translate(5px, -3px) rotate(0.5deg); }
  30% { transform: translate(-4px, -2px) rotate(-0.3deg); }
  40% { transform: translate(4px, 3px) rotate(0.3deg); }
  50% { transform: translate(-3px, 2px) rotate(-0.2deg); }
  60% { transform: translate(3px, -2px) rotate(0.2deg); }
  70% { transform: translate(-2px, -1px) rotate(0deg); }
  80% { transform: translate(2px, 1px) rotate(0deg); }
  90% { transform: translate(-1px, 0px) rotate(0deg); }
}

.screen-shake {
  animation: screen-shake 0.7s cubic-bezier(0.36, 0.07, 0.19, 0.97) both !important;
}

/* 6/7 Fullscreen Hype FX */
.fx-sixseven-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  overflow: hidden;
  z-index: 9999;
}

.fx-sixseven-burst {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255, 143, 0, 0.45) 0%, rgba(249, 115, 22, 0.25) 40%, transparent 70%);
  animation: sixseven-burst 1.4s ease-out forwards;
}

.fx-sixseven-ring {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  border: 4px solid #FFB74D;
  box-shadow: 0 0 40px #FF8F00, inset 0 0 30px #FF8F00;
  animation: sixseven-ring-expand 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
}

.fx-sixseven-ring-outer {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  border: 2px dashed #FFA000;
  animation: sixseven-ring-outer 1.4s linear forwards;
}

.fx-sixseven-content {
  position: relative;
  z-index: 2;
  text-align: center;
  animation: sixseven-content-pop 1.4s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
}

.fx-sixseven-number {
  font-size: clamp(5rem, 16vw, 13rem);
  font-weight: 950;
  line-height: 1;
  color: #FFF8E1;
  text-shadow: 0 0 30px #FF8F00, 0 0 60px #F57C00, 0 0 90px #E65100;
  letter-spacing: 0.02em;
}

.fx-sixseven-subtitle {
  font-size: clamp(1.8rem, 5vw, 3.5rem);
  font-weight: 900;
  color: #FFE082;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-shadow: 0 0 20px #FF8F00;
  margin-top: -10px;
}

@keyframes sixseven-burst {
  0% { opacity: 0; transform: scale(0.6); }
  25% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0; transform: scale(1.6); }
}

@keyframes sixseven-ring-expand {
  0% { transform: scale(0.2); opacity: 1; }
  80% { opacity: 0.8; }
  100% { transform: scale(4.5); opacity: 0; }
}

@keyframes sixseven-ring-outer {
  0% { transform: scale(0.4) rotate(0deg); opacity: 0.8; }
  100% { transform: scale(5) rotate(180deg); opacity: 0; }
}

@keyframes sixseven-content-pop {
  0% { transform: scale(0.3) rotate(-8deg); opacity: 0; }
  35% { transform: scale(1.3) rotate(3deg); opacity: 1; }
  60% { transform: scale(0.95) rotate(0deg); opacity: 1; }
  100% { transform: scale(1.08) rotate(0deg); opacity: 1; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/fx.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/app.js css/app.css tests/fx.test.js
git commit -m "feat: add 6/7 fullscreen animation with screen shake and haptics"
```

---

### Task 5: Version Bump (v1.8.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js:7`
- Modify: `js/app.js:781`
- Test: All tests in `tests/*.test.js`

**Interfaces:**
- Consumes: `version.json`, `sw.js`, `js/app.js`
- Produces: Version `1.8.0` and cache `sv1845-dj-v1.8.0`

- [ ] **Step 1: Bump version in version.json**

```json
{
  "version": "1.8.0",
  "buildTime": "2026-10-11T21:10:00Z"
}
```

- [ ] **Step 2: Bump version in sw.js**

```javascript
const CACHE_NAME = 'sv1845-dj-v1.8.0';
```

- [ ] **Step 3: Bump version in js/app.js**

```javascript
export const APP_VERSION = '1.8.0';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All 93+ tests pass cleanly with 0 failures.

- [ ] **Step 5: Commit**

```bash
git add version.json sw.js js/app.js
git commit -m "chore: bump version to 1.8.0 and verify all tests pass"
```
