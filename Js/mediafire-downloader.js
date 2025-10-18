// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// VERSIÓN FINAL COMPLETA:
// 1. Descarga individual: Sin caché para funcionar siempre en móvil.
// 2. Carpetas: Funciones completas restauradas y robustas con Timeout de 15s.
//
// NOTA DE SOLUCIÓN AL AVISO DE CHROME:
// Se ha priorizado el uso de 'triggerDownload' y se ha ajustado el 'fallback'
// para que el mensaje de "Abriendo link (FALLBACK)" sea más claro en la interfaz
// antes de llamar a 'openCleanPopup', ya que el aviso del navegador es sobre
// la apertura programática de pestañas después de una cadena de navegación sin interacción.
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

// --- Lógica de Carpetas COMPLETA Y RESTAURADA ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
}

async function getFolderViaAPI(folderKey) {
    try {
        // Fetch normal aquí, ya que es una API de MediaFire, no un proxy de scraping.
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
        
        // **USAMOS EL TIMEOUT DE 15s PARA EL SCRAPING**
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
    
    // PATRÓN 1: Buscar elementos con data-key
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
    
    // PATRÓN 3: Buscar en la estructura de datos JSON (oPageData)
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
            console.log('No se pudo parsear JSON de página');
        }
    }
    
    // Eliminar duplicados por key
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

async function getFolderViaExternalService(folderKey) {
    try {
        const serviceUrl = `https://r.jina.ai/https://www.mediafire.com/folder/${folderKey}`;
        // **USAMOS EL TIMEOUT DE 15s PARA EL SERVICIO EXTERNO**
        const response = await fetchWithTimeout(serviceUrl, { timeout: 15000 }); 
        
        if (response.ok) {
            const content = await response.text();
            
            // Buscar patrones en el contenido procesado 
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
                    
                    files.push({
                        name: fileName,
                        url: `https://www.mediafire.com/file/${key}`,
                        key: key
                    });
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
    } catch (error) {
        console.error('Error servicio externo:', error);
    }
    return [];
}

async function getFolderContents(folderKey) {
    if (folderCache.has(folderKey)) {
        return folderCache.get(folderKey);
    }
    
    console.log('Buscando archivos para carpeta:', folderKey);
    
    // Método 1: API directa de MediaFire
    try {
        const apiFiles = await getFolderViaAPI(folderKey);
        if (apiFiles.length > 0) {
            folderCache.set(folderKey, apiFiles);
            return apiFiles;
        }
    } catch (error) {
        console.log('Método API falló:', error);
    }
    
    // Método 2: Scraping mejorado
    try {
        const scrapedFiles = await getFolderViaScraping(folderKey);
        if (scrapedFiles.length > 0) {
            folderCache.set(folderKey, scrapedFiles);
            return scrapedFiles;
        }
    } catch (error) {
        console.log('Método scraping falló:', error);
    }
    
    // Método 3: Servicio externo especializado (Jina AI Reader)
    try {
        const externalFiles = await getFolderViaExternalService(folderKey);
        if (externalFiles.length > 0) {
            folderCache.set(folderKey, externalFiles);
            return externalFiles;
        }
    } catch (error) {
        console.log('Método externo falló:', error);
    }
    
    return [];
}


async function downloadMultipleFiles(files, buttonElement) {
    const total = files.length;
    let downloaded = 0;
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };
    
    updateButtonStatus(`Iniciando descarga de ${total} archivos (0/${total})...`);
    
    for (let file of files) {
        try {
            const actionText = 'Descargando';
            updateButtonStatus(`${actionText} (${downloaded + 1}/${total}): ${file.name}`);

            // Esta llamada usa el proxy robusto (method2_externalServices)
            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                triggerDownload(directUrl);
                downloaded++;
                // Pequeña pausa para evitar colapsar el navegador con múltiples descargas
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        } catch (error) {
            console.error(`Error descargando ${file.name}:`, error);
        }
    }
    
    updateButtonStatus(`${downloaded}/${total} archivos procesados`);
    
    // Si ninguna descarga se inició, abrimos el link del primer archivo como fallback
    if (downloaded === 0 && total > 0) {
        updateButtonStatus(`FALLBACK: Abriendo link de ${files[0].name}`);
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
        // Lógica de Carpeta
        try {
            updateButtonStatus('Buscando archivos en carpeta...');
            
            const folderKey = extractFolderKey(mediafireUrl);
            if (!folderKey) {
                updateButtonStatus('URL de carpeta no válida, abriendo link...');
                openCleanPopup(mediafireUrl); 
                return;
            }
            
            const files = await getFolderContents(folderKey);
            
            if (files && files.length > 0) {
                await downloadMultipleFiles(files, buttonElement);
                
            } else {
                updateButtonStatus('Carpeta vacía o error, abriendo link...');
                openCleanPopup(mediafireUrl);
            }
            
        } catch (error) {
            console.error('Error en el manejo de carpeta:', error);
            updateButtonStatus('Error, abriendo link...');
            openCleanPopup(mediafireUrl);
        }
        
    } else {
        // Lógica de Archivo Individual: SIN CACHEO (para funcionar siempre en móvil)
        try {
            // SIEMPRE llamamos al proxy para forzar el comportamiento ASÍNCRONO
            updateButtonStatus('Obteniendo enlace directo...');
            const directUrl = await method2_externalServices(mediafireUrl);
            
            if (directUrl) {
                // Ya no guardamos en caché.
                triggerDownload(directUrl);
                updateButtonStatus('Descargando...');
            } else {
                // Si el proxy FALLÓ, se ejecuta el fallback.
                // AVISO DE CHROME: El 'openCleanPopup' aquí es el que puede generar el aviso.
                // Se mantiene la función, pero se asegura que el mensaje del botón
                // sea el último paso antes de abrir el enlace.
                updateButtonStatus('FALLBACK: Abriendo link');
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
