// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// OPTIMIZACIÓN AVANZADA: Desacoplamiento de dependencias globales
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
        
        // Inicialización y Eventos
        this.generarOpciones();
        this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
        this.initializeGlobalCorrector();
        this.attachEventListeners();
        
        // ⚡️ OPTIMIZACIÓN 1: Añadir 'will-change' a la rueda y a las opciones
        this.rueda.style.willChange = 'transform';
        this.opciones.forEach(op => op.style.willChange = 'transform');
        
        this.initializeView(true);
    }

    // =========================================================================
    // Generación y Lógica de Animación
    // =========================================================================

    generarOpciones() {
        // Lógica de generación sin cambios...
        this.menuItems.forEach((baseName, index) => {
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
        });
    }

    // ⚡️ OPTIMIZACIÓN 2: Usar 'rotacionActualRueda' para corregir, minimizando la carga de la función
    // Ya que se llama en cada frame, es más eficiente que el bucle forEach se ejecute fuera de aquí
    corregirHorizontalidad(correccion) {
        // Mejorar: Aplicar la corrección directamente en el bucle de animación para las opciones que lo requieran
        // Sin embargo, manteniendo la estructura, se aplica a todos, pero ahora el navegador sabe que 
        // estas transformaciones cambiarán frecuentemente gracias a 'will-change'.
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
        if (this.isMobileView) return;
        
        const diferencia = this.rotacionObjetivoRueda - this.rotacionActualRueda;

        if (Math.abs(diferencia) < 0.01) {
            this.rotacionActualRueda = this.rotacionObjetivoRueda;
            cancelAnimationFrame(this.animacionFrameId);
            this.animacionFrameId = null;
            this.isRotatingFromClick = false; 
            // ⚡️ OPTIMIZACIÓN 4: Remueve 'will-change' cuando la animación termina
            this.rueda.style.willChange = 'auto';
            this.opciones.forEach(op => op.style.willChange = 'auto');

        } else {
            this.rotacionActualRueda += diferencia * this.config.factorSuavizado;
            this.animacionFrameId = requestAnimationFrame(this.animarRueda);
            // ⚡️ OPTIMIZACIÓN 5: Asegura que 'will-change' esté activo durante la animación
            this.rueda.style.willChange = 'transform';
            this.opciones.forEach(op => op.style.willChange = 'transform');
        }
        
        this.rueda.style.transform = `${this.config.ruedaTransformBase} rotate(${this.rotacionActualRueda}deg)`;
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
        return window.innerWidth <= this.config.breakpoint;
    }
    
    scrollToSelectedIndex(index) {
        if (!this.isMobileView) return;
        
        const selectedElement = this.opciones[index];
        const container = this.rueda; 
        
        if (selectedElement && container) {
            const itemRect = selectedElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
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
            this.rueda.style.willChange = 'auto';
            this.opciones.forEach(op => op.style.willChange = 'auto');
        } else {
            if (this.animacionFrameId === null) {
                this.rotacionActualRueda = this.initialAngles[this.indiceActual] * -1;
                this.rotacionObjetivoRueda = this.rotacionActualRueda;
                this.rueda.style.transform = `${this.config.ruedaTransformBase} rotate(${this.rotacionActualRueda}deg)`;
                this.corregirHorizontalidad(this.rotacionActualRueda * -1); 
            }
            this.animarRueda();
        }
    }

    actualizarFondo() {
        const baseName = this.menuItems[this.indiceActual];
        const bgUrl = this.config.backgroundDirectory + baseName + this.config.backgroundExtension;

        // ⚡️ OPTIMIZACIÓN 8: Usar un contenedor temporal o re-usar capas si el rendimiento de creación/eliminación es un problema.
        // Dado el alcance, mantenemos la estructura de dos capas, pero la optimización anterior con 'will-change: opacity' ayuda al fade.

        if (this.capaFondoActual?.style.backgroundImage.includes(bgUrl)) {
            return;
        }

        const nuevaCapa = document.createElement('div');
        nuevaCapa.classList.add('background-layer');
        nuevaCapa.style.backgroundImage = `url('${bgUrl}')`;
        // ⚡️ OPTIMIZACIÓN 9: Agregar will-change para el fade de fondo
        nuevaCapa.style.willChange = 'opacity'; 
        this.backgroundContainer.appendChild(nuevaCapa);

        void nuevaCapa.offsetWidth; 
        nuevaCapa.style.opacity = '1';

        if (this.capaFondoActual) {
            this.capaFondoActual.style.opacity = '0';
            
            const capaAEliminar = this.capaFondoActual;
            setTimeout(() => {
                if (this.backgroundContainer.contains(capaAEliminar)) {
                    // ⚡️ OPTIMIZACIÓN 10: Remover 'will-change' antes de eliminar
                    capaAEliminar.style.willChange = 'auto'; 
                    this.backgroundContainer.removeChild(capaAEliminar);
                }
            }, this.config.animacionDuracionFondo);
        }

        this.capaFondoActual = nuevaCapa;
    }

    actualizarSeleccion(scroll = false) {
        // ⚡️ OPTIMIZACIÓN 11: Minimizar manipulación del DOM agrupando las remociones de clase
        const prevSeleccionada = this.opciones.find(op => op.classList.contains('seleccionada'));
        if (prevSeleccionada) {
            prevSeleccionada.classList.remove('seleccionada');
        }
        
        this.opciones[this.indiceActual].classList.add('seleccionada');
        this.actualizarFondo();
        
        if (scroll) {
            this.scrollToSelectedIndex(this.indiceActual);
        }
    }

    rotarRueda(direccion) {
        this.indiceActual = (this.indiceActual + direccion + this.totalOpciones) % this.totalOpciones;
        
        if (!this.isMobileView) {
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

        if (this.isMobileView) {
            if (key === 'arrowup' || key === 'w') {
                direccion = -1;
            } else if (key === 'arrowdown' || key === 's') {
                direccion = 1;
            }
        } else {
            if (key === 'arrowleft' || key === 'arrowup' || key === 'a' || key === 'w') {
                direccion = -1;
            } else if (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') {
                direccion = 1;
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

        event.preventDefault();

        // ⚡️ OPTIMIZACIÓN 12: Asegurar que el scrollTimeout sea suficiente para evitar rotaciones múltiples
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
        // ⚡️ OPTIMIZACIÓN 13: La inicialización de la vista con cálculo de dimensiones es lo más costoso.
        // Se mantiene el debounce con el setTimeout para evitar ejecuciones excesivas.
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.initializeView(false);
        }, 100); 
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel);
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }

    // =========================================================================
    // Inicialización
    // =========================================================================

    initializeView(initialLoad = false) {
        // 1. Recalcular dimensiones - USO DE CALLBACKS
        const result = this.callbacks.calculateAndApplyDimensions(
            this.rueda, 
            this.opciones, 
            this.initialAngles, 
            this.anguloPorOpcion, 
            this.totalOpciones, 
            window.corregirHorizontalidad
        ); 
        this.currentRadius = result.currentRadius;
        
        // 2. Actualizar el estado de la vista
        const newIsMobileView = this.checkMobileView();
        
        if (newIsMobileView !== this.isMobileView || initialLoad) {
            this.isMobileView = newIsMobileView;
            this.updateViewState();
        }

        // 3. Recalcular posición del modal si está abierto (post-resize) - USO DE CALLBACKS
        if (this.modalOverlayRef?.classList.contains('open') && typeof this.callbacks.updateGridSelection === 'function') {
             const gridIndex = window.currentGridIndex !== undefined ? window.currentGridIndex : 0;
             this.callbacks.updateGridSelection(gridIndex, true, true, true);
        }

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