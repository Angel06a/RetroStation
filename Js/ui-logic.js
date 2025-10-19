// =========================================================================
// ui-logic.js: Rueda Dinámica, Animación y Navegación Principal
//
// 🔧 OPTIMIZACIÓN: Refactorización de la lógica de redimensionamiento y
// gestión de estado para reducir re-cálculos costosos.
//
// 🚀 OPTIMIZACIÓN MÁXIMA: Lógica de animación completamente delegada a CSS.
//
// 🌟 OPTIMIZACIÓN DE FONDO: Uso de precarga/decodificación asíncrona (existente).
// ⚡ OPTIMIZACIÓN DE RENDIMIENTO: Uso de requestAnimationFrame para handleResize (existente).
//
// 🎯 MEJORA: Refactorización de la lógica de rotación en handleClick.
//
// 🧱 OPTIMIZACIÓN DE INYECCIÓN DE DOM: Eliminación del chunking con rAF en
// generarOpcionesOptimizada para inyectar todo el DocumentFragment de una vez
// después de la decodificación de la imagen, acelerando la renderización inicial.
//
// 🚫 CRÍTICO ANTI-LAG: Uso estricto de Promise.all para la DECODIFICACIÓN de
// SVGs inicial, aplazando la inyección al DOM hasta que la CPU esté libre.
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
        this.initialAngles = null; 

        // Variables de Estado
        this.currentRadius = 0;
        this.indiceActual = 0;
        this.rotacionObjetivoRueda = 0; 
        this.capaFondoActual = null;
        this.isMobileView = false; 
        this.isScrolling = false;
        // Se mantiene para el bloqueo de click durante la transición si se desea, pero 
        // la animación es tan rápida con CSS que puede ser innecesario. Lo simplificamos.
        this.isRotatingFromClick = false; 
        this.opcionSeleccionadaAnterior = null;
        this.resizeRafId = null; 
        
        // Variables para Optimización de Fondo (Acumulación)
        this.pendingBackgroundRemoval = null; 
        this.backgroundRemovalTimeoutId = null; 
        this.backgroundPreloadCache = new Map(); 
        this.currentBackgroundUrl = null; 

        // Referencia a la variable CSS de rotación
        this.ruedaRotacionCSSVar = '--rueda-rotacion-actual'; 

        // Inicialización y Eventos (La generación ahora es asíncrona)
        this.generarOpcionesOptimizada(() => {
            // Callback: Asegura que this.opciones esté poblado para calcular los ángulos
            // La rotación inicial de cada ítem (index * anguloPorOpcion)
            this.initialAngles = Array.from(this.opciones).map((op, index) => index * this.anguloPorOpcion);
            this.attachEventListeners();
            this.initializeView(true);
        });
    }

    // =========================================================================
// Generación y Lógica de Animación
// =========================================================================

/**
 * Crea las opciones del menú de forma asíncrona usando rAF y Promise.all para decodificar las imágenes.
 * Esto asegura que los SVGs estén listos para ser renderizados antes de la inyección al DOM, 
 * previniendo la carga de imágenes bloqueantes y mejorando el jank (saltos visuales).
 * @param {function} onComplete - Función a ejecutar al finalizar la creación y decodificación.
 */
generarOpcionesOptimizada(onComplete) {
    // 1. Fase de Creación de Elementos e Inicio de Decodificación (Síncrono)
    const totalItems = this.menuItems.length;
    const decodePromises = [];
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < totalItems; index++) {
        const baseName = this.menuItems[index];
        const opcion = document.createElement('div');
        opcion.classList.add('opcion');
        opcion.setAttribute('title', baseName.toUpperCase());
        opcion.dataset.index = index;

        const img = document.createElement('img');
        img.src = this.config.imageDirectory + baseName + this.config.imageExtension;
        img.alt = baseName;
        img.title = baseName;

        // Iniciar la decodificación asíncrona (si está disponible)
        if (typeof img.decode === 'function') {
            // Se usa .catch para que Promise.all no falle si una imagen no se puede decodificar,
            // manteniendo el resto de la interfaz fluida.
            decodePromises.push(img.decode().catch(e => {
                console.warn(`[WARN] Falló la decodificación asíncrona de SVG: ${baseName}.svg. Continuando.`, e);
            }));
        }
        
        opcion.appendChild(img);
        this.opciones.push(opcion); // Se almacenan las opciones creadas.
        fragment.appendChild(opcion); // Se añaden al fragmento.
    }

    // 2. Esperar a que todas las imágenes se decodifiquen asíncronamente
    // Aunque fallen algunas decodificaciones, Promise.all continuará gracias a .catch.
    Promise.all(decodePromises)
        .then(() => {
            console.log("[RuedaDinamica] Decodificación asíncrona de todos los SVGs finalizada (o fallos manejados).");
            
            // 3. Fase de Inyección de DOM (Optimización: Inyectar el fragmento completo con rAF)
            requestAnimationFrame(() => {
                this.rueda.appendChild(fragment); // Inyección única
                console.log("[RuedaDinamica] Creación de opciones finalizada y optimizada con rAF.");
                if (onComplete) onComplete();
            });

        })
        .catch(error => {
            // Este catch solo se activaría por un error crítico de Promise.all, no de la decodificación individual.
            console.error("[ERROR] Fallo inesperado en Promise.all al decodificar SVGs:", error);
            // Si Promise.all falla críticamente, procedemos con la inyección de todos modos.
            requestAnimationFrame(() => {
                this.rueda.appendChild(fragment); 
                console.log("[RuedaDinamica] Creación de opciones finalizada después de un error crítico.");
                if (onComplete) onComplete();
            });
        });
}

    /**
     * Centraliza la gestión de will-change en la rueda y sus opciones. (Sin cambios)
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

        // Bloqueo de click: se quita inmediatamente después de aplicar la rotación
        setTimeout(() => {
            this.isRotatingFromClick = false;
        }, 100); // Pequeño delay de 100ms para evitar clicks dobles
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

            // Cálculo del centro del ítem relativo al contenedor scrollable
            const itemCenter = itemRect.top - containerRect.top + container.scrollTop + (itemRect.height / 2);
            // El desplazamiento objetivo es el centro del ítem menos la mitad de la altura del contenedor
            const targetScroll = itemCenter - (containerRect.height / 2);

            // Solo hacemos scroll si es necesario (evita animaciones en la misma posición)
            if (Math.abs(container.scrollTop - targetScroll) > 1) {
                container.scrollTo({ top: targetScroll, behavior: 'smooth' });
            }
        }
    }

    updateViewState() {
        // En el modo desktop, establecemos la rotación inicial y activamos el control CSS.
        if (!this.isMobileView) {
            // Aseguramos que no haya un 'transform' directo para que la variable CSS funcione
            this.rueda.style.transform = ''; 

            // Actualizamos la rotación objetivo basándonos en el índice actual
            // El ángulo inicial del ítem es la base. La rotación de la rueda lo contrarresta.
            this.rotacionObjetivoRueda = this.initialAngles[this.indiceActual] * -1;
            this._applyTargetRotation();
            this.setWillChangeState(true); 
        } else {
            // Estado Móvil: Rueda como contenedor de scroll vertical.
            this.rueda.style.transform = `none`; 
            this.rueda.style.setProperty(this.ruedaRotacionCSSVar, `0deg`); 
            this.setWillChangeState(false); 
        }

        // Siempre asegurar el scroll/posición después de un cambio de vista
        this.scrollToSelectedIndex(this.indiceActual);
    }

    /**
     * @private
     * Precarga y decodifica un fondo para evitar el bloqueo del hilo principal.
     * MEJORA: Se añade manejo de requestIdleCallback en el decodificador de imágenes.
     */
    _preloadAndDecodeImage(url) {
        if (this.backgroundPreloadCache.has(url)) {
            return this.backgroundPreloadCache.get(url);
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const decodeAction = () => {
                    if ('decode' in img) {
                        img.decode()
                            .then(() => resolve(url))
                            .catch(error => {
                                // ⚠️ No se rechaza, se resuelve para no detener el flujo si falla una decodificación.
                                console.warn(`Error al decodificar imagen: ${url}. Resolviendo en fallback.`, error);
                                resolve(url);
                            });
                    } else {
                        resolve(url);
                    }
                };

                // APLAZAR LA EJECUCIÓN: Garantiza que la decodificación (si no es nativa) o
                // la resolución de la promesa no bloquee el frame de animación.
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(decodeAction);
                } else {
                    setTimeout(decodeAction, 0);
                }
            };
            img.onerror = (e) => {
                console.warn(`Error al cargar el recurso (red): ${url}. Resolviendo en fallback.`, e);
                resolve(url); // Resolver para no bloquear el Promise.all implícito.
            };
            img.src = url;
        });

        this.backgroundPreloadCache.set(url, promise);
        return promise;
    }

    /**
     * Gestiona la transición de fondos evitando la acumulación de capas. (Sin cambios significativos)
     */
    actualizarFondo() {
        const baseName = this.menuItems[this.indiceActual];
        const bgUrl = this.config.backgroundDirectory + baseName + this.config.backgroundExtension;
        const fullBgUrl = `url('${bgUrl}')`;

        if (this.currentBackgroundUrl === fullBgUrl) {
            return;
        }

        // Se usa el nuevo _preloadAndDecodeImage con gestión de requestIdleCallback/setTimeout(0)
        this._preloadAndDecodeImage(bgUrl).then(resolvedUrl => {
            if (`url('${resolvedUrl}')` !== fullBgUrl) return; 

            this.currentBackgroundUrl = fullBgUrl;

            // --- 1. CANCELACIÓN DE ELIMINACIÓN ANTERIOR ---
            if (this.backgroundRemovalTimeoutId) {
                clearTimeout(this.backgroundRemovalTimeoutId);
                this.backgroundRemovalTimeoutId = null; 
            }

            if (this.pendingBackgroundRemoval && this.backgroundContainer.contains(this.pendingBackgroundRemoval)) {
                this.pendingBackgroundRemoval.style.willChange = 'auto';
                this.backgroundContainer.removeChild(this.pendingBackgroundRemoval);
                this.pendingBackgroundRemoval = null;
            }
            
            const capaAnterior = this.capaFondoActual;
            
            // --- 2. Crear y añadir la nueva capa ---
            const nuevaCapa = document.createElement('div');
            nuevaCapa.classList.add('background-layer');
            nuevaCapa.style.backgroundImage = fullBgUrl;
            nuevaCapa.style.willChange = 'opacity';
            
            this.backgroundContainer.appendChild(nuevaCapa);
            this.capaFondoActual = nuevaCapa; 

            void nuevaCapa.offsetWidth; 
            
            nuevaCapa.style.opacity = '1';

            // --- 3. Gestionar la capa anterior ---
            if (capaAnterior) {
                capaAnterior.style.opacity = '0';
                this.pendingBackgroundRemoval = capaAnterior;

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
        
        // Uso de Map o Set para un lookup ligeramente más rápido y limpio
        const rotationalKeys = new Set(['arrowleft', 'arrowright', 'a', 'd']);
        const verticalKeys = new Set(['arrowup', 'arrowdown', 'w', 's']);
        const isEnterKey = key === 'enter';

        if (this.isMobileView) {
            if (verticalKeys.has(key)) {
                direccion = (key === 'arrowdown' || key === 's') ? 1 : -1;
            }
        } else {
            if (rotationalKeys.has(key) || verticalKeys.has(key)) {
                // En desktop, todas giran la rueda
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
        // Simplificado: solo un bloqueo simple
        if (this.isRotatingFromClick) return; 

        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const targetIndex = parseInt(clickedOption.dataset.index, 10);
        const previousIndex = this.indiceActual; // Guardar el índice actual antes de cambiarlo

        if (targetIndex === previousIndex) {
            this.callbacks.abrirModal(this.menuItems[this.indiceActual]);
            return;
        }

        this.isRotatingFromClick = true; // Bloqueo temporal

        // ✅ CORRECCIÓN CLAVE: Actualizar el índice después de calcular la diferencia.
        this.indiceActual = targetIndex;
        let diferenciaPasos = 0;

        if (!this.isMobileView) {
            // Se calcula la diferencia usando el índice anterior
            diferenciaPasos = targetIndex - previousIndex;

            // Cálculo para la ruta de rotación más corta
            if (Math.abs(diferenciaPasos) > this.halfOptions) {
                diferenciaPasos = (diferenciaPasos > 0) 
                    ? diferenciaPasos - this.totalOpciones 
                    : diferenciaPasos + this.totalOpciones;
            }
            
            // Aplicar la rotación
            this.rotacionObjetivoRueda += (diferenciaPasos * -1) * this.anguloPorOpcion;
            this._applyTargetRotation(); 
            // NOTA: _applyTargetRotation ya gestiona el reset de this.isRotatingFromClick.
        } else {
            // Si es móvil, reseteamos el bloqueo inmediatamente ya que no hay transición de rotación de la rueda
            setTimeout(() => {
                this.isRotatingFromClick = false;
            }, 50);
        }
        
        // Actualizar el índice y la selección (con scroll si es móvil)
        this.actualizarSeleccion(true);
    }

    /**
     * @private
     * Lógica centralizada para la actualización de dimensiones y el estado de la vista.
     * OPTIMIZACIÓN: Añade `oldIsMobileView` a `_handleDimensionUpdateAndResizeLogic` 
     * para pasar la responsabilidad de chequear el cambio de estado móvil a `handleResize`.
     */
    _handleDimensionUpdateAndResizeLogic(initialLoad = false, oldIsMobileView = this.isMobileView) {
        const newIsMobileView = this.checkMobileView(); 

        // CRÍTICO: Solo ejecutar el cálculo costoso si es la carga inicial, 
        // si el breakpoint ha cambiado o si el radio aún no está calculado.
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

        // 3. Lógica de re-selección del grid (si aplica) - Movido a una función si fuera más complejo
        if (this.hayModalAbierto() && typeof this.callbacks.updateGridSelection === 'function') {
            const gridIndex = window.currentGridIndex ?? 0;
            // Se asume que los últimos 3 booleanos controlan la lógica de re-render/scroll
            // Nota: Aquí se está forzando un recálculo/reposicionamiento del grid
            this.callbacks.updateGridSelection(gridIndex, true, true, true); 
        }

        // 4. Asegurar que la selección actual se aplique y el scroll/posición se realice
        // Esto es esencial si solo se cambia el tamaño de la ventana (no el breakpoint)
        this.actualizarSeleccion(newIsMobileView); 
    }

    /**
     * ⚡ OPTIMIZACIÓN: Usa requestAnimationFrame (rAF) para debouncing y evitar layout thrashing.
     */
    handleResize = () => {
        // Cancelar el frame anterior si ya hay uno pendiente.
        if (this.resizeRafId) {
            cancelAnimationFrame(this.resizeRafId);
        }

        const oldIsMobileView = this.isMobileView; // Capturar el estado anterior

        // Programar la actualización para el próximo frame de animación.
        this.resizeRafId = requestAnimationFrame(() => {
            // Ejecutar la lógica pesada
            this._handleDimensionUpdateAndResizeLogic(false, oldIsMobileView);
            
            // Resetear el ID
            this.resizeRafId = null;
        });
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
        // Pre-chequeo del estado para el 'initialLoad'
        this.checkMobileView(); 
        this.setWillChangeState(!this.isMobileView); 

        // Pasar el estado actual como "anterior" para el initialLoad
        this._handleDimensionUpdateAndResizeLogic(initialLoad, this.isMobileView);
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
