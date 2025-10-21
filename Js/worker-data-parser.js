// =========================================================================
// Js/worker-data-parser.js: Archivo de Worker para el parseo de datos (Restaurado)
// =========================================================================

/**
 * Parsea el texto sin procesar (rawText) de la lista de juegos
 * en un array de objetos Game Item.
 * Ejecutado en el Worker.
 */
function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
    const urlRegex = /"([^"]*)"\s*$/; 
    const lines = rawText.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith('-')) continue;

        let content = trimmedLine.substring(1).trim();
        const match = content.match(urlRegex);

        let url = '';
        if (match && match[1]) {
            url = match[1].trim();
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
self.onmessage = function(event) {
    const { type, rawText } = event.data;

    if (type === 'PARSE_GAME_DATA') {
        try {
            const parsedItems = parseHyphenList(rawText); 
            self.postMessage({
                type: 'PARSE_COMPLETE',
                items: parsedItems
            });
        } catch(e) {
             console.error('Worker Error:', e);
        }
    }
};

self.onerror = function(e) {
    console.error('Worker Script Error (Syntax or Load):', e.message);
};
