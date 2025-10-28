// =========================================================================
// game-grid-nav.js: Navegación de Grid (Optimización de Caché de Fila - V3)
// Versión Simplificada para Rendimiento.
// =========================================================================

class GGN {
    static D_MS = 150;
    static S_FACT = 0.2;
    static S_TOL_PX = 0.5;
    static MIN_CT_D = 5000;

    i = 0; // iX - Índice actual seleccionado
    e = []; // gIE - Elementos del grid
    l = false; // nL - Bloqueo de navegación activa?
    lT = 0; // lNT - Last Navigation Time

    pS = false; // pendingScroll
    sT = 0; // Scroll Target
    cS = 0; // Current Scroll
    sAF = null; // ID RequestAnimationFrame para Scroll
    
    cL = null; // cLId - ID RequestAnimationFrame para Centering Loop
    cST = 0; // Centering Start Time
    cA = false; // iCA - isCenteringActive

    mB = null; // Modal Body Element
    mO = null; // Modal Overlay Element
    dO = null; // Detail Overlay Element
    
    cC = 1; // Column Count
    vH = 0; // Viewport Height
    rM = []; // rowMetrics - Caché de Métricas de Fila

    constructor() {
        this._B(); 
        document.addEventListener('DOMContentLoaded', this._I.bind(this));
    }

    // Bind global properties/methods
    _B() { 
        Object.defineProperty(window, 'currentGridIndex', { get: () => this.i, set: (v) => { this.i = v; }, configurable: true });
        Object.defineProperty(window, 'gridItemsElements', { get: () => this.e, set: (v) => { this.e = v; }, configurable: true });
        Object.defineProperty(window, 'isCenteringActive', { get: () => this.cA, set: (v) => { this.cA = v; }, configurable: true });
        
        window.updateGridSelection = this.uGS.bind(this);
        window.resetNavigationState = this.rNS.bind(this);
    }

    // Determine Grid Columns
    _C() { 
        const i = this.e;
        if (i.length <= 1 || !i[0]?.offsetParent) {
            this.cC = 1;
            return;
        }

        const fT = i[0].offsetTop; 
        let c = 0;
        
        for (let j = 0; j < i.length; j++) {
            const item = i[j];
            if (!item.offsetParent) continue; 
            
            if (Math.abs(item.offsetTop - fT) < 2) { 
                c++;
            } else {
                break;
            }
        }
        
        this.cC = Math.max(1, c); 
    }
    
    // Determine/Cache Row Metrics
    _D() { 
        const { e: i, cC: c } = this;
        this.rM = [];

        if (i.length === 0) return;

        let currRow = -1;
        
        for (let j = 0; j < i.length; j++) {
            const row = Math.floor(j / c);
            
            if (row !== currRow) {
                currRow = row;
                this.rM[currRow] = { h: 0 }; 
            }
            
            const h = i[j].offsetHeight;
            if (h > this.rM[currRow].h) {
                 this.rM[currRow].h = h;
            }
        }
    }

    // Update Dimensions
    _U() { 
        if (!this.mB) return;
        this._C(); 
        this._D(); 
        this.vH = this.mB.clientHeight;
    }
    
    // Apply Grid Scroll (RAF)
    _A = () => { 
        const { S_FACT, S_TOL_PX } = GGN;
        const d = this.sT - this.cS; 
        
        this.cS += d * S_FACT;
        
        if (Math.abs(d) < S_TOL_PX) {
            this.cS = this.sT; 
            cancelAnimationFrame(this.sAF);
            this.sAF = null;
            this.pS = false;
        } else {
            this.sAF = requestAnimationFrame(this._A);
        }
        
        this.mB.scrollTop = this.cS;
    }
    
    // Calculate Scroll Target
    _S(e) { 
        const { mB, i, cC, rM, vH } = this;
        if (!mB || !e) return 0;

        const r = Math.floor(i / cC);
        const m = rM[r]?.h || 0; 
        
        const c1 = e.getBoundingClientRect(); 
        const c2 = mB.getBoundingClientRect();
        const eT = c1.top - c2.top + mB.scrollTop; 
        
        let tS = eT - ((vH - m) / 2); 
        
        tS = Math.max(0, tS);
        tS = Math.min(tS, mB.scrollHeight - vH);
        
        return tS;
    }

    // isCentered Check
    _Z(e) { 
        if (!this.mB || !e) return true;
        return Math.abs(this.mB.scrollTop - this._S(e)) < GGN.S_TOL_PX;
    }
    
    // Engage Scroll Animation
    _E(tS) { 
        const { S_TOL_PX } = GGN;
        this.sT = tS;

        if (Math.abs(this.sT - this.mB.scrollTop) < S_TOL_PX) {
            if (this.sAF) cancelAnimationFrame(this.sAF);
            this.sAF = null;
            this.pS = false;
            return;
        }

        if (this.sAF === null) {
            this.cS = this.mB.scrollTop;
            this.pS = true;
            this.sAF = requestAnimationFrame(this._A);
        }
    }

    // Recenter (Scroll)
    _R() { 
        const e = this.e[this.i];
        if (e) this._E(this._S(e));
    }

    // Passive State (Stop centering/tag-center)
    _P(e) { 
        if (!e) return;
        
        if (e.classList.contains('tag-center')) {
            e.classList.remove('tag-center');
            if (this.cA && e === this.e[this.i]) {
                this.cA = false; 
            }
        }

        if (this.cL) {
            cancelAnimationFrame(this.cL);
            this.cL = null;
        }

        if (this.sAF) {
            cancelAnimationFrame(this.sAF);
            this.sAF = null;
            this.pS = false;
        }
    }

    // Centering Check Loop (RAF)
    _L = () => { 
        const { MIN_CT_D } = GGN;
        const e = this.e[this.i];

        if (!e || !e.classList.contains('tag-center')) {
            if (this.cL) {
                cancelAnimationFrame(this.cL);
                this.cL = null;
            }
            return;
        }

        const tE = performance.now() - this.cST; 
        const isC = this._Z(e); 
        
        if (isC && tE >= MIN_CT_D) {
            this._P(e); 
            return;
        }
        
        if (!isC) {
            this._R(); 
        }

        this.cL = requestAnimationFrame(this._L);
    }
    
    // Start Centering Loop
    _SC(eM) { 
        this.cA = true; 
        eM.classList.add('tag-center');
        this.cST = performance.now();
        if (this.cL === null) {
            this.cL = requestAnimationFrame(this._L);
        }
        this._E(this._S(eM));
    }

    // Update Grid Selection
    uGS(nI, fC = false, rC = false) { 
        const { e: i, mB } = this;
        if (i.length === 0 || !mB) return;
        
        this._U(); 
        
        const oI = this.i; 
        const eM = i[nI]; 
        if (!eM) return;
        
        if (!rC) {
            i[oI]?.classList.remove('selected');
            this.i = nI;
            eM.classList.add('selected');
        } else {
             this.i = nI; 
        }

        if (oI !== nI) {
            i[oI]?.classList.remove('tag-center');
        }
        
        if (fC) {
            this._SC(eM);
        }
        
        else if (eM.classList.contains('tag-center') && !this._Z(eM)) {
             this._R();
        }
    }
    
    // Reset Navigation State
    rNS() { 
        this.i = 0;
        this.l = false;
        this.lT = 0;
        
        this.e.forEach(item => { 
            item.classList.remove('tag-center', 'selected');
        });
        
        this.pS = false;
        this.sT = 0;
        this.cS = 0;
        this.cST = 0;
        this.cA = false; 
        
        if (this.cL) {
            cancelAnimationFrame(this.cL);
            this.cL = null;
        }
        if (this.sAF) {
            cancelAnimationFrame(this.sAF);
            this.sAF = null;
        }
    }

    // Wheel Event (Mouse Scroll)
    _W = () => { 
        const e = this.e[this.i];
        if (e && e.classList.contains('tag-center')) {
            this._P(e);
        }
    }

    // Scroll Event (Touch/Drag Scroll)
    _H = () => { 
        if (!this.pS && this.e[this.i]?.classList.contains('tag-center')) {
            this._P(this.e[this.i]);
        }
    }
    
    // Click/Tap Event Handler
    _T(event) { 
        const e = event.currentTarget;
        const nI = parseInt(e.dataset.index, 10);
        this.uGS(nI, true); 
    }

    // Keydown Event
    _K = (event) => { 
        const { D_MS } = GGN;
        const { key, repeat } = event;
        const { e: i, dO, mO, i: oI, cC: c } = this;

        const isD = dO?.classList.contains('open'); 
        const isM = mO?.classList.contains('open'); 
        const isGA = isM && !isD && i.length > 0; 
        const lI = i.length - 1; 

        if (key === 'Enter' && window.inputLock) {
            event.preventDefault();
            return;
        }
        if (key === 'Escape') {
            if (isD && window.cerrarDetallesJuego) window.cerrarDetallesJuego();
            else if (isM && window.cerrarModal) window.cerrarModal();
            event.preventDefault();
            return;
        }

        if (isGA) {
            const isN = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(key); 

            if (repeat) {
                const now = performance.now();
                if (this.l && now - this.lT < D_MS) {
                     event.preventDefault();
                     return;
                }
                this.lT = now;
            }
            
            if (isN && !i[oI]?.classList.contains('selected')) {
                this.uGS(0, true); 
                event.preventDefault(); 
                return; 
            }

            let nI = oI;
            let h = false; 

            switch (key) {
                case 'ArrowLeft':
                    nI = (nI === 0) ? lI : nI - 1; 
                    h = true;
                    break;
                case 'ArrowRight':
                    nI = (nI === lI) ? 0 : nI + 1; 
                    h = true;
                    break;
                case 'ArrowUp':
                    nI = Math.max(0, nI - c);
                    h = true;
                    break;
                case 'ArrowDown':
                    nI = Math.min(lI, nI + c);
                    h = true;
                    break;
                case 'Enter':
                    this.uGS(nI, true); 
                    i[nI].click();
                    h = true;
                    break;
            }

            if (h && key !== 'Enter') {
                const oR = Math.floor(oI / c); 
                const nR = Math.floor(nI / c); 
                const rC = oR !== nR; 
                
                let fC = false; 

                if (nI !== oI) {
                    if (rC) fC = true;
                } else {
                    fC = true;
                }
                
                if (nI !== this.i) {
                    if (repeat) this.l = true;
                    this.uGS(nI, fC); 
                } 
                else if (fC) { 
                    this.uGS(nI, true);
                }
                event.preventDefault();
            }
            if (!repeat) this.l = false;
        }

        if ((isM || isD) && key !== 'Enter' && key !== 'Tab' && key !== 'Shift') {
            event.preventDefault();
        }
    }

    // Initialization
    _I() { 
        this.mB = document.querySelector('.modal-body');
        this.mO = document.getElementById('modal-overlay');
        this.dO = document.getElementById('game-details-overlay');
        const cG = document.getElementById('content-grid-container'); 

        this._U();
        
        if (this.mB) {
             const rO = new ResizeObserver(() => this._U());
             rO.observe(this.mB);
        }

        cG?.addEventListener('click', (event) => {
            const t = event.target.closest('.grid-item');
            if (t) this._T({ currentTarget: t });
        });

        if (this.mB && this.mO) {
            const stopCentering = () => { 
                const e = this.e[this.i];
                if (e && e.classList.contains('tag-center')) this._P(e);
            };

            this.mB.addEventListener('scroll', this._H, { passive: true });
            this.mB.addEventListener('wheel', this._W, { passive: true });
            
            this.mB.addEventListener('mousedown', (event) => {
                if (this.mO.classList.contains('open') && !event.target.closest('.grid-item')) {
                     stopCentering();
                }
            });
            this.mO.addEventListener('mousedown', (event) => {
                if (event.target === this.mO) {
                    stopCentering();
                }
            });
        }

        document.addEventListener('keydown', this._K);
    }
}

window.gameGridNavigatorInstance = new GGN();