const CACHE_NAME = 'retrostation-cache-v7'; // 🚨 CAMBIO CRÍTICO: Nueva Versión

// Lista de archivos para cachear (ya no se usa aquí, solo para referencia)
// const urlsToCache = [ ... ]; // (Se omite la lista aquí para evitar el error)

// Evento 1: Instalación (SOLO abre el caché, NO descarga archivos)
self.addEventListener('install', event => {
  console.log('Service Worker: Instalación exitosa. Omitiendo cache.addAll para evitar conflicto en GitHub Pages.');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(() => {
        // Importante: No hay cache.addAll() aquí.
        // self.skipWaiting() fuerza que el SW tome el control inmediatamente
        return self.skipWaiting(); 
      })
      .catch(err => {
        console.error('Error al abrir la caché durante la instalación:', err);
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
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento 3: Fetch (servir desde la caché o ir a la red y CACHEAR)
self.addEventListener('fetch', event => {
  // Ignora las solicitudes externas (como mediafire)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 1. Si encuentra el archivo en caché, lo devuelve inmediatamente.
        if (response) {
          return response;
        }
        
        // 2. Si no está en caché, va a la red.
        return fetch(event.request).then(
          function(response) {
            // Verifica que la respuesta de la red sea válida (status 200, tipo basic)
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 3. Clona la respuesta antes de cachearla, ya que el original
            // es usado por el navegador.
            var responseToCache = response.clone();

            // 4. Guarda la respuesta en caché para futuras visitas.
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
