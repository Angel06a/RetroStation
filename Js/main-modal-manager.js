// =========================================================================
// main-modal-manager.js: Minificado Leve
// =========================================================================

window.inputLock = false;
let centeringCheckIntervalId = null;

const IMAGE_DIR = "Sistemas/";
const IMAGE_EXT = ".svg";
const BACKGROUND_DIR = "Fondos/";
const BACKGROUND_EXT = ".jpg";
const MODAL_ANIMATION_DELAY = 300;
const INPUT_LOCK_DELAY = 200;

let modalOverlay;
let modalHeader;
let modalImage;
let modalTitle;
let contentGridContainer;

const loadResourceOptimized = (fullUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            const decodeAction = () => {
                if ('decode' in img) {
                    img.decode()
                        .then(() => resolve(fullUrl))
                        .catch(error => {
                            console.warn(`Error al decodificar: ${fullUrl}. Fallback.`, error);
                            resolve(fullUrl); 
                        });
                } else {
                    resolve(fullUrl);
                }
            };

            if ('requestIdleCallback' in window) {
                requestIdleCallback(decodeAction);
            } else {
                setTimeout(decodeAction, 0);
            }
        };
        
        img.onerror = (e) => {
            console.warn(`Error de red: ${fullUrl}. Fallback.`);
            resolve(fullUrl);
        };
        
        img.src = fullUrl;
    });
};

const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const loadPromises = [];

    menuItems.forEach(systemName => {
        loadPromises.push(loadResourceOptimized(BACKGROUND_DIR + systemName + BACKGROUND_EXT));
        loadPromises.push(loadResourceOptimized(IMAGE_DIR + systemName + IMAGE_EXT));
    });

    console.log(`[PRECARGA] Iniciando precarga de ${loadPromises.length} recursos...`);

    Promise.all(loadPromises)
        .then(() => {
            console.log("[PRECARGA] Recursos cargados/decodificados (completado).");
        })
        .catch(error => {
            console.error("[PRECARGA] Error CRÍTICO en Promise.all:", error);
        });
};

preloadAllResources();

const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    console.log(`-> abrirModal() llamado para: ${systemName}`);

    const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
    const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
    const formattedName = systemName.replace(/-/g, ' ').toUpperCase();
    
    modalImage.src = imageUrl;
    modalImage.alt = systemName;
    modalTitle.textContent = formattedName;
    modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);

    setTimeout(() => {
        if (typeof window.loadGameItems === 'function' && typeof window.renderGrid === 'function') {
            window.loadGameItems(systemName, (items) => {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                window.renderGrid(items, systemName, contentGridContainer, modalTitle);
            });
        }
    }, 10);

    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
    }
    centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
    window.isCenteringActive = true;
    
    requestAnimationFrame(() => {
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        setTimeout(() => {
            window.inputLock = false;
        }, INPUT_LOCK_DELAY);
    });
};

const cerrarModal = () => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    modalOverlay.classList.remove('open');

    contentGridContainer.innerHTML = '';
    if (window.gridItemsElements) window.gridItemsElements = [];

    window.hideGameDetailsHard();
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    window.resetNavigationState();

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
        if (event.target === modalOverlay) {
            cerrarModal();
        }
    });
};

document.addEventListener('DOMContentLoaded', initializeDOMReferences);