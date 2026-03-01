// main-menu.js (Optimización Avanzada - Mini y Compacto)
const menuHTML = `
    <div id="background-container" aria-hidden="true">
        <div id="bg-layer-1" class="background-layer"></div>
        <div id="bg-layer-2" class="background-layer"></div>
    </div>
    <main id="rueda" class="rueda" role="navigation" aria-label="Menú principal de sistemas de juegos" tabindex="0"></main>
`;

const D2R = Math.PI / 180;
const WC = { IVF: .09 * 1.6, IWF: 2.6, TGR: 1.7, MRR: 300 / 1080, EMR: .8 };
const BREAKPOINT = 768;
const ANIM_DUR_BG = 500;
const LOCK_DUR_CLICK = 50;
const DEBOUNCE_BG_MS = 50;

let vH = 0, vW = 0;

const _uV = () => { vH = window.innerHeight; vW = window.innerWidth };
_uV();

const _cM = (aPO, tO) => {
    const { IVF, IWF, TGR, MRR, EMR } = WC;
    const h = vH || window.innerHeight;
    const iH = h * IVF, iW = iH * IWF, tCC = iH * (1 + TGR);
    let rR = 0;
    if (tO > 0) {
        const sA = Math.sin(aPO * D2R);
        rR = sA > 1e-6 ? tCC / sA : Infinity;
    }
    const cR = Math.max(h * MRR, rR);
    const rT = cR * 2, pL = -(cR * (1 + EMR));
    const r = (n) => Math.round(n * 100) / 100; // Función de redondeo inlined
    return {
        iH: r(iH), iW: r(iW),
        cR: r(cR), rT: r(rT), pL: r(pL)
    }
}

const _cA = (r, o, iA, aPO, tO, iM) => {
    const { iH, iW, cR: R, rT, pL } = _cM(aPO, tO);

    r.style.setProperty('--rueda-tamano', `${rT}px`);
    r.style.setProperty('--posicion-left', `${pL}px`);
    
    if (!iM) {
        for (let i = 0; i < o.length; i++) {
            const op = o[i];
            const aPR = iA[i] * D2R;
            const xO = Math.cos(aPR) * R, yO = Math.sin(aPR) * R;
            const r = (n) => Math.round(n * 100) / 100; 

            op.style.height = `${iH}px`;
            op.style.width = `${iW}px`;
            op.style.setProperty('--x-offset', `${r(xO)}px`);
            op.style.setProperty('--y-offset', `${r(yO)}px`);
        }
    }
    return { currentRadius: R }
}

const deferredTask = (t) => ('requestIdleCallback' in window) ? requestIdleCallback(t) : setTimeout(t, 0);

window.calculateAndApplyDimensions = _cA;
window.updateViewportCache = _uV;
window.lastSelectedIndex = 0;

class RD {
    constructor(mI, cbs, initialIndex = 0) {
        this.cbs = cbs;
        this.rEl = document.getElementById('rueda');
        if (!this.rEl) return;
        this.bg1 = document.getElementById('bg-layer-1'), this.bg2 = document.getElementById('bg-layer-2');
        this.cBgL = this.bg1;
        
        Object.assign(this, { ...window }); 

        this.mI = mI, this.opc = [];
        this.tO = mI.length, this.aPO = 360 / this.tO, this.hO = this.tO / 2;
        this.iA = null, this.cR = 0, this.iX = initialIndex, this.rO = 0, this.isM = false;
        this.isRAFThrottled = false, this.isRC = false, this.oA = null, this.rRI = null;
        this.bgCache = new Map(), this.cBGU = null, this.rVar = '--rueda-rotacion-actual';
        this.lazyObserver = null, this.bRTID = null, this.bgDebounceID = null;
        
        this.bg1.style.willChange = this.bg2.style.willChange = 'opacity';
        
        ['hKD', 'hW', 'hC', 'hR'].forEach(m => this[m] = this[m].bind(this));
        
        this.isRC = true; 
        
        this._gO(() => {
            this.iA = Array.from(this.opc, (_, i) => i * this.aPO);
            this.rO = +((this.iA[this.iX] * -1).toFixed(2));
            this._iAR(this.rO), this._aEL(), this._iV(true), this._pABG()
            setTimeout(() => this.isRC = false, LOCK_DUR_CLICK);
        })
    }
    destroy() {
        ['keydown', 'wheel'].forEach(e => document.removeEventListener(e, this[e === 'wheel' ? 'hW' : 'hKD'], { passive: e === 'wheel' })); 
        this.rEl?.removeEventListener('click', this.hC),
        window.removeEventListener('resize', this.hR),
        this.lazyObserver?.disconnect(),
        this.rRI && cancelAnimationFrame(this.rRI),
        [this.bRTID, this.bgDebounceID].forEach(id => id && clearTimeout(id)),
        this._sWCS(false); 
        this.bg1.style.willChange = this.bg2.style.willChange = 'auto';
    }
    _gO(oC) {
        const frag = document.createDocumentFragment();
        this.mI.forEach((n, i) => {
            const op = document.createElement('div');
            op.className = 'opcion', op.dataset.index = i;
            op.style.willChange = 'transform'; 
            const img = document.createElement('img');
            img.setAttribute('data-src', this.IMG_DIR + n + this.IMG_EXT);
            img.setAttribute('loading', 'lazy'), img.alt = n;
            op.appendChild(img), this.opc.push(op), frag.appendChild(op);
        });
        requestAnimationFrame(() => (this.rEl.appendChild(frag), this._iLIO(), oC?.()));
    }
    _iAR(r) {
        this.rEl.style.transition = 'none'; 
        this.rEl.style.setProperty(this.rVar, `${r.toFixed(2)}deg`);
        requestAnimationFrame(() => this.rEl.style.transition = '');
    }
    _pD(img) { 
        return new Promise(r => {
            const dS = img.getAttribute('data-src');
            if (!dS) return r(img);
            
            if (this.IMG_EXT === '.svg') {
                deferredTask(() => { img.src = dS; r(img); });
            } else {
                const iL = new Image();
                iL.onload = async () => (await window.decodeImage(iL), deferredTask(() => { img.src = dS; r(img); }));
                iL.onerror = () => r(img);
                iL.src = dS;
            }
        })
    }
    _fD(img) { 
        deferredTask(() => {
            img.removeAttribute('data-src');
            img.removeAttribute('loading');
        });
    }
    _iLIO() {
        this.lazyObserver?.disconnect();
        this.lazyObserver = new IntersectionObserver((e, o) => e.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target.querySelector('img');
                img.hasAttribute('data-src') && this._pD(img).then(this._fD); 
                o.unobserve(entry.target)
            }
        }), { root: this.rEl, rootMargin: '100px 100px', threshold: 0 });
        this.opc.forEach(op => op.querySelector('img').hasAttribute('data-src') && this.lazyObserver.observe(op));
    }
    _sWCS(a) { 
        const s = a ? 'transform' : 'auto';
        if (this.rEl.style.willChange !== s) {
            this.rEl.style.willChange = s;
            this.opc.forEach(o => o.style.willChange = s);
        }
    }
    _aR() { 
        if (this.isM) return;
        requestAnimationFrame(() => this.rEl.style.setProperty(this.rVar, `${this.rO.toFixed(2)}deg`)); 
        setTimeout(() => this.isRC = false, LOCK_DUR_CLICK) 
    }
    _cMV() { 
        const nIM = window.innerWidth <= BREAKPOINT;
        if (nIM === this.isM) return false;
        this.isM = nIM;
        this._sWCS(!nIM); 
        return true; 
    }
    _sTS(i, instant = false) { 
        if (!this.isM || !this.opc[i]) return;
        const sel = this.opc[i], cont = this.rEl;
        const behavior = instant ? 'auto' : 'smooth';
        
        requestAnimationFrame(() => {
            const iRect = sel.getBoundingClientRect(), cRect = cont.getBoundingClientRect(); 
            const tS = cont.scrollTop + iRect.top - cRect.top + iRect.height/2 - cRect.height/2;
            Math.abs(cont.scrollTop - tS) > 1 && cont.scrollTo({ top: tS, behavior });
        })
    }
    _uV() { 
        !this.isM 
            ? (this.rEl.style.transform = '', this._aR()) 
            : (this.rEl.style.transform = 'none', this.rEl.style.setProperty(this.rVar, `0deg`));
        this._iLIO(), this._sTS(this.iX, false);
    }
    _pDIB(u) { 
        if (this.bgCache.has(u)) return this.bgCache.get(u);
        const p = new Promise(r => {
            const img = new Image();
            img.onload = async () => (await window.decodeImage(img), r(u));
            img.onerror = () => r(u);
            img.src = u; 
        });
        return this.bgCache.set(u, p).get(u);
    }
    _pABG(i = this.iX) { 
        [i, i - 1, i + 1].forEach(idx => {
            this._pDIB(this.BG_DIR + this.mI[(idx % this.tO + this.tO) % this.tO] + this.BG_EXT);
        });
    }
    _aBG() { 
        const bgUrl = this.BG_DIR + this.mI[this.iX] + this.BG_EXT;
        const fBU = `url('${bgUrl}')`;
        if (this.cBGU === fBU) return;
        
        this.bgDebounceID && clearTimeout(this.bgDebounceID);
        const iX_cache = this.iX;
        
        this.bgDebounceID = setTimeout(() => {
            requestAnimationFrame(() => {
                if (iX_cache !== this.iX) return; 

                const tL = this.cBgL === this.bg1 ? this.bg2 : this.bg1;
                const cL = this.cBgL;
                
                this._pDIB(bgUrl).then(rU => {
                    if (iX_cache !== this.iX) return; 
                    this.cBGU = fBU;
                    tL.style.backgroundImage = fBU;
                    tL.style.zIndex = '2', cL.style.zIndex = '1';
                    cL.style.opacity = '0', tL.style.opacity = '1';
                    
                    this.bRTID && clearTimeout(this.bRTID);
                    this.bRTID = setTimeout(() => (cL.style.zIndex = '1', this.bRTID = null), ANIM_DUR_BG + 50);

                    this.cBgL = tL
                })
                this.bgDebounceID = null
            })
        }, DEBOUNCE_BG_MS)
    }
    _aS(s = false, instant = false) { 
        this.oA?.classList.remove('seleccionada');
        const nS = this.opc[this.iX];
        (this.oA = nS).classList.add('seleccionada');
        
        const img = nS.querySelector('img');
        img.style.willChange = 'transform, filter'; 
        if (this.oA !== nS && this.oA) {
            this.oA.querySelector('img').style.willChange = 'auto';
        }

        img.hasAttribute('data-src') && this._pD(img).then(this._fD);

        this._aBG(), this._pABG(); 
        s && this._sTS(this.iX, instant)
    }
    _uIAR(p) { 
        this.iX = (this.iX + p + this.tO) % this.tO;
        !this.isM && (this.rO = +((this.rO - (p * this.aPO)).toFixed(2)), this._aR());
    }
    _hSS() { 
        window.lastSelectedIndex = this.iX; 
        window.onSystemSelect?.(this.mI[this.iX]);
    }
    rR(dir) { this._uIAR(dir), this._aS(true) }
    hKD(e) {
        const k = e.key.toLowerCase();
        if (k === 'enter') return this._hSS(), e.preventDefault();
        
        const isV = ['arrowup', 'arrowdown', 'w', 's'].includes(k);
        const isH = ['arrowleft', 'arrowright', 'a', 'd'].includes(k);
        let dir = 0;

        if (this.isM) {
            dir = isV ? ((k === 'arrowdown' || k === 's') ? 1 : -1) : 0;
        } else if (isV || isH) {
             dir = (k === 'arrowright' || k === 'arrowdown' || k === 'd' || k === 's') ? 1 : -1;
        }

        dir && (this.rR(dir), e.preventDefault());
    }
    hW(e) {
        if (this.isM || this.isRC) return;
        
        if (this.isRAFThrottled) return;
        this.isRAFThrottled = true;
        
        requestAnimationFrame(() => (this.isRAFThrottled = false, this.rR(Math.sign(e.deltaY))));
    }
    hC(e) {
        if (this.isRC) return;
        const c = e.target.closest('.opcion');
        if (!c) return;
        const tX = +c.dataset.index;
        if (tX === this.iX) return this._hSS();
        
        this.isRC = true;
        const pX = this.iX;
        this.iX = tX;
        
        if (!this.isM) {
            let diff = tX - pX;
            if (Math.abs(diff) > this.hO) {
                diff -= Math.sign(diff) * this.tO;
            }
            this.rO = +((this.rO - diff * this.aPO).toFixed(2));
            this._aR();
        } else {
            setTimeout(() => this.isRC = false, LOCK_DUR_CLICK);
        }
            
        this._aS(true)
    }
    _rS(iL = false) { 
        const mC = this._cMV(), nIM = this.isM, sRC = iL || mC || this.cR === 0;
        let dU = false;
        
        if (sRC || !nIM) {
            const d = _cM(this.aPO, this.tO);
            dU = (d.cR !== this.cR || sRC) && (this.cR = d.cR, true);
        }

        dU && this.cbs.calculateAndApplyDimensions(this.rEl, this.opc, this.iA, this.aPO, this.tO, nIM);
        (mC || dU || iL) && this._uV();
        this._aS(nIM, iL) 
    }
    hR() {
        _uV(); 
        this.rRI && cancelAnimationFrame(this.rRI);
        this.rRI = requestAnimationFrame(() => (this._rS(false), this.rRI = null));
    }
    _aEL() {
        document.addEventListener('keydown', this.hKD);
        document.addEventListener('wheel', this.hW, { passive: true });
        this.rEl.addEventListener('click', this.hC);
        window.addEventListener('resize', this.hR)
    }
    _iV(iL = false) { this._rS(iL) }
}

window.initMainMenu = function () {
    const mC = document.getElementById('main-container');
    
    // ** NUEVO: Limpiar la instancia de detail-menu al volver al main-menu **
    window.detailMenuInstance?.destroy && window.detailMenuInstance.destroy();
    document.getElementById('detail-container').innerHTML = '';
    document.getElementById('detail-container').classList.remove('active');
    // ** FIN NUEVO **

    window.ruedaDinamicaInstance?.destroy();
    window.ruedaDinamicaInstance = null;
    
    mC.innerHTML = menuHTML;
    
    if (!Array.isArray(window.menuItems)) return;
    if (!(window.calculateAndApplyDimensions && window.updateViewportCache && window.decodeImage)) return;
    
    window.ruedaDinamicaInstance = new RD(window.menuItems, {
        calculateAndApplyDimensions: window.calculateAndApplyDimensions
    }, window.lastSelectedIndex || 0) 
};