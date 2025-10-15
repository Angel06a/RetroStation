// =========================================================================
// UI_LOGIC.JS: Rueda Dinámica, Animación y Navegación Principal
// SE ELIMINA 'import'. Las funciones 'calculateAndApplyDimensions' y 'abrirModal'
// ahora están en el ámbito global.
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // Verificar que `menuItems` y `abrirModal` existan en el ámbito global.
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems' o no es un array. Asegúrate de incluir 'data.js' correctamente.");
        return;
    }
    
    // Verificación de dependencia para asegurar que 'modal_logic.js' se cargó.
    if (typeof abrirModal !== 'function') {
         console.error("La función 'abrirModal' no está definida. Asegúrate de cargar 'modal_logic.js' ANTES de 'ui_logic.js'.");
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
    let inputLock = false; 
    
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


    // --- 2. Funciones de Rotación y Animación ---

    function corregirHorizontalidad() {
        const correccion = rotacionActualRueda * -1;
        
        opciones.forEach(opcion => {
            opcion.style.transform = `
                translate(-50%, -50%) 
                rotate(${correccion}deg)
            `;
        });
    }

    function animarRueda() {
        // ... (cuerpo de la función animarRueda se mantiene igual) ...
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
        // ... (cuerpo de la función actualizarFondo se mantiene igual) ...
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
    
    // --- 3. Manejo de Eventos (Teclado y Rueda) ---
    
    let isScrolling = false;
    const scrollTimeout = 100; 

    document.addEventListener('keydown', (event) => {
        const modalOverlay = document.getElementById('modal-overlay'); // Re-obtener la ref. para asegurar que exista.
        const gameDetailsOverlay = document.getElementById('game-details-overlay');
        
        const modalAbierto = modalOverlay.classList.contains('open');
        const detallesAbierto = gameDetailsOverlay.classList.contains('open');

        if (modalAbierto || detallesAbierto) return;
        
        if (event.key === 'Enter') {
            abrirModal(menuItems[indiceActual]); // Llamada a función global
            event.preventDefault();
            return;
        }
        
        let direccion = 0; 
        
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            direccion = -1; 
            event.preventDefault(); 
        } 
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            direccion = 1; 
            event.preventDefault(); 
        }

        if (direccion !== 0) {
            rotarRueda(direccion);
        }
    });

    
    document.addEventListener('wheel', (event) => {
        const modalOverlay = document.getElementById('modal-overlay'); // Re-obtener la ref.
        const gameDetailsOverlay = document.getElementById('game-details-overlay');
        
        const modalAbierto = modalOverlay.classList.contains('open');
        const detallesAbierto = gameDetailsOverlay.classList.contains('open');
        
        if (modalAbierto || detallesAbierto) return;
        
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
        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = opciones.indexOf(clickedOption);

        if (index === indiceActual) {
            abrirModal(menuItems[indiceActual]); // Llamada a función global
            return;
        }
        
        let diferenciaPasos = index - indiceActual;
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
            // Asumimos que 'updateGridSelection' está definido en 'modal_logic.js' y es global.
            const modalOverlay = document.getElementById('modal-overlay'); // Re-obtener la ref.
            
            const result = calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, corregirHorizontalidad); // Llamada a función global
            currentRadius = result.currentRadius; 
            
            if (modalOverlay.classList.contains('open') && typeof updateGridSelection === 'function') {
                 // Llamamos a la función global 'updateGridSelection' del otro archivo.
                 updateGridSelection(currentGridIndex, true, true, true);
            }
        }, 100); 
    });


    // Inicializar al cargar
    const result = calculateAndApplyDimensions(rueda, opciones, initialAngles, anguloPorOpcion, totalOpciones, corregirHorizontalidad); // Llamada a función global
    currentRadius = result.currentRadius;
    
    rotacionActualRueda = initialAngles[indiceActual] * -1;
    rotacionObjetivoRueda = rotacionActualRueda;

    actualizarSeleccion(); 
});

// =========================================================================