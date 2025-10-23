// =========================================================================
// main-modal-manager.js: Minificado Leve (Optimizado para CSS Animation - OPTIMIZADO V2)
// Se ha mejorado la gestión de carga y renderizado para reducir la carga de CPU
// al mover las tareas pesadas de renderizado de grid a requestIdleCallback.
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

const loadResourceOptimized = (fullUrl) => {
    // Implementación inmutable de loadResourceOptimized (ya usa decode/RIC)
    return new Promise((resolve, reject) => {
        const img = new Image();
        const fallbackResolve = () => resolve(fullUrl);
        const decodeAndResolve = () => {
            if ('decode' in img) {
                const decodePromise = img.decode().then(fallbackResolve).catch(error => {
                    console.warn(`Error al decodificar: ${fullUrl}. Fallback.`, error);
                    fallbackResolve(); 
                });
                
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => decodePromise);
                } else {
                    setTimeout(() => decodePromise, 0);
                }
            } else {
                setTimeout(fallbackResolve, 0);
            }
        };
        
        img.onload = () => decodeAndResolve();
        
        img.onerror = () => {
            console.warn(`Error de red: ${fullUrl}. Fallback.`);
            fallbackResolve();
        };
        
        img.src = fullUrl;
    });
};

const preloadAllResources = () => {
    // Implementación inmutable de preloadAllResources (sin cambios)
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const loadPromises = menuItems.flatMap(systemName => [
        loadResourceOptimized(BACKGROUND_DIR + systemName + BACKGROUND_EXT),
        loadResourceOptimized(IMAGE_DIR + systemName + IMAGE_EXT)
    ]);

    console.log(`[PRECARGA] Iniciando precarga de ${loadPromises.length} recursos...`);

    Promise.all(loadPromises)
        .then(() => console.log("[PRECARGA] Recursos cargados/decodificados (completado)."))
        .catch(error => console.error("[PRECARGA] Error CRÍTICO en Promise.all:", error));
};

document.addEventListener('DOMContentLoaded', () => {
    // Implementación inmutable (uso de RIC para precarga)
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
    
    // 1. **Optimización con requestAnimationFrame (RAF):**
    // Todas las mutaciones DOM para la animación de apertura se hacen aquí,
    // garantizando que no se bloquee el thread principal.
    requestAnimationFrame(() => {
        // A. Preparación visual rápida
        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = formattedName;
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
        
        // B. Activación del modal (Clases/Display)
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; // Forzar reflow para transición
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');
    });

    // 2. **Optimización con requestIdleCallback (RIC):**
    // La carga de datos (I/O) y el renderizado (CPU intensivo por DOM)
    // se mueven al periodo de inactividad, desacoplando completamente el
    // trabajo pesado de la animación de apertura.
    const loadAndRender = () => {
        if (typeof window.loadGameItems === 'function' && typeof window.renderGrid === 'function') {
            window.loadGameItems(systemName, (items) => {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                // renderGrid ya usa RAF internamente para la inserción final del grid
                window.renderGrid(items, systemName, contentGridContainer, modalTitle);
            });
        }
    };
    
    if ('requestIdleCallback' in window) {
        requestIdleCallback(loadAndRender);
    } else {
        setTimeout(loadAndRender, 10); // Fallback: pequeño timeout para no bloquear
    }

    if (centeringCheckIntervalId) clearInterval(centeringCheckIntervalId);
    // Mantenemos el intervalo para la verificación del centrado
    centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
    window.isCenteringActive = true;
    
    // El bloqueo de entrada se levanta después de un breve periodo
    setTimeout(() => window.inputLock = false, INPUT_LOCK_DELAY);
};

const cerrarModal = () => {
    // Implementación inmutable de cerrarModal (sin cambios)
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
    // Implementación inmutable de initializeDOMReferences (sin cambios)
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
