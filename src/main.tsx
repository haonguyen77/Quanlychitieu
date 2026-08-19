import React from 'react';
import ReactDOM from 'react-dom/client';
import { ResponsiveApp } from './app/ResponsiveApp';
import { useAppStore } from './core/store/appStore';
import './styles/index.css';

// Initialize app data (IndexedDB + optional Drive sync)
useAppStore.getState().initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResponsiveApp />
  </React.StrictMode>,
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed - app still works without it
    });
  });
}
