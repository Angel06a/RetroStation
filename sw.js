const STATIC_CACHE_NAME = 'retrostation-static-v3'; // Incrementamos la versión para forzar la actualización
const RUNTIME_CACHE_NAME = 'retrostation-runtime-v2';

// 1. Archivos Críticos (App Shell) - Cacheo prioritario y obligatorio
const criticalUrlsToCache = [
    './',
    './index.html',
    './main-menu.css',
    './grid-menu.css',
    './game-details.css',
    './Icons/favicon.png',
    './Icons/back.svg',
    './Icons/loading.svg',
    './Icons/favicon-192.png',
    './Icons/favicon-512.png',
    './Js/data.js',
    './Js/utils.js',
    './Js/game-data-loader.js',
    './Js/main-modal-manager.js',
    './Js/game-grid-nav.js',
    './Js/mediafire-downloader.js',
    './Js/game-details-logic.js',
    './Js/ui-logic.js',
    './Js/data-parser-worker.js' // AÑADIDO: Worker Script
];

// 2. Archivos No Críticos (Imágenes Grandes) - Cacheo en segundo plano
const nonCriticalImageCache = [
    './Fondos/psx.jpg' // Esto se precachea aquí.
    // Añade aquí otros fondos si son cruciales para el inicio.
];


// Instalación: Divide el cacheo en dos tareas asíncronas.
// El cacheo de recursos críticos debe completarse antes de que el SW esté instalado.
self.addEventListener('install', event => {
    // 1. Tarea Principal (Crítica): Debe completarse para instalar el SW.
    const criticalCachePromise = caches.open(STATIC_CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Cacheando shell estático y crítico');
            return cache.addAll(criticalUrlsToCache);
        });

    // 2. Tarea Secundaria (No Crítica): El cacheo de imágenes grandes se hace después.
    // Esto asegura que las peticiones de red por imágenes no bloqueen la instalación del shell,
    // pero se maneja de forma asíncrona dentro del hilo del SW.
    const imageCachePromise = caches.open(RUNTIME_CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Cacheando imágenes grandes en segundo plano');
            return cache.addAll(nonCriticalImageCache).catch(error => {
                // Es importante manejar errores aquí para que un fallo en una imagen no detenga el SW
                console.warn('Error al cachear imágenes no críticas:', error);
            });
        });

    // Esperamos por las promesas críticas. La promesa de la imagen está separada.
    event.waitUntil(
        Promise.all([criticalCachePromise, imageCachePromise])
    );
});

// Activación: Elimina cachés antiguas (igual que antes)
self.addEventListener('activate', event => {
    const cacheWhitelist = [STATIC_CACHE_NAME, RUNTIME_CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch: Estrategias de cacheo (igual que antes, ya optimizadas)
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // Estrategia Cache-First para el Shell
    if (criticalUrlsToCache.includes(requestUrl.pathname) || requestUrl.pathname === '/') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
        return;
    }

    // Estrategia Stale-While-Revalidate para imágenes y mediafire (RUNTIME_CACHE)
    if (event.request.destination === 'image' || requestUrl.hostname.includes('mediafire')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(response => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // Estrategia Network-First para el resto
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
