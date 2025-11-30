const CACHE_NAME = 'business-manager-cache-v7'; // Bump version to force update
const URLS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './vite.svg'
];

// On install, cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Activate new SW immediately
  );
});

// On activate, clean up old caches to save space
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// On fetch, use a robust cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests (loading the app), always serve index.html from cache first.
  // This is the most important part for the installability check.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => cache.match('./index.html'))
        .then(response => response || fetch('./index.html')) // Fallback to network
    );
    return;
  }
  
  // For other requests (CDN scripts, fonts, etc.), try cache then network.
  // This ensures that even if the CDN is down, the app might still work if assets are cached.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // If we have it in cache, return it
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // Otherwise, go to network and cache the response for next time
      return fetch(request).then(networkResponse => {
        // Check if we received a valid response and it's from a safe source (to avoid caching errors)
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET' && (request.url.startsWith(self.location.origin) || request.url.includes('aistudiocdn.com'))) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});