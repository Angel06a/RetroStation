// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// 🔧 OPTIMIZACIÓN DE CÓDIGO LIMPIO: Refactorización y centralización de la
// lógica de rotación para reducir la duplicación.
//
// 🚀 OPTIMIZACIÓN MÁXIMA: Lógica completamente delegada a CSS (Rotación y Horizontalidad)
//
// 🌟 OPTIMIZACIÓN DE FONDO: Precarga y decodificación asíncrona para evitar micro-lags
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
        this.callbacks = callbacks; 

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
        this.initialAngles = null; // Se inicializa en el callback

        // Variables de Estado
        this.currentRadius = 0;
        this.indiceActual = 0;
        this.rotacionObjetivoRueda = 0; // Valor aplicado a la variable CSS
        this.capaFondoActual = null;
        this.isMobileView = false; // Se inicializa en initializeView
        this.isScrolling = false;
        this.isRotatingFromClick = false;
        this.opcionSeleccionadaAnterior = null; 
        this.resizeTimeoutId = null; 
        
        // Variables para Optimización de Fondo (Acumulación)
        this.pendingBackgroundRemoval = null; 
        this.backgroundRemovalTimeoutId = null; 
        this.backgroundPreloadCache = new Map(); // Nueva caché para fondos precargados
        this.currentBackgroundUrl = null; // Para verificar el fondo actual

        // Referencia a la variable CSS de rotación
        this.ruedaRotacionCSSVar = '--rueda-rotacion-actual'; 

        // Inicialización y Eventos (La generación ahora es asíncrona)
        this.generarOpcionesOptimizada(() => {
            // Callback: Asegura que this.opciones esté poblado para calcular los ángulos
            this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
            this.attachEventListeners();
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
        const state = activate ? 'transform' : 'auto';
        if (this.rueda.style.willChange !== state) {
            this.rueda.style.willChange = state;
            this.opciones.forEach(op => op.style.willChange = state);
        }
    }
    
    /**
     * Establece la rotación objetivo y dispara la transición CSS.
     * @private
     */
    _applyTargetRotation() {
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
        // Ejecutar checkMobileView para actualizar el estado antes de decidir
        this.checkMobileView(); 

        // En el modo desktop, establecemos la rotación inicial.
        if (!this.isMobileView) {
            // CORRECCIÓN CLAVE: Eliminar la propiedad 'transform' para que el CSS
            // pueda tomar el control de la rotación mediante la variable CSS.
            this.rueda.style.transform = ''; 

            // El giro en pantalla es opuesto a la dirección de movimiento del índice
            this.rotacionObjetivoRueda = this.initialAngles[this.indiceActual] * -1;
            this._applyTargetRotation();
            this.setWillChangeState(true); // Activar will-change en desktop
        } else {
            // Estado Móvil
            // En móvil, la rueda se transforma a 'none' (para ser un contenedor de scroll)
            this.rueda.style.transform = `none`; 
            // En móvil, forzamos la variable CSS a 0 para no interferir con el layout
            this.rueda.style.setProperty(this.ruedaRotacionCSSVar, `0deg`); 
            this.scrollToSelectedIndex(this.indiceActual);
            this.setWillChangeState(false); // Desactivar will-change en móvil
        }
    }

    /**
     * @private
     * Precarga y decodifica un fondo para evitar el bloqueo del hilo principal.
     * @param {string} url - La URL de la imagen de fondo.
     * @returns {Promise<string>} Una promesa que se resuelve con la URL si la decodificación es exitosa.
     */
    _preloadAndDecodeImage(url) {
        // Devuelve la promesa de la caché si ya existe
        if (this.backgroundPreloadCache.has(url)) {
            return this.backgroundPreloadCache.get(url);
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Usamos requestIdleCallback o setTimeout para la decodificación
                // para que ocurra durante un momento inactivo.
                const decodeAction = () => {
                    if ('decode' in img) {
                        // Decodificación asíncrona para navegadores modernos
                        img.decode()
                            .then(() => resolve(url))
                            .catch(error => {
                                console.error("Error al decodificar imagen:", error);
                                reject(error);
                            });
                    } else {
                        // Fallback: Resuelve inmediatamente si decode no está soportado
                        resolve(url);
                    }
                };

                // Priorizar requestIdleCallback si está disponible, sino usar setTimeout
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(decodeAction);
                } else {
                    setTimeout(decodeAction, 0);
                }
            };
            img.onerror = reject;
            img.src = url;
        });

        // Almacena la promesa en caché para futuras peticiones
        this.backgroundPreloadCache.set(url, promise);
        return promise;
    }

    /**
     * Gestiona la transición de fondos evitando la acumulación de capas.
     * Ahora utiliza precarga y decodificación asíncrona.
     */
    actualizarFondo() {
        const baseName = this.menuItems[this.indiceActual];
        const bgUrl = this.config.backgroundDirectory + baseName + this.config.backgroundExtension;
        const fullBgUrl = `url('${bgUrl}')`;

        // Si la imagen ya es la actual, salimos
        if (this.currentBackgroundUrl === fullBgUrl) {
            return;
        }

        this._preloadAndDecodeImage(bgUrl).then(resolvedUrl => {
            // Si la selección ha cambiado mientras se precargaba, abortamos la aplicación.
            if (`url('${resolvedUrl}')` !== fullBgUrl) return; 

            this.currentBackgroundUrl = fullBgUrl;

            // --- 1. CANCELACIÓN DE ELIMINACIÓN ANTERIOR (CLAVE para la optimización) ---
            if (this.backgroundRemovalTimeoutId) {
                clearTimeout(this.backgroundRemovalTimeoutId);
                this.backgroundRemovalTimeoutId = null; 
            }

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

            // Forzar un repaint/reflow para que la transición funcione.
            void nuevaCapa.offsetWidth; 
            
            // Establecer la nueva capa como visible (opacidad: 1)
            nuevaCapa.style.opacity = '1';

            // --- 3. Gestionar la capa anterior (desvanecer y programar eliminación) ---
            if (capaAnterior) {
                capaAnterior.style.opacity = '0';
                this.pendingBackgroundRemoval = capaAnterior;

                // Esperar a que termine la animación de opacidad antes de eliminar el elemento.
                this.backgroundRemovalTimeoutId = setTimeout(() => {
                    if (this.backgroundContainer.contains(capaAnterior)) {
                        capaAnterior.style.willChange = 'auto';
                        this.backgroundContainer.removeChild(capaAnterior);
                    }
                    this.pendingBackgroundRemoval = null;
                    this.backgroundRemovalTimeoutId = null;

                }, this.config.animacionDuracionFondo); 
            }
        }).catch(error => {
            console.error("No se pudo precargar/decodificar el fondo:", error);
            // Si falla la precarga/decodificación, se podría optar por un fallback o simplemente no actualizar
        });
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

    /**
     * @private
     * Centraliza el cálculo de indiceActual y rotacionObjetivoRueda.
     * @param {number} pasos - Número de pasos a rotar (positivo/negativo).
     */
    _updateRotationIndexAndTarget(pasos) {
        // 1. Actualizar el índice (circular)
        this.indiceActual = (this.indiceActual + pasos + this.totalOpciones) % this.totalOpciones;

        // 2. Actualizar la rotación objetivo solo si no es móvil
        if (!this.isMobileView) {
            // El giro en pantalla es opuesto a la dirección de movimiento del índice
            this.rotacionObjetivoRueda += (pasos * -1) * this.anguloPorOpcion; 
            this._applyTargetRotation();
        }
    }

    rotarRueda(direccion) {
        this._updateRotationIndexAndTarget(direccion);
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
        const isEnterKey = key === 'enter';

        if (this.isMobileView) {
            if (isVerticalKey) {
                direccion = (key === 'arrowdown' || key === 's') ? 1 : -1;
            }
        } else {
            if (isRotationalKey || isVerticalKey) {
                // En desktop, todas las teclas direccionales controlan la rotación
                direccion = (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's') ? 1 : -1;
            }
        }

        if (direccion !== 0) {
            this.rotarRueda(direccion);
            event.preventDefault();
            return;
        }

        if (isEnterKey) {
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

        const targetIndex = parseInt(clickedOption.dataset.index, 10);

        if (targetIndex === this.indiceActual) {
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            return;
        }

        let diferenciaPasos = targetIndex - this.indiceActual;

        if (!this.isMobileView) {
            this.isRotatingFromClick = true;

            // Cálculo para la ruta de rotación más corta
            if (Math.abs(diferenciaPasos) > this.halfOptions) {
                diferenciaPasos = (diferenciaPasos > 0) 
                    ? diferenciaPasos - this.totalOpciones 
                    : diferenciaPasos + this.totalOpciones;
            }
            
            // Aplicar la rotación directamente sin usar _updateRotationIndexAndTarget
            // El giro en la rueda es opuesto al movimiento del índice
            this.rotacionObjetivoRueda += (diferenciaPasos * -1) * this.anguloPorOpcion;
            this._applyTargetRotation(); 
        }
        
        // Actualizar el índice y la selección
        this.indiceActual = targetIndex;
        this.actualizarSeleccion(true);
    }

    /**
     * @private
     * Lógica centralizada para la actualización de dimensiones y el estado de la vista.
     */
    _handleDimensionUpdateAndResizeLogic(initialLoad = false) {
        const oldIsMobileView = this.isMobileView;
        const newIsMobileView = this.checkMobileView(); 

        // 1. Determinar si se necesita el cálculo de dimensiones (Costoso)
        const shouldRunCostlyCalculation = initialLoad || newIsMobileView !== oldIsMobileView || this.currentRadius === 0;

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

        // 2. Actualizar el estado de la vista si hubo cambio de breakpoint o es carga inicial
        if (newIsMobileView !== oldIsMobileView || initialLoad) {
            this.updateViewState();
        }

        // 3. Lógica de re-selección del grid (si aplica)
        if (this.hayModalAbierto() && typeof this.callbacks.updateGridSelection === 'function') {
            const gridIndex = window.currentGridIndex ?? 0;
            // Se asume que los últimos 3 booleanos controlan la lógica de re-render/scroll
            this.callbacks.updateGridSelection(gridIndex, true, true, true); 
        }

        // 4. Asegurar que la selección actual se aplique y el scroll/posición se realice
        this.actualizarSeleccion(true);
    }


    handleResize = () => {
        clearTimeout(this.resizeTimeoutId);
        this.resizeTimeoutId = setTimeout(() => {
            this._handleDimensionUpdateAndResizeLogic(false);
        }, 100);
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.handleKeyDown);
        // Passive: false es necesario para usar event.preventDefault() en el scroll.
        document.addEventListener('wheel', this.handleWheel, { passive: false });
        this.rueda.addEventListener('click', this.handleClick);
        window.addEventListener('resize', this.handleResize);
    }

    // =========================================================================
    // Inicialización
    // =========================================================================
    
    // Función pública de inicialización
    initializeView(initialLoad = false) {
        this.checkMobileView(); 
        this.setWillChangeState(!this.isMobileView); 
        this._handleDimensionUpdateAndResizeLogic(initialLoad);
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
