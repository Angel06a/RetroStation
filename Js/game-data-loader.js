// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos (OPTIMIZADO V2 CON WORKER BLOB REVISADO)
// =========================================================================

(function () {
    const dCache = {};
    const G_DIR = "Games/";
    const L_SVG = "Icons/loading.svg";
    const I_EXT_WEBP = ".webp";
    const A_RATIO = '16/9';
    const G_VAR_N = `currentGameListString`;

    // --- CÓDIGO DEL WORKER INLINADO EN STRING (Escaping revisado) ---
    // Usamos doble backslash (\\) para que el Worker reciba un solo backslash (\)
    const workerCode = `
        function parseHyphenList(rawText) {
            if (!rawText) return [];

            const items = [];
            // Regex con backslashes escapados: \\s* -> \s* en el Worker
            const urlRegex = /"([^"]*)"\\s*$/; 
            const lines = rawText.split('\\n'); // \n escapado: \\n -> \n en el Worker
            
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

        // Manejador de errores dentro del Worker (para capturar errores de sintaxis o ejecución)
        self.onerror = (e) => {
            console.error('Worker Error:', e.message, e.filename, e.lineno);
        };

        self.onmessage = function(event) {
            const { type, rawText } = event.data;

            if (type === 'PARSE_GAME_DATA') {
                try {
                    const parsedItems = parseHyphenList(rawText); 
                    self.postMessage({
                        type: 'PARSE_COMPLETE',
                        items: parsedItems
                    });
                } catch (error) {
                    console.error('Worker runtime error during parsing:', error);
                }
            }
        };
    `;
    // -----------------------------------------------------------------


    // --- INICIALIZACIÓN DEL WEB WORKER (vía Blob/URL) ---
    let dataParserWorker = null;
    if (window.Worker) {
        try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            dataParserWorker = new Worker(workerUrl); 
            console.log('✅ Worker inicializado con éxito usando Blob.');
            
            // Captura errores de comunicación o de inicio del Worker
            dataParserWorker.onerror = (e) => {
                console.error('🚨 Fallo de inicialización del Worker (Hilo Principal):', e);
                // Si falla en tiempo de ejecución, deshabilitamos el Worker para forzar el fallback
                dataParserWorker = null; 
            };
        } catch (e) {
            console.error('❌ Fallo CRÍTICO al inicializar Worker (Blob/URL).', e);
            dataParserWorker = null;
        }
    } else {
        console.warn('❌ window.Worker no está disponible en este navegador.');
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
                    // **RUTA PRINCIPAL: WEB WORKER**
                    dataParserWorker.onmessage = function(event) {
                        if (event.data.type === 'PARSE_COMPLETE') {
                            console.log('➡️ Datos recibidos del Worker. UI fluida.');
                            items = event.data.items;
                            completeProcessing(items);
                            dataParserWorker.onmessage = null; 
                        }
                    };
                    dataParserWorker.postMessage({ type: 'PARSE_GAME_DATA', rawText });
                    return; 
                } else if (window.parseHyphenList) {
                    // **RUTA SECUNDARIA: FALLBACK SÍNCRONO**
                    console.warn(`⚠️ Fallback al hilo principal. (Posible lag al cargar lista grande).`);
                    items = window.parseHyphenList(rawText);
                } else {
                     console.error(`🚨 Fallo total: No hay Worker ni función de parseo global.`);
                }
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${G_VAR_N} no se encontró.`);
            }
            
            // Si el Worker falló o no se usó, completamos el procesamiento aquí
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
