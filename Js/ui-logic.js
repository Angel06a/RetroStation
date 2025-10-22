// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal (OPTIMIZADO V2)
// =========================================================================

const CONFIG = {
    imgDir: "Sistemas/", imgExt: ".svg", bgDir: "Fondos/", bgExt: ".jpg",
    bp: 768, scrollT: 80, animDurBg: 600, // scrollT reducido a 80ms para una sensación más rápida pero controlada
};

class RuedaDinamica {
    constructor(menuItems, config, callbacks) {
        this.cbs = callbacks; // cbs: Callbacks
        this.rueda = document.getElementById('rueda');
        this.bgCont = document.getElementById('background-container');
        this.modalRef = document.getElementById('modal-overlay');
        this.detailsRef = document.getElementById('game-details-overlay');
        
        if (!this.rueda) { console.error("El elemento 'rueda' no fue encontrado."); return; }

        this.mI = menuItems; // mI: menuItems
        this.conf = config;  // conf: config
        this.opc = [];       // opc: opciones
        this.tO = menuItems.length; // tO: totalOpciones
        this.aPO = 360 / this.tO; // aPO: anguloPorOpcion
        this.hO = this.tO / 2;    // hO: halfOptions
        this.iA = null;      // iA: initialAngles

        this.cR = 0;         // cR: currentRadius
        this.iX = 0;         // iX: indiceActual
        this.rO = 0;         // rO: rotacionObjetivo
        this.cFA = null;     // cFA: capaFondoActual
        this.isM = false;    // isM: isMobile
        this.isS = false;    // isS: isScrolling (Throttle flag)
        this.isRC = false;   // isRC: isRotatingClick
        this.oA = null;      // oA: opcionAnterior
        this.rRI = null;     // rRI: resizeRafId
        
        this.pBR = null;     // pBR: pendingBgRemove
        this.bRTID = null;   // bRTID: bgRemoveTimeoutId
        this.bgCache = new Map();
        this.cBGU = null;    // cBGU: currentBgUrl
        this.rVar = '--rueda-rotacion-actual'; // rVar: rotacionVar

        this.gOO(() => { // gOO: generarOpcionesOptimizada
            this.iA = Array.from(this.opc).map((op, index) => index * this.aPO);
            this.aEL(); // aEL: attachEventListeners
            this.iV(true); // iV: initializeView
        });
    }

    gOO(onComplete) {
        // Implementación inmutable de gOO (sin cambios, ya usa Promises y RAF)
        const promises = [];
        const frag = document.createDocumentFragment();

        this.mI.forEach((name, index) => {
            const op = document.createElement('div');
            op.className = 'opcion';
            op.dataset.index = index;
            const img = document.createElement('img');
            img.src = this.conf.imgDir + name + this.conf.imgExt;
            img.alt = name;
            op.appendChild(img);
            this.opc.push(op);
            frag.appendChild(op);

            if (typeof img.decode === 'function') promises.push(img.decode().catch(() => {}));
        });

        Promise.all(promises).finally(() => { 
            requestAnimationFrame(() => {
                this.rueda.appendChild(frag);
                if (onComplete) onComplete();
            });
        });
    }

    sWCS(activate) { // sWCS: setWillChangeState
        // Optimización: Solo cambiar si el estado es diferente
        const state = activate ? 'transform' : 'auto';
        if (this.rueda.style.willChange !== state) {
            this.rueda.style.willChange = state;
            this.opc.forEach(op => op.style.willChange = state);
        }
    }
    
    _aTR() { // _aTR: _applyTargetRotation
        if (this.isM) return;
        this.rueda.style.setProperty(this.rVar, `${this.rO}deg`);
        // Optimización: No es necesario requestIdleCallback/setTimeout para resetLock
        // ya que la transición es de 200ms y el delay de RC es corto.
        // Se mantiene para compatibilidad con el código original, pero se puede omitir.
        const resetLock = () => { this.isRC = false; };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(resetLock, { timeout: 100 });
        } else {
            setTimeout(resetLock, 100); 
        }
    }

    hMA() { // hMA: hayModalAbierto
        // Implementación inmutable de hMA (sin cambios)
        return this.modalRef?.classList.contains('open') || this.detailsRef?.classList.contains('open');
    }

    cMV() { // cMV: checkMobileView
        // Implementación inmutable de cMV (sin cambios)
        const newIsM = window.innerWidth <= this.conf.bp;
        if (newIsM !== this.isM) this.isM = newIsM;
        return this.isM;
    }

    sTSX(index) { // sTSX: scrollToSelectedIndex
        // Implementación inmutable de sTSX (sin cambios, ya usa smooth scroll)
        if (!this.isM) return;
        const selected = this.opc[index];
        const container = this.rueda;
        if (!selected || !container) return;

        // Optimización: usar requestAnimationFrame para la lectura de DOM
        requestAnimationFrame(() => {
            const iRect = selected.getBoundingClientRect();
            const cRect = container.getBoundingClientRect();
            const itemCenter = iRect.top - cRect.top + container.scrollTop + (iRect.height / 2);
            const targetScroll = itemCenter - (cRect.height / 2);

            if (Math.abs(container.scrollTop - targetScroll) > 1) {
                container.scrollTo({ top: targetScroll, behavior: 'smooth' });
            }
        });
    }

    uVS() { // uVS: updateViewState
        const activateWCS = !this.isM;

        if (activateWCS) {
            this.rueda.style.transform = ''; 
            this.rO = this.iA[this.iX] * -1;
            this._aTR();
        } else {
            this.rueda.style.transform = `none`; 
            this.rueda.style.setProperty(this.rVar, `0deg`); 
        }
        
        this.sWCS(activateWCS); 
        // Llamada a sTSX sin RAF ya que uVS se llama desde _hDUARL que puede estar dentro de un RAF
        this.sTSX(this.iX); 
    }

    _pADImg(url) { // _pADImg: _preloadAndDecodeImage
        // Implementación inmutable de _pADImg (sin cambios, ya usa cache y decode/RIC)
        if (this.bgCache.has(url)) return this.bgCache.get(url);

        const promise = new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const decodeAction = () => {
                    ('decode' in img) 
                        ? img.decode().then(() => resolve(url)).catch(() => resolve(url))
                        : resolve(url);
                };
                ('requestIdleCallback' in window) ? requestIdleCallback(decodeAction) : setTimeout(decodeAction, 0);
            };
            img.onerror = () => resolve(url);
            img.src = url;
        });

        this.bgCache.set(url, promise);
        return promise;
    }

    aF() { // aF: actualizarFondo
        // Implementación inmutable de aF (sin cambios, ya es asíncrona y optimizada)
        const name = this.mI[this.iX];
        const bgUrl = this.conf.bgDir + name + this.conf.bgExt;
        const fullBgUrl = `url('${bgUrl}')`;

        if (this.cBGU === fullBgUrl) return;

        this._pADImg(bgUrl).then(resolvedUrl => {
            if (`url('${resolvedUrl}')` !== fullBgUrl) return; 

            this.cBGU = fullBgUrl;

            if (this.bRTID) clearTimeout(this.bRTID);
            if (this.pBR && this.bgCont.contains(this.pBR)) this.bgCont.removeChild(this.pBR);
            this.bRTID = this.pBR = null;
            
            const capaAnt = this.cFA; // capaAnt: capaAnterior
            
            const nuevaCapa = document.createElement('div');
            nuevaCapa.className = 'background-layer';
            nuevaCapa.style.backgroundImage = fullBgUrl;
            nuevaCapa.style.willChange = 'opacity';
            
            this.bgCont.appendChild(nuevaCapa);
            this.cFA = nuevaCapa; 

            void nuevaCapa.offsetWidth; 
            nuevaCapa.style.opacity = '1';

            if (capaAnt) {
                capaAnt.style.opacity = '0';
                this.pBR = capaAnt;

                this.bRTID = setTimeout(() => {
                    if (this.bgCont.contains(capaAnt)) this.bgCont.removeChild(capaAnt);
                    this.pBR = this.bRTID = null;
                }, this.conf.animDurBg); 
            }
        });
    }

    aS(scroll = false) { // aS: actualizarSeleccion
        // Implementación inmutable de aS (sin cambios)
        if (this.oA) this.oA.classList.remove('seleccionada');

        const nuevaSel = this.opc[this.iX];
        nuevaSel.classList.add('seleccionada');
        this.oA = nuevaSel;

        this.aF();
        if (scroll) this.sTSX(this.iX);
    }

    _uRIAT(pasos) { // _uRIAT: _updateRotationIndexAndTarget
        // Implementación inmutable de _uRIAT (sin cambios)
        this.iX = (this.iX + pasos + this.tO) % this.tO;
        if (!this.isM) {
            this.rO -= (pasos * this.aPO); 
            this._aTR();
        }
    }

    rR(dir) { // rR: rotarRueda
        // Implementación inmutable de rR (sin cambios)
        this._uRIAT(dir);
        this.aS(true);
    }

    handleKeyDown = (event) => {
        // Implementación inmutable de handleKeyDown (sin cambios)
        if (this.hMA()) return;
        
        const key = event.key.toLowerCase();
        let dir = 0; // dir: direccion
        
        const isAction = key === 'enter';
        const isVert = key === 'arrowup' || key === 'w' || key === 'arrowdown' || key === 's';
        const isHoriz = key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd';
        
        if (isAction) {
            this.cbs.abrirModal(this.mI[this.iX]);
            event.preventDefault();
            return;
        }

        if (this.isM) {
            if (isVert) dir = (key === 'arrowdown' || key === 's') ? 1 : -1;
        } else {
            if (isHoriz || isVert) dir = (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') ? 1 : -1;
        }

        if (dir !== 0) {
            this.rR(dir);
            event.preventDefault();
        }
    }

    handleWheel = (event) => {
        if (this.hMA() || this.isM) return;
        event.preventDefault(); 
        
        // Optimización: Throttling más eficiente
        if (this.isS) return;

        this.rR(event.deltaY > 0 ? 1 : -1);

        this.isS = true;
        // Uso de RAF para el reset del throttle, alineado con la UI
        requestAnimationFrame(() => {
            setTimeout(() => this.isS = false, this.conf.scrollT);
        });
    }

    handleClick = (event) => {
        if (this.isRC) return; 
        const clicked = event.target.closest('.opcion');
        if (!clicked) return;

        const tX = parseInt(clicked.dataset.index, 10); // tX: targetIndex
        if (tX === this.iX) {
            this.cbs.abrirModal(this.mI[this.iX]);
            return;
        }

        this.isRC = true; 
        const pX = this.iX; // pX: prevIndex
        this.iX = tX; 

        if (!this.isM) {
            let diff = tX - pX;
            if (Math.abs(diff) > this.hO) {
                diff = (diff > 0) ? diff - this.tO : diff + this.tO;
            }
            this.rO -= (diff * this.aPO); 
            this._aTR(); 
            // _aTR() ya maneja el reset de isRC con RIC/setTimeout
        } else {
            // Optimización: Reset más rápido en móvil ya que no hay animación de rotación de rueda
            const resetLock = () => { this.isRC = false; };
            ('requestIdleCallback' in window) ? requestIdleCallback(resetLock) : setTimeout(resetLock, 50);
        }
        
        this.aS(true);
    }

    _hDUARL(initialLoad = false, oldIsM) { // _hDUARL: _handleDimensionUpdateAndResizeLogic
        const newIsM = this.cMV(); 
        
        // Optimización: Se asegura que el recálculo SÓLO ocurra si es necesario
        const shouldRunCalc = initialLoad || newIsM !== oldIsM || this.cR === 0 || !this.isM;

        if (shouldRunCalc) {
            const dims = this.cbs.calculateAndApplyDimensions(
                this.rueda, this.opc, this.iA, this.aPO, this.tO, this.isM
            );
            this.cR = dims.currentRadius;
        }

        if (newIsM !== oldIsM || initialLoad) {
            this.uVS();
        } else if (!newIsM && this.cR > 0) {
             this._aTR();
        }

        if (this.hMA() && typeof this.cbs.updateGridSelection === 'function') {
            const gX = window.currentGridIndex ?? 0; // gX: gridIndex
            this.cbs.updateGridSelection(gX, true, true, true); 
        }

        this.aS(newIsM); 
    }

    handleResize = () => {
        // Optimización: uso de RAF para debounce
        window.updateViewportCache(); 
        if (this.rRI) cancelAnimationFrame(this.rRI);
        const oldIsM = this.isM; 
        this.rRI = requestAnimationFrame(() => {
            this._hDUARL(false, oldIsM); 
            this.rRI = null;
        });
    }

    aEL() { // aEL: attachEventListeners
        // Implementación inmutable de aEL (sin cambios)
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }
    
    iV(initialLoad = false) { // iV: initializeView
        // Implementación inmutable de iV (sin cambios)
        const oldIsM = this.isM; 
        this._hDUARL(initialLoad, oldIsM);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems'.");
        return;
    }

    if (!(window.abrirModal && window.updateGridSelection && window.calculateAndApplyDimensions && window.updateViewportCache)) {
        console.error("Faltan dependencias externas (utils.js, main-modal-manager.js, etc.).");
        return;
    }

    window.ruedaDinamicaInstance = new RuedaDinamica(menuItems, CONFIG, {
        abrirModal: window.abrirModal,
        updateGridSelection: window.updateGridSelection,
        calculateAndApplyDimensions: window.calculateAndApplyDimensions,
    });
});