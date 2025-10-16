// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// NOTA: Depende de 'data.js' (menuItems)
// NOTA: Depende de 'utils.js' (window.calculateAndApplyDimensions)
// NOTA: Depende de 'modal-logic.js' (window.abrirModal, window.updateGridSelection)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // Comprobación inicial de dependencias críticas
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems' o no es un array. Asegúrate de incluir 'data.js' correctamente.");
        return;
    }

    // --- Referencias del DOM y Constantes ---
    const rueda = document.getElementById('rueda');
    const backgroundContainer = document.getElementById('background-container');
    const opciones = [];

    const totalOpciones = menuItems.length;
    const anguloPorOpcion = 360 / totalOpciones;

    let currentRadius = 0;
    let indiceActual = 0;
    let rotacionObjetivoRueda = 0;
    let rotacionActualRueda = 0;
    const factorSuavizado = 0.15;
    let animacionFrameId = null;
    let capaFondoActual = null;

    const imageDirectory = "Sistemas/";
    const imageExtension = ".svg";
    const backgroundDirectory = "Fondos/";
    const backgroundExtension = ".jpg";
    
    // =========================================================================
    // LÓGICA DE DETECCIÓN Y SCROLL PARA MÓVILES (CINTA)
    // =========================================================================
    
    // Función para detectar si estamos en vista móvil (debe coincidir con el breakpoint del CSS)
    function checkMobileView() {
        return window.innerWidth <= 768;
    }

    // Función para hacer scroll al elemento seleccionado en la cinta vertical
    function scrollToSelectedIndex(index) {
        const selectedElement = opciones[index];
        const container = document.getElementById('rueda'); // Contenedor con scroll
        
        if (selectedElement && container && checkMobileView()) {
            // Calcular el scroll para centrar el elemento
            const itemRect = selectedElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            // Posición del centro del item relativa al inicio del contenedor
            const itemCenter = itemRect.top - containerRect.top + container.scrollTop + (itemRect.height / 2);
            
            // Posición objetivo: centro del contenedor - la mitad de la altura del item
            const targetScroll = itemCenter - (containerRect.height / 2);
            
            container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
    }
    // =========================================================================

    // --- 1. Generación Dinámica de Opciones ---
    menuItems.forEach((baseName, index) => {
        const opcion = document.createElement('div');
        opcion.classList.add('opcion');
        
        // Agregar el atributo title para que el CSS en móvil lo use como texto
        opcion.setAttribute('title', baseName.toUpperCase());

        const img = document.createElement('img');
        img.src = imageDirectory + baseName + imageExtension;
        img.alt = baseName;
        img.title = baseName;

        opcion.appendChild(img);
        rueda.appendChild(opcion);
        opciones.push(opcion);
    });

    const initialAngles = Array.from(opciones).map((op, index) => index * anguloPorOpcion);


    // --- 2. Funciones de Rotación y Animación y Utilidad ---

    // Expuesta globalmente para que 'utils.js' pueda corregir la orientación de los ítems.
    function corregirHorizontalidad() {
        const correccion = rotacionActualRueda * -1;
        opciones.forEach(opcion => {
            opcion.style.transform = `
                translate(-50%, -50%)
                rotate(${correccion}deg)
            `;
        });
    }
    window.corregirHorizontalidad = corregirHorizontalidad; 

    function animarRueda() {
        // DETENER ANIMACIÓN EN MÓVILES
        if (checkMobileView()) {
            rueda.style.transform = `none`; 
            cancelAnimationFrame(animacionFrameId);
            animacionFrameId = null;
            return;
        }
        
        const diferencia = rotacionObjetivoRueda - rotacionActualRueda;

        if (Math.abs(diferencia) < 0.01) {
            rotacionActualRueda = rotacionObjetivoRueda;
            cancelAnimationFrame(animacionFrameId);
            animacionFrameId = null;
        } else {
            rotacionActualRueda += diferencia * factorSuavizado;
            animacionFrameId = requestAnimationFrame(animarRueda);
        }

        rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
        corregirHorizontalidad();
    }

    function actualizarFondo() {
        const baseName = menuItems[indiceActual];
        const bgUrl = backgroundDirectory + baseName + backgroundExtension;

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
        
        // Si es móvil y se pide scroll, ejecutarlo
        if (scroll && checkMobileView()) {
            scrollToSelectedIndex(indiceActual);
        }
    }

    function rotarRueda(direccion) {
        indiceActual = (indiceActual + direccion + totalOpciones) % totalOpciones;
        
        if (!checkMobileView()) {
            // Lógica de rotación solo para PC
            rotacionObjetivoRueda += (direccion * -1) * anguloPorOpcion;

            if (animacionFrameId === null) {
                animacionFrameId = requestAnimationFrame(animarRueda);
            }
        }
        
        // Actualiza la selección (y maneja el scroll en móvil)
        actualizarSeleccion(true); 
    }
    
    function hayModalAbierto() {
        const modalOverlayRef = document.getElementById('modal-overlay');
        const gameDetailsOverlayRef = document.getElementById('game-details-overlay');
        
        const modalAbierto = modalOverlayRef && modalOverlayRef.classList.contains('open');
        const detallesAbierto = gameDetailsOverlayRef && gameDetailsOverlayRef.classList.contains('open');
        
        return modalAbierto || detallesAbierto;
    }


    // --- 3. Manejo de Eventos (Teclado y Rueda) ---

    let isScrolling = false;
    const scrollTimeout = 100;

    document.addEventListener('keydown', (event) => {
        if (hayModalAbierto()) return; 
        
        let direccion = 0;
        
        // ===============================================================
        // LÓGICA DE TECLADO MÓVIL (NAVEGACIÓN VERTICAL) VS PC (RUEDA)
        // ===============================================================
        
        if (checkMobileView()) {
            // En móvil, solo usamos ARRIBA/ABAJO (W/S) para navegar la cinta
            if (event.key === 'ArrowUp' || event.key === 'w') {
                direccion = -1;
            } else if (event.key === 'ArrowDown' || event.key === 's') {
                direccion = 1;
            }
        } else {
            // En PC, usamos IZQUIERDA/DERECHA (A/D) o ARRIBA/ABAJO (W/S) para rotar
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

    // Deshabilitar el scroll de la rueda del ratón en la vista de cinta
    document.addEventListener('wheel', (event) => {
        if (hayModalAbierto()) return; 
        
        // Deshabilitar la rueda del ratón si estamos en la vista de cinta, 
        // ya que el scroll de la cinta es nativo del navegador.
        if (checkMobileView()) return; 

        event.preventDefault();

        if (isScrolling) return;

        const direccion = event.deltaY > 0 ? 1 : -1;

        rotarRueda(direccion);

        isScrolling = true;
        setTimeout(() => {
            isScrolling = false;
        }, scrollTimeout);
    });

    // El evento 'click' funciona igual para ambas vistas (abrir el modal si ya está seleccionado o mover la selección)
    rueda.addEventListener('click', (event) => {
        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = opciones.indexOf(clickedOption);

        if (index === indiceActual) {
            window.abrirModal(menuItems[indiceActual]); 
            return;
        }

        // Lógica de cálculo de rotación más corta/eficiente (válida también para solo cambiar índice en móvil)
        let diferenciaPasos = index - indiceActual;
        
        if (!checkMobileView()) {
            // Solo para PC: asegura la rotación más corta
            if (Math.abs(diferenciaPasos) > totalOpciones / 2) {
                diferenciaPasos = (diferenciaPasos > 0)
                    ? diferenciaPasos - totalOpciones
                    : diferenciaPasos + totalOpciones;
            }
            rotacionObjetivoRueda += (diferenciaPasos * -1) * anguloPorOpcion;
            if (animacionFrameId === null) {
                animacionFrameId = requestAnimationFrame(animarRueda);
            }
        } else {
             // En móvil, no hay rotación, solo cambio de índice y scroll
             // El scroll se gestiona dentro de actualizarSeleccion(true)
        }
        
        indiceActual = index;
        actualizarSeleccion(true);
    });

    // --- 4. Inicialización y Redimensionamiento ---

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            
            const isMobile = checkMobileView();
            
            // Se llama a calculateAndApplyDimensions de utils.js (Solo afecta la disposición de PC)
            const result = window.calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, window.corregirHorizontalidad); 
            currentRadius = result.currentRadius;

            if (!isMobile) {
                // Restaurar la rotación para PC
                rotacionActualRueda = initialAngles[indiceActual] * -1;
                rotacionObjetivoRueda = rotacionActualRueda;
                rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
            } else {
                // Asegurar que no haya rotación en móvil
                rotacionActualRueda = 0;
                rotacionObjetivoRueda = 0;
                rueda.style.transform = `none`;
                scrollToSelectedIndex(indiceActual); // Scroll al sistema seleccionado después del resize
            }

            animarRueda(); // Esto re-inicia o detiene la animación según checkMobileView()
            
            // Lógica para recalcular la posición de la cuadrícula del modal si está abierto.
            const modalOverlayRef = document.getElementById('modal-overlay');
            if (modalOverlayRef && modalOverlayRef.classList.contains('open') && typeof window.updateGridSelection === 'function') {
                 window.updateGridSelection(window.currentGridIndex || 0, true, true, true);
            }
        }, 100); 
    });


    // Inicializar al cargar la página
    const result = window.calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, window.corregirHorizontalidad); 
    currentRadius = result.currentRadius;

    // Ajustar la rotación inicial para que el primer elemento quede centrado (solo aplica en PC)
    if (!checkMobileView()) {
        rotacionActualRueda = initialAngles[indiceActual] * -1;
        rotacionObjetivoRueda = rotacionActualRueda;
        rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
    } else {
        rotacionActualRueda = 0;
        rotacionObjetivoRueda = 0;
        // El CSS se encarga de posicionarlo como cinta
    }

    actualizarSeleccion(true); // Se fuerza el scroll inicial si es móvil
});