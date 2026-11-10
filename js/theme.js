/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Non-destructive Theming Engine (js/theme.js)
 * Supports 'classic' (100% legacy look) and 'm3-expressive' (Material 3 Expressive)
 */

export const THEMES = {
  CLASSIC: 'classic',
  M3_EXPRESSIVE: 'm3-expressive'
};

export const THEME_STORAGE_KEY = 'sv1845_theme';

export const THEME_COLORS = {
  classic: '#0B0F17',
  'm3-expressive': '#0A0E17'
};

/**
 * Checks whether the given string is a valid supported theme name.
 * @param {string} theme
 * @returns {boolean}
 */
export function isValidTheme(theme) {
  return theme === THEMES.CLASSIC || theme === THEMES.M3_EXPRESSIVE;
}

/**
 * Retrieves the stored theme from localStorage with safe fallback to classic.
 * @returns {string}
 */
export function getStoredTheme() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return THEMES.CLASSIC;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : THEMES.CLASSIC;
  } catch (err) {
    console.warn('Could not read theme from localStorage:', err);
    return THEMES.CLASSIC;
  }
}

/**
 * Gets the current active theme from documentElement or stored preference.
 * @returns {string}
 */
export function getCurrentTheme() {
  if (typeof document !== 'undefined' && document.documentElement) {
    const attr = document.documentElement.getAttribute('data-theme');
    if (isValidTheme(attr)) {
      return attr;
    }
  }
  return getStoredTheme();
}

/**
 * Applies the specified theme to the DOM, updates localStorage, and notifies listeners.
 * @param {string} themeName
 * @returns {string} The applied theme name
 */
export function setTheme(themeName) {
  const normalizedTheme = isValidTheme(themeName) ? themeName : THEMES.CLASSIC;

  // 1. Persist to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
    } catch (err) {
      console.warn('Could not save theme to localStorage:', err);
    }
  }

  // 2. Update DOM documentElement data-theme attribute
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', normalizedTheme);

    // Update meta theme-color for tablet & mobile PWA status bars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = THEME_COLORS[normalizedTheme] || THEME_COLORS.classic;
      metaThemeColor.setAttribute('content', color);
    }

    // Update UI toggle button state and aria attributes
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      const isM3 = normalizedTheme === THEMES.M3_EXPRESSIVE;
      const themeLabel = isM3 ? 'Material 3 Expressive' : 'Klassisch';
      toggleBtn.setAttribute('aria-label', `Theme wechseln (Aktuell: ${themeLabel})`);
      toggleBtn.setAttribute('title', `Theme wechseln (Aktuell: ${themeLabel})`);
      toggleBtn.setAttribute('data-theme', normalizedTheme);
      toggleBtn.setAttribute('aria-pressed', isM3 ? 'true' : 'false');
    }
  }

  // 3. Dispatch custom themechange event
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: normalizedTheme }
      }));
    } catch (err) {
      // Ignore if CustomEvent is not available
    }
  }

  return normalizedTheme;
}

/**
 * Toggles between 'classic' and 'm3-expressive' themes.
 * @returns {string} The new theme name
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  const nextTheme = current === THEMES.M3_EXPRESSIVE ? THEMES.CLASSIC : THEMES.M3_EXPRESSIVE;
  return setTheme(nextTheme);
}

/**
 * Initializes the theming engine on app startup.
 * @returns {string} The active theme name
 */
export function initTheme() {
  const activeTheme = getStoredTheme();
  return setTheme(activeTheme);
}
