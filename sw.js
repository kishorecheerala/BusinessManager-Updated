
const CACHE_NAME = 'business-manager-cache-v2';

// The essential files that make up the app's shell.
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/vite.svg',
  '/pages/manifest.json',
  '/index.tsx',
];

// On install, cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// On activation, clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Tell the active service worker to take control of the page immediately.
        return self.clients.claim();
    })
  );
});

// On fetch, use a cache-first strategy
self.addEventListener('fetch', event => {
  // We only want to handle GET requests for assets
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // 1. Try to find the response in the cache
    caches.match(event.request)
      .then(cachedResponse => {
        // If a cached response is found, return it
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. If not in cache, fetch it from the network
        return fetch(event.request).then(networkResponse => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // 3. Clone the response and add it to the cache for future use
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return networkResponse;
        }).catch(error => {
          console.error('Service Worker: Fetch failed; user is likely offline.', event.request.url, error);
          // You could return a fallback offline page or image here if you had one.
        });
      })
  );
});
