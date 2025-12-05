
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { pwaManager } from './src/utils/pwa-register';

// Initialize PWA Manager
const initPWA = () => {
  // Small delay to prioritize main thread for initial render
  setTimeout(() => {
    pwaManager.init().catch(console.warn);
  }, 100);
};

if (document.readyState === 'complete') {
  initPWA();
} else {
  window.addEventListener('load', initPWA);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
