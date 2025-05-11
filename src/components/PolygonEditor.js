
import BufferZone from './BufferZone.js';
import WorkspaceZone from './WorkspaceZone.js';

class PolygonEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    padding: 20px;
                }
                .container {
                    max-width: 1200px; 
                    margin: 20px auto;
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                .controls {
                    margin-bottom: 20px;
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap; 
                }
                button {
                    padding: 8px 16px;
                    background-color: #4CAF50; 
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s ease;
                }
                button:hover {
                    background-color: #45a049;
                }
                button:active {
                    background-color: #3e8e41;
                }
                #reset-btn {
                    background-color: #f44336; 
                }
                #reset-btn:hover {
                    background-color: #d32f2f;
                }
                #reset-btn:active {
                    background-color: #b71c1c;
                }
                 h3 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    color: #555;
                 }
                 
                 .save-notification {
                     position: fixed; 
                     bottom: 20px; 
                     right: 20px; 
                     background-color: #4CAF50; 
                     color: white; 
                     padding: 10px 20px;
                     border-radius: 4px;
                     opacity: 0; 
                     transition: opacity 0.5s ease-in-out; 
                     z-index: 1000; 
                 }
                 .save-notification.show {
                     opacity: 1; 
                 }
            </style>
            <div class="container">
                <div class="controls">
                    <button id="create-btn">Создать случайные полигоны</button>
                    <button id="save-btn">Сохранить состояние</button>
                    <button id="reset-btn">Сбросить состояние</button>
                </div>
                <buffer-zone></buffer-zone>
                <workspace-zone></workspace-zone>
            </div>
            <div id="save-notification" class="save-notification">Состояние сохранено!</div>
        `;

        this.bufferZone = this.shadowRoot.querySelector('buffer-zone');
        this.workspace = this.shadowRoot.querySelector('workspace-zone');
        this.saveNotification = this.shadowRoot.getElementById('save-notification');

    
        this.shadowRoot.getElementById('create-btn').addEventListener('click', () => {
            const count = Math.floor(Math.random() * 16) + 5; 
            this.bufferZone.generatePolygons(count); 
        });

        this.shadowRoot.getElementById('save-btn').addEventListener('click', () => {
            this.saveState(); 
        });

        this.shadowRoot.getElementById('reset-btn').addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите сбросить состояние редактора? Весь прогресс будет потерян.')) {
                this.resetState();
            }
        });

        this.loadState();
    }

    // Метод для сохранения текущего состояния редактора в localStorage
    saveState() {
        const bufferPolygons = this.bufferZone.getPolygonsData();
        const workspacePolygons = this.workspace.getPolygonsData();
        const workspaceTransform = this.workspace.getTransform();

        localStorage.setItem('polygonEditorState', JSON.stringify({
            buffer: bufferPolygons,
            workspace: workspacePolygons,
            workspaceTransform: workspaceTransform 
        }));
        
        this.showSaveNotification(); 
    }

    // Метод для загрузки состояния редактора из localStorage
    loadState() {
        const savedState = localStorage.getItem('polygonEditorState');
        if (savedState) {
            try {
                const { buffer, workspace, workspaceTransform } = JSON.parse(savedState);
                this.bufferZone.loadPolygons(buffer);
                this.workspace.loadPolygons(workspace);
                this.workspace.setTransform(workspaceTransform);
                
            } catch (error) {
                console.error(error);
                localStorage.removeItem('polygonEditorState');
                
            }
        } else {
             
        }
    }

    // Метод для сброса состояния редактора
    resetState() {
        localStorage.removeItem('polygonEditorState');
        this.bufferZone.clear(); 
        this.workspace.clear();
        this.workspace.resetTransform();
        
    }

    // Метод для показа визуального уведомления о сохранении
    showSaveNotification() {
        this.saveNotification.classList.add('show');
        setTimeout(() => {
            this.saveNotification.classList.remove('show');
        }, 3000);
    }
}

customElements.define('polygon-editor', PolygonEditor);

export default PolygonEditor;
