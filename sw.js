// Service Worker untuk SiPetan PWA
// Versi stabil - hanya cache file yang pasti ada

const CACHE_NAME = 'sipetan-v2';

// Hanya file yang PASTI ADA di folder Anda
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching files...');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('[SW] Cache failed:', err))
  );
  // Force aktivasi SW baru
  self.skipWaiting();
});

// Fetch dengan strategi cache-first, fallback ke network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response untuk cache
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => console.log('[SW] Cache put failed:', err));
            
            return response;
          })
          .catch(err => {
            console.log('[SW] Fetch failed:', err);
            // Bisa return fallback page jika diperlukan
            return new Response('Offline - SiPetan tidak dapat terhubung', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Aktifkan Service Worker dan hapus cache lama
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients...');
      return self.clients.claim();
    })
  );
});
