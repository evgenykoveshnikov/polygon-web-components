import SvgPolygon from './SvgPolygon.js';

// Определение шаблона для компонента BufferZone
const bufferTemplate = document.createElement('template');
bufferTemplate.innerHTML = `
    <style>
        :host {
            display: block;
            width: 100%; 
            height: 300px;
            background-color: #f0f8ff; 
            border-bottom: 1px solid #ddd;
            overflow-x: auto; 
            overflow-y: hidden; 
            box-sizing: border-box;
            padding: 10px;
            position: relative;
            user-select: none; 
        }
        .polygon-container {
            display: flex; 
            flex-wrap: nowrap; 
            gap: 10px;
            height: 100%; 
            align-items: center; 
        }
        
        svg-polygon {
            flex-shrink: 0; 
            cursor: grab;
            border: 1px dashed transparent; 
            box-sizing: border-box;
            transition: border-color 0.2s ease;
        }
        svg-polygon:hover {
            border-color: #007bff;
        }
    </style>
    <h3>Buffer Zone</h3>
    <div class="polygon-container">
        </div>
`;

class BufferZone extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(bufferTemplate.content.cloneNode(true));
        this.polygonContainer = this.shadowRoot.querySelector('.polygon-container');
        this.polygonIdCounter = 0; 
    }

    connectedCallback() {
        this.polygonContainer.addEventListener('dragstart', (event) => {
            const polygonElement = event.target.closest('svg-polygon');
            if (polygonElement) {
                const polygonData = {
                    id: polygonElement.id || `buffer-poly-${Date.now()}`,
                    vertices: polygonElement.getAttribute('vertices'),
                    hue: polygonElement.getAttribute('data-hue'),
                    origin: 'buffer-zone',
                };
                event.dataTransfer.setData('application/json', JSON.stringify(polygonData));
                event.dataTransfer.effectAllowed = 'move'; 
                
            } else {
                event.preventDefault();
            }
        });

        this.boundHandlePolygonDropped = this.handlePolygonDroppedFromWorkzone.bind(this);
        document.addEventListener('polygon-dropped-in-workzone', this.boundHandlePolygonDropped);
    }

    disconnectedCallback() {
         document.removeEventListener('polygon-dropped-in-workzone', this.boundHandlePolygonDropped);
    }

    // Обработчик события, когда полигон успешно перемещен в workzone
    handlePolygonDroppedFromWorkzone(event) {
        if (event.detail && event.detail.origin === 'buffer-zone') {
            const idToRemove = event.detail.id;
            const polygonToRemove = this.shadowRoot.getElementById(idToRemove);
             if (polygonToRemove) {
                polygonToRemove.remove();
            }
        }
    }

    // Метод для генерации случайного полигона
    generateRandomPolygon() {
        const polygonVertices = Math.floor(Math.random() * (8 - 3 + 1)) + 3;
        const uniqueId = `buffer-poly-${this.polygonIdCounter++}-${Date.now()}`; 
        const hue = Math.floor(Math.random() * 360); 

        const polygonElement = document.createElement('svg-polygon');
        polygonElement.setAttribute('id', uniqueId);
        polygonElement.setAttribute('vertices', polygonVertices);
        polygonElement.setAttribute('data-hue', hue);
        polygonElement.setAttribute('draggable', 'true');

        return polygonElement;
    }

    // Метод для генерации заданного количества полигонов
    generatePolygons(count) {
        this.clear();
        this.polygonIdCounter = 0; 

        for (let i = 0; i < count; i++) {
            const polygonElement = this.generateRandomPolygon();
            this.polygonContainer.appendChild(polygonElement);
        }
    }

    // Метод для загрузки полигонов из данных сохранения
    loadPolygons(polygonsData) {
        this.clear(); 
        this.polygonIdCounter = 0; 

        if (!polygonsData) return;

        polygonsData.forEach(data => {
            const polygonElement = document.createElement('svg-polygon');
            polygonElement.setAttribute('id', data.id);
            polygonElement.setAttribute('vertices', data.vertices);
            polygonElement.setAttribute('data-hue', data.hue);
             
             polygonElement.setAttribute('draggable', 'true');


             
             const idNum = parseInt(data.id.split('-')[2]); 
             if (!isNaN(idNum) && idNum >= this.polygonIdCounter) {
                 this.polygonIdCounter = idNum + 1;
             }

            this.polygonContainer.appendChild(polygonElement);
        });
         console.log(`BufferZone loaded ${polygonsData.length} polygons.`);
    }

    // Метод для получения данных о полигонах для сохранения
    getPolygonsData() {
        const polygons = [];
        this.shadowRoot.querySelectorAll('svg-polygon').forEach(polygonElement => {
            polygons.push({
                id: polygonElement.id,
                vertices: polygonElement.getAttribute('vertices'),
                hue: polygonElement.getAttribute('data-hue'),
            });
        });
        return polygons;
    }

    // Метод для очистки буферной зоны 
    clear() {
        this.shadowRoot.querySelectorAll('svg-polygon').forEach(polygonElement => {
            polygonElement.removeAttribute('draggable');
        });

        this.polygonContainer.innerHTML = '';
        this.polygonIdCounter = 0; 
        
    }
}

customElements.define('buffer-zone', BufferZone);

export default BufferZone;
