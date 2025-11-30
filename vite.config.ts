
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Disable auto injection; we handle it manually in index.tsx
      filename: 'manifest.json', // Explicitly name the generated manifest
      manifest: {
        name: 'Business Manager - Sales & Purchase Tracker',
        short_name: 'Business Manager',
        description: 'Offline-first PWA for managing sales, purchases, and customer dues',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        id: '/', // Consistent ID for the app
        start_url: '/',
        scope: '/',
        icons: [
          {src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
          {src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
          {src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
          {src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          {src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any'}
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        navigateFallback: '/index.html', // Essential for SPA offline navigation (WebAPK requirement)
        navigateFallbackDenylist: [/^\/api/], // Don't fallback for API routes
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'google-apis',
              expiration: {maxEntries: 100, maxAgeSeconds: 604800},
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {maxEntries: 100, maxAgeSeconds: 2592000},
            },
          },
        ],
      },
    }),
  ],
})
