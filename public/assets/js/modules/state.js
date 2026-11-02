/**
 * Estado ligero de la pantalla + render controlado.
 *
 * Los módulos de la página registran renderizadores por zona. Cada cambio
 * de estado ejecuta solo esos renderizadores; los inputs críticos no se
 * reconstruyen porque viven en el HTML estático de la vista.
 */

export const state = {
    items: [],
    categoria_activa: null,
    busqueda: '',
    carrito_abierto: true,
};

const renderers = new Set();

/**
 * Registra una función de render. Devuelve una función para desregistrarla.
 *
 * @param {(state: typeof state) => void} renderer
 * @returns {() => void}
 */
export function registerRenderer(renderer) {
    renderers.add(renderer);

    return () => {
        renderers.delete(renderer);
    };
}

/**
 * Actualiza el estado y vuelve a pintar las zonas registradas.
 *
 * @param {Partial<typeof state>} patch
 */
export function setState(patch) {
    Object.assign(state, patch);
    render();
}

export function render() {
    for (const renderer of renderers) {
        renderer(state);
    }
}
