import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const HTML_PATH = path.join(rootDir, 'index.html');
const CSS_PATH = path.join(rootDir, 'css/app.css');
const SW_PATH = path.join(rootDir, 'sw.js');

test('Theming Engine: Theme constants and utility validation in js/theme.js', async () => {
  const { THEMES, THEME_STORAGE_KEY, THEME_COLORS, isValidTheme } = await import('../js/theme.js');

  assert.equal(THEMES.CLASSIC, 'classic');
  assert.equal(THEMES.M3_EXPRESSIVE, 'm3-expressive');
  assert.equal(THEME_STORAGE_KEY, 'sv1845_theme');
  assert.equal(THEME_COLORS.classic, '#0B0F17');
  assert.equal(THEME_COLORS['m3-expressive'], '#0A0E17');

  assert.equal(isValidTheme('classic'), true);
  assert.equal(isValidTheme('m3-expressive'), true);
  assert.equal(isValidTheme('dark'), false);
  assert.equal(isValidTheme(''), false);
  assert.equal(isValidTheme(null), false);
});

test('Theming Engine: setTheme, toggleTheme, and localStorage lifecycle', async () => {
  const { setTheme, toggleTheme, getCurrentTheme, THEMES, THEME_STORAGE_KEY } = await import('../js/theme.js');

  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };

  const docAttrs = new Map();
  const mockDocElement = {
    setAttribute: (key, val) => docAttrs.set(key, String(val)),
    getAttribute: (key) => docAttrs.get(key) || null
  };

  const metaAttrs = new Map();
  const mockMeta = {
    setAttribute: (key, val) => metaAttrs.set(key, String(val)),
    getAttribute: (key) => metaAttrs.get(key) || null
  };

  const btnAttrs = new Map();
  const mockToggleBtn = {
    setAttribute: (key, val) => btnAttrs.set(key, String(val)),
    getAttribute: (key) => btnAttrs.get(key) || null
  };

  const origWindow = globalThis.window;
  const origDoc = globalThis.document;

  globalThis.window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true
  };

  globalThis.document = {
    documentElement: mockDocElement,
    querySelector: (selector) => {
      if (selector === 'meta[name="theme-color"]') return mockMeta;
      return null;
    },
    getElementById: (id) => {
      if (id === 'btn-theme-toggle') return mockToggleBtn;
      return null;
    }
  };

  try {
    // 1. Initial state defaults to classic
    assert.equal(getCurrentTheme(), 'classic');

    // 2. Set M3-expressive
    const appliedM3 = setTheme(THEMES.M3_EXPRESSIVE);
    assert.equal(appliedM3, 'm3-expressive');
    assert.equal(mockLocalStorage.getItem(THEME_STORAGE_KEY), 'm3-expressive');
    assert.equal(mockDocElement.getAttribute('data-theme'), 'm3-expressive');
    assert.equal(metaAttrs.get('content'), '#0A0E17');
    assert.equal(btnAttrs.get('aria-pressed'), 'true');
    assert.ok(btnAttrs.get('aria-label').includes('Material 3 Expressive'));

    // 3. Toggle back to classic
    const toggledClassic = toggleTheme();
    assert.equal(toggledClassic, 'classic');
    assert.equal(mockLocalStorage.getItem(THEME_STORAGE_KEY), 'classic');
    assert.equal(mockDocElement.getAttribute('data-theme'), 'classic');
    assert.equal(metaAttrs.get('content'), '#0B0F17');
    assert.equal(btnAttrs.get('aria-pressed'), 'false');
    assert.ok(btnAttrs.get('aria-label').includes('Klassisch'));

    // 4. Toggle back to M3
    const toggledM3 = toggleTheme();
    assert.equal(toggledM3, 'm3-expressive');
    assert.equal(mockDocElement.getAttribute('data-theme'), 'm3-expressive');

    // 5. Invalid theme input falls back to classic safely
    const fallback = setTheme('invalid-theme-test');
    assert.equal(fallback, 'classic');
    assert.equal(mockDocElement.getAttribute('data-theme'), 'classic');
  } finally {
    globalThis.window = origWindow;
    globalThis.document = origDoc;
  }
});

test('index.html contains zero-FOUC head bootstrap script', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // Verify head script checks localStorage before stylesheet
  const scriptIndex = html.indexOf('localStorage.getItem(\'sv1845_theme\')');
  const stylesheetIndex = html.indexOf('rel="stylesheet" href="css/app.css"');

  assert.ok(scriptIndex !== -1, 'index.html must contain inline FOUC prevention script in head');
  assert.ok(stylesheetIndex !== -1, 'index.html must link css/app.css');
  assert.ok(scriptIndex < stylesheetIndex, 'FOUC prevention script must run before stylesheet is loaded');
  assert.ok(html.includes('data-theme'), 'FOUC script must set data-theme attribute');
});

test('index.html contains compact #btn-theme-toggle with proper attributes', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(html.includes('id="btn-theme-toggle"'), 'must contain #btn-theme-toggle');
  assert.ok(html.includes('class="btn-header-tool btn-theme-toggle"'), 'must have btn-header-tool class');

  // Verify button content is strictly the icon 🎨 without dynamic text changing its width
  const match = html.match(/<button[^>]*id="btn-theme-toggle"[^>]*>([\s\S]*?)<\/button>/i);
  assert.ok(match, 'btn-theme-toggle tag must exist');
  const innerContent = match[1].trim();
  assert.equal(innerContent, '🎨', 'btn-theme-toggle must be a compact icon-only button (🎨)');

  // Verify aria-label exists
  assert.ok(match[0].includes('aria-label='), 'btn-theme-toggle must specify aria-label');
  assert.ok(match[0].includes('title='), 'btn-theme-toggle must specify title');
});

test('css/app.css defines Material 3 Expressive tokens, tonal surfaces and squircle/pill radii', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Check selector
  assert.ok(css.includes('[data-theme="m3-expressive"]'), 'CSS must define [data-theme="m3-expressive"] rules');

  // Check Spring Cubic Bezier
  assert.ok(
    css.includes('cubic-bezier(0.34, 1.56, 0.64, 1)'),
    'CSS must specify elastic spring bezier cubic-bezier(0.34, 1.56, 0.64, 1)'
  );

  // Check Squircle / Pill radii
  assert.ok(css.includes('--radius-track: 18px'), 'must specify 18px squircle for track buttons');
  assert.ok(css.includes('--radius-action-btn: 26px'), 'must specify expressive squircle for action buttons');
  assert.ok(css.includes('--radius-container: 22px'), 'must specify squircle container radius');
  assert.ok(css.includes('--radius-pill: 9999px'), 'must specify pill radius');

  // Check Tonal Surface Colors
  assert.ok(css.includes('--surface-container-lowest: #06090F') || css.includes('--surface-container-lowest: #070A10'), 'must define surface-container-lowest');
  assert.ok(css.includes('--surface-container: #152033'), 'must define surface-container');
  assert.ok(css.includes('--surface-container-high: #1E2E4A'), 'must define surface-container-high');
  assert.ok(css.includes('--surface-container-highest: #283C61'), 'must define surface-container-highest');

  // Check Compact Button Styling
  assert.ok(css.includes('.btn-theme-toggle'), 'CSS must style .btn-theme-toggle');
  assert.ok(css.includes('touch-action: manipulation'), 'btn-theme-toggle must have touch-action: manipulation');
});

test('css/app.css hardware-accelerated transitions: strictly transform and background-color', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Find the M3 hardware acceleration rule block
  const match = css.match(/transition-property:\s*transform,\s*background-color;/);
  assert.ok(
    match,
    'M3 Expressive must restrict active transitions strictly to transform and background-color for GPU acceleration'
  );

  // Check scale transform on active
  assert.ok(css.includes('transform: var(--tap-scale)'), 'must apply tap scale on active');
  assert.ok(css.includes('transform: var(--tap-scale-large)'), 'must apply tap scale on large action buttons');
  assert.ok(css.includes('will-change: transform'), 'must promote active buttons with will-change: transform');
});

test('Strict Offline Autonomy: Zero external CDN or Google Fonts imports in css/app.css', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // No remote URLs in CSS
  assert.ok(!css.includes('@import url('), 'Must not import external stylesheets or web fonts');
  assert.ok(!css.includes('fonts.googleapis.com'), 'Must not link to Google Fonts CDN');
  assert.ok(!css.includes('cdnjs.cloudflare.com'), 'Must not link to external icon CDNs');
  assert.ok(!css.includes('unpkg.com'), 'Must not link to unpkg CDN');
  assert.ok(!css.includes('http://'), 'Must not contain http external links in CSS');
  assert.ok(!css.includes('https://'), 'Must not contain https external links in CSS');
});

test('sw.js invalidates cache version and includes js/theme.js in APP_SHELL_ASSETS', () => {
  const sw = fs.readFileSync(SW_PATH, 'utf8');

  // Verify version incremented to 1.14.0
  assert.ok(sw.includes('sv1845-dj-v1.14.0'), 'sw.js cache version must be incremented to sv1845-dj-v1.14.0');

  // Verify js/theme.js is cached
  assert.ok(sw.includes('js/theme.js'), 'sw.js must cache js/theme.js for 100% offline capability');
  assert.ok(fs.existsSync(path.join(rootDir, 'js/theme.js')), 'js/theme.js must exist on disk');
});
