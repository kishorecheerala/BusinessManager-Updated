
// Cache-busting service worker - Forces complete refresh
const CACHE_NAME = 'business-manager-v7';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg'
];

// Install: Pre-cache critical files to pass PWA installability criteria
self.addEventListener('install', (event) => {
  console.log('[SW] Install triggered');
  self.skipWaiting(); // Activate immediately
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching critical assets');
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate triggered');
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

// Fetch: Stale-while-revalidate strategy for best offline experience
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  // Skip cross-origin unless necessary
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Fetch from network to update cache (background)
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Check if valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Update cache with new version
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      }).catch((err) => {
        console.log('[SW] Network fetch failed, staying offline');
      });

      // 2. Return cached response immediately if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // 3. If no cache, wait for network (and return fallback if that fails)
      return fetchPromise.catch(() => {
        // Fallback for navigation requests (HTML)
        // IMPORTANT: This ensures "/" requests are served index.html offline
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
