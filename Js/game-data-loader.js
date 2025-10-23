// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid (Minificado Compacto)
// =========================================================================

(function () {
    const rAF = window.requestAnimationFrame;
    const c = {}; // Cache de listas de juegos
    const d = "Games/"; // Directorio de datos y portadas
    const l = "Icons/loading.svg"; // Icono de carga
    const w = ".webp"; // Extensión de imagen
    const r = '16/9'; // Aspect ratio por defecto
    const v = `currentGameListString`; // Variable global para la lista de juegos
    let o; // Observer (IntersectionObserver)

    function iL(i, u) { // iL: initLazyLoad (carga y decodificación)
        const p = new Image();

        p.addEventListener('load', function() {
            rAF(() => {
                i.src = u;
                i.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
                i.style.objectFit = 'cover';
                i.style.padding = '0';
                i.classList.remove('is-loading');
                i.removeAttribute('data-src');
            });
        });

        p.addEventListener('error', function() {
            rAF(() => {
                i.alt = `Error al cargar portada para ${i.title}`;
                console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${i.title}`);
                i.classList.remove('is-loading'); 
                i.removeAttribute('data-src');
            });
        });

        p.src = u;
    }
    
    function sO(e) { // sO: setupObserver
        if (!('IntersectionObserver' in window)) {
            console.warn("[ADVERTENCIA] IntersectionObserver no soportado. Cargando todas las imágenes inmediatamente.");
            e.forEach(i => {
                const u = i.getAttribute('data-src');
                if (u) iL(i, u);
            });
            return;
        }

        if (o) o.disconnect();

        const mB = document.querySelector('.modal-body'); 
        
        const O = {
            root: mB, 
            rootMargin: '300px 0px', 
            threshold: 0.01
        };

        o = new IntersectionObserver((es, ob) => {
            es.forEach(e => {
                if (e.isIntersecting) {
                    const i = e.target;
                    const u = i.getAttribute('data-src');

                    if (u) iL(i, u);

                    ob.unobserve(i);
                }
            });
        }, O);

        e.forEach(i => o.observe(i));
    }

    function lG(sN, cb) { // lG: loadGameItems
        if (c[sN]) {
            rAF(() => cb(c[sN]));
            return;
        }

        const sU = `${d}${sN}.js`;
        const s = document.createElement('script');
        s.type = 'text/javascript';
        s.src = sU;

        const pD = (sE) => { // pD: processData
            let i = [];
            const rT = window[v];

            if (typeof rT === 'string' && typeof window.parseHyphenList === 'function') {
                i = window.parseHyphenList(rT);
            } else {
                 console.warn(`[ADVERTENCIA] No se pudo procesar la lista de juegos. Requeridos: variable global '${v}' (string) y función 'parseHyphenList'.`);
            }
            
            if (window.hasOwnProperty(v)) delete window[v];

            c[sN] = i;
            
            rAF(() => {
                cb(i);
                sE.remove(); 
            });
        };

        s.onload = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => pD(s));
            } else {
                setTimeout(() => pD(s), 0);
            }
        };

        s.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo de datos: ${sU}.`);
            c[sN] = [];
            
            setTimeout(() => {
                cb([]);
                s.remove();
            }, 0);
        };

        document.head.appendChild(s);
    }

    function cI(i, sNL, idx) { // cI: createItem
        
        const iB = i.name;
        const iFT = iB + "-thumb";
        const u = `${d}${sNL}/${iFT}${w}`;
        const cN = window.cleanGameName ? window.cleanGameName(i.name) : i.name;

        const iE = document.createElement('li');
        iE.classList.add('grid-item');
        iE.dataset.index = idx;

        const tE = document.createElement('div');
        tE.classList.add('grid-item-title');
        tE.textContent = cN;

        const iEl = document.createElement('img');
        iEl.classList.add('grid-item-image', 'is-loading'); 
        iEl.src = l;
        iEl.alt = i.name;
        iEl.title = i.name;
        iEl.style.aspectRatio = r;
        iEl.setAttribute('data-src', u);

        iE.addEventListener('click', () => {
            const cI = parseInt(iE.dataset.index, 10);
            
            if (window.isCenteringActive !== undefined) window.isCenteringActive = true;
            if (typeof window.updateGridSelection === 'function') {
                rAF(() => window.updateGridSelection(cI, true, false, false));
            }

            const fU = iEl.classList.contains('is-loading') 
                ? l 
                : iEl.src; 
                
            if (typeof window.abrirDetallesJuego === 'function') {
                window.abrirDetallesJuego(i.name, fU, i.url);
            }
        });

        iE.appendChild(iEl);
        iE.appendChild(tE);

        return iE;
    }

    function rG(i, sN, cG, mT) { // rG: renderGrid
        const sNL = sN.toLowerCase();

        if (!i || i.length === 0) {
            rAF(() => {
                cG.innerHTML = '';
                const sT = mT ? mT.textContent : sN;
                cG.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${sT}.</p>`;
                if (window.currentGridIndex !== undefined) window.currentGridIndex = 0;
            });
            return;
        }

        cG.innerHTML = '';
        if (window.gridItemsElements) window.gridItemsElements = []; 

        const g = document.createElement('ul');
        g.classList.add('content-grid');
        const f = document.createDocumentFragment();

        let gEL = []; // gridElements
        let gIL = []; // gridImagesLazy

        i.forEach((item, index) => {
            const iE = cI(item, sNL, index);
            f.appendChild(iE);
            gEL.push(iE);
            const iEl = iE.querySelector('.grid-item-image');
            if (iEl) gIL.push(iEl);
        });
        
        g.appendChild(f);

        rAF(() => {
            cG.appendChild(g);
            
            if (window.gridItemsElements) window.gridItemsElements = gEL;

            sO(gIL);

            if (gEL.length > 0 && typeof window.updateGridSelection === 'function') {
                window.updateGridSelection(0, true, true, true);
            }
        });
    }

    window.disconnectLazyObserver = function() {
        if (o) {
            o.disconnect();
            o = null;
        }
    };
    
    window.loadGameItems = lG;
    window.renderGrid = rG;

})();