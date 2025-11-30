
const CACHE_NAME = 'business-manager-cache-v20';

// Relative paths to ensure compatibility with subdirectories or root hosting
const APP_SHELL_URLS = [
  './',
  './index.html',
  './vite.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip Google API requests
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('googleusercontent.com') || 
      url.hostname.includes('accounts.google.com')) {
      return; 
  }

  // Navigation Strategy: Network -> Cache -> Index.html Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then(response => {
              // If exact page match (e.g. /?mode=pwa) exists, return it
              if (response) return response;
              // Otherwise return the SPA root
              return caches.match('./index.html');
            });
        })
    );
    return;
  }

  // Asset Strategy: Stale-While-Revalidate (good for icons/manifest)
  // or Cache First (good for immutable assets). 
  // Using Cache First falling back to Network here for stability.
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          // Clone the response
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return networkResponse;
        });
      })
  );
});