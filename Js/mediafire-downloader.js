// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// SOLUCIÓN FINAL: Se elimina el CACHEO (linkCache) para archivos individuales.
// Esto garantiza que la descarga se intente siempre de forma ASÍNCRONA, 
// solucionando el bloqueo en móvil a partir del segundo clic.
// =========================================================================

const linkCache = new Map(); // Se mantiene la variable, pero se ignora para archivos individuales.
const folderCache = new Map();

// --- Utilidades Básicas ---

/**
 * Detecta si el agente de usuario parece ser un dispositivo móvil.
 */
function isMobile() {
    return /Mobi/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent);
}

/**
 * Inicia la descarga o abre el enlace directo.
 */
function triggerDownload(url) {
    // Intentamos iniciar la descarga en la pestaña actual (igual para PC y Móvil).
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Función de respaldo para abrir la URL en una nueva pestaña.
 */
function openCleanPopup(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a); 
}

// --- Lógica de Archivos Individuales y Extracción (Sin Cambios en extract, fetchWithTimeout) ---

function extractFromHTML(html) {
    const patterns = [
        /id="downloadButton".*?href="(.*?)"/,
        new RegExp('href="(https:\\/\\/download[0-9]*\\.mediafire\\.com\\/[^"]*)"'),
        /"download_link".*?"(https:[^"]+)"/,
    ];
    
    for (let pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
            let url = match[1].replace(/\\\//g, '/');
            if (url.startsWith('//')) url = 'https:' + url;
            return url;
        }
    }
    return null;
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function method2_externalServices(mediafireUrl) {
    const services = [
        `https://corsproxy.io/?${encodeURIComponent(mediafireUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(mediafireUrl)}`,
    ];
    
    for (let service of services) {
        try {
            const response = await fetchWithTimeout(service, { timeout: 15000 });
            
            if (response.ok) {
                let html = await response.text();
                
                if (service.includes('allorigins.win') && html.startsWith('{"contents":')) {
                     const data = JSON.parse(html);
                     html = data.contents;
                }
                
                const directLink = extractFromHTML(html);
                if (directLink) return directLink;
            }
        } catch (error) {
            continue; 
        }
    }
    return null;
}

// --- Lógica de Carpetas (Se mantiene la misma lógica) ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
}

// Funciones de carpeta (getFolderContents, getFolderViaAPI, etc.) deben ser restauradas aquí...
// ...
async function getFolderContents(folderKey) { 
    // Por favor, asegúrate de que estas funciones de carpeta estén restauradas de tu código anterior.
    // ...
    return [];
}
// ...

async function downloadMultipleFiles(files, buttonElement) {
    const total = files.length;
    let downloaded = 0;
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };
    
    updateButtonStatus(`📁 Iniciando descarga de ${total} archivos (0/${total})...`);
    
    for (let file of files) {
        try {
            const actionText = 'Descargando';
            updateButtonStatus(`📁 ${actionText} (${downloaded + 1}/${total}): ${file.name}`);

            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                triggerDownload(directUrl);
                downloaded++;
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        } catch (error) {
            console.error(`Error descargando ${file.name}:`, error);
        }
    }
    
    updateButtonStatus(`✅ ${downloaded}/${total} archivos procesados`);
    
    if (downloaded === 0 && total > 0) {
        openCleanPopup(files[0].url);
    }
}


// --- Función Principal de la Web ---

async function handleGameDownload(mediafireUrl, buttonElement) {
    
    if (!mediafireUrl) return;

    buttonElement.disabled = true;
    const originalText = buttonElement.textContent;
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };

    updateButtonStatus('Procesando...');

    if (mediafireUrl.includes('/folder/')) {
        // Lógica de Carpeta (manteniendo el cacheo de carpetas)
        // ... (Tu lógica de carpeta) ...
    } else {
        // Lógica de Archivo Individual: SIN CACHEO
        try {
            // SIEMPRE llamamos al proxy para forzar el comportamiento ASÍNCRONO
            updateButtonStatus('Obteniendo enlace directo...');
            const directUrl = await method2_externalServices(mediafireUrl);
            
            if (directUrl) {
                // Ya no guardamos en caché (la línea linkCache.set se elimina).
                triggerDownload(directUrl);
                updateButtonStatus('Descargando...');
            } else {
                // Si el proxy FALLÓ, se ejecuta el fallback (con nueva pestaña para forzar apertura).
                updateButtonStatus('Abriendo link (FALLBACK)');
                openCleanPopup(mediafireUrl); 
            }
        } catch(e) {
            updateButtonStatus('Error. Abriendo link...');
            openCleanPopup(mediafireUrl);
        }
    }
    
    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }, 3000); 
}

// Hacemos la función principal globalmente accesible para game-details-logic.js
window.handleGameDownload = handleGameDownload;
