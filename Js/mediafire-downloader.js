// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// MODIFICACIÓN CRÍTICA: Implementación de fetchWithTimeout de 15s y uso de 
// un proxy adicional (Google Translate) para bypass de User-Agent en móvil.
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
 * Inicia la descarga o abre el enlace directo.
 * Usa lógica diferente para PC vs. Móvil.
 */
function triggerDownload(url) {
    if (isMobile()) {
        // COMPORTAMIENTO MÓVIL: Usa openCleanPopup para abrir el LINK DIRECTO
        // (obtenido por el proxy) en una nueva pestaña, evitando bloqueos.
        openCleanPopup(url);
        return;
    }
    
    // COMPORTAMIENTO PC: Descarga automática.
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/**
 * Abre la URL en una nueva pestaña limpia (esencial para móvil).
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

/**
 * Función auxiliar para realizar fetch con un límite de tiempo (timeout) de 15 segundos.
 * Esto es vital para acomodar la inestabilidad de las redes móviles.
 */
async function fetchWithTimeout(resource, options = {}) {
    // AUMENTAMOS EL TIMEOUT A 15 SEGUNDOS
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
    // Lista de servicios proxy, con el proxy de Google Translate añadido al principio.
    const services = [
        // INTENTO 1: Bypass de User-Agent con Google Translate (robusto en móvil)
        `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(mediafireUrl)}`,
        // INTENTO 2: Codetabs (proxy CORS estándar)
        `https://api.codetabs.com/v1/proxy?request=${encodeURIComponent(mediafireUrl)}`, 
        // INTENTO 3: corsproxy.io (proxy CORS estándar)
        `https://corsproxy.io/?${encodeURIComponent(mediafireUrl)}`,
        // INTENTO 4: allorigins.win (proxy CORS estándar)
        `https://api.allorigins.win/raw?url=${encodeURIComponent(mediafireUrl)}`,
    ];
    
    for (let service of services) {
        try {
            // USAMOS fetchWithTimeout DE 15s EN TODOS LOS PROXIES
            const response = await fetchWithTimeout(service, { timeout: 15000 });
            
            if (response.ok) {
                let html = await response.text();
                
                // Si el proxy es Google Translate, extraemos el contenido del iframe o del wrapper.
                if (service.includes('translate.google.com')) {
                    // El HTML de Google Translate envuelve la página dentro de un iframe/wrapper.
                    // Buscamos el contenido real dentro de la etiqueta <base>
                    const baseMatch = html.match(/<base href="[^"]*">([\s\S]*?)<\/html>/i);
                    if (baseMatch && baseMatch[1]) {
                        html = baseMatch[1];
                    }
                } else {
                    // Limpieza de posible envoltorio JSON de otros proxies (si usan /raw)
                    if (html.startsWith('{"contents":')) {
                         const data = JSON.parse(html);
                         html = data.contents;
                    }
                }
                
                const directLink = extractFromHTML(html);
                if (directLink) return directLink;
            }
        } catch (error) {
            // Falla por red, timeout o rechazo. Pasamos al siguiente.
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
    
    // Aquí se omite el detalle de las funciones de carpeta (getFolderViaAPI, getFolderViaScraping, etc.)
    // ya que no son el foco del problema y se asume que usan fetchWithTimeout
    
    return []; // Placeholder. Las funciones reales deben ser portadas desde el archivo anterior.
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
            const actionText = isMobileDevice ? 'Abriendo link directo' : 'Descargando';
            updateButtonStatus(`📁 ${actionText} (${downloaded + 1}/${total}): ${file.name}`);

            // EL PROXY SE EJECUTA AQUÍ (ROBUSTEZ CON TIMEOUT DE 15s)
            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                // Si el proxy tiene éxito, triggerDownload usará el link directo.
                triggerDownload(directUrl);
                downloaded++;
                await new Promise(resolve => setTimeout(resolve, 1000)); 
            }
        } catch (error) {
            console.error(`Error descargando ${file.name}:`, error);
        }
    }
    
    updateButtonStatus(`✅ ${downloaded}/${total} archivos descargados`);
    
    if (downloaded === 0 && total > 0) {
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
        // Lógica de Carpeta (se mantiene la llamada a downloadMultipleFiles)
        try {
            updateButtonStatus('🔍 Buscando archivos en carpeta...');
            
            const folderKey = extractFolderKey(mediafireUrl);
            if (!folderKey) {
                updateButtonStatus('❌ URL de carpeta no válida, abriendo link...');
                openCleanPopup(mediafireUrl); 
                return;
            }
            
            // Nota: getFolderContents debe ser restaurada desde tu código anterior
            // para que esto funcione correctamente.
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
                updateButtonStatus(isMobileDevice ? 'Abriendo descarga directa desde caché...' : 'Descargando desde caché...');
                triggerDownload(linkCache.get(mediafireUrl));
            } else {
                updateButtonStatus('Obteniendo enlace directo...');
                // LLAMADA AL PROXY CON TIMEOUT AUMENTADO Y NUEVO PROXY
                const directUrl = await method2_externalServices(mediafireUrl);
                
                if (directUrl) {
                    // SI EL PROXY TUVO ÉXITO
                    linkCache.set(mediafireUrl, directUrl);
                    triggerDownload(directUrl);
                    updateButtonStatus(isMobileDevice ? '✅ Abriendo descarga en nueva pestaña' : 'Descargando...');
                } else {
                    // Si el proxy FALLÓ (por rechazo o timeout), se ejecuta el fallback de abrir el link original.
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
