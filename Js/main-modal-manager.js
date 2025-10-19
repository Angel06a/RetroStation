// =========================================================================
// main-modal-manager.js: Funciones de Abrir/Cerrar Modal Principal y Estado Global
// OPTIMIZACIÓN: Remoción de precarga masiva redundante. Uso estricto de rAF 
//               para gestionar reflow y transiciones de apertura.
//
// Dependencias:
// - game-data-loader.js (loadGameItems, renderGrid)
// - game-details-logic.js (hideGameDetailsHard)
// - game-grid-nav.js (resetNavigationState, checkAndRecenterGridSelection, isCenteringActive)
// =========================================================================

// --- Variables Globales de Estado ---
window.inputLock = false; // Bloqueo de entrada general (GLOBAL)
let centeringCheckIntervalId = null;

// --- Constantes de Directorios y Tiempos ---
const CONSTANTS = {
    IMAGE_DIR: "Sistemas/",
    IMAGE_EXT: ".svg",
    BACKGROUND_DIR: "Fondos/",
    BACKGROUND_EXT: ".jpg",
    MODAL_ANIMATION_DELAY: 300, // Tiempo de transición CSS (300ms)
    INPUT_LOCK_DELAY: 200,      // Retardo de desbloqueo de input
};

// --- Referencias de DOM (Inicializadas al final) ---
let modalOverlay;
let modalHeader;
let modalImage;
let modalTitle;
let contentGridContainer;

/**
 * Función que abre el modal principal.
 * @param {string} systemName El nombre del sistema a cargar.
 */
const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    console.log(`-> Función abrirModal() llamada para: ${systemName}`);

    const imageUrl = CONSTANTS.IMAGE_DIR + systemName + CONSTANTS.IMAGE_EXT;
    const bgUrl = CONSTANTS.BACKGROUND_DIR + systemName + CONSTANTS.BACKGROUND_EXT;
    const formattedName = systemName.replace(/-/g, ' ').toUpperCase();
    
    // 1. Actualizar contenido (síncrono y rápido)
    modalImage.src = imageUrl;
    modalImage.alt = systemName;
    modalTitle.textContent = formattedName;
    modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);

    // 2. Carga de datos y renderizado del grid (ASÍNCRONO)
    window.loadGameItems(systemName, (items) => {
        console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
        window.renderGrid(items, systemName, contentGridContainer, modalTitle);
    });

    // 3. Inicio del centrado periódico (si existe la función)
    if (window.checkAndRecenterGridSelection) {
        if (centeringCheckIntervalId) {
            clearInterval(centeringCheckIntervalId);
        }
        centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
        window.isCenteringActive = true;
    }
    
    // 4. Mostrar y animar la superposición en el siguiente frame (para transiciones fluidas)
    requestAnimationFrame(() => {
        modalOverlay.style.display = 'flex';
        // Forzar reflow para la transición CSS
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        // 5. Desbloqueo de input después de la transición
        setTimeout(() => {
            window.inputLock = false;
        }, CONSTANTS.INPUT_LOCK_DELAY);
    });
};

/**
 * Función que cierra el modal principal.
 */
const cerrarModal = () => {
    if (window.inputLock || !modalOverlay) return;

    window.inputLock = true;
    modalOverlay.classList.remove('open');

    // 1. Limpiar contenido y estado
    contentGridContainer.innerHTML = '';
    if (window.gridItemsElements) window.gridItemsElements = [];

    // 2. Cierra detalles y limpia navegación (si existen las funciones)
    if (window.hideGameDetailsHard) {
        window.hideGameDetailsHard();
    }
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    if (window.resetNavigationState) {
        window.resetNavigationState();
    }

    // 3. Ocultar la superposición después de la transición CSS
    setTimeout(() => {
        modalOverlay.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        window.inputLock = false;
    }, CONSTANTS.MODAL_ANIMATION_DELAY);
};

// Exportar las funciones para el acceso global
window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;

/**
 * Inicialización de las referencias DOM y los eventos.
 */
const initializeDOMReferences = () => {
    modalOverlay = document.getElementById('modal-overlay');
    modalHeader = document.getElementById('modal-header');
    const modalCloseButton = document.getElementById('modal-close');
    modalImage = document.getElementById('modal-image');
    modalTitle = document.getElementById('modal-title');
    contentGridContainer = document.getElementById('content-grid-container');

    if (!modalOverlay || !modalHeader || !modalImage || !modalTitle || !contentGridContainer) {
        console.error("🚨 CRÍTICO: Una o más referencias DOM principales para el modal faltan.");
        return;
    }

    // Evento de cierre por botón
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', cerrarModal);
    }

    // Evento de cierre por click en el overlay (fondo)
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            cerrarModal();
        }
    });
};

// INICIALIZACIÓN DEL DOM
document.addEventListener('DOMContentLoaded', initializeDOMReferences);
