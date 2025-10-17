// =========================================================================
// game-details-logic.js: Lógica del Modal de Detalles del Juego
// MODIFICADO: Ahora llama a handleGameDownload para descarga directa.
// =========================================================================

// --- Referencias de DOM ---
let gameDetailsOverlay;
let gameDetailsCloseButton;
let gameDetailsImage;
let gameDetailsTitle;
let downloadButton;

// Variable de bloqueo general (asumida globalmente para simplicidad de importación)
// Asumimos que window.inputLock está definido en main-modal-manager.js
// let inputLock = false; 

// Dependencias de funciones (se asumen globales por la carga de scripts)
// - inputLock (desde main-modal-manager.js)
// - handleGameDownload (desde mediafire-downloader.js)

/**
 * Muestra el modal de detalles de un juego específico.
 */
function abrirDetallesJuego(gameName, imageUrl, downloadUrl) {
    console.log(`-> Abriendo detalles del juego: ${gameName}`);

    // Nota: 'gameDetailsOverlay' se asume que existe después del DOMContentLoaded
    if (!gameDetailsOverlay) return;

    gameDetailsImage.src = imageUrl;
    gameDetailsImage.alt = gameName;
    gameDetailsTitle.textContent = gameName;

    if (downloadUrl) {
        downloadButton.textContent = 'Descargar Juego';
        downloadButton.disabled = false;
        
        // **NUEVA LÓGICA DE DESCARGA**
        downloadButton.onclick = (event) => {
            event.preventDefault(); // Previene cualquier comportamiento de enlace si fuera un <a>

            // Llama a la función de descarga directa si está disponible.
            if (typeof window.handleGameDownload === 'function') {
                window.handleGameDownload(downloadUrl, downloadButton);
            } else {
                // Fallback si el script del descargador no se cargó correctamente
                console.warn('handleGameDownload no disponible. Abriendo link directo.');
                window.open(downloadUrl, '_blank');
            }
        };
        
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


/**
 * Oculta el modal de detalles del juego y desbloquea la entrada.
 */
function cerrarDetallesJuego() {
    // window.inputLock = true; // El bloqueo se maneja al final del setTimeout
    
    if (!gameDetailsOverlay) return;

    gameDetailsOverlay.classList.remove('open');
    setTimeout(() => {
        gameDetailsOverlay.style.display = 'none';
        window.inputLock = false; // Desbloquea la entrada después de la transición
    }, 300);
}

/**
 * Cierre forzado de detalles (útil al cerrar el modal principal).
 */
function hideGameDetailsHard() {
    if (!gameDetailsOverlay) return;
    gameDetailsOverlay.classList.remove('open');
    gameDetailsOverlay.style.display = 'none';
    // No se toca window.inputLock aquí, ya que se maneja en el cierre del modal principal.
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