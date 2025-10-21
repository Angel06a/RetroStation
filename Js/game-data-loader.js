// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid (Optimizado para CSS Animation - Minificado Leve)
// =========================================================================

(function () {
    const dCache = {};
    const G_DIR = "Games/";
    const L_SVG = "Icons/loading.svg"; // Placeholder (spinner)
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
                const worker = new Worker('./Js/data-parser-worker.js'); 
                
                worker.onmessage = (e) => {
                    if (e.data.type === 'PARSE_COMPLETE') {
                        items = e.data.items;
                    } else if (e.data.type === 'PARSE_ERROR') {
                         console.error(`[WORKER] Error al recibir datos parseados para ${systemName}.`);
                    }
                    
                    dCache[systemName] = items;
                    requestAnimationFrame(() => {
                        callback(items);
                        scriptElement.remove(); 
                    });
                    worker.terminate(); 
                };

                worker.onerror = (error) => {
                    console.error(`[WORKER] Error crítico del Web Worker para ${systemName}:`, error);
                    dCache[systemName] = [];
                    requestAnimationFrame(() => {
                        callback([]);
                        scriptElement.remove();
                    });
                };
                
                worker.postMessage({ 
                    type: 'PARSE_DATA', 
                    rawText: rawText,
                    systemName: systemName 
                });

            } else {
                console.warn('[ADVERTENCIA] Web Workers no soportados. Usando hilo principal.');
                
                dCache[systemName] = items; 
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
    
    // =====================================================================
    // Lógica de Carga de Imagen Pospuesta (Lazy Loading)
    // =====================================================================
    function lazyLoadImage(imgEl) {
        const imgUrl = imgEl.dataset.src;
        // Evita cargar si ya se está cargando o ya terminó
        if (!imgUrl || imgEl.dataset.loaded === 'true') return;

        imgEl.dataset.loaded = 'true'; // Marcar como cargando

        const preloader = new Image();

        preloader.addEventListener('load', function() {
            requestAnimationFrame(() => {
                imgEl.src = imgUrl;
                // Usar las dimensiones reales para mejorar el layout
                imgEl.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
                imgEl.style.objectFit = 'cover';
                imgEl.style.padding = '0';
                imgEl.classList.remove('is-loading');
            });
        });

        preloader.addEventListener('error', function() {
            requestAnimationFrame(() => {
                imgEl.alt = `Error al cargar portada para ${imgEl.title}`; 
                console.warn(`[ERROR IMAGEN] Lazy Load fallido para: ${imgEl.title}`);
                imgEl.classList.remove('is-loading'); 
            });
        });
        
        // Iniciar la carga de la imagen real
        preloader.src = imgUrl;
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
        imgEl.src = L_SVG; // Mantiene el spinner
        imgEl.alt = item.name;
        imgEl.title = item.name;
        imgEl.style.aspectRatio = A_RATIO; 
        
        // Almacenar URL real en data-src
        imgEl.dataset.src = imgUrl;

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
                : imgEl.dataset.src; 
                
            if (typeof window.abrirDetallesJuego === 'function') {
                window.abrirDetallesJuego(item.name, finalImgUrl, item.url);
            }
        });

        itemEl.appendChild(imgEl);
        itemEl.appendChild(titleEl);

        return itemEl;
    }

    // =====================================================================
    // MEJORA: Renderizado por Lotes (Batch Rendering) y Lazy Loading
    // =====================================================================
    function renderGrid(items, systemName, contentGridContainer, modalTitle) {
        const systemNameLower = systemName.toLowerCase();
        const BATCH_SIZE = 50; 
        let gridElementsLocal = [];

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
        contentGridContainer.appendChild(grid);
        
        // Función recursiva para el renderizado por lotes
        function processBatch(startIndex) {
            const endIndex = Math.min(startIndex + BATCH_SIZE, items.length);
            const fragment = document.createDocumentFragment();

            for (let i = startIndex; i < endIndex; i++) {
                const item = items[i];
                const itemEl = createGridItem(item, systemNameLower, i);
                fragment.appendChild(itemEl);
                gridElementsLocal.push(itemEl);
            }
            
            grid.appendChild(fragment);

            if (endIndex < items.length) {
                requestAnimationFrame(() => processBatch(endIndex));
            } else {
                // Renderizado completado: Actualizar la lista global y la selección
                if (window.gridItemsElements) window.gridItemsElements = gridElementsLocal;

                if (gridElementsLocal.length > 0 && typeof window.updateGridSelection === 'function') {
                    window.updateGridSelection(0, true, true, true);
                }
                
                // Inicializar Intersection Observer para Lazy Loading
                if ('IntersectionObserver' in window) {
                    // Cargar imágenes 1500px antes de que el elemento entre en la vista
                    const observer = new IntersectionObserver((entries, obs) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const imgEl = entry.target.querySelector('.grid-item-image');
                                if (imgEl) {
                                    lazyLoadImage(imgEl);
                                }
                                obs.unobserve(entry.target); 
                            }
                        });
                    }, {
                        root: null, 
                        rootMargin: '0px 0px 1500px 0px', // <--- CAMBIO CLAVE AQUÍ: Aumenta el margen inferior
                        threshold: 0
                    });
                    
                    // Observar todos los elementos del grid
                    gridElementsLocal.forEach(itemEl => observer.observe(itemEl));
                } else {
                    // Fallback para navegadores antiguos
                    console.warn('[ADVERTENCIA] IntersectionObserver no soportado. Cargando todas las imágenes.');
                    gridElementsLocal.forEach(itemEl => {
                        const imgEl = itemEl.querySelector('.grid-item-image');
                        if (imgEl) lazyLoadImage(imgEl);
                    });
                }
            }
        }

        // Iniciar el renderizado en el siguiente frame de animación
        requestAnimationFrame(() => processBatch(0));
    }
    // =====================================================================
    // FIN MEJORA
    // =====================================================================

    window.loadGameItems = loadGameItems;
    window.renderGrid = renderGrid;

})();
