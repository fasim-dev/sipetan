// Service Worker untuk SiPetan - Versi Subfolder Fix
const CACHE_NAME = 'sipetan-v4';

// Dapatkan base path secara otomatis (contoh: /sipetan/)
const getBasePath = () => {
  const path = self.location.pathname;
  return path.substring(0, path.lastIndexOf('/') + 1);
};

const BASE_PATH = getBasePath();

// File yang akan di-cache
const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'style.css',
  BASE_PATH + 'app.js',
  BASE_PATH + 'manifest.json'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Install dengan base path:', BASE_PATH);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        try {
          await cache.addAll(urlsToCache);
          console.log('[SW] Cache berhasil');
        } catch (err) {
          console.log('[SW] Cache gagal:', err);
        }
      })
  );
  self.skipWaiting();
});

// Fetch dengan strategi cache-first
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // Perbaiki request yang salah ke root
  let fixedRequest = event.request;
  if (requestUrl.pathname === '/manifest.json') {
    fixedRequest = new Request(BASE_PATH + 'manifest.json');
  } else if (requestUrl.pathname === '/sw.js') {
    fixedRequest = new Request(BASE_PATH + 'sw.js');
  }
  
  event.respondWith(
    caches.match(fixedRequest)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(fixedRequest)
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(fixedRequest, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // Fallback ke index.html
            return caches.match(BASE_PATH + 'index.html');
          });
      })
  );
});

// Aktifkan Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Hapus cache lama:', cacheName);
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
