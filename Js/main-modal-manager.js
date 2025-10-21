// =========================================================================
// main-modal-manager.js: Minificado Leve (Optimizado para CSS Animation) - MODIFICADO
// =========================================================================

window.inputLock = false;
let centeringCheckIntervalId = null;

const IMAGE_DIR = "Sistemas/";
const IMAGE_EXT = ".svg";
const BACKGROUND_DIR = "Fondos/";
const BACKGROUND_EXT = ".jpg";
const MODAL_ANIMATION_DELAY = 300;
const INPUT_LOCK_DELAY = 200;

let modalOverlay, modalHeader, modalImage, modalTitle, contentGridContainer;

// **NOTA:** La función loadResourceOptimized original ha sido removida/adaptada,
// y su lógica de carga/decodificación movida a image-decoder-worker.js.
// Aquí solo necesitamos un array de URLs para enviar al Worker.

const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const urlsToPreload = menuItems.flatMap(systemName => [
        BACKGROUND_DIR + systemName + BACKGROUND_EXT,
        IMAGE_DIR + systemName + IMAGE_EXT
    ]);

    console.log(`[PRECARGA] Iniciando precarga de ${urlsToPreload.length} recursos mediante Web Worker...`);

    if ('Worker' in window) {
        // --- INICIO: USO DEL WEB WORKER PARA LA DECODIFICACIÓN ---
        // Usa el nuevo worker para delegar la carga y decodificación.
        const worker = new Worker('./Js/image-decoder-worker.js'); 
        
        worker.onmessage = (e) => {
            if (e.data.type === 'DECODE_COMPLETE') {
                console.log("[PRECARGA] Recursos cargados/decodificados (completado por Worker).");
            } else if (e.data.type === 'DECODE_ERROR') {
                 console.error('[WORKER] Error al decodificar recursos.');
            }
            worker.terminate(); // Termina el Worker una vez completado
        };

        worker.onerror = (error) => {
            console.error('[WORKER] Error crítico del Web Worker de decodificación:', error);
        };
        
        // Envía la lista de URLs al Worker
        worker.postMessage({ type: 'DECODE_RESOURCES', urls: urlsToPreload });
        // --- FIN: USO DEL WEB WORKER PARA LA DECODIFICACIÓN ---

    } else {
        // Fallback si Web Worker no es soportado (caso muy raro)
        console.warn('[ADVERTENCIA] Web Workers no soportados. Saltando precarga asíncrona de imágenes.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Usamos requestIdleCallback o setTimeout para no bloquear la interacción inicial
    if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadAllResources);
    } else {
        setTimeout(preloadAllResources, 500); 
    }
    initializeDOMReferences();
});

const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    console.log(`-> abrirModal() llamado para: ${systemName}`);

    const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
    const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
    const formattedName = systemName.replace(/-/g, ' ').toUpperCase();
    
    // La imagen y el fondo se establecen inmediatamente. 
    // Como se precargaron/decodificaron en el worker, deberían aparecer casi al instante
    // si ya estaban en caché o en memoria.
    requestAnimationFrame(() => {
        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = formattedName;
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
    });

    setTimeout(() => {
        if (typeof window.loadGameItems === 'function' && typeof window.renderGrid === 'function') {
            window.loadGameItems(systemName, (items) => {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                window.renderGrid(items, systemName, contentGridContainer, modalTitle);
            });
        }
    }, 10);

    if (centeringCheckIntervalId) clearInterval(centeringCheckIntervalId);
    centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
    window.isCenteringActive = true;
    
    requestAnimationFrame(() => {
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        setTimeout(() => window.inputLock = false, INPUT_LOCK_DELAY);
    });
};

const cerrarModal = () => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    modalOverlay.classList.remove('open');

    contentGridContainer.innerHTML = '';
    if (window.gridItemsElements) window.gridItemsElements = [];

    window.hideGameDetailsHard?.();
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    window.resetNavigationState?.();

    setTimeout(() => {
        modalOverlay.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        window.inputLock = false;
    }, MODAL_ANIMATION_DELAY);
};

window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;

const initializeDOMReferences = () => {
    modalOverlay = document.getElementById('modal-overlay');
    modalHeader = document.getElementById('modal-header');
    const modalCloseButton = document.getElementById('modal-close');
    modalImage = document.getElementById('modal-image');
    modalTitle = document.getElementById('modal-title');
    contentGridContainer = document.getElementById('content-grid-container');

    if (!modalOverlay || !modalHeader || !modalImage || !modalTitle || !contentGridContainer) {
        console.error("🚨 CRÍTICO: Referencias DOM faltan.");
        return;
    }

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', cerrarModal);
    }

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) cerrarModal();
    });
};
