
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // Disable auto injection; we handle it manually in index.tsx
      manifest: {
        name: 'Business Manager',
        short_name: 'Business Manager',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
          {src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
          {src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
          {src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Increase limit to 5MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
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
