// =========================================================================
// game-grid-nav.js: Navegación de Grid (Optimización de Caché de Fila)
// =========================================================================

class GGN {
    static D_MS = 150; 
    static S_FACT = 0.2; 
    static S_TOL_PX = 0.5; 
    static MIN_CT_D = 5000; 

    iX = 0; 
    gIE = []; 
    nL = false; 
    lNT = 0; 

    pS = false; 
    sT = 0; 
    cS = 0; 
    sAF = null; 
    
    cLId = null; 
    cST = 0; 

    mB = null; 
    mO = null; 
    dO = null; 
    
    cC = 1; 
    vH = 0; 
    rM = []; // <-- NUEVA CACHÉ DE MÉTRICAS DE FILA

    constructor() {
        this._B(); 
        document.addEventListener('DOMContentLoaded', this._I.bind(this));
    }

    _B() { 
        Object.defineProperty(window, 'currentGridIndex', {
            get: () => this.iX,
            set: (v) => { this.iX = v; },
            configurable: true
        });
        Object.defineProperty(window, 'gridItemsElements', {
            get: () => this.gIE,
            set: (v) => { this.gIE = v; },
            configurable: true
        });
        
        window.updateGridSelection = this.uGS.bind(this);
        window.resetNavigationState = this.rNS.bind(this);
    }

    _C() { // Determine Grid Columns
        const i = this.gIE;
        if (i.length <= 1 || !i[0].offsetParent) {
            this.cC = 1;
            return;
        }

        const fT = i[0].offsetTop; 
        let c = 0;
        
        for (let j = 0; j < i.length; j++) {
            if (!i[j].offsetParent) continue; 
            
            if (Math.abs(i[j].offsetTop - fT) < 2) { 
                c++;
            } else {
                break;
            }
        }
        
        this.cC = Math.max(1, c); 
    }
    
    _D() { // Determine/Cache Row Metrics
        const { gIE: i, cC: c } = this;
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

    _U() { // Update Dimensions
        if (!this.mB) return;
        this._C(); 
        this._D(); // <-- LLAMADA PARA CACHEAR LAS MÉTRICAS
        this.vH = this.mB.clientHeight;
    }
    
    _A = () => { // Apply Grid Scroll
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
    
    _S(e) { // Calculate Scroll Target
        if (!this.mB || !e) return 0;

        const r = Math.floor(this.iX / this.cC);
        const m = this.rM[r]?.h || 0; // <-- USO DE CACHÉ (rM)
        
        const c1 = e.getBoundingClientRect(); 
        const c2 = this.mB.getBoundingClientRect();
        const eT = c1.top - c2.top + this.mB.scrollTop; 
        
        let tS = eT - ((this.vH - m) / 2); 
        
        tS = Math.max(0, tS);
        tS = Math.min(tS, this.mB.scrollHeight - this.vH);
        
        return tS;
    }

    _Z(e) { 
        if (!this.mB || !e) return true;
        
        return Math.abs(this.mB.scrollTop - this._S(e)) < GGN.S_TOL_PX;
    }
    
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

    _R() { 
        const e = this.gIE[this.iX];
        if (!e) return;
        
        this._E(this._S(e));
    }
    
    _P(e) { 
        if (!e) return;
        
        e.classList.remove('tag-center');

        if (this.cLId) {
            cancelAnimationFrame(this.cLId);
            this.cLId = null;
        }

        if (this.sAF) {
            cancelAnimationFrame(this.sAF);
            this.sAF = null;
            this.pS = false;
        }
    }

    _L = () => { 
        const { MIN_CT_D } = GGN;
        const e = this.gIE[this.iX];

        if (!e || !e.classList.contains('tag-center')) {
            if (this.cLId) {
                cancelAnimationFrame(this.cLId);
                this.cLId = null;
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

        this.cLId = requestAnimationFrame(this._L);
    }

    uGS(nI, fC = false, rC = false) {
        const i = this.gIE;
        if (i.length === 0 || !this.mB) return;

        this._U(); 
        
        const oI = this.iX; 
        const eM = i[nI]; 
        if (!eM) return;
        
        if (!rC) {
            i[oI]?.classList.remove('selected');
            this.iX = nI;
            eM.classList.add('selected');
        } else {
             this.iX = nI; 
        }

        if (oI !== nI) {
            i[oI]?.classList.remove('tag-center');
        }
        
        if (fC) {
            eM.classList.add('tag-center');
            this.cST = performance.now();
            if (this.cLId === null) {
                this.cLId = requestAnimationFrame(this._L);
            }
            this._E(this._S(eM));
        }
        
        else if (eM.classList.contains('tag-center') && !this._Z(eM)) {
             this._R();
        }
    }
    
    rNS() { 
        this.iX = 0;
        this.nL = false;
        this.lNT = 0;
        
        this.gIE.forEach(item => this._P(item));
        
        this.pS = false;
        this.sT = 0;
        this.cS = 0;
        this.cST = 0;
    }

    _W = (event) => { 
        const e = this.gIE[this.iX];
        if (e && e.classList.contains('tag-center')) {
            this._P(e);
        }
    }

    _H = () => { 
        if (!this.pS && this.gIE[this.iX]?.classList.contains('tag-center')) {
            this._P(this.gIE[this.iX]);
        }
    }
    
    _T(event) { 
        const e = event.currentTarget;
        const nI = parseInt(e.dataset.index, 10);
        
        this.uGS(nI, true, false); 
    }

    _K = (event) => { 
        const { D_MS } = GGN;
        const { key, repeat } = event;
        const i = this.gIE;

        const isD = this.dO?.classList.contains('open'); 
        const isM = this.mO?.classList.contains('open'); 
        const isGA = isM && !isD && i.length > 0; 
        
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
                if (this.nL && now - this.lNT < D_MS) {
                     event.preventDefault();
                     return;
                }
                this.lNT = now;
            }
            
            if (isN && !i[this.iX]?.classList.contains('selected')) {
                this.uGS(0, true, false); 
                event.preventDefault(); 
                return; 
            }

            let nI = this.iX;
            let h = false; 
            const lI = i.length - 1; 
            const c = this.cC; 
            const oI = this.iX; 

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
                    this.uGS(nI, true, false); 
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
                    if (rC) {
                        fC = true;
                    }
                } else {
                    fC = true;
                }

                if (nI !== this.iX) {
                    if (repeat) this.nL = true;
                    this.uGS(nI, fC, false); 
                } 
                else if (fC) { 
                    this.uGS(nI, true, false);
                }
                event.preventDefault();
            }
            if (!repeat) this.nL = false;
        }

        if ((isM || isD) && key !== 'Enter' && key !== 'Tab' && key !== 'Shift') {
            event.preventDefault();
        }
    }

    _I() { 
        this.mB = document.querySelector('.modal-body');
        this.mO = document.getElementById('modal-overlay');
        this.dO = document.getElementById('game-details-overlay');
        const cG = document.getElementById('content-grid-container'); 

        this._U();
        
        if (this.mB) {
             const rO = new ResizeObserver(() => {
                this._U(); 
             });
             rO.observe(this.mB);
        }

        cG?.addEventListener('click', (event) => {
            const t = event.target.closest('.grid-item');
            if (t) this._T({ currentTarget: t });
        });

        if (this.mB && this.mO) {
            this.mB.addEventListener('scroll', this._H, { passive: true });
            this.mB.addEventListener('wheel', this._W, { passive: true });
            
            const s = () => { 
                this._P(this.gIE[this.iX]);
            };

            this.mB.addEventListener('mousedown', (event) => {
                if (this.mO.classList.contains('open') && !event.target.closest('.grid-item')) {
                     s();
                }
            });
            this.mO.addEventListener('mousedown', (event) => {
                if (event.target === this.mO) {
                    s();
                }
            });
        }

        document.addEventListener('keydown', this._K);
    }
}

window.gameGridNavigatorInstance = new GGN();
