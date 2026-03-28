// Try to load Workbox from CDN; fall back to basic caching if unavailable
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');
} catch {
  // Workbox unavailable — basic SW continues below
}

const OFFLINE_CACHE = 'offline-fallback';
const OFFLINE_URL = '/offline.html';

// Precache offline.html and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Set up Workbox routes if available
if (typeof workbox !== 'undefined') {
  const { registerRoute } = workbox.routing;
  const { CacheFirst, NetworkFirst, NetworkOnly } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  // Cache static assets (JS, CSS, images, fonts) with CacheFirst
  registerRoute(
    ({ request }) => ['script', 'style', 'image', 'font'].includes(request.destination),
    new CacheFirst({
      cacheName: 'static-assets',
      plugins: [
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        new CacheableResponsePlugin({ statuses: [0, 200] }),
      ],
    }),
  );

  // API responses use NetworkOnly — no caching to prevent cross-user data leaks
  // (authenticated responses vary by Authorization header which is not in the cache key)
  registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());

  // Cache navigation requests with NetworkFirst + offline fallback
  registerRoute(
    ({ request }) => request.mode === 'navigate',
    new NetworkFirst({
      cacheName: 'pages',
      plugins: [
        new ExpirationPlugin({ maxEntries: 25 }),
        {
          handlerDidError: async () => {
            const cachedResponse = await caches.match(OFFLINE_URL);
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              '<!doctype html><html><head><meta charset="UTF-8"><title>Offline</title></head><body><h1>You are offline</h1></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=UTF-8' } },
            );
          },
        },
      ],
    }),
  );
} else {
  // Fallback: basic fetch handler when Workbox is unavailable
  self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request).catch(async () => {
          const cachedResponse = await caches.match(OFFLINE_URL);
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            '<!doctype html><html><head><meta charset="UTF-8"><title>Offline</title></head><body><h1>You are offline</h1></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=UTF-8' } },
          );
        }),
      );
    }
  });
}
