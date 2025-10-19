// =========================================================================
// game-grid-nav-optimized.js: Lógica de Navegación, Scroll y Centrado del Grid
// Optimización: Uso de IIFE para encapsulamiento, mejor manejo de estado de centrado
// y limpieza del flujo de navegación.
// =========================================================================

(function() {
    // --- Variables de Estado Globales (Expuestas al 'window' según el diseño) ---
    window.currentGridIndex = 0;
    window.gridItemsElements = [];
    // isCenteringActive se usará para forzar el scroll en la navegación con flechas
    // y se controlará de cerca para evitar recálculos excesivos.
    window.isCenteringActive = false;

    // --- Constantes y Variables de Control (Encapsuladas en el IIFE) ---
    const GRID_NAV_DELAY_MS = 150;
    const CENTERING_MARGIN_PX = 100;
    const SCROLL_SMOOTHING_FACTOR = 0.2;
    const SCROLL_TOLERANCE_PX = 2;

    let gridNavLock = false;
    let isProgrammaticScrolling = false;
    let scrollTarget = 0;
    let currentScroll = 0;
    let scrollAnimationFrameId = null; // ID del frame de animación (Scroll Suave)
    let recenterAnimationFrameId = null; // ID del frame de animación (Recentreo periódico)

    // Referencias del DOM
    let modalBodyRef;
    let modalOverlayRef;
    let gameDetailsOverlayRef;

    /**
     * Bucle de Animación de Scroll Suave.
     * Usa requestAnimationFrame para una transición fluida.
     */
    function animateGridScroll() {
        const scrollDifference = scrollTarget - currentScroll;

        if (Math.abs(scrollDifference) < SCROLL_TOLERANCE_PX) {
            currentScroll = scrollTarget;
            modalBodyRef.scrollTop = currentScroll; // Asigna el valor final
            cancelAnimationFrame(scrollAnimationFrameId);
            scrollAnimationFrameId = null;
            isProgrammaticScrolling = false;
        } else {
            currentScroll += scrollDifference * SCROLL_SMOOTHING_FACTOR;
            modalBodyRef.scrollTop = currentScroll;
            scrollAnimationFrameId = requestAnimationFrame(animateGridScroll);
        }
    }

    /**
     * Calcula la altura máxima de la fila actual.
     * @param {number} rowIndex - Índice de la fila.
     * @param {number} currentColumns - Número de columnas.
     * @returns {number} La altura máxima de un elemento en la fila.
     */
    function getMaxRowHeight(rowIndex, currentColumns) {
        const items = window.gridItemsElements;
        const rowStartIndex = rowIndex * currentColumns;
        const rowEndIndex = Math.min((rowIndex + 1) * currentColumns, items.length);
        let maxHeight = 0;

        for (let i = rowStartIndex; i < rowEndIndex; i++) {
            const item = items[i];
            if (item && item.offsetHeight > maxHeight) {
                maxHeight = item.offsetHeight;
            }
        }
        return maxHeight;
    }

    /**
     * Actualiza la selección del grid y centra el elemento en la vista si es necesario.
     * Expuesta globalmente.
     * @param {number} newIndex - Nuevo índice del elemento seleccionado.
     * @param {boolean} forceScroll - Fuerza el cálculo y la animación del scroll.
     * @param {boolean} isResizeOrInitialLoad - Indica si la llamada viene de un resize o carga inicial.
     * @param {boolean} ignoreHorizontalCheck - Ignora el chequeo horizontal (útil para centrado forzado).
     */
    function updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
        const items = window.gridItemsElements;
        if (items.length === 0 || newIndex < 0 || newIndex >= items.length) return;

        const oldIndex = window.currentGridIndex;
        const newElement = items[newIndex];

        // 1. Actualización de Clases
        if (oldIndex !== newIndex && items[oldIndex]) {
            items[oldIndex].classList.remove('selected');
        }
        window.currentGridIndex = newIndex;
        newElement.classList.add('selected');

        if (!forceScroll || !modalBodyRef) return;

        // 2. Lógica de Navegación Horizontal (UX): Evita scroll vertical si es solo movimiento lateral
        let isHorizontalMovement = false;
        if (!isResizeOrInitialLoad && !ignoreHorizontalCheck && oldIndex !== newIndex) {
            const currentColumns = window.getGridColumns();
            // Si la división por el número de columnas (fila) es la misma, es movimiento horizontal
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
        // Posición del inicio de la fila relativo al inicio del scrollable content
        const elementTopInScroll = elementRect.top - containerRect.top + modalBodyRef.scrollTop;

        // Calcular el desplazamiento para centrar la fila (usando la altura máxima de la fila)
        const offsetToCenter = (viewportHeight - maxHeight) / 2;

        scrollTarget = elementTopInScroll - offsetToCenter;

        // Limitar el objetivo de scroll para evitar scroll excesivo al inicio/final
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

        // Si ya hay una animación, la sobrescribe o la continua hacia el nuevo target
        currentScroll = modalBodyRef.scrollTop;
        isProgrammaticScrolling = true;
        if (scrollAnimationFrameId === null) {
            scrollAnimationFrameId = requestAnimationFrame(animateGridScroll);
        }
    }
    window.updateGridSelection = updateGridSelection;


    /**
     * Bucle para verificar periódicamente si el elemento seleccionado está fuera de los márgenes y lo centra.
     * Utiliza requestAnimationFrame solo cuando el centrado está activo.
     */
    function checkAndRecenterGridSelectionLoop() {
        // Detener si el centrado se ha desactivado o el modal está cerrado/detalles abiertos
        const isModalOpen = modalOverlayRef && modalOverlayRef.classList.contains('open');
        const isDetailsOpen = gameDetailsOverlayRef && gameDetailsOverlayRef.classList.contains('open');

        if (!window.isCenteringActive || !isModalOpen || isDetailsOpen) {
            recenterAnimationFrameId = null;
            return;
        }

        const items = window.gridItemsElements;
        if (!modalBodyRef || items.length === 0) {
            recenterAnimationFrameId = requestAnimationFrame(checkAndRecenterGridSelectionLoop);
            return;
        }

        const selectedElement = items[window.currentGridIndex];
        if (!selectedElement) {
            recenterAnimationFrameId = requestAnimationFrame(checkAndRecenterGridSelectionLoop);
            return;
        }

        const viewportHeight = modalBodyRef.clientHeight;
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = modalBodyRef.getBoundingClientRect();

        const elementTopInViewport = elementRect.top - containerRect.top;
        const elementBottomInViewport = elementRect.bottom - containerRect.top;

        // Se verifica si está demasiado cerca del borde o completamente fuera de la vista.
        const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
        const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
        // La condición isOutOfView se simplifica si isTooHigh o isTooLow se cumplen
        // Pero se mantiene por robustez (ej. si está completamente oculto).
        const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;

        if (isTooHigh || isTooLow || isOutOfView) {
            // El tercer argumento 'true' fuerza el cálculo de scroll, el cuarto 'true' ignora el check horizontal.
            // Esto solo recalcula el 'scrollTarget' y lo anima si es necesario.
            updateGridSelection(window.currentGridIndex, true, true, true);
        }

        recenterAnimationFrameId = requestAnimationFrame(checkAndRecenterGridSelectionLoop);
    }
    // No es necesario exponer checkAndRecenterGridSelection ya que ahora se gestiona internamente
    // con un bucle rAF que solo se activa/desactiva según el estado de window.isCenteringActive.


    /**
     * Inicia o asegura que el bucle de recentrado esté corriendo si window.isCenteringActive es true.
     */
    function startRecenterLoop() {
        if (window.isCenteringActive && recenterAnimationFrameId === null) {
            recenterAnimationFrameId = requestAnimationFrame(checkAndRecenterGridSelectionLoop);
        }
    }

    /**
     * Reinicia las variables de estado de la navegación (llamado por cerrarModal).
     * Expuesta globalmente.
     */
    function resetNavigationState() {
        window.currentGridIndex = 0;
        window.isCenteringActive = false; // Detiene el bucle de recentrado
        isProgrammaticScrolling = false;
        scrollTarget = 0;
        currentScroll = 0;
        if (scrollAnimationFrameId) {
            cancelAnimationFrame(scrollAnimationFrameId);
            scrollAnimationFrameId = null;
        }
        // No es necesario cancelar recenterAnimationFrameId, se detiene solo en el loop.
    }
    window.resetNavigationState = resetNavigationState;


    // --- Funciones de Manejo de Eventos ---

    /**
     * Maneja el evento de scroll manual del usuario.
     */
    function handleModalScroll() {
        // Si el usuario hace scroll manualmente (no es programático)
        if (!isProgrammaticScrolling) {
            window.isCenteringActive = false; // Desactiva el centrado automático
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
            if (isDetailsOpen && window.cerrarDetallesJuego) {
                window.cerrarDetallesJuego();
            } else if (isModalOpen && window.cerrarModal) {
                window.cerrarModal();
            }
            event.preventDefault();
            return;
        }

        // 3. Navegación del Grid (solo si está activo)
        if (isGridActive) {
            const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);

            // Bloqueo de navegación rápida en repetición
            if (event.repeat && gridNavLock && isArrowKey) {
                event.preventDefault();
                return;
            }

            let newIndex = window.currentGridIndex;
            let targetIndex = window.currentGridIndex;
            let handled = false;
            const lastIndex = window.gridItemsElements.length - 1;
            const currentColumns = window.getGridColumns();

            if (isArrowKey) {
                switch (key) {
                    case 'ArrowLeft':
                        targetIndex = window.currentGridIndex - 1;
                        newIndex = (targetIndex < 0) ? lastIndex : targetIndex; // Wrap around
                        break;
                    case 'ArrowRight':
                        targetIndex = window.currentGridIndex + 1;
                        newIndex = (targetIndex > lastIndex) ? 0 : targetIndex; // Wrap around
                        break;
                    case 'ArrowUp':
                        targetIndex = window.currentGridIndex - currentColumns;
                        newIndex = (targetIndex < 0) ? window.currentGridIndex : targetIndex; // Stop at the top
                        break;
                    case 'ArrowDown':
                        targetIndex = window.currentGridIndex + currentColumns;
                        newIndex = Math.min(targetIndex, lastIndex); // Stop at the bottom
                        break;
                }
                handled = true;
            } else if (key === 'Enter') {
                // Solo llama a click si hay un elemento y la función existe
                if (window.gridItemsElements[window.currentGridIndex] && window.gridItemsElements[window.currentGridIndex].click) {
                    window.gridItemsElements[window.currentGridIndex].click();
                }
                handled = true;
            }

            if (isArrowKey) {
                if (newIndex !== window.currentGridIndex) {
                    if (event.repeat) {
                        // Implementa el bloqueo de repetición con retraso
                        gridNavLock = true;
                        setTimeout(() => { gridNavLock = false; }, GRID_NAV_DELAY_MS);
                    }
                    window.isCenteringActive = true;
                    updateGridSelection(newIndex, true, false, false);
                    startRecenterLoop(); // Asegura que el bucle de centrado esté activo
                }
            } else if (!isArrowKey && handled === false) {
                // Si es otra tecla (ej. 'a', 's', etc.), permitimos la acción pero desactivamos el centrado
                // para que no interfiera si el desarrollador usa esas teclas para scroll/movimiento manual.
                window.isCenteringActive = false;
            }

            if (handled) {
                event.preventDefault();
                return;
            }
        }

        // 4. Bloqueo final de teclas si algún modal está abierto
        if (isModalOpen || isDetailsOpen) {
            // Evitar que las teclas afecten el scroll/acciones del navegador si el modal está abierto
            // Se excluye 'Enter' si no fue manejado arriba (ej. para un formulario interno)
            if (key !== 'Enter' && key !== 'Tab') { // Se añade 'Tab' por si acaso
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
            // Usar 'passive: true' para mejorar el rendimiento del scroll
            modalBodyRef.addEventListener('scroll', handleModalScroll, { passive: true });

            // Listener de click/mousedown fuera de los elementos del grid (para desactivar centrado)
            modalBodyRef.addEventListener('mousedown', (event) => {
                // Desactiva el centrado si el modal está abierto y el clic no fue en un elemento del grid
                if (modalOverlayRef.classList.contains('open') && !event.target.closest('.grid-item')) {
                     window.isCenteringActive = false;
                }
            }, { passive: true });
        }

        // Listener de teclado global
        document.addEventListener('keydown', handleKeydown);
    });

    // Inicia el bucle de recentrado una vez al inicio, se detendrá solo si isCenteringActive es false.
    // Esto asegura que si isCenteringActive se activa en otro lado, el bucle comienza.
    startRecenterLoop();

})(); // Fin de la IIFE