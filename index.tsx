
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
    // Check for supported protocols to avoid errors in some preview environments
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
        try {
            // Register the Service Worker with a scope that matches manifest.json
            navigator.serviceWorker
                .register('./sw.js', {
                    scope: './',
                    updateViaCache: 'none'
                })
                .then(reg => {
                    console.log('Service Worker registered successfully with scope:', reg.scope);
                    
                    // Optional: Check for updates immediately
                    reg.update();
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        } catch (e) {
            console.warn('Skipping Service Worker registration:', e);
        }
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
