
// DEPRECATED
// This file is no longer used. The active service worker is located at public/service-worker.js
// This file is kept briefly to ensure any cached clients unregister it.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Immediately unregister this legacy worker
  self.registration.unregister()
    .then(() => {
      console.log('[Legacy SW] Unregistered self');
      return self.clients.matchAll();
    })
    .then((clients) => {
      // Reload clients to pick up the new SW from index.html / pwa-register
      clients.forEach(client => client.navigate(client.url));
    });
});
