// Twyford Holdings Control Center - Service Worker
// Cache-busting version - always fetch fresh from network
const CACHE_VERSION = "twyford-v1";

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Clear ALL old caches on activation
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", e => {
  // Always go to network - no caching
  e.respondWith(fetch(e.request));
});
