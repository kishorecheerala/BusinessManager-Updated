
const CACHE_NAME = 'business-manager-v4'; // Increment version to force refresh
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg',
  // Add core assets here if they have stable paths
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Cleaning old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip non-http (e.g. chrome-extension)
  if (!event.request.url.startsWith('http')) return;

  // 1. Navigation (HTML): Network First, fall back to Cache
  // This ensures the user always gets the latest version if online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Store valid response in cache
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: return cached index.html
          return caches.match('./index.html').then(match => match || caches.match('./'));
        })
    );
    return;
  }

  // 2. Assets (JS, CSS, Images): Stale-While-Revalidate
  // Serve cached content immediately, but update cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch((err) => {
           // Network failed, ignore for background update
           console.debug('[SW] Background fetch failed', err);
        });

        // Return cached response if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
