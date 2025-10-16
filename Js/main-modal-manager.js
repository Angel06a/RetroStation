// =========================================================================
// main-modal-manager.js: Funciones de Abrir/Cerrar Modal Principal y Estado Global
// OPTIMIZADO: Incluye precarga de fondos.
//
// Dependencias:
// - game-data-loader.js (loadGameItems, renderGrid)
// - game-details-logic.js (hideGameDetailsHard)
// - game-grid-nav.js (resetNavigationState, checkAndRecenterGridSelection, isCenteringActive)
// =========================================================================

// --- Variables Globales de Estado ---
window.inputLock = false; // Bloqueo de entrada general (GLOBAL)
let centeringCheckIntervalId = null;

// --- Constantes de Directorios ---
const imageDirectory = "Sistemas/";
const imageExtension = ".svg";
const backgroundDirectory = "Fondos/";
const backgroundExtension = ".jpg";

// --- Referencias de DOM ---
let modalOverlay;
let modalHeader;
let modalCloseButton;
let modalImage;
let modalTitle;
let contentGridContainer;

/**
 * Precarga todas las imágenes de fondo en el caché del navegador
 * para asegurar transiciones suaves y evitar 'lag'.
 * Asume que 'menuItems' es una variable global definida en data.js.
 */
function preloadBackgrounds() {
    // Verificar que 'menuItems' esté disponible (viene de data.js)
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.warn("Precarga de fondos: 'menuItems' no está disponible. Saltando precarga.");
        return;
    }

    console.log(`[PRECARGA] Iniciando precarga de ${menuItems.length} fondos...`);

    menuItems.forEach(systemName => {
        const fullUrl = backgroundDirectory + systemName + backgroundExtension;
        const img = new Image();
        img.src = fullUrl;
        // La descarga y el cacheo se realizan en segundo plano.
    });
    console.log("[PRECARGA] Todos los fondos han sido solicitados para precarga.");
}

// **LLAMADA INMEDIATA A LA PRECARGA**
// Esto se hace tan pronto como el script se ejecuta, optimizando la carga.
preloadBackgrounds();

/**
 * Función que abre el modal principal.
 */
function abrirModal(systemName) {
    if (window.inputLock) return;
    window.inputLock = true;

    try {
        console.log(`-> Función abrirModal() llamada para: ${systemName}`);

        const imageUrl = imageDirectory + systemName + imageExtension;
        const bgUrl = backgroundDirectory + systemName + backgroundExtension;

        if (!modalOverlay) throw new Error("Modal overlay no encontrado.");

        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth;
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');

        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = systemName.replace(/-/g, ' ').toUpperCase();
        // El fondo ya debe estar en caché gracias a la precarga.
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);

        // Llamada a la lógica de carga de datos
        window.loadGameItems(systemName, (items) => {
            if (items.length > 0) {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                window.renderGrid(items, systemName, contentGridContainer, modalTitle);
            } else {
                window.renderGrid([], systemName, contentGridContainer, modalTitle);
            }
        });

        // Inicio del centrado periódico
        if (centeringCheckIntervalId) {
            clearInterval(centeringCheckIntervalId);
        }
        centeringCheckIntervalId = setInterval(window.checkAndRecenterGridSelection, 500);

        window.isCenteringActive = true;

        setTimeout(() => {
            window.inputLock = false;
        }, 200);

    } catch (error) {
        console.error("[ERROR CRÍTICO SÍNCRONO] 🚨 La función abrirModal() falló:", error);
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            modalOverlay.classList.remove('open');
        }
        window.inputLock = false;
    }
}

/**
 * Función que cierra el modal principal.
 */
function cerrarModal() {
    if (window.inputLock) return;
    window.inputLock = true;

    if (!modalOverlay) return;

    modalOverlay.classList.remove('open');

    // Limpiar contenido y estado del grid
    contentGridContainer.innerHTML = '';
    window.gridItemsElements = []; 

    window.hideGameDetailsHard(); // Cierra el modal de detalles (si está abierto)

    // Limpiar intervalo y estado de navegación
    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    window.resetNavigationState();

    setTimeout(() => {
        modalOverlay.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        window.inputLock = false;
    }, 300);
}

window.abrirModal = abrirModal;
window.cerrarModal = cerrarModal;

// INICIALIZACIÓN DEL DOM
document.addEventListener('DOMContentLoaded', () => {
    modalOverlay = document.getElementById('modal-overlay');
    modalHeader = document.getElementById('modal-header');
    modalCloseButton = document.getElementById('modal-close');
    modalImage = document.getElementById('modal-image');
    modalTitle = document.getElementById('modal-title');
    contentGridContainer = document.getElementById('content-grid-container');

    if (modalCloseButton) modalCloseButton.addEventListener('click', cerrarModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            cerrarModal();
        }
    });
});