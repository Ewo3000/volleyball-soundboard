# Specification: Android Fullscreen & Header Scrubber Popup

**Date:** 2026-10-16  
**Status:** Approved  
**Target Version:** 1.11.0  
**Repository:** SV 1845 Esslingen - Volleyball DJ Soundboard  

---

## 1. Overview & Objectives

This specification addresses two key requirements:
1. **Guaranteed Fullscreen on Android**:
   - Modern Android Chrome and WebAPK instances often require `"display_override": ["fullscreen", "standalone"]` in the Web App Manifest.
   - Additionally, mobile browsers strictly require a user gesture to enter true immersive fullscreen (`element.requestFullscreen()`). Hooking the first touch gesture (such as tapping the startup splash animation or first interaction on `#app`) guarantees immediate transition into fullscreen mode on Android and mobile tablets.
2. **Interactive Scrubber Popup on "Aktuell läuft" Click**:
   - Clicking `#header-now-playing` opens a modal popup dialog (`#scrubber-modal`) displaying the currently playing track.
   - Includes live timestamps (`current / duration`), a touch-friendly scrubber progress bar/slider, and quick jump buttons (`⏪ -5s` and `+5s ⏩`) to seek forward and backward.
   - Closes automatically when the track stops or ends, or manually via close button (`✕`), backdrop click, or Escape key.

---

## 2. Architecture & Components

### 2.1 Manifest Update (`manifest.webmanifest`)
- Add `"display_override": ["fullscreen", "standalone"]` to `manifest.webmanifest`.
- Keep `"display": "fullscreen"`.

### 2.2 First-Touch Fullscreen Trigger (`js/app.js`)
- In `initStartupSplash()` and `setupEventListeners()`:
  - Add a one-time touch/pointer gesture handler:
    ```javascript
    function requestAutoFullscreen() {
      if (typeof document === 'undefined') return;
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    }
    ```
  - Triggered on dismissing the startup splash (`dismissStartupSplash()`) and as a one-time `pointerdown` listener on `#app`.

### 2.3 AudioEngine Seeking Capabilities (`js/audio-engine.js`)
- Extend `AudioEngine` class with:
  - `getCurrentTime()`: returns `this.currentAudioElement ? this.currentAudioElement.currentTime : 0`.
  - `getDuration()`: returns `this.currentAudioElement && !isNaN(this.currentAudioElement.duration) ? this.currentAudioElement.duration : 0`.
  - `seek(seconds)`:
    ```javascript
    seek(seconds) {
      if (!this.currentAudioElement) return;
      const duration = this.getDuration();
      const targetTime = duration > 0 ? Math.max(0, Math.min(seconds, duration)) : Math.max(0, seconds);
      try {
        this.currentAudioElement.currentTime = targetTime;
      } catch (err) {
        console.warn('Seeking failed:', err);
      }
    }
    ```
  - `seekRelative(deltaSeconds)`:
    ```javascript
    seekRelative(deltaSeconds) {
      this.seek(this.getCurrentTime() + deltaSeconds);
    }
    ```

### 2.4 Header Now-Playing Interactivity (`index.html` & `css/app.css`)
- In `index.html`:
  - Enhance `#header-now-playing`:
    - Add `role="button"`, `tabindex="0"`, `title="Klicken zum Spulen"`, `aria-haspopup="dialog"`.
- In `css/app.css`:
  - Style `.header-now-playing`: `cursor: pointer; user-select: none; transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;`.
  - On hover/focus: `transform: scale(1.02); background: rgba(225, 29, 72, 0.2); box-shadow: 0 0 18px rgba(225, 29, 72, 0.35);`.
  - On active: `transform: scale(0.98);`.

### 2.5 Scrubber Modal Popup (`index.html` & `css/app.css`)
- **HTML Markup** (inserted before closing `</body>` or alongside overlays in `index.html`):
  ```html
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
- **CSS Styling**:
  - Fixed overlay (`position: fixed; inset: 0; z-index: 5000; display: flex; align-items: center; justify-content: center;`).
  - Backdrop: `background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);`.
  - Card: Dark slate glass with flame red border (`background: rgba(15, 23, 42, 0.95); border: 2px solid var(--flame-red); border-radius: var(--radius-lg); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(225, 29, 72, 0.3); width: 90%; max-width: 440px; padding: 20px;`).
  - Slider: Large, touch-friendly thumb with flame red track and fill.
  - Buttons: Styled matching the DJ soundboard theme with clear tactile feedback.

### 2.6 Scrubber Modal Controller (`js/app.js`)
- Export functions:
  - `openScrubberModal()`: opens modal, populates current track title, starts live update timer.
  - `closeScrubberModal()`: closes modal, clears timer.
  - `formatTime(seconds)`: formats seconds into `M:SS` string (e.g. `125` -> `2:05`).
- Event Listeners:
  - Click on `#header-now-playing` calls `openScrubberModal()`.
  - Click on `#btn-close-scrubber` or `#scrubber-backdrop` calls `closeScrubberModal()`.
  - Keydown `Escape` closes modal.
  - While modal is open, a 100ms interval updates `#scrubber-slider` and `#scrubber-time-current`.
  - When user interacts with slider (`input` event), live seeking is throttled or applied, and interval pauses updating the slider so the thumb doesn't jump under the user's finger.
  - Click on `#btn-scrub-back` calls `audioEngine.seekRelative(-5)`.
  - Click on `#btn-scrub-fwd` calls `audioEngine.seekRelative(5)`.
  - `audioEngine.onTrackStop` and `audioEngine.onTrackEnd` call `closeScrubberModal()`.

---

## 3. Versioning & Cache Management

- Version bumped to **1.11.0** across:
  - `version.json`: `"version": "1.11.0"`
  - `sw.js`: cache name `sv1845-dj-v1.11.0`
  - `js/app.js`: `APP_VERSION = '1.11.0'`

---

## 4. Verification & Testing

- Automated tests in `tests/scrubber-popup.test.js`:
  1. `manifest.webmanifest` contains `"display_override": ["fullscreen", "standalone"]`.
  2. `AudioEngine` methods: `getCurrentTime()`, `getDuration()`, `seek()`, `seekRelative()`.
  3. Markup checks: `#scrubber-modal`, `#scrubber-slider`, `#btn-scrub-back`, `#btn-scrub-fwd`, `#scrubber-backdrop`.
  4. Scrubber controller lifecycle: `openScrubberModal()`, `closeScrubberModal()`, `formatTime()`.
  5. Interactive seeking: slider input updates time, -5s/+5s buttons adjust position.
  6. Auto-close when track stops/ends.
- Full test suite: all existing 115 tests + new tests pass cleanly with `npm test`.
