import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Register Service Worker FIRST - before anything else
// This ensures the install script runs as early as possible for PWA capabilities

// SKIP Service Worker in AI Studio / Sandbox environments to prevent "Origin Mismatch" errors
// The preview environment often serves content from dynamic domains (googleusercontent) that clash with absolute path resolution
if (window.location.origin.includes('ai.studio') || window.location.origin.includes('googleusercontent')) {
  console.log('Skipping Service Worker registration in AI Studio/Sandbox environment.');
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // We register at root scope to control the whole app
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        console.log('✅ Service Worker registered with scope:', registration.scope);
      })
      .catch((err) => {
        console.warn('❌ Service Worker registration failed:', err);
      });
  });
}

const rootElement = document.getElementById('root');

// Safe Render
// Wrap in try-catch to log render errors preventing blank screens
if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('App render error:', error);
  }
} else {
  console.error("Could not find root element to mount to");
}