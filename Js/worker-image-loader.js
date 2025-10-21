// =========================================================================
// worker-image-loader.js: Web Worker para Decodificación Off-thread
// =========================================================================

self.onmessage = async (event) => {
    const { url, id } = event.data;

    if (url) {
        try {
            // 1. Fetch de la imagen: Carga los bytes del archivo.
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 2. Obtener el Blob: Representación de los datos binarios.
            const blob = await response.blob();

            // 3. Decodificación pesada: **createImageBitmap** es la clave.
            // Esta función realiza el parsing del archivo de imagen (JPEG/PNG/WebP) en un hilo de fondo.
            const imageBitmap = await createImageBitmap(blob);

            // 4. Libera el ImageBitmap: No necesitamos el objeto en sí para el elemento <img>,
            // solo forzamos que el trabajo de decodificación se complete.
            // Esto asegura que cuando el navegador solicite el recurso de nuevo, ya estará pre-procesado.
            imageBitmap.close(); 
            
            // 5. Notifica al hilo principal que la decodificación está completa.
            self.postMessage({ id: id, status: 'complete', url: url });

        } catch (error) {
            // Si hay un error, notificamos para que el hilo principal use un fallback.
            console.warn(`[WORKER ERROR] Fallo la decodificación off-thread para ${url}.`, error);
            self.postMessage({ id: id, status: 'error', url: url });
        }
    }
};