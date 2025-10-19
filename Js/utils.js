// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing
// OPTIMIZACIÓN FINAL: Separación de cálculo/aplicación de estilos, bucle for...of, 
//                      y uso estricto de constantes.
// =========================================================================

// --- CONSTANTES GLOBALES ---
/** @type {number} Factor de Grados a Radianes. */
const DEG_TO_RAD_FACTOR = Math.PI / 180; 

/** @type {Object<string, number>} Constantes para el cálculo de la rueda. */
const WHEEL_CONSTANTS = {
    // Dimensiones y factores de escala del elemento (9vh * 1.6)
    ITEM_VH_CALC_FACTOR: (9 * 1.6) / 100, // (ITEM_HEIGHT_VH * SCALE_FACTOR) / 100
    ITEM_WIDTH_FACTOR: 2.6, // Relación ancho/alto del ítem (260 / 100)
    
    // Proporción de la separación entre ítems
    TARGET_GAP_RATIO: 1.7, 
    
    // Radio mínimo base para asegurar visibilidad
    MIN_RADIUS_RATIO: 300 / 1080, 
    
    // Margen extra para desplazar la rueda fuera de la pantalla
    EXTRA_MARGIN_RATIO: 0.8
};

// --- 1. PARSEO DE DATOS ---

/**
 * Parsea el texto sin procesar (de Games/*.js) para extraer elementos.
 * Utiliza un bucle for...of para evitar la creación de arrays intermedios.
 * @param {string} rawText - Texto de entrada con una línea por ítem.
 * @returns {Array<{name: string, url: (string|null)}>} Lista de ítems parseados.
 */
function parseHyphenList(rawText) {
    if (!rawText) return [];

    const items = [];
    // Patrón para capturar la URL entre comillas al final de la línea
    const urlRegex = /"([^"]*)"\s*$/;

    for (const line of rawText.split('\n')) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith('-')) {
            continue;
        }

        let content = trimmedLine.substring(1).trim();
        const urlMatch = content.match(urlRegex);
        let url = null;

        if (urlMatch) {
            url = urlMatch[1];
            // Eliminar la URL y las comillas del contenido restante.
            // Uso de urlMatch[0] para asegurar que se elimine todo el match.
            content = content.replace(urlMatch[0], '').trim();
        }

        const name = content;

        if (name.length > 0) {
            items.push({ name, url });
        }
    }

    return items;
}

/**
 * Limpia el nombre de un juego, quitando el contenido entre paréntesis.
 * @param {string} name - Nombre completo del juego.
 * @returns {string} Nombre del juego sin contenido entre paréntesis.
 */
function cleanGameName(name) {
    const index = name.indexOf('(');
    return index > -1 ? name.substring(0, index).trim() : name;
}

// --- 2. CÁLCULO DE VISTA Y DIMENSIONES ---

/**
 * Determina el número de columnas del grid del modal basándose en el ancho de la ventana.
 * La estructura if/else if es la más rápida para este tipo de lógica.
 * @returns {number} Número de columnas.
 */
function getGridColumns() {
    const width = window.innerWidth;
    // La estructura es intencionalmente de mayor a menor para la rapidez de los "early exits".
    if (width > 1920) return 8;
    if (width > 1600) return 7;
    if (width > 1440) return 6;
    if (width > 1280) return 5;
    if (width > 900) return 4;
    if (width > 600) return 3;
    return 2;
}

/**
 * Calcula las dimensiones clave (radio, alto, ancho) para la rueda.
 * @param {number} anguloPorOpcion - Ángulo central por ítem en grados.
 * @param {number} totalOpciones - Número total de ítems.
 * @returns {{itemHeight: number, itemWidth: number, currentRadius: number, ruedaTamano: number, posicionLeft: number}} 
 * Objeto con las dimensiones calculadas.
 */
function calculateWheelMetrics(anguloPorOpcion, totalOpciones) {
    const { 
        ITEM_VH_CALC_FACTOR, 
        ITEM_WIDTH_FACTOR, 
        TARGET_GAP_RATIO, 
        MIN_RADIUS_RATIO, 
        EXTRA_MARGIN_RATIO 
    } = WHEEL_CONSTANTS;

    const viewportHeight = window.innerHeight;

    // 1. Calcular dimensiones del ítem
    const itemHeight = viewportHeight * ITEM_VH_CALC_FACTOR;
    const itemWidth = itemHeight * ITEM_WIDTH_FACTOR;

    // 2. Calcular el radio requerido por la separación deseada
    const targetGap = itemHeight * TARGET_GAP_RATIO;
    const targetCenterToCenter = itemHeight + targetGap;

    let requiredRadius = 0;
    if (totalOpciones > 0) {
        const anguloRadianes = anguloPorOpcion * DEG_TO_RAD_FACTOR;
        // Fórmula geométrica: R = (distancia centro a centro) / sin(ángulo)
        // Math.ceil asegura que el radio sea suficiente.
        // Se usa Math.max para evitar problemas con sin(0) o ángulos muy pequeños.
        const sinAngulo = Math.sin(anguloRadianes);
        requiredRadius = sinAngulo > 1e-6 
            ? Math.ceil(targetCenterToCenter / sinAngulo)
            : Infinity; // Si el ángulo es ~0, el radio es infinito.
    }

    // 3. Determinar el radio final
    const radioMinimoBase = viewportHeight * MIN_RADIUS_RATIO;
    const currentRadius = Math.max(radioMinimoBase, requiredRadius);

    // 4. Calcular dimensiones para la rueda contenedora
    const ruedaTamano = currentRadius * 2;
    // Posición Left para desplazar la rueda fuera de la pantalla (Left: 50% - radio - margen)
    const posicionLeft = -(currentRadius * (1 + EXTRA_MARGIN_RATIO));

    return { itemHeight, itemWidth, currentRadius, ruedaTamano, posicionLeft };
}

/**
 * Calcula y aplica las dimensiones dinámicas a la rueda, posicionando cada opción.
 * @param {HTMLElement} rueda - Elemento DOM de la rueda contenedora.
 * @param {HTMLElement[]} opciones - Array de elementos DOM de las opciones.
 * @param {number[]} initialAngles - Array con el ángulo de posición inicial de cada opción.
 * @param {number} anguloPorOpcion - Ángulo central por ítem en grados.
 * @param {number} totalOpciones - Número total de ítems.
 * @returns {{currentRadius: number}} El radio de la rueda actual.
 */
function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones) {
    
    // 1. Calcular todas las métricas de dimensión (Pura lógica de cálculo)
    const { 
        itemHeight, 
        itemWidth, 
        currentRadius: R, 
        ruedaTamano, 
        posicionLeft 
    } = calculateWheelMetrics(anguloPorOpcion, totalOpciones);

    // 2. Aplicar estilos a la rueda contenedora
    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    // Se usa variable CSS para la posición Left para asegurar que la contrarotación de los ítems funcione correctamente.
    rueda.style.setProperty('--posicion-left', `${posicionLeft}px`);

    // 3. Aplicar estilos a las opciones
    opciones.forEach((opcion, index) => {
        // Asignar dimensiones del ítem (no cambian)
        opcion.style.height = `${itemHeight}px`;
        opcion.style.width = `${itemWidth}px`;

        const anguloPosicionamiento = initialAngles[index];
        const anguloPosRadianes = anguloPosicionamiento * DEG_TO_RAD_FACTOR;
        
        // Coordenadas polares (trigonometría) para la posición
        // Optimizaciones: Uso directo del radio 'R'
        const xOffset = Math.cos(anguloPosRadianes) * R;
        const yOffset = Math.sin(anguloPosRadianes) * R;

        // Uso de variables CSS para la posición X/Y estática de cada ítem
        opcion.style.setProperty('--x-offset', `${xOffset}px`);
        opcion.style.setProperty('--y-offset', `${yOffset}px`);
        
        // ❌ ELIMINADO: Ya no se necesita el ángulo estático para la rotación interna del ítem.
        // opcion.style.setProperty('--angulo-estatico', `${anguloPosicionamiento}deg`); 
    });

    return { currentRadius: R };
}

// --- 3. EXPOSICIÓN GLOBAL DE FUNCIONES ---
// (Necesario para la comunicación entre archivos sin usar módulos ES6)
window.getGridColumns = getGridColumns; 
window.parseHyphenList = parseHyphenList;
window.cleanGameName = cleanGameName;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;
window.DEG_TO_RAD_FACTOR = DEG_TO_RAD_FACTOR;