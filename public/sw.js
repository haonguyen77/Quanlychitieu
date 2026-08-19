// Service Worker — PWA offline support skeleton
// Phase 1: minimal SW for installability
// Phase 5: will add caching strategies and push notifications

const CACHE_NAME = 'qlct-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Basic network-first strategy for now
self.addEventListener('fetch', (event) => {
  // Let all requests pass through to network
  // Offline caching will be implemented in later phase
});
