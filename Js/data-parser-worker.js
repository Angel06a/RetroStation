// =========================================================================
// data-parser-worker.js: Web Worker para Parseo de Datos Asíncrono
// =========================================================================

// --- Función de Parseo (MOVIDA desde utils.js) ---
function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
    // Nota: El regex y la lógica de parseo se mueven exactamente
    // igual para mantener la funcionalidad de extraer el nombre y la URL.
    const urlRegex = /"([^"]*)"\s*$/;
    const lines = rawText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith('-')) continue;

        let content = trimmedLine.substring(1).trim();
        const urlMatch = content.match(urlRegex);
        let url = null;

        if (urlMatch) {
            url = urlMatch[1];
            // Importante: Eliminar la parte de la URL antes de usar el resto como nombre
            content = content.replace(urlMatch[0], '').trim();
        }

        const name = content;

        if (name.length > 0) items.push({ name, url });
    }

    return items;
}

// Escucha el mensaje del hilo principal
self.onmessage = function(event) {
    // El hilo principal envía un objeto con la propiedad 'rawText'
    if (event.data && event.data.type === 'PARSE_DATA') {
        const { rawText, systemName } = event.data; // <--- CAMBIO AQUÍ: Desestructurar systemName
        
        try {
            const items = parseHyphenList(rawText);
            // Envía los datos parseados de vuelta al hilo principal
            self.postMessage({ type: 'PARSE_COMPLETE', items: items });
        } catch (error) {
            // LOGGING MEJORADO
            const context = systemName ? ` para ${systemName}` : '';
            console.error(`Worker: Error durante el parseo de datos${context}:`, error);
            // En caso de error, envía una lista vacía
            self.postMessage({ type: 'PARSE_ERROR', items: [] });
        }
    }
};
