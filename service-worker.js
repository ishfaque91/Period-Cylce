/* ============================================================
   Cycle & Us — Service Worker
   Handles offline caching and background updates for the PWA.
   ============================================================ */

// Bump this version string any time the app's files change —
// that's what tells the browser to fetch and cache fresh copies.
const CACHE_VERSION = 'cycle-and-us-v2';

// Everything needed for the app shell to load and run offline,
// including the external SDKs it depends on.
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'
];

/* ---- Install: download and cache the app shell ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll fails the whole batch if even one request fails, so we
      // fetch each file individually and just skip any that fail —
      // keeps install resilient to a flaky network on first visit.
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((response) => cache.put(url, response))
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting(); // activate the new service worker immediately
});

/* ---- Activate: remove any old, outdated caches ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // take control of any already-open tabs right away
});

/* ---- Fetch: serve from cache, but always try the network first
   for the main page so users get the latest version whenever
   they're online. Falls back to the cached copy when offline. ---- */
self.addEventListener('fetch', (event) => {
  const isNavigation = event.request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // For everything else (scripts, icons, manifest): serve from cache
  // instantly if we have it, otherwise fetch and cache it for next time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
