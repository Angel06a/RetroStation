// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid (Worker Integrado)
// =========================================================================

(function () {
    const dCache = {};
    const G_DIR = "Games/";
    const L_SVG = "Icons/loading.svg";
    const I_EXT_WEBP = ".webp";
    const A_RATIO = '16/9';
    const G_VAR_N = `currentGameListString`;
    
    // --- INICIALIZACIÓN DEL WEB WORKER ---
    let dataParserWorker = null;
    if (window.Worker) {
        // Inicializa el Worker que vive en el nuevo archivo: worker-data-parser.js
        dataParserWorker = new Worker('./Js/worker-data-parser.js'); 
    }
    // -----------------------------------------------------------------


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
            let items = [];
            const rawText = window[G_VAR_N];

            if (typeof rawText === 'string') {
                if (dataParserWorker) {
                    // **USO DEL WORKER**: Envía el texto crudo para procesamiento asíncrono
                    dataParserWorker.onmessage = function(event) {
                        if (event.data.type === 'PARSE_COMPLETE') {
                            items = event.data.items;
                            completeProcessing(items);
                            // Limpia el onmessage después de su uso (evita múltiples llamadas)
                            dataParserWorker.onmessage = null; 
                        }
                    };
                    dataParserWorker.postMessage({ type: 'PARSE_GAME_DATA', rawText });
                    return; // Importante: Salimos, la ejecución se reanudará en dataParserWorker.onmessage
                } else if (window.parseHyphenList) {
                    // FALLBACK (Si Worker no está disponible, ej. IE o configuración estricta)
                    console.warn(`[ADVERTENCIA] Web Workers no soportados. Usando parseHyphenList en hilo principal.`);
                    items = window.parseHyphenList(rawText);
                } else {
                     console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró o no hay método de parseo.`);
                }
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró o no hay método de parseo.`);
            }
            
            // Si el Worker no se usó (solo por fallback), completamos el procesamiento aquí
            completeProcessing(items);
        };

        const completeProcessing = (items) => {
            if (window.hasOwnProperty(G_VAR_N)) {
                 try {
                     delete window[G_VAR_N];
                 } catch (e) { /* En navegadores estrictos esto falla. Ignoramos */ }
            }

            if (script.parentNode) script.parentNode.removeChild(script);

            dCache[systemName] = items;
            callback(items);
        };

        script.onload = () => processData(script);
        script.onerror = (e) => {
            console.error(`[ERROR] Fallo al cargar script de datos: ${scriptUrl}`, e);
            processData(script); 
        };

        document.head.appendChild(script);
    }

    function createGridItem(item, systemNameLower, index) {
        const itemEl = document.createElement('li');
        itemEl.classList.add('grid-item');
        itemEl.setAttribute('role', 'gridcell');
        itemEl.setAttribute('tabindex', index === 0 ? '0' : '-1');
        itemEl.setAttribute('data-index', index);
        itemEl.setAttribute('aria-label', item.title);
        itemEl.setAttribute('data-url', item.url);
        itemEl.setAttribute('data-title', item.title);

        // Prepara la URL de la imagen
        const imageUrl = `Covers/${systemNameLower}/${item.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}${I_EXT_WEBP}`;

        // Contenedor de la imagen (para mantener el aspect ratio en el layout)
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('grid-item-image-container');
        
        const img = document.createElement('img');
        img.classList.add('grid-item-image', 'is-loading');
        img.src = L_SVG; // Muestra el SVG de carga inicialmente
        img.alt = `Portada de ${item.title}`;
        img.setAttribute('loading', 'lazy'); // 👈 Optimizamos la carga de imágenes aquí

        // Usa decode para cargar la imagen en un hilo secundario
        const actualImg = new Image();
        actualImg.src = imageUrl;

        actualImg.onload = () => {
            if ('decode' in actualImg) {
                actualImg.decode().then(() => {
                    requestAnimationFrame(() => {
                        img.src = imageUrl;
                        img.classList.remove('is-loading');
                    });
                }).catch(() => {
                    // Fallback si decode falla
                    requestAnimationFrame(() => {
                        img.src = imageUrl;
                        img.classList.remove('is-loading');
                    });
                });
            } else {
                 // Fallback para navegadores antiguos
                 requestAnimationFrame(() => {
                    img.src = imageUrl;
                    img.classList.remove('is-loading');
                });
            }
        };

        actualImg.onerror = () => {
             // Fallback a la imagen de loading si la portada falla
             console.warn(`Fallo al cargar la portada: ${imageUrl}`);
        };

        imageContainer.appendChild(img);

        const titleEl = document.createElement('p');
        titleEl.classList.add('grid-item-title');
        titleEl.textContent = item.title;

        itemEl.appendChild(imageContainer);
        itemEl.appendChild(titleEl);

        return itemEl;
    }

    function renderGameGrid(items, systemName, systemNameLower, modalTitle) {
        const contentGridContainer = document.getElementById('content-grid-container');
        if (!contentGridContainer) return;

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
    window.renderGameGrid = renderGameGrid;
    // No exponemos createGridItem globalmente si no es estrictamente necesario.

})();
