// =========================================================================
// main-modal-manager.js: Minificado Leve (Optimizado con Web Worker)
// =========================================================================

// --- Nuevas Variables para Web Worker ---
let imageWorker = null;
const decodeRequests = new Map(); // Mapa para manejar las Promesas de decodificación
let requestIdCounter = 0;
// ---------------------------------------

window.inputLock = false;
let centeringCheckIntervalId = null;

const IMAGE_DIR = "Sistemas/";
const IMAGE_EXT = ".svg";
const BACKGROUND_DIR = "Fondos/";
const BACKGROUND_EXT = ".jpg";
const MODAL_ANIMATION_DELAY = 300;
const INPUT_LOCK_DELAY = 200;

let modalOverlay, modalHeader, modalImage, modalTitle, contentGridContainer;

// --- Nueva Función: Inicialización del Web Worker ---
const initializeImageWorker = () => {
    if ('Worker' in window && !imageWorker) {
        try {
            // Importante: La ruta debe ser relativa al index.html
            imageWorker = new Worker('Js/worker-image-loader.js');
            imageWorker.onmessage = handleWorkerMessage;
            imageWorker.onerror = (e) => {
                console.error("Error en Web Worker de imagen:", e);
                // Si el worker falla, forzamos un fallback
                imageWorker = null;
            };
            // console.log("Web Worker de decodificación de imagen inicializado.");
        } catch (e) {
            console.warn("Fallo al crear Web Worker. Usando lógica de hilo principal.", e);
            imageWorker = null;
        }
    }
};

// --- Nueva Función: Manejo de Mensajes del Worker ---
const handleWorkerMessage = (event) => {
    const { id, status, url } = event.data;
    const { resolve } = decodeRequests.get(id) || {};
    
    if (resolve) {
        // En ambos casos (éxito o error), resolvemos la promesa para continuar el flujo
        // y que el <img> se muestre, confiando en el navegador.
        resolve(url); 
    }
    decodeRequests.delete(id);
};
// ----------------------------------------------------


const loadResourceOptimized = (fullUrl) => {
    return new Promise((resolve) => { // Eliminamos 'reject' ya que siempre resolvemos (con fallback)
        
        // --- 1. Lógica del Worker (Decodificación Off-thread) ---
        if (imageWorker) {
            const id = requestIdCounter++;
            decodeRequests.set(id, { resolve });
            
            // Enviamos la URL al worker para que haga el fetch y la decodificación pesada.
            imageWorker.postMessage({ id: id, url: fullUrl, type: 'DECODE_AND_RETURN_BLOB' });
            
            // Lógica de Timeout (evita bloqueos si el worker se congela o tarda demasiado)
            setTimeout(() => {
                if (decodeRequests.has(id)) {
                    console.warn(`Timeout de decodificación para ${fullUrl}. Usando fallback de hilo principal.`);
                    decodeRequests.delete(id);
                    resolve(fullUrl); // Fallback a resolver y dejar que el navegador lo maneje.
                }
            }, 5000); // 5 segundos de timeout
            
            return;
        }
        // ------------------------------------------------------

        // --- 2. Lógica de Fallback/Hilo Principal (Old img.decode()) ---
        const img = new Image();
        const fallbackResolve = () => resolve(fullUrl);
        
        const decodeAndResolve = () => {
            if ('decode' in img) {
                // Si no hay Worker, usamos el método no-bloqueante del navegador (en hilo principal)
                const decodePromise = img.decode().then(fallbackResolve).catch(error => {
                    console.warn(`Error al decodificar: ${fullUrl}. Fallback.`, error);
                    fallbackResolve(); 
                });
                
                // Usamos requestIdleCallback/setTimeout para dar baja prioridad
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => decodePromise);
                } else {
                    setTimeout(() => decodePromise, 0);
                }
            } else {
                // No soporta decode, resolvemos inmediatamente
                setTimeout(fallbackResolve, 0);
            }
        };
        
        img.onload = () => decodeAndResolve();
        
        img.onerror = (error) => {
            console.error(`Error al cargar el recurso ${fullUrl}`, error);
            resolve(fullUrl); // Resolvemos incluso con error.
        };
        
        // Iniciar la carga en el hilo principal (solo para el fallback)
        img.src = fullUrl;
    });
};

const setModalBackground = (systemName) => {
    const bgUrl = `${BACKGROUND_DIR}${systemName}${BACKGROUND_EXT}`;
    const backgroundContainer = document.getElementById('background-container');
    const backgroundOverlay = document.getElementById('background-overlay');

    loadResourceOptimized(bgUrl).then(() => {
        backgroundContainer.style.backgroundImage = `url('${bgUrl}')`;
        backgroundOverlay.classList.remove('fade-out');
        backgroundOverlay.classList.add('fade-in');

        // Reinicia la animación fade-in
        backgroundOverlay.style.animation = 'none';
        backgroundOverlay.offsetHeight; // Tricker reflow
        backgroundOverlay.style.animation = '';

        setTimeout(() => {
            backgroundOverlay.classList.remove('fade-in');
            backgroundOverlay.classList.add('fade-out');
        }, 300); // Duración de la animación de fondo
    });
};


const abrirModal = (systemName) => {
    if (window.inputLock) return;
    window.inputLock = true;
    
    document.body.setAttribute('data-modal-open', 'true');
    modalOverlay.style.display = 'block';
    
    // 1. Configurar y cargar imagen del sistema
    const fullUrl = `${IMAGE_DIR}${systemName}${IMAGE_EXT}`;
    modalImage.style.opacity = 0; // Ocultar antes de cargar
    modalImage.src = fullUrl; // Inicia la carga del navegador

    // Inicia la decodificación Off-thread. Cuando se resuelve, la imagen ya está pre-procesada.
    loadResourceOptimized(fullUrl).then(() => {
        modalImage.style.opacity = 1; // Mostrar la imagen instantáneamente
    });


    // 2. Cargar Fondo
    setModalBackground(systemName);

    // 3. Establecer título
    modalTitle.textContent = systemName;
    modalHeader.setAttribute('data-system', systemName.toLowerCase());

    // 4. Cargar lista de juegos (Usa window.loadGameItems que debería usar data-parser-worker.js)
    window.loadGameItems(systemName, window.updateGridContent);

    // 5. Mostrar Modal
    requestAnimationFrame(() => {
        modalOverlay.classList.add('open');
        setTimeout(() => {
            window.inputLock = false; 
            // Iniciar la verificación de centrado
            if (typeof window.checkCentering === 'function') {
                if (centeringCheckIntervalId) clearInterval(centeringCheckIntervalId);
                centeringCheckIntervalId = setInterval(window.checkCentering, 100);
            }
        }, INPUT_LOCK_DELAY);
    });
};

const cerrarModal = () => {
    if (window.inputLock) return;
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
    
    // --- NUEVA LÍNEA: Inicializar el Web Worker ---
    initializeImageWorker();

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', cerrarModal);
    }

    // Inicializar el background al cargar
    setTimeout(() => setModalBackground('initial'), 0);
};

document.addEventListener('DOMContentLoaded', initializeDOMReferences);
