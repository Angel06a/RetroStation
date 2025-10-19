// =========================================================================
// game-grid-nav.js: Lógica de Navegación, Scroll y Centrado del Grid
// OPTIMIZACIÓN FINAL: Anti-Micro-Lag. Gestión estricta de RAF y DOM I/O.
// =========================================================================

class GameGridNavigator {
    // --- Configuración (Constantes estáticas) ---
    static GRID_NAV_DELAY_MS = 150;
    static CENTERING_MARGIN_PX = 100;
    static SCROLL_SMOOTHING_FACTOR = 0.2;
    static SCROLL_TOLERANCE_PX = 2;

    // --- Estado (Instancia) ---
    currentGridIndex = 0;
    gridItemsElements = [];
    isCenteringActive = false;
    gridNavLock = false;

    // --- Control de Scroll (Instancia) ---
    isProgrammaticScrolling = false;
    scrollTarget = 0;
    currentScroll = 0;
    scrollAnimationFrameId = null;
    centeringCheckIntervalId = null;

    // --- Referencias DOM (Instancia) ---
    modalBodyRef = null;
    modalOverlayRef = null;
    gameDetailsOverlayRef = null;

    constructor() {
        this.bindGlobalState();
        document.addEventListener('DOMContentLoaded', this.initializeDOMAndEvents.bind(this));
    }

    /**
     * @private
     * Enlaza el estado interno de la clase a variables globales de window.
     */
    bindGlobalState() {
        const globalProps = ['currentGridIndex', 'gridItemsElements', 'isCenteringActive'];
        globalProps.forEach(prop => {
            Object.defineProperty(window, prop, {
                get: () => this[prop],
                set: (val) => { this[prop] = val; },
                configurable: true
            });
        });
        window.updateGridSelection = this.updateGridSelection.bind(this);
        window.resetNavigationState = this.resetNavigationState.bind(this);
    }

    // =========================================================================
    // Lógica de Scroll y Centrado
    // =========================================================================

    /**
     * @private
     * Bucle de Animación de Scroll Suave. Ejecución óptima en RequestAnimationFrame.
     * Esta es la forma más rápida y sin *jank* de animar `scrollTop`.
     */
    animateGridScroll = () => {
        const { SCROLL_SMOOTHING_FACTOR } = GameGridNavigator;
        const scrollDifference = this.scrollTarget - this.currentScroll;
        
        this.currentScroll += scrollDifference * SCROLL_SMOOTHING_FACTOR;
        
        // Condición de Parada
        if (Math.abs(scrollDifference) < 1) {
            this.currentScroll = this.scrollTarget;
            cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
            this.isProgrammaticScrolling = false;
        } else {
            this.scrollAnimationFrameId = requestAnimationFrame(this.animateGridScroll);
        }
        
        // Aplicar Scroll (Escritura optimizada)
        this.modalBodyRef.scrollTop = this.currentScroll;
    }

    /**
     * @private
     * Calcula la altura máxima de la fila actual.
     */
    getMaxRowHeight(rowIndex, currentColumns) {
        let maxHeight = 0;
        const items = this.gridItemsElements;
        const rowStartIndex = rowIndex * currentColumns;
        const rowEndIndex = Math.min(rowStartIndex + currentColumns, items.length);

        for (let i = rowStartIndex; i < rowEndIndex; i++) {
            const item = items[i];
            if (item && item.offsetHeight > maxHeight) { // Lectura geométrica necesaria
                maxHeight = item.offsetHeight;
            }
        }
        return maxHeight;
    }

    /**
     * Actualiza la selección del grid y centra el elemento en la vista.
     */
    updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
        const items = this.gridItemsElements;
        if (items.length === 0 || !this.modalBodyRef) return;

        const oldIndex = this.currentGridIndex;
        
        // 1. Escritura de Clases (Cambio visual, bajo impacto)
        items[oldIndex]?.classList.remove('selected');
        this.currentGridIndex = newIndex;
        items[newIndex].classList.add('selected');

        if (!forceScroll) return;

        // 2. Control Horizontal (Guard Clause)
        if (!isResizeOrInitialLoad && !ignoreHorizontalCheck && oldIndex !== null) {
            const currentColumns = window.getGridColumns();
            if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
                return;
            }
        }

        // --- 3. Lectura de Geometría (Bloque de lectura agrupado para evitar layout thrashing) ---
        const viewportHeight = this.modalBodyRef.clientHeight;
        const currentColumns = window.getGridColumns();
        const rowIndex = Math.floor(this.currentGridIndex / currentColumns);
        const rowStartElement = items[rowIndex * currentColumns];
        if (!rowStartElement) return;

        const maxHeight = this.getMaxRowHeight(rowIndex, currentColumns);
        const elementRect = rowStartElement.getBoundingClientRect();
        const containerRect = this.modalBodyRef.getBoundingClientRect();
        const elementTopInScroll = elementRect.top - containerRect.top + this.modalBodyRef.scrollTop; 
        
        // 4. Cálculo y Escritura del Objetivo
        let targetScroll = elementTopInScroll - ((viewportHeight - maxHeight) / 2);
        
        targetScroll = Math.max(0, targetScroll);
        targetScroll = Math.min(targetScroll, this.modalBodyRef.scrollHeight - viewportHeight);
        this.scrollTarget = targetScroll;

        // 5. Iniciar/Controlar Animación
        const { SCROLL_TOLERANCE_PX } = GameGridNavigator;
        if (Math.abs(this.scrollTarget - this.modalBodyRef.scrollTop) < SCROLL_TOLERANCE_PX) {
            if (this.scrollAnimationFrameId) cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
            this.isProgrammaticScrolling = false;
            return;
        }

        if (this.scrollAnimationFrameId === null) {
            this.currentScroll = this.modalBodyRef.scrollTop;
            this.isProgrammaticScrolling = true;
            this.scrollAnimationFrameId = requestAnimationFrame(this.animateGridScroll);
        }
    }

    /**
     * Inicia un chequeo periódico (setInterval) para re-centrar la selección.
     */
    startCenteringCheck() {
        if (!this.centeringCheckIntervalId) {
            // Intervalo de 250ms: Límite óptimo para no bloquear el hilo principal (16.6ms)
            this.centeringCheckIntervalId = setInterval(this.checkAndRecenterGridSelection.bind(this), 250);
        }
    }

    /**
     * @private
     * Detiene el chequeo periódico.
     */
    stopCenteringCheck() {
        if (this.centeringCheckIntervalId) {
            clearInterval(this.centeringCheckIntervalId);
            this.centeringCheckIntervalId = null;
        }
    }

    /**
     * Chequeo periódico que fuerza el centrado si el elemento se sale de los márgenes.
     */
    checkAndRecenterGridSelection() {
        const { CENTERING_MARGIN_PX } = GameGridNavigator;
        const items = this.gridItemsElements;
        
        const isModalOpen = this.modalOverlayRef?.classList.contains('open');
        const isDetailsOpen = this.gameDetailsOverlayRef?.classList.contains('open');

        if (!this.modalBodyRef || items.length === 0 || !isModalOpen || isDetailsOpen || !this.isCenteringActive) {
            return;
        }

        const selectedElement = items[this.currentGridIndex];
        if (!selectedElement) return;

        // Lecturas de Geometría (Bloque de lectura)
        const viewportHeight = this.modalBodyRef.clientHeight;
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = this.modalBodyRef.getBoundingClientRect();

        const elementTopInViewport = elementRect.top - containerRect.top;
        const elementBottomInViewport = elementRect.bottom - containerRect.top;

        const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
        const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
        const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;

        if (isTooHigh || isTooLow || isOutOfView) {
            // Escritura (Write) forzada a través de updateGridSelection
            this.updateGridSelection(this.currentGridIndex, true, true, true);
        }
    }

    /**
     * Reinicia las variables de estado de la navegación.
     */
    resetNavigationState() {
        this.currentGridIndex = 0;
        this.isCenteringActive = false;
        this.gridNavLock = false;
        this.isProgrammaticScrolling = false;
        this.scrollTarget = 0;
        this.currentScroll = 0;
        this.stopCenteringCheck();
        if (this.scrollAnimationFrameId) {
            cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
        }
    }

    // =========================================================================
    // Manejo de Eventos
    // =========================================================================

    /**
     * @private
     * Maneja el scroll manual del usuario (desactiva el centrado).
     */
    handleModalScroll = () => {
        // Usa `passive: true` en el listener (en la inicialización) para evitar bloqueos
        if (!this.isProgrammaticScrolling) {
            this.isCenteringActive = false;
            if (this.scrollAnimationFrameId) {
                cancelAnimationFrame(this.scrollAnimationFrameId);
                this.scrollAnimationFrameId = null;
            }
        }
    }

    /**
     * @private
     * Maneja los eventos de teclado para navegación.
     */
    handleKeydown = (event) => {
        const { GRID_NAV_DELAY_MS } = GameGridNavigator;
        const { key, repeat } = event;
        const items = this.gridItemsElements;

        const isDetailsOpen = this.gameDetailsOverlayRef?.classList.contains('open');
        const isModalOpen = this.modalOverlayRef?.classList.contains('open');
        const isGridActive = isModalOpen && !isDetailsOpen && items.length > 0;

        // 1. Bloqueo/Manejo de teclas de acción
        if (key === 'Enter' && window.inputLock) {
            event.preventDefault();
            return;
        }
        if (key === 'Escape') {
            if (isDetailsOpen) window.cerrarDetallesJuego();
            else if (isModalOpen) window.cerrarModal();
            event.preventDefault();
            return;
        }

        // 2. Navegación del Grid
        if (isGridActive) {
            if (repeat && this.gridNavLock) {
                event.preventDefault();
                return;
            }

            let newIndex = this.currentGridIndex;
            let handled = false;
            const lastIndex = items.length - 1;
            const currentColumns = window.getGridColumns();

            switch (key) {
                case 'ArrowLeft':
                    newIndex = (newIndex === 0) ? lastIndex : newIndex - 1; 
                    handled = true;
                    break;
                case 'ArrowRight':
                    newIndex = (newIndex === lastIndex) ? 0 : newIndex + 1; 
                    handled = true;
                    break;
                case 'ArrowUp':
                    newIndex = Math.max(0, newIndex - currentColumns);
                    handled = true;
                    break;
                case 'ArrowDown':
                    newIndex = Math.min(lastIndex, newIndex + currentColumns);
                    handled = true;
                    break;
                case 'Enter':
                    items[newIndex].click();
                    handled = true;
                    break;
                default:
                    this.isCenteringActive = false;
                    break;
            }

            if (handled && key !== 'Enter') {
                if (newIndex !== this.currentGridIndex) {
                    if (repeat) {
                        this.gridNavLock = true;
                        setTimeout(() => { this.gridNavLock = false; }, GRID_NAV_DELAY_MS);
                    }
                    this.isCenteringActive = true;
                    this.updateGridSelection(newIndex);
                    this.startCenteringCheck();
                }
                event.preventDefault();
            }
        }

        // 3. Bloqueo final si algún modal está abierto
        if ((isModalOpen || isDetailsOpen) && key !== 'Enter' && key !== 'Tab' && key !== 'Shift') {
            event.preventDefault();
        }
    }

    // =========================================================================
    // Inicialización
    // =========================================================================

    /**
     * @private
     * Inicialización de referencias DOM y Event Listeners.
     */
    initializeDOMAndEvents() {
        this.modalBodyRef = document.querySelector('.modal-body');
        this.modalOverlayRef = document.getElementById('modal-overlay');
        this.gameDetailsOverlayRef = document.getElementById('game-details-overlay');

        if (this.modalBodyRef && this.modalOverlayRef) {
            // Uso de { passive: true } para evitar micro-lags en el scroll del usuario
            this.modalBodyRef.addEventListener('scroll', this.handleModalScroll, { passive: true });
            
            this.modalBodyRef.addEventListener('mousedown', (event) => {
                if (this.modalOverlayRef.classList.contains('open') && !event.target.closest('.grid-item')) {
                     this.isCenteringActive = false;
                }
            });
        }

        document.addEventListener('keydown', this.handleKeydown);
        this.startCenteringCheck();
    }
}

// Inicializar la instancia
window.gameGridNavigatorInstance = new GameGridNavigator();