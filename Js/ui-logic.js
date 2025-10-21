// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal (MINIFICADO)
// =========================================================================

const CONFIG = {
    imgDir: "Sistemas/", imgExt: ".svg", bgDir: "Fondos/", bgExt: ".jpg",
    bp: 768, scrollT: 100, animDurBg: 600,
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
        this.isS = false;    // isS: isScrolling
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
        const state = activate ? 'transform' : 'auto';
        if (this.rueda.style.willChange !== state) {
            this.rueda.style.willChange = state;
            this.opc.forEach(op => op.style.willChange = state);
        }
    }
    
    _aTR() { // _aTR: _applyTargetRotation
        if (this.isM) return;
        this.rueda.style.setProperty(this.rVar, `${this.rO}deg`);
        const resetLock = () => { this.isRC = false; };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(resetLock, { timeout: 100 });
        } else {
            setTimeout(resetLock, 100); 
        }
    }

    hMA() { // hMA: hayModalAbierto
        return this.modalRef?.classList.contains('open') || this.detailsRef?.classList.contains('open');
    }

    cMV() { // cMV: checkMobileView
        const newIsM = window.innerWidth <= this.conf.bp;
        if (newIsM !== this.isM) this.isM = newIsM;
        return this.isM;
    }

    sTSX(index) { // sTSX: scrollToSelectedIndex
        if (!this.isM) return;
        const selected = this.opc[index];
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
        this.sTSX(this.iX);
    }

    _pADImg(url) { // _pADImg: _preloadAndDecodeImage
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
        const name = this.mI[this.iX];
        const bgUrl = this.conf.bgDir + name + this.conf.bgExt;
        const fullBgUrl = `url('${bgUrl}')`;

        if (this.cBGU === fullBgUrl) return;

        this._pADImg(bgUrl).then(resolvedUrl => {
            if (`url('${resolvedUrl}')` !== fullBgUrl) return; 

            this.cBGU = fullBgUrl;

            // Limpieza y manejo de timeouts
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

            // Forzar reflow y aplicar transición
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
        if (this.oA) this.oA.classList.remove('seleccionada');

        const nuevaSel = this.opc[this.iX];
        nuevaSel.classList.add('seleccionada');
        this.oA = nuevaSel;

        this.aF();
        if (scroll) this.sTSX(this.iX);
    }

    _uRIAT(pasos) { // _uRIAT: _updateRotationIndexAndTarget
        this.iX = (this.iX + pasos + this.tO) % this.tO;
        if (!this.isM) {
            this.rO -= (pasos * this.aPO); // Menos negación en el bucle
            this._aTR();
        }
    }

    rR(dir) { // rR: rotarRueda
        this._uRIAT(dir);
        this.aS(true);
    }

    handleKeyDown = (event) => {
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
        
        if (this.isS) return;

        this.rR(event.deltaY > 0 ? 1 : -1);

        this.isS = true;
        setTimeout(() => this.isS = false, this.conf.scrollT);
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
            this.rO -= (diff * this.aPO); // Menos negación en el bucle
            this._aTR(); 
        } else {
            const resetLock = () => { this.isRC = false; };
            ('requestIdleCallback' in window) ? requestIdleCallback(resetLock) : setTimeout(resetLock, 50);
        }
        
        this.aS(true);
    }

    _hDUARL(initialLoad = false, oldIsM) { // _hDUARL: _handleDimensionUpdateAndResizeLogic
        const newIsM = this.cMV(); 
        
        // CONDICIÓN CORREGIDA: Recalcular si NO es la carga inicial (es un resize),
        // O si hay cambio de modo móvil, O si el radio no está inicializado.
        const shouldRunCalc = !initialLoad || newIsM !== oldIsM || this.cR === 0;

        if (shouldRunCalc) {
            const dims = this.cbs.calculateAndApplyDimensions(
                this.rueda, this.opc, this.iA, this.aPO, this.tO
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
        window.updateViewportCache(); // 👈 Esto actualiza las variables de altura/ancho
        if (this.rRI) cancelAnimationFrame(this.rRI);
        const oldIsM = this.isM; 
        this.rRI = requestAnimationFrame(() => {
            this._hDUARL(false, oldIsM); // 👈 Esto ahora fuerza el recálculo
            this.rRI = null;
        });
    }

    aEL() { // aEL: attachEventListeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }
    
    iV(initialLoad = false) { // iV: initializeView
        const oldIsM = this.isM; 
        this._hDUARL(initialLoad, oldIsM);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems'.");
        return;
    }

    // Comprobación de dependencias simplificada
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
