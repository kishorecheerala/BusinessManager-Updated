
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  base: './', 
  server: {
    // Force file change detection in containerized environments
    watch: {
      usePolling: true,
    },
    // Prevent caching during development
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  build: {
    // Ensure fresh builds
    emptyOutDir: true,
  }
})
