// =========================================================================
// sw.js: Service Worker para RetroStation (Estrategias avanzadas de caché)
// =========================================================================

// --- NOMBRES DE CACHÉ ---
// Incrementa la versión para forzar una actualización del Service Worker.
const CACHE_VERSION = 'v6.1'; 
const STATIC_CACHE = `retrostation-static-${CACHE_VERSION}`;
const ASSETS_CACHE = `retrostation-assets-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'retrostation-runtime'; // No versionamos el caché dinámico para persistencia.

// --- CONFIGURACIÓN DE ARCHIVOS ---

// Lista de sistemas (debe ser el mismo que en data.js, lo mantenemos aquí por si no está disponible)
const menuItems = [
    "3ds", "bios", "dos", "dreamcast", "gamegear", "gb", "gba", "gbc", "gc", "mame", "megadrive",
    "n64", "naomi2", "nds", "nes", "ps2", "ps3", "psp", "psx", "saturn", "snes", "snes-msu",
    "wii", "wiiu", "xbox"
];

// Generación de URLs de Iconos y Fondos
const SYSTEM_ICONS = menuItems.map(item => `./Sistemas/${item}.svg`);
const SYSTEM_BACKGROUNDS = menuItems.map(item => `./Fondos/${item}.jpg`);

// Archivos Críticos (App Shell y Scripts) - Cache First, solo se actualiza con nueva versión SW
const CRITICAL_SHELL_FILES = [
    './',
    './index.html',
    './main-menu.css',
    './grid-menu.css',
    './game-details.css',
    './manifest.json', // Añadido el manifest
    './Icons/favicon.png',
    './Icons/back.svg',
    './Icons/loading.svg',
    './Icons/favicon-192.png',
    './Icons/favicon-512.png',
    './Js/data.js',
    './Js/utils.js',
    './Js/game-data-loader.js',
    './Js/main-modal-manager.js',
    './Js/game-grid-nav.js', // Asegurado que esté la nueva dependencia game-grid-nav.js
    './Js/mediafire-downloader.js',
    './Js/game-details-logic.js',
    './Js/ui-logic.js',
    ...SYSTEM_ICONS // Iconos críticos para el menú principal
];

// Archivos de Assets (Fondos Grandes) - Cache First o Stale-While-Revalidate si la lista fuera enorme
const ASSET_FILES = [
    ...SYSTEM_BACKGROUNDS
];


// =========================================================================
// --- ETAPAS DEL SERVICE WORKER ---
// =========================================================================

// 1. Instalación: Cachea los archivos estáticos y assets.
self.addEventListener('install', event => {
    // Tarea Crítica: Cacheo del App Shell
    const criticalCachePromise = caches.open(STATIC_CACHE)
        .then(cache => {
            console.log(`[SW:${CACHE_VERSION}] Cacheando shell estático y crítico...`);
            return cache.addAll(CRITICAL_SHELL_FILES).catch(error => {
                console.error('[SW ERROR] Fallo al cachear archivos críticos:', error);
                throw error; // Falla la instalación si el shell no se puede cachear
            });
        });

    // Tarea Secundaria: Cacheo de assets (fondos)
    const assetCachePromise = caches.open(ASSETS_CACHE)
        .then(cache => {
            console.log(`[SW:${CACHE_VERSION}] Cacheando assets grandes en segundo plano...`);
            // Permitimos que falle la descarga de un asset sin detener la instalación.
            return cache.addAll(ASSET_FILES).catch(error => {
                console.warn('[SW WARN] Error al cachear assets:', error);
            });
        });

    // Esperamos que ambas tareas finalicen para completar la instalación (al menos la crítica).
    event.waitUntil(
        Promise.all([criticalCachePromise, assetCachePromise])
    );
});

// 2. Activación: Elimina cachés antiguas.
self.addEventListener('activate', event => {
    const cacheWhitelist = [STATIC_CACHE, ASSETS_CACHE, RUNTIME_CACHE];
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Eliminamos todos los cachés que no estén en la lista blanca
                    if (cacheName.includes('retrostation-') && !cacheWhitelist.includes(cacheName)) {
                        console.log('Service Worker: Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Asegura que el SW toma control de las páginas existentes inmediatamente
            return self.clients.claim();
        })
    );
});


// 3. Fetch: Estrategias de cacheo en tiempo de ejecución.
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    const requestPath = requestUrl.pathname;
    const isCritical = CRITICAL_SHELL_FILES.includes(requestPath) || requestPath === '/';
    const isAsset = ASSET_FILES.includes(requestPath) || event.request.destination === 'image';
    const isGameData = requestPath.startsWith('./Games/') && requestPath.endsWith('.js');
    const isMediafire = requestUrl.hostname.includes('mediafire');

    // --- ESTRATEGIA 1: Cache First (Shell estático) ---
    // Archivos críticos y estáticos. Si están en caché, los devuelve inmediatamente.
    if (isCritical) {
        event.respondWith(
            caches.match(event.request, { cacheName: STATIC_CACHE })
                .then(response => response || fetch(event.request))
        );
        return;
    }
    
    // --- ESTRATEGIA 2: Stale-While-Revalidate (Imágenes, Assets y Descargas Mediafire) ---
    // Devuelve el caché inmediatamente y actualiza el caché en segundo plano.
    if (isAsset || isMediafire) {
        event.respondWith(
            caches.open(RUNTIME_CACHE).then(cache => {
                // Devuelve la respuesta del caché si está disponible
                return cache.match(event.request).then(response => {
                    // Siempre intenta obtener la versión de red
                    const fetchPromise = fetch(event.request).then(networkResponse => {
                        // Si la respuesta es válida, la actualiza en el caché
                        if (networkResponse.ok) {
                            // Clonamos para que el navegador pueda usar una y el caché la otra
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(err => {
                        console.warn(`[SW WARN] Fallo de red para ${requestUrl.pathname}:`, err);
                        // Si falla la red y no tenemos caché, esto lanzará un error.
                        throw err; 
                    });
                    
                    // Devuelve la caché si existe, sino espera la red.
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // --- ESTRATEGIA 3: Network First (Archivos de datos de juegos y otros no cubiertos) ---
    // Intenta ir a la red primero, si falla, usa el caché.
    if (isGameData) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Si la red falla para los datos de juegos, busca en el caché estático o de runtime
                return caches.match(event.request).then(response => {
                    if (response) return response;
                    // Si no está en ningún caché, intenta los otros (por si acaso)
                    return caches.match(event.request, { cacheName: STATIC_CACHE })
                           || caches.match(event.request, { cacheName: ASSETS_CACHE });
                });
            })
        );
        return;
    }
    
    // Fallback por defecto: Network First
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
