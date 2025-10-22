// =========================================================================
// main-modal-manager.js: Minificado Leve (Optimizado para CSS Animation - OPTIMIZADO V2)
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
    
    // Optimización: Todas las mutaciones de DOM para abrir/configurar el modal están en un RAF
    requestAnimationFrame(() => {
        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = formattedName;
        // Uso de setProperty para aprovechar CSS variables/transitions si existen
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
    });

    // OPTIMIZACIÓN CPU: Usar requestIdleCallback para la carga y renderizado del grid.
    // Esto asegura que la costosa carga de datos y creación de muchos elementos DOM
    // NO bloquee la animación de apertura del modal.
    const loadAndRender = () => {
        if (typeof window.loadGameItems === 'function' && typeof window.renderGrid === 'function') {
            window.loadGameItems(systemName, (items) => {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                // RenderGrid ya usa RAF internamente para la inserción final
                window.renderGrid(items, systemName, contentGridContainer, modalTitle);
            });
        }
    };
    
    if ('requestIdleCallback' in window) {
        // Ejecutar en el próximo periodo de inactividad
        requestIdleCallback(loadAndRender);
    } else {
        // Fallback rápido
        setTimeout(loadAndRender, 10);
    }

    if (centeringCheckIntervalId) clearInterval(centeringCheckIntervalId);
    // 500ms es un buen intervalo para el centrado, se mantiene.
    centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
    window.isCenteringActive = true;
    
    // La activación del modal (clases, display) también en RAF
    requestAnimationFrame(() => {
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        setTimeout(() => window.inputLock = false, INPUT_LOCK_DELAY);
    });
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