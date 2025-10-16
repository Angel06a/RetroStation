// =========================================================================
// game-data-loader.js: Carga Asíncrona de Datos y Renderizado del Grid
//
// Dependencias:
// - utils.js (parseHyphenList, cleanGameName)
// - game-details-logic.js (abrirDetallesJuego)
// - game-grid-nav.js (updateGridSelection, gridItemsElements, isCenteringActive)
// =========================================================================

const gameDataCache = {};
const gameDirectory = "Games/";

/**
 * Carga el archivo .js del sistema seleccionado.
 */
function loadGameItems(systemName, callback) {
    if (gameDataCache[systemName]) {
        callback(gameDataCache[systemName]);
        return;
    }

    const scriptUrl = 'Games/' + systemName + '.js';
    const globalVarName = `currentGameListString`;
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptUrl;

    script.onload = () => {
        let items = [];
        const rawText = window[globalVarName];
        if (typeof rawText === 'string') {
            items = window.parseHyphenList(rawText);
            delete window[globalVarName];
        } else {
             console.warn(`[ADVERTENCIA] La variable global ${globalVarName} no se encontró...`);
        }

        gameDataCache[systemName] = items;
        callback(items);
        script.remove();
    };
    script.onerror = () => {
        console.error(`[ERROR] 🚨 No se pudo cargar el archivo: ${scriptUrl}.`);
        gameDataCache[systemName] = [];
        callback([]);
        script.remove();
    };
    document.head.appendChild(script);
}

/**
 * Renderiza el grid de juegos.
 * Se ha modificado para que la carga de imágenes sea asíncrona.
 */
function renderGrid(items, systemName, contentGridContainer, modalTitle) {
    const systemNameLower = systemName.toLowerCase();
    const imageExtensionWebP = ".webp";
    const loadingSvgUrl = "Icons/loading.svg";

    contentGridContainer.innerHTML = '';
    window.gridItemsElements = []; // Reiniciar la lista de elementos del grid (usada por game-grid-nav.js)

    if (!items || items.length === 0) {
        contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${modalTitle.textContent}.</p>`;
        window.currentGridIndex = 0;
        return;
    }

    const grid = document.createElement('ul');
    grid.classList.add('content-grid');
    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const itemElement = document.createElement('li');
        itemElement.classList.add('grid-item');

        const imageBaseName = item.name;
        const imageFileNameWithThumb = imageBaseName + "-thumb";
        const imageUrl = `${gameDirectory}${systemNameLower}/${imageFileNameWithThumb}${imageExtensionWebP}`;

        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = window.cleanGameName(item.name);

        // Crear el elemento de imagen placeholder con el SVG de carga.
        const imageElement = document.createElement('img');
        imageElement.classList.add('grid-item-image');
        imageElement.src = loadingSvgUrl; // Placeholder inicial
        imageElement.alt = item.name;
        imageElement.title = item.name;
        imageElement.classList.add('is-loading');

        // Lógica de precarga de imágenes para carga asíncrona
        const preloader = new Image();

        // 💡 Manejador cuando la imagen se carga exitosamente
        preloader.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;

            // Actualizar el elemento en el DOM con la imagen real
            imageElement.src = imageUrl;
            imageElement.style.aspectRatio = `${width} / ${height}`;
            imageElement.classList.remove('is-loading');
            imageElement.style.objectFit = 'cover';
            imageElement.style.padding = '0';
        };

        // 💡 Manejador si la carga de la imagen falla
        preloader.onerror = function() {
            // Mantener el placeholder o manejar el error visualmente
            imageElement.alt = `Error al cargar portada para ${item.name}`;
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
            imageElement.classList.remove('is-loading'); // Asegurar que el estado de carga se quite.
        };

        // Iniciar la carga de la imagen real (asíncrona)
        preloader.src = imageUrl;

        itemElement.addEventListener('click', () => {
            window.isCenteringActive = true;
            window.updateGridSelection(index, true, false, false);
            // Usar la URL de la imagen real si se cargó, de lo contrario, el placeholder.
            const finalImageUrl = imageElement.classList.contains('is-loading') ? loadingSvgUrl : imageUrl;
            window.abrirDetallesJuego(item.name, finalImageUrl, item.url);
        });

        itemElement.appendChild(imageElement); // Añadir el placeholder inmediatamente
        itemElement.appendChild(titleElement);

        fragment.appendChild(itemElement);
        window.gridItemsElements.push(itemElement);
    });

    grid.appendChild(fragment);
    contentGridContainer.appendChild(grid);

    // Seleccionar el primer elemento y forzar el centrado
    if (window.gridItemsElements.length > 0) {
        window.updateGridSelection(0, true, true, true);
    }
}

window.loadGameItems = loadGameItems;
window.renderGrid = renderGrid;