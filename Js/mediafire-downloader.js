// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// MODIFICADO: Funciones de manejo de carpetas hechas globales para la secuencia.
// ELIMINADA: La función openCleanPopup() y su uso en el fallback para evitar
// la simulación de clic que podría estar contribuyendo al aviso de Chrome.
// =========================================================================

const linkCache = new Map(); 
const folderCache = new Map();

// --- Utilidades Básicas ---

/**
 * Detecta si el agente de usuario parece ser un dispositivo móvil.
 */
function isMobile() {
    return /Mobi/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent);
}

/**
 * Inicia la descarga.
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

// --- Lógica de Extracción y Proxy Robusto ---

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

/**
 * Fetch con un límite de tiempo (timeout) de 15 segundos para robustez en móvil.
 */
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
                
                // allorigins.win a veces envuelve la respuesta en un JSON
                if (service.includes('allorigins.win') && html.startsWith('{"contents":')) {
                     try {
                         const data = JSON.parse(html);
                         html = data.contents;
                     } catch (e) {
                         // Si falla el parseo, usamos el HTML crudo
                     }
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

// --- Lógica de Carpetas ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
}

async function getFolderViaAPI(folderKey) {
    try {
        const apiUrl = `https://www.mediafire.com/api/1.5/folder/get_content.php?r=qtg&content_type=files&filter=all&order_by=name&order_direction=asc&chunk=1&version=1.5&folder_key=${folderKey}&response_format=json`;
        
        const response = await fetch(apiUrl); 
        if (response.ok) {
            const data = await response.json();
            if (data.response && data.response.folder_content && data.response.folder_content.files) {
                return data.response.folder_content.files.map(file => ({
                    name: file.filename,
                    url: `https://www.mediafire.com/file/${file.quickkey}`,
                    key: file.quickkey,
                }));
            }
        }
    } catch (error) {
        console.error('Error API MediaFire:', error);
    }
    return [];
}

async function getFolderViaScraping(folderKey) {
    try {
        const folderUrl = `https://www.mediafire.com/folder/${folderKey}`;
        const service = `https://api.allorigins.win/raw?url=${encodeURIComponent(folderUrl)}`;
        
        const response = await fetchWithTimeout(service, { timeout: 15000 }); 
        if (response.ok) {
            const html = await response.text();
            return parseFolderHTML(html, folderKey);
        }
    } catch (error) {
        console.error('Error scraping:', error);
    }
    return [];
}

function parseFolderHTML(html, folderKey) {
    const files = [];
    const dataKeyPattern = /data-key="([^"]+)"/g;
    let match;
    
    while ((match = dataKeyPattern.exec(html)) !== null) {
        const key = match[1];
        const namePattern = new RegExp(`data-key="${key}"[^>]*data-filename="([^"]+)"`);
        const nameMatch = html.match(namePattern);
        
        if (nameMatch && nameMatch[1]) {
            files.push({
                name: nameMatch[1],
                url: `https://www.mediafire.com/file/${key}`,
                key: key
            });
        }
    }
    
    const jsonPattern = /window\.oPageData\s*=\s*({[^;]+});/;
    const jsonMatch = html.match(jsonPattern);
    
    if (jsonMatch) {
        try {
            const pageData = JSON.parse(jsonMatch[1]);
            if (pageData.files) {
                pageData.files.forEach(file => {
                    if (file.quickkey || file.key) {
                        files.push({
                            name: file.name || file.filename,
                            url: `https://www.mediafire.com/file/${file.quickkey || file.key}`,
                            key: file.quickkey || file.key
                        });
                    }
                });
            }
        } catch (e) {
            // Error al parsear JSON
        }
    }
    
    const uniqueFiles = [];
    const seenKeys = new Set();
    
    for (const file of files) {
        if (file.key && !seenKeys.has(file.key)) {
            seenKeys.add(file.key);
            uniqueFiles.push(file);
        }
    }
    return uniqueFiles;
}

async function getFolderContents(folderKey) {
    if (folderCache.has(folderKey)) {
        return folderCache.get(folderKey);
    }
    
    console.log('Buscando archivos para carpeta:', folderKey);
    
    let files = [];
    try {
        files = await getFolderViaAPI(folderKey);
        if (files.length === 0) files = await getFolderViaScraping(folderKey);
    } catch (error) {
        console.log('Error al obtener contenido de carpeta, usando el método alternativo si es necesario.');
    }

    if (files.length > 0) {
        folderCache.set(folderKey, files);
    }
    return files;
}

// --- Funciones de Pre-carga ---

/**
 * Obtiene el enlace de descarga directo de MediaFire para archivos individuales.
 * NO INICIA la descarga.
 */
async function getDirectDownloadLink(mediafireUrl) {
    if (mediafireUrl.includes('/folder/')) {
        return null; 
    }
    if (linkCache.has(mediafireUrl)) {
        return linkCache.get(mediafireUrl);
    }
    
    try {
        const directUrl = await method2_externalServices(mediafireUrl);
        if (directUrl) linkCache.set(mediafireUrl, directUrl);
        return directUrl; 
    } catch (e) {
        console.error("Error al precargar link:", e);
        return null;
    }
}


// --- Función Principal (Fallback para archivos individuales sin pre-carga) ---

async function handleGameDownload(mediafireUrl, buttonElement) {
    
    if (!mediafireUrl || mediafireUrl.includes('/folder/')) return; // Solo maneja archivos individuales ahora

    buttonElement.disabled = true;
    const originalText = buttonElement.textContent;
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };

    updateButtonStatus('Procesando (Asíncrono)...');

    // Lógica de Archivo Individual (ASÍNCRONO - método antiguo/fallback)
    try {
        updateButtonStatus('Obteniendo enlace directo...');
        // Priorizar el link en cache si existe, sino lo intenta de nuevo
        let directUrl = linkCache.get(mediafireUrl);
        
        if (!directUrl) {
            directUrl = await method2_externalServices(mediafireUrl);
        }
        
        if (directUrl) {
            triggerDownload(directUrl);
            updateButtonStatus('Descargando...');
        } else {
            // FALLBACK SIN POPUP: Intentamos la descarga directa con el URL de MediaFire
            // Si el navegador lo permite, iniciará la descarga, sino, no pasará nada.
            triggerDownload(mediafireUrl); 
            updateButtonStatus('Descarga iniciada...'); 
        }
    } catch(e) {
        // En caso de error, intentamos la descarga directa con el URL original de MediaFire
        updateButtonStatus('Error. Intentando descarga directa...');
        triggerDownload(mediafireUrl); 
    }
    
    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }, 3000); 
}

// Hacemos las funciones principales globalmente accesibles para game-details-logic.js
window.handleGameDownload = handleGameDownload;
window.getDirectDownloadLink = getDirectDownloadLink; 
window.triggerDownload = triggerDownload; 
window.getFolderContents = getFolderContents; // Nueva global
window.extractFolderKey = extractFolderKey; // Nueva global
