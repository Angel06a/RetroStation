// =========================================================================
// mediafire-downloader.js: Lógica de Descarga Directa y Manejo de Carpetas
// MODIFICACIÓN CRÍTICA: Se ELIMINA el openCleanPopup de triggerDownload en móvil
// para intentar forzar la DESCARGA DIRECTA en la misma pestaña (comportamiento PC).
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
 * Ahora usa el mismo método que PC para intentar la descarga directa en móvil.
 */
function triggerDownload(url) {
    // EN MÓVIL Y PC: Intentamos iniciar la descarga en la pestaña actual.
    // Los navegadores móviles son más estrictos, pero para una URL de descarga directa,
    // a veces lo permiten sin abrir una nueva pestaña, que es tu objetivo.
    // Si falla, el navegador móvil simplemente ignora el a.click() después del async.
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // NOTA: Si esta técnica falla en móvil (lo más probable), la única alternativa
    // que funciona consistentemente es abrir una nueva pestaña (openCleanPopup).
    // Si el usuario quiere evitar la nueva pestaña, debe aceptar que la descarga
    // podría no iniciarse automáticamente debido a las políticas de seguridad.
}

/**
 * Función de respaldo para abrir la URL en una nueva pestaña (Mantenida por si acaso).
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

// --- Lógica de Archivos Individuales y Extracción (Sin Cambios) ---

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
    // Lista de servicios proxy
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

// --- Lógica de Carpetas (Se asume que la lógica interna sigue usando la misma lógica de descarga) ---

function extractFolderKey(folderUrl) {
    const matches = folderUrl.match(/mediafire\.com\/folder\/([a-zA-Z0-9]+)/);
    return matches ? matches[1] : null;
}

// (Omitiendo la implementación de getFolderContents, getFolderViaAPI, etc. por brevedad)
// **NOTA: Debes asegurarte de que estas funciones estén restauradas de tu código anterior.**
async function getFolderContents(folderKey) { 
    // ... tu implementación de carpeta ...
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
            const actionText = 'Descargando'; // No especificamos "Abriendo link" ya que no queremos nueva pestaña
            updateButtonStatus(`📁 ${actionText} (${downloaded + 1}/${total}): ${file.name}`);

            const directUrl = await method2_externalServices(file.url);
            
            if (directUrl) {
                // USA triggerDownload sin lógica de nueva pestaña.
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
        // Fallback: Si el intento de descarga falló, se ofrece abrir el link original
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
                updateButtonStatus('Descargando desde caché...');
                triggerDownload(linkCache.get(mediafireUrl));
            } else {
                updateButtonStatus('Obteniendo enlace directo...');
                const directUrl = await method2_externalServices(mediafireUrl);
                
                if (directUrl) {
                    // SI EL PROXY TUVO ÉXITO
                    linkCache.set(mediafireUrl, directUrl);
                    // triggerDownload usará el método de PC (sin nueva pestaña).
                    triggerDownload(directUrl);
                    updateButtonStatus('Descargando...');
                } else {
                    // Si el proxy FALLÓ, se ejecuta el fallback (con nueva pestaña para forzar apertura).
                    updateButtonStatus('Abriendo link (FALLBACK)');
                    openCleanPopup(mediafireUrl); 
                }
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
