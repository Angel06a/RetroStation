// =========================================================================
// Js/worker-data-parser.js: Web Worker para el Parseo de Datos Pesado
// =========================================================================

/**
 * Parsea el texto sin procesar (rawText) de la lista de juegos
 * en un array de objetos Game Item.
 * Esta función es CPU intensiva y se ejecuta en el Worker para no bloquear la UI.
 */
function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
    // Regex para capturar el texto principal y la URL entre comillas al final
    const urlRegex = /"([^"]*)"\s*$/; 
    const lines = rawText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith('-')) continue;

        let content = trimmedLine.substring(1).trim(); // Remueve el guion inicial
        const match = content.match(urlRegex);

        let url = '';
        if (match && match[1]) {
            url = match[1].trim();
            // Remueve la URL y las comillas del contenido principal
            content = content.replace(match[0], '').trim(); 
        }

        if (content) {
            items.push({
                title: content,
                url: url
            });
        }
    }
    return items;
}

// --- LÓGICA DE COMUNICACIÓN DEL WORKER ---
// Escucha mensajes del hilo principal
self.onmessage = function(event) {
    const { type, rawText } = event.data;

    if (type === 'PARSE_GAME_DATA') {
        // 1. Ejecuta la función pesada en el hilo del Worker
        const parsedItems = parseHyphenList(rawText); 
        
        // 2. Envía el resultado (el array de juegos) de vuelta al hilo principal
        self.postMessage({
            type: 'PARSE_COMPLETE',
            items: parsedItems
        });
    }
};