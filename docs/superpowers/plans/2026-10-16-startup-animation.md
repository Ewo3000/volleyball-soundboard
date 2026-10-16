# Matchday Startup Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fast, cinematic, and branded startup splash animation (`#startup-splash`) for SV 1845 Esslingen Volleyball DJ Soundboard, featuring the club logo, dynamic pulse effects, equalizer soundwave, smooth fade-out, and tap-to-skip functionality.

**Architecture:** HTML overlay structure in `index.html`, responsive styling and keyframe animations in `css/app.css`, lifecycle auto-dismiss and skip-handler in `js/app.js`, and comprehensive unit tests in `tests/startup-splash.test.js`.

**Tech Stack:** Vanilla JavaScript (ES modules), CSS3 Animations/Keyframes, HTML5, Node.js built-in test runner (`node:test`, `node:assert/strict`), PWA Service Worker.

## Global Constraints

- Splashscreen overlay `#startup-splash` must have `position: fixed; inset: 0; z-index: 10000;`.
- Features club logo (`assets/logo.jpg`), text ("SV 1845 ESSLINGEN", "VOLLEYBALL DJ", "🏐 Ready for Matchday"), and 5 animated soundwave bars (`.sw-bar`).
- Dismissal must be smooth via `.splash-fade-out` (`opacity: 0`, transition ~350ms, then `display: none`).
- Tap/Click-to-skip: Clicking or tapping `#startup-splash` must immediately trigger `dismissStartupSplash()`.
- Auto-dismiss timer: Calls `dismissStartupSplash()` after ~1600ms.
- Full automated test suite must pass cleanly (`npm test`).
- Version bumped to `1.9.0` across `version.json`, `sw.js` (cache `sv1845-dj-v1.9.0`), and `js/app.js`.

---

### Task 1: HTML Markup for Startup Splash

**Files:**
- Modify: `index.html:15-30`
- Create: `tests/startup-splash.test.js`

**Interfaces:**
- Consumes: `assets/logo.jpg`
- Produces: `#startup-splash` element in `index.html`

- [ ] **Step 1: Write the failing test**

Create `tests/startup-splash.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('startup splash markup exists in index.html with all branding elements', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="startup-splash"/);
  assert.match(html, /class="splash-badge"/);
  assert.match(html, /src="assets\/logo\.jpg"/);
  assert.match(html, /SV 1845 ESSLINGEN/);
  assert.match(html, /VOLLEYBALL DJ/);
  assert.match(html, /Ready for Matchday/);
  assert.match(html, /class="splash-soundwave"/);
  assert.match(html, /class="splash-skip-hint"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/startup-splash.test.js`
Expected: FAIL because `#startup-splash` is not yet in `index.html`.

- [ ] **Step 3: Add markup to index.html**

In `index.html`, right after `<div id="app" class="app-container">`:
```html
    <!-- Startup Matchday Splash Screen -->
    <div id="startup-splash" class="startup-splash" aria-hidden="false">
      <div class="splash-glow"></div>
      <div class="splash-shockwave"></div>
      <div class="splash-badge">
        <img src="assets/logo.jpg" alt="SV 1845 Esslingen Logo" class="splash-logo">
      </div>
      <div class="splash-typography">
        <div class="splash-club">SV 1845 ESSLINGEN</div>
        <div class="splash-title">VOLLEYBALL DJ</div>
        <div class="splash-tagline">🏐 Ready for Matchday</div>
        <div class="splash-soundwave">
          <span class="sw-bar"></span>
          <span class="sw-bar"></span>
          <span class="sw-bar"></span>
          <span class="sw-bar"></span>
          <span class="sw-bar"></span>
        </div>
      </div>
      <div class="splash-skip-hint">Tippen zum Überspringen</div>
    </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/startup-splash.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add index.html tests/startup-splash.test.js
git commit -m "feat: add markup for startup splash animation"
```

---

### Task 2: CSS Animations and Styling

**Files:**
- Modify: `css/app.css`
- Test: `tests/startup-splash.test.js`

**Interfaces:**
- Consumes: `#startup-splash` selectors
- Produces: Keyframe animations and layout rules in `css/app.css`

- [ ] **Step 1: Write failing test for CSS rules**

In `tests/startup-splash.test.js`, add:
```javascript
test('startup splash CSS styling and keyframes are defined', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /#startup-splash[\s\S]*?position:\s*fixed/);
  assert.match(css, /#startup-splash[\s\S]*?z-index:\s*10000/);
  assert.match(css, /\.splash-fade-out[\s\S]*?opacity:\s*0/);
  assert.match(css, /@keyframes splash-pop/);
  assert.match(css, /@keyframes splash-wave/);
  assert.match(css, /@keyframes sw-dance/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/startup-splash.test.js`
Expected: FAIL because CSS rules are not yet added.

- [ ] **Step 3: Add CSS styles to css/app.css**

At the end of `css/app.css`:
```css
/* ==========================================================================
   Matchday Startup Splash Screen
   ========================================================================== */
#startup-splash,
.startup-splash {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: radial-gradient(circle at center, #132347 0%, #0B0F17 80%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s ease-out;
}

.startup-splash.splash-fade-out {
  opacity: 0 !important;
  transform: scale(1.06);
  pointer-events: none !important;
}

.splash-glow {
  position: absolute;
  width: 450px;
  height: 450px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(27, 117, 188, 0.45) 0%, rgba(27, 117, 188, 0) 70%);
  filter: blur(40px);
  pointer-events: none;
  animation: splash-pulse-glow 2s ease-in-out infinite;
}

.splash-shockwave {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  border: 3px solid rgba(27, 117, 188, 0.8);
  box-shadow: 0 0 30px rgba(27, 117, 188, 0.6);
  pointer-events: none;
  animation: splash-wave 1.6s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
}

.splash-badge {
  position: relative;
  width: clamp(110px, 16vw, 150px);
  height: clamp(110px, 16vw, 150px);
  border-radius: 50%;
  padding: 4px;
  background: linear-gradient(135deg, #1B75BC, #0d3d63);
  box-shadow: 0 0 35px rgba(27, 117, 188, 0.7), inset 0 0 15px rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  animation: splash-pop 0.9s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
}

.splash-logo {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.splash-typography {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-top: 24px;
  animation: splash-text-reveal 0.9s ease-out 0.2s both;
}

.splash-club {
  font-size: clamp(1.4rem, 3.2vw, 2.2rem);
  font-weight: 900;
  color: var(--text-white);
  letter-spacing: 0.08em;
  text-shadow: 0 0 24px rgba(27, 117, 188, 0.8);
}

.splash-title {
  font-size: clamp(1.0rem, 2.2vw, 1.45rem);
  font-weight: 800;
  color: var(--flame-gold);
  letter-spacing: 0.18em;
  margin-top: 4px;
  text-shadow: 0 0 16px rgba(245, 166, 35, 0.6);
}

.splash-tagline {
  font-size: clamp(0.85rem, 1.6vw, 1.05rem);
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  margin-top: 8px;
}

.splash-soundwave {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 24px;
  margin-top: 14px;
}

.sw-bar {
  width: 4px;
  height: 6px;
  background: var(--flame-gold);
  border-radius: 2px;
  animation: sw-dance 0.7s ease-in-out infinite alternate;
}

.sw-bar:nth-child(1) { animation-delay: 0.0s; height: 10px; }
.sw-bar:nth-child(2) { animation-delay: 0.2s; height: 18px; }
.sw-bar:nth-child(3) { animation-delay: 0.4s; height: 24px; }
.sw-bar:nth-child(4) { animation-delay: 0.15s; height: 16px; }
.sw-bar:nth-child(5) { animation-delay: 0.3s; height: 12px; }

.splash-skip-hint {
  position: absolute;
  bottom: 24px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  animation: splash-skip-fade 1.2s ease-in infinite alternate;
}

@keyframes splash-pop {
  0% { transform: scale(0.2) rotate(-10deg); opacity: 0; }
  60% { transform: scale(1.08) rotate(3deg); opacity: 1; }
  100% { transform: scale(1.0) rotate(0deg); opacity: 1; }
}

@keyframes splash-wave {
  0% { transform: scale(0.5); opacity: 0.9; }
  100% { transform: scale(2.8); opacity: 0; }
}

@keyframes splash-pulse-glow {
  0%, 100% { opacity: 0.6; transform: scale(0.95); }
  50% { opacity: 0.95; transform: scale(1.08); }
}

@keyframes splash-text-reveal {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}

@keyframes sw-dance {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1.3); }
}

@keyframes splash-skip-fade {
  0% { opacity: 0.2; }
  100% { opacity: 0.6; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/startup-splash.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add css/app.css tests/startup-splash.test.js
git commit -m "feat: add CSS styles and animations for startup splash"
```

---

### Task 3: JavaScript Lifecycle, Auto-Dismiss & Click-to-Skip

**Files:**
- Modify: `js/app.js`
- Test: `tests/startup-splash.test.js`

**Interfaces:**
- Produces: `initStartupSplash()` and `dismissStartupSplash()` in `js/app.js`

- [ ] **Step 1: Write test for dismissStartupSplash and initStartupSplash**

In `tests/startup-splash.test.js`, add:
```javascript
test('dismissStartupSplash adds splash-fade-out and hides splash screen', async () => {
  const { dismissStartupSplash, initStartupSplash } = await import('../js/app.js');
  assert.equal(typeof dismissStartupSplash, 'function');
  assert.equal(typeof initStartupSplash, 'function');

  const originalDoc = globalThis.document;
  try {
    const splashEl = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      style: { display: '' },
      listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; }
    };

    globalThis.document = {
      getElementById(id) {
        if (id === 'startup-splash') return splashEl;
        return null;
      }
    };

    initStartupSplash();
    assert.ok(splashEl.listeners['click'], 'Click listener registered on splash');

    dismissStartupSplash();
    assert.ok(splashEl.classList.contains('splash-fade-out'));
    assert.equal(splashEl.attributes['aria-hidden'], 'true');
  } finally {
    globalThis.document = originalDoc;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/startup-splash.test.js`
Expected: FAIL because functions are not yet exported.

- [ ] **Step 3: Implement in js/app.js**

In `js/app.js`:
```javascript
/**
 * Dismisses the startup matchday splash screen with a smooth fade-out.
 */
export function dismissStartupSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('startup-splash');
  if (!splash || splash.classList.contains('dismissed')) return;

  splash.classList.add('splash-fade-out', 'dismissed');
  splash.setAttribute('aria-hidden', 'true');

  setTimeout(() => {
    splash.style.display = 'none';
  }, 350);
}

/**
 * Initializes the startup splash animation with auto-dismiss and click-to-skip.
 */
export function initStartupSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('startup-splash');
  if (!splash) return;

  // Click or touch anywhere on splash screen skips animation immediately
  splash.addEventListener('click', () => dismissStartupSplash());
  splash.addEventListener('touchend', () => dismissStartupSplash(), { passive: true });

  // Auto-dismiss after 1600ms
  setTimeout(() => {
    dismissStartupSplash();
  }, 1600);
}
```
And inside `initApp()` in `js/app.js`:
Call `initStartupSplash();` at the beginning of `initApp()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/startup-splash.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/app.js tests/startup-splash.test.js
git commit -m "feat: add startup splash lifecycle with auto-dismiss and click-to-skip"
```

---

### Task 4: PWA Version Bump (v1.9.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js:4,7`
- Modify: `js/app.js` (`APP_VERSION`)
- Test: All tests in `tests/*.test.js`

**Interfaces:**
- Consumes: `version.json`, `sw.js`, `js/app.js`
- Produces: Version `1.9.0` and cache `sv1845-dj-v1.9.0`

- [ ] **Step 1: Bump version in version.json**

```json
{
  "version": "1.9.0",
  "buildTime": "2026-10-16T15:40:00Z"
}
```

- [ ] **Step 2: Bump version in sw.js**

```javascript
const CACHE_NAME = 'sv1845-dj-v1.9.0';
```

- [ ] **Step 3: Bump version in js/app.js**

```javascript
export const APP_VERSION = '1.9.0';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass cleanly (104+ tests, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add version.json sw.js js/app.js
git commit -m "chore: bump version to 1.9.0 and verify all tests pass"
```
