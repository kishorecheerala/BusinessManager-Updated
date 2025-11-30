const CACHE_NAME = 'business-manager-v3'; // Bump version for clean install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './vite.svg'
  // NOTE: The main JS bundle (index.tsx) is cached dynamically by the fetch handler.
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching app shell');
      // Use catch to prevent install failure if one asset fails (e.g. in dev)
      return cache.addAll(STATIC_ASSETS).catch(err => console.error("SW Install Error: Caching app shell failed", err));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('SW: Deleting old cache', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('SW: Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Strategy 1: Cache-First for navigation requests.
  // This is critical for PWA installability, as it guarantees an offline response for the start_url.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Return from cache if available.
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache, fetch from network.
        return fetch(event.request).catch(() => {
          // If network fails and it's not in cache, return the main index.html as a fallback.
          // This ensures the app shell always loads, even offline on first visit if install fails.
          return caches.match('./index.html');
        });
      })
    );
    return;
  }
  
  // Strategy 2: Stale-While-Revalidate for other assets (JS from importmap, CSS, fonts, etc.).
  // This serves from cache immediately for speed, then updates the cache in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Check for valid response to cache. Don't cache errors or opaque responses from CDNs without CORS.
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
             cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return from cache if available, otherwise wait for the network.
        // The next time the user loads the page, they will get the updated version from the cache.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
