import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Fullscreen Startup Configuration', () => {
  it('manifest.webmanifest specifies display: fullscreen', () => {
    const manifestPath = path.join(rootDir, 'manifest.webmanifest');
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(content.display, 'fullscreen', 'display property must be fullscreen');
  });
});

describe('Header Now-Playing Markup and Styles', () => {
  it('index.html contains #header-now-playing inside #header-banner between brand and actions', () => {
    const htmlPath = path.join(rootDir, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.match(html, /id="header-now-playing"/, 'Must contain #header-now-playing');
    assert.match(html, /class="now-playing-bars"/, 'Must contain .now-playing-bars');
    assert.match(html, /class="np-bar np-bar-1"/, 'Must contain np-bar-1');
    assert.match(html, /class="np-bar np-bar-4"/, 'Must contain np-bar-4');
    assert.match(html, /id="now-playing-title"/, 'Must contain #now-playing-title');
    assert.match(html, /style="display:\s*none;?"/, 'Must be initially hidden with display: none');

    const brandIndex = html.indexOf('class="brand-group"');
    const npIndex = html.indexOf('id="header-now-playing"');
    const actionsIndex = html.indexOf('class="banner-actions"');
    assert.ok(brandIndex < npIndex && npIndex < actionsIndex, '#header-now-playing must be between brand-group and banner-actions');
  });

  it('css/app.css defines equalizer animation and styling for header now-playing', () => {
    const cssPath = path.join(rootDir, 'css/app.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.match(css, /\.header-now-playing/, 'CSS must define .header-now-playing');
    assert.match(css, /@keyframes np-equalizer-dance/, 'CSS must define @keyframes np-equalizer-dance');
    assert.match(css, /\.now-playing-bars/, 'CSS must style .now-playing-bars');
    assert.match(css, /\.np-bar/, 'CSS must style .np-bar');
    assert.match(css, /prefers-reduced-motion/, 'CSS must support prefers-reduced-motion for .np-bar');
  });
});

