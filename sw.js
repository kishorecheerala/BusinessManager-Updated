const CACHE_NAME = 'business-manager-v1'
const ASSETS_TO_CACHE = ['/', '/index.html', '/manifest.json', '/vite.svg']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {})
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName)
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).then(response => {
        const cloned = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, cloned))
        return response
      })
    }).catch(() => {
      if (request.destination === 'document') {
        return caches.match('/index.html')
      }
    })
  )
})
