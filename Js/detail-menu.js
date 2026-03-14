// detail-menu.js (Lógica de Renderizado de Detalle)

window.isDetailMenuOpen = false;
let currentDetailGame = null;
const ICONS_DIR_DETAIL = "Icons/"; 

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
                   rel="noopener noreferrer">
                    Descargar Juego
                </a>
            </div>
        </div>
    `;
}

// Esta función ahora solo se encarga de inyectar contenido
window.renderDetailContent = function(game) {
    if (window.isDetailMenuOpen) return;
    
    currentDetailGame = game;
    window.isDetailMenuOpen = true;
    
    const dC = document.getElementById('detail-container');
    dC.innerHTML = detailMenuHTML(game.name, game.imgUrl, game.downloadUrl);
    
    const backIcon = document.getElementById('detail-back-icon');
    if (backIcon) window.decodeImage?.(backIcon);
    
    document.getElementById('detail-close-button')?.addEventListener('click', window.hideDetailMenu);
    document.getElementById('detail-overlay')?.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleDetailMenuKeydown);

    document.body.style.overflow = 'hidden'; 
};

// Esta función limpia el contenido DESPUÉS de la animación
window.clearDetailContent = function() {
    window.isDetailMenuOpen = false;
    currentDetailGame = null;

    document.removeEventListener('keydown', handleDetailMenuKeydown);
    
    const dC = document.getElementById('detail-container');
    dC.innerHTML = '';
    
    if (!document.getElementById('main-container')?.classList.contains('system-menu-active')) {
        document.body.style.overflow = ''; 
    }
};

function handleDetailMenuKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault(); 
        window.hideDetailMenu();
    }
}

function handleOverlayClick(e) {
    if (e.target.id === 'detail-overlay') {
        window.hideDetailMenu();
    }
}
