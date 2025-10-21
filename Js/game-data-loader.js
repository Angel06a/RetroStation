// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos (OPTIMIZADO PARA COMPATIBILIDAD MÓVIL CON BLOB WORKER)
// =========================================================================

(function () {
    const dCache = {};
    const G_DIR = "Games/";
    const L_SVG = "Icons/loading.svg";
    const I_EXT_WEBP = ".webp";
    const A_RATIO = '16/9';
    const G_VAR_N = `currentGameListString`;

    // --- CÓDIGO DEL WORKER INLINADO EN STRING (para máxima compatibilidad) ---
    const workerCode = `
        // Este código se ejecuta en el hilo del Worker.
        function parseHyphenList(rawText) {
            if (!rawText) return [];

            const items = [];
            const urlRegex = /"([^"]*)"\\s*$/; 
            const lines = rawText.split('\\n');
            
            for (const line of lines) {
                const trimmedLine = line.trim();

                if (!trimmedLine.startsWith('-')) continue;

                let content = trimmedLine.substring(1).trim(); 
                const match = content.match(urlRegex);

                let url = '';
                if (match && match[1]) {
                    url = match[1].trim();
                    content = content.replace(match[0], '').trim(); 
                }

                if (content) {
                    items.push({
                        title: content,
                        url: url
                    });
                }
            }
            return items;
        }

        self.onmessage = function(event) {
            const { type, rawText } = event.data;

            if (type === 'PARSE_GAME_DATA') {
                const parsedItems = parseHyphenList(rawText); 
                self.postMessage({
                    type: 'PARSE_COMPLETE',
                    items: parsedItems
                });
            }
        };
    `;
    // -------------------------------------------------------------------------


    // --- INICIALIZACIÓN DEL WEB WORKER (vía Blob/URL) ---
    let dataParserWorker = null;
    if (window.Worker) {
        try {
            // 1. Crea un Blob con el código del Worker
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            // 2. Crea una URL de Objeto para el Blob
            const workerUrl = URL.createObjectURL(blob);
            // 3. Inicializa el Worker
            dataParserWorker = new Worker(workerUrl); 
        } catch (e) {
            console.error('⚠️ CRÍTICO: Fallo al inicializar Worker usando Blob.', e);
            // dataParserWorker permanece en null, lo que forzará el fallback más abajo.
        }
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
                            // Limpia el onmessage después de su uso 
                            dataParserWorker.onmessage = null; 
                        }
                    };
                    dataParserWorker.postMessage({ type: 'PARSE_GAME_DATA', rawText });
                    return; // Salimos. La ejecución se reanudará en dataParserWorker.onmessage
                } else if (window.parseHyphenList) {
                    // FALLBACK (Si Worker no se pudo crear, usamos la función síncrona, debe ser una función global)
                    console.warn(`[ADVERTENCIA] Fallback al hilo principal.`);
                    items = window.parseHyphenList(rawText);
                } else {
                     console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró o no hay método de parseo.`);
                }
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró o no hay método de parseo.`);
            }
            
            // Si el Worker no se usó (por fallback), completamos el procesamiento aquí
            completeProcessing(items);
        };

        const completeProcessing = (items) => {
            if (window.hasOwnProperty(G_VAR_N)) {
                 try {
                     delete window[G_VAR_N];
                 } catch (e) { /* Ignoramos */ }
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

        const imageUrl = `Covers/${systemNameLower}/${item.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}${I_EXT_WEBP}`;

        const imageContainer = document.createElement('div');
        imageContainer.classList.add('grid-item-image-container');
        
        const img = document.createElement('img');
        img.classList.add('grid-item-image', 'is-loading');
        img.src = L_SVG; 
        img.alt = `Portada de ${item.title}`;
        img.setAttribute('loading', 'lazy'); 

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
                    requestAnimationFrame(() => {
                        img.src = imageUrl;
                        img.classList.remove('is-loading');
                    });
                });
            } else {
                 requestAnimationFrame(() => {
                    img.src = imageUrl;
                    img.classList.remove('is-loading');
                });
            }
        };

        actualImg.onerror = () => {
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

})();
