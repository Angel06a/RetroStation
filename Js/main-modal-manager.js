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

// --- NUEVO: Instancia del Web Worker de Decodificación de Imágenes ---
// Se inicializa el Worker, asegurándose de que el archivo exista.
const imageDecoderWorker = new Worker('./Js/image-decoder-worker.js');
const activeDecodes = new Map(); // Mapa para manejar promesas de decodificación activas

// Función para manejar la respuesta del Worker
imageDecoderWorker.onmessage = function(event) {
    const { type, imageUrl, imageBitmap, error } = event.data;
    const resolveReject = activeDecodes.get(imageUrl);

    if (!resolveReject) return; // Si la promesa no existe, ignorar

    const [resolve, reject] = resolveReject;

    if (type === 'DECODE_COMPLETE' && imageBitmap) {
        // En lugar de usar una etiqueta <img>, usamos un <img> temporal o 
        // Canvas. Para el precargado, solo verificar que la decodificación fue exitosa.
        // Si el objetivo es solo precargar, la existencia del ImageBitmap ya lo indica.
        resolve(imageUrl); 
    } else if (type === 'DECODE_ERROR') {
        console.warn(`Decodificación con Worker fallida para ${imageUrl}. Fallback.`, error);
        // Fallback: Si el Worker falla, resolvemos como si hubiéramos fallado 
        // a decodificar, para que el `Promise.all` continúe.
        resolve(imageUrl); 
    }
    
    activeDecodes.delete(imageUrl);
};
// ------------------------------------------------------------------------

const loadResourceOptimized = (fullUrl) => {
    return new Promise((resolve, reject) => {
        // --- Lógica del Worker ---
        // 1. Intentar la decodificación en el Worker
        activeDecodes.set(fullUrl, [resolve, reject]);
        imageDecoderWorker.postMessage({ type: 'DECODE_IMAGE', imageUrl: fullUrl });

        // 2. Fallback por si el Worker o la transferencia falla (ej: browser sin Worker)
        // Aunque la lógica del Worker ya tiene un `resolve` en caso de error para no
        // detener el `Promise.all`, este fallback general asegura la robustez.
        // Esto solo es necesario si el worker no se ejecuta. Si el worker falla internamente,
        // su lógica de `onmessage` con `DECODE_ERROR` se encarga.
    });
};

const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    // Usamos flatMap para crear la lista de recursos a precargar
    const loadPromises = menuItems.flatMap(systemName => [
        BACKGROUND_DIR + systemName + BACKGROUND_EXT, // URL del Fondo
        IMAGE_DIR + systemName + IMAGE_EXT // URL de la Imagen
    ]).map(url => loadResourceOptimized(url)); // Llamamos a la función con el Worker

    console.log(`[PRECARGA] Iniciando precarga de ${loadPromises.length} recursos con Worker...`);

    // Usamos Promise.all para esperar a que todas las decodificaciones/cargas terminen
    Promise.all(loadPromises)
        .then(() => console.log("[PRECARGA] Recursos cargados/decodificados con Worker (completado)."))
        .catch(error => console.error("[PRECARGA] Error CRÍTICO en Promise.all (Worker):", error));
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
    
    // --- Lógica de la imagen usando el Worker para la decodificación ---
    // En lugar de `modalImage.src = imageUrl;`, usaremos el Worker
    
    // 1. Pedir al Worker que decodifique la imagen
    imageDecoderWorker.postMessage({ type: 'DECODE_IMAGE', imageUrl: imageUrl });
    
    // 2. Establecer el título y el fondo inmediatamente
    requestAnimationFrame(() => {
        modalTitle.textContent = formattedName;
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
        // Mostrar la imagen de carga o dejarla vacía hasta que el Worker responda
        modalImage.removeAttribute('src'); 
        modalImage.style.opacity = '0'; // Ocultar hasta que esté lista
    });

    // 3. Esperar la respuesta del Worker para establecer la imagen
    // Nota: Esto es un ejemplo, se necesita un mecanismo para correlacionar la respuesta
    // del Worker con el modal actualmente abierto. Usaremos la respuesta global
    // y solo actualizaremos si la URL coincide con la que estamos intentando cargar.
    const workerImageSetter = (event) => {
        const { type, imageUrl: workerUrl, imageBitmap } = event.data;
        if (type === 'DECODE_COMPLETE' && workerUrl === imageUrl && imageBitmap) {
            // Convertir ImageBitmap a URL para usar en el src
            const canvas = document.createElement('canvas');
            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);
            const dataUrl = canvas.toDataURL();

            // Usar requestAnimationFrame para actualizar el DOM
            requestAnimationFrame(() => {
                modalImage.src = dataUrl;
                modalImage.alt = systemName;
                modalImage.style.opacity = '1';
                // Limpiar el ImageBitmap para liberar memoria
                imageBitmap.close(); 
            });

            // Una vez que la imagen se ha establecido, eliminar el listener temporal
            imageDecoderWorker.removeEventListener('message', workerImageSetter);
        } else if (type === 'DECODE_ERROR' && workerUrl === imageUrl) {
             // Si hay error, intentar con el método clásico (fallback)
             console.warn(`Fallback a <img>.src para ${imageUrl}.`);
             requestAnimationFrame(() => {
                modalImage.src = imageUrl;
                modalImage.alt = systemName;
                modalImage.style.opacity = '1';
             });
             imageDecoderWorker.removeEventListener('message', workerImageSetter);
        }
    };

    // Añadir un listener temporal específico para esta apertura de modal
    imageDecoderWorker.addEventListener('message', workerImageSetter);
    // ----------------------------------------------------------------------


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
