/**
 * Admin · Tipos de receta: CRUD.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-admin-tipos]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const body = root.querySelector('[data-tipos-body]');
    const status = root.querySelector('[data-tipos-status]');
    const mensaje = root.querySelector('[data-tipos-mensaje]');
    const modalElement = document.querySelector('[data-tipo-modal]');
    const form = modalElement?.querySelector('[data-tipo-form]');
    const modalTitle = modalElement?.querySelector('[data-tipo-modal-title]');
    const idInput = modalElement?.querySelector('[data-tipo-id]');
    const nombreInput = modalElement?.querySelector('[data-tipo-nombre]');
    const iconoInput = modalElement?.querySelector('[data-tipo-icono]');
    const descripcionInput = modalElement?.querySelector('[data-tipo-descripcion]');
    const avisoInput = modalElement?.querySelector('[data-tipo-aviso]');
    const formMessage = modalElement?.querySelector('[data-tipo-mensaje]');
    const guardar = modalElement?.querySelector('[data-tipo-guardar]');

    if (!(body instanceof HTMLElement) || !(modalElement instanceof HTMLElement) || !(form instanceof HTMLFormElement)) {
        return;
    }

    const bootstrap = window.bootstrap;
    const modal = bootstrap?.Modal ? bootstrap.Modal.getOrCreateInstance(modalElement) : null;

    /** @type {Array<any>} */
    let tipos = [];

    root.querySelector('[data-tipo-nuevo]')?.addEventListener('click', () => abrirModal(null));

    form.addEventListener('submit', guardarTipo);

    load();

    async function load() {
        if (status instanceof HTMLElement) {
            status.textContent = 'Cargando tipos…';
        }

        try {
            const data = await fetchApi('/api/admin/tipos-recetas');
            tipos = Array.isArray(data?.items) ? data.items : [];
            render();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (status instanceof HTMLElement) {
                status.textContent = 'No se pudieron cargar los tipos.';
            }

            showToast(error?.message ?? 'No se pudieron cargar los tipos.', 'error');
        }
    }

    function render() {
        body.replaceChildren();

        if (tipos.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'text-center text-muted py-4';
            cell.textContent = 'No hay tipos registrados.';
            row.append(cell);
            body.append(row);
        } else {
            for (const tipo of tipos) {
                body.append(crearFila(tipo));
            }
        }

        if (status instanceof HTMLElement) {
            status.textContent = `${tipos.length} ${tipos.length === 1 ? 'tipo registrado' : 'tipos registrados'}`;
        }
    }

    /**
     * @param {any} tipo
     * @returns {HTMLTableRowElement}
     */
    function crearFila(tipo) {
        const row = document.createElement('tr');

        const nombre = document.createElement('td');
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center gap-2';
        const icon = document.createElement('span');
        icon.className = 'receta-form__tipo-icon';
        icon.innerHTML = `<i class="bi ${escapeIcono(tipo.icono)}" aria-hidden="true"></i>`;
        const texto = document.createElement('strong');
        texto.textContent = String(tipo.nombre ?? '');
        wrapper.append(icon, texto);
        nombre.append(wrapper);

        const slug = document.createElement('td');
        slug.className = 'text-muted small';
        slug.textContent = String(tipo.slug ?? '');

        const descripcion = document.createElement('td');
        descripcion.className = 'text-muted small';
        descripcion.textContent = String(tipo.descripcion ?? '');

        const aviso = document.createElement('td');
        aviso.className = 'text-muted small';
        aviso.textContent = String(tipo.aviso ?? '') === '' ? 'Sin aviso' : String(tipo.aviso);

        const acciones = document.createElement('td');
        acciones.className = 'text-end';
        const grupo = document.createElement('div');
        grupo.className = 'admin-actions d-flex flex-wrap justify-content-end gap-2';

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn btn-sm btn-outline-primary';
        editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i> Editar';
        editar.addEventListener('click', () => abrirModal(tipo));

        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'btn btn-sm btn-outline-danger';
        eliminar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Eliminar';
        eliminar.addEventListener('click', () => eliminarTipo(tipo));

        grupo.append(editar, eliminar);
        acciones.append(grupo);
        row.append(nombre, slug, descripcion, aviso, acciones);

        return row;
    }

    /**
     * @param {any|null} tipo
     */
    function abrirModal(tipo) {
        if (!(idInput instanceof HTMLInputElement)
            || !(nombreInput instanceof HTMLInputElement)
            || !(iconoInput instanceof HTMLInputElement)
            || !(descripcionInput instanceof HTMLInputElement)
            || !(avisoInput instanceof HTMLTextAreaElement)) {
            return;
        }

        idInput.value = tipo ? String(tipo.id) : '';
        nombreInput.value = tipo ? String(tipo.nombre ?? '') : '';
        iconoInput.value = tipo ? String(tipo.icono ?? 'bi-tag') : 'bi-tag';
        descripcionInput.value = tipo ? String(tipo.descripcion ?? '') : '';
        avisoInput.value = tipo ? String(tipo.aviso ?? '') : '';

        if (modalTitle instanceof HTMLElement) {
            modalTitle.textContent = tipo ? 'Editar tipo' : 'Nuevo tipo';
        }

        ocultarMensajeModal();
        modal?.show();
    }

    async function guardarTipo(event) {
        event.preventDefault();

        if (!(guardar instanceof HTMLButtonElement)
            || !(idInput instanceof HTMLInputElement)
            || !(nombreInput instanceof HTMLInputElement)
            || !(iconoInput instanceof HTMLInputElement)
            || !(descripcionInput instanceof HTMLInputElement)
            || !(avisoInput instanceof HTMLTextAreaElement)) {
            return;
        }

        const id = Number(idInput.value || 0);
        const payload = {
            nombre: nombreInput.value.trim(),
            icono: iconoInput.value.trim() || 'bi-tag',
            descripcion: descripcionInput.value.trim(),
            aviso: avisoInput.value.trim(),
        };

        guardar.disabled = true;
        const texto = guardar.textContent;
        guardar.textContent = 'Guardando…';
        ocultarMensajeModal();

        try {
            await fetchApi(id > 0 ? `/api/admin/tipos-recetas/${id}` : '/api/admin/tipos-recetas', {
                method: id > 0 ? 'PUT' : 'POST',
                body: payload,
            });

            modal?.hide();
            await load();
            showToast('Tipo guardado.', 'success');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            mostrarMensajeModal(error?.message ?? 'No se pudo guardar el tipo.');
        } finally {
            guardar.disabled = false;
            guardar.textContent = texto;
        }
    }

    async function eliminarTipo(tipo) {
        if (!window.confirm(`¿Eliminar el tipo "${tipo.nombre}"?`)) {
            return;
        }

        try {
            await fetchApi(`/api/admin/tipos-recetas/${Number(tipo.id)}`, { method: 'DELETE' });
            await load();
            showToast('Tipo eliminado.', 'info');
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (mensaje instanceof HTMLElement) {
                mensaje.textContent = error?.message ?? 'No se pudo eliminar el tipo.';
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
