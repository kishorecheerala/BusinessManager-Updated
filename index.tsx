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
    // First, unregister ALL old service workers to ensure clean state
    // We catch errors here to prevent "The document is in an invalid state" from crashing the app
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (let registration of registrations) {
        console.log('[App] Unregistering old SW:', registration.scope);
        registration.unregister();
      }
      
      // Wait a moment, then register the new one
      setTimeout(() => {
        navigator.serviceWorker
          .register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('✅ New SW registered successfully');
            console.log('   Scope:', registration.scope);
          })
          .catch((err) => {
            console.error('❌ New SW registration failed:', err.message);
          });
      }, 500);
    }).catch((err) => {
        // This catch block handles "Failed to get ServiceWorkerRegistration objects: The document is in an invalid state."
        console.warn('Service Worker registration skipped/failed (likely due to page unload):', err);
    });
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