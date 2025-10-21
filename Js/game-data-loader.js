// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid (Optimizado para CSS Animation - Minificado Leve)
// =========================================================================

(function () {
    const dCache = {};
    const G_DIR = "Games/";
    const L_SVG = "Icons/loading.svg";
    const I_EXT_WEBP = ".webp";
    const A_RATIO = '16/9';
    const G_VAR_N = `currentGameListString`;

    function loadGameItems(systemName, callback) {
        if (dCache[systemName]) {
            requestAnimationFrame(() => callback(dCache[systemName]));
            return;
        }

        const scriptUrl = `${G_DIR}${systemName}.js`;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = scriptUrl;

        const processData = (scriptElement) => {
            const rawText = window[G_VAR_N];

            if (window.hasOwnProperty(G_VAR_N)) {
                delete window[G_VAR_N];
            }
            
            if (typeof rawText !== 'string' || !rawText) {
                console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró o no es válida.`);
                dCache[systemName] = [];
                requestAnimationFrame(() => {
                    callback([]);
                    scriptElement.remove(); 
                });
                return;
            }

            // --- INICIO: USO DEL WEB WORKER PARA EL PARSEO ---
            
            let items = [];
            
            if ('Worker' in window) {
                const worker = new Worker('./Js/data-parser-worker.js'); // Crea una instancia del Worker
                
                worker.onmessage = (e) => {
                    if (e.data.type === 'PARSE_COMPLETE') {
                        items = e.data.items;
                    } else if (e.data.type === 'PARSE_ERROR') {
                         console.error('[WORKER] Error al recibir datos parseados.');
                    }
                    
                    dCache[systemName] = items;
                    requestAnimationFrame(() => {
                        callback(items);
                        scriptElement.remove(); 
                    });
                    worker.terminate(); // Termina el Worker una vez completado
                };

                worker.onerror = (error) => {
                    console.error('[WORKER] Error crítico del Web Worker:', error);
                    dCache[systemName] = [];
                    requestAnimationFrame(() => {
                        callback([]);
                        scriptElement.remove();
                    });
                };
                
                // Envía el texto a parsear al Worker
                worker.postMessage({ type: 'PARSE_DATA', rawText: rawText });

            } else {
                // Fallback si Web Worker no es soportado (caso muy raro en navegadores modernos)
                console.warn('[ADVERTENCIA] Web Workers no soportados. Usando hilo principal.');
                
                dCache[systemName] = items; // items es []
                requestAnimationFrame(() => {
                    callback(items);
                    scriptElement.remove(); 
                });
            }

            // --- FIN: USO DEL WEB WORKER PARA EL PARSEO ---
        };

        script.onload = () => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => processData(script));
            } else {
                setTimeout(() => processData(script), 0);
            }
        };

        script.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo de datos: ${scriptUrl}.`);
            dCache[systemName] = [];
            
            setTimeout(() => {
                callback([]);
                script.remove();
            }, 0);
        };

        document.head.appendChild(script);
    }

    function createGridItem(item, systemNameLower, index) {
        
        const imgBase = item.name;
        const imgFileThumb = imgBase + "-thumb";
        const imgUrl = `${G_DIR}${systemNameLower}/${imgFileThumb}${I_EXT_WEBP}`;
        const cleanName = window.cleanGameName ? window.cleanGameName(item.name) : item.name;

        const itemEl = document.createElement('li');
        itemEl.classList.add('grid-item');
        itemEl.dataset.index = index;

        const titleEl = document.createElement('div');
        titleEl.classList.add('grid-item-title');
        titleEl.textContent = cleanName;

        const imgEl = document.createElement('img');
        imgEl.classList.add('grid-item-image', 'is-loading'); 
        imgEl.src = L_SVG;
        imgEl.alt = item.name;
        imgEl.title = item.name;
        imgEl.style.aspectRatio = A_RATIO; 

        const preloader = new Image();

        preloader.addEventListener('load', function() {
            requestAnimationFrame(() => {
                imgEl.src = imgUrl;
                imgEl.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
                imgEl.style.objectFit = 'cover';
                imgEl.style.padding = '0';
                imgEl.classList.remove('is-loading');
            });
        });

        preloader.addEventListener('error', function() {
            requestAnimationFrame(() => {
                imgEl.alt = `Error al cargar portada para ${item.name}`;
                console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
                imgEl.classList.remove('is-loading'); 
            });
        });

        preloader.src = imgUrl;

        itemEl.addEventListener('click', () => {
            const clickIndex = parseInt(itemEl.dataset.index, 10);
            
            if (window.isCenteringActive !== undefined) window.isCenteringActive = true;
            if (typeof window.updateGridSelection === 'function') {
                requestAnimationFrame(() => {
                    window.updateGridSelection(clickIndex, true, false, false);
                });
            }

            const finalImgUrl = imgEl.classList.contains('is-loading') 
                ? L_SVG 
                : imgUrl;
                
            if (typeof window.abrirDetallesJuego === 'function') {
                window.abrirDetallesJuego(item.name, finalImgUrl, item.url);
            }
        });

        itemEl.appendChild(imgEl);
        itemEl.appendChild(titleEl);

        return itemEl;
    }

    function renderGrid(items, systemName, contentGridContainer, modalTitle) {
        const systemNameLower = systemName.toLowerCase();

        contentGridContainer.innerHTML = '';
        if (window.gridItemsElements) window.gridItemsElements = []; 

        if (!items || items.length === 0) {
            const systemTitle = modalTitle ? modalTitle.textContent : systemName;
            contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${systemTitle}.</p>`;
            if (window.currentGridIndex !== undefined) window.currentGridIndex = 0;
            return;
        }

        const grid = document.createElement('ul');
        grid.classList.add('content-grid');
        const fragment = document.createDocumentFragment();

        let gridElementsLocal = [];

        items.forEach((item, index) => {
            const itemEl = createGridItem(item, systemNameLower, index);
            fragment.appendChild(itemEl);
            gridElementsLocal.push(itemEl);
        });
        
        grid.appendChild(fragment);

        requestAnimationFrame(() => {
            contentGridContainer.appendChild(grid);
            
            if (window.gridItemsElements) window.gridItemsElements = gridElementsLocal;

            if (gridElementsLocal.length > 0 && typeof window.updateGridSelection === 'function') {
                window.updateGridSelection(0, true, true, true);
            }
        });
    }

    window.loadGameItems = loadGameItems;
    window.renderGrid = renderGrid;

})();
