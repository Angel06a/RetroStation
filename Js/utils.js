// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing (OPTIMIZADO V2)
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

// --- 1. PARSEO DE DATOS (SIN CAMBIOS) ---

function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
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
            content = content.replace(urlMatch[0], '').trim();
        }

        const name = content;

        if (name.length > 0) items.push({ name, url });
    }

    return items;
}

function cleanGameName(name) {
    const index = name.indexOf('(');
    return index > -1 ? name.substring(0, index).trim() : name;
}

// --- 2. CÁLCULO DE VISTA Y DIMENSIONES ---

function getGridColumns() {
    // Implementación inmutable de getGridColumns (sin cambios)
    const width = cachedViewportWidth || window.innerWidth;
    
    switch (true) {
        case width > 1920: return 8;
        case width > 1600: return 7;
        case width > 1440: return 6;
        case width > 1280: return 5;
        case width > 900: return 4;
        case width > 600: return 3;
        default: return 2;
    }
}

function calculateWheelMetrics(anguloPorOpcion, totalOpciones) {
    // Implementación inmutable de calculateWheelMetrics (sin cambios)
    const { 
        ITEM_VH_CALC_FACTOR, ITEM_WIDTH_FACTOR, TARGET_GAP_RATIO, 
        MIN_RADIUS_RATIO, EXTRA_MARGIN_RATIO 
    } = WHEEL_CONSTANTS;

    const viewportHeight = cachedViewportHeight || window.innerHeight;

    const itemHeight = viewportHeight * ITEM_VH_CALC_FACTOR;
    const itemWidth = itemHeight * ITEM_WIDTH_FACTOR;

    const targetCenterToCenter = itemHeight * (1 + TARGET_GAP_RATIO);

    let requiredRadius = 0;
    if (totalOpciones > 0) {
        const anguloRadianes = anguloPorOpcion * DEG_TO_RAD_FACTOR;
        const sinAngulo = Math.sin(anguloRadianes); 
        
        requiredRadius = sinAngulo > 1e-6 
            ? Math.ceil(targetCenterToCenter / sinAngulo)
            : Infinity;
    }

    const radioMinimoBase = viewportHeight * MIN_RADIUS_RATIO;
    const currentRadius = Math.max(radioMinimoBase, requiredRadius);

    const ruedaTamano = currentRadius * 2;
    const posicionLeft = -(currentRadius * (1 + EXTRA_MARGIN_RATIO));

    return { itemHeight, itemWidth, currentRadius, ruedaTamano, posicionLeft };
}

function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, isMobile) {
    
    const { 
        itemHeight, itemWidth, currentRadius: R, 
        ruedaTamano, posicionLeft 
    } = calculateWheelMetrics(anguloPorOpcion, totalOpciones);

    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    rueda.style.setProperty('--posicion-left', `${posicionLeft}px`);
    
    // OPTIMIZACIÓN CPU: Evitar cálculos trigonométricos costosos en modo móvil.
    if (!isMobile) {
        const radioFactor = DEG_TO_RAD_FACTOR;
        
        for (let index = 0; index < opciones.length; index++) {
            const opcion = opciones[index];
            
            opcion.style.height = `${itemHeight}px`;
            opcion.style.width = `${itemWidth}px`;

            const anguloPosicionamiento = initialAngles[index];
            const anguloPosRadianes = anguloPosicionamiento * radioFactor;
            
            const xOffset = Math.cos(anguloPosRadianes) * R;
            const yOffset = Math.sin(anguloPosRadianes) * R;

            // Se usa setProperty para que CSS pueda manejar la transición si es necesario
            opcion.style.setProperty('--x-offset', `${xOffset}px`);
            opcion.style.setProperty('--y-offset', `${yOffset}px`);
        }
    }
    // NOTA: En móvil, las dimensiones de itemHeight/itemWidth se ignoran por el CSS Media Query.
    // Solo las dimensiones de la rueda (ruedaTamano/posicionLeft) son relevantes para la vista desktop.

    return { currentRadius: R };
}

// --- 3. EXPOSICIÓN GLOBAL DE FUNCIONES (SIN CAMBIOS) ---
window.getGridColumns = getGridColumns; 
window.parseHyphenList = parseHyphenList;
window.cleanGameName = cleanGameName;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;
window.DEG_TO_RAD_FACTOR = DEG_TO_RAD_FACTOR;
window.updateViewportCache = updateViewportCache;