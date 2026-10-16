# SV 1845 Esslingen – Volleyball DJ Soundboard
## Design Specification: Matchday Startup Animation (v1.9.0)

**Date:** 2026-10-16  
**Status:** Approved by User  
**Target Version:** 1.9.0  

---

## 1. Overview & Purpose

When the PWA or browser application is launched, a cinematic and branded startup splash animation (`#startup-splash`) introduces the SV 1845 Esslingen Volleyball DJ console. It features the club's official logo, dynamic Esslingen-blue pulse effects, audio soundwave bars, and team typography ("Ready for Matchday"), transitioning smoothly into the main soundboard interface.

To support live volleyball match environments where an operator needs immediate access, the animation:
1. Runs for a concise ~1.8 seconds.
2. Supports **Click/Tap to Skip** to immediately dismiss the splashscreen with zero delay.

---

## 2. Visual Design & Components

### 2.1 DOM Hierarchy (`index.html`)
Directly inside `<div id="app" class="app-container">`:
```html
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

### 2.2 Animation Phases & Keyframes (`css/app.css`)
- **Container (`#startup-splash`)**:
  - `position: fixed; inset: 0; z-index: 10000;`
  - Background: `radial-gradient(circle at center, #101c38 0%, #0B0F17 80%)`
  - Center alignment using flexbox.
  - Smooth fade-out: `.splash-fade-out { opacity: 0; transform: scale(1.06); transition: opacity 0.35s ease-out, transform 0.35s ease-out; pointer-events: none; }`
- **Logo Badge (`.splash-badge`)**:
  - Border radius 50%, border `3px solid var(--accent-blue-light)` with multi-layer box-shadow in `#1B75BC`.
  - Pop animation: `@keyframes splash-pop` (scales from `0.2` to `1.08` with overshoot to `1.0`).
- **Shockwave (`.splash-shockwave`)**:
  - `@keyframes splash-wave`: Expands from `scale(0.5)` to `scale(2.8)` with fading opacity.
- **Soundwave Equalizer (`.splash-soundwave`)**:
  - 5 animated bars (`.sw-bar`) with varying heights and staggered `@keyframes sw-dance` delays.
- **Typography (`.splash-typography`)**:
  - Fade-in and slide-up: `@keyframes splash-text-reveal`.
  - Glow effects on text.

### 2.3 JavaScript Lifecycle & Dismissal (`js/app.js`)
- Function `initStartupSplash()`:
  - Invoked early in `initApp()`.
  - Sets up click/touch listener on `#startup-splash` for instantaneous dismissal:
    ```javascript
    export function dismissStartupSplash() {
      const splash = document.getElementById('startup-splash');
      if (!splash || splash.classList.contains('dismissed')) return;
      splash.classList.add('splash-fade-out', 'dismissed');
      splash.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        splash.style.display = 'none';
      }, 350);
    }
    ```
  - Default timer: Automatically calls `dismissStartupSplash()` after 1600ms.

---

## 3. Testing & Verification

1. **Unit & DOM Tests (`tests/startup-splash.test.js`)**:
   - Verify `#startup-splash` and child elements exist in `index.html`.
   - Verify CSS definitions for `#startup-splash`, `.splash-fade-out`, `.splash-badge`, and keyframes in `css/app.css`.
   - Verify `dismissStartupSplash` function behavior (adds `.splash-fade-out`, sets `aria-hidden="true"`).
2. **Regression & Full Suite**:
   - Run `npm test` and ensure all 102+ tests pass with zero regressions.
3. **PWA Version Bump**:
   - Bump version to `1.9.0` in `version.json`, `sw.js` (cache `sv1845-dj-v1.9.0`), and `js/app.js`.
