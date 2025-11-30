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
        // Only cache the homepage - that's all we need
        return cache.addAll(['/'])
          .catch((error) => {
            console.warn('[SW] Cache addAll error (may be normal):', error);
            // Don't fail install if caching fails - still activate
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
  
  // Check if request is from same origin
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
          console.log('[SW] Cache hit:', request.url);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(request)
          .then((response) => {
            // Check if response is valid
            if (!response || response.status !== 200 || response.type === 'error') {
              console.warn('[SW] Invalid response:', response?.status);
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            // Cache it for next time
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache)
                  .catch((error) => {
                    console.warn('[SW] Cache put error:', error);
                  });
              })
              .catch((error) => {
                console.warn('[SW] Cache open error:', error);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('[SW] Fetch error:', error);
            
            // If offline, try to return cached version
            return caches.match(request)
              .then((cachedResponse) => {
                if (cachedResponse) {
                  console.log('[SW] Returning cached fallback for offline');
                  return cachedResponse;
                }
                
                // Last resort: return homepage
                return caches.match('/');
              })
              .catch((cacheError) => {
                console.error('[SW] Fallback error:', cacheError);
                // Return a basic response so app doesn't crash
                return new Response('Offline - no cached content available', {
                  status: 503,
                  statusText: 'Service Unavailable'
                });
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