// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing
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

// --- 1. PARSEO DE DATOS ---

function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
    const urlRegex = /"([^"]*)"\s*$/;

    for (const line of rawText.split('\n')) {
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
    const width = window.innerWidth;
    if (width > 1920) return 8;
    if (width > 1600) return 7;
    if (width > 1440) return 6;
    if (width > 1280) return 5;
    if (width > 900) return 4;
    if (width > 600) return 3;
    return 2;
}

function calculateWheelMetrics(anguloPorOpcion, totalOpciones) {
    const { 
        ITEM_VH_CALC_FACTOR, ITEM_WIDTH_FACTOR, TARGET_GAP_RATIO, 
        MIN_RADIUS_RATIO, EXTRA_MARGIN_RATIO 
    } = WHEEL_CONSTANTS;

    const viewportHeight = window.innerHeight;

    const itemHeight = viewportHeight * ITEM_VH_CALC_FACTOR;
    const itemWidth = itemHeight * ITEM_WIDTH_FACTOR;

    const targetGap = itemHeight * TARGET_GAP_RATIO;
    const targetCenterToCenter = itemHeight + targetGap;

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

function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones) {
    
    const { 
        itemHeight, itemWidth, currentRadius: R, 
        ruedaTamano, posicionLeft 
    } = calculateWheelMetrics(anguloPorOpcion, totalOpciones);

    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    rueda.style.setProperty('--posicion-left', `${posicionLeft}px`);

    opciones.forEach((opcion, index) => {
        opcion.style.height = `${itemHeight}px`;
        opcion.style.width = `${itemWidth}px`;

        const anguloPosicionamiento = initialAngles[index];
        const anguloPosRadianes = anguloPosicionamiento * DEG_TO_RAD_FACTOR;
        
        const xOffset = Math.cos(anguloPosRadianes) * R;
        const yOffset = Math.sin(anguloPosRadianes) * R;

        opcion.style.setProperty('--x-offset', `${xOffset}px`);
        opcion.style.setProperty('--y-offset', `${yOffset}px`);
    });

    return { currentRadius: R };
}

// --- 3. EXPOSICIÓN GLOBAL DE FUNCIONES ---
window.getGridColumns = getGridColumns; 
window.parseHyphenList = parseHyphenList;
window.cleanGameName = cleanGameName;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;
window.DEG_TO_RAD_FACTOR = DEG_TO_RAD_FACTOR;