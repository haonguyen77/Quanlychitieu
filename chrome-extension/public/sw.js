const CACHE_NAME = 'qlct-v1';
const ASSETS = ['/index.html', '/assets/popup.js', '/assets/popup.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
