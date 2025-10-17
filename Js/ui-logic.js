// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// NOTA: Depende de 'data.js' (menuItems)
// NOTA: Depende de 'utils.js' (window.calculateAndApplyDimensions)
// NOTA: Depende de 'modal-logic.js' (window.abrirModal, window.updateGridSelection)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 0. Dependencias y Comprobación Inicial ---
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems' o no es un array. Asegúrate de incluir 'data.js' correctamente.");
        return;
    }

    // --- 1. Referencias del DOM y Constantes (usando const y desestructuración) ---
    const rueda = document.getElementById('rueda');
    const backgroundContainer = document.getElementById('background-container');
    const opciones = []; // Llenado en la sección 2

    const totalOpciones = menuItems.length;
    const anguloPorOpcion = 360 / totalOpciones;
    
    // Configuraciones de Archivos
    const config = {
        imageDirectory: "Sistemas/",
        imageExtension: ".svg",
        backgroundDirectory: "Fondos/",
        backgroundExtension: ".jpg",
        breakpoint: 768, // Debe coincidir con el CSS
        factorSuavizado: 0.15,
        scrollTimeout: 100
    };

    // Variables de Estado (usando let)
    let currentRadius = 0;
    let indiceActual = 0;
    let rotacionObjetivoRueda = 0;
    let rotacionActualRueda = 0;
    let animacionFrameId = null;
    let capaFondoActual = null;
    let isMobileView = false;
    let isScrolling = false;

    // =========================================================================
    // 2. LÓGICA DE VISTA (MÓVIL / PC) Y SCROLL
    // =========================================================================
    
    function checkMobileView() {
        return window.innerWidth <= config.breakpoint;
    }

    function scrollToSelectedIndex(index) {
        if (!isMobileView) return;
        
        const selectedElement = opciones[index];
        const container = rueda; 
        
        if (selectedElement && container) {
            const itemRect = selectedElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            const itemCenter = itemRect.top - containerRect.top + container.scrollTop + (itemRect.height / 2);
            const targetScroll = itemCenter - (containerRect.height / 2);
            
            container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
    }
    
    // Función central para actualizar la rotación/scroll según la vista
    function updateViewState() {
        if (isMobileView) {
            rueda.style.transform = `none`; 
            cancelAnimationFrame(animacionFrameId);
            animacionFrameId = null;
            scrollToSelectedIndex(indiceActual);
        } else {
            // Asegurar la rotación inicial y reiniciar animación si aplica
            if (animacionFrameId === null) {
                // Sincronizar rotación con el índice actual al cambiar de móvil a PC
                rotacionActualRueda = initialAngles[indiceActual] * -1;
                rotacionObjetivoRueda = rotacionActualRueda;
                rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
                corregirHorizontalidad();
            }
            animarRueda();
        }
    }
    
    function hayModalAbierto() {
        const modalOverlayRef = document.getElementById('modal-overlay');
        const gameDetailsOverlayRef = document.getElementById('game-details-overlay');
        
        // Uso de encadenamiento opcional para simplificar y concisar
        const modalAbierto = modalOverlayRef?.classList.contains('open');
        const detallesAbierto = gameDetailsOverlayRef?.classList.contains('open');
        
        return modalAbierto || detallesAbierto;
    }

    // =========================================================================
    // 3. Generación y Funciones de Rueda
    // =========================================================================

    // Generación Dinámica de Opciones
    menuItems.forEach((baseName, index) => {
        const opcion = document.createElement('div');
        opcion.classList.add('opcion');
        opcion.setAttribute('title', baseName.toUpperCase());
        opcion.dataset.index = index;

        const img = document.createElement('img');
        img.src = config.imageDirectory + baseName + config.imageExtension;
        img.alt = baseName;
        img.title = baseName;

        opcion.appendChild(img);
        rueda.appendChild(opcion);
        opciones.push(opcion);
    });

    const initialAngles = Array.from(opciones).map((op, index) => index * anguloPorOpcion);


    // Expuesta globalmente para que 'utils.js' pueda corregir la orientación de los ítems.
    function corregirHorizontalidad() {
        const correccion = rotacionActualRueda * -1;
        opciones.forEach(opcion => {
            // MODIFICADO: Se agrega translateZ(0) para forzar la aceleración GPU
            opcion.style.transform = `
                translate(-50%, -50%)
                rotate(${correccion}deg)
                translateZ(0) 
            `;
        });
    }
    window.corregirHorizontalidad = corregirHorizontalidad; 

    function animarRueda() {
        if (isMobileView) return;
        
        const diferencia = rotacionObjetivoRueda - rotacionActualRueda;

        if (Math.abs(diferencia) < 0.01) {
            rotacionActualRueda = rotacionObjetivoRueda;
            cancelAnimationFrame(animacionFrameId);
            animacionFrameId = null;
        } else {
            rotacionActualRueda += diferencia * config.factorSuavizado;
            animacionFrameId = requestAnimationFrame(animarRueda);
        }

        rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
        corregirHorizontalidad();
    }

    function actualizarFondo() {
        const baseName = menuItems[indiceActual];
        const bgUrl = config.backgroundDirectory + baseName + config.backgroundExtension;

        if (capaFondoActual && capaFondoActual.style.backgroundImage.includes(bgUrl)) {
            return;
        }

        const nuevaCapa = document.createElement('div');
        nuevaCapa.classList.add('background-layer');
        nuevaCapa.style.backgroundImage = `url('${bgUrl}')`;
        backgroundContainer.appendChild(nuevaCapa);

        void nuevaCapa.offsetWidth; 
        nuevaCapa.style.opacity = '1';

        if (capaFondoActual) {
            capaFondoActual.style.opacity = '0';
            
            const capaAEliminar = capaFondoActual;
            setTimeout(() => {
                if (backgroundContainer.contains(capaAEliminar)) {
                    backgroundContainer.removeChild(capaAEliminar);
                }
            }, 600);
        }

        capaFondoActual = nuevaCapa;
    }


    function actualizarSeleccion(scroll = false) {
        opciones.forEach(op => op.classList.remove('seleccionada'));
        opciones[indiceActual].classList.add('seleccionada');
        actualizarFondo();
        
        if (scroll) {
            scrollToSelectedIndex(indiceActual);
        }
    }

    function rotarRueda(direccion) {
        indiceActual = (indiceActual + direccion + totalOpciones) % totalOpciones;
        
        if (!isMobileView) {
            rotacionObjetivoRueda += (direccion * -1) * anguloPorOpcion;

            if (animacionFrameId === null) {
                animacionFrameId = requestAnimationFrame(animarRueda);
            }
        }
        
        actualizarSeleccion(true); 
    }
    
    // =========================================================================
    // 4. Manejo de Eventos (Teclado y Rueda)
    // =========================================================================

    document.addEventListener('keydown', (event) => {
        if (hayModalAbierto()) return; 
        
        let direccion = 0;
        
        // En móvil, solo ARRIBA/ABAJO (W/S) mueven la cinta
        if (isMobileView) {
            if (event.key === 'ArrowUp' || event.key === 'w') {
                direccion = -1;
            } else if (event.key === 'ArrowDown' || event.key === 's') {
                direccion = 1;
            }
        } else {
            // En PC, cualquier tecla de dirección mueve la rueda
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'a' || event.key === 'w') {
                direccion = -1;
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'd' || event.key === 's') {
                direccion = 1;
            }
        }

        if (direccion !== 0) {
            rotarRueda(direccion);
            event.preventDefault(); 
            return;
        }

        if (event.key === 'Enter') {
            window.abrirModal(menuItems[indiceActual]); 
            event.preventDefault();
            return;
        }
    });

    document.addEventListener('wheel', (event) => {
        if (hayModalAbierto() || isMobileView) return; 

        event.preventDefault();

        if (isScrolling) return;

        const direccion = event.deltaY > 0 ? 1 : -1;

        rotarRueda(direccion);

        isScrolling = true;
        setTimeout(() => {
            isScrolling = false;
        }, config.scrollTimeout);
    });

    rueda.addEventListener('click', (event) => {
        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = parseInt(clickedOption.dataset.index, 10);

        if (index === indiceActual) {
            window.abrirModal(menuItems[indiceActual]); 
            return;
        }

        let diferenciaPasos = index - indiceActual;
        
        if (!isMobileView) {
            // PC: calcular la rotación más corta
            if (Math.abs(diferenciaPasos) > totalOpciones / 2) {
                diferenciaPasos = (diferenciaPasos > 0)
                    ? diferenciaPasos - totalOpciones
                    : diferenciaPasos + totalOpciones;
            }
            rotacionObjetivoRueda += (diferenciaPasos * -1) * anguloPorOpcion;
            if (animacionFrameId === null) {
                animacionFrameId = requestAnimationFrame(animarRueda);
            }
        }
        
        indiceActual = index;
        actualizarSeleccion(true);
    });

    // =========================================================================
    // 5. Inicialización y Redimensionamiento
    // =========================================================================

    function initializeView(initialLoad = false) {
        // 1. Recalcular dimensiones (afecta el radio de la rueda en PC)
        const result = window.calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, window.corregirHorizontalidad); 
        currentRadius = result.currentRadius;
        
        // 2. Actualizar el estado de la vista
        const newIsMobileView = checkMobileView();
        
        if (newIsMobileView !== isMobileView || initialLoad) {
            isMobileView = newIsMobileView;
            updateViewState();
        }

        // 3. Recalcular posición del modal si está abierto (post-resize)
        const modalOverlayRef = document.getElementById('modal-overlay');
        if (modalOverlayRef?.classList.contains('open') && typeof window.updateGridSelection === 'function') {
             window.updateGridSelection(window.currentGridIndex || 0, true, true, true);
        }

        actualizarSeleccion(true);
    }
    
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            initializeView(false);
        }, 100); 
    });


    // Ejecutar inicialización al cargar la página
    initializeView(true);
});