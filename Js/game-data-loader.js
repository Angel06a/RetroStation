// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid
//
// OPTIMIZACIÓN:
// - Uso de 'const' y 'let' estricto para mejor scoping.
// - Creación de elementos DOM más concisa y eficiente.
// - Consolidación de la lógica de carga de imagen asíncrona.
// - Manejo de la variable global de carga (globalVarName) con eliminación forzada.
//
// Dependencias Globales (asumidas):
// - window.parseHyphenList (de utils.js)
// - window.cleanGameName (de utils.js)
// - window.abrirDetallesJuego (de game-details-logic.js)
// - window.updateGridSelection, window.gridItemsElements, window.isCenteringActive, window.currentGridIndex (de game-grid-nav.js)
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

    /** @type {string} Extensión de la imagen de portada. */
    const IMAGE_EXTENSION_WEBP = ".webp";

    /** @type {string} Aspect ratio por defecto para el placeholder. (16:9 Solicitado) */
    const DEFAULT_ASPECT_RATIO = '16/9';

    // Se mantiene la variable global de carga ya que el patrón del proyecto depende de ella.
    const GLOBAL_VAR_NAME = `currentGameListString`;

    // =========================================================================
    // 2. LÓGICA DE CARGA DE DATOS (loadGameItems)
    // =========================================================================

    /**
     * Carga asíncronamente el archivo de datos (.js) para el sistema seleccionado
     * mediante inyección de script y parsea la lista.
     *
     * @param {string} systemName - El nombre del sistema (ej: 'NES').
     * @param {function(Array<Object>)} callback - Función a ejecutar con la lista de juegos cargada.
     */
    function loadGameItems(systemName, callback) {
        if (gameDataCache[systemName]) {
            // Optimización: Retorno rápido si está en caché.
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
                // Optimización: Uso de parseHyphenList
                items = window.parseHyphenList(rawText);
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${GLOBAL_VAR_NAME} no se encontró o parseHyphenList no está disponible.`);
            }
            
            // CRÍTICO: Eliminar la variable global inmediatamente después de usarla para evitar fugas.
            if (window.hasOwnProperty(GLOBAL_VAR_NAME)) {
                delete window[GLOBAL_VAR_NAME];
            }

            gameDataCache[systemName] = items;
            callback(items);
            script.remove(); // Limpieza del DOM
        };

        script.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo de datos: ${scriptUrl}.`);
            gameDataCache[systemName] = [];
            callback([]);
            script.remove(); // Limpieza del DOM
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
        // Uso de ternario para fallback más limpio
        const cleanName = window.cleanGameName ? window.cleanGameName(item.name) : item.name;

        // --- Elemento Principal ---
        const itemElement = document.createElement('li');
        // Optimización: Uso de múltiples clases en add()
        itemElement.classList.add('grid-item');
        itemElement.dataset.index = index;

        // --- Título ---
        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = cleanName;

        // --- Imagen (Placeholder inicial) ---
        const imageElement = document.createElement('img');
        // Optimización: Uso de múltiples clases en add()
        imageElement.classList.add('grid-item-image', 'is-loading'); 
        imageElement.src = LOADING_SVG_URL;
        imageElement.alt = item.name;
        imageElement.title = item.name;
        imageElement.style.aspectRatio = DEFAULT_ASPECT_RATIO; 

        // --- Lógica de Carga Asíncrona (Preloader) ---
        const preloader = new Image();

        preloader.addEventListener('load', function() {
            // La imagen real se cargó
            imageElement.src = imageUrl;
            // Asegurar la remoción del estilo temporal y ajuste del aspecto real
            imageElement.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
            imageElement.style.objectFit = 'cover';
            imageElement.style.padding = '0';
            imageElement.classList.remove('is-loading');
        });

        preloader.addEventListener('error', function() {
            // La imagen real falló al cargar
            imageElement.alt = `Error al cargar portada para ${item.name}`;
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
            imageElement.classList.remove('is-loading'); 
        });

        // Iniciar la carga de la imagen real
        preloader.src = imageUrl;

        // --- Manejador de Eventos (Click) ---
        itemElement.addEventListener('click', () => {
            const clickIndex = parseInt(itemElement.dataset.index, 10);
            
            // Asumiendo que estas son globales de game-grid-nav.js
            if (window.isCenteringActive !== undefined) window.isCenteringActive = true;
            if (typeof window.updateGridSelection === 'function') {
                window.updateGridSelection(clickIndex, true, false, false);
            }

            // Determinar la URL de la imagen a mostrar en el detalle
            const finalImageUrl = imageElement.classList.contains('is-loading') 
                ? LOADING_SVG_URL 
                : imageUrl;
                
            if (typeof window.abrirDetallesJuego === 'function') {
                window.abrirDetallesJuego(item.name, finalImageUrl, item.url);
            }
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
        // Inicializar la variable global de elementos del grid si existe
        if (window.gridItemsElements) window.gridItemsElements = []; 

        if (!items || items.length === 0) {
            const systemTitle = modalTitle ? modalTitle.textContent : systemName;
            contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${systemTitle}.</p>`;
            if (window.currentGridIndex !== undefined) window.currentGridIndex = 0;
            return;
        }

        // 2. Creación del Grid y Fragmento (Optimización: Uso de DocumentFragment)
        const grid = document.createElement('ul');
        grid.classList.add('content-grid');
        const fragment = document.createDocumentFragment();

        // Uso de 'let' para la variable local que acumula elementos
        let gridElementsLocal = [];

        // 3. Iteración y Creación de Items
        // Optimización: Iteración con forEach para evitar bucle for...of/in manual
        items.forEach((item, index) => {
            const itemElement = createGridItem(item, systemNameLower, index);
            fragment.appendChild(itemElement);
            gridElementsLocal.push(itemElement);
        });
        
        // 4. Inserción en el DOM (Solo un reflow/repaint)
        grid.appendChild(fragment);
        contentGridContainer.appendChild(grid);
        
        // 5. Asignación a la variable global para la navegación
        if (window.gridItemsElements) window.gridItemsElements = gridElementsLocal;

        // 6. Inicialización de Navegación
        if (gridElementsLocal.length > 0 && typeof window.updateGridSelection === 'function') {
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