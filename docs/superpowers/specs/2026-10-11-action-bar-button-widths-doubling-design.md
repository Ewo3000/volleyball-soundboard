# SV 1845 Esslingen – Volleyball DJ Soundboard
## Design Specification: Action Bar Button Widths Doubling & Scaling (v1.7.0)

**Date:** 2026-10-11  
**Status:** Approved by User  
**Target Version:** 1.7.0  

---

## 1. Overview & Goal

The user requested specific width adjustments in the quick actions footer bar (`#quick-actions-bar`):
1. **Doubled Width for Timeout, Walk-On, and Pause 1–4**:
   - The stacked Timeout and Walk-On buttons (2×1 layout) double in width.
   - The Pause 1–4 buttons (2×2 grid layout) double in individual width and overall grid block width.
2. **+50% Width Increase for Remaining Action Buttons**:
   - The 5 game action buttons (`6 / 7`, `Ass (Eigenes Team)`, `Block (Eigenes Team)`, `Eigene Punkte (Zufall)`, and `Gegnerpunkte (Zufall)`) expand in width by 50%.
3. **STOP Button Unchanged**:
   - The STOP button retains its existing prominent dimensions and does not expand further.
4. **Responsive Fluidity**:
   - All buttons continue to adapt fluidly across tablet landscape and desktop displays via CSS `clamp()` and flexbox, ensuring no buttons or texts overflow or require horizontal scrolling.

---

## 2. Component Design & Changes

### 2.1 Timeout & Walk-On (`.stacked-group`, `.stacked-btn`)
- **Current**:
  ```css
  .stacked-btn {
    height: clamp(50px, 6.5vh, 66px);
    flex: 1 1 auto;
    width: 100%;
    min-width: clamp(60px, 7vw, 100px);
  }
  ```
- **New (v1.7.0)**:
  ```css
  .stacked-btn {
    height: clamp(50px, 6.5vh, 66px);
    flex: 1 1 auto;
    width: 100%;
    min-width: clamp(120px, 14vw, 200px); /* Doubled min-width */
  }
  ```
- Both buttons remain stacked vertically (2 rows, 1 column), each taking half the bar height.

### 2.2 Pause 1–4 Slots (`.pause-slots-group`, `.pause-slot-btn`)
- **Current**:
  ```css
  .pause-slots-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: clamp(2px, 0.3vw, 5px);
    flex-shrink: 1;
    min-width: 0;
    align-self: stretch;
  }
  .pause-slot-btn {
    height: clamp(50px, 6.5vh, 66px);
    min-width: clamp(44px, 5vw, 72px);
    ...
  }
  ```
- **New (v1.7.0)**:
  ```css
  .pause-slot-btn {
    height: clamp(50px, 6.5vh, 66px);
    min-width: clamp(88px, 10vw, 144px); /* Doubled min-width */
    padding: 2px clamp(4px, 0.5vw, 10px);
    font-size: clamp(0.70rem, 0.88vw, 0.92rem);
    flex: unset;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  ```
- Total min-width of the 2×2 grid effectively doubles from ~`88px` to ~`176px–290px`.

### 2.3 Remaining Action Buttons (`.quick-btn`)
- The 5 game action buttons:
  - `btn-sixseven` (`6 / 7`)
  - `btn-ace` (`🏐 Ass (Eigenes Team)`)
  - `btn-block` (`🛡️ Block (Eigenes Team)`)
  - `btn-random-own` (`Eigene Punkte (Zufall)`)
  - `btn-random-opponent` (`Gegnerpunkte (Zufall)`)
- **Current**:
  ```css
  .quick-btn {
    ...
    flex: 1.5 1 0px;
    min-width: 0;
  }
  ```
- **New (v1.7.0)**:
  ```css
  .quick-btn {
    ...
    flex: 2.25 1 0px; /* +50% increase from 1.5 */
    min-width: clamp(75px, 8.5vw, 120px);
  }
  ```
- Overridden specifically by `.stacked-btn` (`flex: 1 1 auto`) and `.pause-slot-btn` (`flex: unset`), and `.btn-stop` (`flex: 0 0 auto`).

### 2.4 STOP Button (`.btn-stop`)
- Preserves its current dimensions:
  ```css
  .btn-stop,
  .quick-btn[data-action="stop"] {
    min-width: clamp(80px, 9vw, 130px);
    flex: 0 0 auto;
    height: clamp(108px, 14vh, 140px);
  }
  ```

---

## 3. Testing & Verification Plan

1. **Automated Unit & Layout Tests**:
   - Update `tests/action-bar-pause.test.js`:
     - Assert `.stacked-btn` has `min-width: clamp(120px`.
     - Assert `.pause-slot-btn` has `min-width: clamp(88px`.
     - Assert `.quick-btn` has `flex: 2.25`.
   - Run complete test suite (`npm test`) and ensure all 91+ tests pass.
2. **PWA Version Bump**:
   - Bump version to `1.7.0` in:
     - `version.json`
     - `sw.js` (cache `sv1845-dj-v1.7.0`)
     - `js/app.js` (`APP_VERSION = '1.7.0'`)
3. **Responsive Verification**:
   - Ensure action bar buttons fit cleanly and gracefully on both tablet landscape and large screens without overlapping or horizontal clipping.
