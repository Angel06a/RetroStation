// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// ADAPTACIÓN: Descarga todos los archivos de una carpeta secuencialmente, 
// sin ventana de selección.
// MODIFICACIÓN: Implementación de lógica móvil (detección y uso de openCleanPopup)
// para FORZAR la apertura/descarga del LINK DIRECTO extraído por el proxy.
// =========================================================================

const linkCache = new Map();
const folderCache = new Map();

// --- Utilidades Básicas ---

// Detecta si el agente de usuario parece ser un dispositivo móvil
function isMobile() {
    return /Mobi/i.test(navigator.userAgent) || /Android/i.test(navigator.userAgent);
}

function triggerDownload(url) {
    // Si estamos en un dispositivo móvil, usamos openCleanPopup.
    // Esto asegura que la URL de descarga directa (obtenida por el proxy)
    // se abra en una nueva pestaña, evitando el bloqueo de "a.click()" programático
    // que es común en Chrome/Safari móvil para descargas que no son gestos directos.
    if (isMobile()) {
        openCleanPopup(url);
        return;
    }
    
    // Lógica original para PC (descarga automática sin nueva ventana)
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function openCleanPopup(url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    // Limpieza inmediata después del click.
    document.body.removeChild(a); 
}

// --- Lógica de Archivos Individuales y Extracción ---

function extractFromHTML(html) {
    // Patrones clave para el enlace directo de MediaFire (adaptados de download.js)
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

async function method2_externalServices(mediafireUrl) {
    const services = [
        // CORRECCIÓN: 'quest' cambiado a 'request' - La implementación ya es correcta
        `https://api.codetabs.com/v1/proxy?request=${encodeURIComponent(mediafireUrl)}`, 
        `https://corsproxy.io/?${encodeURIComponent(mediafireUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(mediafireUrl)}`,
    ];
    
    for (let service of services) {
        try {
            const response = await fetch(service);
            if (response.ok) {
                let html;
                if (service.includes('allorigins.win')) {
                    const data = await response.json();
                    html = data.contents;
                } else {
                    html = await response.text();
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

// --- Lógica de Carpetas (Adaptada de download.js) ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
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
        
        const response = await fetch(service);
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
    // Usar un servicio de scraping más avanzado
    try {
        const serviceUrl = `https://r.jina.ai/https://www.mediafire.com/folder/${folderKey}`;
        const response = await fetch(serviceUrl);
        
        if (response.ok) {
            const content = await response.text();
            
            // Buscar patrones en el contenido procesado (similar a download.js original)
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

async function downloadMultipleFiles(files, buttonElement) {
    const total = files.length;
    let downloaded = 0;
    
    const isMobileDevice = isMobile();
    
    const updateButtonStatus = (message) => {
        buttonElement.textContent = message;
    };
    
    updateButtonStatus(`📁 Iniciando descarga de ${total} archivos (0/${total})...`);
    
    // Descarga secuencial de archivos
    for (let file of files) {
        try {
            // Mensaje adaptado para móvil
            const actionText = isMobileDevice ? 'Abriendo link directo' : 'Descargando';
            updateButtonStatus(`📁 ${actionText} (${downloaded + 1}/${total}): ${file.name}`);
            
            // EL PROXY SIEMPRE SE EJECUTA AQUI PARA OBTENER EL ENLACE DIRECTO
            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                // Se usa triggerDownload, que internamente usa openCleanPopup si es móvil.
                triggerDownload(directUrl); 
                downloaded++;
                
                // Espera 1 segundo entre descargas para evitar bloqueos
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        } catch (error) {
            console.error(`Error descargando ${file.name}:`, error);
        }
    }
    
    updateButtonStatus(`✅ ${downloaded}/${total} archivos descargados`);
    
    if (downloaded === 0 && total > 0) {
        // Fallback si no se pudo descargar nada
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
                // Descargar TODOS los archivos directamente
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
                updateButtonStatus(isMobileDevice ? 'Abriendo descarga directa desde caché...' : 'Descargando desde caché...');
                triggerDownload(linkCache.get(mediafireUrl));
            } else {
                updateButtonStatus('Obteniendo enlace directo...');
                // LLAMADA AL PROXY
                const directUrl = await method2_externalServices(mediafireUrl);
                
                if (directUrl) {
                    linkCache.set(mediafireUrl, directUrl);
                    // triggerDownload usará openCleanPopup si es móvil, con la directUrl.
                    triggerDownload(directUrl);
                    updateButtonStatus(isMobileDevice ? '✅ Abriendo descarga en nueva pestaña' : 'Descargando...');
                } else {
                    updateButtonStatus('Abriendo link (FALLBACK)');
                    // Se abre el link original de MediaFire solo si el proxy FALLÓ.
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
