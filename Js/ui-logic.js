// =========================================================================
// ui-logic.js: Minificado y Optimizado para Rueda Dinámica (V2 Compacto)
// =========================================================================

const C = { // Config
    imgDir: "Sistemas/", imgExt: ".svg", bgDir: "Fondos/", bgExt: ".jpg",
    bp: 768, scrollT: 80, animDurBg: 600, 
};

class RD { // RuedaDinamica
    constructor(mI, conf, cbs) {
        this.cbs = cbs; 
        this.rEl = document.getElementById('rueda'); // rEl: ruedaElement
        this.bgCont = document.getElementById('background-container');
        this.mRef = document.getElementById('modal-overlay'); // mRef: modalRef
        this.dRef = document.getElementById('game-details-overlay'); // dRef: detailsRef
        
        if (!this.rEl) { console.error("El elemento 'rueda' no fue encontrado."); return; }

        this.mI = mI; 
        this.conf = conf;  
        this.opc = [];       // opc: opciones (items DOM)
        this.tO = mI.length; // tO: totalOpciones
        this.aPO = 360 / this.tO; // aPO: anguloPorOpcion
        this.hO = this.tO / 2;    // hO: halfOptions
        this.iA = null;      // iA: initialAngles

        this.cR = 0;         // cR: currentRadius
        this.iX = 0;         // iX: indiceActual (index)
        this.rO = 0;         // rO: rotacionObjetivo
        this.cFA = null;     // cFA: capaFondoActual
        this.isM = false;    // isM: isMobile
        this.isS = false;    // isS: isScrolling (Throttle flag)
        this.isRC = false;   // isRC: isRotatingClick
        this.oA = null;      // oA: opcionAnterior (DOM)
        this.rRI = null;     // rRI: resizeRafId
        
        this.pBR = null;     // pBR: pendingBgRemove (DOM)
        this.bRTID = null;   // bRTID: bgRemoveTimeoutId
        this.bgCache = new Map();
        this.cBGU = null;    // cBGU: currentBgUrl
        this.rVar = '--rueda-rotacion-actual'; // rVar: rotacionVar

        this._gOO(() => { // _gOO: generarOpcionesOptimizada
            this.iA = Array.from(this.opc).map((_, index) => index * this.aPO);
            this._aEL(); // _aEL: attachEventListeners
            this._iV(true); // _iV: initializeView
        });
    }

    _gOO(onComplete) {
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
                this.rEl.appendChild(frag);
                if (onComplete) onComplete();
            });
        });
    }

    _sWCS(activate) { // _sWCS: setWillChangeState
        const state = activate ? 'transform' : 'auto';
        if (this.rEl.style.willChange !== state) {
            this.rEl.style.willChange = state;
            this.opc.forEach(op => op.style.willChange = state);
        }
    }
    
    _aTR() { // _aTR: _applyTargetRotation
        if (this.isM) return;
        this.rEl.style.setProperty(this.rVar, `${this.rO}deg`);
        const resetLock = () => { this.isRC = false; };
        ('requestIdleCallback' in window) ? requestIdleCallback(resetLock, { timeout: 100 }) : setTimeout(resetLock, 100); 
    }

    _hMA() { // _hMA: hayModalAbierto
        return this.mRef?.classList.contains('open') || this.dRef?.classList.contains('open');
    }

    _cMV() { // _cMV: checkMobileView
        const newIsM = window.innerWidth <= this.conf.bp;
        if (newIsM !== this.isM) this.isM = newIsM;
        return this.isM;
    }

    _sTSX(index) { // _sTSX: scrollToSelectedIndex
        if (!this.isM) return;
        const sel = this.opc[index]; // sel: selected
        const cont = this.rEl; // cont: container
        if (!sel || !cont) return;

        requestAnimationFrame(() => {
            const iRect = sel.getBoundingClientRect();
            const cRect = cont.getBoundingClientRect();
            const iC = iRect.top - cRect.top + cont.scrollTop + (iRect.height / 2); // iC: itemCenter
            const tS = iC - (cRect.height / 2); // tS: targetScroll

            if (Math.abs(cont.scrollTop - tS) > 1) {
                cont.scrollTo({ top: tS, behavior: 'smooth' });
            }
        });
    }

    _uVS() { // _uVS: updateViewState
        const activateWCS = !this.isM;

        if (activateWCS) {
            this.rEl.style.transform = ''; 
            this.rO = this.iA[this.iX] * -1;
            this._aTR();
        } else {
            this.rEl.style.transform = `none`; 
            this.rEl.style.setProperty(this.rVar, `0deg`); 
        }
        
        this._sWCS(activateWCS); 
        this._sTSX(this.iX); 
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

    _aF() { // _aF: actualizarFondo
        const name = this.mI[this.iX];
        const bgUrl = this.conf.bgDir + name + this.conf.bgExt;
        const fBU = `url('${bgUrl}')`; // fBU: fullBgUrl

        if (this.cBGU === fBU) return;

        this._pADImg(bgUrl).then(rU => { // rU: resolvedUrl
            if (`url('${rU}')` !== fBU) return; 

            this.cBGU = fBU;

            if (this.bRTID) clearTimeout(this.bRTID);
            if (this.pBR && this.bgCont.contains(this.pBR)) this.bgCont.removeChild(this.pBR);
            this.bRTID = this.pBR = null;
            
            const cAnt = this.cFA; // cAnt: capaAnterior
            
            const nC = document.createElement('div'); // nC: nuevaCapa
            nC.className = 'background-layer';
            nC.style.backgroundImage = fBU;
            nC.style.willChange = 'opacity';
            
            this.bgCont.appendChild(nC);
            this.cFA = nC; 

            void nC.offsetWidth; 
            nC.style.opacity = '1';

            if (cAnt) {
                cAnt.style.opacity = '0';
                this.pBR = cAnt;

                this.bRTID = setTimeout(() => {
                    if (this.bgCont.contains(cAnt)) this.bgCont.removeChild(cAnt);
                    this.pBR = this.bRTID = null;
                }, this.conf.animDurBg); 
            }
        });
    }

    _aS(scroll = false) { // _aS: actualizarSeleccion
        if (this.oA) this.oA.classList.remove('seleccionada');

        const nS = this.opc[this.iX]; // nS: nuevaSeleccion
        nS.classList.add('seleccionada');
        this.oA = nS;

        this._aF();
        if (scroll) this._sTSX(this.iX);
    }

    _uRIAT(pasos) { // _uRIAT: _updateRotationIndexAndTarget
        this.iX = (this.iX + pasos + this.tO) % this.tO;
        if (!this.isM) {
            this.rO -= (pasos * this.aPO); 
            this._aTR();
        }
    }

    rR(dir) { // rR: rotarRueda
        this._uRIAT(dir);
        this._aS(true);
    }

    handleKeyDown = (event) => {
        if (this._hMA()) return;
        
        const key = event.key.toLowerCase();
        let dir = 0; 
        
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
        if (this._hMA() || this.isM) return;
        event.preventDefault(); 
        
        if (this.isS) return;

        this.rR(event.deltaY > 0 ? 1 : -1);

        this.isS = true;
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
        } else {
            const resetLock = () => { this.isRC = false; };
            ('requestIdleCallback' in window) ? requestIdleCallback(resetLock) : setTimeout(resetLock, 50);
        }
        
        this._aS(true);
    }

    _hDUARL(initialLoad = false, oldIsM) { // _hDUARL: _handleDimensionUpdateAndResizeLogic
        const newIsM = this._cMV(); 
        
        const sRC = initialLoad || newIsM !== oldIsM || this.cR === 0 || !this.isM; // sRC: shouldRunCalc

        if (sRC) {
            const dims = this.cbs.calculateAndApplyDimensions(
                this.rEl, this.opc, this.iA, this.aPO, this.tO, this.isM
            );
            this.cR = dims.currentRadius;
        }

        if (newIsM !== oldIsM || initialLoad) {
            this._uVS();
        } else if (!newIsM && this.cR > 0) {
             this._aTR();
        }

        if (this._hMA() && typeof this.cbs.updateGridSelection === 'function') {
            const gX = window.currentGridIndex ?? 0; // gX: gridIndex
            this.cbs.updateGridSelection(gX, true, true, true); 
        }

        this._aS(newIsM); 
    }

    handleResize = () => {
        window.updateViewportCache(); 
        if (this.rRI) cancelAnimationFrame(this.rRI);
        const oldIsM = this.isM; 
        this.rRI = requestAnimationFrame(() => {
            this._hDUARL(false, oldIsM); 
            this.rRI = null;
        });
    }

    _aEL() { // _aEL: attachEventListeners
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rEl.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }
    
    _iV(initialLoad = false) { // _iV: initializeView
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

    window.ruedaDinamicaInstance = new RD(menuItems, C, {
        abrirModal: window.abrirModal,
        updateGridSelection: window.updateGridSelection,
        calculateAndApplyDimensions: window.calculateAndApplyDimensions,
    });
});