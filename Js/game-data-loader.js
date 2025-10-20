// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid
// =========================================================================

(function () {
    const gameDataCache = {};
    const GAME_DIRECTORY = "Games/";
    const LOADING_SVG_URL = "Icons/loading.svg";
    const IMAGE_EXTENSION_WEBP = ".webp";
    const DEFAULT_ASPECT_RATIO = '16/9';
    const GLOBAL_VAR_NAME = `currentGameListString`;

    function loadGameItems(systemName, callback) {
        if (gameDataCache[systemName]) {
            callback(gameDataCache[systemName]);
            return;
        }

        const scriptUrl = `${GAME_DIRECTORY}${systemName}.js`;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = scriptUrl;

        script.onload = () => {
            let items = [];
            const rawText = window[GLOBAL_VAR_NAME];

            if (typeof rawText === 'string' && window.parseHyphenList) {
                items = window.parseHyphenList(rawText);
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${GLOBAL_VAR_NAME} no se encontró o parseHyphenList no está disponible.`);
            }
            
            if (window.hasOwnProperty(GLOBAL_VAR_NAME)) {
                delete window[GLOBAL_VAR_NAME];
            }

            gameDataCache[systemName] = items;
            
            requestAnimationFrame(() => {
                callback(items);
                script.remove();
            });
        };

        script.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo de datos: ${scriptUrl}.`);
            gameDataCache[systemName] = [];
            
            setTimeout(() => {
                callback([]);
                script.remove();
            }, 0);
        };

        document.head.appendChild(script);
    }

    function createGridItem(item, systemNameLower, index) {
        
        const imageBaseName = item.name;
        const imageFileNameWithThumb = imageBaseName + "-thumb";
        const imageUrl = `${GAME_DIRECTORY}${systemNameLower}/${imageFileNameWithThumb}${IMAGE_EXTENSION_WEBP}`;
        const cleanName = window.cleanGameName ? window.cleanGameName(item.name) : item.name;

        const itemElement = document.createElement('li');
        itemElement.classList.add('grid-item');
        itemElement.dataset.index = index;

        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = cleanName;

        const imageElement = document.createElement('img');
        imageElement.classList.add('grid-item-image', 'is-loading'); 
        imageElement.src = LOADING_SVG_URL;
        imageElement.alt = item.name;
        imageElement.title = item.name;
        imageElement.style.aspectRatio = DEFAULT_ASPECT_RATIO; 

        const preloader = new Image();

        preloader.addEventListener('load', function() {
            imageElement.src = imageUrl;
            imageElement.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
            imageElement.style.objectFit = 'cover';
            imageElement.style.padding = '0';
            imageElement.classList.remove('is-loading');
        });

        preloader.addEventListener('error', function() {
            imageElement.alt = `Error al cargar portada para ${item.name}`;
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
            imageElement.classList.remove('is-loading'); 
        });

        preloader.src = imageUrl;

        itemElement.addEventListener('click', () => {
            const clickIndex = parseInt(itemElement.dataset.index, 10);
            
            if (window.isCenteringActive !== undefined) window.isCenteringActive = true;
            if (typeof window.updateGridSelection === 'function') {
                window.updateGridSelection(clickIndex, true, false, false);
            }

            const finalImageUrl = imageElement.classList.contains('is-loading') 
                ? LOADING_SVG_URL 
                : imageUrl;
                
            if (typeof window.abrirDetallesJuego === 'function') {
                window.abrirDetallesJuego(item.name, finalImageUrl, item.url);
            }
        });

        itemElement.appendChild(imageElement);
        itemElement.appendChild(titleElement);

        return itemElement;
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
            const itemElement = createGridItem(item, systemNameLower, index);
            fragment.appendChild(itemElement);
            gridElementsLocal.push(itemElement);
        });
        
        grid.appendChild(fragment);
        contentGridContainer.appendChild(grid);
        
        if (window.gridItemsElements) window.gridItemsElements = gridElementsLocal;

        if (gridElementsLocal.length > 0 && typeof window.updateGridSelection === 'function') {
            window.updateGridSelection(0, true, true, true);
        }
    }

    window.loadGameItems = loadGameItems;
    window.renderGrid = renderGrid;

})();