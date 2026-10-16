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
