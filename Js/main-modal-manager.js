// =========================================================================
// main-modal-manager.js: Funciones de Abrir/Cerrar Modal Principal y Estado Global
// OPTIMIZADO: Incluye precarga controlada de fondos E IMÁGENES DE SISTEMA.
// ⚠️ MEJORA ADVERSA: Garantía de no bloqueo de frame incluso en fallos de decode()
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
 * Prioriza requestIdleCallback para cualquier operación intensiva de CPU.
 * * @param {string} fullUrl La URL completa del recurso.
 * @returns {Promise<string>} Una promesa que se resuelve con la URL.
 */
const loadResourceOptimized = (fullUrl) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // 1. Manejo de la carga exitosa
        img.onload = () => {
            // ================================================================
            // 💡 OPTIMIZACIÓN CRÍTICA: Decodificación y Fallback en "Idle Time"
            // Se asegura de que la decodificación (heavy CPU operation)
            // se ejecute SÓLO cuando el navegador está inactivo.
            // ================================================================
            const decodeAction = () => {
                if ('decode' in img) {
                    // Decodificación en HILO SECUNDARIO (no bloquea el frame)
                    img.decode()
                        .then(() => resolve(fullUrl))
                        .catch(error => {
                            // Si decode falla (e.g., por memoria), resolvemos de forma NO BLOQUEANTE
                            console.warn(`Error al decodificar imagen: ${fullUrl}. Resolviendo en fallback.`, error);
                            resolve(fullUrl); 
                        });
                } else {
                    // Fallback (navegadores antiguos): La decodificación ocurre síncronamente 
                    // en el evento 'onload', pero la resolución de la Promise se aplaza.
                    resolve(fullUrl);
                }
            };

            // APLAZAR LA EJECUCIÓN
            if ('requestIdleCallback' in window) {
                requestIdleCallback(decodeAction);
            } else {
                setTimeout(decodeAction, 0); // Mejor que nada (después de 'onload')
            }
        };
        
        // 2. Manejo de fallos de red (mal internet) de forma NO BLOQUEANTE
        img.onerror = (e) => {
            console.warn(`Error al cargar el recurso (red): ${fullUrl}. Resolviendo en fallback.`);
            resolve(fullUrl); // Resolvemos para que Promise.all continúe.
        };
        
        // La descarga comienza aquí (asíncrona por naturaleza)
        img.src = fullUrl;
    });
};

/**
 * Precarga todos los recursos (imágenes de sistema y fondos) usando la decodificación optimizada.
 * Esta función es completamente ASÍNCRONA.
 */
const preloadAllResources = () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga: 'menuItems' no está disponible. Saltando.");
        return;
    }

    const loadPromises = [];

    menuItems.forEach(systemName => {
        // Precarga de Fondo (JPG) y Sistema (SVG)
        loadPromises.push(loadResourceOptimized(BACKGROUND_DIR + systemName + BACKGROUND_EXT));
        loadPromises.push(loadResourceOptimized(IMAGE_DIR + systemName + IMAGE_EXT));
    });

    console.log(`[PRECARGA] Iniciando precarga y decodificación de ${loadPromises.length} recursos...`);

    // Esperar a que todas las precargas finalicen
    // La promesa resuelve cuando se ha intentado la carga y decodificación,
    // garantizando que las operaciones de CPU no detengan la interfaz.
    Promise.all(loadPromises)
        .then(() => {
            console.log("[PRECARGA] Todos los recursos han intentado cargarse y decodificarse (completado).");
        })
        .catch(error => {
            console.error("[PRECARGA] Error CRÍTICO en la gestión de Promise.all:", error);
        });
};

// La precarga se inicia inmediatamente al cargar el script.
preloadAllResources();

/**
 * Función que abre el modal principal.
 * @param {string} systemName El nombre del sistema a cargar.
 */
const abrirModal = (systemName) => {
    if (window.inputLock || !modalOverlay) return;

    // Bloqueo de input
    window.inputLock = true;
    console.log(`-> Función abrirModal() llamada para: ${systemName}`);

    const imageUrl = IMAGE_DIR + systemName + IMAGE_EXT;
    const bgUrl = BACKGROUND_DIR + systemName + BACKGROUND_EXT;
    const formattedName = systemName.replace(/-/g, ' ').toUpperCase();
    
    // ================================================================
    // 💡 OPTIMIZACIÓN: Aplazar el Reflow forzado y el Renderizado inicial
    // ================================================================
    
    // 1. Actualizar contenido (síncrono y rápido)
    modalImage.src = imageUrl;
    modalImage.alt = systemName;
    modalTitle.textContent = formattedName;
    modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);

    // 2. Carga de datos y renderizado del grid (ASÍNCRONO - en game-data-loader.js)
    // Esto es el trabajo más pesado y ya es asíncrono.
    window.loadGameItems(systemName, (items) => {
        console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
        window.renderGrid(items, systemName, contentGridContainer, modalTitle);
    });

    // 3. Inicio del centrado periódico
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
    }
    centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);
    window.isCenteringActive = true;
    
    // 4. Mostrar y animar la superposición en el siguiente frame (para reducir el lag inicial)
    requestAnimationFrame(() => {
        modalOverlay.style.display = 'flex';
        // Forzar reflow para la transición CSS AHORA que el contenido ya fue actualizado
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        // 5. Desbloqueo de input después de la transición
        setTimeout(() => {
            window.inputLock = false;
        }, INPUT_LOCK_DELAY);
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
