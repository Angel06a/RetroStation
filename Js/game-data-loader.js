// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid
//
// Dependencias Globales (asumidas):
// - window.parseHyphenList (de utils.js)
// - window.cleanGameName (de utils.js)
// - window.abrirDetallesJuego (de game-details-logic.js)
// - window.updateGridSelection (de game-grid-nav.js)
// - window.gridItemsElements (de game-grid-nav.js)
// - window.isCenteringActive (de game-grid-nav.js)
// - window.currentGridIndex (de game-grid-nav.js)
//
// Optimizaciones: Encapsulamiento con IIFE y consolidación de constantes.
// =========================================================================

(function () { // Inicio del IIFE para encapsulamiento

    // =========================================================================
    // 1. CONFIGURACIÓN Y CACHÉ
    // =========================================================================

    /** @type {Object<string, Array<Object>>} Cache para los datos de los juegos cargados. */
    const gameDataCache = {};

    /** @type {string} Directorio base para los archivos de juegos y assets. */
    const GAME_DIRECTORY = "Games/";

    /** @type {string} URL del ícono de carga SVG. */
    const LOADING_SVG_URL = "Icons/loading.svg";

    /** @type {string} Extensión de la imagen de portada. (Consolidada) */
    const IMAGE_EXTENSION_WEBP = ".webp";

    /** @type {string} Aspect ratio por defecto para el placeholder. (16:9 Solicitado) */
    const DEFAULT_ASPECT_RATIO = '16/9'; 

    // =========================================================================
    // 2. LÓGICA DE CARGA DE DATOS (loadGameItems)
    // =========================================================================

    /**
     * Carga asíncronamente el archivo de datos (.js) para el sistema seleccionado
     * mediante inyección de script (compatible con file://) y parsea la lista.
     * Utiliza caché.
     *
     * @param {string} systemName - El nombre del sistema (ej: 'NES').
     * @param {function(Array<Object>)} callback - Función a ejecutar con la lista de juegos cargada.
     */
    function loadGameItems(systemName, callback) {
        if (gameDataCache[systemName]) {
            callback(gameDataCache[systemName]);
            return;
        }

        const scriptUrl = `${GAME_DIRECTORY}${systemName}.js`;
        const globalVarName = `currentGameListString`;
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = scriptUrl;

        script.onload = () => {
            let items = [];
            const rawText = window[globalVarName];

            if (typeof rawText === 'string' && window.parseHyphenList) {
                items = window.parseHyphenList(rawText);
                delete window[globalVarName];
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${globalVarName} no se encontró o parseHyphenList no está disponible.`);
            }

            gameDataCache[systemName] = items;
            callback(items);
            script.remove();
        };

        script.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo de datos: ${scriptUrl}.`);
            gameDataCache[systemName] = [];
            callback([]);
            script.remove();
        };

        document.head.appendChild(script);
    }

    // =========================================================================
    // 3. LÓGICA DE RENDERIZADO DEL ITEM INDIVIDUAL (createGridItem)
    // =========================================================================

    /**
     * Crea y configura un único elemento 'grid-item' con carga de imagen asíncrona.
     *
     * @param {Object} item - Los datos del juego (name, url, etc.).
     * @param {string} systemNameLower - El nombre del sistema en minúsculas.
     * @param {number} index - El índice del ítem en la lista.
     * @returns {HTMLLIElement} El elemento de la lista (li) del grid.
     */
    function createGridItem(item, systemNameLower, index) {
        
        const imageBaseName = item.name;
        const imageFileNameWithThumb = imageBaseName + "-thumb";
        const imageUrl = `${GAME_DIRECTORY}${systemNameLower}/${imageFileNameWithThumb}${IMAGE_EXTENSION_WEBP}`;
        const cleanName = window.cleanGameName ? window.cleanGameName(item.name) : item.name;

        // --- Elemento Principal ---
        const itemElement = document.createElement('li');
        itemElement.classList.add('grid-item');
        itemElement.dataset.index = index; // Almacenamos el índice en el dataset

        // --- Título ---
        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = cleanName;

        // --- Imagen (Placeholder inicial) ---
        const imageElement = document.createElement('img');
        // Unimos la adición de clases para ser más concisos
        imageElement.classList.add('grid-item-image', 'is-loading'); 
        imageElement.src = LOADING_SVG_URL;
        imageElement.alt = item.name;
        imageElement.title = item.name;
        // Aplicamos el aspect ratio de 16:9
        imageElement.style.aspectRatio = DEFAULT_ASPECT_RATIO; 

        // --- Lógica de Carga Asíncrona (Preloader) ---
        const preloader = new Image();

        preloader.onload = function() {
            // La imagen real se cargó
            imageElement.src = imageUrl;
            // Ajustar al aspect ratio real
            imageElement.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
            imageElement.style.objectFit = 'cover';
            imageElement.style.padding = '0';
            imageElement.classList.remove('is-loading');
        };

        preloader.onerror = function() {
            // La imagen real falló al cargar
            imageElement.alt = `Error al cargar portada para ${item.name}`;
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
            imageElement.classList.remove('is-loading'); 
        };

        // Iniciar la carga de la imagen real
        preloader.src = imageUrl;

        // --- Manejador de Eventos (Click) ---
        itemElement.addEventListener('click', () => {
            // Usamos el índice del dataset/closure para la navegación
            const clickIndex = parseInt(itemElement.dataset.index);
            
            window.isCenteringActive = true;
            window.updateGridSelection(clickIndex, true, false, false);

            // Determinar la URL de la imagen a mostrar en el detalle
            const finalImageUrl = imageElement.classList.contains('is-loading') 
                ? LOADING_SVG_URL 
                : imageUrl;
                
            window.abrirDetallesJuego(item.name, finalImageUrl, item.url);
        });

        // --- Ensamblaje ---
        itemElement.appendChild(imageElement);
        itemElement.appendChild(titleElement);

        return itemElement;
    }

    // =========================================================================
    // 4. LÓGICA DE RENDERIZADO DEL GRID COMPLETO (renderGrid)
    // =========================================================================

    /**
     * Renderiza el grid completo de juegos en el contenedor especificado.
     *
     * @param {Array<Object>} items - La lista de juegos a renderizar.
     * @param {string} systemName - El nombre del sistema.
     * @param {HTMLElement} contentGridContainer - El contenedor donde se insertará el grid.
     * @param {HTMLElement} modalTitle - El elemento de título para mensajes de error.
     */
    function renderGrid(items, systemName, contentGridContainer, modalTitle) {
        const systemNameLower = systemName.toLowerCase();

        // 1. Limpieza y manejo de datos vacíos
        contentGridContainer.innerHTML = '';
        window.gridItemsElements = []; 

        if (!items || items.length === 0) {
            const systemTitle = modalTitle ? modalTitle.textContent : systemName;
            contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${systemTitle}.</p>`;
            window.currentGridIndex = 0;
            return;
        }

        // 2. Creación del Grid y Fragmento
        const grid = document.createElement('ul');
        grid.classList.add('content-grid');
        const fragment = document.createDocumentFragment();

        // 3. Iteración y Creación de Items
        items.forEach((item, index) => {
            const itemElement = createGridItem(item, systemNameLower, index);
            fragment.appendChild(itemElement);
            window.gridItemsElements.push(itemElement);
        });

        // 4. Inserción en el DOM
        grid.appendChild(fragment);
        contentGridContainer.appendChild(grid);

        // 5. Inicialización de Navegación
        if (window.gridItemsElements.length > 0 && window.updateGridSelection) {
            window.updateGridSelection(0, true, true, true);
        }
    }

    // =========================================================================
    // 5. EXPORTACIÓN GLOBAL
    // =========================================================================

    // Exponer las funciones principales para su uso por otros módulos
    window.loadGameItems = loadGameItems;
    window.renderGrid = renderGrid;

})(); // Fin del IIFE