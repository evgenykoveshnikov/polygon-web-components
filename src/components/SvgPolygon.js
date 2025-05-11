

class SvgPolygon extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._hue = Math.floor(Math.random() * 360);
    }

    static get observedAttributes() {
        return ['vertices', 'data-hue'];
    }

    // Вызывается при изменении наблюдаемых атрибутов
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return; 

        if (name === 'vertices') {
            this.renderPolygon();
        } else if (name === 'data-hue') {
            this._hue = parseInt(newValue) || this._hue;
            this.renderPolygon();
        }
    }

    connectedCallback() {
        if (!this.hasAttribute('data-hue')) {
             this.setAttribute('data-hue', this._hue);
        } else {
             this._hue = parseInt(this.getAttribute('data-hue')) || this._hue;
        }

        this.renderPolygon();
    }

    renderPolygon() {
        const vertices = parseInt(this.getAttribute('vertices')) || 3;
        const size = 50; 
        const center = size / 2;
        const points = [];
        const hue = this._hue;

        for (let i = 0; i < vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const radius = size / 2 * 0.9; 
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            points.push(`${x},${y}`);
        }

        const fill = `hsl(${hue}, 80%, 80%)`;
        const stroke = `hsl(${hue}, 80%, 50%)`;

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    width: ${size}px;
                    height: ${size}px;
                    user-select: none; 
                    /* pointer-events: none; 
                }
                svg {
                    width: 100%;
                    height: 100%;
                    display: block; 
                }
            </style>
            <svg viewBox="0 0 ${size} ${size}">
                <polygon
                    points="${points.join(' ')}"
                    fill="${fill}"
                    stroke="${stroke}"
                    stroke-width="2" 
                ></polygon>
            </svg>
        `;
    }

    getSvgString() {
        const svgElement = this.shadowRoot.querySelector('svg');
        return svgElement ? svgElement.outerHTML : '';
    }
}

customElements.define('svg-polygon', SvgPolygon);

export default SvgPolygon;
