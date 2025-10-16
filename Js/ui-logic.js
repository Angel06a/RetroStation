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

    // --- 1. Generación Dinámica de Opciones ---
    menuItems.forEach((baseName, index) => {
        const opcion = document.createElement('div');
        opcion.classList.add('opcion');

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
    window.corregirHorizontalidad = corregirHorizontalidad; // 👈 Mantenido por necesidad de 'utils.js'

    function animarRueda() {
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

        // Optimización: No actualizar si el fondo es el mismo
        if (capaFondoActual && capaFondoActual.style.backgroundImage.includes(bgUrl)) {
            return;
        }

        const nuevaCapa = document.createElement('div');
        nuevaCapa.classList.add('background-layer');
        nuevaCapa.style.backgroundImage = `url('${bgUrl}')`;
        backgroundContainer.appendChild(nuevaCapa);

        // Forzar reflow para que la transición CSS (opacidad) funcione
        void nuevaCapa.offsetWidth;
        nuevaCapa.style.opacity = '1';

        if (capaFondoActual) {
            capaFondoActual.style.opacity = '0';
            
            // Eliminación de la capa anterior después de la transición
            const capaAEliminar = capaFondoActual;
            setTimeout(() => {
                if (backgroundContainer.contains(capaAEliminar)) {
                    backgroundContainer.removeChild(capaAEliminar);
                }
            }, 600); // Duración de la transición
        }

        capaFondoActual = nuevaCapa;
    }


    function actualizarSeleccion() {
        opciones.forEach(op => op.classList.remove('seleccionada'));
        opciones[indiceActual].classList.add('seleccionada');
        actualizarFondo();
    }

    function rotarRueda(direccion) {
        indiceActual = (indiceActual + direccion + totalOpciones) % totalOpciones;
        rotacionObjetivoRueda += (direccion * -1) * anguloPorOpcion;

        if (animacionFrameId === null) {
            animacionFrameId = requestAnimationFrame(animarRueda);
        }

        actualizarSeleccion();
    }
    
    // Función centralizada para verificar si un modal está abierto (evita repetición)
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
        if (hayModalAbierto()) return; // 👈 Uso de la función centralizada

        if (event.key === 'Enter') {
            window.abrirModal(menuItems[indiceActual]); 
            event.preventDefault();
            return;
        }

        let direccion = 0;

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            direccion = -1;
        }
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            direccion = 1;
        }

        if (direccion !== 0) {
            rotarRueda(direccion);
            event.preventDefault(); // Evitar scroll de página al usar flechas
        }
    });


    document.addEventListener('wheel', (event) => {
        if (hayModalAbierto()) return; // 👈 Uso de la función centralizada

        event.preventDefault();

        if (isScrolling) return;

        const direccion = event.deltaY > 0 ? 1 : -1;

        rotarRueda(direccion);

        isScrolling = true;
        setTimeout(() => {
            isScrolling = false;
        }, scrollTimeout);
    });


    rueda.addEventListener('click', (event) => {
        // No verificamos 'hayModalAbierto' aquí, ya que el modal clickado debe abrirse o si ya está abierto, 
        // asumimos que el click será manejado por la lógica del modal.
        
        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = opciones.indexOf(clickedOption);

        if (index === indiceActual) {
            window.abrirModal(menuItems[indiceActual]); 
            return;
        }

        // Lógica de cálculo de rotación más corta/eficiente (optimización de navegación con click)
        let diferenciaPasos = index - indiceActual;
        
        // Se asegura que la rotación sea en la dirección más corta
        if (Math.abs(diferenciaPasos) > totalOpciones / 2) {
            diferenciaPasos = (diferenciaPasos > 0)
                ? diferenciaPasos - totalOpciones
                : diferenciaPasos + totalOpciones;
        }

        rotacionObjetivoRueda += (diferenciaPasos * -1) * anguloPorOpcion;
        indiceActual = index;

        if (animacionFrameId === null) {
            animacionFrameId = requestAnimationFrame(animarRueda);
        }

        actualizarSeleccion();
    });

    // --- 4. Inicialización y Redimensionamiento ---

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Se llama a calculateAndApplyDimensions de utils.js
            const result = window.calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, window.corregirHorizontalidad); 
            currentRadius = result.currentRadius;

            // Lógica para recalcular la posición de la cuadrícula del modal si está abierto.
            const modalOverlayRef = document.getElementById('modal-overlay');
            if (modalOverlayRef && modalOverlayRef.classList.contains('open') && typeof window.updateGridSelection === 'function') {
                 // Depende de que 'currentGridIndex' sea accesible globalmente (o gestionado internamente por modal-logic.js)
                 // Se asume que modal-logic.js maneja su propio índice y se re-calcula la vista al redimensionar.
                 window.updateGridSelection(window.currentGridIndex || 0, true, true, true);
            }
        }, 100); // Debounce
    });


    // Inicializar al cargar la página
    const result = window.calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, window.corregirHorizontalidad); 
    currentRadius = result.currentRadius;

    // Ajustar la rotación inicial para que el primer elemento quede centrado
    rotacionActualRueda = initialAngles[indiceActual] * -1;
    rotacionObjetivoRueda = rotacionActualRueda;

    actualizarSeleccion();
});