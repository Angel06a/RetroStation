const CACHE_NAME = 'retrostation-v1';
// Lista de archivos para cachear. Asegúrate de que esta lista esté actualizada con todos tus archivos estáticos.
const urlsToCache = [
    './',
    './index.html',
    './main-menu.css',
    './grid-menu.css',
    './game-details.css',
    './Icons/favicon.png',
    './Icons/back.svg',
    './Icons/loading.svg',
    './Icons/favicon-192.png', // Nuevo icono PWA
    './Icons/favicon-512.png', // Nuevo icono PWA
    './Js/data.js',
    './Js/utils.js',
    './Js/game-data-loader.js',
    './Js/main-modal-manager.js',
    './Js/game-grid-nav.js',
    './Js/mediafire-downloader.js',
    './Js/game-details-logic.js',
    './Js/ui-logic.js'
    // **Importante:** Considera agregar los Fondos (background images) que se usan en la página principal (e.g., psx.jpg)
];

self.addEventListener('install', event => {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            }
        )
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});