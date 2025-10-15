// =========================================================================
// MODAL_LOGIC.JS: Lógica de Modales (Principal y Detalles) y Grid de Juegos
// SE ELIMINA 'import' y 'export'
// =========================================================================
// Las funciones 'parseHyphenList', 'cleanGameName', 'getGridColumns' y 'abrirModal' 
// ahora están en el ámbito global.

// --- Variables Globales del Modal ---
const gameDataCache = {};
let currentGridIndex = 0;
let gridItemsElements = [];
let gridNavLock = false; 
const GRID_NAV_DELAY_MS = 150; 
let inputLock = false; 
let centeringCheckIntervalId = null;
let isCenteringActive = false; 
let isProgrammaticScrolling = false;
const CENTERING_MARGIN_PX = 100;

// ... (El resto de las variables se mantienen igual) ...
const imageDirectory = "Sistemas/"; 
const imageExtension = ".svg";
const backgroundDirectory = "Fondos/";
const backgroundExtension = ".jpg";
const gameDirectory = "Games/"; 

// --- Referencias de DOM (Se inicializan en DOMContentLoaded) ---
let modalOverlay;
let modalHeader;
// ... (El resto de las referencias se mantienen igual) ...
let modalCloseButton;
let modalImage;
let modalTitle;
let contentGridContainer;
let modalBody;
let gameDetailsOverlay;
let gameDetailsCloseButton;
let gameDetailsImage;
let gameDetailsTitle;
let downloadButton;
let menuItemsRef; 

// Variables de Animación de Scroll
let scrollObjetivo = 0;
let scrollActual = 0;
const factorSuavizadoScroll = 0.2;
let animacionScrollFrameId = null;


// Función de Bucle de Animación de Scroll del Grid
function animarScrollGrid() {
    // ... (cuerpo de la función animarScrollGrid se mantiene igual) ...
    const diferenciaScroll = scrollObjetivo - scrollActual;
    
    if (Math.abs(diferenciaScroll) < 1) {
        scrollActual = scrollObjetivo;
        
        if (animacionScrollFrameId) {
             cancelAnimationFrame(animacionScrollFrameId);
             animacionScrollFrameId = null;
        }
        
        isProgrammaticScrolling = false; 
    } else {
        scrollActual += diferenciaScroll * factorSuavizadoScroll;
        animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
    }
    
    modalBody.scrollTop = scrollActual;
}


// FUNCIÓN CORREGIDA: Actualiza la selección y opcionalmente fuerza el scroll.
function updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) { // <--- Ya no es 'export function'
    // ... (cuerpo de la función updateGridSelection se mantiene igual) ...
    if (gridItemsElements.length === 0) return;
    
    const oldIndex = currentGridIndex;
    
    if (oldIndex !== null && gridItemsElements[oldIndex]) {
        gridItemsElements[oldIndex].classList.remove('selected');
    }

    currentGridIndex = newIndex;

    const selectedElement = gridItemsElements[currentGridIndex];
    selectedElement.classList.add('selected');

    if (!forceScroll) return;
    
    let isHorizontalMovement = false;
    
    if (!isResizeOrInitialLoad && !ignoreHorizontalCheck) { 
        if (oldIndex !== null) {
            const currentColumns = getGridColumns();
            if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
                isHorizontalMovement = true;
            }
        }
    }
    
    if (isHorizontalMovement) {
        return;
    }
    
    const viewportHeight = modalBody.clientHeight;
    const currentColumns = getGridColumns();
    const rowIndex = Math.floor(currentGridIndex / currentColumns);
    const rowStartIndex = rowIndex * currentColumns;
    const rowEndIndex = Math.min((rowIndex + 1) * currentColumns, gridItemsElements.length);
    
    let maxHeight = 0;

    for (let i = rowStartIndex; i < rowEndIndex; i++) {
        const item = gridItemsElements[i];
        if (item.offsetHeight > maxHeight) {
            maxHeight = item.offsetHeight;
        }
    }

    const rowStartElement = gridItemsElements[rowStartIndex];
    
    const elementRect = rowStartElement.getBoundingClientRect();
    const containerRect = modalBody.getBoundingClientRect();
    
    const elementTopInScroll = elementRect.top - containerRect.top + modalBody.scrollTop;
    
    const offsetToCenter = (viewportHeight - maxHeight) / 2;
    
    scrollObjetivo = elementTopInScroll - offsetToCenter; 

    scrollObjetivo = Math.max(0, scrollObjetivo);
    scrollObjetivo = Math.min(scrollObjetivo, modalBody.scrollHeight - viewportHeight);


    const SCROLL_TOLERANCE_PX = 2;
    const scrollDifference = Math.abs(scrollObjetivo - modalBody.scrollTop);
    
    if (scrollDifference < SCROLL_TOLERANCE_PX) {
        if (animacionScrollFrameId) {
            cancelAnimationFrame(animacionScrollFrameId);
            animacionScrollFrameId = null;
            isProgrammaticScrolling = false; 
        }
        return; 
    }

    if (animacionScrollFrameId === null) {
        scrollActual = modalBody.scrollTop;
    }
    
    if (animacionScrollFrameId === null) {
        isProgrammaticScrolling = true; 
        animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
    }
}


// FUNCIÓN DE VERIFICACIÓN Y CENTRADO PERIÓDICO
function checkAndRecenterGridSelection() {
    // ... (cuerpo de la función checkAndRecenterGridSelection se mantiene igual) ...
    if (!modalBody || gridItemsElements.length === 0 || !modalOverlay.classList.contains('open') || gameDetailsOverlay.classList.contains('open')) {
        return; 
    }
    
    if (!isCenteringActive) { 
         return; 
    }


    const selectedElement = gridItemsElements[currentGridIndex];
    if (!selectedElement) return;

    const viewportHeight = modalBody.clientHeight;
    
    const elementRect = selectedElement.getBoundingClientRect();
    const containerRect = modalBody.getBoundingClientRect();
    
    const elementTopInViewport = elementRect.top - containerRect.top;
    const elementBottomInViewport = elementRect.bottom - containerRect.top;
    
    const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
    const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
    const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;
    

    if (isTooHigh || isTooLow || isOutOfView) {
        updateGridSelection(currentGridIndex, true, true, true); 
    }
}


function loadGameItems(systemName, callback) {
    // ... (cuerpo de la función loadGameItems se mantiene igual) ...
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
            items = parseHyphenList(rawText); // <--- Llamada a función global
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

function abrirDetallesJuego(gameName, imageUrl, downloadUrl) {
    // ... (cuerpo de la función abrirDetallesJuego se mantiene igual) ...
    console.log(`-> Abriendo detalles del juego: ${gameName}`);
    
    gameDetailsImage.src = imageUrl;
    gameDetailsImage.alt = gameName;
    gameDetailsTitle.textContent = gameName; 

    if (downloadUrl) {
        downloadButton.textContent = 'Descargar Juego';
        downloadButton.disabled = false;
        downloadButton.onclick = () => window.open(downloadUrl, '_blank'); 
    } else {
        downloadButton.textContent = 'No disponible';
        downloadButton.disabled = true;
        downloadButton.onclick = null; 
    }
    
    gameDetailsOverlay.style.display = 'flex';
    void gameDetailsOverlay.offsetWidth; 
    gameDetailsOverlay.classList.add('open');
    
    const tempImg = new Image();
    tempImg.onload = function() {
        const width = this.naturalWidth;
        const height = this.naturalHeight;
        gameDetailsImage.style.aspectRatio = `${width} / ${height}`;
    }
    tempImg.src = imageUrl;
}


function renderGrid(items, systemName) {
    // ... (cuerpo de la función renderGrid se mantiene igual) ...
    const systemNameLower = systemName.toLowerCase(); 
    const imageExtensionWebP = ".webp"; 
    const loadingSvgUrl = "Icons/loading.svg";

    contentGridContainer.innerHTML = '';
    
    if (!items || items.length === 0) {
        contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${modalTitle.textContent}.</p>`;
        gridItemsElements = [];
        currentGridIndex = 0;
        return;
    }
    
    const grid = document.createElement('ul');
    grid.classList.add('content-grid');
    const fragment = document.createDocumentFragment();

    gridItemsElements = [];
    currentGridIndex = 0;


    items.forEach((item, index) => {
        const itemElement = document.createElement('li');
        itemElement.classList.add('grid-item');
        
        const imageBaseName = item.name; 
        const imageFileNameWithThumb = imageBaseName + "-thumb";
        const imageUrl = `${gameDirectory}${systemNameLower}/${imageFileNameWithThumb}${imageExtensionWebP}`;
        
        const imageElement = document.createElement('img');
        imageElement.classList.add('grid-item-image');
        
        imageElement.src = loadingSvgUrl;
        imageElement.alt = item.name;
        imageElement.title = item.name;
        imageElement.classList.add('is-loading');

        
        const preloader = new Image();
        
        preloader.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;
            
            imageElement.src = imageUrl;
            imageElement.style.aspectRatio = `${width} / ${height}`;
            
            imageElement.classList.remove('is-loading');
            imageElement.style.objectFit = 'cover'; 
            imageElement.style.padding = '0';
        };
        
        preloader.onerror = function() {
            imageElement.alt = `Error al cargar portada para ${item.name}`;
            console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
        };
        
        preloader.src = imageUrl;


        const titleElement = document.createElement('div');
        titleElement.classList.add('grid-item-title');
        titleElement.textContent = cleanGameName(item.name); // <--- Llamada a función global
        

        itemElement.addEventListener('click', () => {
            isCenteringActive = true; 
            updateGridSelection(index, true, false, false); 
            abrirDetallesJuego(item.name, imageUrl, item.url); 
        });


        itemElement.appendChild(imageElement);
        itemElement.appendChild(titleElement);
        
        fragment.appendChild(itemElement);
        gridItemsElements.push(itemElement);
    });

    grid.appendChild(fragment); 
    contentGridContainer.appendChild(grid);
    
    if (gridItemsElements.length > 0) {
        updateGridSelection(0, true, true, true);
    }
}


// Cierre de Modales
function hideGameDetailsHard() {
    gameDetailsOverlay.classList.remove('open');
    gameDetailsOverlay.style.display = 'none';
}

function cerrarDetallesJuego() {
    // ... (cuerpo de la función cerrarDetallesJuego se mantiene igual) ...
    if (inputLock) return; 
    inputLock = true;
    
    gameDetailsOverlay.classList.remove('open');
    setTimeout(() => {
        gameDetailsOverlay.style.display = 'none';
        inputLock = false; 
    }, 300);
}

function cerrarModal() {
    // ... (cuerpo de la función cerrarModal se mantiene igual) ...
    if (inputLock) return; 
    inputLock = true;
    
    modalOverlay.classList.remove('open');
    
    contentGridContainer.innerHTML = '';
    gridItemsElements = []; 
    currentGridIndex = 0; 
    
    hideGameDetailsHard();

    if (centeringCheckIntervalId) {
        clearInterval(centeringCheckIntervalId);
        centeringCheckIntervalId = null;
    }
    
    if (animacionScrollFrameId) {
        cancelAnimationFrame(animacionScrollFrameId);
        animacionScrollFrameId = null;
        isProgrammaticScrolling = false; 
    }
    
    isCenteringActive = false; 
    
    setTimeout(() => {
        modalOverlay.style.display = 'none';
        document.body.setAttribute('data-modal-open', 'false');
        inputLock = false;
    }, 300); 
}

/**
 * Función que abre el modal principal.
 * Se pone en ámbito global.
 * @param {string} systemName - El nombre base del sistema seleccionado.
 */
function abrirModal(systemName) { // <--- Ya no es 'export function'
    // ... (cuerpo de la función abrirModal se mantiene igual) ...
    if (inputLock) return; 
    inputLock = true;
    
    try {
        console.log(`-> Función abrirModal() llamada para: ${systemName}`);

        const imageUrl = imageDirectory + systemName + imageExtension;
        const bgUrl = backgroundDirectory + systemName + backgroundExtension; 
        
        modalOverlay.style.display = 'flex';
        void modalOverlay.offsetWidth; 
        modalOverlay.classList.add('open');
        document.body.setAttribute('data-modal-open', 'true');
        
        modalImage.src = imageUrl;
        modalImage.alt = systemName;
        modalTitle.textContent = systemName.replace(/-/g, ' ').toUpperCase(); 
        modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
        
        loadGameItems(systemName, (items) => {
            if (items.length > 0) {
                console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                renderGrid(items, systemName);
            } else {
                renderGrid([], systemName); 
            }
        });

        if (centeringCheckIntervalId) {
            clearInterval(centeringCheckIntervalId);
        }
        centeringCheckIntervalId = setInterval(checkAndRecenterGridSelection, 500);
        
        isCenteringActive = true; 

        setTimeout(() => {
            inputLock = false; 
        }, 200);

    } catch (error) {
        console.error("[ERROR CRÍTICO SÍNCRONO] 🚨 La función abrirModal() falló:", error);
        modalOverlay.style.display = 'none';
        modalOverlay.classList.remove('open');
        inputLock = false; 
    }
}


// Inicialización del DOM
document.addEventListener('DOMContentLoaded', () => {
    // ... (resto de la inicialización y manejo de eventos se mantiene igual) ...
    modalOverlay = document.getElementById('modal-overlay');
    modalHeader = document.getElementById('modal-header');
    modalCloseButton = document.getElementById('modal-close');
    modalImage = document.getElementById('modal-image');
    modalTitle = document.getElementById('modal-title'); 
    contentGridContainer = document.getElementById('content-grid-container');
    modalBody = document.querySelector('.modal-body');
    gameDetailsOverlay = document.getElementById('game-details-overlay');
    gameDetailsCloseButton = document.getElementById('game-details-close');
    gameDetailsImage = document.getElementById('game-details-image');
    gameDetailsTitle = document.getElementById('game-details-title');
    downloadButton = document.querySelector('.download-button');
    
    // Asignar eventos de cierre
    modalCloseButton.addEventListener('click', cerrarModal);
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            cerrarModal();
        }
    });
    gameDetailsCloseButton.addEventListener('click', cerrarDetallesJuego);
    gameDetailsOverlay.addEventListener('click', (event) => {
        if (event.target === gameDetailsOverlay) {
            cerrarDetallesJuego();
        }
    });
    
    // ... (el resto de los listeners se mantiene igual) ...
    modalBody.addEventListener('scroll', () => {
        if (modalOverlay.classList.contains('open')) {
            if (!isProgrammaticScrolling) { 
                isCenteringActive = false; 
                if (animacionScrollFrameId) {
                    cancelAnimationFrame(animacionScrollFrameId);
                    animacionScrollFrameId = null;
                }
            }
        }
    }, { passive: true });
    
    modalBody.addEventListener('mousedown', (event) => {
        if (modalOverlay.classList.contains('open') && !event.target.closest('.grid-item')) {
             isCenteringActive = false; 
        }
    });

    document.addEventListener('keydown', (event) => {
        const detallesAbierto = gameDetailsOverlay.classList.contains('open');
        const modalAbierto = modalOverlay.classList.contains('open');
        const isGridActive = modalAbierto && !detallesAbierto && gridItemsElements.length > 0;
        
        if ((event.key === 'Enter' || event.key === 'Escape') && inputLock) {
            event.preventDefault();
            return; 
        }

        if (event.key === 'Escape') {
            if (detallesAbierto) {
                cerrarDetallesJuego(); 
            } else if (modalAbierto) {
                cerrarModal(); 
            }
            event.preventDefault();
            return;
        }
        
        if (isGridActive) {
            
            if (event.repeat && gridNavLock) {
                event.preventDefault(); 
                return;
            }
            
            let newIndex = currentGridIndex;
            let targetIndex = currentGridIndex; 
            let handled = false;
            const lastIndex = gridItemsElements.length - 1; 
            
            const currentColumns = getGridColumns(); // <--- Llamada a función global
            const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);

            if (isArrowKey) {
                switch (event.key) {
                    case 'ArrowLeft':
                        targetIndex = currentGridIndex - 1;
                        newIndex = (targetIndex < 0) ? lastIndex : targetIndex; 
                        break;
                    case 'ArrowRight':
                        targetIndex = currentGridIndex + 1;
                        newIndex = (targetIndex > lastIndex) ? 0 : targetIndex;
                        break;
                    case 'ArrowUp':
                        targetIndex = currentGridIndex - currentColumns;
                        newIndex = (targetIndex < 0) ? currentGridIndex : targetIndex; 
                        break;
                    case 'ArrowDown':
                        targetIndex = currentGridIndex + currentColumns;
                        newIndex = Math.min(targetIndex, lastIndex);
                        break;
                }
                handled = true;
                
            } else if (event.key === 'Enter') {
                gridItemsElements[currentGridIndex].click();
                handled = true;
                
            } else {
                isCenteringActive = false;
            }
            
            if (isArrowKey) {
                if (newIndex !== currentGridIndex) {
                    if (event.repeat) {
                        gridNavLock = true;
                        setTimeout(() => { gridNavLock = false; }, GRID_NAV_DELAY_MS);
                    }
                    
                    isCenteringActive = true; 
                    updateGridSelection(newIndex, true, false, false); 
                }
            }
            
            if (handled) {
                event.preventDefault();
                return;
            }
        }
        
        if (modalAbierto || detallesAbierto) {
            if(event.key !== 'Enter') {
                 event.preventDefault();
            }
            return;
        }
        
    });
});
// =========================================================================