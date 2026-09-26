const CACHE_NAME = 'cheque-tracker-v2';
const STATIC_ASSETS = [
  '/cheque.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  // Clean up old caches so stale content doesn't linger
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Navigation requests (opening the app, page loads) → always go to network
  // first so the user sees the latest version. Fall back to cache only if
  // truly offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For JS/CSS assets with hashed filenames (Vite output in /assets/),
  // use network-first as well so new deploys are picked up immediately.
  if (request.url.includes('/assets/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (icons, manifest) → cache first, network fallback
  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});
