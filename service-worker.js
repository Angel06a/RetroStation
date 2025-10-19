const CACHE_NAME = 'retrostation-cache-v5'; // 🚨 CAMBIO A: Nueva Versión

// 🚨 CRÍTICO: Reemplaza [NOMBRE_DEL_REPOSITORIO] por el nombre exacto de tu repositorio (ej: 'RetroStation').
// Esto obliga al Service Worker a buscar los archivos en la ubicación correcta.
const REPO_NAME = 'RetroStation'; 

const urlsToCache = [
    // CRÍTICO: Excluimos la raíz (index.html) para evitar el conflicto de red inicial.
    // Los demás archivos requieren el prefijo del repositorio.
    `/${REPO_NAME}/main-menu.css`,
    `/${REPO_NAME}/grid-menu.css`,
    `/${REPO_NAME}/game-details.css`,
    // Archivos JavaScript
    `/${REPO_NAME}/Js/data.js`,
    `/${REPO_NAME}/Js/utils.js`,
    `/${REPO_NAME}/Js/game-data-loader.js`,
    `/${REPO_NAME}/Js/main-modal-manager.js`,
    `/${REPO_NAME}/Js/game-grid-nav.js`,
    `/${REPO_NAME}/Js/mediafire-downloader.js`,
    `/${REPO_NAME}/Js/game-details-logic.js`,
    `/${REPO_NAME}/Js/ui-logic.js`,
    // Íconos e imágenes
    `/${REPO_NAME}/Icons/back.svg`,
    `/${REPO_NAME}/Icons/loading.svg`,
    `/${REPO_NAME}/Icons/favicon.png`,
    `/${REPO_NAME}/Icons/preview.jpg`,
    // Íconos PWA
    `/${REPO_NAME}/Icons/pwa-icon-192.png`,
    `/${REPO_NAME}/Icons/pwa-icon-512.png`,
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

// [El código de activate y fetch (Eventos 2 y 3) sigue igual...]

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(
          function(response) {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      }
    )
  );
});
