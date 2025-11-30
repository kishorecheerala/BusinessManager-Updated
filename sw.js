const CACHE_VERSION = 'v1-2025-01-30-3';
const CACHE_NAME = `business-manager-${CACHE_VERSION}`;
// Use relative paths for static assets
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((name) => name !== CACHE_NAME && caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip cross-origin requests unless explicitly handled (like Google APIs)
  if (url.origin !== self.location.origin && !url.hostname.includes('googleapis.com')) return;

  // 1. Navigation Requests (HTML) - Network First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match('index.html');
        })
    );
    return;
  }

  // 2. API/Google Calls - Network First
  if (url.pathname.includes('/api/') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Static Assets (JS, CSS, Images) - Cache First, Fallback to Network
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
  );
});