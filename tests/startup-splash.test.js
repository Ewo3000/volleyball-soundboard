import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('startup splash markup exists in index.html with all branding elements', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="startup-splash"/);
  assert.match(html, /class="splash-badge"/);
  assert.match(html, /src="assets\/logo\.jpg"/);
  assert.match(html, /SV 1845 ESSLINGEN/);
  assert.match(html, /VOLLEYBALL DJ/);
  assert.match(html, /Ready for Matchday/);
  assert.match(html, /class="splash-soundwave"/);
  assert.match(html, /class="splash-skip-hint"/);
});

test('startup splash CSS styling and keyframes are defined', () => {
  const css = fs.readFileSync('css/app.css', 'utf8');
  assert.match(css, /#startup-splash[\s\S]*?position:\s*fixed/);
  assert.match(css, /#startup-splash[\s\S]*?z-index:\s*10000/);
  assert.match(css, /\.splash-fade-out[\s\S]*?opacity:\s*0/);
  assert.match(css, /@keyframes splash-pop/);
  assert.match(css, /@keyframes splash-wave/);
  assert.match(css, /@keyframes sw-dance/);
});
