// =========================================================================
// image-decoder-worker.js: Web Worker para Carga y Decodificación Asíncrona de Imágenes - MODIFICADO
// =========================================================================

/**
 * Carga (fetch) y decodifica una imagen.
 * @param {string} fullUrl - La URL completa del recurso a cargar (DEBE SER ABSOLUTA).
 * @returns {Promise<string>} Una promesa que se resuelve con la URL si tiene éxito.
 */
function decodeImage(fullUrl) {
    return new Promise((resolve) => {
        // 1. Usar fetch para cargar el recurso
        fetch(fullUrl)
            .then(response => {
                if (!response.ok) {
                    // Mejorar el mensaje de error: usar statusText o status si está vacío
                    const statusText = response.statusText || `HTTP Status ${response.status}`;
                    throw new Error(`[WORKER] Error de red: ${statusText}`);
                }
                return response.blob();
            })
            .then(blob => {
                // 2. Crear un URL.createObjectURL para que el Worker pueda usar new Image()
                const objectURL = URL.createObjectURL(blob);
                const img = new Image();
                
                // Función de resolución de fallback
                const fallbackResolve = () => {
                    URL.revokeObjectURL(objectURL); // Limpiar URL
                    resolve(fullUrl);
                };

                const decodeAndResolve = () => {
                    if ('decode' in img) {
                        // 3. Usar decode() para forzar el parseo del píxel de la imagen
                        self.requestAnimationFrame(() => {
                            img.decode().then(fallbackResolve).catch(error => {
                                console.warn(`[WORKER] Error al decodificar píxel: ${fullUrl}. Fallback.`, error);
                                fallbackResolve(); 
                            });
                        });
                    } else {
                        setTimeout(fallbackResolve, 0);
                    }
                };

                img.onload = () => decodeAndResolve();
                
                img.onerror = () => {
                    console.error(`[WORKER] Error al cargar ObjectURL en Image: ${fullUrl}`);
                    fallbackResolve();
                };

                img.src = objectURL; // Cargar la imagen usando el Blob URL

            })
            .catch(error => {
                // Capturar errores de fetch() o cualquier otro error
                console.error(`[WORKER] Error CRÍTICO durante la carga o procesamiento: ${fullUrl}`, error);
                // NOTA: Para no detener la precarga, resolvemos el error para que Promise.all continúe.
                resolve(fullUrl); 
            });
    });
}


// Escucha el mensaje del hilo principal
self.onmessage = async function(event) {
    if (event.data && event.data.type === 'DECODE_RESOURCES') {
        const urls = event.data.urls || [];
        
        if (urls.length === 0) {
            self.postMessage({ type: 'DECODE_COMPLETE' });
            return;
        }

        console.log(`[WORKER] Iniciando decodificación de ${urls.length} recursos...`);
        
        // Decodifica todas las imágenes en paralelo
        await Promise.all(urls.map(url => decodeImage(url)));
            
        // Envía la señal de completado de vuelta al hilo principal
        self.postMessage({ type: 'DECODE_COMPLETE' });
    }
};

// Polifill para requestAnimationFrame en Web Worker
if (!('requestAnimationFrame' in self)) {
    self.requestAnimationFrame = (callback) => {
        return setTimeout(() => callback(performance.now()), 1000 / 60);
    };
}
