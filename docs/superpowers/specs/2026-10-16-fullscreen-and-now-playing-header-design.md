# Specification: Fullscreen Startup & Header Now-Playing Indicator

**Date:** 2026-10-16  
**Status:** Approved  
**Target Version:** 1.10.0  
**Repository:** SV 1845 Esslingen - Volleyball DJ Soundboard  

---

## 1. Overview & Objectives

This specification defines two enhancements to the SV 1845 Esslingen Volleyball DJ Soundboard:
1. **PWA Fullscreen Mode on Startup**: Configured via the Web App Manifest so installed instances (iPad, tablets, mobile, and desktop PWA) launch in immersive full-screen mode without browser chrome or URL bars. In standard browser tabs, fullscreen remains explicitly user-controlled via the existing Fullscreen button, adhering to browser security constraints.
2. **Header Now-Playing Indicator with Equalizer Bars**: An animated display located in the top header banner (`.header-banner`) between the brand title group (`.brand-group`) and the file status actions (`.banner-actions`). When an audio track is active, it displays animated soundwave/equalizer bars in Esslingen red/white alongside the cleaned song title. When no track is playing (initial state, stopped, or ended), the container is completely hidden (`display: none`), leaving the center space clean and empty.

---

## 2. Architecture & Components

### 2.1 PWA Manifest (`manifest.webmanifest`)
- **Setting**: `"display": "fullscreen"`
- **Behavior**:
  - When installed to home screen / app launcher, the browser launches the app in fullscreen mode.
  - In normal browser tabs, standard window controls remain unchanged; the manual fullscreen toggle button (`#btn-toggle-fullscreen`) in `#header-controls` remains available.

### 2.2 Header HTML Markup (`index.html`)
- Inside `<div class="header-banner" id="header-banner">`, positioned between `<div class="brand-group">` and `<div class="banner-actions">`:
  ```html
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

### 2.3 CSS Styling & Animations (`css/app.css`)
- **Layout & Badge**:
  - `.header-now-playing`: `display: none;` default; when active (`display: flex; align-items: center; gap: 10px; max-width: 380px;`).
  - Styling: subtle dark glass container `background: rgba(225, 29, 72, 0.12); border: 1px solid rgba(225, 29, 72, 0.35); border-radius: 9999px; padding: 4px 12px; box-shadow: 0 0 12px rgba(225, 29, 72, 0.2);`.
- **Equalizer Bars**:
  - `.now-playing-bars`: `display: flex; align-items: flex-end; gap: 3px; height: 16px; width: 20px;`.
  - `.np-bar`: `width: 3px; border-radius: 2px; background: #e11d48; animation: np-equalizer-dance 0.8s ease-in-out infinite alternate;`.
  - Staggered delays:
    - `.np-bar-1`: `animation-delay: 0.0s; height: 35%;`
    - `.np-bar-2`: `animation-delay: 0.25s; height: 85%;`
    - `.np-bar-3`: `animation-delay: 0.15s; height: 55%;`
    - `.np-bar-4`: `animation-delay: 0.4s; height: 95%;`
- **Keyframes**:
  ```css
  @keyframes np-equalizer-dance {
    0% { height: 25%; }
    50% { height: 100%; }
    100% { height: 40%; }
  }
  ```
- **Text & Truncation**:
  - `.now-playing-info`: `display: flex; flex-direction: column; overflow: hidden; min-width: 0; line-height: 1.15;`.
  - `.now-playing-label`: `font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255, 255, 255, 0.6); font-weight: 700;`.
  - `.now-playing-title`: `font-size: 0.85rem; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;`.
- **Accessibility & Reduced Motion**:
  - `@media (prefers-reduced-motion: reduce)`: `.np-bar { animation: none !important; height: 60% !important; }`.

### 2.4 JavaScript Lifecycle (`js/app.js`)
- Helper function `updateNowPlayingHeader(track)`:
  - If `track` is non-null:
    - Sets `#now-playing-title` text content to `track.cleanTitle || cleanTrackTitle(track.name)`.
    - Sets `#header-now-playing` to `display: flex` (or adds `.active` class with `display: flex`).
  - If `track` is null / undefined:
    - Sets `#header-now-playing` to `display: none` (or removes `.active` class).
    - Clears `#now-playing-title` text content.
- Hook into existing lifecycle:
  - Called from `updatePlayingUI(trackId)`: retrieves track from `tracks.get(trackId)` or `audioEngine.currentTrack`.
  - Called in `audioEngine.onTrackStart`: passes starting track.
  - Called in `audioEngine.onTrackStop` & `audioEngine.onTrackEnd`: called with `null`.

---

## 3. Versioning & Cache Management

- Version bumped to **1.10.0** across:
  - `version.json`: `"version": "1.10.0"`
  - `sw.js`: cache name `sv1845-dj-v1.10.0`
  - `js/app.js`: `APP_VERSION = '1.10.0'`

---

## 4. Verification & Testing

- Automated tests in `tests/header-now-playing.test.js`:
  1. HTML presence of `#header-now-playing`, `.now-playing-bars`, 4 `.np-bar` elements, and `#now-playing-title`.
  2. Initial hidden state (`style="display: none;"`).
  3. Manifest validation: `manifest.webmanifest` contains `"display": "fullscreen"`.
  4. CSS validation: keyframe animation `@keyframes np-equalizer-dance` and reduced-motion rules defined.
  5. UI state transitions:
     - Playing a track reveals `#header-now-playing` and populates `#now-playing-title`.
     - Stopping or ending playback hides `#header-now-playing` and clears `#now-playing-title`.
- Full regression suite: all existing 108 tests plus new tests pass cleanly with `npm test`.
