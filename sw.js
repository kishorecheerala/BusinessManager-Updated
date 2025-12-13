// Cache-busting service worker - Forces complete refresh
const CACHE_VERSION = 'v-robust-2-sync-fix';
const CACHE_NAME = `business-manager-${CACHE_VERSION}`;

console.log('[SW] Cache version:', CACHE_NAME);

// Install - don't wait, skip immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing with cache:', CACHE_NAME);
  self.skipWaiting();
});

// Activate - clear all old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating - clearing old caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, then cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          // If offline and cache missing, return basic offline response if possible
          return cached || new Response('Offline');
        });
      })
  );
});

console.log('[SW] Service Worker loaded - Cache busting enabled');