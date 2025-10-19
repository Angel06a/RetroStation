// =========================================================================
// main-modal-manager.js: Funciones de Abrir/Cerrar Modal Principal y Estado Global
// OPTIMIZADO: Incluye precarga controlada de fondos E IMÁGENES DE SISTEMA.
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
const IMAGE_DIR = "Sistemas/";
const IMAGE_EXT = ".svg";
const BACKGROUND_DIR = "Fondos/";
const BACKGROUND_EXT = ".jpg";
const MODAL_ANIMATION_DELAY = 300; // Tiempo de transición CSS (300ms)
const INPUT_LOCK_DELAY = 200;      // Retardo de desbloqueo de input

// --- Referencias de DOM ---
let modalOverlay;
let modalHeader;
let modalImage;
let modalTitle;
let contentGridContainer;

/**
 * Función optimizada para precargar y DECODIFICAR asíncronamente un recurso.
 * Implementa la misma lógica de optimización que _preloadAndDecodeImage en ui-logic.js.
 * @param {string} fullUrl La URL completa del recurso.
 * @returns {Promise<string>} Una promesa que se resuelve con la URL.
 */
const loadResourceOptimized = (fullUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const decodeAction = () => {
                if ('decode' in img) {
                    // Decodificación asíncrona para navegadores modernos
                    img.decode()
                        .then(() => resolve(fullUrl))
                        .catch(error => {
                            console.warn(`Error al decodificar imagen: ${fullUrl}`, error);
                            resolve(fullUrl); // Resolvemos en caso de fallo de decodificación
                        });
                } else {
                    // Fallback: Resuelve inmediatamente si decode no está soportado
                    resolve(fullUrl);
                }
            };

            // Priorizar requestIdleCallback si está disponible, sino usar setTimeout
            if ('requestIdleCallback' in window) {
                requestIdleCallback(decodeAction);
            } else {
                setTimeout(decodeAction, 0);
            }
        };
        img.onerror = (e) => {
            console.warn(`Error al cargar el recurso: ${fullUrl}`);
            resolve(fullUrl); // Resolvemos en error para que Promise.all no falle por 1 recurso
        };
        img.src = fullUrl;
    });
};

/**
 * Precarga todos los recursos (imágenes de sistema y fondos) usando la decodificación optimizada.
 */
const preloadAllResources = () => {
    // Verificar que 'menuItems' esté disponible (viene de data.js)
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const loadPromises = [];

    menuItems.forEach(systemName => {
        // Precarga de Fondo (JPG)
        const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
        loadPromises.push(loadResourceOptimized(bgUrl));

        // Precarga de Imagen de Sistema (SVG)
        const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
        loadPromises.push(loadResourceOptimized(imageUrl));
    });

    console.log(`[PRECARGA] Iniciando precarga y decodificación de ${loadPromises.length} recursos...`);

    // Esperar a que todas las precargas finalicen
    Promise.all(loadPromises)
        .then(() => {
            console.log("[PRECARGA] Todos los recursos han intentado cargarse y decodificarse (completado).");
        })
        .catch(error => {
            console.error("[PRECARGA] Error CRÍTICO en la gestión de Promise.all:", error);
        });
};

// **LLAMADA INMEDIATA A LA PRECARGA**
preloadAllResources();

/**
 * Función que abre el modal principal.
 * @param {string} systemName El nombre del sistema a cargar.
 */
const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;

    try {
        window.inputLock = true;
        console.log(`-> Función abrirModal() llamada para: ${systemName}`);

        const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
        const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
        const formattedName = systemName.replace(/-/g, ' ').toUpperCase();

        // 1. Mostrar y animar la superposición
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; // Forzar reflow para la transición CSS
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        // 2. Actualizar contenido (ya precargado)
        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = formattedName;
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);

        // 3. Carga de datos y renderizado del grid
        window.loadGameItems(systemName, (items) => {
            console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
            window.renderGrid(items, systemName, contentGridContainer, modalTitle);
        });

        // 4. Inicio del centrado periódico
        if (centeringCheckIntervalId) {
            clearInterval(centeringCheckIntervalId);
        }
        centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
        window.isCenteringActive = true;

        // 5. Desbloqueo de input después de la transición
        setTimeout(() => {
            window.inputLock = false;
        }, INPUT_LOCK_DELAY);

    } catch (error) {
        console.error("[ERROR CRÍTICO SÍNCRONO] 🚨 La función abrirModal() falló:", error);
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            modalOverlay.classList.remove('open');
        }
        window.inputLock = false;
    }
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

    // 2. Cierra detalles y limpia navegación
    window.hideGameDetailsHard();
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    window.resetNavigationState();

    // 3. Ocultar la superposición después de la transición CSS
    setTimeout(() => {
        modalOverlay.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        window.inputLock = false;
    }, MODAL_ANIMATION_DELAY);
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
