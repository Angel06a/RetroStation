// =========================================================================
// image-worker.js: Web Worker ahora construye la URL absoluta
// =========================================================================

// Usamos el evento 'message' para la comunicación con el Main Thread
self.onmessage = async (e) => {
    const { type, urls, baseUrl } = e.data; // Recibimos la baseUrl aquí

    if (type === 'preload' && urls && Array.isArray(urls) && baseUrl) {
        await preloadImages(urls, baseUrl);
    }
};

// Función principal de precarga
async function preloadImages(relativeUrls, baseUrl) {
    const loadPromises = relativeUrls.map(relativeUrl => {
        // 1. CONSTRUIMOS LA URL ABSOLUTA dentro del Worker
        const absoluteUrl = new URL(relativeUrl, baseUrl).href;

        // 2. Ejecutamos la promesa con la URL ABSOLUTA
        return fetch(absoluteUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                return response.blob();
            })
            // Decodificación de la imagen (la tarea intensiva de CPU)
            .then(blob => createImageBitmap(blob))
            .then(bitmap => {
                // Notificamos usando la ruta original o la absoluta para referencia
                self.postMessage({ status: 'loaded', relativeUrl: relativeUrl });
                return { success: true, url: relativeUrl };
            })
            .catch(error => {
                // Notificará la URL que falló
                console.warn(`[WORKER] Error al precargar/decodificar ${absoluteUrl} (Ruta relativa: ${relativeUrl}):`, error);
                return { success: false, url: relativeUrl, error: error.message };
            });
    });

    await Promise.allSettled(loadPromises);

    // Notificamos que todas las tareas han terminado
    self.postMessage({ status: 'complete' });
}
