import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('manifest.webmanifest exists and has valid PWA fields', () => {
  assert.ok(fs.existsSync('manifest.webmanifest'), 'manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.name, 'SV 1845 Esslingen - Volleyball DJ');
  assert.equal(manifest.short_name, 'SV1845 DJ');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#0B0F17');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
});
