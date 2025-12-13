// Cache-busting service worker - PANIC MODE
// This version forces a complete cache clear to resolve "White Screen" / Freeze issues.
const CACHE_VERSION = 'v-panic-reset-1';
const CACHE_NAME = `business-manager-${CACHE_VERSION}`;

console.log('[SW] Panic Mode: Active', CACHE_NAME);

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating - Clearing ALL old caches...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // DELETE EVERYTHING that isn't the new cache
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Clients Claimed.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // NETWORK ONLY for this version to ensure we get fresh files
  // We will re-enable caching in v-robust-4 once stable.
  event.respondWith(
    console.log('[SW] Service Worker loaded - Cache busting enabled');