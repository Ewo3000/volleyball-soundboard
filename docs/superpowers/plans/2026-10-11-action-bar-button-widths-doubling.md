# Action Bar Button Widths Doubling & Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Double the widths of Timeout, Walk-On, and Pause 1–4 buttons, increase the remaining 5 action buttons by 50% in width, and preserve the STOP button's prominent dimensions while verifying clean responsiveness across devices.

**Architecture:** CSS layout adjustments in `css/app.css` using `clamp()` and flexbox for responsive scaling, complemented by unit tests in `tests/action-bar-pause.test.js` and a PWA version bump to `1.7.0`.

**Tech Stack:** Vanilla JavaScript (ES modules), CSS3 Flexbox/Grid, HTML5, Node.js built-in test runner (`node:test`, `node:assert/strict`), Service Worker cache management.

## Global Constraints

- Timeout & Walk-On buttons (`.stacked-btn`) min-width: `clamp(120px, 14vw, 200px)` (doubled).
- Pause 1–4 buttons (`.pause-slot-btn`) min-width: `clamp(88px, 10vw, 144px)` (doubled).
- Game action buttons (`.quick-btn`) flex-grow: `2.25` (increased by 50% from `1.5`) and min-width: `clamp(75px, 8.5vw, 120px)`.
- STOP button (`.btn-stop`) remains untouched at `min-width: clamp(80px, 9vw, 130px); flex: 0 0 auto;`.
- Responsive layout remains completely intact without horizontal scrolling or text clipping on standard tablets and desktops.
- Automated test suite must pass with 100% success (`npm test`).
- Version bumped to `1.7.0` across `version.json`, `sw.js`, and `js/app.js`.

---

### Task 1: Timeout & Walk-On Width Doubling

**Files:**
- Modify: `css/app.css:897-903`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `.stacked-btn` selector in `css/app.css`
- Produces: Updated `.stacked-btn` styling with doubled min-width: `clamp(120px, 14vw, 200px)`

- [ ] **Step 1: Write the failing test**

In `tests/action-bar-pause.test.js`, add an assertion for the doubled `clamp(120px` min-width:

```javascript
test('timeout and walk-on buttons have doubled min-width in stacked column', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.stacked-btn[\s\S]*?min-width:\s*clamp\(\s*120px/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL because `.stacked-btn` currently has `clamp(60px`.

- [ ] **Step 3: Update CSS implementation**

In `css/app.css`, change:
```css
.stacked-btn {
  height: clamp(50px, 6.5vh, 66px); /* ~half the bar height */
  flex: 1 1 auto;
  width: 100%;
  min-width: clamp(120px, 14vw, 200px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add css/app.css tests/action-bar-pause.test.js
git commit -m "feat: double width of timeout and walk-on stacked buttons"
```

---

### Task 2: Pause 1–4 Grid Buttons Width Doubling

**Files:**
- Modify: `css/app.css:1024-1034`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `.pause-slot-btn` selector in `css/app.css`
- Produces: Updated `.pause-slot-btn` styling with doubled min-width: `clamp(88px, 10vw, 144px)`

- [ ] **Step 1: Update the test with doubled min-width assertion**

In `tests/action-bar-pause.test.js`, update the test `pause buttons are titled Pause 1 through Pause 4 and are laid out in 2×2 grid`:

```javascript
  // Pause slot button min-width doubled to at least 88px
  assert.match(css, /\.pause-slot-btn[\s\S]*?min-width:\s*clamp\(\s*88px/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL because `.pause-slot-btn` currently has `clamp(44px`.

- [ ] **Step 3: Update CSS implementation**

In `css/app.css`, change:
```css
.pause-slot-btn {
  height: clamp(50px, 6.5vh, 66px); /* half the bar height — 2 rows fit */
  min-width: clamp(88px, 10vw, 144px);
  padding: 2px clamp(4px, 0.5vw, 10px);
  font-size: clamp(0.68rem, 0.82vw, 0.88rem);
  flex: unset; /* override .quick-btn flex — grid handles sizing */
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
git commit -m "feat: double width of pause slot buttons in 2x2 grid"
```

---

### Task 3: Game Action Buttons +50% Width Increase

**Files:**
- Modify: `css/app.css:872-895`
- Test: `tests/action-bar-pause.test.js`

**Interfaces:**
- Consumes: `.quick-btn` base style in `css/app.css`
- Produces: `.quick-btn` with `flex: 2.25 1 0px` and `min-width: clamp(75px, 8.5vw, 120px)`

- [ ] **Step 1: Write test for increased flex and min-width**

In `tests/action-bar-pause.test.js`:

```javascript
test('action buttons have +50% width via flex: 2.25', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /\.quick-btn[\s\S]*?flex:\s*2\.25/);
  assert.match(css, /\.quick-btn[\s\S]*?min-width:\s*clamp\(\s*75px/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/action-bar-pause.test.js`
Expected: FAIL because `.quick-btn` currently has `flex: 1.5 1 0px`.

- [ ] **Step 3: Update CSS implementation**

In `css/app.css`:
```css
.quick-btn {
  height: clamp(108px, 14vh, 140px); /* 50% larger */
  padding: 4px clamp(3px, 0.6vw, 10px);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: clamp(0.70rem, 0.95vw, 0.98rem);
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
  flex: 2.25 1 0px; /* +50% wider (from 1.5) */
  min-width: clamp(75px, 8.5vw, 120px);
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/action-bar-pause.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add css/app.css tests/action-bar-pause.test.js
git commit -m "feat: increase game action buttons width by 50%"
```

---

### Task 4: PWA Version Bump (v1.7.0) & Full Test Suite Verification

**Files:**
- Modify: `version.json`
- Modify: `sw.js:7`
- Modify: `js/app.js:781`
- Test: All tests in `tests/*.test.js`

**Interfaces:**
- Consumes: `version.json`, `sw.js`, `js/app.js`
- Produces: Version `1.7.0` and cache `sv1845-dj-v1.7.0`

- [ ] **Step 1: Bump version in version.json**

```json
{
  "version": "1.7.0",
  "buildTime": "2026-10-11T20:35:00Z"
}
```

- [ ] **Step 2: Bump version in sw.js**

```javascript
const CACHE_NAME = 'sv1845-dj-v1.7.0';
```

- [ ] **Step 3: Bump version in js/app.js**

```javascript
export const APP_VERSION = '1.7.0';
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: 91+ tests pass cleanly.

- [ ] **Step 5: Commit**

```bash
git add version.json sw.js js/app.js
git commit -m "chore: bump version to 1.7.0 and verify all tests pass"
```
