# SV 1845 Esslingen – Volleyball DJ Soundboard
## Design Specification: Pause Overlay Fix, 6/7 Fullscreen FX & Screen Shake, Font Sizes, and Coffee Emoji (v1.8.0)

**Date:** 2026-10-11  
**Status:** Approved by User  
**Target Version:** 1.8.0  

---

## 1. Overview & Requirements

The user requested four improvements:
1. **Pause Hourglass Overlay Fix**:
   - The animated hourglass overlay (`#pause-overlay`) was not staying visible due to audio engine track change race conditions (`stop(50)` triggering `onTrackStop()` and immediately closing the overlay) and CSS container sizing constraints.
   - Fix ensures that `#pause-overlay` reliably opens and stays visible throughout playback of any pause song, with immediate class application, CSS dimensions (`top: 0; left: 0; width: 100%; height: 100%; z-index: 450; opacity: 1 !important; visibility: visible !important`), and proactive handling when no pause tracks are loaded.
2. **Coffee Cup Emoji ☕ for Pause Buttons**:
   - Update action bar pause button texts from `Pause 1`–`Pause 4` to `☕ Pause 1`, `☕ Pause 2`, `☕ Pause 3`, and `☕ Pause 4`.
3. **Typography Scaling for Action Buttons**:
   - Timeout & Walk-On (`.stacked-btn`): Increase font size by 3 steps to `clamp(0.95rem, 1.30vw, 1.35rem)` with `font-weight: 800`.
   - Pause 1–4 (`.pause-slot-btn`): Increase font size by 4 steps to `clamp(0.95rem, 1.30vw, 1.30rem)` with `font-weight: 800`.
   - Remaining action buttons (`.quick-btn` base): Increase font size by 1 step to `clamp(0.80rem, 1.05vw, 1.10rem)`.
4. **Fullscreen Animation & Screen Shake on 6/7 Button**:
   - Analogous to `triggerAceAnimation` and `triggerBlockAnimation`, add `triggerSixSevenAnimation()`.
   - Displays a huge, glowing "6 / 7" text in screen center with energetic orange/gold shockwaves (`#FF8F00` / `#F97316`).
   - Visual screen shake: Apply `.screen-shake` class to `#app` for ~700ms with `@keyframes screen-shake`.
   - Haptic vibration: Trigger `navigator.vibrate([100, 50, 100, 50, 200])` when supported.

---

## 2. Technical Architecture & Component Changes

### 2.1 Pause Overlay Bugfix (`js/app.js`, `css/app.css`)
- **Lifecycle Coordination**:
  - In `js/app.js`: When `audioEngine.onTrackStart(track)` triggers, check if `track` is a pause track; if so, enforce `showPauseOverlay(track)`.
  - In `showPauseOverlay(track)`: Remove any `requestAnimationFrame` delays, immediately apply `.active` class and update track label.
  - In `playPauseSlot(slotIndex, triggerBtn)`: If no pause tracks exist in library, display an alert explaining that no pause song is loaded.
- **CSS Hardening**:
  - In `css/app.css`:
    ```css
    #board-container {
      position: relative;
    }
    #pause-overlay,
    .pause-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
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

### 2.2 Coffee Cup Emoji ☕ (`index.html`, `tests/action-bar-pause.test.js`)
- In `index.html`: Update labels of `#btn-pause-1` through `#btn-pause-4` to include `☕ Pause 1`, `☕ Pause 2`, `☕ Pause 3`, `☕ Pause 4`.
- Update regression tests to assert `☕ Pause 1` etc.

### 2.3 Typography Scaling (`css/app.css`)
- `.quick-btn` base font size updated to `clamp(0.80rem, 1.05vw, 1.10rem)`.
- `.stacked-btn` font size updated to `clamp(0.95rem, 1.30vw, 1.35rem)` with `font-weight: 800`.
- `.pause-slot-btn` font size updated to `clamp(0.95rem, 1.30vw, 1.30rem)` with `font-weight: 800`.

### 2.4 6/7 Fullscreen FX & Screen Shake (`js/app.js`, `css/app.css`)
- Function `triggerSixSevenAnimation()` exported from `js/app.js`.
- Injects `.fx-sixseven-container` into `#fx-overlay`:
  - Contains `.fx-sixseven-number` with text "6 / 7".
  - Contains `.fx-sixseven-burst` and energetic shockwave rings.
- Screen Shake:
  - Adds class `screen-shake` to `#app` for 700ms.
  - `@keyframes screen-shake`: Rapid ±4px displacement.
  - Haptic: `navigator.vibrate?.([100, 50, 100, 50, 200])`.
- Invoked when `#btn-sixseven` or `#btn-mobile-sixseven` is clicked.

---

## 3. Verification & Testing
- Automated unit tests in `tests/fx.test.js` verifying `triggerSixSevenAnimation` export, DOM injection, and screen shake.
- Automated unit tests in `tests/action-bar-pause.test.js` verifying ☕ labels, enlarged font-sizes, and pause overlay resilience.
- Run complete test suite (`npm test`) - all tests passing.
- Version bump to `1.8.0` in `version.json`, `sw.js` (cache `sv1845-dj-v1.8.0`), and `js/app.js`.
