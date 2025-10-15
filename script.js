document.addEventListener('DOMContentLoaded', () => {
    
    // Verificación de data.js
    if (typeof menuItems === 'undefined' || !Array.isArray(menuItems)) {
        console.error("No se encontró la lista 'menuItems' o no es un array. Asegúrate de incluir 'data.js' correctamente.");
        return;
    }
    
    // Nueva variable para caché de datos del juego
    const gameDataCache = {};
    
    const rueda = document.getElementById('rueda');
    const backgroundContainer = document.getElementById('background-container'); 
    
    // Elementos del Modal Principal (SISTEMAS)
    const modalOverlay = document.getElementById('modal-overlay');
    const modalHeader = document.getElementById('modal-header');
    const modalCloseButton = document.getElementById('modal-close');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title'); 
    const contentGridContainer = document.getElementById('content-grid-container');

    // 🚨 REFERENCIA: Contenedor con scroll (el modal-body)
    const modalBody = document.querySelector('.modal-body');

    // Nuevos elementos del Modal de Detalles del Juego
    const gameDetailsOverlay = document.getElementById('game-details-overlay');
    const gameDetailsCloseButton = document.getElementById('game-details-close');
    const gameDetailsImage = document.getElementById('game-details-image');
    const gameDetailsTitle = document.getElementById('game-details-title');
    
    // 🚨 REFERENCIA AL BOTÓN DE DESCARGA
    const downloadButton = document.querySelector('.download-button');

    // Variables para la navegación del Grid de juegos
    let currentGridIndex = 0;
    let gridItemsElements = []; // Almacena los elementos <li> del grid
    
    // Variables para limitar la velocidad de navegación del grid
    let gridNavLock = false; 
    const GRID_NAV_DELAY_MS = 150; // Retraso de 150ms entre movimientos
    
    // Variable de bloqueo de entrada para evitar concurrencia
    let inputLock = false; 
    
    // NUEVO: Intervalo para el chequeo periódico de centrado del grid
    let centeringCheckIntervalId = null;
    
    // isCenteringActive: true -> Centrado periódico FUNCIONANDO.
    let isCenteringActive = false; 
    
    // 🚨 NUEVA BANDERA: Indica si el scroll fue provocado por JS (animarScrollGrid) o por el usuario.
    let isProgrammaticScrolling = false;

    // NUEVA CONSTANTE: Margen de centrado aceptable (ej: 100px desde el borde superior/inferior)
    const CENTERING_MARGIN_PX = 100;

    // --- Parámetros de la Rueda Dinámica ---
    const totalOpciones = menuItems.length;
    const anguloPorOpcion = 360 / totalOpciones; 
    
    // Ángulo entre elementos en radianes (Constante, se calcula una vez)
    const anguloRadianes = anguloPorOpcion * (Math.PI / 180);
    
    // NUEVO: Variable mutable para almacenar el radio actual (se actualiza en el resize)
    let currentRadius = 0; 

    // --- Parámetros de Ruta y Formato ---
    const imageDirectory = "Sistemas/"; 
    const imageExtension = ".svg";
    const backgroundDirectory = "Fondos/";
    const backgroundExtension = ".jpg";
    
    // 💥 VARIABLES PARA LA ANIMACIÓN DE SCROLL DEL GRID
    let scrollObjetivo = 0; // Posición de scroll deseada para el centrado
    let scrollActual = 0; // Posición de scroll actual (para animación)
    const factorSuavizadoScroll = 0.2; // Factor de suavizado para el scroll (velocidad)
    let animacionScrollFrameId = null; // ID de requestAnimationFrame para la animación de scroll
    
    
    // --- 🚨 FUNCIÓN DE CÁLCULO Y APLICACIÓN DINÁMICA DE DIMENSIONES ---
    
    function calculateAndApplyDimensions() {
        // 🚨 FACTOR DE ESCALADO DE LA RUEDA: 160% del tamaño base anterior
        const SCALE_FACTOR = 1.6; 
        
        const viewportHeight = window.innerHeight;
        
        // 1. ESCALADO BASADO EN VH (9% * 1.6 = 14.4% de la altura del viewport para itemHeight)
        const itemHeightVh = 9 * SCALE_FACTOR; 
        
        // Convertir VH a Píxeles (Tamaño dinámico de las opciones)
        const itemHeight = viewportHeight * (itemHeightVh / 100); 
        const itemWidth = itemHeight * (260 / 100); // Mantener proporción 260:100
        
        // 2. Cálculo de separación geométrica
        const targetGapRatio = 1.7; // Mantiene el factor de separación constante (170px/100px)
        const targetGap = itemHeight * targetGapRatio;
        const targetCenterToCenter = itemHeight + targetGap; 

        // 3. Cálculo del radio (R) que garantiza la separación
        let requiredRadius = 0;
        if (totalOpciones > 0) {
             requiredRadius = Math.ceil(targetCenterToCenter / Math.sin(anguloRadianes));
        }
        
        // Escalar el mínimo base (300px en 1080px de alto es ~27.7vh)
        const radioMinimoBase = viewportHeight * (300 / 1080); 
        const radioCalculado = Math.max(radioMinimoBase, requiredRadius); 
        
        // 4. Aplicar radio
        currentRadius = radioCalculado; 
        
        // 5. Parámetro de Desplazamiento (Ajuste constante para mostrar siempre 3 items)
        const margenExtraPorDesplazamiento = 0.8; 
        
        // 6. Resultados y Aplicación de Estilos
        const ruedaTamano = radioCalculado * 2; 
        // La posición izquierda es proporcional al radio.
        const posicionLeft = -(radioCalculado * (1 + margenExtraPorDesplazamiento));
        
        // Aplicar estilos dinámicos a la RUEDA
        rueda.style.setProperty('--rueda-tamano', `${ruedaTamano}px`);
        rueda.style.left = `${posicionLeft}px`; 

        // 7. Aplicar estilos y POSICIÓN ESTÁTICA a las OPCIONES (¡SÓLO AQUÍ!)
        const R = currentRadius;
        
        opciones.forEach((opcion, index) => {
            opcion.style.height = `${itemHeight}px`;
            opcion.style.width = `${itemWidth}px`; 
            
            // 💥 POSICIONAMIENTO ESTÁTICO DENTRO DEL CÍRCULO
            const anguloPosicionamiento = initialAngles[index];
            const anguloRadianes = anguloPosicionamiento * Math.PI / 180;
            const xOffset = Math.cos(anguloRadianes) * R; 
            const yOffset = Math.sin(anguloRadianes) * R; 
            
            // Posicionamiento de la opción
            opcion.style.left = `calc(50% + ${xOffset}px)`;
            opcion.style.top = `calc(50% + ${yOffset}px)`;
        });
        
        // Forzar corrección de rotación (ya que el radio ha cambiado)
        corregirHorizontalidad();
    }
    // -------------------------------------------------------------


    // --- 1. Generación Dinámica de Opciones ---
    menuItems.forEach((baseName, index) => {
        const opcion = document.createElement('div');
        opcion.classList.add('opcion');
        
        // 🚨 Nota: La altura y ancho se establecerán en calculateAndApplyDimensions()
        
        const img = document.createElement('img');
        
        img.src = imageDirectory + baseName + imageExtension; 
        img.alt = baseName;
        img.title = baseName; 
        
        opcion.appendChild(img);
        rueda.appendChild(opcion);
    });
    
    const opciones = document.querySelectorAll('.opcion'); 

    // Almacena los ángulos iniciales de cada opción
    const initialAngles = Array.from(opciones).map((op, index) => index * anguloPorOpcion);
    
    
    // Función de Bucle de Animación de la Rueda
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
        
        // Aplica la rotación a la rueda
        // 🚀 ÓPTIMO: Solo actualiza la propiedad 'transform' para usar la GPU (will-change en CSS)
        rueda.style.transform = `translateY(-50%) rotate(${rotacionActualRueda}deg)`;
        
        corregirHorizontalidad();
    }
    
    // 💥 FUNCIÓN DE BUCLE DE ANIMACIÓN DE SCROLL DEL GRID
    function animarScrollGrid() {
        const diferenciaScroll = scrollObjetivo - scrollActual;
        
        if (Math.abs(diferenciaScroll) < 1) {
            scrollActual = scrollObjetivo;
            
            // Detener la animación solo si está lo suficientemente cerca
            if (animacionScrollFrameId) {
                 cancelAnimationFrame(animacionScrollFrameId);
                 animacionScrollFrameId = null;
            }
            
            // 🚨 CLAVE: El scroll programático ha terminado.
            isProgrammaticScrolling = false; 
        } else {
            // Aplicar suavizado
            scrollActual += diferenciaScroll * factorSuavizadoScroll;
            // Continuar la animación
            animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
        }
        
        // Aplicar el nuevo scroll al contenedor
        modalBody.scrollTop = scrollActual;
    }


    // Mantiene las opciones horizontales (¡AHORA SÓLO APLICA EL TRANSFORM!)
    function corregirHorizontalidad() {
        
        const correccion = rotacionActualRueda * -1;
        
        opciones.forEach(opcion => {
            // SOLO actualiza la rotación de corrección (propiedad de alto rendimiento)
            opcion.style.transform = `
                translate(-50%, -50%) 
                rotate(${correccion}deg)
            `;
        });
    }
    
    
    let indiceActual = 0; 
    
    // Variables para la animación dinámica
    let rotacionObjetivoRueda = 0; 
    let rotacionActualRueda = 0; 
    const factorSuavizado = 0.15; 
    let animacionFrameId = null; 
    
    // Referencia a la capa que debe permanecer visible (opacity: 1)
    let capaFondoActual = null; 
    
    // FUNCIÓN PARA CAMBIAR EL FONDO (Mantiene la capa visible)
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


    function actualizarSeleccion() {
        opciones.forEach(op => op.classList.remove('seleccionada'));
        opciones[indiceActual].classList.add('seleccionada');
        
        actualizarFondo();
    }

    // Función de rotación
    function rotarRueda(direccion) {
        // 1. Actualiza el índice y el ángulo objetivo
        indiceActual = (indiceActual + direccion + totalOpciones) % totalOpciones;
        rotacionObjetivoRueda += (direccion * -1) * anguloPorOpcion; 
        
        // 2. Si la animación no está corriendo, iníciala
        if (animacionFrameId === null) {
            animacionFrameId = requestAnimationFrame(animarRueda);
        }
        
        // 3. Actualiza el estado visual de selección
        actualizarSeleccion();
    }
    
    // --- FUNCIONES PARA EL GRID DINÁMICO ---
    
    /**
     * Determina el número de columnas del grid basándose en los nuevos breakpoints.
     * @returns {number} El número de columnas actual.
     */
    function getGridColumns() {
        const width = window.innerWidth;
        if (width > 1920) return 8; // Nuevo default para pantallas muy grandes
        if (width > 1600) return 7; // 1601px a 1920px
        if (width > 1440) return 6; // 1441px a 1600px
        if (width > 1280) return 5; // 1281px a 1440px
        if (width > 900) return 4;  // 901px a 1280px
        if (width > 600) return 3;  // 601px a 900px
        return 2; // < 600px
    }
    
    /**
     * Parsea el texto sin procesar para extraer elementos que comienzan con un guion.
     * Retorna un array de objetos: {name: string, url: string | null}
     */
    function parseHyphenList(rawText) {
        if (!rawText) return [];
        
        return rawText.split('\n')
            .map(line => line.trim()) 
            .filter(line => line.startsWith('-')) 
            .map(line => {
                const content = line.substring(1).trim(); // Remueve el '-'
                
                // Expresión regular para encontrar el texto entre las últimas comillas
                // y que sea el final de la línea.
                const urlRegex = /"([^"]*)"\s*$/;
                const urlMatch = content.match(urlRegex);
                
                let name = content;
                let url = null;
                
                if (urlMatch) {
                    url = urlMatch[1]; // El contenido de las comillas
                    // Remueve el link y las comillas de la parte del nombre
                    name = content.replace(urlMatch[0], '').trim();
                }
                
                // Retorna un objeto con el nombre (sin URL) y la URL.
                return { name, url };
            })
            .filter(item => item.name.length > 0); // Solo incluir si el nombre existe
    }
    
    
    /**
     * Carga los elementos del juego mediante script (compatible con file://) o los obtiene de la caché.
     */
    function loadGameItems(systemName, callback) {
        // 1. Verificar la caché
        if (gameDataCache[systemName]) {
            callback(gameDataCache[systemName]);
            return;
        }
    
        // 2. Cargar el script
        const scriptUrl = 'Games/' + systemName + '.js'; 
        
        // ¡Variable genérica usada por el archivo de juego!
        const globalVarName = `currentGameListString`;
        
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = scriptUrl;

        script.onload = () => {
            let items = [];
            const rawText = window[globalVarName];
            
            if (typeof rawText === 'string') {
                // 3. Parsear la lista con guiones
                items = parseHyphenList(rawText);
                
                // 4. ELIMINAR LA VARIABLE GLOBAL para evitar colisiones (SOLUCIÓN AL BUG ORIGINAL)
                delete window[globalVarName];
            } else {
                 console.warn(`[ADVERTENCIA] La variable global ${globalVarName} no se encontró o no es una cadena después de cargar el script: ${scriptUrl}`);
            }

            // 5. Almacenar en caché y llamar al callback
            gameDataCache[systemName] = items;
            callback(items);
            
            // Opcional: Eliminar el elemento script después de usarlo
            script.remove();
        };
        script.onerror = () => {
            console.error(`[ERROR] 🚨 No se pudo cargar el archivo: ${scriptUrl}.`);
            gameDataCache[systemName] = []; 
            callback([]); 
            script.remove();
        };
        
        document.head.appendChild(script);
    }
    
    /**
     * Limpia el nombre de un juego, eliminando el texto que está entre el primer paréntesis.
     */
    function cleanGameName(name) {
        // Busca la posición del primer paréntesis de apertura
        const index = name.indexOf('(');
        // Si lo encuentra, retorna la subcadena antes del paréntesis y lo limpia de espacios.
        return index > -1 ? name.substring(0, index).trim() : name;
    }

    // FUNCIÓN DE VERIFICACIÓN Y CENTRADO PERIÓDICO
    function checkAndRecenterGridSelection() {
        if (!modalBody || gridItemsElements.length === 0 || !modalOverlay.classList.contains('open') || gameDetailsOverlay.classList.contains('open')) {
            return; 
        }
        
        // 🚨 CLAVE: Si el centrado está desactivado, no centrar.
        if (!isCenteringActive) { 
             return; 
        }


        const selectedElement = gridItemsElements[currentGridIndex];
        if (!selectedElement) return;

        // 1. Obtener dimensiones del viewport del scroll
        const viewportHeight = modalBody.clientHeight;
        
        // 2. Calcular la posición relativa del elemento
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = modalBody.getBoundingClientRect();
        
        // Posición del borde superior e inferior del elemento DENTRO del viewport del scroll
        const elementTopInViewport = elementRect.top - containerRect.top;
        const elementBottomInViewport = elementRect.bottom - containerRect.top;
        
        // 3. Lógica de Verificación
        const isTooHigh = elementTopInViewport < CENTERING_MARGIN_PX;
        const isTooLow = elementBottomInViewport > viewportHeight - CENTERING_MARGIN_PX;
        const isOutOfView = elementBottomInViewport < 0 || elementTopInViewport > viewportHeight;
        

        if (isTooHigh || isTooLow || isOutOfView) {
            // Si el centrado está activo y el elemento está fuera de margen, forzamos el centrado
            updateGridSelection(currentGridIndex, true, true, true); 
        }
    }


    /**
     * FUNCIÓN CORREGIDA: Actualiza la selección y opcionalmente fuerza el scroll.
     * @param {number} newIndex - El nuevo índice seleccionado.
     * @param {boolean} [forceScroll=true] - Si se debe forzar el scroll al centro.
     * @param {boolean} [isResizeOrInitialLoad=false] - Indica si la llamada es por redimensionamiento o carga inicial.
     * @param {boolean} [ignoreHorizontalCheck=false] - Ignora la optimización de movimiento horizontal.
     */
    function updateGridSelection(newIndex, forceScroll = true, isResizeOrInitialLoad = false, ignoreHorizontalCheck = false) {
        if (gridItemsElements.length === 0) return;
        
        const oldIndex = currentGridIndex; // Guardar el índice ANTERIOR
        
        // Remover clase del elemento anterior
        if (oldIndex !== null && gridItemsElements[oldIndex]) {
            gridItemsElements[oldIndex].classList.remove('selected');
        }

        currentGridIndex = newIndex;

        const selectedElement = gridItemsElements[currentGridIndex];
        
        // Agregar clase al nuevo elemento seleccionado
        selectedElement.classList.add('selected');

        // --- LÓGICA DE SCROLL CENTRADO FLUIDO Y PERFECTO (Solo si se solicita) ---
        if (!forceScroll) return;
        
        // 💥 LÓGICA PARA EVITAR EL SCROLL VERTICAL EN MOVIMIENTOS HORIZONTALES
        let isHorizontalMovement = false;
        
        // Solo ejecuta esta optimización si NO se está forzando desde el chequeo periódico.
        if (!isResizeOrInitialLoad && !ignoreHorizontalCheck) { 
            if (oldIndex !== null) {
                const currentColumns = getGridColumns();
                // Si el nuevo índice y el viejo índice están en la misma fila
                if (Math.floor(newIndex / currentColumns) === Math.floor(oldIndex / currentColumns)) {
                    isHorizontalMovement = true;
                }
            }
        }
        
        // Si el movimiento es estrictamente horizontal (y no es inicial/resize/chequeo forzado), regresamos.
        if (isHorizontalMovement) {
            return;
        }
        // --------------------------------------------------------------------------
        
        
        // 1. Obtener dimensiones del viewport del scroll
        const viewportHeight = modalBody.clientHeight;
        
        // 2. Determinar la fila y encontrar el elemento más alto (para centrado consistente)
        const currentColumns = getGridColumns();
        const rowIndex = Math.floor(currentGridIndex / currentColumns);
        const rowStartIndex = rowIndex * currentColumns;
        const rowEndIndex = Math.min((rowIndex + 1) * currentColumns, gridItemsElements.length);
        
        let maxHeight = 0;

        // Encontrar la altura máxima en la fila
        for (let i = rowStartIndex; i < rowEndIndex; i++) {
            const item = gridItemsElements[i];
            if (item.offsetHeight > maxHeight) {
                maxHeight = item.offsetHeight;
            }
        }

        const rowStartElement = gridItemsElements[rowStartIndex];
        
        // 3. Obtener Rects para calcular la posición absoluta de la fila dentro del contenido scrollable.
        const elementRect = rowStartElement.getBoundingClientRect();
        const containerRect = modalBody.getBoundingClientRect();
        
        // 💥 CORRECCIÓN CLAVE: elementTopInScroll es la distancia real desde el inicio del contenido scrollable
        const elementTopInScroll = elementRect.top - containerRect.top + modalBody.scrollTop;
        
        // 4. Calcular la compensación necesaria para centrar la *altura máxima* de la fila:
        const offsetToCenter = (viewportHeight - maxHeight) / 2;
        
        // 5. Calcular el scrollObjetivo:
        // Posición de la fila - Offset para centrar la altura máxima.
        scrollObjetivo = elementTopInScroll - offsetToCenter; 

        // 6. Limitar el scroll objetivo al mínimo (0) y al máximo posible
        scrollObjetivo = Math.max(0, scrollObjetivo);
        scrollObjetivo = Math.min(scrollObjetivo, modalBody.scrollHeight - viewportHeight);


        // 💥 INICIO MODIFICACIÓN PARA EVITAR EL JITTER HORIZONTAL 💥
        // Solo iniciar la animación si la diferencia entre la posición actual y el objetivo
        // es mayor a una pequeña tolerancia (e.g., 2 píxeles).
        const SCROLL_TOLERANCE_PX = 2;
        
        // Usamos modalBody.scrollTop ya que es la posición actual real del DOM.
        const scrollDifference = Math.abs(scrollObjetivo - modalBody.scrollTop);
        
        if (scrollDifference < SCROLL_TOLERANCE_PX) {
            // Si la diferencia es menor a la tolerancia, consideramos que ya está "centrado"
            // y evitamos iniciar o continuar una animación de scroll.
            
            // Aseguramos que cualquier animación pendiente se detenga
            if (animacionScrollFrameId) {
                cancelAnimationFrame(animacionScrollFrameId);
                animacionScrollFrameId = null;
                isProgrammaticScrolling = false; 
            }
            return; 
        }
        // 💥 FIN MODIFICACIÓN PARA EVITAR EL JITTER HORIZONTAL 💥


        // 7. Si es la primera vez (o un cambio brusco), establecer el scrollActual para empezar la animación desde allí
        if (animacionScrollFrameId === null) {
            scrollActual = modalBody.scrollTop;
        }
        
        // 8. Iniciar la animación de scroll
        if (animacionScrollFrameId === null) {
            // 🚨 CLAVE CORREGIDA: Activar la bandera antes de iniciar la animación programática
            isProgrammaticScrolling = true; 
            animacionScrollFrameId = requestAnimationFrame(animarScrollGrid);
        }
        
        // --- FIN LÓGICA DE SCROLL CENTRADO FLUIDO ---
    }


    function renderGrid(items) {
        const systemName = menuItems[indiceActual].toLowerCase(); 
        
        const gameDirectory = "Games/"; 
        
        // Extensión WebP
        const imageExtension = ".webp"; 
        
        // URL del SVG de carga
        const loadingSvgUrl = "Icons/loading.svg";

        contentGridContainer.innerHTML = '';
        
        if (!items || items.length === 0) {
            contentGridContainer.innerHTML = `<p style="text-align: center; color: #aaa; padding-top: 50px;">No se encontró contenido o el archivo de datos no existe para ${modalTitle.textContent}.</p>`;
            // Resetear el grid para que la navegación por teclado no interfiera
            gridItemsElements = [];
            currentGridIndex = 0;
            return;
        }
        
        const grid = document.createElement('ul');
        grid.classList.add('content-grid');

        // 🚀 OPTIMIZACIÓN: Crear un DocumentFragment para construir el árbol en memoria.
        const fragment = document.createDocumentFragment();

        // Resetear arrays y el índice
        gridItemsElements = [];
        currentGridIndex = 0;


        items.forEach((item, index) => { // item is now {name: string, url: string | null}
            const itemElement = document.createElement('li');
            itemElement.classList.add('grid-item');
            
            const imageBaseName = item.name; 
            
            // CAMBIO SOLICITADO ANTERIOR: Agregar el sufijo "-thumb" al nombre del archivo de imagen
            const imageFileNameWithThumb = imageBaseName + "-thumb";
            
            // Uso de la extensión .webp
            const imageUrl = `${gameDirectory}${systemName}/${imageFileNameWithThumb}${imageExtension}`;
            
            const imageElement = document.createElement('img');
            imageElement.classList.add('grid-item-image');
            
            // PASO 1: Establecer estado de carga inicial con el SVG
            imageElement.src = loadingSvgUrl;
            imageElement.alt = item.name;
            imageElement.title = item.name;
            imageElement.classList.add('is-loading'); // Aplicar estilos de carga
            
            // PASO 2: Pre-cargar la imagen real de forma asíncrona
            const preloader = new Image();
            
            preloader.onload = function() {
                // PASO 3: Cuando la imagen real carga, hacer el switch y el cálculo de aspecto
                const width = this.naturalWidth;
                const height = this.naturalHeight;
                
                imageElement.src = imageUrl;
                imageElement.style.aspectRatio = `${width} / ${height}`;
                
                // Quitar la clase de carga y sus estilos (padding/aspecto 16/9)
                imageElement.classList.remove('is-loading');
                imageElement.style.objectFit = 'cover'; 
                imageElement.style.padding = '0';
            };
            
            preloader.onerror = function() {
                // PASO 4: Si la imagen real falla, mantener el icono de carga.
                imageElement.alt = `Error al cargar portada para ${item.name}`;
                console.warn(`[ERROR IMAGEN] No se pudo cargar la imagen para: ${item.name}`);
            };
            
            // Iniciar la carga
            preloader.src = imageUrl;


            const titleElement = document.createElement('div');
            titleElement.classList.add('grid-item-title');
            // ✅ Se usa la función de limpieza para que los paréntesis NO se vean en el Grid
            titleElement.textContent = cleanGameName(item.name); 
            

            // Modificación del Evento de Clic
            itemElement.addEventListener('click', () => {
                // 🚨 CLAVE DE ACTIVACIÓN: Reactivar el centrado al cliquear un elemento.
                isCenteringActive = true; 
                
                // 1. Establecer el elemento clicado como seleccionado, y forzar el scroll para centrarlo.
                updateGridSelection(index, true, false); 
                
                // 2. Abrir el Modal de Detalles del Juego
                // 🚨 Pasar el link de descarga (item.url) y el nombre completo (item.name)
                abrirDetallesJuego(item.name, imageUrl, item.url); 
            });


            itemElement.appendChild(imageElement);
            itemElement.appendChild(titleElement);
            
            // 🚀 OPTIMIZACIÓN: Agregar al fragmento
            fragment.appendChild(itemElement);
            
            // Almacenar el elemento para la navegación por teclado
            gridItemsElements.push(itemElement);
        });

        // 🚀 OPTIMIZACIÓN: Añadir todos los elementos del fragmento de golpe (una sola operación de DOM)
        grid.appendChild(fragment); 

        contentGridContainer.appendChild(grid);
        
        // Inicializar la selección del grid si hay elementos
        if (gridItemsElements.length > 0) {
            updateGridSelection(0, true, true); // 🚨 ACTUALIZADO: Forzar scroll en la carga inicial
        }
    }
    // --- FIN FUNCIONES GRID ---


    // --- Lógica de Apertura/Cierre del Modal SECUNDARIO (DETALLES DEL JUEGO) ---
    
    function abrirDetallesJuego(gameName, imageUrl, downloadUrl) {
        console.log(`-> Abriendo detalles del juego: ${gameName}`);
        
        gameDetailsImage.src = imageUrl;
        gameDetailsImage.alt = gameName;
        
        // ✅ Aquí se usa el nombre completo (gameName) para que aparezcan los paréntesis.
        gameDetailsTitle.textContent = gameName; 

        // 🚨 CONFIGURAR EL BOTÓN DE DESCARGA
        if (downloadUrl) {
            downloadButton.textContent = 'Descargar Juego';
            downloadButton.disabled = false;
            // Abrir el link en una nueva pestaña
            downloadButton.onclick = () => window.open(downloadUrl, '_blank'); 
        } else {
            downloadButton.textContent = 'No disponible';
            downloadButton.disabled = true;
            downloadButton.onclick = null; // No hace nada al hacer clic
        }
        
        gameDetailsOverlay.style.display = 'flex';
        void gameDetailsOverlay.offsetWidth; 
        gameDetailsOverlay.classList.add('open');
        
        // Adaptar la relación de aspecto de la imagen en el modal de detalles
        const tempImg = new Image();
        tempImg.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;
            // Aplicar el aspect-ratio a la imagen del modal de detalles
            gameDetailsImage.style.aspectRatio = `${width} / ${height}`;
        }
        tempImg.src = imageUrl;
    }
    
    /**
     * Cierra el modal de detalles con la transición CSS (300ms de opacidad).
     */
    function cerrarDetallesJuego() {
        if (inputLock) return; 
        inputLock = true;
        
        gameDetailsOverlay.classList.remove('open');
        setTimeout(() => {
            gameDetailsOverlay.style.display = 'none';
            inputLock = false; 
        }, 300);
    }

    /**
     * Fuerza el cierre inmediato del modal de detalles.
     */
    function hideGameDetailsHard() {
        gameDetailsOverlay.classList.remove('open');
        gameDetailsOverlay.style.display = 'none';
    }


    // Asignar eventos de cierre del modal de detalles
    gameDetailsCloseButton.addEventListener('click', cerrarDetallesJuego);
    gameDetailsOverlay.addEventListener('click', (event) => {
        // Cierra si se hace clic directamente en el overlay (el fondo oscuro)
        if (event.target === gameDetailsOverlay) {
            cerrarDetallesJuego();
        }
    });


    // --- Lógica de Apertura/Cierre del Modal PRINCIPAL (SISTEMAS) ---

    function abrirModal() {
        if (inputLock) return; 
        inputLock = true;
        
        try {
            console.log("-> Función abrirModal() llamada.");

            const baseName = menuItems[indiceActual];
            const imageUrl = imageDirectory + baseName + imageExtension;
            const bgUrl = backgroundDirectory + baseName + backgroundExtension; 
            const systemName = baseName; 
            
            // 1. ABRIR EL MODAL 
            modalOverlay.style.display = 'flex';
            void modalOverlay.offsetWidth; 
            modalOverlay.classList.add('open');
            document.body.setAttribute('data-modal-open', 'true');
            
            // 2. Cargar datos visuales del sistema
            modalImage.src = imageUrl;
            modalImage.alt = baseName;
            modalTitle.textContent = baseName.replace(/-/g, ' ').toUpperCase(); 
            modalHeader.style.setProperty('--bg-url', `url('${bgUrl}')`);
            
            // 3. Cargar los datos de juego
            loadGameItems(systemName, (items) => {
                if (items.length > 0) {
                    console.log(`[CARGA ASÍNCRONA] Lista cargada y renderizada para ${systemName}.`);
                    renderGrid(items);
                } else {
                    renderGrid([]); 
                }
            });

            // 💥 INICIAR EL CHEQUEO DE CENTRADO PERIÓDICO
            // Limpiar cualquier intervalo anterior por si acaso
            if (centeringCheckIntervalId) {
                clearInterval(centeringCheckIntervalId);
            }
            // Iniciar el chequeo cada 500ms (ajustable)
            centeringCheckIntervalId = setInterval(checkAndRecenterGridSelection, 500);
            
            // 🚨 CLAVE: Activar el centrado al abrir el modal.
            isCenteringActive = true; 


            // Liberar bloqueo después de un tiempo prudencial (más corto que el cierre)
            setTimeout(() => {
                inputLock = false; 
            }, 200);

        } catch (error) {
            console.error("[ERROR CRÍTICO SÍNCRONO] 🚨 La función abrirModal() falló:", error);
            modalOverlay.style.display = 'none';
            modalOverlay.classList.remove('open');
            inputLock = false; // Asegurar que el bloqueo se libere en caso de error
        }
    }

    function cerrarModal() {
        if (inputLock) return; 
        inputLock = true;
        
        modalOverlay.classList.remove('open');
        
        contentGridContainer.innerHTML = '';
        gridItemsElements = []; // Limpiar lista de elementos del grid
        currentGridIndex = 0; // Resetear índice de selección
        
        // FIX: Asegurarse de que el modal de detalles se cierre inmediatamente
        hideGameDetailsHard();

        // 💥 DETENER EL CHEQUEO DE CENTRADO PERIÓDICO (Se detiene el intervalo)
        if (centeringCheckIntervalId) {
            clearInterval(centeringCheckIntervalId);
            centeringCheckIntervalId = null;
        }
        
        // 🚨 Detener la animación de scroll al cerrar el modal
        if (animacionScrollFrameId) {
            cancelAnimationFrame(animacionScrollFrameId);
            animacionScrollFrameId = null;
            // También asegurar que la bandera de scroll programático se apague al cerrar.
            isProgrammaticScrolling = false; 
        }
        
        // 🚨 CLAVE: Desactivar centrado al cerrar
        isCenteringActive = false; 
        
        setTimeout(() => {
            modalOverlay.style.display = 'none';
            document.body.setAttribute('data-modal-open', 'false');
            inputLock = false; // Liberar bloqueo después de la transición
        }, 300); 
    }
    
    // Asignar eventos de cierre del modal principal
    modalCloseButton.addEventListener('click', cerrarModal);

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            cerrarModal();
        }
    });
    
    // ----------------------------------------------------
    // --- Lógica de Teclado y Scroll ---
    // ----------------------------------------------------
    
    let isScrolling = false;
    const scrollTimeout = 100; 

    // 🚨 DESACTIVACIÓN CATCH-ALL POR SCROLL (Rueda, Trackpad, Táctil, Clic central)
    // El evento 'scroll' se dispara por cualquier desplazamiento manual.
    modalBody.addEventListener('scroll', () => {
        
        if (modalOverlay.classList.contains('open')) {
            
            // 🚨 CLAVE CORREGIDA: Solo desactivar si el scroll NO fue programático.
            if (!isProgrammaticScrolling) { 
                // Si el usuario provoca scroll manualmente, se desactiva el centrado permanentemente.
                isCenteringActive = false; 
                
                // Si se desactiva por scroll manual, cancelamos cualquier animación de scroll pendiente
                if (animacionScrollFrameId) {
                    cancelAnimationFrame(animacionScrollFrameId);
                    animacionScrollFrameId = null;
                }
            }
        }
    }, { passive: true }); // Usar passive: true para no bloquear el scroll nativo
    
    // 🚨 DESACTIVACIÓN POR CLIC EN ESPACIO VACÍO
    modalBody.addEventListener('mousedown', (event) => {
        // Si el modal está abierto Y el clic no fue en un elemento del grid.
        if (modalOverlay.classList.contains('open') && !event.target.closest('.grid-item')) {
             isCenteringActive = false; 
        }
    });


    document.addEventListener('keydown', (event) => {
        
        const detallesAbierto = gameDetailsOverlay.classList.contains('open');
        const modalAbierto = modalOverlay.classList.contains('open');
        const isGridActive = modalAbierto && !detallesAbierto && gridItemsElements.length > 0;
        
        // FIX CONCURRENCIA: Si se presiona Enter o Escape y el sistema está bloqueado (transición en curso), ignorar
        if ((event.key === 'Enter' || event.key === 'Escape') && inputLock) {
            event.preventDefault();
            return; 
        }

        if (event.key === 'Escape') {
            if (detallesAbierto) {
                // Cierre de detalles (función manejará el bloqueo)
                cerrarDetallesJuego(); 
            } else if (modalAbierto) {
                // Cierre principal (función manejará el bloqueo y el cierre forzado de detalles)
                cerrarModal(); 
            }
            event.preventDefault();
            return;
        }
        
        // 1. Navegación y Acción del GRID (Tiene prioridad si el modal principal está abierto)
        if (isGridActive) {
            
            // FIX: Si es un evento de auto-repetición (key held down) Y el bloqueo está activo, ignorar.
            if (event.repeat && gridNavLock) {
                event.preventDefault(); 
                return;
            }
            
            let newIndex = currentGridIndex;
            let targetIndex = currentGridIndex; 
            let handled = false;
            const lastIndex = gridItemsElements.length - 1; 
            
            // DINÁMICO: Obtener el número de columnas actual
            const currentColumns = getGridColumns(); 
            
            // Definir las teclas de activación (flechas)
            const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);


            if (isArrowKey) {
                // Lógica de Movimiento
                switch (event.key) {
                    case 'ArrowLeft':
                        targetIndex = currentGridIndex - 1;
                        newIndex = (targetIndex < 0) ? lastIndex : targetIndex; 
                        break;
                    case 'ArrowRight':
                        targetIndex = currentGridIndex + 1;
                        newIndex = (targetIndex > lastIndex) ? 0 : targetIndex;
                        break;
                    case 'ArrowUp':
                        targetIndex = currentGridIndex - currentColumns;
                        newIndex = (targetIndex < 0) ? currentGridIndex : targetIndex; 
                        break;
                    case 'ArrowDown':
                        targetIndex = currentGridIndex + currentColumns;
                        newIndex = Math.min(targetIndex, lastIndex);
                        break;
                }
                handled = true; // Se maneja el evento
                
            } else if (event.key === 'Enter') {
                // Simular clic en el elemento seleccionado
                gridItemsElements[currentGridIndex].click();
                handled = true;
                
            } else {
                // 🚨 CLAVE DE DESACTIVACIÓN: Si es cualquier otra tecla (PageUp/Down, Tab, Home, End, letras, etc.)
                isCenteringActive = false;
            }
            
            if (isArrowKey) {
                // Solo si el índice realmente cambió.
                if (newIndex !== currentGridIndex) {
                    
                    // APLICAR BLOQUEO DE NAVEGACIÓN
                    if (event.repeat) {
                        gridNavLock = true;
                        setTimeout(() => {
                            gridNavLock = false;
                        }, GRID_NAV_DELAY_MS);
                    }
                    
                    // 🚨 CLAVE DE ACTIVACIÓN: Reactivar centrado al usar el teclado para navegar
                    isCenteringActive = true; 

                    // Al navegar con flechas, SÍ forzamos el scroll al centro
                    updateGridSelection(newIndex, true, false, false); 
                }
            }
            
            if (handled) {
                event.preventDefault();
                return;
            }
        }
        
        // 2. Abrir Modal Principal con Enter (sólo si ningún modal está abierto)
        if (event.key === 'Enter' && !modalAbierto && !detallesAbierto) {
            abrirModal();
            event.preventDefault();
            return;
        }
        
        // 3. Bloquear otras navegaciones si los modales están abiertos
        if (modalAbierto || detallesAbierto) return;

        // 4. Navegación de la Rueda (solo si no hay modales abiertos)
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
        
        const modalAbierto = modalOverlay.classList.contains('open');
        const detallesAbierto = gameDetailsOverlay.classList.contains('open');
        
        // Si el modal principal o de detalles está abierto, permitir el scroll nativo.
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


    // --- Clic Directo en la Opción de la Rueda ---
    rueda.addEventListener('click', (event) => {
        const clickedOption = event.target.closest('.opcion');
        if (!clickedOption) return;

        const index = Array.from(opciones).indexOf(clickedOption);

        if (index === indiceActual) {
            // Si se hace click en el elemento seleccionado, abrir el modal principal
            abrirModal();
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
    
    // NUEVO: Listener para el redimensionamiento de la ventana
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            calculateAndApplyDimensions();
            // Al redimensionar, forzar un cálculo del scrollObjetivo si el modal está abierto.
            if (modalOverlay.classList.contains('open') && gridItemsElements.length > 0) {
                 // Llamar a updateGridSelection con el índice actual para recalcular y animar
                 // Forzamos el scroll para reajustar la vista si cambia el tamaño de la ventana
                 updateGridSelection(currentGridIndex, true, true, true); // 🚨 ACTUALIZADO
            }
        }, 100); 
    });


    // Inicializar al cargar
    // LLAMADA INICIAL: Establece el radio y el tamaño de las opciones.
    calculateAndApplyDimensions(); 
    
    // Establecer el ángulo inicial de la rotación
    rotacionActualRueda = initialAngles[indiceActual] * -1;
    rotacionObjetivoRueda = rotacionActualRueda;

    // Forzar la selección y el fondo inicial (también llama a corregirHorizontalidad)
    actualizarSeleccion(); 
});