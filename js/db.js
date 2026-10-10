/**
 * IndexedDB Storage Engine for SV 1845 Esslingen DJ Pult
 */

export const DB_NAME = 'SV1845_DJ_DB';
export const DB_VERSION = 1;
export const TRACKS_STORE = 'tracks';
export const SETTINGS_STORE = 'settings';

export class MemoryStorageEngine {
  constructor() {
    this.tracks = new Map();
    this.settings = new Map();
  }

  async init() {
    return true;
  }

  async saveTracks(trackList) {
    for (const t of trackList) {
      this.tracks.set(t.id, { ...t });
    }
  }

  async getAllTracks() {
    return Array.from(this.tracks.values());
  }

  async updateTrackPlayCount(id, playCount) {
    const t = this.tracks.get(id);
    if (t) {
      t.playCount = playCount;
      t.lastPlayed = Date.now();
      this.tracks.set(id, t);
    }
  }

  async resetAllPlayCounts() {
    for (const [id, t] of this.tracks.entries()) {
      t.playCount = 0;
      this.tracks.set(id, t);
    }
  }

  async clearAllTracks() {
    this.tracks.clear();
  }

  async saveSetting(key, value) {
    this.settings.set(key, value);
  }

  async getSetting(key, defaultValue = null) {
    if (this.settings.has(key)) {
      return this.settings.get(key);
    }
    return defaultValue;
  }
}

export class IndexedDBStorageEngine {
  constructor() {
    this.db = null;
  }

  async init() {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB not supported in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(TRACKS_STORE)) {
          db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  _ensureDB() {
    if (!this.db) {
      throw new Error('IndexedDBStorageEngine is not initialized. Call init() first.');
    }
  }

  async saveTracks(trackList) {
    this._ensureDB();
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    for (const track of trackList) {
      store.put(track);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllTracks() {
    this._ensureDB();
    const tx = this.db.transaction([TRACKS_STORE], 'readonly');
    const store = tx.objectStore(TRACKS_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTrackPlayCount(id, playCount) {
    this._ensureDB();
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    const getReq = store.get(id);

    return new Promise((resolve, reject) => {
      getReq.onsuccess = () => {
        const track = getReq.result;
        if (track) {
          track.playCount = playCount;
          track.lastPlayed = Date.now();
          store.put(track);
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async resetAllPlayCounts() {
    this._ensureDB();
    const tracks = await this.getAllTracks();
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    for (const t of tracks) {
      t.playCount = 0;
      store.put(t);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllTracks() {
    this._ensureDB();
    const tx = this.db.transaction([TRACKS_STORE], 'readwrite');
    const store = tx.objectStore(TRACKS_STORE);
    store.clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveSetting(key, value) {
    this._ensureDB();
    const tx = this.db.transaction([SETTINGS_STORE], 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    store.put({ key, value });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    this._ensureDB();
    const tx = this.db.transaction([SETTINGS_STORE], 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (request.result && request.result.value !== undefined) {
          resolve(request.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export function createStorageEngine() {
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDBStorageEngine();
  }
  return new MemoryStorageEngine();
}

let defaultEngine = null;

export function getDefaultStorage() {
  if (!defaultEngine) {
    defaultEngine = createStorageEngine();
  }
  return defaultEngine;
}

export function setDefaultStorage(engine) {
  defaultEngine = engine;
}

export async function initDB() {
  const engine = getDefaultStorage();
  return engine.init();
}

export async function saveTracks(trackList) {
  const engine = getDefaultStorage();
  return engine.saveTracks(trackList);
}

export async function getAllTracks() {
  const engine = getDefaultStorage();
  return engine.getAllTracks();
}

export async function updateTrackPlayCount(id, playCount) {
  const engine = getDefaultStorage();
  return engine.updateTrackPlayCount(id, playCount);
}

export async function resetAllPlayCounts() {
  const engine = getDefaultStorage();
  return engine.resetAllPlayCounts();
}

export async function clearAllTracks() {
  const engine = getDefaultStorage();
  return engine.clearAllTracks();
}

export async function saveSetting(key, value) {
  const engine = getDefaultStorage();
  return engine.saveSetting(key, value);
}

export async function getSetting(key, defaultValue = null) {
  const engine = getDefaultStorage();
  return engine.getSetting(key, defaultValue);
}
