/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Non-destructive Theming Engine (js/theme.js)
 * Supports 'classic' (100% legacy look), 'm3-expressive' (Material 3 Expressive),
 * and 'light-hall' (Helle Halle / High Contrast daylight mode).
 */

export const THEMES = {
  CLASSIC: 'classic',
  M3_EXPRESSIVE: 'm3-expressive',
  LIGHT_HALL: 'light-hall'
};

export const THEME_ORDER = [
  THEMES.CLASSIC,
  THEMES.M3_EXPRESSIVE,
  THEMES.LIGHT_HALL
];

export const THEME_STORAGE_KEY = 'sv1845_theme';

export const THEME_COLORS = {
  classic: '#0B0F17',
  'm3-expressive': '#0A0E17',
  'light-hall': '#F1F5F9'
};

export const THEME_LABELS = {
  classic: 'Klassisch',
  'm3-expressive': 'Material 3 Expressive',
  'light-hall': 'Helle Halle (Kontrast)'
};

/**
 * Checks whether the given string is a valid supported theme name.
 * @param {string} theme
 * @returns {boolean}
 */
export function isValidTheme(theme) {
  return THEME_ORDER.includes(theme);
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

    const isLight = normalizedTheme === THEMES.LIGHT_HALL;

    // Update meta theme-color for tablet & mobile PWA status bars
    const metaThemeColor = document.querySelector?.('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = THEME_COLORS[normalizedTheme] || THEME_COLORS.classic;
      metaThemeColor.setAttribute('content', color);
    }

    // Update meta color-scheme so scrollbars and native controls match
    const metaColorScheme = document.querySelector?.('meta[name="color-scheme"]');
    if (metaColorScheme) {
      metaColorScheme.setAttribute('content', isLight ? 'light' : 'dark');
    }

    const themeLabel = THEME_LABELS[normalizedTheme] || THEME_LABELS.classic;

    // Update compact toggle button state and aria attributes
    const toggleBtn = document.getElementById?.('btn-theme-toggle');
    if (toggleBtn) {
      const isNonDefault = normalizedTheme !== THEMES.CLASSIC;
      toggleBtn.setAttribute('aria-label', `Theme wechseln (Aktuell: ${themeLabel})`);
      toggleBtn.setAttribute('title', `Theme wechseln (Aktuell: ${themeLabel})`);
      toggleBtn.setAttribute('data-theme', normalizedTheme);
      toggleBtn.setAttribute('aria-pressed', isNonDefault ? 'true' : 'false');
    }

    // Update current theme text indicator in Settings modal
    const themeDesc = document.getElementById?.('settings-theme-desc');
    if (themeDesc) {
      themeDesc.textContent = `Aktiv: ${themeLabel}`;
    }

    // Update direct theme choice buttons in Settings modal
    const choiceBtns = document.querySelectorAll?.('.theme-choice-btn[data-theme-choice]');
    choiceBtns?.forEach?.((btn) => {
      const choice = btn.getAttribute?.('data-theme-choice');
      const isSelected = choice === normalizedTheme;
      btn.classList?.toggle?.('is-active', isSelected);
      btn.setAttribute?.('aria-checked', String(isSelected));
    });
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
 * Cycles through 'classic' -> 'm3-expressive' -> 'light-hall' -> 'classic'.
 * @returns {string} The new theme name
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  const idx = THEME_ORDER.indexOf(current);
  const nextIndex = idx === -1 ? 1 : (idx + 1) % THEME_ORDER.length;
  return setTheme(THEME_ORDER[nextIndex]);
}

/**
 * Initializes the theming engine on app startup.
 * @returns {string} The active theme name
 */
export function initTheme() {
  const activeTheme = getStoredTheme();
  return setTheme(activeTheme);
}
