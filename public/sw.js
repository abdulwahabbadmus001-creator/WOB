const CACHE_VERSION = 'wob-pwa-v3';
const RUNTIME_CACHE = 'wob-runtime-v3';

const APP_SHELL = [
  '/',
  '/?source=pwa',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/wob-icon.svg',
  '/icons/wob-icon-180.png',
  '/icons/wob-icon-192.png',
  '/icons/wob-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Cache each core shell entry resiliently
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res.ok) {
              await cache.put(url, res.clone());
            }
          } catch {
            // Ignore single asset failure during offline install
          }
        }),
      );

      // Parse index HTML to automatically discover and pre-cache all hashed Vite bundle assets
      try {
        const rootRes = (await cache.match('/')) || (await cache.match('/index.html'));
        if (rootRes) {
          const html = await rootRes.text();
          const assetMatches = Array.from(
            html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g),
            (m) => m[1],
          );
          const uniqueAssets = Array.from(new Set(assetMatches));
          await Promise.allSettled(
            uniqueAssets.map(async (assetUrl) => {
              const res = await fetch(assetUrl, { cache: 'reload' });
              if (res.ok) {
                await cache.put(assetUrl, res.clone());
              }
            }),
          );
        }
      } catch {
        // Ignore HTML parse errors
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (data.type === 'PRECACHE_ASSETS' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_VERSION);
        await Promise.allSettled(
          data.urls.map(async (url) => {
            if (typeof url !== 'string') return;
            const existing = await cache.match(url);
            if (!existing) {
              const res = await fetch(url);
              if (res.ok) {
                await cache.put(url, res.clone());
              }
            }
          }),
        );
      })(),
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'wob-leaderboard-sync') {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: 'FLUSH_OFFLINE_SYNC_QUEUE' });
        }
      })(),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts =
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isGoogleFonts) {
    return;
  }

  // 1. Navigation requests: Network-First with fast offline fallback to cached app shell
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_VERSION);
            await cache.put(request, networkResponse.clone());
            await cache.put('/', networkResponse.clone());
            await cache.put('/?source=pwa', networkResponse.clone());
            return networkResponse;
          }
        } catch {
          // Offline: fall through to cache
        }

        const cache = await caches.open(CACHE_VERSION);
        return (
          (await cache.match(request)) ||
          (await cache.match('/?source=pwa')) ||
          (await cache.match('/')) ||
          (await cache.match('/index.html')) ||
          new Response('WOB Offline Mode Ready — Reload app', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        );
      })(),
    );
    return;
  }

  // 2. Static assets (JS, CSS, Icons, Manifest, Fonts): Cache-First with background cache fill
  const isStaticAsset =
    isGoogleFonts ||
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest';

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match(request, { ignoreSearch: url.pathname.startsWith('/assets/') })) ||
          (await caches.match(url.pathname));
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response && (response.ok || response.type === 'opaque')) {
            const targetCache = await caches.open(
              isGoogleFonts ? RUNTIME_CACHE : CACHE_VERSION,
            );
            await targetCache.put(request, response.clone());
          }
          return response;
        } catch {
          if (isGoogleFonts && url.hostname === 'fonts.googleapis.com') {
            return new Response('/* offline font fallback */', {
              status: 200,
              headers: { 'Content-Type': 'text/css; charset=utf-8' },
            });
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        }
      })(),
    );
  }
});
