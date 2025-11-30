
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Service Worker Registration Logic
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Use relative path './sw.js' to respect base paths and potentially avoid some origin issues
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      console.log('✅ Service Worker registered:', registration);
      
      // Periodically update the SW
      setInterval(() => registration.update(), 60 * 60 * 1000);
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 New SW available');
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        }
      });
    } catch (error: any) {
      // Gracefully handle origin mismatch errors common in cloud preview environments
      if (error.message && (error.message.includes('origin') || error.message.includes('scriptURL'))) {
        console.warn('⚠️ Service Worker registration skipped: Origin mismatch. This is normal in cloud preview environments serving assets from a CDN.');
      } else {
        console.error('❌ SW registration failed:', error);
      }
    }
  }
};

// Check if the page is already loaded before attaching listener
if (document.readyState === 'complete') {
  registerServiceWorker();
} else {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
