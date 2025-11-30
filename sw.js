
const CACHE_VERSION = 'v1';
const CACHE_NAME = `business-manager-${CACHE_VERSION}`;

// ==============================================================
// INSTALL - Cache critical files
// ==============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Opened cache:', CACHE_NAME);
        // Only cache the homepage to start - keeps it lightweight and less prone to failure
        // The rest will be cached as they are fetched (runtime caching)
        return cache.addAll(['./', './index.html'])
          .catch((error) => {
            console.warn('[SW] Cache addAll error (non-critical):', error);
          });
      })
      .catch((error) => {
        console.error('[SW] Cache open error:', error);
      })
  );
  
  // Activate immediately, don't wait for clients
  self.skipWaiting();
});

// ==============================================================
// ACTIVATE - Clean old caches
// ==============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .catch((error) => {
        console.error('[SW] Activate error:', error);
      })
  );
  
  self.clients.claim();
});

// ==============================================================
// FETCH - Serve from cache, fallback to network
// ==============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (like Google Fonts, APIs) to prevent opaque response issues
  // or handle them with a network-first strategy if needed.
  // For now, we focus on app assets.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return; 
  }
  
  // Strategy: Try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // If found in cache, return it
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(request)
          .then((response) => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            // Cache it for next time
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache)
                  .catch((error) => {
                    // Quota exceeded or other error - just ignore, app still works
                    console.warn('[SW] Cache put error:', error);
                  });
              })
              .catch((err) => {
                 console.warn('[SW] Cache open failed during fetch:', err);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch error:', error);
            
            // If offline, try to return cached index.html for navigation requests
            if (request.mode === 'navigate') {
                return caches.match('./index.html');
            }
            
            // Return a simple offline text or error
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
      .catch((error) => {
        console.error('[SW] Match error:', error);
        return new Response('Error', { status: 500 });
      })
  );
});

console.log('[SW] Service Worker loaded successfully');
