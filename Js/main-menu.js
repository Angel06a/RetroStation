// main-menu.js - VERSIÓN FINAL "ULTRA-PERFORMANCE" (PERSISTENCIA Y CICLO DE VIDA CORREGIDO)
const menuHTML = `
    <div id="background-container" aria-hidden="true">
        <div id="bg-layer-1" class="background-layer"></div>
        <div id="bg-layer-2" class="background-layer"></div>
    </div>
    <main id="rueda" class="rueda" role="navigation" aria-label="Menú principal de sistemas de juegos" tabindex="0"></main>
`;

// Inyección de optimización de renderizado CSS
(function injectPerformanceCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        #rueda { contain: layout style; }
        .opcion img { pointer-events: none; user-select: none; }
        .background-layer { will-change: opacity; }
    `;
    document.head.appendChild(style);
})();

const D2R = Math.PI / 180;
const WC = { IVF: 0.144, IWF: 2.6, TGR: 1.7, MRR: 0.277, EMR: 0.8 };
const BREAKPOINT = 768;
const ANIM_DUR_BG = 500;
const LOCK_DUR_CLICK = 50;
const DEBOUNCE_BG_MS = 50;
const MAX_BG_CACHE = 12; 

let vH = 0, vW = 0;
const _uV = () => { vH = window.innerHeight; vW = window.innerWidth; };
_uV();

const _round = (n) => Math.round(n * 100) / 100;

const _calculateDimensions = (aPO, tO) => {
    const { IVF, IWF, TGR, MRR, EMR } = WC;
    const h = vH || window.innerHeight;
    const iH = h * IVF, iW = iH * IWF, tCC = iH * (1 + TGR);
    let rR = 0;
    if (tO > 0) {
        const sA = Math.sin(aPO * D2R);
        rR = sA > 1e-6 ? tCC / sA : Infinity;
    }
    const cR = Math.max(h * MRR, rR);
    return { iH: _round(iH), iW: _round(iW), cR: _round(cR), rT: _round(cR * 2), pL: _round(-(cR * (1 + EMR))) };
};

const deferredTask = (t) => ('requestIdleCallback' in window) ? requestIdleCallback(t) : setTimeout(t, 0);

class RD {
    constructor(mI, initialIndex = 0) {
        this.rEl = document.getElementById('rueda');
        if (!this.rEl) return;

        this.bg1 = document.getElementById('bg-layer-1');
        this.bg2 = document.getElementById('bg-layer-2');
        this.mI = mI;
        this.opc = [];
        this.tO = mI.length;
        this.aPO = 360 / this.tO;
        this.hO = this.tO / 2;
        
        this.uV = mI.map((_, i) => ({
            x: Math.cos((i * this.aPO) * D2R),
            y: Math.sin((i * this.aPO) * D2R)
        }));

        this.state = new Proxy({ index: initialIndex }, {
            set: (target, prop, value) => {
                if (prop === 'index') {
                    const idx = (value + this.tO) % this.tO;
                    target[prop] = idx;
                    // Persistencia inmediata cada vez que cambia el índice
                    window.lastSelectedIndex = idx;
                    this._onIndexChange(idx);
                }
                return true;
            }
        });

        Object.assign(this, {
            iA: this.uV.map((_, i) => i * this.aPO),
            cR: 0, rO: 0, isM: false, isRC: true,
            bgCache: new Map(), cBGU: null, rVar: '--rueda-rotacion-actual',
            lazyObserver: null, cBgL: this.bg1,
            IMG_DIR: window.IMG_DIR || '', IMG_EXT: window.IMG_EXT || '.png',
            BG_DIR: window.BG_DIR || '', BG_EXT: window.BG_EXT || '.jpg'
        });

        ['_hKD', '_hW', '_hC', '_hR'].forEach(m => this[m] = this[m].bind(this));
        this._init();
    }

    _init() {
        this._gO(() => {
            this.rO = _round(this.iA[this.state.index] * -1);
            this._iAR(this.rO);
            this._aEL();
            this._rS(true);
            setTimeout(() => this.isRC = false, LOCK_DUR_CLICK);
        });
    }

    _onIndexChange(idx) {
        this._aS(true);
        this._aBG();
        this._pABG();
    }

    _pDIB(u) {
        if (this.bgCache.has(u)) {
            const p = this.bgCache.get(u);
            this.bgCache.delete(u);
            this.bgCache.set(u, p);
            return p;
        }
        if (this.bgCache.size >= MAX_BG_CACHE) this.bgCache.delete(this.bgCache.keys().next().value);
        const p = new Promise(r => {
            const img = new Image();
            img.onload = async () => { await window.decodeImage?.(img); r(u); };
            img.onerror = () => r(u);
            img.src = u;
        });
        this.bgCache.set(u, p);
        return p;
    }

    _applyDimensions(isM) {
        const dims = _calculateDimensions(this.aPO, this.tO);
        this.cR = dims.cR;
        this.rEl.style.setProperty('--rueda-tamano', `${dims.rT}px`);
        this.rEl.style.setProperty('--posicion-left', `${dims.pL}px`);
        
        if (!isM) {
            this.opc.forEach((op, i) => {
                op.style.height = `${dims.iH}px`;
                op.style.width = `${dims.iW}px`;
                op.style.setProperty('--x-offset', `${_round(this.uV[i].x * dims.cR)}px`);
                op.style.setProperty('--y-offset', `${_round(this.uV[i].y * dims.cR)}px`);
            });
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._hKD);
        document.removeEventListener('wheel', this._hW);
        this.rEl?.removeEventListener('click', this._hC);
        window.removeEventListener('resize', this._hR);
        this.lazyObserver?.disconnect();
        this.bgCache.clear();

        setTimeout(() => {
            if (this.rEl) {
                this.rEl.innerHTML = '';
                this.opc = [];
            }
        }, 500); 
    }

    _gO(oC) {
        const frag = document.createDocumentFragment();
        this.mI.forEach((n, i) => {
            const op = document.createElement('div');
            op.className = 'opcion';
            op.dataset.index = i;
            op.innerHTML = `<img data-src="${this.IMG_DIR}${n}${this.IMG_EXT}" loading="lazy" alt="${n}">`;
            this.opc.push(op);
            frag.appendChild(op);
        });
        requestAnimationFrame(() => { this.rEl.appendChild(frag); this._iLIO(); oC?.(); });
    }

    _iAR(r) {
        this.rEl.style.transition = 'none';
        this.rEl.style.setProperty(this.rVar, `${r.toFixed(2)}deg`);
        requestAnimationFrame(() => this.rEl.style.transition = '');
    }

    _iLIO() {
        this.lazyObserver?.disconnect();
        this.lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target.querySelector('img');
                    if (img?.hasAttribute('data-src')) {
                        const src = img.getAttribute('data-src');
                        const iL = new Image();
                        iL.onload = () => { img.src = src; img.removeAttribute('data-src'); };
                        iL.src = src;
                    }
                    this.lazyObserver.unobserve(entry.target);
                }
            });
        }, { root: this.rEl, rootMargin: '200px' });
        this.opc.forEach(op => this.lazyObserver.observe(op));
    }

    _aS(scroll = false, instant = false) {
        if (this.oA) this.oA.classList.remove('seleccionada');
        this.oA = this.opc[this.state.index];
        if (this.oA) this.oA.classList.add('seleccionada');
        if (scroll) this._sTS(this.state.index, instant);
    }

    _sTS(i, instant = false) {
        if (!this.isM || !this.opc[i]) return;
        requestAnimationFrame(() => {
            const iRect = this.opc[i].getBoundingClientRect(), cRect = this.rEl.getBoundingClientRect();
            const tS = this.rEl.scrollTop + iRect.top - cRect.top + iRect.height / 2 - cRect.height / 2;
            this.rEl.scrollTo({ top: tS, behavior: instant ? 'auto' : 'smooth' });
        });
    }

    _aBG() {
        const bgUrl = `${this.BG_DIR}${this.mI[this.state.index]}${this.BG_EXT}`;
        const fBU = `url('${bgUrl}')`;
        if (this.cBGU === fBU) return;

        clearTimeout(this.bgDebounceID);
        this.bgDebounceID = setTimeout(() => {
            this._pDIB(bgUrl).then(() => {
                const tL = this.cBgL === this.bg1 ? this.bg2 : this.bg1;
                const cL = this.cBgL;
                this.cBGU = fBU;
                if (tL) {
                    tL.style.backgroundImage = fBU;
                    tL.style.opacity = '1';
                }
                if (cL) cL.style.opacity = '0';
                this.cBgL = tL;
            });
        }, DEBOUNCE_BG_MS);
    }

    _pABG(i = this.state.index) {
        [-1, 1].forEach(offset => {
            const idx = (i + offset + this.tO) % this.tO;
            this._pDIB(`${this.BG_DIR}${this.mI[idx]}${this.BG_EXT}`);
        });
    }

    _hKD(e) {
        const k = e.key.toLowerCase();
        if (k === 'enter') { 
            e.preventDefault(); 
            window.lastSelectedIndex = this.state.index; 
            return window.onSystemSelect?.(this.mI[this.state.index]); 
        }
        let dir = 0;
        if (['arrowup', 'w', 'arrowleft', 'a'].includes(k)) dir = -1;
        else if (['arrowdown', 's', 'arrowright', 'd'].includes(k)) dir = 1;
        
        if (dir) { 
            e.preventDefault(); 
            this.state.index += dir;
            if (!this.isM) { this.rO = _round(this.rO - (dir * this.aPO)); this._aR(); }
        }
    }

    _hW(e) {
        if (this.isM || this.isRC) return;
        this.isRC = true;
        const dir = Math.sign(e.deltaY);
        this.state.index += dir;
        this.rO = _round(this.rO - dir * this.aPO);
        this._aR();
        setTimeout(() => this.isRC = false, 100);
    }

    _hC(e) {
        const c = e.target.closest('.opcion');
        if (!c || this.isRC) return;
        const tX = parseInt(c.dataset.index, 10);
        if (tX === this.state.index) {
            window.lastSelectedIndex = this.state.index;
            return window.onSystemSelect?.(this.mI[this.state.index]);
        }
        
        const pX = this.state.index;
        if (!this.isM) {
            let diff = tX - pX;
            if (Math.abs(diff) > this.hO) diff -= Math.sign(diff) * this.tO;
            this.rO = _round(this.rO - diff * this.aPO);
            this._aR();
        }
        this.state.index = tX;
    }

    _aR() { requestAnimationFrame(() => this.rEl.style.setProperty(this.rVar, `${this.rO.toFixed(2)}deg`)); }

    _rS(iL = false) {
        const nIM = window.innerWidth <= BREAKPOINT;
        const mC = nIM !== this.isM;
        this.isM = nIM;
        this._applyDimensions(nIM);
        if (mC || iL) {
            this.rEl.style.transform = nIM ? 'none' : '';
            if (nIM) this.rEl.style.setProperty(this.rVar, '0deg');
            else this._aR();
        }
        this._aS(nIM, iL);
        if (iL) { this._aBG(); this._pABG(); }
    }

    _hR() { _uV(); this._rS(false); }

    _aEL() {
        document.addEventListener('keydown', this._hKD);
        document.addEventListener('wheel', this._hW, { passive: true });
        this.rEl.addEventListener('click', this._hC);
        window.addEventListener('resize', this._hR);
    }
}

window.initMainMenu = function () {
    const mC = document.getElementById('main-container');
    window.detailMenuInstance?.destroy?.();
    window.ruedaDinamicaInstance?.destroy();
    
    mC.innerHTML = menuHTML;
    if (!Array.isArray(window.menuItems)) return;

    // Recuperamos el índice guardado antes de instanciar
    const savedIndex = window.lastSelectedIndex || 0;
    window.ruedaDinamicaInstance = new RD(window.menuItems, savedIndex);
};
