const CACHE_NAME = 'retrostation-cache-v1';

// Lista de todos los archivos estáticos de tu aplicación para caché inicial
// 🚨 CRÍTICO: Se eliminaron las barras iniciales '/' para asegurar compatibilidad con GitHub Pages.
const urlsToCache = [
    'index.html', // NOTA: 'index.html' en lugar de '/'
    'main-menu.css',
    'grid-menu.css',
    'game-details.css',
    // Archivos JavaScript (la ruta de la carpeta 'Js/' se mantiene, pero sin el '/' inicial)
    'Js/data.js',
    'Js/utils.js',
    'Js/game-data-loader.js',
    'Js/main-modal-manager.js',
    'Js/game-grid-nav.js',
    'Js/mediafire-downloader.js',
    'Js/game-details-logic.js',
    'Js/ui-logic.js',
    // Íconos e imágenes (la ruta de la carpeta 'Icons/' se mantiene, pero sin el '/' inicial)
    'Icons/back.svg',
    'Icons/loading.svg',
    // ❌ IMPORTANTE: Si no tienes Icons/placeholder.svg, asegúrate de que tampoco esté aquí
    // 'Icons/placeholder.svg', 
    'Icons/favicon.png',
    'Icons/preview.jpg',
    // Íconos PWA
    'Icons/pwa-icon-192.png',
    'Icons/pwa-icon-512.png',
];

// Evento 1: Instalación (almacenar archivos estáticos en caché)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache Abierta');
        // Agrega todos los archivos a la caché
        // Si addAll falla, el Service Worker no se instalará.
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        // MUY IMPORTANTE: Este catch capturará el error "Request failed"
        console.error('Error CRÍTICO al cachear archivos. Revise cada ruta:', err);
        // Opcional: Para ver qué archivo falló, puedes registrar la lista completa
        console.error('Lista de archivos que fallaron al intentar cachear:', urlsToCache);
      })
  );
});

// Evento 2: Activación (limpiar cachés viejos)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre de la caché no está en la whitelist, bórrala
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento 3: Fetch (servir desde la caché o ir a la red)
self.addEventListener('fetch', event => {
  // Ignora las solicitudes externas (como mediafire) y sólo cachéa los assets locales
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Devuelve el recurso desde la caché si está disponible
        if (response) {
          return response;
        }
        // De lo contrario, solicita el recurso a la red
        return fetch(event.request);
      }
    )
  );
});
