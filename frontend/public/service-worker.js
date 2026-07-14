// D-Billet service worker - production-safe caching strategy.
// Strategy:
//   * Navigation/HTML  : network-first with offline fallback (always fetch latest UI)
//   * /api/*           : network-only (never cached)
//   * Static assets    : cache-first
//   * Cross-origin     : passthrough (no caching, no interception of POST/PUT/etc.)
const CACHE_VERSION = 'dbillet-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/dbillet-logo.png',
  '/images/dbillet-icon.png',
  '/images/dbillet-mark.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))),
    ),
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING from the app to force an immediate activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache the API
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return;

  // Navigation requests: network-first, fall back to cached index.html for offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});
