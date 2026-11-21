import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        const sendPrecacheList = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const scripts = Array.from(
            document.querySelectorAll<HTMLScriptElement>('script[src]'),
            (el) => el.src,
          );
          const styles = Array.from(
            document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
            (el) => el.href,
          );
          worker.postMessage({
            type: 'PRECACHE_ASSETS',
            urls: [
              '/',
              '/?source=pwa',
              '/manifest.webmanifest',
              '/icons/wob-icon.svg',
              '/icons/wob-icon-180.png',
              '/icons/wob-icon-192.png',
              '/icons/wob-icon-512.png',
              ...scripts,
              ...styles,
            ],
          });
        };

        if (registration.active) {
          sendPrecacheList(registration.active);
        }
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'activated') {
              sendPrecacheList(installing);
            }
          });
        });
      })
      .catch((error: unknown) => {
        console.error('WOB service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
