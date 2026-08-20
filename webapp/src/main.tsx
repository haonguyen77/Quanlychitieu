import React from 'react';
import ReactDOM from 'react-dom/client';
import { ResponsiveApp } from './app/ResponsiveApp';
import { useAppStore } from './core/store/appStore';
import './styles/index.css';

// Capture the PWA install prompt as EARLY as possible.
// `beforeinstallprompt` often fires before React mounts; if we only listen
// inside a component, the event is missed and the install button never shows.
// We stash it on window and re-broadcast so PwaInstall can pick it up anytime.
(() => {
  const w = window as unknown as { __pwaPrompt?: Event };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    w.__pwaPrompt = e;
    window.dispatchEvent(new Event('pwa-available'));
  });
  window.addEventListener('appinstalled', () => { w.__pwaPrompt = undefined; });
})();

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
