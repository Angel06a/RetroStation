// detail-menu.js (Menú de Detalle/Descarga Modal)

window.isDetailMenuOpen = false; // Hacemos la variable global
let currentDetailGame = null;

// CONSTANTE para la ruta del icono de cerrar
const ICONS_DIR_DETAIL = "Icons/"; 

/**
 * Genera el HTML para el menú de detalle.
 * @param {string} name Nombre del juego.
 * @param {string} imgUrl URL de la imagen de la portada.
 * @param {string} downloadUrl URL de descarga del juego.
 */
function detailMenuHTML(name, imgUrl, downloadUrl) {
    return `
        <div id="detail-overlay" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div id="detail-content">
                
                <button id="detail-close-button" aria-label="Cerrar">
                    <img id="detail-back-icon" src="${ICONS_DIR_DETAIL}back.svg" alt="Cerrar">
                </button>
                
                <div id="detail-img-wrapper">
                    <img id="detail-img" src="${imgUrl}" alt="${name} cover">
                </div>
                
                <h2 id="detail-title">${name}</h2>
                
                <a id="detail-download-button" 
                   href="${downloadUrl}" 
                   download="${name}" 
                   target="_blank"
                   title="Descargar ${name}"
                   rel="noopener noreferrer">
                    Descargar Juego
                </a>
            </div>
        </div>
    `;
}

/**
 * Muestra el menú de detalle modal.
 * @param {{name: string, imgUrl: string, downloadUrl: string}} game Objeto con la info del juego.
 */
window.showDetailMenu = function(game) {
    if (window.isDetailMenuOpen) return;
    
    currentDetailGame = game;
    window.isDetailMenuOpen = true; // Actualizamos la propiedad global
    
    const dC = document.getElementById('detail-container');
    dC.innerHTML = detailMenuHTML(game.name, game.imgUrl, game.downloadUrl);
    // REMOVIDO: dC.classList.add('active'); (Lo gestiona index.html para pointer-events en el fade-in)
    
    // ** SIMPLIFICACIÓN: Se asume que el SVG ya está cargado por el cambio a 'src' **
    // Si la imagen ya fue cargada por el index, simplemente forzamos la decodificación.
    const backIcon = document.getElementById('detail-back-icon');
    if (backIcon) {
        window.decodeImage?.(backIcon);
    }
    // ** FIN SIMPLIFICACIÓN **
    
    // Asignar listeners
    document.getElementById('detail-close-button')?.addEventListener('click', window.hideDetailMenu);
    document.getElementById('detail-overlay')?.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleDetailMenuKeydown);

    // Ocultar scroll del body mientras el modal está abierto
    document.body.style.overflow = 'hidden'; 
    
    // Enfocar el botón de cerrar para accesibilidad (opcional, pero útil)
    document.getElementById('detail-close-button')?.focus();
};

/**
 * Oculta el menú de detalle modal.
 */
window.hideDetailMenu = function() {
    if (!window.isDetailMenuOpen) return; // Usamos la propiedad global
    
    // REMOVIDO: El fade-out y la remoción de .active serán gestionados por index.html
    
    // ESTA PARTE SÓLO ES LA LÓGICA DE LIMPIEZA
    window.isDetailMenuOpen = false; // Actualizamos la propiedad global
    currentDetailGame = null;

    // Remover listeners
    document.removeEventListener('keydown', handleDetailMenuKeydown);
    document.getElementById('detail-overlay')?.removeEventListener('click', handleOverlayClick);
    
    const dC = document.getElementById('detail-container');
    // REMOVIDO: dC.classList.remove('active');
    
    // Limpiar inmediatamente (tiempo de espera a 0ms ya que no hay transición visual)
    // El 'setTimeout' para la limpieza del innerHTML será gestionado después de la transición en index.html
    // El innerHTML se limpiará DENTRO de la función en index.html
    dC.innerHTML = '';
    
    // Solo restauramos el scroll del body si no estamos en el system-menu
    if (!document.getElementById('main-container')?.classList.contains('system-menu-active')) {
        document.body.style.overflow = ''; 
    } else {
        // Si estamos en system-menu, el scroll lo controla document.scrollingElement.style.overflow
        // Y debe seguir 'hidden' si system-menu está activo.
    }
    // REMOVIDO: El `setTimeout` para la limpieza de innerHTML. Ahora se limpia directamente para que index.html lo haga después del fade.
};

/**
 * Handler para la tecla Escape y Enter/Espacio en el botón.
 * @param {KeyboardEvent} e 
 */
function handleDetailMenuKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault(); 
        window.hideDetailMenu();
    }
}

/**
 * Cierra el modal al hacer clic en el fondo oscuro.
 * @param {MouseEvent} e 
 */
function handleOverlayClick(e) {
    // Si el clic fue directamente en el overlay (no en el contenido)
    if (e.target.id === 'detail-overlay') {
        window.hideDetailMenu();
    }
}