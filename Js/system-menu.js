// system-menu.js (Optimizado: Navegación Proactiva y Gestión de Ciclo de Vida)
const ICONS_DIR = "Icons/"; 

// ** ESTILOS DINÁMICOS MEJORADOS **
(function injectFocusStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .game-item.game-item-focused {
            transform: translateY(-8px) scale(1.05) translateZ(0);
            box-shadow: 0 10px 20px rgba(0,0,0,0.6);
            outline: 3px solid var(--color-accent);
            z-index: 10;
        }
        .game-item:active {
            transform: translateY(-2px) scale(0.98);
            transition: transform 0.1s;
        }
        @keyframes fadeInGrid {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #game-grid {
            animation: fadeInGrid 0.4s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
})();

const systemMenuHTML = (n, i) => `
    <header id="system-header">
        <button id="back-button" aria-label="Volver al menú principal">
            <img id="back-icon" data-src="${ICONS_DIR}back.svg" alt="Volver">
        </button>
        <img id="system-icon" data-src="${i}" alt="${n} Icon">
    </header>
    <main id="game-list-container">
        <div class="loading-state">
            <p style="color: #bbb;">Cargando catálogo de ${n}...</p>
        </div>
    </main>
`;

let isKL = false; 
let gameImageObserver = null; 
const imageQueue = []; 
let isProcessingQueue = false;
let currentGridIndex = -1; 
let menuAbortController = null;

function getGridColumns() {
    const w = window.innerWidth;
    if (w >= 1920) return 8;
    if (w >= 1280) return 6;
    if (w >= 768) return 4;
    return 2;
}

function scrollRowIntoView(index, items, columns) {
    const container = document.getElementById('game-list-container');
    if (!container || !items[index]) return;

    const rowNumber = Math.floor(index / columns);
    const startIndex = rowNumber * columns;
    const endIndex = Math.min(startIndex + columns, items.length);

    let minTop = Infinity;
    let maxBottom = -Infinity;

    for (let i = startIndex; i < endIndex; i++) {
        const el = items[i];
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (top < minTop) minTop = top;
        if ((top + height) > maxBottom) maxBottom = top + height;
    }

    const rowHeight = maxBottom - minTop;
    const rowCenterY = minTop + (rowHeight / 2);
    const containerHeight = container.clientHeight;
    const targetScrollTop = rowCenterY - (containerHeight / 2);

    container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
    });
}

function updateGridFocus(items) {
    if (!items || items.length === 0) return;
    
    const previous = document.querySelector('.game-item-focused');
    if (previous) previous.classList.remove('game-item-focused');

    if (currentGridIndex >= 0 && currentGridIndex < items.length) {
        const selected = items[currentGridIndex];
        selected.classList.add('game-item-focused');
        scrollRowIntoView(currentGridIndex, items, getGridColumns());
    }
}

function handleSystemMenuKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault(); 
        if (window.isDetailMenuOpen) {
            window.hideDetailMenu();
            return;
        }
        goBackToMainMenu();
        return;
    }

    if (window.isDetailMenuOpen) return;

    const items = document.querySelectorAll('.game-item');
    if (items.length === 0) return;

    const columns = getGridColumns();
    const maxIndex = items.length - 1;
    let newIndex = currentGridIndex;

    // Lógica de navegación con saltos cíclicos
    switch (e.key) {
        case 'ArrowRight':
            e.preventDefault();
            newIndex = (currentGridIndex + 1 > maxIndex) ? 0 : currentGridIndex + 1;
            break;
        case 'ArrowLeft':
            e.preventDefault();
            newIndex = (currentGridIndex - 1 < 0) ? maxIndex : currentGridIndex - 1;
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (currentGridIndex + columns <= maxIndex) {
                newIndex = currentGridIndex + columns;
            } else {
                // Salto cíclico a la parte superior de la misma columna o siguiente
                newIndex = currentGridIndex % columns;
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (currentGridIndex - columns >= 0) {
                newIndex = currentGridIndex - columns;
            } else {
                // Salto cíclico a la parte inferior
                const lastRowStart = Math.floor(maxIndex / columns) * columns;
                const candidate = lastRowStart + (currentGridIndex % columns);
                newIndex = candidate > maxIndex ? maxIndex : candidate;
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (currentGridIndex >= 0 && currentGridIndex <= maxIndex) {
                items[currentGridIndex].click(); 
            }
            return; 
        default:
            return; 
    }

    if (currentGridIndex === -1) {
        newIndex = 0;
    }

    if (newIndex !== currentGridIndex) {
        currentGridIndex = newIndex;
        requestAnimationFrame(() => updateGridFocus(items));
    }
}

function goBackToMainMenu() {
    // Abortar cargas pendientes
    if (menuAbortController) {
        menuAbortController.abort();
        menuAbortController = null;
    }

    document.scrollingElement.style.overflow = ''; 
    gameImageObserver?.disconnect();
    gameImageObserver = null;
    imageQueue.length = 0;
    isProcessingQueue = false;
    currentGridIndex = -1;

    window.isDetailMenuOpen && window.hideDetailMenu(); 
    
    window.transitionScreen(() => {
        if (isKL) {
            document.removeEventListener('keydown', handleSystemMenuKeydown);
            isKL = false;
        }
        
        const mC = document.getElementById('main-container');
        mC.innerHTML = '';
        mC.classList.remove('system-menu-active');
        
        window.initMainMenu && requestAnimationFrame(() => {
            setTimeout(() => {
                window.initMainMenu();
                const bg = document.getElementById('background-container');
                if(bg) bg.style.opacity = '1'; 
            }, 0);
        });
    }, ''); 
}

const sMDeferredTask = (t) => ('requestIdleCallback' in window) ? requestIdleCallback(t) : setTimeout(t, 0);

function processNextImage() {
    if (imageQueue.length === 0) {
        isProcessingQueue = false;
        return;
    }
    
    isProcessingQueue = true;
    const { iE, iG } = imageQueue.shift();
    const dS = iE.getAttribute('data-src');
    
    if (!dS || !iE.dataset.isDecoding) { 
        processNextImage();
        return;
    }
    
    iE.removeAttribute('data-src'); 
    iE.removeAttribute('data-is-decoding'); 
    
    const isSvg = dS.endsWith('.svg');
    iE.style.willChange = iG ? 'auto' : 'opacity, transform'; 

    const applySrc = (h = 0, sL = false) => sMDeferredTask(() => {
        iE.src = dS;
        iE.style.willChange = 'auto'; 

        if (iG && sL) {
            const w = iE.closest('.game-item-img-wrapper');
            if (w) {
                const tMH = h > 0 ? h + 20 : 500; 
                w.style.maxHeight = '0px'; 
                w.offsetHeight; 
                requestAnimationFrame(() => {
                    w.style.maxHeight = `${tMH}px`;
                    w.classList.add('loaded'); // Para quitar el efecto shimmer
                });
            }
        } else if (iG) {
             const w = iE.closest('.game-item-img-wrapper');
             if(w) {
                 w.style.maxHeight = '250px';
                 w.classList.add('loaded');
             }
        }
        processNextImage(); 
    });

    if (isSvg) return applySrc(); 

    const iL = new Image();
    let nH = 0, sL = false;
    iL.src = dS; 

    Promise.race([
        new Promise((r, j) => {
            iL.onload = r;
            iL.onerror = j;
        }),
        new Promise(r => setTimeout(r, 5000)) 
    ])
    .then(async () => {
        try {
            if (iL.complete && iL.naturalWidth !== 0) {
                if (window.decodeImage) await window.decodeImage(iL); 
                sL = true;
                nH = iL.naturalHeight;
            }
        } catch (e) {
            console.warn(`Decode failed for ${dS}`, e);
        }
    })
    .catch(e => console.warn(`Load failed for ${dS}`, e))
    .finally(() => applySrc(nH, sL));
}

function loadAndDecodeImage(iE, iG = false) {
    if (!iE) return;
    const dS = iE.getAttribute('data-src');
    if (!dS || iE.dataset.isDecoding) return;
    
    iE.dataset.isDecoding = 'true';
    imageQueue.push({ iE, iG });
    !isProcessingQueue && sMDeferredTask(processNextImage);
}

function parseGameListString(lS) {
    if (!lS) return [];
    const lines = lS.split('\n').filter(l => l.trim().startsWith('-'));
    const games = [];
    const regex = /^-([^"]+)"([^"]+)"/; 
    
    for (const l of lines) {
        const match = l.trim().match(regex);
        match && games.push({
            name: match[1].trim(),
            url: match[2].trim()
        });
    }
    return games;
}

function loadGameListScript(sN) {
    return new Promise((r, j) => {
        const scriptUrl = window.GAMES_BASE_DIR + sN + '.js';
        const s = document.createElement('script');
        s.src = scriptUrl;
        s.async = true;

        s.onload = () => {
            const gLS = window.currentGameListString;
            delete window.currentGameListString; 
            s.remove(); 
            r(parseGameListString(gLS));
        };

        s.onerror = () => {
            s.remove();
            j(new Error(`No se pudo cargar la lista de juegos para ${sN}.`));
        };

        document.body.appendChild(s);
    });
}

function handleGameItemClick(e) {
    e.preventDefault(); 
    const item = e.currentTarget; 
    const name = item.dataset.name;
    const downloadUrl = item.dataset.url;
    const imgEl = item.querySelector('.game-item-img');
    const imgUrl = imgEl ? imgEl.src : ''; 
    
    if (window.showDetailMenu) {
        window.showDetailMenu({ name, downloadUrl, imgUrl });
    }
}

function renderGameList(g, sN) {
    const c = document.getElementById('game-list-container');
    if (!c) return;

    if (g.length === 0) {
        c.innerHTML = `<p class="game-item-empty">No se encontraron juegos para ${sN}.</p>`;
        return;
    }
    
    currentGridIndex = -1;
    const { GAMES_BASE_DIR: gBD, GAME_IMG_SUFFIX: gIS, GAME_IMG_EXT: gIE } = window;
    const gIBD = gBD + sN + '/';
    const gISuf = gIS || ''; 
    
    const gameListHTML = g.map((game, index) => {
        const cN = game.name.trim(); 
        const eN = encodeURIComponent(cN);
        const uL = gIBD + eN + gISuf + gIE;
        
        return `
            <a href="#" class="game-item" data-index="${index}" data-url="${game.url}" data-name="${game.name}" title="${game.name}">
                <div class="game-item-img-wrapper shimmer">
                    <img class="game-item-img" data-src="${uL}" alt="${game.name} cover" loading="lazy">
                </div>
                <div class="game-item-name-container">
                    <p class="game-item-name">${game.name}</p>
                </div>
            </a>
        `;
    }).join('');

    c.innerHTML = `<div id="game-grid">${gameListHTML}</div>`;
    
    gameImageObserver?.disconnect();
    gameImageObserver = new IntersectionObserver((e, o) => e.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target.querySelector('img');
            img && img.hasAttribute('data-src') && loadAndDecodeImage(img, true); 
            o.unobserve(entry.target);
        }
    }), { root: c, rootMargin: '400px', threshold: 0 });

    const allItems = c.querySelectorAll('.game-item');
    allItems.forEach((item, idx) => {
        gameImageObserver.observe(item);
        item.addEventListener('click', handleGameItemClick);
        item.addEventListener('mouseenter', () => {
            currentGridIndex = idx;
            const previous = document.querySelector('.game-item-focused');
            if (previous) previous.classList.remove('game-item-focused');
            item.classList.add('game-item-focused');
        });
    });
}

async function renderSystemMenu(sN) {
    menuAbortController = new AbortController();
    const mC = document.getElementById('main-container');
    const { IMG_DIR: iD, IMG_EXT: iE, BG_DIR: bD, BG_EXT: bE } = window;
    const sIS = iD + sN + iE;
    const bU = bD + sN + bE; 
    
    const bgContainer = document.getElementById('background-container');
    if(bgContainer) bgContainer.style.opacity = '0'; 
    document.scrollingElement.style.overflow = 'hidden'; 

    mC.innerHTML = systemMenuHTML(sN, sIS);
    mC.classList.add('system-menu-active');

    loadAndDecodeImage(document.getElementById('back-icon'));
    loadAndDecodeImage(document.getElementById('system-icon'));

    const sH = document.getElementById('system-header');
    if (sH) sH.style.backgroundImage = `url('${bU}')`;

    const bB = document.getElementById('back-button');
    if (bB) bB.addEventListener('click', goBackToMainMenu);
    
    if (!isKL) {
        document.addEventListener('keydown', handleSystemMenuKeydown);
        isKL = true;
    }
    
    const c = document.getElementById('game-list-container');
    try {
        const games = await loadGameListScript(sN);
        if (!menuAbortController.signal.aborted) {
            renderGameList(games, sN);
        }
    } catch (e) {
        if (c && !menuAbortController.signal.aborted) {
            c.innerHTML = `<p class="game-item-empty">Error al cargar la lista: ${e.message}</p>`;
        }
    }
}

window.onSystemSelect = function (sN) {
    window.ruedaDinamicaInstance?.destroy();
    window.ruedaDinamicaInstance = null;
    window.transitionScreen(() => renderSystemMenu(sN), 'system-active'); 
};