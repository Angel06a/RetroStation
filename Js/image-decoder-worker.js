// =========================================================================
// image-decoder-worker.js: Web Worker para Carga y Decodificación Asíncrona de Imágenes
// =========================================================================

/**
 * Carga y decodifica una imagen usando requestAnimationFrame y decode().
 * @param {string} fullUrl - La URL completa del recurso a cargar.
 * @returns {Promise<string>} Una promesa que se resuelve con la URL, independientemente de si la decodificación fue exitosa.
 */
function decodeImage(fullUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        
        // Función de resolución de fallback (se llama incluso si hay error o decodificación falla)
        const fallbackResolve = () => resolve(fullUrl);

        const decodeAndResolve = () => {
            if ('decode' in img) {
                // Usa requestAnimationFrame para programar la decodificación después del paint
                self.requestAnimationFrame(() => {
                    img.decode().then(fallbackResolve).catch(error => {
                        // Advertencia si falla la decodificación, pero resuelve para no bloquear.
                        console.warn(`[WORKER] Error al decodificar: ${fullUrl}. Fallback.`, error);
                        fallbackResolve(); 
                    });
                });
            } else {
                // Si decode no está disponible, simplemente resolve después de un pequeño timeout.
                setTimeout(fallbackResolve, 0);
            }
        };
        
        img.onload = () => decodeAndResolve();
        
        img.onerror = () => {
            // Advertencia si hay error de red, pero resuelve para no bloquear.
            console.warn(`[WORKER] Error de red al cargar: ${fullUrl}. Fallback.`);
            fallbackResolve();
        };
        
        img.src = fullUrl;
    });
}


// Escucha el mensaje del hilo principal
self.onmessage = async function(event) {
    // El hilo principal envía un array de URLs a precargar
    if (event.data && event.data.type === 'DECODE_RESOURCES') {
        const urls = event.data.urls || [];
        
        if (urls.length === 0) {
            self.postMessage({ type: 'DECODE_COMPLETE' });
            return;
        }

        console.log(`[WORKER] Iniciando decodificación de ${urls.length} recursos...`);
        
        try {
            // Decodifica todas las imágenes en paralelo
            await Promise.all(urls.map(url => decodeImage(url)));
            
            // Envía la señal de completado de vuelta al hilo principal
            self.postMessage({ type: 'DECODE_COMPLETE' });
        } catch (error) {
            console.error('[WORKER] Error CRÍTICO durante la decodificación:', error);
            self.postMessage({ type: 'DECODE_ERROR' });
        }
    }
};

// Polifill para requestAnimationFrame en Web Worker
// (aunque en muchos Workers modernos ya está presente, es buena práctica)
if (!('requestAnimationFrame' in self)) {
    self.requestAnimationFrame = (callback) => {
        return setTimeout(() => callback(performance.now()), 1000 / 60);
    };
}