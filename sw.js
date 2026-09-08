/**
 * sw.js - Service Worker para funcionamiento 100% Offline
 * Permite que la Agenda Escolar funcione sin conexión a internet en móvil, tablet y PC.
 */

const CACHE_NAME = 'agenda-escolar-v3.5.2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './notebook.html',
  './styles.css',
  './app.js',
  './ai-assistant.js',
  './notebook.js',
  './db.js',
  './camera.js',
  './annotations.js',
  './audio.js',
  './qr.js',
  './ocr.js',
  './gamification.js',
  './notifications.js',
  './ics-export.js',
  './pdf-export.js',
  './google-drive-sync.js',
  './firebase-sync.js',
  './flashcards.js',
  './libs/jspdf.umd.min.js',
  './libs/tesseract.min.js',
  './libs/worker.min.js',
  './manifest.webmanifest',
  './icon.svg'
];

// Instalación del Service Worker: cachear recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos de la aplicación para offline');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches obsoletas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando cache antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Fetch: Network-First para navegación (HTML siempre fresco), Cache-First para estáticos
self.addEventListener('fetch', (event) => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // Navegación (HTML de páginas): buscar primero en la red para que las actualizaciones se vean al instante
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retornar de la cache de inmediato, e intentar actualizar en background si hay red
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Offline, no hay problema
        });

        return cachedResponse;
      }

      // Si no está en cache, buscar en la red y guardar en cache
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Si todo falla (ej. navegación offline a ruta nueva), servir index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
