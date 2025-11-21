import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BeforeInstallPromptEvent } from './types';

// --- PWA Install Prompt Handling ---
// We capture the event outside of React's lifecycle to ensure it's not missed,
// especially with React.StrictMode's double-invocation behavior in development.
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later by the React app.
  (window as any).deferredInstallPrompt = e as BeforeInstallPromptEvent;
});
// --- End PWA Handling ---


// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }).catch(error => {
      console.log('ServiceWorker registration failed: ', error);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);