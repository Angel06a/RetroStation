// =========================================================================
// UTILS.JS: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing
// SE ELIMINA 'export'
// =========================================================================

/**
 * Parsea el texto sin procesar (de Games/*.js) para extraer elementos...
 */
function parseHyphenList(rawText) { // <--- Ya no es 'export function'
    if (!rawText) return [];
    
    // ... (resto del código de parseHyphenList)
    return rawText.split('\n')
        .map(line => line.trim()) 
        .filter(line => line.startsWith('-')) 
        .map(line => {
            const content = line.substring(1).trim(); 
            const urlRegex = /"([^"]*)"\s*$/;
            const urlMatch = content.match(urlRegex);
            
            let name = content;
            let url = null;
            
            if (urlMatch) {
                url = urlMatch[1]; 
                name = content.replace(urlMatch[0], '').trim();
            }
            
            return { name, url };
        })
        .filter(item => item.name.length > 0);
}


/**
 * Limpia el nombre de un juego...
 */
function cleanGameName(name) { // <--- Ya no es 'export function'
    const index = name.indexOf('(');
    return index > -1 ? name.substring(0, index).trim() : name;
}

/**
 * Determina el número de columnas del grid...
 */
function getGridColumns() { // <--- Ya no es 'export function'
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
 * Calcula y aplica las dimensiones dinámicas a la rueda...
 */
function calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, corregirHorizontalidad) { // <--- Ya no es 'export function'
    const SCALE_FACTOR = 1.6; 
    const viewportHeight = window.innerHeight;
    
    // ... (resto del código de calculateAndApplyDimensions)
    
    const itemHeightVh = 9 * SCALE_FACTOR; 
    const itemHeight = viewportHeight * (itemHeightVh / 100); 
    const itemWidth = itemHeight * (260 / 100); 
    
    const targetGapRatio = 1.7; 
    const targetGap = itemHeight * targetGapRatio;
    const targetCenterToCenter = itemHeight + targetGap; 

    const anguloRadianes = anguloPorOpcion * (Math.PI / 180);
    
    let requiredRadius = 0;
    if (totalOpciones > 0) {
         requiredRadius = Math.ceil(targetCenterToCenter / Math.sin(anguloRadianes));
    }
    
    const radioMinimoBase = viewportHeight * (300 / 1080); 
    const radioCalculado = Math.max(radioMinimoBase, requiredRadius); 
    
    let currentRadius = radioCalculado; 
    
    const margenExtraPorDesplazamiento = 0.8; 
    
    const ruedaTamano = radioCalculado * 2; 
    const posicionLeft = -(radioCalculado * (1 + margenExtraPorDesplazamiento));
    
    rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
    rueda.style.left = `${posicionLeft}px`; 

    const R = currentRadius;
    
    opciones.forEach((opcion, index) => {
        opcion.style.height = `${itemHeight}px`;
        opcion.style.width = `${itemWidth}px`; 
        
        const anguloPosicionamiento = initialAngles[index];
        const anguloPosRadianes = anguloPosicionamiento * Math.PI / 180; 
        const xOffset = Math.cos(anguloPosRadianes) * R; 
        const yOffset = Math.sin(anguloPosRadianes) * R; 
        
        opcion.style.left = `calc(50% + ${xOffset}px)`;
        opcion.style.top = `calc(50% + ${yOffset}px)`;
    });
    
    corregirHorizontalidad();

    return { currentRadius };
}

// =========================================================================