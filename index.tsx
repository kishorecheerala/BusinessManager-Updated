import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

// Service Worker Registration
// Skip registration in preview environments (AI Studio, StackBlitz, etc.) to prevent origin mismatch errors.
// These environments often serve the app in a sandboxed iframe with a different origin than the top window.
const isPreview = window.location.origin.includes('ai.studio') || 
                  window.location.origin.includes('usercontent.goog') ||
                  window.location.origin.includes('webcontainer.io');

if (isPreview) {
  console.log('Skipping Service Worker registration in preview environment');
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use relative paths to handle sub-path deployments
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        console.log('✅ Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)