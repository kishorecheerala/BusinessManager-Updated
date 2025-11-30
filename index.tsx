
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// ====== SERVICE WORKER REGISTRATION ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use './sw.js' (relative) instead of '/sw.js' (absolute) to prevent Origin Mismatch errors 
    // in hosted environments like AI Studio or sub-paths.
    navigator.serviceWorker
      .register('./sw.js') 
      .then((registration) => {
        console.log('✅ Service Worker registered with scope:', registration.scope);
        
        // Check for updates every 10 minutes
        setInterval(() => {
          registration.update();
        }, 600000);
      })
      .catch((error) => {
        // Log warning but do not crash the app
        console.warn('⚠️ Service Worker registration failed (Offline mode may not work):', error);
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
