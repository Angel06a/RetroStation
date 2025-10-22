const STATIC_CACHE_NAME = 'retrostation-static-v5'; // ¡VERSIÓN INCREMENTADA!
const RUNTIME_CACHE_NAME = 'retrostation-runtime-v4'; // ¡VERSIÓN INCREMENTADA!

// Lista de sistemas para generar URLs
const menuItems = [
    "3ds", "bios", "dos", "dreamcast", "gamegear", "gb", "gba", "gbc", "gc", "mame", "megadrive",
    "n64", "naomi2", "nds", "nes", "ps2", "ps3", "psp", "psx", "saturn", "snes", "snes-msu",
    "wii", "wiiu", "xbox"
];

// Generación de URLs de iconos (Sistemas/*.svg)
const systemIcons = menuItems.map(item => `./Sistemas/${item}.svg`);
// Generación de URLs de fondos (Fondos/*.jpg)
const systemBackgrounds = menuItems.map(item => `./Fondos/${item}.jpg`);


// 1. Archivos Críticos (App Shell) - Cacheo prioritario y obligatorio
// Incluye el Shell y todos los iconos de sistemas
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
    // === ICONOS DE SISTEMAS EN CACHE CRÍTICO ===
    ...systemIcons
];

// 2. Archivos No Críticos (Imágenes Grandes) - Cacheo en segundo plano
// Ahora solo contiene los fondos generados, eliminando el duplicado de psx.jpg
const nonCriticalImageCache = [
    // ELIMINADO: './Fondos/psx.jpg' (Está incluido en ...systemBackgrounds)
    // === FONDOS DE SISTEMAS EN CACHE NO CRÍTICO ===
    ...systemBackgrounds
];


// Instalación: Divide el cacheo en dos tareas asíncronas.
self.addEventListener('install', event => {
    // 1. Tarea Principal (Crítica): Debe completarse para instalar el SW.
    const criticalCachePromise = caches.open(STATIC_CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Cacheando shell estático y crítico');
            return cache.addAll(criticalUrlsToCache);
        });

    // 2. Tarea Secundaria (No Crítica): El cacheo de imágenes grandes se hace después.
    const imageCachePromise = caches.open(RUNTIME_CACHE_NAME)
        .then(cache => {
            console.log('Service Worker: Cacheando imágenes grandes en segundo plano');
            return cache.addAll(nonCriticalImageCache).catch(error => {
                // Manejar errores para que un fallo en una imagen no detenga el SW
                console.warn('Error al cachear imágenes no críticas:', error);
            });
        });

    // Esperamos por las promesas críticas.
    event.waitUntil(
        Promise.all([criticalCachePromise, imageCachePromise])
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

    // Estrategia Network-First para el resto (incluye los archivos de datos de juegos Games/*.js)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

