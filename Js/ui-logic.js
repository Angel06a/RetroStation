// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal (Ultra-Compacto)
// =========================================================================

const CONFIG = {
    imgDir: "Sistemas/", imgExt: ".svg", bgDir: "Fondos/", bgExt: ".jpg",
    bp: 768, scrollT: 100, animDurBg: 600,
};

class RuedaDinamica {
    constructor(menuItems, config, callbacks) {
        this.callbacks = callbacks;
        this.rueda = document.getElementById('rueda');
        this.bgCont = document.getElementById('background-container');
        this.modalRef = document.getElementById('modal-overlay');
        this.detailsRef = document.getElementById('game-details-overlay');
        
        if (!this.rueda) { console.error("El elemento 'rueda' no fue encontrado."); return; }

        this.menuItems = menuItems;
        this.config = config;
        this.opciones = [];
        this.totalOpciones = menuItems.length;
        this.anguloPorOpcion = 360 / this.totalOpciones;
        this.halfOptions = this.totalOpciones / 2;
        this.initialAngles = null;

        this.currentRadius = 0;
        this.indiceActual = 0;
        this.rotacionObjetivo = 0;
        this.capaFondoActual = null;
        this.isMobile = false;
        this.isScrolling = false;
        this.isRotatingClick = false;
        this.opcionAnterior = null;
        this.resizeRafId = null;
        
        this.pendingBgRemove = null;
        this.bgRemoveTimeoutId = null;
        this.bgCache = new Map();
        this.currentBgUrl = null;
        this.rotacionVar = '--rueda-rotacion-actual';

        this.generarOpcionesOptimizada(() => {
            this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
            this.attachEventListeners();
            this.initializeView(true);
        });
    }

    generarOpcionesOptimizada(onComplete) {
        const promises = [];
        const fragment = document.createDocumentFragment();

        this.menuItems.forEach((name, index) => {
            const op = document.createElement('div');
            op.classList.add('opcion');
            op.dataset.index = index;
            const img = document.createElement('img');
            img.src = this.config.imgDir + name + this.config.imgExt;
            img.alt = name;
            op.appendChild(img);
            this.opciones.push(op);
            fragment.appendChild(op);

            if (typeof img.decode === 'function') promises.push(img.decode().catch(() => {}));
        });

        Promise.all(promises).then(() => {
            requestAnimationFrame(() => {
                this.rueda.appendChild(fragment);
                if (onComplete) onComplete();
            });
        }).catch(() => {
            requestAnimationFrame(() => {
                this.rueda.appendChild(fragment);
                if (onComplete) onComplete();
            });
        });
    }

    setWillChangeState(activate) {
        const state = activate ? 'transform' : 'auto';
        if (this.rueda.style.willChange !== state) {
            this.rueda.style.willChange = state;
            this.opciones.forEach(op => op.style.willChange = state);
        }
    }
    
    _applyTargetRotation() {
        if (this.isMobile) return;
        this.rueda.style.setProperty(this.rotacionVar, `${this.rotacionObjetivo}deg`);
        setTimeout(() => this.isRotatingClick = false, 100); 
    }

    hayModalAbierto() {
        return this.modalRef?.classList.contains('open') || this.detailsRef?.classList.contains('open');
    }

    checkMobileView() {
        this.isMobile = window.innerWidth <= this.config.bp;
        return this.isMobile;
    }

    scrollToSelectedIndex(index) {
        if (!this.isMobile) return;
        const selected = this.opciones[index];
        const container = this.rueda;
        if (!selected || !container) return;

        const iRect = selected.getBoundingClientRect();
        const cRect = container.getBoundingClientRect();
        const itemCenter = iRect.top - cRect.top + container.scrollTop + (iRect.height / 2);
        const targetScroll = itemCenter - (cRect.height / 2);

        if (Math.abs(container.scrollTop - targetScroll) > 1) {
            container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
    }

    updateViewState() {
        if (!this.isMobile) {
            this.rueda.style.transform = ''; 
            this.rotacionObjetivo = this.initialAngles[this.indiceActual] * -1;
            this._applyTargetRotation();
            this.setWillChangeState(true); 
        } else {
            this.rueda.style.transform = `none`; 
            this.rueda.style.setProperty(this.rotacionVar, `0deg`); 
            this.setWillChangeState(false); 
        }
        this.scrollToSelectedIndex(this.indiceActual);
    }

    _preloadAndDecodeImage(url) {
        if (this.bgCache.has(url)) return this.bgCache.get(url);

        const promise = new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const decodeAction = () => {
                    if ('decode' in img) img.decode().then(() => resolve(url)).catch(() => resolve(url));
                    else resolve(url);
                };
                ('requestIdleCallback' in window) ? requestIdleCallback(decodeAction) : setTimeout(decodeAction, 0);
            };
            img.onerror = () => resolve(url);
            img.src = url;
        });

        this.bgCache.set(url, promise);
        return promise;
    }

    actualizarFondo() {
        const name = this.menuItems[this.indiceActual];
        const bgUrl = this.config.bgDir + name + this.config.bgExt;
        const fullBgUrl = `url('${bgUrl}')`;

        if (this.currentBgUrl === fullBgUrl) return;

        this._preloadAndDecodeImage(bgUrl).then(resolvedUrl => {
            if (`url('${resolvedUrl}')` !== fullBgUrl) return; 

            this.currentBgUrl = fullBgUrl;

            // Consolidación de cancelación y limpieza
            if (this.bgRemoveTimeoutId) clearTimeout(this.bgRemoveTimeoutId);
            if (this.pendingBgRemove && this.bgCont.contains(this.pendingBgRemove)) {
                this.bgCont.removeChild(this.pendingBgRemove);
            }
            this.bgRemoveTimeoutId = this.pendingBgRemove = null;
            
            const capaAnterior = this.capaFondoActual;
            
            const nuevaCapa = document.createElement('div');
            nuevaCapa.classList.add('background-layer');
            nuevaCapa.style.backgroundImage = fullBgUrl;
            nuevaCapa.style.willChange = 'opacity';
            
            this.bgCont.appendChild(nuevaCapa);
            this.capaFondoActual = nuevaCapa; 

            void nuevaCapa.offsetWidth; 
            nuevaCapa.style.opacity = '1';

            if (capaAnterior) {
                capaAnterior.style.opacity = '0';
                this.pendingBgRemove = capaAnterior;

                this.bgRemoveTimeoutId = setTimeout(() => {
                    if (this.bgCont.contains(capaAnterior)) this.bgCont.removeChild(capaAnterior);
                    this.pendingBgRemove = this.bgRemoveTimeoutId = null;
                }, this.config.animDurBg); 
            }
        });
    }

    actualizarSeleccion(scroll = false) {
        if (this.opcionAnterior) this.opcionAnterior.classList.remove('seleccionada');

        const nuevaSel = this.opciones[this.indiceActual];
        nuevaSel.classList.add('seleccionada');
        this.opcionAnterior = nuevaSel;

        this.actualizarFondo();
        if (scroll) this.scrollToSelectedIndex(this.indiceActual);
    }

    _updateRotationIndexAndTarget(pasos) {
        this.indiceActual = (this.indiceActual + pasos + this.totalOpciones) % this.totalOpciones;
        if (!this.isMobile) {
            this.rotacionObjetivo += (pasos * -1) * this.anguloPorOpcion; 
            this._applyTargetRotation();
        }
    }

    rotarRueda(direccion) {
        this._updateRotationIndexAndTarget(direccion);
        this.actualizarSeleccion(true);
    }

    handleKeyDown = (event) => {
        if (this.hayModalAbierto()) return;
        const key = event.key.toLowerCase();
        let direccion = 0;
        
        const isVert = key === 'arrowup' || key === 'w' || key === 'arrowdown' || key === 's';
        const isHoriz = key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd';
        
        if (this.isMobile) {
            if (isVert) direccion = (key === 'arrowdown' || key === 's') ? 1 : -1;
        } else {
            if (isHoriz || isVert) direccion = (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') ? 1 : -1;
        }

        if (direccion !== 0) {
            this.rotarRueda(direccion);
            event.preventDefault();
        } else if (key === 'enter') {
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            event.preventDefault();
        }
    }

    handleWheel = (event) => {
        if (this.hayModalAbierto() || this.isMobile) return;
        event.preventDefault(); 
        if (this.isScrolling) return;

        this.rotarRueda(event.deltaY > 0 ? 1 : -1);

        this.isScrolling = true;
        setTimeout(() => this.isScrolling = false, this.config.scrollT);
    }

    handleClick = (event) => {
        if (this.isRotatingClick) return; 
        const clicked = event.target.closest('.opcion');
        if (!clicked) return;

        const targetIndex = parseInt(clicked.dataset.index, 10);
        if (targetIndex === this.indiceActual) {
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            return;
        }

        this.isRotatingClick = true; 
        const prevIndex = this.indiceActual;
        this.indiceActual = targetIndex; 

        if (!this.isMobile) {
            let diff = targetIndex - prevIndex;
            if (Math.abs(diff) > this.halfOptions) {
                diff = (diff > 0) ? diff - this.totalOpciones : diff + this.totalOpciones;
            }
            this.rotacionObjetivo += (diff * -1) * this.anguloPorOpcion;
            this._applyTargetRotation(); 
        } else {
            setTimeout(() => this.isRotatingClick = false, 50);
        }
        
        this.actualizarSeleccion(true);
    }

    _handleDimensionUpdateAndResizeLogic(initialLoad = false, oldIsMobile = this.isMobile) {
        const newIsMobile = this.checkMobileView(); 
        const shouldRunCalc = initialLoad || newIsMobile !== oldIsMobile || this.currentRadius === 0;

        if (shouldRunCalc) {
            const dims = this.callbacks.calculateAndApplyDimensions(
                this.rueda, this.opciones, this.initialAngles, this.anguloPorOpcion, this.totalOpciones
            );
            this.currentRadius = dims.currentRadius;
        }

        if (newIsMobile !== oldIsMobile || initialLoad) this.updateViewState();

        if (this.hayModalAbierto() && typeof this.callbacks.updateGridSelection === 'function') {
            const gridIndex = window.currentGridIndex ?? 0;
            this.callbacks.updateGridSelection(gridIndex, true, true, true); 
        }

        this.actualizarSeleccion(newIsMobile); 
    }

    handleResize = () => {
        if (this.resizeRafId) cancelAnimationFrame(this.resizeRafId);
        const oldIsMobile = this.isMobile; 
        this.resizeRafId = requestAnimationFrame(() => {
            this._handleDimensionUpdateAndResizeLogic(false, oldIsMobile);
            this.resizeRafId = null;
        });
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }
    
    initializeView(initialLoad = false) {
        this.checkMobileView(); 
        this.setWillChangeState(!this.isMobile); 
        this._handleDimensionUpdateAndResizeLogic(initialLoad, this.isMobile);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems'.");
        return;
    }

    if (
        typeof window.abrirModal !== 'function' ||
        typeof window.updateGridSelection !== 'function' ||
        typeof window.calculateAndApplyDimensions !== 'function'
    ) {
        console.error("Faltan dependencias externas (utils.js, main-modal-manager.js).");
        return;
    }

    window.ruedaDinamicaInstance = new RuedaDinamica(menuItems, CONFIG, {
        abrirModal: window.abrirModal,
        updateGridSelection: window.updateGridSelection,
        calculateAndApplyDimensions: window.calculateAndApplyDimensions,
    });
});