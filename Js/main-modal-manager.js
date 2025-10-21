// =========================================================================
// main-modal-manager.js: Modificado para enviar rutas relativas y la BASE_URL
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

// 1. OBTENER LA BASE PATH: Obtenemos la base para que el Worker pueda construir la URL.
// Usaremos la ruta absoluta hasta el directorio de scripts para tener una referencia
// consistente, o simplemente '/' si estuviera en la raíz.
// Para GitHub Pages: Si estás en https://angel06a.github.io/RetroStation/index.html
// La base que necesitamos es generalmente "/RetroStation/" o "". 
// La forma más segura es usar la URL base limpia del documento (angel06a.github.io/RetroStation/)
const BASE_URL_FULL = document.baseURI || window.location.href;
// Aseguramos que la base termine en '/' y no tenga el index.html
const URL_BASE_CLEANED = BASE_URL_FULL.substring(0, BASE_URL_FULL.lastIndexOf('/') + 1);

// 2. Inicializar el Web Worker
const imageWorker = new Worker('Js/image-worker.js');

// 3. Manejar mensajes del Worker
imageWorker.onmessage = (e) => {
    if (e.data.status === 'loaded') {
        // console.log(`[PRECARGA WORKER] Decodificado: ${e.data.relativeUrl}`);
    } else if (e.data.status === 'complete') {
        console.log("[PRECARGA WORKER] Recursos cargados/decodificados (completado).");
    }
};

imageWorker.onerror = (error) => {
    console.error("[PRECARGA WORKER] Error en el Worker de imágenes:", error);
};

// 4. Función de precarga: Ahora solo envía rutas relativas
const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    // Aquí solo enviamos las rutas relativas (como siempre las hemos usado)
    const relativeUrls = menuItems.flatMap(systemName => [
        BACKGROUND_DIR + systemName + BACKGROUND_EXT,
        IMAGE_DIR + systemName + IMAGE_EXT
    ]);

    console.log(`[PRECARGA] Iniciando precarga de ${relativeUrls.length} recursos en el Worker...`);
    
    // Enviar las rutas relativas Y la URL base al worker
    imageWorker.postMessage({
        type: 'preload',
        urls: relativeUrls,
        baseUrl: URL_BASE_CLEANED // Le pasamos la base del Main Thread
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadAllResources);
    } else {
        setTimeout(preloadAllResources, 500); 
    }
    initializeDOMReferences();
});

// El resto de funciones (abrirModal, cerrarModal, initializeDOMReferences)
// permanecen igual ya que usan las rutas relativas para el DOM.

const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;
    // ... (código abreviado para concisión)
    window.inputLock = true;
    console.log(`-> abrirModal() llamado para: ${systemName}`);

    const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
    const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
    const formattedName = systemName.replace(/-/g, ' ').toUpperCase();
    
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
    // ... (código abreviado para concisión)
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
