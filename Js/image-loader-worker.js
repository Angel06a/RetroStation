// =========================================================================
// image-loader-worker.js: Web Worker para carga de recursos (fetch y blob)
// =========================================================================

self.addEventListener('message', async (event) => {
    const { url, id } = event.data;

    if (!url) {
        return;
    }

    try {
        // 1. Fetch: La solicitud de red se hace en el hilo del worker.
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 2. Obtener Blob/ArrayBuffer: Se realiza la lectura de datos, que es I/O intensiva.
        const blob = await response.blob(); 
        
        // 3. Crear Object URL para la transferencia
        // Se envía un URL del blob al hilo principal.
        const objectURL = URL.createObjectURL(blob);
        
        // 4. Enviar resultado al hilo principal
        self.postMessage({
            id: id,
            url: url,
            success: true,
            objectURL: objectURL
        });
        
    } catch (error) {
        console.error(`Worker: Error al cargar ${url}:`, error);
        // 5. Enviar señal de fallo
        self.postMessage({
            id: id,
            url: url,
            success: false,
            message: error.message
        });
    }
});

console.log('Image Loader Worker: Inicializado.');