// =========================================================================
// game-grid-nav.js: Lógica de Navegación, Scroll y Centrado del Grid
// Optimizado: Refactorización, uso de constantes y mejor manejo de estado.
// =========================================================================

// --- Variables de Estado Globales (Recomendación: Mantenidas globalmente por diseño) ---
window.currentGridIndex = 0;
window.gridItemsElements = [];
window.isCenteringActive = false; // Controla si el centrado automático está activo

// --- Constantes y Variables de Control ---
const GRID_NAV_DELAY_MS = 150;
const CENTERING_MARGIN_PX = 100;
const SCROLL_SMOOTHING_FACTOR = 0.2;
const SCROLL_TOLERANCE_PX = 2;

let gridNavLock = false;
let isProgrammaticScrolling = false;
let scrollTarget = 0; // Objetivo de scroll (antes: scrollObjetivo)
let currentScroll = 0; // Posición actual para animación (antes: scrollActual)
let scrollAnimationFrameId = null; // ID del frame de animación (antes: animacionScrollFrameId)

// Referencias del DOM (inicializadas al final)
let modalBodyRef;
let modalOverlayRef;
let gameDetailsOverlayRef;

/**
 * Bucle de Animación de Scroll Suave.
 */
function animateGridScroll() {
    const scrollDifference = scrollTarget - currentScroll;

    if (Math.abs(scrollDifference) < 1) {
        currentScroll = scrollTarget;
        cancelAnimationFrame(scrollAnimationFrameId);
        scrollAnimationFrameId = null;
        isProgrammaticScrolling = false;
    } else {
        currentScroll += scrollDifference * SCROLL_SMOOTHING_FACTOR;
        scrollAnimationFrameId = requestAnimationFrame(animateGridScroll);
    }
    modalBodyRef.scrollTop = currentScroll;
}

/**
 * Calcula la altura máxima de la fila actual.
 * @param {number} rowIndex - Índice de la fila.
 * @param {number} currentColumns - Número de columnas.
 * @returns {number} La altura máxima de un elemento en la fila.
 */
function getMaxRowHeight(rowIndex, currentColumns) {
    const rowStartIndex = rowIndex * currentColumns;
    const rowEndIndex = Math.min((rowIndex + 1) * currentColumns, window.gridItemsElements.length);
    let maxHeight = 0;

    for (let i = rowStartIndex; i < rowEndIndex; i++) {
        const item = window.gridItemsElements[i];
        if (item && item.offsetHeight > maxHeight) {
            maxHeight = item.offsetHeight;
        }
    }
    return maxHeight;
}

/**
 * Actualiza la selección del grid y centra el elemento en la vista.
 */
function updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
    const items = window.gridItemsElements;
    if (items.length === 0) return;

    const oldIndex = window.currentGridIndex;
    const newElement = items[newIndex];
    const oldElement = items[oldIndex];

    // 1. Actualización de Clases
    if (oldElement) {
        oldElement.classList.remove('selected');
    }
    window.currentGridIndex = newIndex;
    newElement.classList.add('selected');

    if (!forceScroll || !modalBodyRef) return;

    // 2. Lógica de Navegación Horizontal (UX)
    let isHorizontalMovement = false;
    if (!isResizeOrInitialLoad && !ignoreHorizontalCheck && oldIndex !== null) {
        const currentColumns = window.getGridColumns();
        if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
            isHorizontalMovement = true;
        }
    }
    if (isHorizontalMovement) return;

    // 3. Cálculo del Scroll Objetivo
    const viewportHeight = modalBodyRef.clientHeight;
    const currentColumns = window.getGridColumns();
    const rowIndex = Math.floor(window.currentGridIndex / currentColumns);
    const rowStartElement = items[rowIndex * currentColumns];

    if (!rowStartElement) return;

    const maxHeight = getMaxRowHeight(rowIndex, currentColumns);
    const elementRect = rowStartElement.getBoundingClientRect();
    const containerRect = modalBodyRef.getBoundingClientRect();
    const elementTopInScroll = elementRect.top - containerRect.top + modalBodyRef.scrollTop;

    // Centrar la fila (o el elemento más alto de la fila)
    const offsetToCenter = (viewportHeight - maxHeight) / 2;

    scrollTarget = elementTopInScroll - offsetToCenter;
    scrollTarget = Math.max(0, scrollTarget);
    scrollTarget = Math.min(scrollTarget, modalBodyRef.scrollHeight - viewportHeight);

    // 4. Iniciar/Controlar Animación de Scroll
    const scrollDifference = Math.abs(scrollTarget - modalBodyRef.scrollTop);

    if (scrollDifference < SCROLL_TOLERANCE_PX) {
        if (scrollAnimationFrameId) {
            cancelAnimationFrame(scrollAnimationFrameId);
            scrollAnimationFrameId = null;
            isProgrammaticScrolling = false;
        }
        return;
    }

    if (scrollAnimationFrameId === null) {
        currentScroll = modalBodyRef.scrollTop;
        isProgrammaticScrolling = true;
        scrollAnimationFrameId = requestAnimationFrame(animateGridScroll);
    }
}
window.updateGridSelection = updateGridSelection;


/**
 * Verifica periódicamente si el elemento seleccionado está fuera de los márgenes y lo centra.
 */
function checkAndRecenterGridSelection() {
    const isModalOpen = modalOverlayRef && modalOverlayRef.classList.contains('open');
    const isDetailsOpen = gameDetailsOverlayRef && gameDetailsOverlayRef.classList.contains('open');
    const items = window.gridItemsElements;

    if (!modalBodyRef || items.length === 0 || !isModalOpen || isDetailsOpen || !window.isCenteringActive) {
        return;
    }

    const selectedElement = items[window.currentGridIndex];
    if (!selectedElement) return;

    const viewportHeight = modalBodyRef.clientHeight;
    const elementRect = selectedElement.getBoundingClientRect();
    const containerRect = modalBodyRef.getBoundingClientRect();

    const elementTopInViewport = elementRect.top - containerRect.top;
    const elementBottomInViewport = elementRect.bottom - containerRect.top;

    // Se verifica si está demasiado cerca del borde o completamente fuera de la vista.
    const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
    const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
    const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;

    if (isTooHigh || isTooLow || isOutOfView) {
        // El tercer argumento 'true' fuerza el cálculo de scroll, el cuarto 'true' ignora el check horizontal.
        updateGridSelection(window.currentGridIndex, true, true, true);
    }
}
window.checkAndRecenterGridSelection = checkAndRecenterGridSelection;

/**
 * Reinicia las variables de estado de la navegación (llamado por cerrarModal).
 */
function resetNavigationState() {
    window.currentGridIndex = 0;
    window.isCenteringActive = false;
    isProgrammaticScrolling = false;
    scrollTarget = 0;
    currentScroll = 0;
    if (scrollAnimationFrameId) {
        cancelAnimationFrame(scrollAnimationFrameId);
        scrollAnimationFrameId = null;
    }
}
window.resetNavigationState = resetNavigationState;


// --- Funciones de Manejo de Eventos ---

/**
 * Maneja el evento de scroll manual del usuario.
 */
function handleModalScroll() {
    // Si el usuario hace scroll manualmente (no es programático)
    if (!isProgrammaticScrolling) {
        window.isCenteringActive = false;
        // Detener la animación de scroll suave si estaba en curso
        if (scrollAnimationFrameId) {
            cancelAnimationFrame(scrollAnimationFrameId);
            scrollAnimationFrameId = null;
        }
    }
}

/**
 * Maneja los eventos de teclado para navegación y acciones.
 */
function handleKeydown(event) {
    const isDetailsOpen = gameDetailsOverlayRef && gameDetailsOverlayRef.classList.contains('open');
    const isModalOpen = modalOverlayRef && modalOverlayRef.classList.contains('open');
    const isGridActive = isModalOpen && !isDetailsOpen && window.gridItemsElements.length > 0;
    const key = event.key;

    // 1. Bloqueo de 'Enter' si está activo el inputLock
    if (key === 'Enter' && window.inputLock) {
        event.preventDefault();
        return;
    }

    // 2. Manejo de 'Escape' (Cierre de modales/detalles)
    if (key === 'Escape') {
        if (isDetailsOpen) {
            window.cerrarDetallesJuego();
        } else if (isModalOpen) {
            window.cerrarModal();
        }
        event.preventDefault();
        return;
    }

    // 3. Navegación del Grid (solo si está activo)
    if (isGridActive) {
        // Bloqueo de navegación rápida en repetición
        if (event.repeat && gridNavLock) {
            event.preventDefault();
            return;
        }

        let newIndex = window.currentGridIndex;
        let targetIndex = window.currentGridIndex;
        let handled = false;
        const lastIndex = window.gridItemsElements.length - 1;
        const currentColumns = window.getGridColumns();
        const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);

        if (isArrowKey) {
            switch (key) {
                case 'ArrowLeft':
                    targetIndex = window.currentGridIndex - 1;
                    newIndex = (targetIndex < 0) ? lastIndex : targetIndex;
                    break;
                case 'ArrowRight':
                    targetIndex = window.currentGridIndex + 1;
                    newIndex = (targetIndex > lastIndex) ? 0 : targetIndex;
                    break;
                case 'ArrowUp':
                    targetIndex = window.currentGridIndex - currentColumns;
                    newIndex = (targetIndex < 0) ? window.currentGridIndex : targetIndex;
                    break;
                case 'ArrowDown':
                    targetIndex = window.currentGridIndex + currentColumns;
                    newIndex = Math.min(targetIndex, lastIndex);
                    break;
            }
            handled = true;
        } else if (key === 'Enter') {
            window.gridItemsElements[window.currentGridIndex].click();
            handled = true;
        } else {
            // Si es otra tecla, desactivamos el centrado (para permitir scroll manual libre)
            window.isCenteringActive = false;
        }

        if (isArrowKey) {
            if (newIndex !== window.currentGridIndex) {
                if (event.repeat) {
                    gridNavLock = true;
                    setTimeout(() => { gridNavLock = false; }, GRID_NAV_DELAY_MS);
                }
                window.isCenteringActive = true;
                updateGridSelection(newIndex, true, false, false);
            }
        }

        if (handled) {
            event.preventDefault();
            return;
        }
    }

    // 4. Bloqueo final de teclas si algún modal está abierto
    if (isModalOpen || isDetailsOpen) {
        if (key !== 'Enter') { // 'Enter' ya se maneja explícitamente arriba
            event.preventDefault();
        }
    }
}

/**
 * Inicialización de referencias DOM y Event Listeners.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización de Referencias
    modalBodyRef = document.querySelector('.modal-body');
    modalOverlayRef = document.getElementById('modal-overlay');
    gameDetailsOverlayRef = document.getElementById('game-details-overlay');

    // Listener de scroll (para desactivar el centrado si el usuario hace scroll manual)
    if (modalBodyRef && modalOverlayRef) {
        modalBodyRef.addEventListener('scroll', handleModalScroll, { passive: true });

        // Listener de click/mousedown fuera de los elementos del grid (para desactivar centrado)
        modalBodyRef.addEventListener('mousedown', (event) => {
            if (modalOverlayRef.classList.contains('open') && !event.target.closest('.grid-item')) {
                 window.isCenteringActive = false;
            }
        });
    }

    // Listener de teclado global
    document.addEventListener('keydown', handleKeydown);
});