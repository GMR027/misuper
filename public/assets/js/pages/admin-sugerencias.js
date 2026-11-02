/**
 * Panel Admin · Sugerencias.
 *
 * Lista agrupada por nombre normalizado y permite aprobar (crear producto)
 * o ignorar todas las sugerencias pendientes de un grupo.
 */

import { fetchApi } from '../modules/api.js';
import { showToast } from '../modules/toast.js';

const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

const body = document.querySelector('[data-sugerencias-body]');

if (body instanceof HTMLElement) {
    init(body);
}

/**
 * @param {HTMLElement} body
 */
function init(body) {
    const filtro = document.querySelector('[data-estado-filter]');
    const totalLabel = document.querySelector('[data-total]');
    const tableMessage = document.querySelector('[data-table-message]');

    const modal = document.querySelector('[data-modal-aprobar]');
    const form = document.querySelector('[data-form-aprobar]');
    const modalNombre = document.querySelector('[data-aprobar-nombre]');
    const idInput = document.querySelector('[data-sugerencia-id]');
    const categoriaSelect = document.querySelector('[data-aprobar-categoria]');
    const unidadSelect = document.querySelector('[data-aprobar-unidad]');
    const imagenInput = document.querySelector('[data-aprobar-imagen]');
    const modalMessage = document.querySelector('[data-aprobar-message]');
    const submit = form instanceof HTMLFormElement
        ? form.querySelector('button[type="submit"]')
        : null;

    let estadoActual = filtro instanceof HTMLSelectElement ? filtro.value : 'pendiente';

    bindLogout();

    filtro?.addEventListener('change', () => {
        if (filtro instanceof HTMLSelectElement) {
            estadoActual = filtro.value;
            cargar();
        }
    });

    document.querySelector('[data-close-aprobar]')?.addEventListener('click', cerrarModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarModal();
        }
    });

    body.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const aprobar = target.closest('[data-aprobar-id]');

        if (aprobar instanceof HTMLButtonElement) {
            abrirModal(
                Number(aprobar.dataset.aprobarId),
                aprobar.dataset.nombreOriginal ?? ''
            );

            return;
        }

        const ignorar = target.closest('[data-ignorar-id]');

        if (ignorar instanceof HTMLButtonElement) {
            ignorarSugerencia(
                Number(ignorar.dataset.ignorarId),
                ignorar.dataset.nombreOriginal ?? ''
            );
        }
    });

    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await aprobarSugerencia();
    });

    cargar();

    /* Carga y render ---------------------------------------------------- */

    async function cargar() {
        clearMessage(tableMessage);

        if (totalLabel instanceof HTMLElement) {
            totalLabel.hidden = true;
        }

        body.replaceChildren();
        body.append(filaMensaje('Cargando sugerencias…'));

        try {
            const data = await fetchApi(
                `/api/admin/sugerencias?estado=${encodeURIComponent(estadoActual)}`,
            );
            const items = Array.isArray(data?.items) ? data.items : [];

            body.replaceChildren();

            if (items.length === 0) {
                body.append(filaMensaje(mensajeVacio()));
            } else {
                const fragment = document.createDocumentFragment();

                for (const item of items) {
                    fragment.append(fila(item));
                }

                body.append(fragment);
            }

            if (totalLabel instanceof HTMLElement) {
                totalLabel.textContent = `${items.length} ${items.length === 1 ? 'grupo' : 'grupos'}`;
                totalLabel.hidden = false;
            }
        } catch (error) {
            body.replaceChildren();
            body.append(filaMensaje('No se pudieron cargar las sugerencias.'));

            if (!redirectIfSessionLost(error)) {
                showMessage(
                    tableMessage,
                    firstValidationMessage(error),
                );
            }
        }
    }

    function mensajeVacio() {
        if (estadoActual === 'pendiente') {
            return 'No hay sugerencias pendientes.';
        }

        return estadoActual === 'aprobada'
            ? 'No hay sugerencias aprobadas.'
            : 'No hay sugerencias ignoradas.';
    }

    /**
     * @param {string} texto
     * @returns {HTMLTableRowElement}
     */
    function filaMensaje(texto) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.className = 'text-center text-muted py-4';
        td.colSpan = 5;
        td.textContent = texto;
        tr.append(td);

        return tr;
    }

    /**
     * @param {any} item
     * @returns {HTMLTableRowElement}
     */
    function fila(item) {
        const tr = document.createElement('tr');
        tr.dataset.sugerenciaId = String(Number(item.ids?.[0] ?? 0));

        const nombreTd = document.createElement('td');
        nombreTd.className = 'fw-semibold';
        nombreTd.textContent = String(item.nombre_original ?? '');

        const normalizado = document.createElement('span');
        normalizado.className = 'sugerencias-normalizado d-block text-muted small fw-normal';
        normalizado.textContent = String(item.nombre_normalizado ?? '');
        nombreTd.append(normalizado);

        tr.append(nombreTd);

        const totalTd = document.createElement('td');
        const total = Number(item.total ?? 0);
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary rounded-pill';
        badge.textContent = String(total);
        badge.title = `${total} ${total === 1 ? 'sugerencia' : 'sugerencias'}`;
        totalTd.append(badge);
        tr.append(totalTd);

        tr.append(celdaFecha(item.primera_fecha));
        tr.append(celdaFecha(item.ultima_fecha));

        const acciones = document.createElement('td');
        acciones.className = 'text-end admin-actions';

        if (estadoActual === 'pendiente') {
            const aprobar = document.createElement('button');
            aprobar.type = 'button';
            aprobar.className = 'btn btn-sm btn-outline-success me-1';
            aprobar.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Aprobar';
            aprobar.dataset.aprobarId = String(Number(item.ids?.[0] ?? 0));
            aprobar.dataset.nombreOriginal = String(item.nombre_original ?? '');
            acciones.append(aprobar);

            const ignorar = document.createElement('button');
            ignorar.type = 'button';
            ignorar.className = 'btn btn-sm btn-outline-secondary';
            ignorar.innerHTML = '<i class="bi bi-x-circle" aria-hidden="true"></i> Ignorar';
            ignorar.dataset.ignorarId = String(Number(item.ids?.[0] ?? 0));
            ignorar.dataset.nombreOriginal = String(item.nombre_original ?? '');
            acciones.append(ignorar);
        } else {
            acciones.append(document.createTextNode('—'));
        }

        tr.append(acciones);

        return tr;
    }

    /**
     * @param {any} value
     * @returns {HTMLTableCellElement}
     */
    function celdaFecha(value) {
        const td = document.createElement('td');
        td.className = 'text-muted small';
        td.textContent = formatearFecha(value);

        return td;
    }

    /* Modal aprobar ----------------------------------------------------- */

    /**
     * @param {number} id
     * @param {string} nombre
     */
    function abrirModal(id, nombre) {
        if (id <= 0) {
            showMessage(tableMessage, 'No se pudo identificar la sugerencia.');

            return;
        }

        if (idInput instanceof HTMLInputElement) {
            idInput.value = String(id);
        }

        if (modalNombre instanceof HTMLElement) {
            modalNombre.textContent = nombre;
        }

        if (categoriaSelect instanceof HTMLSelectElement) {
            categoriaSelect.value = '';
            categoriaSelect.removeAttribute('aria-invalid');
        }

        if (unidadSelect instanceof HTMLSelectElement) {
            unidadSelect.value = 'pza';
            unidadSelect.removeAttribute('aria-invalid');
        }

        if (imagenInput instanceof HTMLInputElement) {
            imagenInput.value = '';
            imagenInput.removeAttribute('aria-invalid');
        }

        limpiarErrores();
        clearMessage(modalMessage);
        setBusy(submit, false, 'Aprobar y crear producto');

        if (modal instanceof HTMLElement) {
            modal.hidden = false;
        }

        categoriaSelect?.focus();
    }

    function cerrarModal() {
        if (modal instanceof HTMLElement) {
            modal.hidden = true;
        }
    }

    async function aprobarSugerencia() {
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        limpiarErrores();
        clearMessage(modalMessage);

        const id = idInput instanceof HTMLInputElement ? Number(idInput.value) : 0;
        const categoria = categoriaSelect instanceof HTMLSelectElement
            ? categoriaSelect.value
            : '';
        const unidad = unidadSelect instanceof HTMLSelectElement
            ? unidadSelect.value
            : '';
        const imagen = imagenInput instanceof HTMLInputElement
            ? imagenInput.value.trim()
            : '';

        let valido = true;

        if (id <= 0) {
            showMessage(modalMessage, 'No se pudo identificar la sugerencia.');

            return;
        }

        if (categoria === '' || !Number.isInteger(Number(categoria)) || Number(categoria) <= 0) {
            marcarError('categoria_id', 'Selecciona una categoría.');
            valido = false;
        }

        if (!UNIDADES.includes(unidad)) {
            marcarError('unidad_base', 'Selecciona una unidad válida.');
            valido = false;
        }

        if (imagen !== '' && !isValidImageUrl(imagen)) {
            marcarError('imagen_url', 'Escribe una URL http o https válida.');
            valido = false;
        }

        if (!valido) {
            showMessage(modalMessage, 'Revisa los campos marcados.');

            return;
        }

        setBusy(submit, true, 'Aprobar y crear producto', 'Aprobando…');

        try {
            const data = await fetchApi(
                `/api/admin/sugerencias/${encodeURIComponent(String(id))}/aprobar`,
                {
                    method: 'PUT',
                    body: {
                        categoria_id: Number(categoria),
                        unidad_base: unidad,
                        imagen_url: imagen === '' ? null : imagen,
                    },
                },
            );

            cerrarModal();
            showToast(`${String(data?.nombre ?? 'Producto')} agregado al catálogo.`, 'success');
            await cargar();
        } catch (error) {
            setBusy(submit, false, 'Aprobar y crear producto');

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (error?.data && typeof error.data === 'object') {
                for (const [campo, texto] of Object.entries(error.data)) {
                    if (campo === '_general') {
                        continue;
                    }

                    marcarError(campo, String(texto));
                }
            }

            showMessage(modalMessage, firstValidationMessage(error));
        }
    }

    /* Ignorar ----------------------------------------------------------- */

    /**
     * @param {number} id
     * @param {string} nombre
     */
    async function ignorarSugerencia(id, nombre) {
        if (id <= 0) {
            showMessage(tableMessage, 'No se pudo identificar la sugerencia.');

            return;
        }

        const confirmado = window.confirm(
            `¿Ignorar todas las sugerencias de "${nombre}"? No se creará ningún producto.`,
        );

        if (!confirmado) {
            return;
        }

        clearMessage(tableMessage);

        try {
            await fetchApi(
                `/api/admin/sugerencias/${encodeURIComponent(String(id))}/ignorar`,
                { method: 'PUT' },
            );

            showToast(`Sugerencias de "${nombre}" ignoradas.`, 'info');
            await cargar();
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showMessage(tableMessage, firstValidationMessage(error));
            }
        }
    }

    /* Utilidades -------------------------------------------------------- */

    /**
     * @param {string} campo
     * @param {string} texto
     */
    function marcarError(campo, texto) {
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        const slot = form.querySelector(`[data-error-for="${campo}"]`);

        if (slot instanceof HTMLElement) {
            slot.textContent = texto;
            slot.hidden = false;
        }

        const campoId = campo === 'categoria_id'
            ? 'aprobar-categoria'
            : campo === 'unidad_base'
                ? 'aprobar-unidad'
                : 'aprobar-imagen';

        form.querySelector(`#${campoId}`)?.setAttribute('aria-invalid', 'true');
    }

    function limpiarErrores() {
        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        for (const slot of form.querySelectorAll('[data-error-for]')) {
            if (slot instanceof HTMLElement) {
                slot.textContent = '';
                slot.hidden = true;
            }
        }

        for (const input of form.querySelectorAll('[aria-invalid]')) {
            input.removeAttribute('aria-invalid');
        }
    }

    /**
     * @param {Element | null} element
     * @param {string} text
     */
    function showMessage(element, text) {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        element.textContent = text;
        element.hidden = false;
    }

    /**
     * @param {Element | null} element
     */
    function clearMessage(element) {
        if (!(element instanceof HTMLElement)) {
            return;
        }

        element.textContent = '';
        element.hidden = true;
    }
}

/* Utilidades de módulo -------------------------------------------------- */

/**
 * @param {Element | null} button
 * @param {boolean} busy
 * @param {string} idleText
 * @param {string} [busyText]
 */
function setBusy(button, busy, idleText, busyText = 'Guardando…') {
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    button.disabled = busy;
    button.textContent = busy ? busyText : idleText;
}

/**
 * @param {any} error
 * @returns {string}
 */
function firstValidationMessage(error) {
    if (error?.data && typeof error.data === 'object') {
        return Object.values(error.data)[0] ?? error.message;
    }

    return error?.message ?? 'Ocurrió un error inesperado.';
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isValidImageUrl(value) {
    try {
        const url = new URL(value);

        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * @param {any} value
 * @returns {string}
 */
function formatearFecha(value) {
    if (typeof value !== 'string' || value.length < 10) {
        return '—';
    }

    const [fecha] = value.split(' ');
    const partes = fecha.split('-');

    if (partes.length !== 3) {
        return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * @param {any} error
 * @returns {boolean} true si ya se redirigió al login.
 */
function redirectIfSessionLost(error) {
    if (error?.status === 401) {
        window.location.replace('/login');

        return true;
    }

    if (error?.status === 403) {
        showToast('No tienes permisos para ver esta bandeja.', 'error');

        return false;
    }

    return false;
}

function bindLogout() {
    document.querySelector('[data-logout]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;

        if (button instanceof HTMLButtonElement) {
            button.disabled = true;
        }

        try {
            await fetchApi('/api/auth/logout', { method: 'POST' });
        } catch {
            // Si la sesión ya no existe, igualmente volvemos al login.
        }

        window.location.replace('/login');
    });
}
