// =========================================================================
// image-decoder-worker.js: Web Worker para Carga y Decodificación de Imágenes
// =========================================================================

// Escucha el mensaje del hilo principal
self.onmessage = function(event) {
    // El hilo principal envía un objeto con la propiedad 'imageUrl'
    if (event.data && event.data.type === 'DECODE_IMAGE') {
        const imageUrl = event.data.imageUrl;

        // La decodificación se realiza al llamar a fetch y luego createImageBitmap
        fetch(imageUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error de red al cargar la imagen: ${response.statusText}`);
                }
                // Obtenemos el Blob o ArrayBuffer de la imagen
                return response.blob();
            })
            .then(blob => {
                // createImageBitmap es la operación que decodifica y es eficiente
                // para transferir al hilo principal. Es asíncrono y se ejecuta
                // en el hilo del Worker, liberando el hilo principal.
                return self.createImageBitmap(blob);
            })
            .then(imageBitmap => {
                // Envía el ImageBitmap de vuelta al hilo principal.
                // Es un objeto transferible, lo que lo hace muy rápido.
                self.postMessage({ 
                    type: 'DECODE_COMPLETE', 
                    imageUrl: imageUrl, 
                    imageBitmap: imageBitmap 
                }, [imageBitmap]); // El ImageBitmap se transfiere, no se copia
            })
            .catch(error => {
                console.error(`Worker: Error durante la carga/decodificación de ${imageUrl}:`, error);
                // En caso de error, envía un mensaje de error
                self.postMessage({ type: 'DECODE_ERROR', imageUrl: imageUrl, error: error.message });
            });
    }
};