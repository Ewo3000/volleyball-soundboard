/**
 * SV 1845 Esslingen - Volleyball DJ Soundboard
 * Service Worker (sw.js) for 100% Offline PWA Capability
 * Version: 1.3.0
 */

const CACHE_NAME = 'sv1845-dj-v1.3.0';

const APP_SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'version.json',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/file-loader.js',
  'js/audio-engine.js',
  'js/wake-lock.js',
  'js/demo-sounds.js',
  'assets/logo.jpg'
];

// Message Event: skip waiting on demand from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install Event: pre-caches critical app shell and activates immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: removes outdated caches and claims connected clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Cache-First strategy with network fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Always fetch version.json from network first (so update checks are fresh)
  if (event.request.url.includes('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not matched exactly, try ignoring search query parameters
      return caches.match(event.request, { ignoreSearch: true }).then((searchIgnored) => {
        if (searchIgnored) {
          return searchIgnored;
        }

        return fetch(event.request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            event.request.url.startsWith('http')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              return cache.put(event.request, responseClone).catch((err) => {});
            }).catch((err) => {});
          }
          return networkResponse;
        }).catch((err) => {
          // If offline and request is HTML/navigation, serve index.html fallback
          if (
            event.request.mode === 'navigate' ||
            (event.request.headers && event.request.headers.get('accept')?.includes('text/html'))
          ) {
            return caches.match('index.html').then((indexFallback) => {
              return indexFallback || caches.match('./');
            });
          }
          throw err;
        });
      });
    })
  );
});
