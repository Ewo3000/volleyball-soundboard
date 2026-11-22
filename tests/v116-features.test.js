import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('v1.16.0 StorageEngine: updateTrackMeta & deleteTrack', () => {
  it('MemoryStorageEngine updates metadata and deletes single track cleanly', async () => {
    const { MemoryStorageEngine } = await import('../js/db.js');
    const engine = new MemoryStorageEngine();
    await engine.init();

    await engine.saveTracks([
      { id: 't1', name: 'A.mp3', category: 'sonstiges', pinned: false, playCount: 2 },
      { id: 't2', name: 'B.mp3', category: 'block', pinned: false, playCount: 1 }
    ]);

    await engine.updateTrackMeta('t1', { category: 'ass_angriff', suffix: '_HIT', pinned: true, customGain: 1.25 });
    let tracks = await engine.getAllTracks();
    const t1 = tracks.find((t) => t.id === 't1');
    assert.equal(t1.category, 'ass_angriff');
    assert.equal(t1.suffix, '_HIT');
    assert.equal(t1.pinned, true);
    assert.equal(t1.customGain, 1.25);
    assert.equal(t1.playCount, 2, 'playCount must be preserved');

    await engine.deleteTrack('t2');
    tracks = await engine.getAllTracks();
    assert.equal(tracks.length, 1);
    assert.equal(tracks[0].id, 't1');
  });

  it('IndexedDBStorageEngine.updateTrackMeta and deleteTrack await tx.oncomplete', async () => {
    const { IndexedDBStorageEngine } = await import('../js/db.js');
    const engine = new IndexedDBStorageEngine();

    let putRecord = null;
    let deletedKey = null;

    engine.db = {
      transaction() {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore() {
            return {
              get() {
                const req = { result: { id: 't_idb', name: 'Test.mp3', playCount: 4 }, onsuccess: null, onerror: null };
                setTimeout(() => req.onsuccess?.(), 0);
                return req;
              },
              put(rec) {
                putRecord = rec;
                setTimeout(() => tx.oncomplete?.(), 0);
              },
              delete(key) {
                deletedKey = key;
                setTimeout(() => tx.oncomplete?.(), 0);
              }
            };
          }
        };
        return tx;
      }
    };

    await engine.updateTrackMeta('t_idb', { pinned: true, category: 'sfx', suffix: '_SFX' });
    assert.equal(putRecord.pinned, true);
    assert.equal(putRecord.category, 'sfx');
    assert.equal(putRecord.playCount, 4);

    await engine.deleteTrack('t_idb');
    assert.equal(deletedKey, 't_idb');
  });
});

describe('v1.16.0 File-Loader: effekte/ Subfolder, _SFX Suffix & Pinned Sorting', () => {
  it('detects effekte/ subfolder without _SFX suffix and keeps SFX out of sonstiges columns', async () => {
    const {
      isSfxFolderPath,
      detectCategory,
      parseTrackFromFilename,
      categorizeTracks
    } = await import('../js/file-loader.js');

    assert.equal(isSfxFolderPath('Musik/effekte/Airhorn_Stadion.mp3'), true);
    assert.equal(isSfxFolderPath('Musik\\Effekte\\Monster_Boom.wav'), true);
    assert.equal(isSfxFolderPath('Musik/sfx/Clap.mp3'), true);
    assert.equal(isSfxFolderPath('Musik/Seven_Nation_Army.mp3'), false);

    assert.deepEqual(detectCategory('Tor_Horn.mp3', 'Volleyball/effekte/Tor_Horn.mp3'), {
      category: 'sfx',
      suffix: '_SFX'
    });
    assert.deepEqual(detectCategory('Stadion_Tröte_SFX.mp3'), {
      category: 'sfx',
      suffix: '_SFX'
    });

    const mockFile = { name: 'Sirene.mp3', webkitRelativePath: 'Songs/effekte/Sirene.mp3', type: 'audio/mpeg' };
    const sfxTrack = parseTrackFromFilename(mockFile.name, mockFile);
    assert.equal(sfxTrack.category, 'sfx');
    assert.equal(sfxTrack.cleanTitle, 'Sirene');
    assert.equal(sfxTrack.pinned, false);

    const normalTrack = parseTrackFromFilename('Alpha_Song.mp3');
    const pinnedTrack = parseTrackFromFilename('Zebra_Song.mp3');
    pinnedTrack.pinned = true;

    const map = categorizeTracks([normalTrack, pinnedTrack, sfxTrack]);
    assert.equal(map.get('sfx').length, 1);
    assert.equal(map.get('sonstiges').length, 2);
    assert.equal(map.get('sonstiges')[0].id, pinnedTrack.id, 'Pinned track must sort before unpinned tracks');
  });
});

describe('v1.16.0 AudioEngine: Bluetooth Keep-Alive & Custom One-Shot SFX Overlay', () => {
  it('setBluetoothKeepAlive starts and stops an inaudible 20Hz carrier directly on destination', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    let oscStarted = false;
    let oscStopped = false;
    let oscDisconnected = false;
    let gainValue = null;
    const connectedTargets = [];

    const dest = { id: 'ctx-dest' };
    const masterGain = { id: 'master-gain', gain: { setValueAtTime() {} }, connect() {} };

    engine.audioCtx = {
      currentTime: 0,
      state: 'running',
      destination: dest,
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect(target) { connectedTargets.push(target); },
        start() { oscStarted = true; },
        stop() { oscStopped = true; },
        disconnect() { oscDisconnected = true; }
      }),
      createGain: () => ({
        gain: {
          value: 1,
          setValueAtTime(v) { gainValue = v; }
        },
        connect(target) { connectedTargets.push(target); },
        disconnect() {}
      })
    };
    engine.masterGain = masterGain;

    assert.equal(engine.getBluetoothKeepAlive(), false);
    engine.setBluetoothKeepAlive(true);
    assert.equal(engine.getBluetoothKeepAlive(), true);
    assert.equal(oscStarted, true);
    assert.ok(gainValue > 0 && gainValue < 0.0001, 'Keep-alive gain must be inaudible (~ -90dB)');
    assert.ok(connectedTargets.includes(dest), 'Keep-alive must connect straight to destination');
    assert.ok(!connectedTargets.includes(masterGain), 'Keep-alive must bypass masterGain/analyser');

    engine.setBluetoothKeepAlive(false);
    assert.equal(engine.getBluetoothKeepAlive(), false);
    assert.equal(oscStopped, true);
    assert.equal(oscDisconnected, true);
  });

  it('playOneShotTrack decodes & caches buffer and plays without interrupting currentTrack', async () => {
    const { AudioEngine } = await import('../js/audio-engine.js');
    const engine = new AudioEngine();

    const activeTrack = { id: 'main-song', cleanTitle: 'Main Song' };
    engine.currentTrack = activeTrack;

    let decodeCalls = 0;
    let startedSources = 0;
    const mockBuffer = { duration: 1.2 };

    engine.audioCtx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      resume: () => Promise.resolve(),
      decodeAudioData: async () => {
        decodeCalls++;
        return mockBuffer;
      },
      createBufferSource: () => ({
        buffer: null,
        connect() {},
        disconnect() {},
        start() { startedSources++; }
      }),
      createGain: () => ({
        gain: { value: 1, setValueAtTime() {} },
        connect() {},
        disconnect() {}
      })
    };
    engine.masterGain = engine.audioCtx.createGain();

    const sfxTrack = { id: 'sfx_1', name: 'Horn_SFX.wav', blob: new Uint8Array([1, 2, 3, 4]), customGain: 1.1 };
    const ok1 = await engine.playOneShotTrack(sfxTrack);
    const ok2 = await engine.playOneShotTrack(sfxTrack);

    assert.equal(ok1, true);
    assert.equal(ok2, true);
    assert.equal(decodeCalls, 1, 'Decoded AudioBuffer should be cached across repeated plays');
    assert.equal(startedSources, 2);
    assert.equal(engine.getCurrentTrack(), activeTrack, 'Active music must remain playing');

    engine.clearSfxCache('sfx_1');
    assert.equal(engine._sfxBufferCache.size, 0);
  });
});

describe('v1.16.0 App Controllers: Context Menu, Shortcuts, Backup & Mini Scoreboard', () => {
  it('Song Context Menu pins favorites, changes category, adjusts gain, and deletes single track', async () => {
    const { MemoryStorageEngine, setDefaultStorage } = await import('../js/db.js');
    const memoryDb = new MemoryStorageEngine();
    await memoryDb.init();
    setDefaultStorage(memoryDb);

    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origTracks = app.allTracks.splice(0, app.allTracks.length);

    const t1 = { id: 'ctx_1', name: 'Rock_Song.mp3', cleanTitle: 'Rock Song', category: 'sonstiges', suffix: '', pinned: false, playCount: 0 };
    const t2 = { id: 'ctx_2', name: 'Other.mp3', cleanTitle: 'Other', category: 'sonstiges', suffix: '', pinned: false, playCount: 0 };
    await memoryDb.saveTracks([t1, t2]);
    app.allTracks.push(t1, t2);

    try {
      const btnHtmlBefore = app.createTrackButtonHtml(t1);
      assert.ok(!btnHtmlBefore.includes('is-pinned'));

      const pinnedState = await app.toggleTrackPinned('ctx_1');
      assert.equal(pinnedState, true);
      assert.equal(t1.pinned, true);

      const btnHtmlAfter = app.createTrackButtonHtml(t1);
      assert.ok(btnHtmlAfter.includes('is-pinned'));
      assert.ok(btnHtmlAfter.includes('⭐'));

      await app.changeTrackCategory('ctx_1', 'block');
      assert.equal(t1.category, 'block');
      assert.equal(t1.suffix, '_BLOCK');

      await app.applyContextTrackGain(135, 'ctx_1');
      assert.equal(t1.customGain, 1.35);

      const deleted = await app.deleteSingleTrack('ctx_2', { skipConfirm: true });
      assert.equal(deleted, true);
      assert.equal(app.allTracks.length, 1);
      const stored = await memoryDb.getAllTracks();
      assert.equal(stored.length, 1);
      assert.equal(stored[0].id, 'ctx_1');
    } finally {
      app.allTracks.splice(0, app.allTracks.length, ...origTracks);
    }
  });

  it('handleGlobalKeydown triggers actions and ignores input fields or disabled state', async () => {
    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origStop = app.audioEngine.stop;
    let stopCalls = 0;
    app.audioEngine.stop = () => { stopCalls++; };

    const prevDoc = global.document;
    let activeTag = 'BODY';
    global.document = {
      activeElement: { get tagName() { return activeTag; } },
      getElementById: () => null,
      querySelector: () => null
    };

    try {
      app.applyShortcutsEnabled(true);
      let prevented = false;
      const handled = app.handleGlobalKeydown({ key: ' ', preventDefault() { prevented = true; } });
      assert.equal(handled, true);
      assert.equal(prevented, true);
      assert.equal(stopCalls, 1);

      // Should ignore while typing in search input
      activeTag = 'INPUT';
      const ignoredInInput = app.handleGlobalKeydown({ key: ' ' });
      assert.equal(ignoredInInput, undefined);
      assert.equal(stopCalls, 1);

      // Should adjust volume with ArrowUp/ArrowDown
      activeTag = 'BODY';
      app.applyVolume(80);
      app.handleGlobalKeydown({ key: 'ArrowUp', preventDefault() {} });
      assert.equal(Math.round(app.audioEngine.getMasterVolume() * 100), 85);

      // Should ignore when disabled
      app.applyShortcutsEnabled(false);
      assert.equal(app.handleGlobalKeydown({ key: 'ArrowDown' }), undefined);
      assert.equal(Math.round(app.audioEngine.getMasterVolume() * 100), 85);
    } finally {
      app.applyShortcutsEnabled(true);
      app.audioEngine.stop = origStop;
      global.document = prevDoc;
    }
  });

  it('Backup export and import preserves settings and per-track metadata', async () => {
    const { MemoryStorageEngine, setDefaultStorage } = await import('../js/db.js');
    const memoryDb = new MemoryStorageEngine();
    await memoryDb.init();
    setDefaultStorage(memoryDb);

    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origTracks = app.allTracks.splice(0, app.allTracks.length);

    const track = {
      id: 'bk_1',
      name: 'Hymne.mp3',
      cleanTitle: 'Hymne',
      category: 'walkon',
      suffix: '_WALKON',
      pinned: true,
      customGain: 1.5
    };
    await memoryDb.saveTracks([track]);
    app.allTracks.push(track);

    try {
      app.applyVolume(75);
      app.applyEqPreset('punch');
      app.applyBluetoothKeepAlive(true);

      const jsonStr = app.exportSettingsBackup();
      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.settings.volume, 75);
      assert.equal(parsed.settings.eqPreset, 'punch');
      assert.equal(parsed.settings.btKeepAlive, true);
      assert.equal(parsed.tracksMeta['hymne.mp3'].customGain, 1.5);
      assert.equal(parsed.tracksMeta['hymne.mp3'].pinned, true);

      // Mutate current state, then import backup
      app.applyVolume(40);
      app.applyEqPreset('neutral');
      app.applyBluetoothKeepAlive(false);
      track.pinned = false;
      track.customGain = 1.0;

      const res = await app.importSettingsBackup(jsonStr);
      assert.ok(res.appliedSettings >= 3);
      assert.equal(res.updatedTracks, 1);
      assert.equal(Math.round(app.audioEngine.getMasterVolume() * 100), 75);
      assert.equal(app.audioEngine.getEqPreset(), 'punch');
      assert.equal(app.audioEngine.getBluetoothKeepAlive(), true);
      assert.equal(track.pinned, true);
      assert.equal(track.customGain, 1.5);
    } finally {
      app.applyBluetoothKeepAlive(false);
      app.applyVolume(100);
      app.applyEqPreset('neutral');
      app.allTracks.splice(0, app.allTracks.length, ...origTracks);
    }
  });

  it('Minimalist Scoreboard couples to soundboard buttons, supports mistap correction & Crunch-Time detection', async () => {
    const { MemoryStorageEngine, setDefaultStorage } = await import('../js/db.js');
    const memoryDb = new MemoryStorageEngine();
    await memoryDb.init();
    setDefaultStorage(memoryDb);

    const app = await import(`../js/app.js?t=${Date.now()}`);
    const origTracks = app.allTracks.splice(0, app.allTracks.length);
    const origPlayTrack = app.audioEngine.playTrack;
    const origStop = app.audioEngine.stop;
    const origHardStop = app.audioEngine.hardStop;

    app.audioEngine.playTrack = async () => {};
    app.audioEngine.stop = () => {};
    app.audioEngine.hardStop = () => {};

    try {
      // Crunch-Time pure unit checks (25-pt threshold at 24)
      assert.deepEqual(app.getScoreboardCrunchStatus({ home: 23, guest: 22 }), {
        isCrunch: false,
        label: ''
      });
      assert.deepEqual(app.getScoreboardCrunchStatus({ home: 24, guest: 22 }), {
        isCrunch: true,
        label: 'SATZBALL'
      });
      assert.deepEqual(app.getScoreboardCrunchStatus({ home: 24, guest: 24 }), {
        isCrunch: true,
        label: 'DEUCE'
      });

      // Track category -> scoreboard team mapping
      assert.equal(app.getScoreSideForTrack({ category: 'ass_angriff' }), 'home');
      assert.equal(app.getScoreSideForTrack({ category: 'block' }), 'home');
      assert.equal(app.getScoreSideForTrack({ category: 'sonstiges_2' }), 'home');
      assert.equal(app.getScoreSideForTrack({ category: 'gegner' }), 'guest');
      assert.equal(app.getScoreSideForTrack({ category: 'spass_extras' }), null);
      assert.equal(app.getScoreSideForTrack({ category: 'timeout' }), null);
      assert.equal(app.getScoreSideForTrack({ category: 'pause' }), null);
      assert.equal(app.getScoreSideForTrack({ category: 'sixseven' }), null);

      // Hidden scoreboard ignores button events
      app.resetScoreboard();
      app.setScoreboardVisible(false);
      assert.equal(app.recordButtonScore('home', 1000).action, 'ignored');
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 0 });

      // Enable minimalist scoreboard
      app.setScoreboardVisible(true);
      app.setWarmupMode(false);

      // Pure timing tests: score -> mistap switch within 5s -> dedupe within 5s -> new score >5s
      assert.deepEqual(app.recordButtonScore('home', 1000), { action: 'scored', side: 'home', home: 1, guest: 0 });
      assert.deepEqual(app.recordButtonScore('guest', 3200), {
        action: 'corrected',
        from: 'home',
        to: 'guest',
        home: 0,
        guest: 1
      });
      assert.deepEqual(app.recordButtonScore('guest', 4500), { action: 'deduped', side: 'guest', home: 0, guest: 1 });
      assert.deepEqual(app.recordButtonScore('home', 10000), { action: 'scored', side: 'home', home: 1, guest: 1 });

      // Normal STOP within 2.5s undoes last score; >2.5s keeps it; Hard-Cut within 5s undoes it
      assert.equal(app.revertRecentScoreOnStop(11000, { isHardCut: false }), true);
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 1 });

      assert.deepEqual(app.recordButtonScore('home', 20000), { action: 'scored', side: 'home', home: 1, guest: 1 });
      assert.equal(app.revertRecentScoreOnStop(23000, { isHardCut: false }), false);
      assert.deepEqual(app.scoreboardState, { home: 1, guest: 1 });
      assert.equal(app.revertRecentScoreOnStop(24000, { isHardCut: true }), true);
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 1 });

      // Warm-Up mode ignores scoring
      app.setWarmupMode(true);
      assert.equal(app.recordButtonScore('home', 30000).action, 'ignored');
      app.setWarmupMode(false);

      // Button coupling via quick actions + handlePlayTrack (no double counting)
      app.resetScoreboard();
      const aceTrack = { id: 'ace_1', name: 'Boom_ACE.mp3', cleanTitle: 'Boom', category: 'ass_angriff', suffix: '_ACE', playCount: 0 };
      const oppTrack = { id: 'opp_1', name: 'Sad_OPP.mp3', cleanTitle: 'Sad', category: 'gegner', suffix: '_OPP', playCount: 0 };
      const funTrack = { id: 'fun_1', name: 'Fun_FUN.mp3', cleanTitle: 'Fun', category: 'spass_extras', suffix: '_FUN', playCount: 0 };
      await memoryDb.saveTracks([aceTrack, oppTrack, funTrack]);
      app.allTracks.push(aceTrack, oppTrack, funTrack);

      app.playAce();
      // Even though handlePlayTrack is invoked for aceTrack, it must NOT double-count home to 2
      assert.deepEqual(app.scoreboardState, { home: 1, guest: 0 });

      // Tapping Gegnerpunkte immediately after Ace (<5s) corrects mistap: SV 1->0, GAST 0->1
      app.playRandomOpponent();
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 1 });

      // Immediate stopAudio reverts the recent point back to 0:0
      app.stopAudio();
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 0 });

      // Neutral Spaß track via handlePlayTrack does not alter score
      await app.handlePlayTrack(funTrack);
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 0 });

      // Direct column click on a home/guest track increments once
      await app.handlePlayTrack(aceTrack);
      assert.deepEqual(app.scoreboardState, { home: 1, guest: 0 });

      app.resetScoreboard();
      assert.deepEqual(app.scoreboardState, { home: 0, guest: 0 });
    } finally {
      app.setScoreboardVisible(false);
      app.setWarmupMode(false);
      app.resetScoreboard();
      app.audioEngine.playTrack = origPlayTrack;
      app.audioEngine.stop = origStop;
      app.audioEngine.hardStop = origHardStop;
      app.allTracks.splice(0, app.allTracks.length, ...origTracks);
    }
  });
});

describe('v1.16.0 Markup, CSS & Documentation Integrity', () => {
  it('index.html, css/app.css, and README.md contain all v1.16.0 components and preserve invariants', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'css/app.css'), 'utf8');
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');

    // Minimalist Scoreboard must have NO control buttons inside #header-scoreboard
    const sbMatch = html.match(/<div class="header-scoreboard" id="header-scoreboard"[\s\S]*?<\/div>/);
    assert.ok(sbMatch, 'index.html must contain #header-scoreboard');
    const sbHtml = sbMatch[0];
    assert.ok(sbHtml.includes('id="score-home-val"'));
    assert.ok(sbHtml.includes('id="score-guest-val"'));
    assert.ok(sbHtml.includes('>SV<'));
    assert.ok(sbHtml.includes('>GAST<'));
    assert.ok(!sbHtml.includes('<button'), '#header-scoreboard must be strictly minimalist with zero <button> controls');

    // Reset button lives in Settings, and legacy manual scoreboard buttons are gone
    assert.ok(!html.includes('id="btn-score-undo"'));
    assert.ok(!html.includes('id="btn-score-home-plus"'));
    assert.ok(!html.includes('id="btn-score-guest-plus"'));
    assert.ok(!html.includes('id="btn-score-next-set"'));
    assert.match(html, /id="btn-score-reset"/);

    // Settings & Context Modal & Custom SFX
    assert.match(html, /id="sfx-custom-section"/);
    assert.match(html, /id="btn-load-sfx-files"/);
    assert.match(html, /id="btn-bt-keepalive"/);
    assert.match(html, /id="btn-scoreboard-toggle"/);
    assert.match(html, /id="btn-shortcuts-toggle"/);
    assert.match(html, /id="btn-export-settings"/);
    assert.match(html, /id="btn-import-settings"/);
    assert.match(html, /id="settings-shortcuts-details"/);
    assert.match(html, /id="settings-suffix-details"/);
    assert.match(html, /<dialog id="track-context-modal"[^>]*closedby="any"/);
    assert.ok(!/<dialog[^>]*role="dialog"/.test(html), 'Native <dialog> must not use redundant role="dialog"');
    assert.ok(!/<dialog[^>]*aria-modal/.test(html), 'Native <dialog> must not use redundant aria-modal');

    // CSS styles & zero external URLs
    assert.ok(css.includes('.header-scoreboard'));
    assert.ok(css.includes('.score-team-home'));
    assert.ok(css.includes('.track-btn.is-pinned'));
    assert.ok(css.includes('.track-context-card'));
    assert.ok(css.includes('.settings-details'));
    assert.ok(!css.includes('http://') && !css.includes('https://'), 'CSS must stay 100% offline');

    // README updated
    assert.ok(readme.includes('effekte/'), 'README must document effekte/ subfolder');
    assert.ok(readme.includes('Bluetooth-Wachhalter'), 'README must document Bluetooth keep-alive');
    assert.ok(readme.includes('Mini-Spielstand'), 'README must document Mini Scoreboard');
  });
});
