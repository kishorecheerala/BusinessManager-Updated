
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Only register Service Worker on supported protocols (HTTP/HTTPS)
    // This prevents errors in 'blob:' or 'file:' environments (like cloud previews)
    // and fixes the "protocol not supported" error.
    if (window.location.protocol.startsWith('http')) {
        try {
            // Construct absolute URL based on current window location to avoid origin mismatches
            // caused by <base> tags. We use window.location.href as the base to resolve ./sw.js
            // correctly relative to the app root.
            const swUrl = new URL('./sw.js', window.location.href).href;
            
            navigator.serviceWorker
                .register(swUrl, {
                    scope: './',
                    updateViaCache: 'none'
                })
                .then(reg => {
                    console.log('Service Worker registered successfully:', reg);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        } catch (e) {
            console.warn('Skipping Service Worker registration due to URL construction error:', e);
        }
    } else {
        console.log('Service Worker registration skipped: unsupported protocol', window.location.protocol);
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
