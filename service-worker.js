const CACHE_NAME = 'retrostation-cache-v4'; // 🚨 CAMBIO A: Nueva Versión

// Lista de todos los archivos estáticos de tu aplicación para caché inicial
// 🛠️ CRÍTICO: Se añade './' a TODAS las rutas para forzar resolución correcta 
// en el subdirectorio de GitHub Pages. Se excluye 'index.html' para evitar la Condición de Carrera.
const urlsToCache = [
    './main-menu.css',
    './grid-menu.css',
    './game-details.css',
    // Archivos JavaScript
    './Js/data.js',
    './Js/utils.js',
    './Js/game-data-loader.js',
    './Js/main-modal-manager.js',
    './Js/game-grid-nav.js',
    './Js/mediafire-downloader.js',
    './Js/game-details-logic.js',
    './Js/ui-logic.js',
    // Íconos e imágenes
    './Icons/back.svg',
    './Icons/loading.svg',
    './Icons/favicon.png',
    './Icons/preview.jpg',
    // Íconos PWA
    './Icons/pwa-icon-192.png',
    './Icons/pwa-icon-512.png',
];

// Evento 1: Instalación (almacenar archivos estáticos en caché)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache Abierta');
        // Agrega todos los archivos restantes a la caché
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        // MUY IMPORTANTE: Este catch capturará el error "Request failed"
        console.error('Error CRÍTICO al cachear archivos. Revise cada ruta:', err);
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
  // Ignora las solicitudes externas (como mediafire)
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
        
        // Si no está en caché, va a la red. Si es el 'index.html' o '/', 
        // lo cachea aquí para las próximas visitas.
        return fetch(event.request).then(
          function(response) {
            // Verifica que la respuesta sea válida
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Si es un recurso local que queremos cachear, lo clonamos.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Esto cachea el index.html y otros archivos en la primera visita exitosa
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      }
    )
  );
});
