// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid
//
// 🚀 OPTIMIZACIÓN MÁXIMA: 
// 1. Uso de DocumentFragment para inyección masiva al DOM.
// 2. Encapsulación de lógica de creación/carga de imágenes.
// 3. Manejo explícito del aspect ratio y clases de carga.
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

    /** @type {string} Aspect ratio por defecto para el placeholder (16:9). */
    const DEFAULT_ASPECT_RATIO = '16/9'; 

    // =========================================================================
    // 2. LÓGICA DE CARGA DE DATOS (loadGameItems)
    // =========================================================================

    /**
     * Carga asíncronamente el archivo de datos para el sistema seleccionado.
     * @param {string} systemName - El nombre del sistema (ej: 'NES').
     * @param {function(Array<Object>)} callback - Función a ejecutar con la lista de juegos.
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
            // 🚀 OPTIMIZACIÓN: Remoción inmediata para liberar memoria.
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
     * Gestiona la carga y actualización de la imagen de un ítem.
     * @param {HTMLImageElement} imageElement - El elemento <img> a actualizar.
     * @param {string} imageUrl - La URL de la imagen real.
     * @param {string} fallbackAlt - Texto alternativo de fallback.
     */
    function loadOptimizedImage(imageElement, imageUrl, fallbackAlt) {
        // 🚀 OPTIMIZACIÓN: Usar un objeto Image para precarga sin impacto en el DOM.
        const preloader = new Image();

        preloader.onload = function() {
            // Se usa requestAnimationFrame para asegurar que el DOM se actualice en el frame óptimo
            // (Mínimo impacto en el Main Thread durante el scroll/renderizado)
            requestAnimationFrame(() => {
                imageElement.src = imageUrl;
                imageElement.alt = fallbackAlt;
                // 🚀 OPTIMIZACIÓN: Aplicar el aspect ratio real y estilos
                imageElement.style.aspectRatio = `${this.naturalWidth} / ${this.naturalHeight}`;
                imageElement.style.objectFit = 'cover';
                imageElement.style.padding = '0';
                imageElement.classList.remove('is-loading');
            });
        };

        preloader.onerror = function() {
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${fallbackAlt}.`);
            // Se mantiene el LOADING_SVG_URL o el placeholder si no hay imagen
            imageElement.alt = `Error al cargar portada para ${fallbackAlt}`;
            imageElement.classList.remove('is-loading'); 
        };

        // Iniciar la carga de la imagen real
        preloader.src = imageUrl;
    }

    /**
     * Crea y configura un único elemento 'grid-item'.
     * @param {Object} item - Los datos del juego (name, url, etc.).
     * @param {string} systemNameLower - El nombre del sistema en minúsculas.
     * @param {number} index - El índice del ítem en la lista.
     * @returns {HTMLLIElement} El elemento de la lista (li) del grid.
     */
    function createGridItem(item, systemNameLower, index) {
        
        const imageBaseName = item.name;
        const imageFileNameWithThumb = imageBaseName + "-thumb";
        const imageUrl = `${GAME_DIRECTORY}${systemNameLower}/${imageFileNameWithThumb}${IMAGE_EXTENSION_WEBP}`;
        // 🚀 OPTIMIZACIÓN: Usar el ternario para concisión.
        const cleanName = window.cleanGameName ? window.cleanGameName(item.name) : item.name;

        // --- Elemento Principal y Atributos ---
        const itemElement = document.createElement('li');
        itemElement.classList.add('grid-item');
        itemElement.dataset.index = index; 

        // --- Título ---
        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = cleanName;

        // --- Imagen (Placeholder inicial) ---
        const imageElement = document.createElement('img');
        imageElement.classList.add('grid-item-image', 'is-loading'); 
        imageElement.src = LOADING_SVG_URL;
        imageElement.alt = item.name;
        imageElement.title = item.name;
        imageElement.style.aspectRatio = DEFAULT_ASPECT_RATIO; 

        // Iniciar la carga asíncrona y optimizada de la imagen
        loadOptimizedImage(imageElement, imageUrl, item.name);

        // --- Manejador de Eventos (Click) ---
        itemElement.addEventListener('click', () => {
            const clickIndex = parseInt(itemElement.dataset.index);
            
            // 🚀 OPTIMIZACIÓN: Evitar buscar la imagen real, ya que loadOptimizedImage la gestiona.
            // La URL inicial es LOADING_SVG_URL, la real es imageUrl. Si tiene 'is-loading' 
            // la URL es el placeholder, si no, es la real (o el placeholder si falló).
            const isImageLoaded = !imageElement.classList.contains('is-loading');
            const finalImageUrl = isImageLoaded ? imageUrl : LOADING_SVG_URL;
                
            window.isCenteringActive = true;
            window.updateGridSelection(clickIndex, true, false, false);
            window.abrirDetallesJuego(item.name, finalImageUrl, item.url);
        });

        // --- Ensamblaje (Conciso) ---
        itemElement.append(imageElement, titleElement);

        return itemElement;
    }

    // =========================================================================
    // 4. LÓGICA DE RENDERIZADO DEL GRID COMPLETO (renderGrid)
    // =========================================================================

    /**
     * Renderiza el grid completo de juegos en el contenedor especificado.
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
        // 🚀 OPTIMIZACIÓN CRÍTICA: DocumentFragment reduce el reflow y repaint.
        const fragment = document.createDocumentFragment();

        // 3. Iteración y Creación de Items
        items.forEach((item, index) => {
            const itemElement = createGridItem(item, systemNameLower, index);
            fragment.appendChild(itemElement);
            window.gridItemsElements.push(itemElement);
        });

        // 4. Inserción en el DOM (Una sola operación de inyección)
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
