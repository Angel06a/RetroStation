// =========================================================================
// game-details-logic.js: Lógica del Modal de Detalles del Juego
// MODIFICADO: Pre-carga de enlace de carpeta y archivo individual ahora es automática.
//             El clic del usuario solo inicia la descarga síncrona.
// =========================================================================

// --- Referencias de DOM ---
let gameDetailsOverlay;
let gameDetailsCloseButton;
let gameDetailsImage;
let gameDetailsTitle;
let downloadButton;

// --- Variables de Estado de Descarga ---
let preloadedDirectUrl = null; 
let folderFiles = null; // Array de objetos {name, url, key}
let currentFileIndex = 0;
let isFolderMode = false;
let downloadUrlOriginal = null; 

// Dependencias de funciones (se asumen globales)
// - inputLock (de main-modal-manager.js)
// - handleGameDownload, getDirectDownloadLink, triggerDownload, getFolderContents, extractFolderKey (de mediafire-downloader.js)

/**
 * Inicia la pre-carga automática del enlace directo del archivo actual
 * y reconfigura el botón para el click de descarga síncrona.
 */
async function startFolderPreloadSequence(downloadUrl) {
    if (!folderFiles || currentFileIndex >= folderFiles.length) {
        // Fin de la secuencia
        downloadButton.textContent = `Descarga Completa (${folderFiles.length} archivos)`;
        downloadButton.disabled = true;
        setTimeout(() => cerrarDetallesJuego(), 2000);
        return;
    }
    
    // 1. Deshabilitar botón y mostrar carga
    downloadButton.disabled = true;
    downloadButton.onclick = null;
    
    const currentFile = folderFiles[currentFileIndex];
    const totalFiles = folderFiles.length;
    
    downloadButton.textContent = `Cargando Enlace ${currentFileIndex + 1} de ${totalFiles}: ${currentFile.name}`;
    
    try {
        if (typeof window.getDirectDownloadLink !== 'function' || typeof window.triggerDownload !== 'function') {
            throw new Error("Dependencias de descarga no disponibles.");
        }
        
        // 2. Obtener el enlace directo para el archivo actual (ASÍNCRONO - BÚSQUEDA AUTOMÁTICA)
        const directLink = await window.getDirectDownloadLink(currentFile.url);
        
        if (directLink) {
            // 3. Configurar el botón para el click síncrono (Click de Descarga)
            downloadButton.textContent = `Descargar ${currentFile.name} (${currentFileIndex + 1}/${totalFiles})`;
            downloadButton.disabled = false;
            
            downloadButton.onclick = (event) => {
                event.preventDefault(); 
                
                // **Acción SÍNCRONA: Iniciar descarga**
                window.triggerDownload(directLink); 
                
                // 4. Preparar la UI y lógica para el siguiente archivo (INICIAR SIGUIENTE PRE-CARGA)
                currentFileIndex++;
                downloadButton.textContent = 'Descargando... Preparando siguiente.';
                downloadButton.disabled = true; // Deshabilitar mientras se prepara el siguiente
                
                // 5. Iniciar la pre-carga del siguiente archivo automáticamente
                startFolderPreloadSequence(downloadUrlOriginal);
            };
            
        } else {
            // Fallo en obtener el link directo
            downloadButton.textContent = `Error ${currentFileIndex + 1}/${totalFiles}. (Intentar de nuevo)`;
            downloadButton.disabled = false;
            
            // Reintentar la pre-carga del MISMO archivo al hacer clic
            downloadButton.onclick = (event) => {
                event.preventDefault();
                startFolderPreloadSequence(downloadUrlOriginal); 
            };
        }
    } catch (error) {
        console.error("Fallo la pre-carga secuencial:", error);
        downloadButton.textContent = `Error ${currentFileIndex + 1}/${totalFiles}. (Reintentar)`;
        downloadButton.disabled = false;
        
        downloadButton.onclick = (event) => {
            event.preventDefault();
            startFolderPreloadSequence(downloadUrlOriginal); 
        };
    }
}


/**
 * Muestra el modal de detalles de un juego específico.
 */
function abrirDetallesJuego(gameName, imageUrl, downloadUrl) {
    console.log(`-> Abriendo detalles del juego: ${gameName}`);

    if (!gameDetailsOverlay) return;

    gameDetailsImage.src = imageUrl;
    gameDetailsImage.alt = gameName;
    gameDetailsTitle.textContent = gameName;
    
    // **1. Reset y Estado Inicial**
    preloadedDirectUrl = null;
    folderFiles = null;
    currentFileIndex = 0;
    isFolderMode = false;
    downloadUrlOriginal = downloadUrl;

    if (downloadUrl) {
        
        // Estado de carga por defecto
        downloadButton.textContent = 'Cargando Enlace...';
        downloadButton.disabled = true;
        downloadButton.onclick = null; 

        if (downloadUrl.includes('/folder/')) {
            // **2. LÓGICA DE CARPETA (Buscar Archivos - Paso 1: ASÍNCRONO)**
            isFolderMode = true;
            downloadButton.textContent = 'Buscando lista de archivos...';
            
            if (typeof window.getFolderContents === 'function' && typeof window.extractFolderKey === 'function') {
                const folderKey = window.extractFolderKey(downloadUrl);
                
                if (folderKey) {
                    window.getFolderContents(folderKey)
                        .then(files => {
                            if (files && files.length > 0) {
                                folderFiles = files;
                                currentFileIndex = 0;
                                // **** AQUÍ INICIAMOS LA PRE-CARGA AUTOMÁTICA DEL PRIMER ARCHIVO ****
                                startFolderPreloadSequence(downloadUrl);
                            } else {
                                console.warn('Carpeta vacía o error al obtener contenido. Usando fallback asíncrono.');
                                updateDownloadButton(downloadUrl); 
                            }
                        })
                        .catch(error => {
                            console.error("Fallo al obtener contenido de carpeta:", error);
                            updateDownloadButton(downloadUrl); // Fallback
                        });
                } else {
                    updateDownloadButton(downloadUrl); // Fallback
                }
            } else {
                updateDownloadButton(downloadUrl); // Fallback
            }
            
        } else {
            // **3. LÓGICA DE ARCHIVO INDIVIDUAL (Pre-carga de Link - ASÍNCRONO)**
            if (typeof window.getDirectDownloadLink === 'function') {
                window.getDirectDownloadLink(downloadUrl)
                    .then(directLink => {
                        preloadedDirectUrl = directLink;
                        updateDownloadButton(downloadUrl); // Configura el botón para el clic síncrono
                    })
                    .catch(error => {
                        console.error("Fallo la pre-carga:", error);
                        updateDownloadButton(downloadUrl); // Fallback
                    });
            } else {
                updateDownloadButton(downloadUrl); // Fallback
            }
        }
    } else {
        downloadButton.textContent = 'No disponible';
        downloadButton.disabled = true;
        downloadButton.onclick = null;
    }

    // Mostrar el modal
    gameDetailsOverlay.style.display = 'flex';
    setTimeout(() => {
        gameDetailsOverlay.classList.add('open');
        window.inputLock = true;
    }, 10);
}

// La función 'updateDownloadButton' ahora solo maneja el archivo individual y el fallback,
// ya que 'startFolderPreloadSequence' se encarga completamente de la lógica de carpeta.
function updateDownloadButton(downloadUrl) {
    
    // Si estamos en modo carpeta y ya se inició la secuencia, no hacemos nada aquí.
    if (isFolderMode && folderFiles) {
        return; 
    }
    
    downloadButton.textContent = 'Descargar Juego';
    downloadButton.disabled = false;
    
    if (preloadedDirectUrl && typeof window.triggerDownload === 'function') {
        // **LÓGICA DE ARCHIVO INDIVIDUAL (Pre-carga SÍNCRONA)**
        console.log('Botón configurado para descarga síncrona.');
        
        downloadButton.onclick = (event) => {
            event.preventDefault(); 
            
            // Llama SÍNCRONA e INMEDIATAMENTE a la descarga con el link pre-cargado.
            window.triggerDownload(preloadedDirectUrl); 
            
            downloadButton.textContent = 'Descargando...';
            downloadButton.disabled = true;
            
            setTimeout(() => cerrarDetallesJuego(), 1000); 
        };
        
    } else {
        // **FALLBACK (Asíncrono o Link No Disponible/Error/Carpeta Fallida)**
        console.log('Botón configurado para descarga asíncrona (con proxy).');

        downloadButton.onclick = (event) => {
            event.preventDefault(); 
            if (typeof window.handleGameDownload === 'function') {
                window.handleGameDownload(downloadUrl, downloadButton);
            } else {
                console.warn('handleGameDownload no disponible. Abriendo link directo.');
                window.open(downloadUrl, '_blank');
            }
        };
    }
}


/**
 * Oculta el modal de detalles del juego y desbloquea la entrada.
 */
function cerrarDetallesJuego() {
    
    if (!gameDetailsOverlay) return;

    gameDetailsOverlay.classList.remove('open');
    setTimeout(() => {
        gameDetailsOverlay.style.display = 'none';
        window.inputLock = false; // Desbloquea la entrada después de la transición
        
        // Limpiar todas las variables de estado al cerrar
        preloadedDirectUrl = null; 
        folderFiles = null;
        currentFileIndex = 0;
        isFolderMode = false;
        downloadUrlOriginal = null;
    }, 300);
}

/**
 * Cierre forzado de detalles (útil al cerrar el modal principal).
 */
function hideGameDetailsHard() {
    if (!gameDetailsOverlay) return;
    gameDetailsOverlay.classList.remove('open');
    gameDetailsOverlay.style.display = 'none';
    preloadedDirectUrl = null; 
    folderFiles = null;
    currentFileIndex = 0;
    isFolderMode = false;
    downloadUrlOriginal = null;
}

// Hacemos las funciones globales para que game-grid-logic.js pueda usarlas
window.abrirDetallesJuego = abrirDetallesJuego;
window.cerrarDetallesJuego = cerrarDetallesJuego;
window.hideGameDetailsHard = hideGameDetailsHard;

// Inicialización del DOM
document.addEventListener('DOMContentLoaded', () => {
    gameDetailsOverlay = document.getElementById('game-details-overlay');
    gameDetailsCloseButton = document.getElementById('game-details-close');
    gameDetailsImage = document.getElementById('game-details-image');
    gameDetailsTitle = document.getElementById('game-details-title');
    downloadButton = document.querySelector('.download-button');
    
    // Asignar eventos de cierre
    if (gameDetailsCloseButton) gameDetailsCloseButton.addEventListener('click', cerrarDetallesJuego);
    if (gameDetailsOverlay) gameDetailsOverlay.addEventListener('click', (event) => {
        if (event.target === gameDetailsOverlay) {
            cerrarDetallesJuego();
        }
    });
});