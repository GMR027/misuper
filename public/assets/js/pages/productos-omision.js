/**
 * Productos por omisión: alta, listado y baja de los ingredientes que no se
 * cuentan al comparar recetas con las compras.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-productos-omision]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const form = root.querySelector('[data-omision-form]');
    const input = root.querySelector('[data-omision-input]');
    const submit = root.querySelector('[data-omision-submit]');
    const error = root.querySelector('[data-omision-error]');
    const list = root.querySelector('[data-omision-lista]');
    const empty = root.querySelector('[data-omision-vacio]');
    const count = root.querySelector('[data-omision-count]');

    if (
        !(form instanceof HTMLFormElement)
        || !(input instanceof HTMLInputElement)
        || !(submit instanceof HTMLButtonElement)
        || !(error instanceof HTMLElement)
        || !(list instanceof HTMLElement)
        || !(empty instanceof HTMLElement)
        || !(count instanceof HTMLElement)
    ) {
        return;
    }

    /** @type {Array<{id: number, nombre: string}>} */
    let items = [];
    let guardando = false;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        guardar();
    });

    root.querySelectorAll('[data-omision-sugerencia]').forEach((button) => {
        button.addEventListener('click', () => {
            if (!(button instanceof HTMLElement)) {
                return;
            }

            input.value = button.dataset.omisionSugerencia ?? '';
            input.focus();
        });
    });

    list.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const button = target.closest('[data-omision-eliminar]');

        if (!(button instanceof HTMLElement)) {
            return;
        }

        const id = Number(button.dataset.omisionEliminar);

        if (Number.isInteger(id) && id > 0) {
            eliminar(id, button);
        }
    });

    cargar();

    async function cargar() {
        empty.hidden = false;
        empty.textContent = 'Cargando productos…';

        try {
            const data = await fetchApi('/api/productos-omision');
            items = Array.isArray(data?.items) ? data.items : [];
            render();
        } catch (caught) {
            if (redirectIfSessionLost(caught)) {
                return;
            }

            empty.textContent = 'No se pudo cargar la lista.';
            showToast(mensajeError(caught), 'error');
        }
    }

    async function guardar() {
        if (guardando) {
            return;
        }

        const nombre = input.value.trim();

        if (nombre === '') {
            mostrarError('Escribe un producto.');
            input.focus();

            return;
        }

        guardando = true;
        submit.disabled = true;
        ocultarError();

        try {
            const item = await fetchApi('/api/productos-omision', {
                method: 'POST',
                body: { nombre },
            });

            if (item && typeof item === 'object') {
                items = [...items, item].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
            }

            input.value = '';
            render();
            showToast('Producto agregado.', 'success');
            input.focus();
        } catch (caught) {
            if (redirectIfSessionLost(caught)) {
                return;
            }

            mostrarError(mensajeError(caught));
        } finally {
            guardando = false;
            submit.disabled = false;
        }
    }

    /**
     * @param {number} id
     * @param {HTMLElement} button
     */
    async function eliminar(id, button) {
        button.disabled = true;

        try {
            await fetchApi(`/api/productos-omision/${id}`, { method: 'DELETE' });
            items = items.filter((item) => item.id !== id);
            render();
            showToast('Producto eliminado.', 'success');
        } catch (caught) {
            if (redirectIfSessionLost(caught)) {
                return;
            }

            button.disabled = false;
            showToast(mensajeError(caught), 'error');
        }
    }

    function render() {
        count.textContent = String(items.length);
        list.replaceChildren();
        list.hidden = items.length === 0;
        empty.hidden = items.length > 0;

        if (items.length === 0) {
            empty.textContent = 'No has agregado productos todavía.';
        }

        items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex align-items-center justify-content-between gap-3 px-0';

            const nombre = document.createElement('span');
            nombre.textContent = item.nombre;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-sm btn-outline-danger';
            button.dataset.omisionEliminar = String(item.id);
            button.setAttribute('aria-label', `Eliminar ${item.nombre}`);

            const icon = document.createElement('i');
            icon.className = 'bi bi-trash';
            icon.setAttribute('aria-hidden', 'true');

            button.append(icon);
            li.append(nombre, button);
            list.append(li);
        });
    }

    /** @param {string} texto */
    function mostrarError(texto) {
        error.textContent = texto;
        error.hidden = false;
    }

    function ocultarError() {
        error.textContent = '';
        error.hidden = true;
    }

    /** @param {any} caught */
    function mensajeError(caught) {
        return caught instanceof Error ? caught.message : 'Ocurrió un error inesperado.';
    }
}

/**
 * @param {any} error
 * @returns {boolean}
 */
function redirectIfSessionLost(error) {
    if (error?.status === 401) {
        window.location.href = '/login';

        return true;
    }

    return false;
}
