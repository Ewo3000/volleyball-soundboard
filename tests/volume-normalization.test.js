import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryStorageEngine,
  IndexedDBStorageEngine,
  setDefaultStorage,
  updateTrackGain
} from '../js/db.js';

describe('StorageEngine Track Gain Persistence', () => {
  it('MemoryStorageEngine.updateTrackGain updates normGain and customGain while preserving other fields', async () => {
    const engine = new MemoryStorageEngine();
    await engine.init();
    setDefaultStorage(engine);

    await engine.saveTracks([
      { id: 't1', name: 'Song1.mp3', playCount: 3, blob: new Uint8Array([1, 2]) }
    ]);

    await updateTrackGain('t1', { normGain: 1.45 });
    let tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].playCount, 3);

    await updateTrackGain('t1', { customGain: 0.8 });
    tracks = await engine.getAllTracks();
    assert.equal(tracks[0].normGain, 1.45);
    assert.equal(tracks[0].customGain, 0.8);
    assert.equal(tracks[0].playCount, 3);
  });

  it('IndexedDBStorageEngine.updateTrackGain updates track in store and awaits tx.oncomplete', async () => {
    const stored = { id: 't2', name: 'Song2.mp3', playCount: 5 };
    let putRecord = null;

    const engine = new IndexedDBStorageEngine();
    engine.db = {
      transaction() {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore() {
            return {
              get() {
                const req = { result: { ...stored }, onsuccess: null, onerror: null };
                setTimeout(() => {
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              put(rec) {
                putRecord = rec;
                setTimeout(() => {
                  if (tx.oncomplete) tx.oncomplete();
                }, 0);
              }
            };
          }
        };
        return tx;
      }
    };

    await engine.updateTrackGain('t2', { normGain: 1.2, customGain: 1.5 });
    assert.equal(putRecord.normGain, 1.2);
    assert.equal(putRecord.customGain, 1.5);
    assert.equal(putRecord.playCount, 5);
  });
});
