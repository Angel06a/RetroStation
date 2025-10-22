// game-details-logic.js: Lógica del Modal de Detalles del Juego
// MODIFICADO: Pre-carga de enlace de carpeta y archivo individual ahora es automática.
// El clic del usuario solo inicia la descarga síncrona.
let gameDetailsOverlay,gameDetailsCloseButton,gameDetailsImage,gameDetailsTitle,downloadButton;
let preloadedDirectUrl=null,folderFiles=null,currentFileIndex=0,isFolderMode=false,downloadUrlOriginal=null;
async function startFolderPreloadSequence(downloadUrl){
    if(!folderFiles||currentFileIndex>=folderFiles.length){
        downloadButton.textContent=`Descarga Completa (${folderFiles.length} archivos)`;
        downloadButton.disabled=true;
        setTimeout(()=>cerrarDetallesJuego(),2000);
        return
    }
    downloadButton.disabled=true;
    downloadButton.onclick=null;
    const currentFile=folderFiles[currentFileIndex];
    const totalFiles=folderFiles.length;
    downloadButton.textContent=`Cargando Enlace ${currentFileIndex+1} de ${totalFiles}: ${currentFile.name}`;
    try{
        if(typeof window.getDirectDownloadLink!=='function'||typeof window.triggerDownload!=='function'){
            throw new Error("Dependencias de descarga no disponibles.")
        }
        const directLink=await window.getDirectDownloadLink(currentFile.url);
        if(directLink){
            downloadButton.textContent=`Descargar ${currentFile.name} (${currentFileIndex+1}/${totalFiles})`;
            downloadButton.disabled=false;
            downloadButton.onclick=(event)=>{
                event.preventDefault();
                window.triggerDownload(directLink);
                currentFileIndex++;
                downloadButton.textContent='Descargando... Preparando siguiente.';
                downloadButton.disabled=true;
                startFolderPreloadSequence(downloadUrlOriginal)
            }
        }else{
            downloadButton.textContent=`Error ${currentFileIndex+1}/${totalFiles}. (Intentar de nuevo)`;
            downloadButton.disabled=false;
            downloadButton.onclick=(event)=>{
                event.preventDefault();
                startFolderPreloadSequence(downloadUrlOriginal)
            }
        }
    }catch(error){
        console.error("Fallo la pre-carga secuencial:",error);
        downloadButton.textContent=`Error ${currentFileIndex+1}/${totalFiles}. (Reintentar)`;
        downloadButton.disabled=false;
        downloadButton.onclick=(event)=>{
            event.preventDefault();
            startFolderPreloadSequence(downloadUrlOriginal)
        }
    }
}
function abrirDetallesJuego(gameName,imageUrl,downloadUrl){
    console.log(`-> Abriendo detalles del juego: ${gameName}`);
    if(!gameDetailsOverlay)return;
    gameDetailsImage.src=imageUrl;
    gameDetailsImage.alt=gameName;
    gameDetailsTitle.textContent=gameName;
    preloadedDirectUrl=null;
    folderFiles=null;
    currentFileIndex=0;
    isFolderMode=false;
    downloadUrlOriginal=downloadUrl;
    if(downloadUrl){
        downloadButton.textContent='Cargando Enlace...';
        downloadButton.disabled=true;
        downloadButton.onclick=null;
        if(downloadUrl.includes('/folder/')){
            isFolderMode=true;
            downloadButton.textContent='Buscando lista de archivos...';
            if(typeof window.getFolderContents==='function'&&typeof window.extractFolderKey==='function'){
                const folderKey=window.extractFolderKey(downloadUrl);
                if(folderKey){
                    window.getFolderContents(folderKey).then(files=>{
                        if(files&&files.length>0){
                            folderFiles=files;
                            currentFileIndex=0;
                            startFolderPreloadSequence(downloadUrl)
                        }else{
                            console.warn('Carpeta vacía o error al obtener contenido. Usando fallback asíncrono.');
                            updateDownloadButton(downloadUrl)
                        }
                    }).catch(error=>{
                        console.error("Fallo al obtener contenido de carpeta:",error);
                        updateDownloadButton(downloadUrl)
                    })
                }else{
                    updateDownloadButton(downloadUrl)
                }
            }else{
                updateDownloadButton(downloadUrl)
            }
        }else{
            if(typeof window.getDirectDownloadLink==='function'){
                window.getDirectDownloadLink(downloadUrl).then(directLink=>{
                    preloadedDirectUrl=directLink;
                    updateDownloadButton(downloadUrl)
                }).catch(error=>{
                    console.error("Fallo la pre-carga:",error);
                    updateDownloadButton(downloadUrl)
                })
            }else{
                updateDownloadButton(downloadUrl)
            }
        }
    }else{
        downloadButton.textContent='No disponible';
        downloadButton.disabled=true;
        downloadButton.onclick=null
    }
    gameDetailsOverlay.style.display='flex';
    setTimeout(()=>{
        gameDetailsOverlay.classList.add('open');
        window.inputLock=true
    },10)
}
function updateDownloadButton(downloadUrl){
    if(isFolderMode&&folderFiles){
        return
    }
    downloadButton.textContent='Descargar Juego';
    downloadButton.disabled=false;
    if(preloadedDirectUrl&&typeof window.triggerDownload==='function'){
        console.log('Botón configurado para descarga síncrona.');
        downloadButton.onclick=(event)=>{
            event.preventDefault();
            window.triggerDownload(preloadedDirectUrl);
            downloadButton.textContent='Descargando...';
            downloadButton.disabled=true;
            setTimeout(()=>cerrarDetallesJuego(),1000)
        }
    }else{
        console.log('Botón configurado para descarga asíncrona (con proxy).');
        downloadButton.onclick=(event)=>{
            event.preventDefault();
            if(typeof window.handleGameDownload==='function'){
                window.handleGameDownload(downloadUrl,downloadButton)
            }else{
                console.warn('handleGameDownload no disponible. Abriendo link directo.');
                window.open(downloadUrl,'_blank')
            }
        }
    }
}
function cerrarDetallesJuego(){
    if(!gameDetailsOverlay)return;
    gameDetailsOverlay.classList.remove('open');
    setTimeout(()=>{
        gameDetailsOverlay.style.display='none';
        window.inputLock=false;
        preloadedDirectUrl=null;
        folderFiles=null;
        currentFileIndex=0;
        isFolderMode=false;
        downloadUrlOriginal=null
    },300)
}
function hideGameDetailsHard(){
    if(!gameDetailsOverlay)return;
    gameDetailsOverlay.classList.remove('open');
    gameDetailsOverlay.style.display='none';
    preloadedDirectUrl=null;
    folderFiles=null;
    currentFileIndex=0;
    isFolderMode=false;
    downloadUrlOriginal=null
}
window.abrirDetallesJuego=abrirDetallesJuego;
window.cerrarDetallesJuego=cerrarDetallesJuego;
window.hideGameDetailsHard=hideGameDetailsHard;
document.addEventListener('DOMContentLoaded',()=>{
    gameDetailsOverlay=document.getElementById('game-details-overlay');
    gameDetailsCloseButton=document.getElementById('game-details-close');
    gameDetailsImage=document.getElementById('game-details-image');
    gameDetailsTitle=document.getElementById('game-details-title');
    downloadButton=document.querySelector('.download-button');
    if(gameDetailsCloseButton)gameDetailsCloseButton.addEventListener('click',cerrarDetallesJuego);
    if(gameDetailsOverlay)gameDetailsOverlay.addEventListener('click',(event)=>{
        if(event.target===gameDetailsOverlay){
            cerrarDetallesJuego()
        }
    })
});