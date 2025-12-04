
// Production-ready service worker with proper error handling
// PWA Lock Removed - Version bumped to force update
const CACHE_VERSION = 'bm-v1.9.0-FORCE-REFRESH-' + new Date().getTime();
const CACHE_NAME = `business-manager-${CACHE_VERSION}`;

// Files that MUST be cached for offline functionality
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v' + CACHE_VERSION);
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache opened:', CACHE_NAME);
        return cache.addAll(CRITICAL_ASSETS);
      })
      .catch((err) => {
        console.error('[Service Worker] Install failed:', err);
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating and cleaning old caches');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .map((name) => {
              // Delete ALL old caches that don't match current version
              if (name !== CACHE_NAME) {
                  console.log('[Service Worker] Deleting old cache:', name);
                  return caches.delete(name);
              }
            })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests unless they are specific CDNs we trust (optional)
  if (!request.url.startsWith(self.location.origin)) {
      return;
  }

  // Network First Strategy for HTML (Navigations) to ensure fresh content
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(request);
        })
    );
    return;
  }

  // Stale-While-Revalidate for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
            });
        }
        return networkResponse;
      }).catch(() => {
         // Network failed, return nothing (let cache handle it if it exists)
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
