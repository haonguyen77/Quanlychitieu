// Service Worker — PWA installability + offline shell caching
const CACHE_NAME = 'qlct-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
];

// Install: cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for navigation
self.addEventListener('fetch', (event) => {
  // Only handle same-origin navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests: network-first, no aggressive caching
  // (API calls, Drive sync, etc. should always go to network)
  event.respondWith(fetch(event.request));
});
