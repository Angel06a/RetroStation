// =========================================================================
// main-modal-manager.js: Minificado Leve (Optimizado para CSS Animation y Worker)
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
let imageWorker = null; // Referencia al Web Worker
let resourceCache = new Map(); // Caché de Object URLs para las imágenes ya cargadas

// Inicializar el Web Worker
if (window.Worker) {
    imageWorker = new Worker('./Js/image-loader-worker.js');
    console.log("[PRECARGA] Worker de imágenes inicializado.");
}

// Promesa mejorada que usa el Worker si está disponible
const loadResourceOptimized = (fullUrl, id) => {
    return new Promise((resolve, reject) => {
        // 1. Comprobar caché (para evitar recargar un recurso ya cargado)
        if (resourceCache.has(fullUrl)) {
            resolve(resourceCache.get(fullUrl));
            return;
        }

        // 2. Usar Worker si está disponible (carga asíncrona)
        if (imageWorker) {
            
            // Listener para la respuesta del worker
            const workerListener = (event) => {
                const data = event.data;
                if (data.id !== id) return; // Aseguramos que la respuesta es la que esperamos

                imageWorker.removeEventListener('message', workerListener); // Limpiar el listener

                if (data.success && data.objectURL) {
                    // El Worker ha cargado la imagen y nos ha dado un Object URL
                    resourceCache.set(fullUrl, data.objectURL);
                    resolve(data.objectURL);
                } else {
                    console.warn(`Worker falló o no soportado para ${fullUrl}. Cayendo a carga directa.`);
                    // Fallo del worker o error de red: Usar carga directa (Fallback)
                    loadResourceDirect(fullUrl).then(resolve).catch(reject);
                }
            };
            
            imageWorker.addEventListener('message', workerListener);
            
            // Enviar la tarea al Worker
            imageWorker.postMessage({ url: fullUrl, id: id });
            
        } else {
            // 3. Carga Directa (Fallback si Worker no está disponible)
            console.warn(`Worker no disponible. Cargando ${fullUrl} directamente.`);
            loadResourceDirect(fullUrl).then(resolve).catch(reject);
        }
    });
};

// Función de carga directa (similar a tu lógica original, pero más simple)
const loadResourceDirect = (fullUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const fallbackResolve = () => resolve(fullUrl); // Resuelve con la URL original
        
        const decodeAndResolve = () => {
            if ('decode' in img) {
                // Decodificación en requestIdleCallback/setTimeout
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
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    let resourceId = 0;
    const loadPromises = menuItems.flatMap(systemName => {
        const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
        const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;

        // Utilizamos un ID único para cada par de promesa/mensaje al worker
        return [
            loadResourceOptimized(bgUrl, resourceId++),
            loadResourceOptimized(imageUrl, resourceId++)
        ];
    });

    console.log(`[PRECARGA] Iniciando precarga de ${loadPromises.length} recursos con Worker...`);

    Promise.all(loadPromises)
        .then(() => console.log("[PRECARGA] Recursos cargados/decodificados (completado)."))
        .catch(error => console.error("[PRECARGA] Error CRÍTICO en Promise.all:", error));
};

document.addEventListener('DOMContentLoaded', () => {
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
    
    // 1. Obtener URLs de la caché (pueden ser Object URLs o URLs originales)
    const finalImageUrl = resourceCache.get(imageUrl) || imageUrl;
    const finalBgUrl = resourceCache.get(bgUrl) || bgUrl;
    
    requestAnimationFrame(() => {
        // 2. Usar las URLs optimizadas
        modalImage.src = finalImageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = formattedName;
        modalHeader.style.setProperty('--bg-url', `url('${finalBgUrl}')`);
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
