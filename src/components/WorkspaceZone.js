
import SvgPolygon from './SvgPolygon.js';

const workspaceTemplate = document.createElement('template');
workspaceTemplate.innerHTML = `
    <style>
        :host {
            --ruler-size: 40px; 
            display: block;
            height: 400px;
            border: 1px solid #ccc;
            margin: 10px 0;
            padding-left: var(--ruler-size);
            padding-bottom: var(--ruler-size);
            position: relative;
            overflow: hidden;
            background-color: white;
            box-sizing: border-box; 
        }
        .workspace-container {
            width: 100%;
            height: 100%;
            position: relative;
        }
        .svg-container {
            width: 100%;
            height: 100%;
            transform-origin: 0 0; 
            position: absolute;
        }
        
        svg-polygon {
            cursor: grab;
            position: absolute;
            transition: none; 
        }
        svg-polygon:active {
            cursor: grabbing;
            z-index: 100; 
        }
        .ruler {
            position: absolute;
            background-color: #f0f0f0; 
            z-index: 10;
            box-sizing: border-box;
            pointer-events: none; 
            color: #333; 
            font-family: Arial, sans-serif; 
        }
        .ruler-x {
            bottom: 0;
            left: var(--ruler-size);
            width: calc(100% - var(--ruler-size));
            height: var(--ruler-size);
            border-top: 1px solid #333;
        }
        .ruler-y {
            top: 0;
            left: 0;
            width: var(--ruler-size);
            height: calc(100% - var(--ruler-size));
            border-right: 1px solid #333;
        }
        .ruler-tick {
            position: absolute;
            background-color: #333;
            pointer-events: none;
        }
        .ruler-tick-x {
            top: 0;
            width: 1px;
            height: 5px; 
        }
         .ruler-tick-x.major {
            height: 10px; 
         }
        .ruler-tick-y {
            left: 0;
            width: 5px; 
            height: 1px;
        }
        .ruler-tick-y.major {
            width: 10px; 
        }
        .ruler-label {
            position: absolute;
            font-size: 10px;
            color: #333;
            font-family: Arial, sans-serif;
            pointer-events: none;
            white-space: nowrap; 
        }
        .ruler-label-x {
            top: 8px;
            transform: translateX(-50%); 
        }
        .ruler-label-y {
            left: 8px;
            transform: translateY(-50%); 
        }
        .ruler-corner {
            position: absolute;
            bottom: 0;
            left: 0;
            width: var(--ruler-size);
            height: var(--ruler-size);
            background-color: #e0e0e0; 
            border-top: 1px solid #333;
            border-right: 1px solid #333;
            box-sizing: border-box;
            z-index: 11; 
            pointer-events: none;
        }
    </style>
    <h3>Workspace Zone</h3>
    <div class="ruler-corner"></div>
    <div class="ruler ruler-x" id="ruler-x"></div>
    <div class="ruler ruler-y" id="ruler-y"></div>
    <div class="workspace-container" id="workspace">
        <div class="svg-container" id="svg-container"></div>
    </div>
`;

class WorkspaceZone extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(workspaceTemplate.content.cloneNode(true));

        this.workspace = this.shadowRoot.getElementById('workspace');
        this.svgContainer = this.shadowRoot.getElementById('svg-container');
        this.rulerX = this.shadowRoot.getElementById('ruler-x');
        this.rulerY = this.shadowRoot.getElementById('ruler-y');

        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        this.isViewDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        this.polygonIdCounter = 0;

        this.boundStartViewDrag = this._startViewDrag.bind(this);
        this.boundMoveView = this._moveView.bind(this);
        this.boundStopViewDrag = this._stopViewDrag.bind(this);

        this.boundHandleDrop = this.handleDrop.bind(this);
        this.boundHandleWheel = this.handleWheel.bind(this);


        this.setupWorkspaceListeners();
        this.applyTransform(); 
        this.updateRulers(); 
    }

    connectedCallback() {
        this.workspace.addEventListener('mousedown', this.boundStartViewDrag);
        this.workspace.addEventListener('dragover', (e) => e.preventDefault()); 
        this.workspace.addEventListener('drop', this.boundHandleDrop);
        this.workspace.addEventListener('wheel', this.boundHandleWheel, { passive: false }); 

        this.boundHandlePolygonDropped = this.handlePolygonDroppedFromBuffer.bind(this);
        document.addEventListener('polygon-dropped-in-workzone', this.boundHandlePolygonDropped);

        this.resizeObserver = new ResizeObserver(() => {
             this.updateRulers();
        });
        this.resizeObserver.observe(this);
    }

    disconnectedCallback() {
        this.workspace.removeEventListener('mousedown', this.boundStartViewDrag);
        this.workspace.removeEventListener('dragover', (e) => e.preventDefault());
        this.workspace.removeEventListener('drop', this.boundHandleDrop);
        this.workspace.removeEventListener('wheel', this.boundHandleWheel);

        this._stopViewDrag();

        document.removeEventListener('polygon-dropped-in-workzone', this.boundHandlePolygonDropped);

        this.resizeObserver.disconnect();

        Array.from(this.svgContainer.children).forEach(polygon => {
             if (polygon._dragListeners) {
                polygon.removeEventListener('mousedown', polygon._dragListeners.start);
                document.removeEventListener('mousemove', polygon._dragMoveHandler);
                document.removeEventListener('mouseup', polygon._dragStopHandler);
                document.removeEventListener('mouseleave', polygon._dragStopHandler);
                delete polygon._dragListeners;
                delete polygon._dragMoveHandler;
                delete polygon._dragStopHandler;
            }
        });
    }

    setupWorkspaceListeners() {
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation(); 

        const dataString = e.dataTransfer.getData('application/json'); 

        let data;
        try {
            data = JSON.parse(dataString);
            if (!data || data.vertices === undefined || data.hue === undefined || data.origin !== 'buffer-zone') {
                 console.warn('Дата не валидна', data);
                 return;
            }
        } catch (error) {
            console.warn('Ошибка парсинга JSON', error);
            return;
        }

        const newPolygon = document.createElement('svg-polygon');
        newPolygon.setAttribute('vertices', data.vertices);
        newPolygon.setAttribute('data-hue', data.hue);
        newPolygon.setAttribute('data-origin', data.origin || 'unknown'); 
        newPolygon.setAttribute('draggable', 'true'); 

        const uniqueId = `workspace-poly-${this.polygonIdCounter++}-${Date.now()}`;
        newPolygon.setAttribute('id', uniqueId);

        const rect = this.workspace.getBoundingClientRect();
        const dropXViewport = e.clientX;
        const dropYViewport = e.clientY;

        const dropXInContainer = dropXViewport - rect.left;
        const dropYInContainer = dropYViewport - rect.top;

        const worldX = (dropXInContainer - this.offsetX) / this.scale;
        const worldY = (dropYInContainer - this.offsetY) / this.scale;

        newPolygon.style.position = 'absolute'; 
        newPolygon.style.left = `${worldX}px`;
        newPolygon.style.top = `${worldY}px`;

        newPolygon.dataset.rawX = worldX;
        newPolygon.dataset.rawY = worldY;

        this.svgContainer.appendChild(newPolygon);

        this.setupPolygonDragListeners(newPolygon);


        if (data.origin === 'buffer-zone') {
             document.dispatchEvent(new CustomEvent('polygon-dropped-in-workzone', {
                bubbles: true,
                composed: true,
                detail: { id: data.id, origin: data.origin } 
            }));
        }
    }

    // Обработчик события wheel для масштабирования
    handleWheel(e) {
        e.preventDefault(); 

        const rect = this.workspace.getBoundingClientRect();
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - this.offsetX) / this.scale;
        const worldY = (mouseY - this.offsetY) / this.scale;

        const zoomIntensity = 0.1;
        const delta = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);

        this.scale = Math.min(Math.max(0.1, this.scale * delta), 10); 

        this.offsetX = mouseX - worldX * this.scale;
        this.offsetY = mouseY - worldY * this.scale;

        this.applyTransform();
        this.updateRulers();
    }


    // Приватный метод для начала перетаскивания рабочей области (панорамирования)
    _startViewDrag(e) {
        if (e.button === 0 && !e.target.closest('svg-polygon, .ruler, .ruler-corner')) {
            this.isViewDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            
            this.workspace.style.cursor = 'grabbing';
            
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', this.boundMoveView);
            document.addEventListener('mouseup', this.boundStopViewDrag);
            document.addEventListener('mouseleave', this.boundStopViewDrag); 
        }
    }

    // Приватный метод для перемещения рабочей области во время перетаскивания
    _moveView(e) {
        if (!this.isViewDragging) return;

        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;

        this.offsetX += dx;
        this.offsetY += dy;

        this.lastX = e.clientX;
        this.lastY = e.clientY;

        this.applyTransform();
        this.updateRulers();
    }

    // Приватный метод для остановки перетаскивания рабочей области
    _stopViewDrag() {
        if (!this.isViewDragging) return;

        this.isViewDragging = false;
        this.workspace.style.cursor = 'default';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', this.boundMoveView);
        document.removeEventListener('mouseup', this.boundStopViewDrag);
        document.removeEventListener('mouseleave', this.boundStopViewDrag);
    }

    // Настройка слушателей перетаскивания для отдельного полигона внутри WorkspaceZone
    setupPolygonDragListeners(polygon) {
        let isDragging = false;
        let startX, startY; 
        let startLeft, startTop;
        const boundStartDrag = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button !== 0) return; 

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseFloat(polygon.style.left) || 0;
            startTop = parseFloat(polygon.style.top) || 0;

            polygon.style.zIndex = '100';
            polygon.style.cursor = 'grabbing'; 
            document.body.style.userSelect = 'none';

            polygon._dragMoveHandler = boundMovePolygon;
            polygon._dragStopHandler = boundStopDrag;

            document.addEventListener('mousemove', polygon._dragMoveHandler);
            document.addEventListener('mouseup', polygon._dragStopHandler);
            document.addEventListener('mouseleave', polygon._dragStopHandler); 
        };

        const boundMovePolygon = (e) => {
            if (!isDragging) return; 

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const worldDeltaX = deltaX / this.scale;
            const worldDeltaY = deltaY / this.scale;

            const newLeft = startLeft + worldDeltaX;
            const newTop = startTop + worldDeltaY;

            polygon.style.left = `${newLeft}px`;
            polygon.style.top = `${newTop}px`;

            polygon.dataset.rawX = newLeft;
            polygon.dataset.rawY = newTop;
        };

        const boundStopDrag = () => {
            if (!isDragging) return;

            isDragging = false;
            polygon.style.zIndex = '';
            polygon.style.cursor = 'grab';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', polygon._dragMoveHandler);
            document.removeEventListener('mouseup', polygon._dragStopHandler);
            document.removeEventListener('mouseleave', polygon._dragStopHandler);

            delete polygon._dragMoveHandler;
            delete polygon._dragStopHandler;
        };

        polygon.addEventListener('mousedown', boundStartDrag);

        polygon._dragListeners = {
            start: boundStartDrag,
        };
    }

    // Применяет текущие трансформации (смещение и масштаб) к контейнеру полигонов
    applyTransform() {
        this.svgContainer.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
    }

    // Обновляет отрисовку линеек
    updateRulers() {
        this.rulerX.innerHTML = '';
        this.rulerY.innerHTML = '';
        const rulerSize = parseFloat(getComputedStyle(this).getPropertyValue('--ruler-size'));
        
        const workspaceInnerWidth = this.workspace.clientWidth - rulerSize;
        const workspaceInnerHeight = this.workspace.clientHeight - rulerSize;

        const majorStep = this.calculateMajorStep();
        const minorStep = majorStep / 5;
        const worldX_min = (-this.offsetX) / this.scale;
        const worldX_max = (workspaceInnerWidth - this.offsetX) / this.scale;

        let startWorldX = Math.floor(worldX_min / minorStep) * minorStep;

        for (let worldX_label = startWorldX; worldX_label <= worldX_max + minorStep; worldX_label += minorStep) {
            const screenX_ruler = worldX_label * this.scale + this.offsetX;

             if (screenX_ruler < 0 || screenX_ruler > workspaceInnerWidth) continue;

            const isMajorTick = Math.abs(worldX_label % majorStep) < (minorStep / 2);

            if (isMajorTick) {
                const tick = document.createElement('div');
                tick.className = 'ruler-tick ruler-tick-x major';
                tick.style.left = `${screenX_ruler}px`; 
                tick.style.height = '10px'; 

                const label = document.createElement('div');
                label.className = 'ruler-label ruler-label-x';
                label.textContent = Math.round(worldX_label); 
                label.style.left = `${screenX_ruler}px`; 
                this.rulerX.appendChild(label); 
                this.rulerX.appendChild(tick); 

            } else {
                 // Второстепенная отметка
                 const tick = document.createElement('div');
                 tick.className = 'ruler-tick ruler-tick-x';
                 tick.style.left = `${screenX_ruler}px`; 
                 tick.style.height = '5px'; 
                 this.rulerX.appendChild(tick); 
            }
        }

        const worldY_min = (-this.offsetY) / this.scale;
        const worldY_max = (workspaceInnerHeight - this.offsetY) / this.scale;

         let startWorldY = Math.floor(worldY_min / minorStep) * minorStep;

        for (let worldY_label = startWorldY; worldY_label <= worldY_max + minorStep; worldY_label += minorStep) {
             const screenY_ruler = workspaceInnerHeight - (worldY_label * this.scale + this.offsetY);

            if (screenY_ruler < 0 || screenY_ruler > workspaceInnerHeight) continue;

             const isMajorTick = Math.abs(worldY_label % majorStep) < (minorStep / 2);


            if (isMajorTick) {
                const tick = document.createElement('div');
                tick.className = 'ruler-tick ruler-tick-y major';
                tick.style.top = `${screenY_ruler}px`; 
                tick.style.width = '10px'; 

                const label = document.createElement('div');
                label.className = 'ruler-label ruler-label-y';
                label.textContent = Math.round(worldY_label); 
                label.style.top = `${screenY_ruler}px`; 
                this.rulerY.appendChild(label); 
                this.rulerY.appendChild(tick); 
            } else {
                 const tick = document.createElement('div');
                 tick.className = 'ruler-tick ruler-tick-y';
                 tick.style.top = `${screenY_ruler}px`; 
                 tick.style.width = '5px'; 
                 this.rulerY.appendChild(tick); 
            }
        }
    }


    // Определяет шаг основных отметок на линейках в зависимости от масштаба
    calculateMajorStep() {
        const targetPixelsPerTick = 75;
        const worldUnitsPerTarget = targetPixelsPerTick / this.scale;
        if (worldUnitsPerTarget > 500) return Math.round(worldUnitsPerTarget / 500) * 500;
        if (worldUnitsPerTarget > 200) return Math.round(worldUnitsPerTarget / 200) * 200;
        if (worldUnitsPerTarget > 100) return Math.round(worldUnitsPerTarget / 100) * 100;
        if (worldUnitsPerTarget > 50) return Math.round(worldUnitsPerTarget / 50) * 50;
        if (worldUnitsPerTarget > 20) return Math.round(worldUnitsPerTarget / 20) * 20;
        if (worldUnitsPerTarget > 10) return Math.round(worldUnitsPerTarget / 10) * 10;
        if (worldUnitsPerTarget > 5) return Math.round(worldUnitsPerTarget / 5) * 5;
        if (worldUnitsPerTarget > 2) return Math.round(worldUnitsPerTarget / 2) * 2;
        if (worldUnitsPerTarget > 1) return Math.round(worldUnitsPerTarget); 
        if (worldUnitsPerTarget > 0.5) return 0.5;
        if (worldUnitsPerTarget > 0.2) return 0.2;
        return 0.1; 
    }

    // Метод для получения данных о полигонах в рабочей зоне для сохранения
    getPolygonsData() {
        const polygons = [];
        this.svgContainer.querySelectorAll('svg-polygon').forEach(polygon => {
            const x = parseFloat(polygon.dataset.rawX || polygon.style.left);
            const y = parseFloat(polygon.dataset.rawY || polygon.style.top);

            polygons.push({
                id: polygon.id,
                vertices: polygon.getAttribute('vertices'),
                origin: polygon.getAttribute('data-origin'),
                hue: polygon.getAttribute('data-hue'),
                x: x,
                y: y,
            });
        });
        return polygons;
    }

    // Метод для загрузки полигонов в рабочую зону из данных сохранения
    loadPolygons(polygonsData) {
        if (!polygonsData) return;

        this.clear(); 
        this.polygonIdCounter = 0; 

        polygonsData.forEach(data => {
            const newPolygon = document.createElement('svg-polygon');
            
            newPolygon.setAttribute('id', data.id); 
            newPolygon.setAttribute('vertices', data.vertices);
            newPolygon.setAttribute('data-hue', data.hue);
            newPolygon.setAttribute('data-origin', data.origin || 'unknown');
            newPolygon.setAttribute('draggable', 'true'); 

            newPolygon.style.position = 'absolute';
            newPolygon.style.left = `${data.x}px`;
            newPolygon.style.top = `${data.y}px`;

            newPolygon.dataset.rawX = data.x;
            newPolygon.dataset.rawY = data.y;
            const idNum = parseInt(data.id.split('-')[2]);
            if (!isNaN(idNum) && idNum >= this.polygonIdCounter) {
                this.polygonIdCounter = idNum + 1;
            }

            this.svgContainer.appendChild(newPolygon);

            this.setupPolygonDragListeners(newPolygon);
        });
    }

    // Метод для получения текущего состояния трансформации (масштаб, смещение)
    getTransform() {
        return {
            scale: this.scale,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }

    // Метод для установки состояния трансформации
    setTransform(transformState) {
        if (!transformState) return;
        this.scale = transformState.scale !== undefined ? transformState.scale : 1;
        this.offsetX = transformState.offsetX !== undefined ? transformState.offsetX : 0;
        this.offsetY = transformState.offsetY !== undefined ? transformState.offsetY : 0;
        this.applyTransform();
        this.updateRulers();
    }

    // Метод для сброса трансформации к исходному состоянию
    resetTransform() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.applyTransform();
        this.updateRulers();
    }

    // Метод для очистки рабочей зоны от полигонов
    clear() {
        Array.from(this.svgContainer.children).forEach(polygon => {
             if (polygon._dragListeners) {
                polygon.removeEventListener('mousedown', polygon._dragListeners.start);
                document.removeEventListener('mousemove', polygon._dragMoveHandler);
                document.removeEventListener('mouseup', polygon._dragStopHandler);
                document.removeEventListener('mouseleave', polygon._dragStopHandler);
                delete polygon._dragListeners;
                delete polygon._dragMoveHandler;
                delete polygon._dragStopHandler;
            }
        });

        this.svgContainer.innerHTML = ''; 
        this.polygonIdCounter = 0; ;
    }

    
}

// Регистрируем Custom Element
customElements.define('workspace-zone', WorkspaceZone);

// Экспортируем класс для использования в других модулях
export default WorkspaceZone;
