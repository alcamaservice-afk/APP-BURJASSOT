const CACHE_NAME = 'burjassot-app-v5.4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css?v=5.4',
  './app.js?v=5.4',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

// Install: scarica i nuovi file e forza l'attivazione immediata
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: cancella tutte le vecchie cache (compresa la v1, v2, v3, v4)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: ignora completamente le chiamate esterne (Google Apps Script)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // FONDAMENTALE: Se la richiesta è verso Google Apps Script o qualsiasi host esterno,
  // NON intercettarla affatto. Lascia che il browser la gestisca direttamente!
  if (!event.request.url.startsWith(self.location.origin) ||
      requestUrl.hostname.includes('script.google.com') ||
      requestUrl.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  // Network-first per i file dell'app con fallback su cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
