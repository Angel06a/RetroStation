// =========================================================================
// game-grid-nav.js: Minificado leve
// =========================================================================

class GameGridNavigator {
    static GRID_NAV_DELAY_MS = 150;
    static CENTERING_MARGIN_PX = 100;
    static SCROLL_SMOOTHING_FACTOR = 0.2;
    static SCROLL_TOLERANCE_PX = 2;

    currentGridIndex = 0;
    gridItemsElements = [];
    isCenteringActive = false;
    gridNavLock = false;

    isProgrammaticScrolling = false;
    scrollTarget = 0;
    currentScroll = 0;
    scrollAnimationFrameId = null;
    centeringCheckIntervalId = null;

    modalBodyRef = null;
    modalOverlayRef = null;
    gameDetailsOverlayRef = null;

    constructor() {
        this.bindGlobalState();
        document.addEventListener('DOMContentLoaded', this.initializeDOMAndEvents.bind(this));
    }

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
        window.checkAndRecenterGridSelection = this.checkAndRecenterGridSelection.bind(this); 
    }

    animateGridScroll = () => {
        const { SCROLL_SMOOTHING_FACTOR, SCROLL_TOLERANCE_PX } = GameGridNavigator;
        const scrollDifference = this.scrollTarget - this.currentScroll;
        
        this.currentScroll += scrollDifference * SCROLL_SMOOTHING_FACTOR;
        
        if (Math.abs(scrollDifference) < SCROLL_TOLERANCE_PX) {
            this.currentScroll = this.scrollTarget;
            cancelAnimationFrame(this.scrollAnimationFrameId);
            this.scrollAnimationFrameId = null;
            this.isProgrammaticScrolling = false;
        } else {
            this.scrollAnimationFrameId = requestAnimationFrame(this.animateGridScroll);
        }
        
        this.modalBodyRef.scrollTop = this.currentScroll;
    }

    getMaxRowHeight(rowIndex, currentColumns) {
        let maxHeight = 0;
        const items = this.gridItemsElements;
        const rowStartIndex = rowIndex * currentColumns;
        const rowEndIndex = Math.min(rowStartIndex + currentColumns, items.length);

        for (let i = rowStartIndex; i < rowEndIndex; i++) {
            const item = items[i];
            if (item && item.offsetHeight > maxHeight) {
                maxHeight = item.offsetHeight;
            }
        }
        return maxHeight;
    }

    updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
        const items = this.gridItemsElements;
        if (items.length === 0 || !this.modalBodyRef) return;

        const oldIndex = this.currentGridIndex;
        
        items[oldIndex]?.classList.remove('selected');
        this.currentGridIndex = newIndex;
        items[newIndex].classList.add('selected');

        if (!forceScroll) return;

        if (!isResizeOrInitialLoad && !ignoreHorizontalCheck && oldIndex !== null) {
            const currentColumns = window.getGridColumns();
            if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
                this.checkAndRecenterGridSelection(true);
                return;
            }
        }

        const viewportHeight = this.modalBodyRef.clientHeight;
        const currentColumns = window.getGridColumns();
        const rowIndex = Math.floor(this.currentGridIndex / currentColumns);
        const rowStartElement = items[rowIndex * currentColumns];
        if (!rowStartElement) return;

        const maxHeight = this.getMaxRowHeight(rowIndex, currentColumns);
        const elementRect = rowStartElement.getBoundingClientRect();
        const containerRect = this.modalBodyRef.getBoundingClientRect();
        const elementTopInScroll = elementRect.top - containerRect.top + this.modalBodyRef.scrollTop; 
        
        let targetScroll = elementTopInScroll - ((viewportHeight - maxHeight) / 2);
        
        targetScroll = Math.max(0, targetScroll);
        targetScroll = Math.min(targetScroll, this.modalBodyRef.scrollHeight - viewportHeight);
        this.scrollTarget = targetScroll;

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

    startCenteringCheck() {
        if (!this.centeringCheckIntervalId) {
            this.centeringCheckIntervalId = setInterval(this.checkAndRecenterGridSelection.bind(this, false), 250);
        }
    }

    stopCenteringCheck() {
        if (this.centeringCheckIntervalId) {
            clearInterval(this.centeringCheckIntervalId);
            this.centeringCheckIntervalId = null;
        }
    }

    checkAndRecenterGridSelection(forceRecenter = false) {
        const { CENTERING_MARGIN_PX } = GameGridNavigator;
        const items = this.gridItemsElements;
        
        const isModalOpen = this.modalOverlayRef?.classList.contains('open');
        const isDetailsOpen = this.gameDetailsOverlayRef?.classList.contains('open');

        if (!this.modalBodyRef || items.length === 0 || !isModalOpen || isDetailsOpen || (!this.isCenteringActive && !forceRecenter)) {
            return;
        }

        const selectedElement = items[this.currentGridIndex];
        if (!selectedElement) return;

        const viewportHeight = this.modalBodyRef.clientHeight;
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = this.modalBodyRef.getBoundingClientRect();

        const elementTopInViewport = elementRect.top - containerRect.top;
        const elementBottomInViewport = elementRect.bottom - containerRect.top;

        const margin = CENTERING_MARGIN_PX * (this.isProgrammaticScrolling ? 0.5 : 1.0); 

        const isTooHigh = elementTopInViewport < margin;
        const isTooLow = elementBottomInViewport > viewportHeight - margin;
        const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;
        
        if (isTooHigh || isTooLow || isOutOfView) {
            this.updateGridSelection(this.currentGridIndex, true, true, true);
        }
    }

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

    handleModalScroll = () => {
        if (!this.isProgrammaticScrolling) {
            this.isCenteringActive = false; 
            if (this.scrollAnimationFrameId) {
                cancelAnimationFrame(this.scrollAnimationFrameId);
                this.scrollAnimationFrameId = null;
            }
        }
    }

    handleKeydown = (event) => {
        const { GRID_NAV_DELAY_MS } = GameGridNavigator;
        const { key, repeat } = event;
        const items = this.gridItemsElements;

        const isDetailsOpen = this.gameDetailsOverlayRef?.classList.contains('open');
        const isModalOpen = this.modalOverlayRef?.classList.contains('open');
        const isGridActive = isModalOpen && !isDetailsOpen && items.length > 0;

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

        if (isGridActive) {
            if (repeat && this.gridNavLock) {
                event.preventDefault();
                return;
            }

            let newIndex = this.currentGridIndex;
            let handled = false;
            const lastIndex = items.length - 1;
            const currentColumns = window.getGridColumns();
            const oldIndex = this.currentGridIndex;

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
                if (newIndex !== oldIndex) {
                    if (repeat) {
                        this.gridNavLock = true;
                        setTimeout(() => { this.gridNavLock = false; }, GRID_NAV_DELAY_MS);
                    }
                    this.isCenteringActive = true;
                    this.updateGridSelection(newIndex);
                }
                event.preventDefault();
            }
        }

        if ((isModalOpen || isDetailsOpen) && key !== 'Enter' && key !== 'Tab' && key !== 'Shift') {
            event.preventDefault();
        }
    }

    initializeDOMAndEvents() {
        this.modalBodyRef = document.querySelector('.modal-body');
        this.modalOverlayRef = document.getElementById('modal-overlay');
        this.gameDetailsOverlayRef = document.getElementById('game-details-overlay');

        if (this.modalBodyRef && this.modalOverlayRef) {
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

window.gameGridNavigatorInstance = new GameGridNavigator();