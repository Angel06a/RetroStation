// =========================================================================
// main-modal-manager.js: Modificado para enviar URL absolutas al Worker
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

// 1. OBTENER LA BASE URL: Se usa document.baseURI o location.href 
// para construir URLs absolutas correctas, esenciales en GitHub Pages.
// Esto garantiza que la ruta sea https://angel06a.github.io/RetroStation/
const BASE_URL = document.baseURI || window.location.href;
const URL_BASE_CLEANED = BASE_URL.endsWith('/') ? BASE_URL : BASE_URL.substring(0, BASE_URL.lastIndexOf('/') + 1);

// 2. Inicializar el Web Worker
const imageWorker = new Worker('Js/image-worker.js');

// 3. Manejar mensajes del Worker (opcional, solo para feedback)
imageWorker.onmessage = (e) => {
    if (e.data.status === 'loaded') {
        // console.log(`[PRECARGA WORKER] Decodificado: ${e.data.url}`);
    } else if (e.data.status === 'complete') {
        console.log("[PRECARGA WORKER] Recursos cargados/decodificados (completado).");
    }
};

imageWorker.onerror = (error) => {
    console.error("[PRECARGA WORKER] Error en el Worker de imágenes:", error);
};

// 4. Función de precarga: Ahora construye la URL absoluta
const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const resourcesToLoad = menuItems.flatMap(systemName => [
        // Construimos la URL completa usando la base del documento
        URL_BASE_CLEANED + BACKGROUND_DIR + systemName + BACKGROUND_EXT,
        URL_BASE_CLEANED + IMAGE_DIR + systemName + IMAGE_EXT
    ]);

    console.log(`[PRECARGA] Iniciando precarga de ${resourcesToLoad.length} recursos en el Worker con URLs absolutas...`);
    
    // Enviar el array de URLs absolutas al worker
    imageWorker.postMessage({
        type: 'preload',
        urls: resourcesToLoad
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Usar requestIdleCallback para la precarga, manteniendo la prioridad baja
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
    
    requestAnimationFrame(() => {
        // Estas rutas siguen siendo relativas para el CSS/DOM y es correcto.
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
