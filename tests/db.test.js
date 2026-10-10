import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryStorageEngine,
  IndexedDBStorageEngine,
  createStorageEngine,
  getDefaultStorage,
  setDefaultStorage,
  initDB,
  saveTracks,
  getAllTracks,
  updateTrackPlayCount,
  resetAllPlayCounts,
  clearAllTracks,
  saveSetting,
  getSetting,
  DB_NAME,
  DB_VERSION,
  TRACKS_STORE,
  SETTINGS_STORE
} from '../js/db.js';

test('StorageEngine saves, retrieves, updates and resets tracks', async () => {
  const db = new MemoryStorageEngine();
  await db.init();

  const mockTrack = {
    id: 'track-1',
    name: 'Super_Spike_HIT.mp3',
    cleanTitle: 'Super Spike',
    category: 'ass_angriff',
    suffix: '_HIT',
    playCount: 0,
    type: 'audio/mp3',
    blob: new Uint8Array([1, 2, 3])
  };

  await db.saveTracks([mockTrack]);
  const tracks = await db.getAllTracks();
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].cleanTitle, 'Super Spike');
  assert.equal(tracks[0].playCount, 0);

  await db.updateTrackPlayCount('track-1', 2);
  const updatedTracks = await db.getAllTracks();
  assert.equal(updatedTracks[0].playCount, 2);
  assert.ok(updatedTracks[0].lastPlayed);

  await db.resetAllPlayCounts();
  const resetTracks = await db.getAllTracks();
  assert.equal(resetTracks[0].playCount, 0);

  await db.saveSetting('masterVolume', 0.85);
  const volume = await db.getSetting('masterVolume', 1.0);
  assert.equal(volume, 0.85);

  // Default value check for non-existent setting
  const nonExistent = await db.getSetting('unknownKey', 'defaultVal');
  assert.equal(nonExistent, 'defaultVal');

  await db.clearAllTracks();
  const emptyTracks = await db.getAllTracks();
  assert.equal(emptyTracks.length, 0);
});

test('createStorageEngine returns MemoryStorageEngine in Node environment', async () => {
  const engine = createStorageEngine();
  assert.ok(engine instanceof MemoryStorageEngine);
  await engine.init();
  await engine.saveSetting('test', 123);
  assert.equal(await engine.getSetting('test'), 123);
});

test('updateTrackPlayCount on nonexistent track does not fail', async () => {
  const db = new MemoryStorageEngine();
  await db.init();
  await db.updateTrackPlayCount('non-existent-id', 5);
  const tracks = await db.getAllTracks();
  assert.equal(tracks.length, 0);
});

test('IndexedDBStorageEngine throws when indexedDB is undefined', async () => {
  const idbEngine = new IndexedDBStorageEngine();
  await assert.rejects(
    async () => {
      await idbEngine.init();
    },
    { message: /IndexedDB not supported/ }
  );
});

test('IndexedDBStorageEngine throws if operations called before init()', async () => {
  const idbEngine = new IndexedDBStorageEngine();
  const expectedErr = { message: 'IndexedDBStorageEngine is not initialized. Call init() first.' };

  await assert.rejects(async () => idbEngine.saveTracks([]), expectedErr);
  await assert.rejects(async () => idbEngine.getAllTracks(), expectedErr);
  await assert.rejects(async () => idbEngine.updateTrackPlayCount('id', 1), expectedErr);
  await assert.rejects(async () => idbEngine.resetAllPlayCounts(), expectedErr);
  await assert.rejects(async () => idbEngine.clearAllTracks(), expectedErr);
  await assert.rejects(async () => idbEngine.saveSetting('k', 'v'), expectedErr);
  await assert.rejects(async () => idbEngine.getSetting('k'), expectedErr);
});

test('IndexedDBStorageEngine.updateTrackPlayCount awaits tx.oncomplete', async () => {
  const idbEngine = new IndexedDBStorageEngine();
  let putCalled = false;
  let completeCalled = false;

  const mockStore = {
    get: () => {
      const req = {};
      setTimeout(() => {
        req.result = { id: 'track-1', playCount: 1 };
        if (req.onsuccess) req.onsuccess();
      }, 0);
      return req;
    },
    put: (item) => {
      putCalled = true;
      assert.equal(item.playCount, 3);
    }
  };

  const mockTx = {
    objectStore: () => mockStore,
    oncomplete: null,
    onerror: null
  };

  idbEngine.db = {
    transaction: () => {
      setTimeout(() => {
        completeCalled = true;
        if (mockTx.oncomplete) mockTx.oncomplete();
      }, 5);
      return mockTx;
    }
  };

  await idbEngine.updateTrackPlayCount('track-1', 3);
  assert.equal(putCalled, true);
  assert.equal(completeCalled, true);
});


test('module-level convenience functions delegate to default storage', async () => {
  const customEngine = new MemoryStorageEngine();
  setDefaultStorage(customEngine);

  await initDB();
  const mockTrack = {
    id: 'track-mod-1',
    name: 'Block_Party_BLOCK.mp3',
    cleanTitle: 'Block Party',
    category: 'block',
    suffix: '_BLOCK',
    playCount: 0,
    type: 'audio/mp3',
    blob: new Uint8Array([4, 5, 6])
  };

  await saveTracks([mockTrack]);
  let tracks = await getAllTracks();
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].id, 'track-mod-1');

  await updateTrackPlayCount('track-mod-1', 4);
  tracks = await getAllTracks();
  assert.equal(tracks[0].playCount, 4);

  await resetAllPlayCounts();
  tracks = await getAllTracks();
  assert.equal(tracks[0].playCount, 0);

  await saveSetting('theme', 'dark');
  const theme = await getSetting('theme');
  assert.equal(theme, 'dark');

  const fallback = await getSetting('nonexistent', 'light');
  assert.equal(fallback, 'light');

  await clearAllTracks();
  tracks = await getAllTracks();
  assert.equal(tracks.length, 0);

  // Restore fresh engine
  setDefaultStorage(null);
  assert.ok(getDefaultStorage() instanceof MemoryStorageEngine);
});

test('DB constants are defined properly', () => {
  assert.equal(DB_NAME, 'SV1845_DJ_DB');
  assert.equal(DB_VERSION, 1);
  assert.equal(TRACKS_STORE, 'tracks');
  assert.equal(SETTINGS_STORE, 'settings');
});
