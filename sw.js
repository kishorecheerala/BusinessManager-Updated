const CACHE_NAME = 'business-manager-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache successful GET requests for same-origin resources
        if (event.request.url.startsWith(self.location.origin)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      });
    }).catch(() => {
      // If offline and request is for navigation, return index.html
      if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
      }
    })
  );
});