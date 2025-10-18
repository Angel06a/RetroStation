// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// OPTIMIZACIÓN AVANZADA: Desacoplamiento de dependencias globales
// OPTIMIZACIÓN DE RENDERING: Creación de Opciones en Chunks con requestAnimationFrame (rAF)
// 🚀 OPTIMIZACIÓN MÁXIMA: Lógica completamente delegada a CSS (Rotación y Horizontalidad)
// -------------------------------------------------------------------------
// NOTA DE CAMBIO: Se elimina el cálculo de corrección visual (applyVisualCorrection)
// y se delega toda la rotación y contrarrotación a la propiedad 'transition' de CSS.
// =========================================================================

// --- 0. Configuraciones Comunes (Mejorar Cohesión) ---
const CONFIG = {
    imageDirectory: "Sistemas/",
    imageExtension: ".svg",
    backgroundDirectory: "Fondos/",
    backgroundExtension: ".jpg",
    breakpoint: 768,
    scrollTimeout: 100,
    animacionDuracionFondo: 600,
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
        this.halfOptions = this.totalOpciones / 2; 

        // Variables de Estado
        this.currentRadius = 0;
        this.indiceActual = 0;
        this.rotacionObjetivoRueda = 0; // Se mantiene como el valor que se aplica a la variable CSS
        this.animacionFrameId = null; 
        this.capaFondoActual = null;
        this.isMobileView = false;
        this.isScrolling = false;
        this.isRotatingFromClick = false;
        this.opcionSeleccionadaAnterior = null; // Cache para la opción seleccionada
        this.resizeTimeoutId = null; // ID del timeout para el debounce
        
        // 🚨 NUEVAS VARIABLES PARA OPTIMIZACIÓN DE FONDO (Acumulación)
        this.pendingBackgroundRemoval = null; 
        this.backgroundRemovalTimeoutId = null; 

        // 🚀 NUEVO: Referencia a la variable CSS de rotación
        this.ruedaRotacionCSSVar = '--rueda-rotacion-actual'; 

        // Inicialización y Eventos (La generación ahora es asíncrona)
        this.generarOpcionesOptimizada(() => {
            // Callback que se ejecuta después de que todos los ítems se crean.
            // Los initialAngles deben estar definidos después de que this.opciones se puebla
            this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
            this.attachEventListeners();

            // Establece this.isMobileView
            this.checkMobileView(); 
            // ⚡️ OPTIMIZACIÓN: Activar 'will-change' solo si no es móvil y al inicio
            this.setWillChangeState(!this.isMobileView); 
            
            this.initializeView(true);
        });
    }

    // =========================================================================
    // Generación y Lógica de Animación (Ahora gestionada por CSS)
    // =========================================================================

    /**
     * Crea las opciones del menú de forma asíncrona usando rAF.
     */
    generarOpcionesOptimizada(onComplete) {
        let index = 0;
        const totalItems = this.menuItems.length;

        const processChunk = () => {
            const itemsPerFrame = 1;
            let itemsProcessed = 0;

            const fragment = document.createDocumentFragment();

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
                fragment.appendChild(opcion);
                this.opciones.push(opcion);

                index++;
                itemsProcessed++;
            }
            
            this.rueda.appendChild(fragment);

            if (index < totalItems) {
                requestAnimationFrame(processChunk);
            } else {
                console.log("[RuedaDinamica] Creación de opciones finalizada y optimizada con rAF.");
                if (onComplete) onComplete();
            }
        };

        requestAnimationFrame(processChunk);
    }

    /**
     * Centraliza la gestión de will-change en la rueda y sus opciones.
     */
    setWillChangeState(activate) {
        // En este diseño, 'will-change' se deja fijo en 'transform' en CSS,
        // pero se mantiene esta función para el contenedor de fondo.
        const state = activate ? 'transform' : 'auto';
        if (this.rueda.style.willChange !== state) {
            this.rueda.style.willChange = state;
            this.opciones.forEach(op => op.style.willChange = state);
        }
    }
    
    /**
     * Establece la rotación objetivo y dispara la transición CSS.
     * NO HAY CÁLCULOS DE CORRECCIÓN AQUÍ.
     */
    setTargetRotation() {
        if (this.isMobileView) return;
        
        // Aplica el valor de rotación inmediatamente a la variable CSS
        this.rueda.style.setProperty(this.ruedaRotacionCSSVar, `${this.rotacionObjetivoRueda}deg`);

        this.isRotatingFromClick = false; 
    }

    // =========================================================================
    // Lógica de Estado y Vista
    // =========================================================================

    hayModalAbierto() {
        return this.modalOverlayRef?.classList.contains('open') || 
               this.gameDetailsOverlayRef?.classList.contains('open');
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

            const itemCenter = itemRect.top - containerRect.top + container.scrollTop + (itemRect.height / 2);
            const targetScroll = itemCenter - (containerRect.height / 2);

            container.scrollTo({ top: targetScroll, behavior: 'smooth' });
        }
    }

    updateViewState() {
        // En el modo desktop, establecemos la rotación inicial.
        if (!this.isMobileView) {
            // El giro en pantalla es opuesto a la dirección de movimiento del índice
            this.rotacionObjetivoRueda = this.initialAngles[this.indiceActual] * -1;
            this.setTargetRotation();
            this.setWillChangeState(true); // Activar will-change en desktop
        } else {
            // Estado Móvil
            this.rueda.style.transform = `none`;
            this.scrollToSelectedIndex(this.indiceActual);
            this.setWillChangeState(false); // Desactivar will-change en móvil
            // En móvil, forzamos la variable CSS a 0 para no interferir con el layout
            this.rueda.style.setProperty(this.ruedaRotacionCSSVar, `0deg`); 
        }
    }

    /**
     * OPTIMIZADO AL MÁXIMO: Gestiona la transición de fondos evitando la acumulación
     * mediante la cancelación explícita de cualquier eliminación pendiente.
     */
    actualizarFondo() {
        const baseName = this.menuItems[this.indiceActual];
        const bgUrl = this.config.backgroundDirectory + baseName + this.config.backgroundExtension;
        const fullBgUrl = `url('${bgUrl}')`;

        // Si la imagen ya es la actual, salimos
        if (this.capaFondoActual && this.capaFondoActual.style.backgroundImage === fullBgUrl) {
            return;
        }

        // --- 1. CANCELACIÓN DE ELIMINACIÓN ANTERIOR (CLAVE para la optimización) ---
        // Si hay un timeout pendiente de ejecutar (por un cambio rápido), lo cancelamos.
        if (this.backgroundRemovalTimeoutId) {
            clearTimeout(this.backgroundRemovalTimeoutId);
            this.backgroundRemovalTimeoutId = null; 
        }

        // Si hay una capa anterior que estaba en proceso de ser eliminada, 
        // la eliminamos inmediatamente porque una nueva capa la reemplazará.
        if (this.pendingBackgroundRemoval && this.backgroundContainer.contains(this.pendingBackgroundRemoval)) {
            this.pendingBackgroundRemoval.style.willChange = 'auto';
            this.backgroundContainer.removeChild(this.pendingBackgroundRemoval);
            this.pendingBackgroundRemoval = null;
        }
        
        // Almacenamos la capa actual (que ahora será la anterior/a eliminar)
        const capaAnterior = this.capaFondoActual;
        
        // --- 2. Crear y añadir la nueva capa ---
        const nuevaCapa = document.createElement('div');
        nuevaCapa.classList.add('background-layer');
        nuevaCapa.style.backgroundImage = fullBgUrl;
        nuevaCapa.style.willChange = 'opacity';
        
        this.backgroundContainer.appendChild(nuevaCapa);
        this.capaFondoActual = nuevaCapa; // Establecer la nueva capa como la actual

        // Forzar un repaint/reflow para que la transición de 'opacity' de 0 a 1 funcione.
        void nuevaCapa.offsetWidth; 
        
        // Establecer la nueva capa como visible (opacidad: 1)
        nuevaCapa.style.opacity = '1';

        // --- 3. Gestionar la capa anterior (desvanecer y programar eliminación) ---
        if (capaAnterior) {
            // Establecer la capa anterior a opacidad: 0
            capaAnterior.style.opacity = '0';
            
            // Establecer la capa anterior para su eliminación pendiente
            this.pendingBackgroundRemoval = capaAnterior;

            // Esperar a que termine la animación de opacidad antes de eliminar el elemento.
            this.backgroundRemovalTimeoutId = setTimeout(() => {
                // Comprobación de seguridad
                if (this.backgroundContainer.contains(capaAnterior)) {
                    capaAnterior.style.willChange = 'auto';
                    this.backgroundContainer.removeChild(capaAnterior);
                }
                // Limpiar las referencias después de la eliminación exitosa
                this.pendingBackgroundRemoval = null;
                this.backgroundRemovalTimeoutId = null;

            }, this.config.animacionDuracionFondo); // animacionDuracionFondo: 600ms
        }
    }

    actualizarSeleccion(scroll = false) {
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
            this.setTargetRotation();
        }

        this.actualizarSeleccion(true);
    }

    // =========================================================================
    // Manejo de Eventos
    // =========================================================================

    handleKeyDown = (event) => {
        if (this.hayModalAbierto()) return;

        let direccion = 0;
        const key = event.key.toLowerCase();
        
        const isRotationalKey = ['arrowleft', 'arrowright', 'a', 'd'].includes(key);
        const isVerticalKey = ['arrowup', 'arrowdown', 'w', 's'].includes(key);

        if (this.isMobileView) {
            if (isVerticalKey) {
                direccion = (key === 'arrowdown' || key === 's') ? 1 : -1;
            }
        } else {
            if (isRotationalKey || isVerticalKey) {
                direccion = (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') ? 1 : -1;
            }
        }

        if (direccion !== 0) {
            this.rotarRueda(direccion);
            event.preventDefault();
            return;
        }

        if (key === 'enter') {
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            event.preventDefault();
        }
    }

    handleWheel = (event) => {
        if (this.hayModalAbierto() || this.isMobileView) return;

        event.preventDefault(); 

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
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            return;
        }

        let diferenciaPasos = index - this.indiceActual;

        if (!this.isMobileView) {
            this.isRotatingFromClick = true;

            if (Math.abs(diferenciaPasos) > this.halfOptions) {
                diferenciaPasos = (diferenciaPasos > 0) 
                    ? diferenciaPasos - this.totalOpciones 
                    : diferenciaPasos + this.totalOpciones;
            }
            
            // El giro en la rueda es opuesto al movimiento del índice
            this.rotacionObjetivoRueda += (diferenciaPasos * -1) * this.anguloPorOpcion;
            this.setTargetRotation(); 
        }
        
        this.indiceActual = index;
        this.actualizarSeleccion(true);
    }

    handleResize = () => {
        clearTimeout(this.resizeTimeoutId);
        this.resizeTimeoutId = setTimeout(() => {
            const oldIsMobileView = this.isMobileView;
            const newIsMobileView = this.checkMobileView(); 

            const shouldRunCostlyCalculation = newIsMobileView !== oldIsMobileView || this.currentRadius === 0;

            if (shouldRunCostlyCalculation) {
                const dimensionsResult = this.callbacks.calculateAndApplyDimensions(
                    this.rueda,
                    this.opciones,
                    this.initialAngles,
                    this.anguloPorOpcion,
                    this.totalOpciones
                );
                this.currentRadius = dimensionsResult.currentRadius;
            }

            if (newIsMobileView !== oldIsMobileView) {
                this.updateViewState();
            }

            if (this.hayModalAbierto() && typeof this.callbacks.updateGridSelection === 'function') {
                 const gridIndex = window.currentGridIndex ?? 0;
                 this.callbacks.updateGridSelection(gridIndex, true, true, true); 
            }

            this.actualizarSeleccion(true);
        }, 100);
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }

    // =========================================================================
    // Inicialización
    // =========================================================================
    
    // Función pública de inicialización
    initializeView(initialLoad = false) {
        const oldIsMobileView = this.isMobileView;
        const newIsMobileView = this.checkMobileView();
        
        // 1. Recalcular dimensiones (SIEMPRE en carga inicial)
        const dimensionsResult = this.callbacks.calculateAndApplyDimensions(
            this.rueda,
            this.opciones,
            this.initialAngles,
            this.anguloPorOpcion,
            this.totalOpciones
        );
        this.currentRadius = dimensionsResult.currentRadius;

        // 2. Actualizar el estado de la vista
        if (newIsMobileView !== oldIsMobileView || initialLoad) {
            this.updateViewState();
        }
        
        // 3. (Solo si un modal está abierto en la carga inicial)
        if (this.hayModalAbierto() && typeof this.callbacks.updateGridSelection === 'function') {
             const gridIndex = window.currentGridIndex ?? 0;
             this.callbacks.updateGridSelection(gridIndex, true, true, true); 
        }

        // 4. Asegurar que la selección actual se aplique y el scroll se realice
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