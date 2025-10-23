// =========================================================================
// utils.js: Funciones de Soporte, Cálculo de Dimensiones y Data Parsing (OPTIMIZADO V2 - Minificado)
// =========================================================================

// --- CONSTANTES GLOBALES ---
const D2R = Math.PI / 180; // D2R: DEG_TO_RAD_FACTOR

const WC = { // WC: WHEEL_CONSTANTS
    IVF: 0.09 * 1.6, // ITEM_VH_CALC_FACTOR
    IWF: 2.6,        // ITEM_WIDTH_FACTOR
    TGR: 1.7,        // TARGET_GAP_RATIO
    MRR: 300 / 1080, // MIN_RADIUS_RATIO
    EMR: 0.8         // EXTRA_MARGIN_RATIO
};

// --- CACHE DE DIMENSIONES GLOBALES ---
let cvH = 0; // cvH: cachedViewportHeight
let cvW = 0; // cvW: cachedViewportWidth

function uVC() { // uVC: updateViewportCache
    cvH = window.innerHeight;
    cvW = window.innerWidth;
}
uVC();

// --- 1. PARSEO DE DATOS ---

function pHL(rT) { // pHL: parseHyphenList, rT: rawText
    if (!rT) return [];

    const i = []; // i: items
    const uR = /"([^"]*)"\s*$/; // uR: urlRegex
    const l = rT.split('\n'); // l: lines
    
    for (const line of l) {
        const tL = line.trim(); // tL: trimmedLine

        if (!tL.startsWith('-')) continue;

        let c = tL.substring(1).trim(); // c: content
        const uM = c.match(uR); // uM: urlMatch
        let u = null; // u: url

        if (uM) {
            u = uM[1];
            c = c.replace(uM[0], '').trim();
        }

        const n = c; // n: name

        if (n.length > 0) i.push({ name: n, url: u });
    }

    return i;
}

function cGN(n) { // cGN: cleanGameName, n: name
    const i = n.indexOf('('); // i: index
    return i > -1 ? n.substring(0, i).trim() : n;
}

// --- 2. CÁLCULO DE VISTA Y DIMENSIONES ---

function gGC() { // gGC: getGridColumns
    const w = cvW || window.innerWidth; // w: width
    
    switch (true) {
        case w > 1920: return 8;
        case w > 1600: return 7;
        case w > 1440: return 6;
        case w > 1280: return 5;
        case w > 900: return 4;
        case w > 600: return 3;
        default: return 2;
    }
}

function cWM(aPO, tO) { // cWM: calculateWheelMetrics, aPO: anguloPorOpcion, tO: totalOpciones
    const { IVF, IWF, TGR, MRR, EMR } = WC;

    const vH = cvH || window.innerHeight; // vH: viewportHeight

    const iH = vH * IVF; // iH: itemHeight
    const iW = iH * IWF; // iW: itemWidth

    const tCC = iH * (1 + TGR); // tCC: targetCenterToCenter

    let rR = 0; // rR: requiredRadius
    if (tO > 0) {
        const aR = aPO * D2R; // aR: anguloRadianes
        const sA = Math.sin(aR); // sA: sinAngulo
        
        rR = sA > 1e-6 
            ? Math.ceil(tCC / sA)
            : Infinity;
    }

    const rMB = vH * MRR; // rMB: radioMinimoBase
    const cR = Math.max(rMB, rR); // cR: currentRadius

    const rT = cR * 2; // rT: ruedaTamano
    const pL = -(cR * (1 + EMR)); // pL: posicionLeft

    return { iH, iW, cR, rT, pL };
}

function cAAD(r, o, iA, aPO, tO, iM) { // cAAD: calculateAndApplyDimensions, r: rueda, o: opciones, iA: initialAngles, iM: isMobile
    
    const { 
        iH, iW, cR: R, 
        rT, pL 
    } = cWM(aPO, tO);

    r.style.setProperty('--rueda-tamano', `${rT}px`);
    r.style.setProperty('--posicion-left', `${pL}px`);
    
    if (!iM) {
        const rF = D2R; // rF: radioFactor
        
        for (let i = 0; i < o.length; i++) {
            const op = o[i];
            
            op.style.height = `${iH}px`;
            op.style.width = `${iW}px`;

            const aP = iA[i]; // aP: anguloPosicionamiento
            const aPR = aP * rF; // aPR: anguloPosRadianes
            
            const xO = Math.cos(aPR) * R; // xO: xOffset
            const yO = Math.sin(aPR) * R; // yO: yOffset

            op.style.setProperty('--x-offset', `${xO}px`);
            op.style.setProperty('--y-offset', `${yO}px`);
        }
    }

    return { currentRadius: R };
}

// --- 3. EXPOSICIÓN GLOBAL DE FUNCIONES ---
window.getGridColumns = gGC; 
window.parseHyphenList = pHL;
window.cleanGameName = cGN;
window.calculateAndApplyDimensions = cAAD;
window.DEG_TO_RAD_FACTOR = D2R; // Mantenido por si otras dependencias lo usan
window.updateViewportCache = uVC;