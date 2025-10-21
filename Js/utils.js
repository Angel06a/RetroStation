// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones (parseHyphenList REMOVIDO)
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

// --- 1. PARSEO DE DATOS ---
// **ELIMINADO: La función parseHyphenList fue movida a Js/worker-data-parser.js para Web Worker.**
// **ELIMINADO: La función parseHyphenList fue movida a Js/worker-data-parser.js para Web Worker.**

// --- 2. CÁLCULO DE DIMENSIONES ---

function calculateWheelMetrics(anguloPorOpcion, totalOpciones) {
    // ... (El cuerpo de la función sigue igual) ...
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
        C = B; // Caso para ángulo cero o muy cercano a cero
    }
    
    // Calcula el radio necesario
    const requiredRadius = (A + C) / Math.sin(angleRad);
    let currentRadius = requiredRadius * WHEEL_CONSTANTS.TARGET_GAP_RATIO; 

    const maxRadiusBasedOnWidth = (windowW / 2) - (itemWidth * WHEEL_CONSTANTS.EXTRA_MARGIN_RATIO);
    currentRadius = Math.min(currentRadius, maxRadiusBasedOnWidth);

    // Asegura un radio mínimo (opcional, pero buena práctica)
    const minRadius = windowH * WHEEL_CONSTANTS.MIN_RADIUS_RATIO;
    currentRadius = Math.max(currentRadius, minRadius);

    const ruedaTamano = 2 * currentRadius + itemWidth * 2;
    const posicionLeft = currentRadius + itemWidth / 2;

    return { itemHeight, itemWidth, currentRadius, ruedaTamano, posicionLeft };
}

function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones) {
    // ... (El cuerpo de la función sigue igual) ...
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

window.updateViewportCache = updateViewportCache;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;
