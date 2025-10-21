// service-worker.js

const CACHE_NAME = 'retrostation-v1';

// Lista de todos los archivos que deben ser precargados y almacenados en caché.
// ¡Asegúrate de que esta lista esté COMPLETA y sea CORRECTA!
const ASSETS_TO_CACHE = [
    './', // Ruta raíz para el index.html
    './index.html',
    './manifest.json',
    './service-worker.js',
    
    // --- CSS Asíncrono ---
    './Css/game-details.css',
    './Css/grid-menu.css',
    './Css/main-menu.css',

    // --- Javascript ---
    './Js/data.js', // (Si existe)
    './Js/utils.js',
    './Js/game-data-loader.js',
    './Js/main-modal-manager.js',
    './Js/game-grid-nav.js',
    './Js/mediafire-downloader.js',
    './Js/game-details-logic.js',
    './Js/ui-logic.js',

    // --- Íconos y Assets Comunes ---
    './Icons/favicon.png',
    './Icons/back.svg',
    './Icons/close.svg',
    './Icons/loading.svg',
    // Asegúrate de incluir el ícono 512x512 si lo creaste
    // './Icons/favicon-512.png', 

    // --- Fuentes (Si tienes) ---
    // Agrega aquí rutas a fuentes si las usas

    // --- Imágenes de Sistemas (SVG) ---
    // Estas se cargan dinámicamente, si son pocos, es mejor listarlos para caching
    // Ejemplo:
    // './Sistemas/psx.svg', 
    // './Sistemas/nintendo.svg', 
    // etc. (Añade todos los archivos .svg de 'Sistemas/' aquí)
];

// Instalar Service Worker e inicializar caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Precaching recursos...');
                // fetch(request) falla si el recurso no está disponible, 
                // por eso usamos addAll. El 'mode: "no-cors"' es útil 
                // si se cachean recursos de CDN, pero no es estrictamente 
                // necesario para archivos locales.
                return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                    console.error('[Service Worker] Error al precachear:', err);
                    // No fallar si el precaching falla parcialmente, pero es un aviso
                });
            })
            .then(() => self.skipWaiting())
    );
});

// Activar Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando caché antigua:', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});

// Estrategia de Cache-first para peticiones
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones HTTP/HTTPS (excluir extensiones como chrome-extension://)
    if (event.request.url.startsWith('http')) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - devolver respuesta de la caché
                    if (response) {
                        return response;
                    }

                    // No hay caché - intentar obtener de la red
                    return fetch(event.request).then(
                        (response) => {
                            // Comprobar si recibimos una respuesta válida
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }

                            // IMPORTANTE: Clonar la respuesta.
                            // Una respuesta es un stream y solo puede ser consumida una vez.
                            const responseToCache = response.clone();

                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    // No cachear solicitudes que contengan 'Games/' (archivos grandes)
                                    // Ni tampoco archivos .jpg o .webp grandes de fondos.
                                    if (!event.request.url.includes('/Games/') && 
                                        !event.request.url.includes('/Fondos/') &&
                                        !event.request.url.match(/\.(jpg|webp|png)$/i)) 
                                    {
                                        cache.put(event.request, responseToCache);
                                    }
                                });

                            return response;
                        }
                    ).catch((error) => {
                        // Esto se dispara si no hay red (offline)
                        console.log('[Service Worker] Fetch fallido para:', event.request.url, error);
                        // Puedes devolver una página offline de fallback aquí si la tuvieras
                        // Por ahora, solo devolver un error de red
                        // return caches.match('/offline.html'); 
                    });
                })
        );
    }
});