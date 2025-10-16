// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing
// OPTIMIZACIÓN FINAL: Bucle for...of en parseHyphenList y uso estricto de constantes.
// =========================================================================

// --- CONSTANTES GLOBALES ---
const DEG_TO_RAD_FACTOR = Math.PI / 180; // Factor de Grados a Radianes

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
 * Utiliza un bucle for...of para evitar la creación de arrays intermedios, mejorando el rendimiento.
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
            // Eliminar la URL y las comillas del contenido restante
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
 */
function cleanGameName(name) {
    const index = name.indexOf('(');
    return index > -1 ? name.substring(0, index).trim() : name;
}

// --- 2. CÁLCULO DE VISTA Y DIMENSIONES ---

/**
 * Determina el número de columnas del grid del modal basándose en el ancho de la ventana.
 * La estructura if/else if es la más rápida para este tipo de lógica.
 */
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

/**
 * Calcula y aplica las dimensiones dinámicas a la rueda, posicionando cada opción.
 */
function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, corregirHorizontalidad) {
    // Desestructurar y usar constantes pre-calculadas para la máxima claridad.
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

    const anguloRadianes = anguloPorOpcion * DEG_TO_RAD_FACTOR;

    let requiredRadius = 0;
    if (totalOpciones > 0) {
         // Fórmula geométrica: R = (distancia centro a centro) / sin(ángulo)
         // Math.ceil asegura que el radio sea suficiente.
         requiredRadius = Math.ceil(targetCenterToCenter / Math.sin(anguloRadianes));
    }

    // 3. Determinar el radio final
    const radioMinimoBase = viewportHeight * MIN_RADIUS_RATIO;
    const radioCalculado = Math.max(radioMinimoBase, requiredRadius);

    const currentRadius = radioCalculado;

    // 4. Aplicar estilos a la rueda
    const ruedaTamano = radioCalculado * 2;
    const posicionLeft = -(radioCalculado * (1 + EXTRA_MARGIN_RATIO));

    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    rueda.style.left = `${posicionLeft}px`;

    const R = currentRadius;

    // 5. Aplicar estilos a las opciones
    opciones.forEach((opcion, index) => {
        opcion.style.height = `${itemHeight}px`;
        opcion.style.width = `${itemWidth}px`;

        const anguloPosicionamiento = initialAngles[index];
        const anguloPosRadianes = anguloPosicionamiento * DEG_TO_RAD_FACTOR;
        
        // Coordenadas polares (trigonometría) para la posición
        const xOffset = Math.cos(anguloPosRadianes) * R;
        const yOffset = Math.sin(anguloPosRadianes) * R;

        opcion.style.left = `calc(50% + ${xOffset}px)`;
        opcion.style.top = `calc(50% + ${yOffset}px)`;
    });

    // Función de corrección debe ser llamada para asegurar orientación horizontal
    corregirHorizontalidad();

    return { currentRadius };
}

// --- 3. EXPOSICIÓN GLOBAL DE FUNCIONES ---
// (Necesario para la comunicación entre archivos sin usar módulos ES6)
window.getGridColumns = getGridColumns; 
window.parseHyphenList = parseHyphenList;
window.cleanGameName = cleanGameName;
window.calculateAndApplyDimensions = calculateAndApplyDimensions;