// =========================================================================
// game-grid-nav.js: Lógica de Navegación, Scroll y Centrado del Grid
// CORREGIDO: Manejo de la tecla 'Escape' para permitir el cierre de modales.
// =========================================================================

// --- Variables de Estado Globales ---
window.currentGridIndex = 0; // Índice del item seleccionado
window.gridItemsElements = []; // Referencias a los <li> del grid
window.isCenteringActive = false; // Controla si el centrado automático está activo

let gridNavLock = false;
const GRID_NAV_DELAY_MS = 150;
const CENTERING_MARGIN_PX = 100;
let isProgrammaticScrolling = false;

// Variables de Animación de Scroll
let scrollObjetivo = 0;
let scrollActual = 0;
const factorSuavizadoScroll = 0.2;
let animacionScrollFrameId = null;

// Referencias del DOM (inicializadas al final)
let modalBodyRef; 
let modalOverlayRef; 
let gameDetailsOverlayRef; 

/**
 * Bucle de Animación de Scroll Suave.
 */
function animarScrollGrid() {
    const diferenciaScroll = scrollObjetivo - scrollActual;
    
    if (Math.abs(diferenciaScroll) < 1) {
        scrollActual = scrollObjetivo;
        cancelAnimationFrame(animacionScrollFrameId);
        animacionScrollFrameId = null;
        isProgrammaticScrolling = false;
    } else {
        scrollActual += diferenciaScroll * factorSuavizadoScroll;
        animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
    }
    modalBodyRef.scrollTop = scrollActual;
}

/**
 * Actualiza la selección del grid y centra el elemento en la vista.
 * (Usada por el teclado, el clic, el resize y el checkAndRecenterGridSelection)
 */
function updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
    if (window.gridItemsElements.length === 0) return;

    const oldIndex = window.currentGridIndex;

    if (oldIndex !== null && window.gridItemsElements[oldIndex]) {
        window.gridItemsElements[oldIndex].classList.remove('selected');
    }

    window.currentGridIndex = newIndex;

    const selectedElement = window.gridItemsElements[window.currentGridIndex];
    selectedElement.classList.add('selected');

    if (!forceScroll || !modalBodyRef) return;

    // Lógica para evitar scroll en movimientos horizontales (mejora de UX)
    let isHorizontalMovement = false;
    if (!isResizeOrInitialLoad && !ignoreHorizontalCheck && oldIndex !== null) {
        const currentColumns = window.getGridColumns(); 
        if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
            isHorizontalMovement = true;
        }
    }
    if (isHorizontalMovement) return;

    // Cálculo del punto de scroll para centrar el elemento (o la fila)
    const viewportHeight = modalBodyRef.clientHeight;
    const currentColumns = window.getGridColumns(); 
    const rowIndex = Math.floor(window.currentGridIndex / currentColumns);
    const rowStartIndex = rowIndex * currentColumns;
    const rowEndIndex = Math.min((rowIndex + 1) * currentColumns, window.gridItemsElements.length);
    let maxHeight = 0;
    for (let i = rowStartIndex; i < rowEndIndex; i++) {
        if (window.gridItemsElements[i].offsetHeight > maxHeight) {
            maxHeight = window.gridItemsElements[i].offsetHeight;
        }
    }
    const rowStartElement = window.gridItemsElements[rowStartIndex];
    if (!rowStartElement) return;

    const elementRect = rowStartElement.getBoundingClientRect();
    const containerRect = modalBodyRef.getBoundingClientRect();
    const elementTopInScroll = elementRect.top - containerRect.top + modalBodyRef.scrollTop;
    const offsetToCenter = (viewportHeight - maxHeight) / 2;

    scrollObjetivo = elementTopInScroll - offsetToCenter;
    scrollObjetivo = Math.max(0, scrollObjetivo);
    scrollObjetivo = Math.min(scrollObjetivo, modalBodyRef.scrollHeight - viewportHeight);

    // Iniciar animación de scroll si es necesario
    const SCROLL_TOLERANCE_PX = 2;
    const scrollDifference = Math.abs(scrollObjetivo - modalBodyRef.scrollTop);

    if (scrollDifference < SCROLL_TOLERANCE_PX) {
        if (animacionScrollFrameId) {
            cancelAnimationFrame(animacionScrollFrameId);
            animacionScrollFrameId = null;
            isProgrammaticScrolling = false;
        }
        return;
    }
    if (animacionScrollFrameId === null) {
        scrollActual = modalBodyRef.scrollTop;
        isProgrammaticScrolling = true;
        animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
    }
}
window.updateGridSelection = updateGridSelection;


/**
 * Verifica periódicamente si el elemento seleccionado está fuera de los márgenes y lo centra.
 */
function checkAndRecenterGridSelection() {
    if (!modalBodyRef || window.gridItemsElements.length === 0 || !modalOverlayRef.classList.contains('open') || gameDetailsOverlayRef.classList.contains('open')) {
        return;
    }
    if (!window.isCenteringActive) {
         return;
    }

    const selectedElement = window.gridItemsElements[window.currentGridIndex];
    if (!selectedElement) return;

    const viewportHeight = modalBodyRef.clientHeight;
    const elementRect = selectedElement.getBoundingClientRect();
    const containerRect = modalBodyRef.getBoundingClientRect();
    const elementTopInViewport = elementRect.top - containerRect.top;
    const elementBottomInViewport = elementRect.bottom - containerRect.top;

    const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
    const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
    const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;

    if (isTooHigh || isTooLow || isOutOfView) {
        updateGridSelection(window.currentGridIndex, true, true, true);
    }
}
window.checkAndRecenterGridSelection = checkAndRecenterGridSelection;

/**
 * Reinicia las variables de estado de la navegación (llamado por cerrarModal).
 */
function resetNavigationState() {
    window.currentGridIndex = 0;
    isProgrammaticScrolling = false;
    scrollObjetivo = 0;
    scrollActual = 0;
    if (animacionScrollFrameId) {
        cancelAnimationFrame(animacionScrollFrameId);
        animacionScrollFrameId = null;
    }
    window.isCenteringActive = false;
}
window.resetNavigationState = resetNavigationState;


// --- Inicialización y Event Listeners del Grid ---
document.addEventListener('DOMContentLoaded', () => {
    modalBodyRef = document.querySelector('.modal-body');
    modalOverlayRef = document.getElementById('modal-overlay');
    gameDetailsOverlayRef = document.getElementById('game-details-overlay');

    // Listener de scroll (para desactivar el centrado si el usuario hace scroll manual)
    if (modalBodyRef) {
        modalBodyRef.addEventListener('scroll', () => {
            if (modalOverlayRef.classList.contains('open')) {
                if (!isProgrammaticScrolling) {
                    window.isCenteringActive = false;
                    if (animacionScrollFrameId) {
                        cancelAnimationFrame(animacionScrollFrameId);
                        animacionScrollFrameId = null;
                    }
                }
            }
        }, { passive: true });

        modalBodyRef.addEventListener('mousedown', (event) => {
            if (modalOverlayRef.classList.contains('open') && !event.target.closest('.grid-item')) {
                 window.isCenteringActive = false;
            }
        });
    }

    // Listener de teclado para la navegación del grid
    document.addEventListener('keydown', (event) => {
        const detallesAbierto = gameDetailsOverlayRef && gameDetailsOverlayRef.classList.contains('open');
        const modalAbierto = modalOverlayRef && modalOverlayRef.classList.contains('open');
        const isGridActive = modalAbierto && !detallesAbierto && window.gridItemsElements.length > 0;

        // **CORRECCIÓN 1: Bloqueo general modificado**
        // Solo bloqueamos 'Enter' si inputLock está activo. 'Escape' se maneja abajo.
        if (event.key === 'Enter' && window.inputLock) {
            event.preventDefault();
            return;
        }

        // **CORRECCIÓN 2: Manejo de Escape (Ahora este bloque SÍ se ejecuta)**
        if (event.key === 'Escape') {
            if (detallesAbierto) {
                window.cerrarDetallesJuego(); 
            } else if (modalAbierto) {
                window.cerrarModal(); 
            }
            event.preventDefault();
            return;
        }

        // Navegación del Grid (solo si está activo)
        if (isGridActive) {
            if (event.repeat && gridNavLock) {
                event.preventDefault();
                return;
            }

            let newIndex = window.currentGridIndex;
            let targetIndex = window.currentGridIndex;
            let handled = false;
            const lastIndex = window.gridItemsElements.length - 1;
            const currentColumns = window.getGridColumns(); 
            const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);

            if (isArrowKey) {
                switch (event.key) {
                    case 'ArrowLeft': targetIndex = window.currentGridIndex - 1; newIndex = (targetIndex < 0) ? lastIndex : targetIndex; break;
                    case 'ArrowRight': targetIndex = window.currentGridIndex + 1; newIndex = (targetIndex > lastIndex) ? 0 : targetIndex; break;
                    case 'ArrowUp': targetIndex = window.currentGridIndex - currentColumns; newIndex = (targetIndex < 0) ? window.currentGridIndex : targetIndex; break;
                    case 'ArrowDown': targetIndex = window.currentGridIndex + currentColumns; newIndex = Math.min(targetIndex, lastIndex); break;
                }
                handled = true;

            } else if (event.key === 'Enter') {
                window.gridItemsElements[window.currentGridIndex].click();
                handled = true;
            } else {
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
        
        // Bloqueo final de teclas si algún modal está abierto
        if (modalAbierto || detallesAbierto) {
            if(event.key !== 'Enter') {
                 event.preventDefault();
            }
            return;
        }
    });
});