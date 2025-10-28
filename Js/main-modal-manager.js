// =========================================================================
// main-modal-manager.js: Minificado y Optimizado (V6 Súper Compacto)
// =========================================================================

window.inputLock = false;

// Constantes y referencias globales minificadas
const I_DIR = "Sistemas/", I_EXT = ".svg";
const B_DIR = "Fondos/", B_EXT = ".jpg";
const MODAL_DLY = 300; // MODAL_ANIMATION_DELAY
const LOCK_DLY = 200; // INPUT_LOCK_DELAY

let mO, mH, mI, mT, cGC; // mO: modalOverlay, mH: modalHeader, mI: modalImage, mT: modalTitle, cGC: contentGridContainer

// Pre-carga con Promise, decode y RIC
const lRO = (u) => new Promise((res) => { // lRO: loadResourceOptimized, u: fullUrl
    const i = new Image();
    
    i.onload = () => {
        // Optimización: Para evitar la carga intensiva de CPU al decodificar y usar
        // requestIdleCallback, simplemente resolvemos la promesa de forma asíncrona
        // con un setTimeout(0) inmediatamente después de la carga.
        setTimeout(() => res(u), 0);
    };
    i.onerror = () => { console.warn(`Error red: ${u}. Fallback.`); res(u); }; // fR: fallbackResolve
    i.src = u;
});

const pAR = () => { // pAR: preloadAllResources
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no disponible. Saltando.");
        return;
    }

    const lP = menuItems.flatMap(sN => [ // lP: loadPromises, sN: systemName
        lRO(B_DIR + sN + B_EXT),
        lRO(I_DIR + sN + I_EXT)
    ]);

    console.log(`[PRECARGA] Iniciando precarga de ${lP.length} recursos...`);

    Promise.all(lP)
        .then(() => console.log("[PRECARGA] Recursos cargados/decodificados (completado)."))
        .catch(e => console.error("[PRECARGA] Error CRÍTICO en Promise.all:", e)); // e: error
};

const iDR = () => { // iDR: initializeDOMReferences
    mO = document.getElementById('modal-overlay');
    mH = document.getElementById('modal-header');
    const mCB = document.getElementById('modal-close'); // mCB: modalCloseButton
    mI = document.getElementById('modal-image');
    mT = document.getElementById('modal-title');
    cGC = document.getElementById('content-grid-container');

    if (!mO || !mH || !mI || !mT || !cGC) {
        console.error("🚨 CRÍTICO: Referencias DOM faltan.");
        return;
    }

    if (mCB) mCB.addEventListener('click', cM); // cM: cerrarModal
    mO.addEventListener('click', e => { if (e.target === mO) cM(); }); // e: event
};

const aM = (sN) => { // aM: abrirModal, sN: systemName
    if (window.inputLock || !mO) return;

    window.inputLock = true;
    console.log(`-> aM() llamado para: ${sN}`);

    const iU = I_DIR + sN + I_EXT; // iU: imageUrl
    const bU = B_DIR + sN + B_EXT; // bU: bgUrl
    const fN = sN.replace(/-/g, ' ').toUpperCase(); // fN: formattedName

    requestAnimationFrame(() => {
        mI.src = iU;
        mI.alt = sN;
        mT.textContent = fN;
        mH.style.setProperty('--bg-url', `url('${bU}')`);
        
        mO.style.display = 'flex';
        void mO.offsetWidth;
        mO.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');
    });

    const lAR = () => { // lAR: loadAndRender
        if (typeof window.loadGameItems === 'function' && typeof window.renderGrid === 'function') {
            window.loadGameItems(sN, (i) => { // i: items
                console.log(`[CARGA ASÍNCRONA] Lista cargada para ${sN}.`);
                window.renderGrid(i, sN, cGC, mT);
            });
        }
    };
    
    // Se mantiene RIC para la carga de contenido ya que es de menor prioridad
    ('requestIdleCallback' in window) ? requestIdleCallback(lAR) : setTimeout(lAR, 10);

    window.isCenteringActive = true; 
    setTimeout(() => window.inputLock = false, LOCK_DLY);
};

const cM = () => { // cM: cerrarModal
    if (window.inputLock || !mO) return;

    window.inputLock = true;
    mO.classList.remove('open');

    cGC.innerHTML = '';
    if (window.gridItemsElements) window.gridItemsElements = [];

    window.hideGameDetailsHard?.();
    
    window.isCenteringActive = false;
    window.resetNavigationState?.();

    setTimeout(() => {
        mO.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        window.inputLock = false;
    }, MODAL_DLY);
};

window.abrirModal = aM;
window.cerrarModal = cM;

document.addEventListener('DOMContentLoaded', () => {
    ('requestIdleCallback' in window) ? requestIdleCallback(pAR) : setTimeout(pAR, 500); 
    iDR();
});