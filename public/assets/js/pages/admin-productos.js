/**
 * Panel Admin · Productos.
 *
 * Un solo módulo para las dos pantallas:
 * - Lista (/admin/productos): carga paginada contra /api/admin/productos.
 * - Formulario (/admin/productos/nuevo y /{id}): alta y edición con la API.
 */

import { fetchApi } from '../modules/api.js';

const PER_PAGE = 20;
const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

/* Utilidades compartidas ------------------------------------------------ */

/**
 * @param {Element | null} element
 * @param {string} text
 * @param {'error' | 'success'} [type]
 */
function showMessage(element, text, type = 'error') {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.textContent = text;
    element.dataset.type = type;
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
 * @param {any} error
 * @returns {boolean} true si ya se redirigió al login.
 */
function redirectIfSessionLost(error) {
    if (error?.status === 401) {
        window.location.replace('/login');

        return true;
    }

    if (error?.status === 403) {
        return false;
    }

    return false;
}

/**
 * @param {string} value
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
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function errorSlot(id) {
    return document.querySelector(`[data-error-for="${id}"]`);
}

/* Enlaces globales del layout ------------------------------------------ */

const toast = document.querySelector('[data-toast]');

if (toast instanceof HTMLElement) {
    window.setTimeout(() => {
        toast.hidden = true;
    }, 4500);
}

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

/* Categorías ----------------------------------------------------------- */

const categoriaModal = document.querySelector('[data-categoria-modal]');

if (categoriaModal instanceof HTMLElement) {
    initCategoriaModal(categoriaModal);
}

/**
 * @param {HTMLElement} modalElement
 */
function initCategoriaModal(modalElement) {
    const form = modalElement.querySelector('[data-categoria-form]');
    const input = modalElement.querySelector('#categoria-nombre');
    const message = modalElement.querySelector('[data-categoria-message]');
    const submit = modalElement.querySelector('[data-categoria-submit]');

    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
        return;
    }

    const bootstrap = window.bootstrap;

    if (!bootstrap || typeof bootstrap.Modal !== 'function') {
        return;
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    document.querySelectorAll('[data-categoria-open]').forEach((button) => {
        button.addEventListener('click', () => {
            input.value = '';
            input.removeAttribute('aria-invalid');
            clearMessage(message);
            modal.show();
        });
    });

    modalElement.addEventListener('shown.bs.modal', () => {
        input.focus();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nombre = input.value.trim();

        if (nombre.length < 2 || nombre.length > 80) {
            input.setAttribute('aria-invalid', 'true');
            showMessage(message, 'El nombre debe tener entre 2 y 80 caracteres.');

            return;
        }

        const textoOriginal = submit instanceof HTMLButtonElement ? submit.textContent : '';
        setBusy(submit, true, textoOriginal, 'Creando…');
        clearMessage(message);

        try {
            const categoria = await fetchApi('/api/admin/categorias', {
                method: 'POST',
                body: { nombre },
            });

            agregarOpcionCategoria(categoria);
            modal.hide();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            input.setAttribute('aria-invalid', 'true');
            showMessage(message, firstValidationMessage(error));
        } finally {
            setBusy(submit, false, textoOriginal);
        }
    });
}

/**
 * Agrega la categoría recién creada a los selects de la pantalla.
 *
 * @param {any} categoria
 */
function agregarOpcionCategoria(categoria) {
    const id = Number(categoria?.id ?? 0);
    const nombre = String(categoria?.nombre ?? '');

    if (id <= 0 || nombre === '') {
        return;
    }

    for (const select of document.querySelectorAll('#categoria_id')) {
        if (!(select instanceof HTMLSelectElement)) {
            continue;
        }

        if (!select.querySelector(`option[value="${id}"]`)) {
            const option = document.createElement('option');
            option.value = String(id);
            option.textContent = nombre;
            select.append(option);
        }
    }

    const formSelect = document.querySelector('#producto-form #categoria_id');

    if (formSelect instanceof HTMLSelectElement) {
        formSelect.value = String(id);
        formSelect.dispatchEvent(new Event('change', { bubbles: true }));
        showMessage(
            document.querySelector('#producto-form [data-message]'),
            `Categoría "${nombre}" creada y seleccionada.`,
            'success',
        );

        return;
    }

    const filtros = document.querySelector('#filtros-form');
    const filtroCategoria = document.querySelector('#filtros-form #categoria_id');

    if (filtros instanceof HTMLFormElement && filtroCategoria instanceof HTMLSelectElement) {
        filtroCategoria.value = String(id);
        filtros.requestSubmit();
    }
}

/* Lista ---------------------------------------------------------------- */

const tablaBody = document.querySelector('[data-productos-body]');

if (tablaBody instanceof HTMLElement) {
    initLista(tablaBody);
}

/**
 * @param {HTMLElement} body
 */
function initLista(body) {
    const filtros = document.querySelector('#filtros-form');
    const buscador = document.querySelector('#q');
    const categoria = document.querySelector('#categoria_id');
    const estado = document.querySelector('#estado');
    const imagen = document.querySelector('#imagen');

    const totalLabel = document.querySelector('[data-total]');
    const tableMessage = document.querySelector('[data-table-message]');
    const pagination = document.querySelector('[data-pagination]');
    const prev = document.querySelector('[data-page-prev]');
    const next = document.querySelector('[data-page-next]');
    const pageStatus = document.querySelector('[data-page-status]');

    const state = { page: 1, total: 0 };

    /**
     * @returns {URLSearchParams}
     */
    function filtrosActuales() {
        const params = new URLSearchParams();

        const q = buscador instanceof HTMLInputElement ? buscador.value.trim() : '';
        const cat = categoria instanceof HTMLSelectElement ? categoria.value : '';
        const est = estado instanceof HTMLSelectElement ? estado.value : '';
        const img = imagen instanceof HTMLSelectElement ? imagen.value : '';

        if (q !== '') {
            params.set('q', q);
        }

        if (cat !== '') {
            params.set('categoria_id', cat);
        }

        if (est !== '') {
            params.set('estado', est);
        }

        if (img !== '') {
            params.set('imagen', img);
        }

        return params;
    }

    /**
     * @param {string} tag
     * @param {string} [text]
     * @param {string} [className]
     * @returns {HTMLElement}
     */
    function cell(tag, text = '', className = '') {
        const element = document.createElement(tag);

        if (text !== '') {
            element.textContent = text;
        }

        if (className !== '') {
            element.className = className;
        }

        return element;
    }

    /**
     * @param {any} producto
     * @returns {HTMLTableRowElement}
     */
    function fila(producto) {
        const tr = document.createElement('tr');
        tr.className = 'product-row';
        tr.dataset.productoId = String(Number(producto.id ?? 0));

        const imagenTd = document.createElement('td');
        const url = typeof producto.imagen_url === 'string' ? producto.imagen_url : '';
        const vencida = producto.imagen_estado === 'vencida';

        if (url !== '' && isValidImageUrl(url)) {
            const img = document.createElement('img');
            img.className = 'thumb rounded';
            img.src = url;
            img.alt = `Imagen de ${String(producto.nombre ?? 'producto')}`;
            img.loading = 'lazy';
            img.width = 44;
            img.height = 44;

            if (vencida) {
                img.classList.add('thumb--vencida');
                img.title = 'La URL de la imagen no responde';
            }

            imagenTd.append(img);

            if (vencida) {
                const badge = cell('span', 'Vencida', 'badge bg-danger d-block mt-1');
                imagenTd.append(badge);
            }
        } else {
            imagenTd.append(cell('span', '—', 'thumb thumb--empty'));
            imagenTd.append(cell('span', 'Sin foto', 'badge bg-secondary d-block mt-1'));
        }

        tr.append(imagenTd);

        const nombre = cell('td', String(producto.nombre ?? ''), 'fw-semibold');
        tr.append(nombre);

        tr.append(cell('td', String(producto.categoria_nombre ?? '—')));

        const unidadTd = document.createElement('td');
        unidadTd.append(cell('span', String(producto.unidad_base ?? ''), 'badge bg-light text-dark'));
        tr.append(unidadTd);

        const estadoTd = document.createElement('td');
        const esActivo = producto.estado === 'activo';
        const badge = cell(
            'span',
            esActivo ? 'Activo' : 'Inactivo',
            `badge ${esActivo ? 'bg-success' : 'bg-secondary'}`,
        );
        estadoTd.append(badge);
        tr.append(estadoTd);

        const acciones = document.createElement('td');
        acciones.className = 'text-end admin-actions';

        const editar = document.createElement('a');
        editar.className = 'btn btn-sm btn-outline-primary me-1';
        editar.href = `/admin/productos/${Number(producto.id)}`;
        editar.innerHTML = '<i class="bi bi-pencil-square" aria-hidden="true"></i> Editar';
        acciones.append(editar);

        if (esActivo) {
            const desactivar = document.createElement('button');
            desactivar.type = 'button';
            desactivar.className = 'btn btn-sm btn-outline-danger';
            desactivar.innerHTML = '<i class="bi bi-eye-slash" aria-hidden="true"></i> Desactivar';
            desactivar.dataset.deactivateId = String(producto.id);
            desactivar.dataset.nombre = String(producto.nombre ?? '');
            acciones.append(desactivar);
        }

        tr.append(acciones);

        return tr;
    }

    /**
     * @param {number} total
     */
    function renderPaginacion(total) {
        const paginas = Math.max(1, Math.ceil(total / PER_PAGE));

        if (!(pagination instanceof HTMLElement)) {
            return;
        }

        pagination.hidden = paginas <= 1;

        if (prev instanceof HTMLButtonElement) {
            prev.disabled = state.page <= 1;
        }

        if (next instanceof HTMLButtonElement) {
            next.disabled = state.page >= paginas;
        }

        if (pageStatus instanceof HTMLElement) {
            pageStatus.textContent = `Página ${state.page} de ${paginas}`;
        }
    }

    async function cargar() {
        clearMessage(tableMessage);

        if (totalLabel instanceof HTMLElement) {
            totalLabel.hidden = true;
        }

        body.replaceChildren();
        const loading = document.createElement('tr');
        const loadingCell = cell('td', 'Cargando productos…', 'text-center text-muted py-4');
        loadingCell.colSpan = 6;
        loading.append(loadingCell);
        body.append(loading);

        const params = filtrosActuales();
        params.set('page', String(state.page));

        try {
            const data = await fetchApi(`/api/admin/productos?${params.toString()}`);
            const items = Array.isArray(data?.items) ? data.items : [];

            state.total = Number(data?.total ?? 0);

            body.replaceChildren();

            if (items.length === 0) {
                const empty = document.createElement('tr');
                const emptyCell = cell(
                    'td',
                    'No hay productos que coincidan con los filtros.',
                    'text-center text-muted py-4',
                );
                emptyCell.colSpan = 6;
                empty.append(emptyCell);
                body.append(empty);
            } else {
                const fragment = document.createDocumentFragment();

                for (const producto of items) {
                    fragment.append(fila(producto));
                }

                body.append(fragment);
            }

            if (totalLabel instanceof HTMLElement) {
                totalLabel.textContent = `${state.total} ${state.total === 1 ? 'producto' : 'productos'}`;
                totalLabel.hidden = false;
            }

            renderPaginacion(state.total);
        } catch (error) {
            body.replaceChildren();

            const row = document.createElement('tr');
            const errorCell = cell(
                'td',
                'No se pudo cargar el catálogo.',
                'text-center text-muted py-4',
            );
            errorCell.colSpan = 6;
            row.append(errorCell);
            body.append(row);

            if (!redirectIfSessionLost(error)) {
                showMessage(tableMessage, firstValidationMessage(error));
            }

            if (pagination instanceof HTMLElement) {
                pagination.hidden = true;
            }
        }
    }

    filtros?.addEventListener('submit', (event) => {
        event.preventDefault();
        state.page = 1;
        cargar();
    });

    prev?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1;
            cargar();
        }
    });

    next?.addEventListener('click', () => {
        const paginas = Math.max(1, Math.ceil(state.total / PER_PAGE));

        if (state.page < paginas) {
            state.page += 1;
            cargar();
        }
    });

    const verificar = document.querySelector('[data-verificar-fotos]');

    verificar?.addEventListener('click', async () => {
        if (!(verificar instanceof HTMLButtonElement)) {
            return;
        }

        const confirmado = window.confirm(
            'Se revisarán las URLs de todas las fotos del catálogo. Puede tardar unos segundos. ¿Continuar?',
        );

        if (!confirmado) {
            return;
        }

        const textoOriginal = verificar.innerHTML;
        verificar.disabled = true;
        verificar.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Verificando…';
        clearMessage(tableMessage);

        try {
            const data = await fetchApi('/api/admin/productos/verificar-fotos', {
                method: 'POST',
            });
            const revisadas = Number(data?.revisadas ?? 0);
            const vencidas = Number(data?.vencidas ?? 0);

            state.page = 1;
            await cargar();
            showMessage(
                tableMessage,
                `Se revisaron ${revisadas} ${revisadas === 1 ? 'foto' : 'fotos'}. ${vencidas} ${vencidas === 1 ? 'está vencida' : 'están vencidas'}.`,
                'success',
            );
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showMessage(tableMessage, firstValidationMessage(error));
            }
        } finally {
            verificar.disabled = false;
            verificar.innerHTML = textoOriginal;
        }
    });

    body.addEventListener('click', async (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('[data-deactivate-id]');

        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const id = button.dataset.deactivateId ?? '';
        const nombre = button.dataset.nombre ?? 'este producto';
        const confirmado = window.confirm(
            `¿Desactivar "${nombre}"? Dejará de aparecer en el catálogo público.`,
        );

        if (!confirmado) {
            return;
        }

        button.disabled = true;
        clearMessage(tableMessage);

        try {
            await fetchApi(`/api/admin/productos/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });

            const retorno = filtrosActuales();
            retorno.set('ok', 'desactivado');
            window.location.assign(`/admin/productos?${retorno.toString()}`);
        } catch (error) {
            button.disabled = false;

            if (!redirectIfSessionLost(error)) {
                showMessage(tableMessage, firstValidationMessage(error));
            }
        }
    });

    cargar();
}

/* Formulario ----------------------------------------------------------- */

const productoForm = document.querySelector('#producto-form');

if (productoForm instanceof HTMLFormElement) {
    initFormulario(productoForm);
}

/**
 * @param {HTMLFormElement} form
 */
function initFormulario(form) {
    const esEdicion = form.dataset.mode === 'editar';
    const productoId = form.dataset.productId ?? '';

    const nombreInput = form.querySelector('#nombre');
    const categoriaSelect = form.querySelector('#categoria_id');
    const unidadSelect = form.querySelector('#unidad_base');
    const imagenInput = form.querySelector('#imagen_url');
    const mensaje = form.querySelector('[data-message]');
    const submit = form.querySelector('button[type="submit"]');
    const desactivar = form.querySelector('[data-deactivate]');
    const preview = form.querySelector('#imagen-preview');

    /**
     * @param {string} campo
     * @param {string} texto
     */
    function marcarError(campo, texto) {
        const slot = errorSlot(campo);

        if (slot instanceof HTMLElement) {
            slot.textContent = texto;
            slot.hidden = false;
        }

        form.querySelector(`#${campo}`)?.setAttribute('aria-invalid', 'true');
    }

    function limpiarErrores() {
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
     * @returns {{ ok: boolean, body: Record<string, any> }}
     */
    function leerFormulario() {
        const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
        const categoria = categoriaSelect instanceof HTMLSelectElement ? categoriaSelect.value : '';
        const unidad = unidadSelect instanceof HTMLSelectElement ? unidadSelect.value : '';
        const imagen = imagenInput instanceof HTMLInputElement ? imagenInput.value.trim() : '';

        let ok = true;

        if (nombre.length < 2 || nombre.length > 150) {
            marcarError('nombre', 'El nombre debe tener entre 2 y 150 caracteres.');
            ok = false;
        }

        if (categoria === '') {
            marcarError('categoria_id', 'Selecciona una categoría.');
            ok = false;
        }

        if (!UNIDADES.includes(unidad)) {
            marcarError('unidad_base', 'Selecciona una unidad válida.');
            ok = false;
        }

        if (imagen !== '' && !isValidImageUrl(imagen)) {
            marcarError('imagen_url', 'Escribe una URL http o https válida.');
            ok = false;
        }

        return {
            ok,
            body: {
                nombre,
                categoria_id: categoria === '' ? null : Number(categoria),
                unidad_base: unidad,
                imagen_url: imagen === '' ? null : imagen,
            },
        };
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        limpiarErrores();
        clearMessage(mensaje);

        const { ok, body } = leerFormulario();

        if (!ok) {
            showMessage(mensaje, 'Revisa los campos marcados en rojo.');

            return;
        }

        const textoInactivo = esEdicion ? 'Guardar cambios' : 'Crear producto';
        setBusy(submit, true, textoInactivo, 'Guardando…');

        try {
            if (esEdicion) {
                await fetchApi(`/api/admin/productos/${encodeURIComponent(productoId)}`, {
                    method: 'PUT',
                    body,
                });
            } else {
                await fetchApi('/api/admin/productos', {
                    method: 'POST',
                    body,
                });
            }

            window.location.assign(
                `/admin/productos?ok=${esEdicion ? 'actualizado' : 'creado'}`,
            );
        } catch (error) {
            setBusy(submit, false, textoInactivo);

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

            showMessage(mensaje, firstValidationMessage(error));
        }
    });

    imagenInput?.addEventListener('input', () => {
        if (!(preview instanceof HTMLImageElement)) {
            return;
        }

        const url = imagenInput instanceof HTMLInputElement ? imagenInput.value.trim() : '';

        if (url !== '' && isValidImageUrl(url)) {
            preview.src = url;
            preview.hidden = false;
        } else {
            preview.hidden = true;
            preview.removeAttribute('src');
        }
    });

    desactivar?.addEventListener('click', async () => {        const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
        const confirmado = window.confirm(
            `¿Desactivar "${nombre}"? Dejará de aparecer en el catálogo público.`,
        );

        if (!confirmado) {
            return;
        }

        if (desactivar instanceof HTMLButtonElement) {
            desactivar.disabled = true;
        }

        clearMessage(mensaje);

        try {
            await fetchApi(`/api/admin/productos/${encodeURIComponent(productoId)}`, {
                method: 'DELETE',
            });

            window.location.assign('/admin/productos?ok=desactivado');
        } catch (error) {
            if (desactivar instanceof HTMLButtonElement) {
                desactivar.disabled = false;
            }

            if (!redirectIfSessionLost(error)) {
                showMessage(mensaje, firstValidationMessage(error));
            }
        }
    });
}
