const STATIC_CACHE_NAME = 'retrostation-static-v2';
const RUNTIME_CACHE_NAME = 'retrostation-runtime-v1';

// Lista de archivos estáticos críticos para el Shell de la aplicación
const staticUrlsToCache = [
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
    './Js/ui-logic.js'
];

// Lista de imágenes de fondo (importante para el UX inicial)
const initialImageCache = [
    './Fondos/psx.jpg' // Asegúrate de que esta URL sea correcta.
    // Añade aquí otros fondos si son cruciales para el inicio.
];


// Instalación: Cachea el shell de la aplicación (los archivos estáticos)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Cacheando shell estático');
                return cache.addAll(staticUrlsToCache.concat(initialImageCache));
            })
    );
});

// Activación: Elimina cachés antiguas
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

// Fetch: Estrategias de cacheo
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // 1. Estrategia Cache-First para el Shell (archivos estáticos)
    // Esto asegura que el HTML, CSS y JS carguen al instante.
    if (staticUrlsToCache.includes(requestUrl.pathname) || requestUrl.pathname === '/') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Si está en la caché estática, úsalo. Si no, ve a la red.
                    return response || fetch(event.request);
                })
        );
        return; // Detiene el flujo para esta petición
    }

    // 2. Estrategia Stale-While-Revalidate para imágenes (RUNTIME_CACHE)
    // Esto es ideal para las portadas de los juegos. Sirve la versión cacheadas 
    // al instante y luego la actualiza en segundo plano.
    if (event.request.destination === 'image' || requestUrl.hostname.includes('mediafire')) {
        event.respondWith(
            caches.open(RUNTIME_CACHE_NAME).then(cache => {
                // Sirve desde la caché
                return cache.match(event.request).then(response => {
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        // Actualiza la caché en segundo plano
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    });

                    // Retorna la respuesta de la caché o la promesa de la red
                    return response || fetchPromise;
                });
            })
        );
        return; // Detiene el flujo
    }

    // 3. Estrategia Network-First para el resto (por defecto)
    // Usada para peticiones externas o datos que deben ser frescos.
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
