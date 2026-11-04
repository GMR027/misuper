/**
 * Admin · Categorías de recetas: CRUD.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-admin-categorias]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const body = root.querySelector('[data-categorias-body]');
    const status = root.querySelector('[data-categorias-status]');
    const mensaje = root.querySelector('[data-categorias-mensaje]');
    const modalElement = document.querySelector('[data-categoria-modal]');
    const form = modalElement?.querySelector('[data-categoria-form]');
    const modalTitle = modalElement?.querySelector('[data-categoria-modal-title]');
    const idInput = modalElement?.querySelector('[data-categoria-id]');
    const nombreInput = modalElement?.querySelector('[data-categoria-nombre]');
    const iconoInput = modalElement?.querySelector('[data-categoria-icono]');
    const descripcionInput = modalElement?.querySelector('[data-categoria-descripcion]');
    const ordenInput = modalElement?.querySelector('[data-categoria-orden]');
    const formMessage = modalElement?.querySelector('[data-categoria-mensaje]');
    const guardar = modalElement?.querySelector('[data-categoria-guardar]');

    if (!(body instanceof HTMLElement) || !(modalElement instanceof HTMLElement) || !(form instanceof HTMLFormElement)) {
        return;
    }

    const bootstrap = window.bootstrap;
    const modal = bootstrap?.Modal ? bootstrap.Modal.getOrCreateInstance(modalElement) : null;

    /** @type {Array<any>} */
    let categorias = [];

    root.querySelector('[data-categoria-nuevo]')?.addEventListener('click', () => abrirModal(null));

    form.addEventListener('submit', guardarCategoria);

    load();

    async function load() {
        if (status instanceof HTMLElement) {
            status.textContent = 'Cargando categorías…';
        }

        try {
            const data = await fetchApi('/api/admin/categorias-recetas');
            categorias = Array.isArray(data?.items) ? data.items : [];
            render();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (status instanceof HTMLElement) {
                status.textContent = 'No se pudieron cargar las categorías.';
            }

            showToast(error?.message ?? 'No se pudieron cargar las categorías.', 'error');
        }
    }

    function render() {
        body.replaceChildren();

        if (categorias.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'text-center text-muted py-4';
            cell.textContent = 'No hay categorías registradas.';
            row.append(cell);
            body.append(row);
        } else {
            for (const categoria of categorias) {
                body.append(crearFila(categoria));
            }
        }

        if (status instanceof HTMLElement) {
            status.textContent = `${categorias.length} ${categorias.length === 1 ? 'categoría registrada' : 'categorías registradas'}`;
        }
    }

    /**
     * @param {any} categoria
     * @returns {HTMLTableRowElement}
     */
    function crearFila(categoria) {
        const row = document.createElement('tr');

        const nombre = document.createElement('td');
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center gap-2';
        const icon = document.createElement('span');
        icon.className = 'receta-form__tipo-icon';
        icon.innerHTML = `<i class="bi ${escapeIcono(categoria.icono)}" aria-hidden="true"></i>`;
        const texto = document.createElement('strong');
        texto.textContent = String(categoria.nombre ?? '');
        wrapper.append(icon, texto);
        nombre.append(wrapper);

        const slug = document.createElement('td');
        slug.className = 'text-muted small';
        slug.textContent = String(categoria.slug ?? '');

        const descripcion = document.createElement('td');
        descripcion.className = 'text-muted small';
        descripcion.textContent = String(categoria.descripcion ?? '');

        const orden = document.createElement('td');
        orden.className = 'text-center text-muted small';
        orden.textContent = String(categoria.orden ?? 0);

        const acciones = document.createElement('td');
        acciones.className = 'text-end';
        const grupo = document.createElement('div');
        grupo.className = 'admin-actions d-flex flex-wrap justify-content-end gap-2';

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn btn-sm btn-outline-primary';
        editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> Editar';
        editar.addEventListener('click', () => abrirModal(categoria));

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Eliminar';
        eliminar.addEventListener('click', () => eliminarCategoria(categoria));

        grupo.append(editar, eliminar);
        acciones.append(grupo);
        row.append(nombre, slug, descripcion, orden, acciones);

        return row;
    }

    /**
     * @param {any|null} categoria
     */
    function abrirModal(categoria) {
        if (!(idInput instanceof HTMLInputElement)
            || !(nombreInput instanceof HTMLInputElement)
            || !(iconoInput instanceof HTMLInputElement)
            || !(descripcionInput instanceof HTMLInputElement)
            || !(ordenInput instanceof HTMLInputElement)) {
            return;
        }

        idInput.value = categoria ? String(categoria.id) : '';
        nombreInput.value = categoria ? String(categoria.nombre ?? '') : '';
        iconoInput.value = categoria ? String(categoria.icono ?? 'bi-tag') : 'bi-tag';
        descripcionInput.value = categoria ? String(categoria.descripcion ?? '') : '';
        ordenInput.value = categoria ? String(categoria.orden ?? 0) : String(categorias.length + 1);

        if (modalTitle instanceof HTMLElement) {
            modalTitle.textContent = categoria ? 'Editar categoría' : 'Nueva categoría';
        }

        ocultarMensajeModal();
        modal?.show();
    }

    async function guardarCategoria(event) {
        event.preventDefault();

        if (!(guardar instanceof HTMLButtonElement)
            || !(idInput instanceof HTMLInputElement)
            || !(nombreInput instanceof HTMLInputElement)
            || !(iconoInput instanceof HTMLInputElement)
            || !(descripcionInput instanceof HTMLInputElement)
            || !(ordenInput instanceof HTMLInputElement)) {
            return;
        }

        const id = Number(idInput.value || 0);
        const payload = {
            nombre: nombreInput.value.trim(),
            icono: iconoInput.value.trim() || 'bi-tag',
            descripcion: descripcionInput.value.trim(),
            orden: Number(ordenInput.value || 0),
        };

        guardar.disabled = true;
        const texto = guardar.textContent;
        guardar.textContent = 'Guardando…';
        ocultarMensajeModal();

        try {
            await fetchApi(id > 0 ? `/api/admin/categorias-recetas/${id}` : '/api/admin/categorias-recetas', {
                method: id > 0 ? 'PUT' : 'POST',
                body: payload,
            });

            modal?.hide();
            await load();
            showToast('Categoría guardada.', 'success');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            mostrarMensajeModal(error?.message ?? 'No se pudo guardar la categoría.');
        } finally {
            guardar.disabled = false;
            guardar.textContent = texto;
        }
    }

    async function eliminarCategoria(categoria) {
        if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) {
            return;
        }

        try {
            await fetchApi(`/api/admin/categorias-recetas/${Number(categoria.id)}`, { method: 'DELETE' });
            await load();
            showToast('Categoría eliminada.', 'info');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (mensaje instanceof HTMLElement) {
                mensaje.textContent = error?.message ?? 'No se pudo eliminar la categoría.';
                mensaje.hidden = false;
            }
        }
    }

    function mostrarMensajeModal(texto) {
        if (formMessage instanceof HTMLElement) {
            formMessage.textContent = texto;
            formMessage.hidden = false;
        }
    }

    function ocultarMensajeModal() {
        if (formMessage instanceof HTMLElement) {
            formMessage.textContent = '';
            formMessage.hidden = true;
        }
    }

    /**
     * @param {any} icono
     * @returns {string}
     */
    function escapeIcono(icono) {
        const value = String(icono ?? '');

        return /^bi-[a-z0-9-]+$/.test(value) ? value : 'bi-tag';
    }

    /**
     * @param {any} error
     * @returns {boolean}
     */
    function redirectIfSessionLost(error) {
        if (error?.status === 401) {
            window.location.replace('/login');

            return true;
        }

        return false;
    }
}
