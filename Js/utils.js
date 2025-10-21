// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing (COMPLETO)
// =========================================================================

// --- CONSTANTES GLOBALES ---
const DEG_TO_RAD_FACTOR = Math.PI / 180;

const WHEEL_CONSTANTS = {
    ITEM_VH_CALC_FACTOR: (9 * 1.6) / 100,
    ITEM_WIDTH_FACTOR: 2.6,
    TARGET_GAP_RATIO: 1.7,
    MIN_RADIUS_RATIO: 300 / 1080,
    EXTRA_MARGIN_RATIO: 0.8
};

// --- CACHE DE DIMENSIONES GLOBALES ---
let cachedViewportHeight = 0;
let cachedViewportWidth = 0;

function updateViewportCache() {
    cachedViewportHeight = window.innerHeight;
    cachedViewportWidth = window.innerWidth;
}
updateViewportCache();

// --- 1. PARSEO DE DATOS (PARA FALLBACK) ---

/**
 * Parsea el texto sin procesar (rawText) de la lista de juegos
 * en un array de objetos Game Item.
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

// --- 2. CÁLCULO DE DIMENSIONES ---

function calculateWheelMetrics(anguloPorOpcion, totalOpciones) {
    const windowH = cachedViewportHeight;
    const windowW = cachedViewportWidth;

    const angleRad = anguloPorOpcion * DEG_TO_RAD_FACTOR;
    const itemHeight = Math.min(windowH * WHEEL_CONSTANTS.ITEM_VH_CALC_FACTOR, 100);
    const itemWidth = itemHeight * WHEEL_CONSTANTS.ITEM_WIDTH_FACTOR;

    const A = itemWidth * 0.5;
    const B = itemHeight * 0.5;

    let C;
    if (Math.abs(angleRad) > 1e-6) {
        C = (A * Math.sin(angleRad) - B * Math.cos(angleRad)) / Math.cos(angleRad) + B;
    } else {
        C = B; 
    }
    
    const requiredRadius = (A + C) / Math.sin(angleRad);
    let currentRadius = requiredRadius * WHEEL_CONSTANTS.TARGET_GAP_RATIO; 

    const maxRadiusBasedOnWidth = (windowW / 2) - (itemWidth * WHEEL_CONSTANTS.EXTRA_MARGIN_RATIO);
    currentRadius = Math.min(currentRadius, maxRadiusBasedOnWidth);

    const minRadius = windowH * WHEEL_CONSTANTS.MIN_RADIUS_RATIO;
    currentRadius = Math.max(currentRadius, minRadius);

    const ruedaTamano = 2 * currentRadius + itemWidth * 2;
    const posicionLeft = currentRadius + itemWidth / 2;

    return { itemHeight, itemWidth, currentRadius, ruedaTamano, posicionLeft };
}

function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones) {
    
    const { 
        itemHeight, itemWidth, currentRadius: R, 
        ruedaTamano, posicionLeft 
    } = calculateWheelMetrics(anguloPorOpcion, totalOpciones);

    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    rueda.style.setProperty('--posicion-left', `${posicionLeft}px`);

    const radioFactor = DEG_TO_RAD_FACTOR;
    
    for (let index = 0; index < opciones.length; index++) {
        const opcion = opciones[index];
        
        opcion.style.height = `${itemHeight}px`;
        opcion.style.width = `${itemWidth}px`;

        const anguloPosicionamiento = initialAngles[index];
        const anguloPosRadianes = anguloPosicionamiento * radioFactor;
        
        const xOffset = Math.cos(anguloPosRadianes) * R;
        const yOffset = Math.sin(anguloPosRadianes) * R;

        opcion.style.setProperty('--x-offset', `${xOffset}px`);
        opcion.style.setProperty('--y-offset', `${yOffset}px`);
    }

    return { currentRadius: R };
}

// --- 3. EXPOSICIÓN GLOBAL DE UTILIDADES ---
window.parseHyphenList = parseHyphenList; 
window.updateViewportCache = updateViewportCache;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;
