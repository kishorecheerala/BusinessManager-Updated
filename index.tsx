import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

// Service Worker Registration
// Skip registration in sandbox/preview environments to avoid origin mismatch errors
const isSandbox = location.origin.includes('ai.studio') || location.origin.includes('usercontent.goog');

if (isSandbox) {
  console.log('Skipping Service Worker registration in sandbox environment');
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(err => console.error('SW registration failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)