import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SW_PATH = 'sw.js';

test('sw.js exists and lists all critical core assets', () => {
  assert.ok(fs.existsSync(SW_PATH), 'sw.js must exist');
  const sw = fs.readFileSync(SW_PATH, 'utf8');

  // Verify cache name
  assert.ok(sw.includes('sv1845-dj-v1'), 'sw.js must define cache name sv1845-dj-v1');

  // Verify core app shell assets
  const requiredAssets = [
    'index.html',
    'manifest.webmanifest',
    'css/app.css',
    'js/app.js',
    'js/db.js',
    'js/file-loader.js',
    'js/audio-engine.js',
    'js/wake-lock.js',
    'assets/logo.jpg'
  ];

  for (const asset of requiredAssets) {
    assert.ok(sw.includes(asset), `sw.js must list ${asset}`);
  }

  // Verify event listeners
  assert.ok(sw.includes("addEventListener('install'"), 'sw.js must handle install event');
  assert.ok(sw.includes("addEventListener('activate'"), 'sw.js must handle activate event');
  assert.ok(sw.includes("addEventListener('fetch'"), 'sw.js must handle fetch event');

  // Verify immediate activation
  assert.ok(sw.includes('skipWaiting'), 'sw.js must call self.skipWaiting()');
  assert.ok(sw.includes('clients.claim'), 'sw.js must call self.clients.claim()');
});

test('service worker install event caches app shell and skips waiting', async () => {
  assert.ok(fs.existsSync(SW_PATH), 'sw.js must exist');
  const code = fs.readFileSync(SW_PATH, 'utf8');

  const listeners = {};
  let skipWaitingCalled = false;
  let cachedUrls = [];

  const mockCache = {
    addAll: async (urls) => {
      cachedUrls = [...urls];
    }
  };

  const cacheNameMatch = code.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  const currentCacheName = cacheNameMatch ? cacheNameMatch[1] : 'sv1845-dj-v1';

  const mockCaches = {
    open: async (name) => {
      assert.equal(name, currentCacheName);
      return mockCache;
    }
  };

  const sandbox = {
    self: {
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      skipWaiting: async () => {
        skipWaitingCalled = true;
      },
      clients: {
        claim: async () => {}
      },
      location: { origin: 'https://sv1845-dj.local' }
    },
    caches: mockCaches,
    fetch: async () => {},
    console
  };
  sandbox.self.self = sandbox.self;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  assert.ok(listeners.install, 'install listener must be registered');

  let waitUntilPromise = null;
  const installEvent = {
    waitUntil: (p) => {
      waitUntilPromise = p;
    }
  };

  listeners.install(installEvent);
  await waitUntilPromise;

  assert.ok(cachedUrls.length > 0, 'cache.addAll should have received assets');
  assert.ok(cachedUrls.includes('index.html') || cachedUrls.includes('./index.html') || cachedUrls.includes('./'));
  assert.ok(cachedUrls.includes('manifest.webmanifest') || cachedUrls.includes('./manifest.webmanifest'));
  assert.ok(cachedUrls.includes('css/app.css') || cachedUrls.includes('./css/app.css'));
  assert.ok(cachedUrls.includes('js/app.js') || cachedUrls.includes('./js/app.js'));
  assert.ok(cachedUrls.includes('assets/logo.jpg') || cachedUrls.includes('./assets/logo.jpg'));
  assert.equal(skipWaitingCalled, true, 'skipWaiting must be called during install');
});

test('service worker activate event deletes old caches and claims clients', async () => {
  assert.ok(fs.existsSync(SW_PATH), 'sw.js must exist');
  const code = fs.readFileSync(SW_PATH, 'utf8');

  const listeners = {};
  let claimCalled = false;
  const cacheNameMatch = code.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
  const currentCacheName = cacheNameMatch ? cacheNameMatch[1] : 'sv1845-dj-v1';
  const deletedCaches = [];

  const mockCaches = {
    keys: async () => [currentCacheName, 'sv1845-dj-v0-beta', 'old-cache-test'],
    delete: async (name) => {
      deletedCaches.push(name);
      return true;
    }
  };


  const sandbox = {
    self: {
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      skipWaiting: async () => {},
      clients: {
        claim: async () => {
          claimCalled = true;
        }
      },
      location: { origin: 'https://sv1845-dj.local' }
    },
    caches: mockCaches,
    fetch: async () => {},
    console
  };
  sandbox.self.self = sandbox.self;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  assert.ok(listeners.activate, 'activate listener must be registered');

  let waitUntilPromise = null;
  const activateEvent = {
    waitUntil: (p) => {
      waitUntilPromise = p;
    }
  };

  listeners.activate(activateEvent);
  await waitUntilPromise;

  assert.deepEqual(deletedCaches.sort(), ['old-cache-test', 'sv1845-dj-v0-beta'].sort());
  assert.ok(!deletedCaches.includes(currentCacheName), 'current cache must not be deleted');
  assert.equal(claimCalled, true, 'clients.claim must be called during activate');

});

test('service worker fetch event performs cache-first lookup with fallback', async () => {
  assert.ok(fs.existsSync(SW_PATH), 'sw.js must exist');
  const code = fs.readFileSync(SW_PATH, 'utf8');

  const listeners = {};
  const cacheStorage = new Map();
  cacheStorage.set('https://sv1845-dj.local/css/app.css', { status: 200, body: '/* cached css */' });

  const mockCache = {
    put: async (req, res) => {
      cacheStorage.set(typeof req === 'string' ? req : req.url, res);
    }
  };

  const mockCaches = {
    match: async (request, options) => {
      const url = typeof request === 'string' ? request : request.url;
      if (cacheStorage.has(url)) {
        return cacheStorage.get(url);
      }
      // If ignoreSearch is true, check url without query
      if (options?.ignoreSearch && url.includes('?')) {
        const cleanUrl = url.split('?')[0];
        if (cacheStorage.has(cleanUrl)) {
          return cacheStorage.get(cleanUrl);
        }
      }
      return undefined;
    },
    open: async () => mockCache
  };

  let networkFetchCount = 0;
  const mockFetch = async (req) => {
    networkFetchCount++;
    const url = typeof req === 'string' ? req : req.url;
    return {
      status: 200,
      type: 'basic',
      url,
      clone: function() { return { ...this }; }
    };
  };

  const sandbox = {
    self: {
      addEventListener: (type, fn) => {
        listeners[type] = fn;
      },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
      location: { origin: 'https://sv1845-dj.local' }
    },
    caches: mockCaches,
    fetch: mockFetch,
    console
  };
  sandbox.self.self = sandbox.self;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  assert.ok(listeners.fetch, 'fetch listener must be registered');

  // 1. Cache hit (css/app.css)
  let respondWithPromise = null;
  const cacheHitEvent = {
    request: {
      method: 'GET',
      url: 'https://sv1845-dj.local/css/app.css',
      mode: 'cors'
    },
    respondWith: (p) => {
      respondWithPromise = p;
    }
  };
  listeners.fetch(cacheHitEvent);
  const hitResult = await respondWithPromise;
  assert.equal(hitResult.body, '/* cached css */');
  assert.equal(networkFetchCount, 0, 'network fetch must not be called on cache hit');

  // 2. Cache hit with query param (css/app.css?v=2)
  respondWithPromise = null;
  const queryParamEvent = {
    request: {
      method: 'GET',
      url: 'https://sv1845-dj.local/css/app.css?v=2',
      mode: 'cors'
    },
    respondWith: (p) => {
      respondWithPromise = p;
    }
  };
  listeners.fetch(queryParamEvent);
  const queryResult = await respondWithPromise;
  assert.equal(queryResult.body, '/* cached css */');
  assert.equal(networkFetchCount, 0, 'query param should still hit cache');

  // 3. Cache miss: falls back to network fetch
  respondWithPromise = null;
  const missEvent = {
    request: {
      method: 'GET',
      url: 'https://sv1845-dj.local/js/new-module.js',
      mode: 'cors'
    },
    respondWith: (p) => {
      respondWithPromise = p;
    }
  };
  listeners.fetch(missEvent);
  const missResult = await respondWithPromise;
  assert.equal(missResult.status, 200);
  assert.equal(networkFetchCount, 1, 'network fetch must be called on cache miss');
});

test('service worker registration logic in js/app.js exists and is safe', async () => {
  const { registerServiceWorker } = await import('../js/app.js');
  assert.equal(typeof registerServiceWorker, 'function', 'registerServiceWorker should be exported');

  // Test in environment without navigator.serviceWorker (Node default)
  assert.doesNotThrow(() => {
    registerServiceWorker();
  });

  // Test in mocked browser environment with navigator.serviceWorker
  let registeredScript = null;
  const originalDoc = globalThis.document;

  const mockServiceWorker = {
    register: async (scriptPath) => {
      registeredScript = scriptPath;
      return { scope: './' };
    }
  };

  try {
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      value: mockServiceWorker,
      configurable: true,
      writable: true
    });
    globalThis.document = {
      readyState: 'complete'
    };

    registerServiceWorker();
    assert.equal(registeredScript, './sw.js', 'must register ./sw.js');
  } finally {
    delete globalThis.navigator.serviceWorker;
    globalThis.document = originalDoc;
  }
});
