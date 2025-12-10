
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

const isAIStudioEnvironment = () => {
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('preview') || hostname.includes('staging') || hostname.includes('ai.studio') || hostname.includes('usercontent.goog') || hostname.includes('webcontainer.io');
}

if ('serviceWorker' in navigator && !isAIStudioEnvironment()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('✅ SW registered'))
      .catch(err => console.error('❌ SW failed:', err))
  })
} else {
    console.log('Skipping service worker registration in this environment.');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
