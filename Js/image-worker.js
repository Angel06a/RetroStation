// =========================================================================
// image-worker.js: Web Worker para la precarga y decodificación de imágenes
// =========================================================================

// Usamos el evento 'message' para la comunicación con el Main Thread
self.onmessage = async (e) => {
    const { type, urls } = e.data;

    if (type === 'preload' && urls && Array.isArray(urls)) {
        await preloadImages(urls);
    }
};

// Función principal de precarga
async function preloadImages(urls) {
    const loadPromises = urls.map(url => 
        // Usamos fetch para obtener el recurso como blob
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                return response.blob();
            })
            // Usamos createImageBitmap para decodificar el blob en el worker.
            // Esto es la parte intensiva de CPU que se delega.
            .then(blob => createImageBitmap(blob))
            .then(bitmap => {
                // Notificamos que un recurso fue cargado (opcional)
                self.postMessage({ status: 'loaded', url: url });
                
                // Opcionalmente, puedes cerrar el bitmap si no lo vas a transferir
                // bitmap.close(); 
                
                return { success: true, url: url };
            })
            .catch(error => {
                console.warn(`[WORKER] Error al precargar/decodificar ${url}:`, error);
                return { success: false, url: url, error: error.message };
            })
    );

    await Promise.allSettled(loadPromises);

    // Notificamos que todas las tareas han terminado
    self.postMessage({ status: 'complete' });
}