
// Robust Offline Service Worker
const CACHE_NAME = 'saree-business-manager-v-1.0.1';

// Critical external assets to pre-cache for offline functionality
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600&family=Roboto:wght@400;500&family=Space+Mono:wght@400;700&display=swap',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/default.css',
  'https://cdn.jsdelivr.net/npm/mobile-drag-drop@2.3.0-rc.2/index.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.mjs' 
];

// Install - Pre-cache critical assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing:', CACHE_NAME);
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache app shell and external deps
      return cache.addAll([
        './',
        './index.html',
        './manifest.json',
        ...EXTERNAL_ASSETS
      ]).catch(err => console.error("Pre-caching failed:", err));
    })
  );
});

// Activate - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating');
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

// Fetch - Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Handle API calls or non-GET requests: Network Only
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // Update cache with new version if valid
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
           // Network failed, nothing to do here (we rely on cachedResponse)
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
