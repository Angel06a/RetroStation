// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// MODIFICACIÓN CRÍTICA: Se elimina la detección de isMobile en triggerDownload
// para forzar el método a.click() en ambos PC y Móvil.
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
 * Inicia la descarga intentando el método a.click() en PC y Móvil.
 * En Móvil, el navegador puede bloquearlo o abrir una nueva pestaña.
 * Si esto falla, el código principal ejecuta el FALLBACK a openCleanPopup(link_MF).
 */
function triggerDownload(url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    // Intentamos la descarga directa en el mismo frame para ambos.
    a.click();
    document.body.removeChild(a);
}

/**
 * Abre la URL en una nueva pestaña limpia (se usa solo para FALLBACK en el código principal).
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

// --- Lógica de Archivos Individuales y Extracción ---

function extractFromHTML(html) {
    // Patrones clave para el enlace directo de MediaFire
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
 * Función auxiliar para realizar fetch con un límite de tiempo (timeout) de 15 segundos.
 */
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000 } = options; // 15 segundos de timeout
    
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
    // Lista de servicios proxy.
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

// --- Lógica de Carpetas ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
}

async function getFolderContents(folderKey) {
    if (folderCache.has(folderKey)) {
        return folderCache.get(folderKey);
    }
    
    // (Lógica de obtención de contenido de carpetas, asumida desde versiones anteriores)
    let files = [];
    
    try {
        files = await getFolderViaAPI(folderKey);
        if (files.length === 0) files = await getFolderViaScraping(folderKey);
        if (files.length === 0) files = await getFolderViaExternalService(folderKey);
    } catch (error) {
        console.error("Error al obtener el contenido de la carpeta", error);
    }

    if (files.length > 0) {
        folderCache.set(folderKey, files);
    }
    return files;
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
    } catch (error) {}
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
    } catch (error) {}
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
    return files.filter((v, i, a) => a.findIndex(t => (t.key === v.key)) === i); // Eliminar duplicados
}

async function getFolderViaExternalService(folderKey) {
    try {
        const serviceUrl = `https://r.jina.ai/https://www.mediafire.com/folder/${folderKey}`;
        const response = await fetchWithTimeout(serviceUrl, { timeout: 15000 });
        
        if (response.ok) {
            const content = await response.text();
            const files = [];
            const keyPattern = /([a-zA-Z0-9]{13,15})/g;
            let match;
            
            while ((match = keyPattern.exec(content)) !== null) {
                const key = match[1];
                if (key.length >= 13 && key.length <= 15) {
                    const start = Math.max(0, match.index - 100);
                    const end = Math.min(content.length, match.index + 100);
                    const context = content.substring(start, end);
                    const nameMatch = context.match(/([^\/\s]+\.\w{2,4})/);
                    const fileName = nameMatch ? nameMatch[1] : `file_${key}`;
                    
                    files.push({ name: fileName, url: `https://www.mediafire.com/file/${key}`, key: key });
                }
            }
            return files.filter((v, i, a) => a.findIndex(t => (t.key === v.key)) === i);
        }
    } catch (error) {}
    return [];
}

async function downloadMultipleFiles(files, buttonElement) {
    const total = files.length;
    let downloaded = 0;
    const isMobileDevice = isMobile(); 
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };
    
    updateButtonStatus(`📁 Iniciando descarga de ${total} archivos (0/${total})...`);
    
    for (let file of files) {
        try {
            const actionText = isMobileDevice ? 'Intentando descarga directa' : 'Descargando';
            updateButtonStatus(`📁 ${actionText} (${downloaded + 1}/${total}): ${file.name}`);

            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                // Intentamos la descarga en el mismo frame para ambos.
                triggerDownload(directUrl);
                downloaded++;
                // Pausa necesaria para evitar que el navegador bloquee descargas múltiples.
                await new Promise(resolve => setTimeout(resolve, 1500)); 
            }
        } catch (error) {
            console.error(`Error descargando ${file.name}:`, error);
        }
    }
    
    updateButtonStatus(`✅ ${downloaded}/${total} archivos procesados`);
    
    if (downloaded === 0 && total > 0) {
        // Fallback: si falló la extracción, abrir el link original de MediaFire en una nueva pestaña
        openCleanPopup(files[0].url);
    }
}


// --- Función Principal de la Web ---

async function handleGameDownload(mediafireUrl, buttonElement) {
    
    if (!mediafireUrl) return;

    buttonElement.disabled = true;
    const originalText = buttonElement.textContent;
    const isMobileDevice = isMobile(); 
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };

    updateButtonStatus('Procesando...');

    if (mediafireUrl.includes('/folder/')) {
        // Lógica de Carpeta
        try {
            updateButtonStatus('🔍 Buscando archivos en carpeta...');
            
            const folderKey = extractFolderKey(mediafireUrl);
            if (!folderKey) {
                updateButtonStatus('❌ URL de carpeta no válida, abriendo link...');
                openCleanPopup(mediafireUrl); 
                return;
            }
            
            const files = await getFolderContents(folderKey);
            
            if (files && files.length > 0) {
                await downloadMultipleFiles(files, buttonElement);
                
            } else {
                updateButtonStatus('❌ Carpeta vacía o error, abriendo link...');
                openCleanPopup(mediafireUrl);
            }
            
        } catch (error) {
            console.error('Error en el manejo de carpeta:', error);
            updateButtonStatus('❌ Error, abriendo link...');
            openCleanPopup(mediafireUrl);
        }
        
    } else {
        // Lógica de Archivo Individual
        try {
            if (linkCache.has(mediafireUrl)) {
                updateButtonStatus(isMobileDevice ? 'Intentando descarga directa desde caché...' : 'Descargando desde caché...');
                triggerDownload(linkCache.get(mediafireUrl));
            } else {
                updateButtonStatus('Obteniendo enlace directo...');
                // LLAMADA AL PROXY CON TIMEOUT AUMENTADO
                const directUrl = await method2_externalServices(mediafireUrl);
                
                if (directUrl) {
                    // SI EL PROXY TUVO ÉXITO
                    linkCache.set(mediafireUrl, directUrl);
                    // Intentamos la descarga en el mismo frame para ambos.
                    triggerDownload(directUrl); 
                    updateButtonStatus(isMobileDevice ? '✅ Intentando descarga directa...' : 'Descargando...');
                } else {
                    // Si el proxy FALLÓ, se ejecuta el fallback de abrir el link original en una nueva pestaña.
                    updateButtonStatus('Abriendo link (FALLBACK)');
                    openCleanPopup(mediafireUrl);
                }
            }
        } catch(e) {
            updateButtonStatus('Error. Abriendo link...');
            openCleanPopup(mediafireUrl);
        }
    }
    
    // Restablecer el botón después de un breve retraso
    setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }, 3000); 
}

// Hacemos la función principal globalmente accesible para game-details-logic.js
window.handleGameDownload = handleGameDownload;
