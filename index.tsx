
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { pwaManager } from './src/utils/pwa-register';

// Initialize PWA Manager
// Checks for service worker support and handles registration
// Skip in preview environments (AI Studio, WebContainers) AND Localhost to prevent caching during dev
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.'); // Android Emulator uses 10.0.2.2

const isPreview = window.location.origin.includes('ai.studio') || 
                  window.location.origin.includes('usercontent.goog') ||
                  window.location.origin.includes('webcontainer.io');

// You can force PWA in dev by adding ?force-pwa=true to the URL
const shouldEnablePWA = !isPreview && (!isLocal || window.location.search.includes('force-pwa'));

if (shouldEnablePWA) {
  // Use the load event to ensure document is ready before registering SW
  const initPWA = () => {
    setTimeout(() => {
      pwaManager.init().catch(console.warn);
    }, 100);
  };

  if (document.readyState === 'complete') {
    initPWA();
  } else {
    window.addEventListener('load', initPWA);
  }
} else {
  console.log('🚫 PWA Disabled: Development/Preview Environment detected.');
  // If we are in dev but a service worker exists (from a previous prod run), unregister it to clear cache
  if ('serviceWorker' in navigator) {
      const safeUnregister = async () => {
          try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              let unregistered = false;
              for(const registration of registrations) {
                  await registration.unregister();
                  console.log('🧹 Unregistered existing Service Worker for Development');
                  unregistered = true;
              }
              
              // Force reload if we just killed a controller to ensure fresh network assets
              if (unregistered && navigator.serviceWorker.controller) {
                  console.log('♻️ Reloading page to clear Service Worker control...');
                  window.location.reload();
              }
          } catch (e) {
              console.warn("Service Worker cleanup skipped (Restricted Env):", e);
          }
      };

      // Run immediately
      safeUnregister();
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
