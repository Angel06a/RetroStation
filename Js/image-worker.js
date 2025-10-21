// =========================================================================
// image-worker.js: Modificado para manejar SVG sin decodificación Bitmap
// =========================================================================

// Usamos el evento 'message' para la comunicación con el Main Thread
self.onmessage = async (e) => {
    const { type, urls, baseUrl } = e.data; 

    if (type === 'preload' && urls && Array.isArray(urls) && baseUrl) {
        await preloadImages(urls, baseUrl);
    }
};

// Función principal de precarga
async function preloadImages(relativeUrls, baseUrl) {
    const loadPromises = relativeUrls.map(relativeUrl => {
        // 1. CONSTRUIMOS LA URL ABSOLUTA dentro del Worker
        const absoluteUrl = new URL(relativeUrl, baseUrl).href;
        // 2. Comprobamos si es un SVG
        const isSvg = relativeUrl.toLowerCase().endsWith('.svg');

        // 3. Ejecutamos la promesa con la URL ABSOLUTA
        return fetch(absoluteUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                return response.blob();
            })
            // AHORA: Manejamos la decodificación condicionalmente
            .then(blob => {
                if (isSvg) {
                    // Los SVG son XML. Si los cargamos, ya quedan en caché. 
                    // No intentamos usar createImageBitmap, que podría fallar.
                    console.log(`[WORKER] SVG detectado (${relativeUrl}). Solo precarga HTTP, omitiendo decodificación Bitmap.`);
                    return blob; // Retornamos el blob o cualquier valor que simule el éxito
                } else {
                    // Decodificación de la imagen (JPG, PNG, WebP)
                    return createImageBitmap(blob);
                }
            })
            .then(() => { // El paso anterior retorna el Blob o el Bitmap (ambos resuelven la promesa)
                // Notificamos usando la ruta original
                self.postMessage({ status: 'loaded', relativeUrl: relativeUrl });
                return { success: true, url: relativeUrl };
            })
            .catch(error => {
                console.warn(`[WORKER] Error al precargar/decodificar ${absoluteUrl} (Ruta relativa: ${relativeUrl}):`, error);
                return { success: false, url: relativeUrl, error: error.message };
            });
    });

    await Promise.allSettled(loadPromises);

    // Notificamos que todas las tareas han terminado
    self.postMessage({ status: 'complete' });
}
