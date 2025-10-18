// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// OPTIMIZACIÓN AVANZADA: Desacoplamiento de dependencias globales
// OPTIMIZACIÓN DE RENDERING: Creación de Opciones en Chunks con requestAnimationFrame (rAF)
// OPTIMIZACIÓN ADICIONAL: Mejor Coherencia de Estado y Rendimiento de Rendering
// =========================================================================

// --- 0. Configuraciones Comunes (Mejorar Cohesión) ---
const CONFIG = {
    imageDirectory: "Sistemas/",
    imageExtension: ".svg",
    backgroundDirectory: "Fondos/",
    backgroundExtension: ".jpg",
    breakpoint: 768,
    factorSuavizado: 0.15,
    scrollTimeout: 100,
    animacionDuracionFondo: 600,
    ruedaTransformBase: 'translateY(-50%)', // Cache para animación
    opcionTransformBase: 'translate(-50%, -50%)', // Cache para items
};

/**
 * Clase que gestiona la lógica, el estado y la animación de la Rueda Dinámica.
 */
class RuedaDinamica {
    /**
     * @param {string[]} menuItems - Lista de ítems del menú.
     * @param {Object} config - Configuraciones de directorios y animación.
     * @param {Object} callbacks - Funciones de acción externas (abrirModal, etc.).
     */
    constructor(menuItems, config, callbacks) {

        // --- Dependencias (Desacopladas) ---
        this.callbacks = callbacks; // { abrirModal, updateGridSelection, calculateAndApplyDimensions }

        // Referencias DOM y Constantes
        this.rueda = document.getElementById('rueda');
        this.backgroundContainer = document.getElementById('background-container');
        this.modalOverlayRef = document.getElementById('modal-overlay');
        this.gameDetailsOverlayRef = document.getElementById('game-details-overlay');

        if (!this.rueda) {
            console.error("El elemento con ID 'rueda' no fue encontrado.");
            return;
        }

        // Datos y Configuración
        this.menuItems = menuItems;
        this.config = config;
        this.opciones = [];
        this.totalOpciones = menuItems.length;
        this.anguloPorOpcion = 360 / this.totalOpciones;

        // Variables de Estado
        this.currentRadius = 0;
        this.indiceActual = 0;
        this.rotacionObjetivoRueda = 0;
        this.rotacionActualRueda = 0;
        this.animacionFrameId = null;
        this.capaFondoActual = null;
        this.isMobileView = false;
        this.isScrolling = false;
        this.isRotatingFromClick = false;
        this.opcionSeleccionadaAnterior = null; // 🟢 OPTIMIZACIÓN 4: Cache para la opción seleccionada

        // Inicialización y Eventos (La generación ahora es asíncrona)
        this.generarOpcionesOptimizada(() => {
            // Callback que se ejecuta después de que todos los ítems se crean.
            this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
            this.initializeGlobalCorrector();
            this.attachEventListeners();

            // ⚡️ OPTIMIZACIÓN 1: Inicializar 'will-change' al cargar, pero solo si no es móvil
            this.checkMobileView(); // Establece this.isMobileView
            this.setWillChangeState(!this.isMobileView); // Aplicar will-change si no es móvil

            this.initializeView(true);
        });
    }

    // =========================================================================
    // Generación y Lógica de Animación
    // =========================================================================

    /**
     * 🟢 OPTIMIZACIÓN MAYOR: Crea las opciones del menú de forma asíncrona usando rAF.
     * Esto evita bloquear el hilo principal durante la creación masiva de DOM.
     * @param {function} onComplete - Callback que se ejecuta al terminar la creación.
     */
    generarOpcionesOptimizada(onComplete) {
        let index = 0;
        const totalItems = this.menuItems.length;

        const processChunk = () => {
            // Procesar un número pequeño de ítems por frame. 1 es lo más seguro.
            const itemsPerFrame = 1;
            let itemsProcessed = 0;

            while (index < totalItems && itemsProcessed < itemsPerFrame) {
                const baseName = this.menuItems[index];
                const opcion = document.createElement('div');
                opcion.classList.add('opcion');
                opcion.setAttribute('title', baseName.toUpperCase());
                opcion.dataset.index = index;

                const img = document.createElement('img');
                img.src = this.config.imageDirectory + baseName + this.config.imageExtension;
                img.alt = baseName;
                img.title = baseName;

                opcion.appendChild(img);
                this.rueda.appendChild(opcion);
                this.opciones.push(opcion);

                index++;
                itemsProcessed++;
            }

            if (index < totalItems) {
                // Si aún quedan ítems, solicita otro frame.
                requestAnimationFrame(processChunk);
            } else {
                // Cuando todos los ítems han sido creados.
                console.log("[RuedaDinamica] Creación de opciones finalizada y optimizada con rAF.");
                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(processChunk); // Iniciar el proceso.
    }

    /**
     * 🟢 OPTIMIZACIÓN 1: Centraliza la gestión de will-change.
     * @param {boolean} activate - Si es true, activa 'will-change'; si es false, lo desactiva.
     */
    setWillChangeState(activate) {
        const state = activate ? 'transform' : 'auto';
        this.rueda.style.willChange = state;
        this.opciones.forEach(op => op.style.willChange = state);
    }

    // ⚡️ OPTIMIZACIÓN 2: Se usa 'translateZ(0)' para forzar aceleración
    corregirHorizontalidad(correccion) {
        // La corrección aplica un 'rotate' a todos los items para que la imagen interior 
        // parezca estar siempre horizontal mientras la rueda gira.
         this.opciones.forEach(opcion => {
             opcion.style.transform = `
                 ${this.config.opcionTransformBase}
                 rotate(${correccion}deg)
                 translateZ(0) 
             `;
         });
    }

    // ⚡️ OPTIMIZACIÓN 3: Se mantiene la estructura para la compatibilidad con 'utils.js'
    initializeGlobalCorrector() {
         // Se mantiene la función global para 'utils.js', pero ahora llama al método de la clase.
         window.corregirHorizontalidad = () => this.corregirHorizontalidad(this.rotacionActualRueda * -1);
    }

    animarRueda = () => { // Uso de arrow function para mantener 'this'
        if (this.isMobileView) {
            this.setWillChangeState(false); // Asegurar desactivación en móvil
            return;
        }

        const diferencia = this.rotacionObjetivoRueda - this.rotacionActualRueda;
        const epsilon = 0.01;

        // ⚡️ OPTIMIZACIÓN 4: Asegurar que 'will-change' esté activo ANTES de la animación
        this.setWillChangeState(true);

        if (Math.abs(diferencia) < epsilon) {
            this.rotacionActualRueda = this.rotacionObjetivoRueda;
            cancelAnimationFrame(this.animacionFrameId);
            this.animacionFrameId = null;
            this.isRotatingFromClick = false;
            // ⚡️ OPTIMIZACIÓN 5: Remueve 'will-change' cuando la animación termina
            this.setWillChangeState(false); 
        } else {
            this.rotacionActualRueda += diferencia * this.config.factorSuavizado;
            this.animacionFrameId = requestAnimationFrame(this.animarRueda);
        }

        // Aplicación de transformaciones
        this.rueda.style.transform = `${this.config.ruedaTransformBase} rotate(${this.rotacionActualRueda}deg) translateZ(0)`;
        this.corregirHorizontalidad(this.rotacionActualRueda * -1);
    }

    // =========================================================================
    // Lógica de Estado y Vista
    // =========================================================================

    hayModalAbierto() {
        const modalAbierto = this.modalOverlayRef?.classList.contains('open');
        const detallesAbierto = this.gameDetailsOverlayRef?.classList.contains('open');

        return modalAbierto || detallesAbierto;
    }

    checkMobileView() {
        this.isMobileView = window.innerWidth <= this.config.breakpoint;
        return this.isMobileView;
    }

    scrollToSelectedIndex(index) {
        if (!this.isMobileView) return;

        const selectedElement = this.opciones[index];
        const container = this.rueda;

        if (selectedElement && container) {
            const itemRect = selectedElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calcular el punto central del ítem y el punto de scroll objetivo
            const itemCenter = itemRect.top - containerRect.top + container.scrollTop + (itemRect.height / 2);
            const targetScroll = itemCenter - (containerRect.height / 2);

            // ⚡️ OPTIMIZACIÓN 6: Usar la propiedad 'smooth' para el scroll en móvil
            container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
    }

    updateViewState() {
        if (this.isMobileView) {
            this.rueda.style.transform = `none`;
            if (this.animacionFrameId !== null) {
                cancelAnimationFrame(this.animacionFrameId);
                this.animacionFrameId = null;
            }
            this.scrollToSelectedIndex(this.indiceActual);

             // ⚡️ OPTIMIZACIÓN 7: Desactivar 'will-change' en móvil, no es necesario
            this.setWillChangeState(false);
        } else {
            // Estado Desktop: Asegurar posición inicial y comenzar animación si es necesario
            if (this.animacionFrameId === null) {
                this.rotacionActualRueda = this.initialAngles[this.indiceActual] * -1;
                this.rotacionObjetivoRueda = this.rotacionActualRueda;
                this.rueda.style.transform = `${this.config.ruedaTransformBase} rotate(${this.rotacionActualRueda}deg) translateZ(0)`;
                this.corregirHorizontalidad(this.rotacionActualRueda * -1);
            }
            this.animarRueda(); // Iniciar o continuar el loop de animación
        }
    }

    actualizarFondo() {
        const baseName = this.menuItems[this.indiceActual];
        const bgUrl = this.config.backgroundDirectory + baseName + this.config.backgroundExtension;

        if (this.capaFondoActual?.style.backgroundImage.includes(bgUrl)) {
            return;
        }

        const nuevaCapa = document.createElement('div');
        nuevaCapa.classList.add('background-layer');
        nuevaCapa.style.backgroundImage = `url('${bgUrl}')`;
        // ⚡️ OPTIMIZACIÓN 8: Agregar will-change para el fade de fondo
        nuevaCapa.style.willChange = 'opacity';
        this.backgroundContainer.appendChild(nuevaCapa);

        // Forzar reflow para aplicar la opacidad inicial (0) antes de la transición a 1
        void nuevaCapa.offsetWidth; 
        nuevaCapa.style.opacity = '1';

        if (this.capaFondoActual) {
            this.capaFondoActual.style.opacity = '0';

            const capaAEliminar = this.capaFondoActual;
            // 🟢 OPTIMIZACIÓN 5: Prevenir 'race condition' reasignando antes del timeout
            this.capaFondoActual = nuevaCapa; 

            setTimeout(() => {
                if (this.backgroundContainer.contains(capaAEliminar)) {
                    // ⚡️ OPTIMIZACIÓN 9: Remover 'will-change' antes de eliminar
                    capaAEliminar.style.willChange = 'auto';
                    this.backgroundContainer.removeChild(capaAEliminar);
                }
            }, this.config.animacionDuracionFondo);
        } else {
             this.capaFondoActual = nuevaCapa;
        }
    }

    actualizarSeleccion(scroll = false) {
        // 🟢 OPTIMIZACIÓN 4: Usar el caché para la opción seleccionada previamente
        if (this.opcionSeleccionadaAnterior) {
            this.opcionSeleccionadaAnterior.classList.remove('seleccionada');
        }

        const nuevaSeleccionada = this.opciones[this.indiceActual];
        nuevaSeleccionada.classList.add('seleccionada');
        this.opcionSeleccionadaAnterior = nuevaSeleccionada;

        this.actualizarFondo();

        if (scroll) {
            this.scrollToSelectedIndex(this.indiceActual);
        }
    }

    rotarRueda(direccion) {
        this.indiceActual = (this.indiceActual + direccion + this.totalOpciones) % this.totalOpciones;

        if (!this.isMobileView) {
            // El giro en pantalla es opuesto a la dirección de movimiento del índice
            this.rotacionObjetivoRueda += (direccion * -1) * this.anguloPorOpcion; 

            if (this.animacionFrameId === null) {
                this.animarRueda();
            }
        }

        this.actualizarSeleccion(true);
    }

    // =========================================================================
    // Manejo de Eventos (Ahora encapsulados)
    // =========================================================================

    handleKeyDown = (event) => {
        if (this.hayModalAbierto()) return;

        let direccion = 0;
        const key = event.key.toLowerCase();
        
        // ⚡️ Optimización: Lógica simplificada de dirección por vista
        const isRotationalKey = ['arrowleft', 'arrowright', 'a', 'd'].includes(key);
        const isVerticalKey = ['arrowup', 'arrowdown', 'w', 's'].includes(key);

        if (this.isMobileView) {
            if (isVerticalKey) {
                direccion = (key === 'arrowdown' || key === 's') ? 1 : -1;
            }
        } else {
            if (isRotationalKey || isVerticalKey) {
                 // Ambas flechas giran igual en desktop
                direccion = (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') ? 1 : -1;
            }
        }

        if (direccion !== 0) {
            this.rotarRueda(direccion);
            event.preventDefault();
            return;
        }

        if (key === 'enter') {
            // USO DE CALLBACKS
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            event.preventDefault();
        }
    }

    handleWheel = (event) => {
        if (this.hayModalAbierto() || this.isMobileView) return;

        // ** CORRECCIÓN: Ahora es seguro llamar a preventDefault()
        // ya que el listener se registra con { passive: false }.
        event.preventDefault(); 

        // ⚡️ OPTIMIZACIÓN 10: Asegurar que el scrollTimeout sea suficiente para evitar rotaciones múltiples
        if (this.isScrolling) return;

        const direccion = event.deltaY > 0 ? 1 : -1;

        this.rotarRueda(direccion);

        this.isScrolling = true;
        setTimeout(() => {
            this.isScrolling = false;
        }, this.config.scrollTimeout);
    }

    handleClick = (event) => {
        if (this.isRotatingFromClick) return;

        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = parseInt(clickedOption.dataset.index, 10);

        if (index === this.indiceActual) {
            // USO DE CALLBACKS
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            return;
        }

        let diferenciaPasos = index - this.indiceActual;

        if (!this.isMobileView) {
            this.isRotatingFromClick = true;

            const halfOptions = this.totalOpciones / 2;
            if (Math.abs(diferenciaPasos) > halfOptions) {
                // Determinar el camino más corto (sentido horario o antihorario)
                diferenciaPasos = (diferenciaPasos > 0)
                    ? diferenciaPasos - this.totalOpciones
                    : diferenciaPasos + this.totalOpciones;
            }
            this.rotacionObjetivoRueda += (diferenciaPasos * -1) * this.anguloPorOpcion;

            if (this.animacionFrameId === null) {
                this.animarRueda();
            }
        }
        
        this.indiceActual = index;
        this.actualizarSeleccion(true);
    }

    handleResize = () => {
        // ⚡️ OPTIMIZACIÓN 11: La inicialización de la vista con cálculo de dimensiones es lo más costoso.
        // Se mantiene el debounce con el setTimeout para evitar ejecuciones excesivas.
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.initializeView(false);
        }, 100);
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        // 🔴 CORRECCIÓN CLAVE: El listener 'wheel' en 'document' debe ser NO pasivo
        // para permitir el uso de event.preventDefault() sin generar la advertencia.
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }

    // =========================================================================
    // Inicialización
    // =========================================================================

    initializeView(initialLoad = false) {
        // 1. Determinar si la vista cambió (Desktop <-> Mobile)
        const oldIsMobileView = this.isMobileView;
        const newIsMobileView = this.checkMobileView();

        // 2. Recalcular dimensiones - USO DE CALLBACKS (SOLO si es necesario o si es la carga inicial)
        const dimensionsResult = this.callbacks.calculateAndApplyDimensions(
            this.rueda,
            this.opciones,
            this.initialAngles,
            this.anguloPorOpcion,
            this.totalOpciones,
            window.corregirHorizontalidad
        );
        this.currentRadius = dimensionsResult.currentRadius;

        // 3. Actualizar el estado de la vista solo si cambió (Desktop <-> Mobile) o es la carga inicial
        if (newIsMobileView !== oldIsMobileView || initialLoad) {
            this.updateViewState();
        }

        // 4. Recalcular posición del modal si está abierto (post-resize) - USO DE CALLBACKS
        if (this.modalOverlayRef?.classList.contains('open') && typeof this.callbacks.updateGridSelection === 'function') {
             const gridIndex = window.currentGridIndex !== undefined ? window.currentGridIndex : 0;
             // El último 'true' asegura la actualización de dimensiones/posiciones del grid post-resize
             this.callbacks.updateGridSelection(gridIndex, true, true, true); 
        }

        // 5. Asegurar que la selección actual se aplique y el scroll se realice
        this.actualizarSeleccion(true);
    }
}

// Ejecución
document.addEventListener('DOMContentLoaded', () => {
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems' o no es un array.");
        return;
    }

    // --- Comprobación y Creación del Objeto de Callbacks ---
    if (
        typeof window.abrirModal !== 'function' ||
        typeof window.updateGridSelection !== 'function' ||
        typeof window.calculateAndApplyDimensions !== 'function'
    ) {
        console.error("Faltan dependencias externas. Asegúrate de que utils.js, main-modal-manager.js y game-grid-nav.js se carguen primero.");
        return;
    }

    const callbacks = {
        abrirModal: window.abrirModal,
        updateGridSelection: window.updateGridSelection,
        calculateAndApplyDimensions: window.calculateAndApplyDimensions,
    };

    // Inicializar la Rueda
    window.ruedaDinamicaInstance = new RuedaDinamica(menuItems, CONFIG, callbacks);
});
