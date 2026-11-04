/**
 * Detalle de compra: fecha editable, ítems editables, alta y borrado.
 */

import { fetchApi } from '../modules/api.js';
import { confirmar } from '../modules/confirm.js';
import {
    formatCurrency,
    formatQuantity,
    subtractYearsISO,
    todayISO,
} from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-detalle]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        fecha: root.querySelector('[data-fecha-compra]'),
        titulo: root.querySelector('[data-titulo-compra]'),
        total: root.querySelector('[data-total-compra]'),
        items: root.querySelector('[data-items]'),
        vacio: root.querySelector('[data-items-vacio]'),
        borrarCompra: root.querySelector('[data-borrar-compra]'),
        abrirAgregar: root.querySelector('[data-abrir-agregar]'),
        modal: document.querySelector('[data-modal-agregar]'),
        form: document.querySelector('[data-form-agregar]'),
        buscar: document.querySelector('[data-agregar-buscar]'),
        status: document.querySelector('[data-agregar-status]'),
        resultados: document.querySelector('[data-agregar-resultados]'),
        seleccion: document.querySelector('[data-agregar-seleccion]'),
        seleccionNombre: document.querySelector('[data-agregar-seleccion-nombre]'),
        seleccionUnidad: document.querySelector('[data-agregar-seleccion-unidad]'),
        quitar: document.querySelector('[data-agregar-quitar]'),
        libre: document.querySelector('[data-agregar-libre]'),
        unidad: document.querySelector('[data-agregar-unidad]'),
        cantidad: document.querySelector('[data-agregar-cantidad]'),
        precio: document.querySelector('[data-agregar-precio]'),
        error: document.querySelector('[data-agregar-error]'),
        cerrarAgregar: document.querySelector('[data-cerrar-agregar]'),
    };

    const compraId = Number(root.dataset.compraId);
    let items = parseItems(root.dataset.itemsIniciales);
    let selectedProduct = null;
    let searchTimer = null;
    let searchSequence = 0;

    bindLogout();
    bindFecha();
    bindItems();
    bindBorrarCompra();
    bindModal();
    bindBuscar();
    bindLibre();
    bindFormulario();

    renderItems();
    actualizarTotal();

    /* Fecha ------------------------------------------------------------ */

    function bindFecha() {
        if (!(el.fecha instanceof HTMLInputElement)) {
            return;
        }

        let anterior = el.fecha.value;

        el.fecha.addEventListener('change', async () => {
            const fecha = el.fecha.value;
            const today = todayISO();

            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                el.fecha.value = anterior;
                showToast('Selecciona una fecha válida.', 'error');

                return;
            }

            if (fecha > today) {
                el.fecha.value = anterior;
                showToast('La fecha no puede ser futura.', 'error');

                return;
            }

            if (fecha < subtractYearsISO(today, 2)) {
                el.fecha.value = anterior;
                showToast('La fecha no puede ser anterior a 2 años.', 'error');

                return;
            }

            if (fecha === anterior) {
                return;
            }

            el.fecha.disabled = true;

            try {
                await fetchApi(`/api/compras/${compraId}`, {
                    method: 'PUT',
                    body: { fecha },
                });

                anterior = fecha;

                if (el.titulo instanceof HTMLElement) {
                    el.titulo.textContent = `Compra del ${formatDayMonthYear(fecha)}`;
                }

                showToast('Fecha actualizada.', 'success');
            } catch (error) {
                el.fecha.value = anterior;

                if (!redirectIfSessionLost(error)) {
                    showToast(firstValidationMessage(error), 'error');
                }
            } finally {
                el.fecha.disabled = false;
            }
        });
    }

    /* Ítems ------------------------------------------------------------ */

    function bindItems() {
        if (!(el.items instanceof HTMLElement)) {
            return;
        }

        el.items.addEventListener('click', (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const edit = target.closest('[data-edit]');

            if (edit instanceof HTMLButtonElement) {
                const row = edit.closest('[data-item]');

                if (!(row instanceof HTMLElement)) {
                    return;
                }

                const itemId = Number(row.dataset.itemId);
                const field = edit.dataset.edit;

                if (field === 'cantidad' || field === 'precio_total') {
                    iniciarEdicion(edit, itemId, field);
                }

                return;
            }

            const remove = target.closest('[data-remove-item]');

            if (remove instanceof HTMLElement) {
                const row = remove.closest('[data-item]');

                if (!(row instanceof HTMLElement)) {
                    return;
                }

                borrarItem(Number(row.dataset.itemId));
            }
        });
    }

    function iniciarEdicion(button, itemId, field) {
        const item = items.find((current) => current.id === itemId);

        if (item === undefined) {
            return;
        }

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'detail-item__input form-control form-control-sm';
        input.inputMode = 'decimal';
        input.value = String(item[field]);
        input.step = field === 'cantidad' ? '0.001' : '0.01';
        input.min = field === 'cantidad' ? '0.001' : '0';

        button.replaceWith(input);
        input.focus();
        input.select();

        let done = false;

        const finish = async (commit) => {
            if (done) {
                return;
            }

            done = true;

            if (!commit) {
                renderItems();

                return;
            }

            const raw = input.value.trim().replace(',', '.');
            const value = parseDecimal(raw, field === 'cantidad' ? 3 : 2);

            if (
                value === null
                || (field === 'cantidad' && value <= 0)
                || (field === 'precio_total' && value < 0)
            ) {
                showToast(
                    field === 'cantidad'
                        ? 'La cantidad debe ser mayor que 0 (máximo 3 decimales).'
                        : 'El precio debe ser mayor o igual a 0 (máximo 2 decimales).',
                    'error',
                );
                renderItems();

                return;
            }

            if (Number(item[field]) === value) {
                renderItems();

                return;
            }

            input.disabled = true;

            try {
                const actualizado = await fetchApi(`/api/compras/${compraId}/items/${itemId}`, {
                    method: 'PUT',
                    body: { [field]: value },
                });

                const index = items.findIndex((current) => current.id === itemId);

                if (index !== -1) {
                    items[index] = { ...items[index], ...actualizado };
                }

                renderItems();
                actualizarTotal();
                showToast('Ítem actualizado.', 'success');
            } catch (error) {
                renderItems();

                if (!redirectIfSessionLost(error)) {
                    showToast(firstValidationMessage(error), 'error');
                }
            }
        };

        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        });
    }

    async function borrarItem(itemId) {
        const item = items.find((current) => current.id === itemId);

        if (item === undefined) {
            return;
        }

        const confirmado = await confirmar({
            title: 'Borrar ítem',
            message: `¿Borrar «${item.nombre}» de esta compra?`,
            confirmText: 'Borrar ítem',
        });

        if (!confirmado) {
            return;
        }

        try {
            await fetchApi(`/api/compras/${compraId}/items/${itemId}`, { method: 'DELETE' });
            items = items.filter((current) => current.id !== itemId);
            renderItems();
            actualizarTotal();
            showToast('Ítem eliminado.', 'info');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(firstValidationMessage(error), 'error');
            }
        }
    }

    function renderItems() {
        if (!(el.items instanceof HTMLElement)) {
            return;
        }

        el.items.replaceChildren();

        for (const item of items) {
            el.items.append(crearFila(item));
        }

        if (el.vacio instanceof HTMLElement) {
            el.vacio.hidden = items.length > 0;
        }
    }

    function actualizarTotal() {
        if (!(el.total instanceof HTMLElement)) {
            return;
        }

        const total = items.reduce((sum, item) => sum + Number(item.precio_total), 0);
        el.total.textContent = formatCurrency(Math.round(total * 100) / 100);
    }

    /* Borrar compra ---------------------------------------------------- */

    function bindBorrarCompra() {
        if (!(el.borrarCompra instanceof HTMLButtonElement)) {
            return;
        }

        el.borrarCompra.addEventListener('click', async () => {
            const confirmado = await confirmar({
                title: 'Borrar compra',
                message: 'Se borrarán la compra y todos sus ítems. Esta acción no se puede deshacer.',
                confirmText: 'Borrar compra',
            });

            if (!confirmado) {
                return;
            }

            el.borrarCompra.disabled = true;

            try {
                await fetchApi(`/api/compras/${compraId}`, { method: 'DELETE' });
                window.location.assign('/historial?eliminada=1');
            } catch (error) {
                el.borrarCompra.disabled = false;

                if (!redirectIfSessionLost(error)) {
                    showToast(firstValidationMessage(error), 'error');
                }
            }
        });
    }

    /* Modal agregar ---------------------------------------------------- */

    function bindModal() {
        el.abrirAgregar?.addEventListener('click', abrirModal);
        el.cerrarAgregar?.addEventListener('click', cerrarModal);

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                cerrarModal();
            }
        });
    }

    function abrirModal() {
        if (!(el.modal instanceof HTMLElement)) {
            return;
        }

        selectedProduct = null;
        searchSequence += 1;
        window.clearTimeout(searchTimer);

        if (el.form instanceof HTMLFormElement) {
            el.form.reset();
        }

        if (el.unidad instanceof HTMLSelectElement) {
            el.unidad.value = 'pza';
            el.unidad.disabled = false;
        }

        if (el.cantidad instanceof HTMLInputElement) {
            el.cantidad.value = '1';
        }

        if (el.buscar instanceof HTMLInputElement) {
            el.buscar.value = '';
        }

        if (el.resultados instanceof HTMLElement) {
            el.resultados.replaceChildren();
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Escribe al menos 2 caracteres.';
        }

        actualizarSeleccion();
        limpiarError(el.error);

        el.modal.hidden = false;
        el.buscar?.focus();
    }

    function cerrarModal() {
        if (el.modal instanceof HTMLElement) {
            el.modal.hidden = true;
        }
    }

    function bindBuscar() {
        if (!(el.buscar instanceof HTMLInputElement)) {
            return;
        }

        el.buscar.addEventListener('input', () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(buscar, 300);
        });

        el.buscar.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                window.clearTimeout(searchTimer);
                buscar();
            }
        });
    }

    async function buscar() {
        if (!(el.buscar instanceof HTMLInputElement)) {
            return;
        }

        const q = el.buscar.value.trim();
        const sequence = ++searchSequence;

        if (q.length < 2) {
            if (el.resultados instanceof HTMLElement) {
                el.resultados.replaceChildren();
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'Escribe al menos 2 caracteres.';
            }

            return;
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Buscando…';
        }

        try {
            const data = await fetchApi(`/api/productos/buscar?q=${encodeURIComponent(q)}`);

            if (sequence !== searchSequence) {
                return;
            }

            renderResultados(Array.isArray(data) ? data : []);
        } catch (error) {
            if (sequence !== searchSequence) {
                return;
            }

            if (!redirectIfSessionLost(error)) {
                if (el.status instanceof HTMLElement) {
                    el.status.textContent = 'No se pudo buscar productos.';
                }

                showToast(error?.message ?? 'No se pudo buscar productos.', 'error');
            }
        }
    }

    function renderResultados(productos) {
        if (!(el.resultados instanceof HTMLElement)) {
            return;
        }

        el.resultados.replaceChildren();

        if (productos.length === 0) {
            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'Sin resultados. Puedes agregarlo como ítem libre.';
            }

            return;
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = `${productos.length} ${productos.length === 1 ? 'resultado' : 'resultados'}`;
        }

        for (const producto of productos) {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'add-result list-group-item list-group-item-action';
            button.dataset.productoId = String(producto.id);

            const name = document.createElement('span');
            name.className = 'add-result__name';
            name.textContent = String(producto.nombre ?? '');

            const meta = document.createElement('span');
            meta.className = 'add-result__meta';
            meta.textContent = `${String(producto.categoria_nombre ?? 'Sin categoría')} · Unidad: ${String(producto.unidad_base ?? '')}`;

            button.append(name, meta);
            button.addEventListener('click', () => seleccionarProducto(producto));
            li.append(button);
            el.resultados.append(li);
        }
    }

    function seleccionarProducto(producto) {
        selectedProduct = producto;

        if (el.libre instanceof HTMLInputElement) {
            el.libre.value = '';
        }

        if (el.unidad instanceof HTMLSelectElement) {
            el.unidad.value = String(producto.unidad_base ?? 'pza');
            el.unidad.disabled = true;
        }

        if (el.resultados instanceof HTMLElement) {
            el.resultados.replaceChildren();
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Producto seleccionado.';
        }

        actualizarSeleccion();
        el.cantidad?.focus();
    }

    function bindLibre() {
        if (!(el.libre instanceof HTMLInputElement)) {
            return;
        }

        el.libre.addEventListener('input', () => {
            if (el.libre.value.trim() !== '' && selectedProduct !== null) {
                selectedProduct = null;
                actualizarSeleccion();

                if (el.unidad instanceof HTMLSelectElement) {
                    el.unidad.disabled = false;
                }
            }
        });
    }

    function bindFormulario() {
        el.quitar?.addEventListener('click', () => {
            selectedProduct = null;
            actualizarSeleccion();

            if (el.unidad instanceof HTMLSelectElement) {
                el.unidad.disabled = false;
            }

            el.buscar?.focus();
        });

        if (!(el.form instanceof HTMLFormElement)) {
            return;
        }

        el.form.addEventListener('submit', async (event) => {
            event.preventDefault();
            limpiarError(el.error);

            const cantidad = el.cantidad instanceof HTMLInputElement
                ? parseDecimal(el.cantidad.value.trim().replace(',', '.'), 3)
                : null;
            const precio = el.precio instanceof HTMLInputElement
                ? parseDecimal(el.precio.value.trim().replace(',', '.'), 2)
                : null;

            if (cantidad === null || cantidad <= 0) {
                setError(el.error, 'La cantidad debe ser mayor que 0 (máximo 3 decimales).');

                return;
            }

            if (precio === null || precio < 0) {
                setError(el.error, 'El precio debe ser mayor o igual a 0 (máximo 2 decimales).');

                return;
            }

            let payload;

            if (selectedProduct !== null) {
                payload = {
                    producto_id: selectedProduct.id,
                    cantidad,
                    precio_total: precio,
                };
            } else {
                const nombre = el.libre instanceof HTMLInputElement ? el.libre.value.trim() : '';
                const unidad = el.unidad instanceof HTMLSelectElement ? el.unidad.value : '';

                if (nombre.length < 2 || nombre.length > 150) {
                    setError(el.error, 'El nombre libre debe tener entre 2 y 150 caracteres.');

                    return;
                }

                if (!['kg', 'gr', 'L', 'ml', 'pza'].includes(unidad)) {
                    setError(el.error, 'Selecciona una unidad base válida.');

                    return;
                }

                payload = {
                    nombre_libre: nombre,
                    unidad_base: unidad,
                    cantidad,
                    precio_total: precio,
                };
            }

            const submit = el.form.querySelector('button[type="submit"]');

            if (submit instanceof HTMLButtonElement) {
                submit.disabled = true;
                submit.textContent = 'Agregando…';
            }

            try {
                const item = await fetchApi(`/api/compras/${compraId}/items`, {
                    method: 'POST',
                    body: payload,
                });

                items.push(item);
                renderItems();
                actualizarTotal();
                cerrarModal();
                showToast(`${String(item.nombre ?? 'Ítem')} agregado.`, 'success');
            } catch (error) {
                if (!redirectIfSessionLost(error)) {
                    setError(el.error, firstValidationMessage(error));
                    showToast(firstValidationMessage(error), 'error');
                }
            } finally {
                if (submit instanceof HTMLButtonElement) {
                    submit.disabled = false;
                    submit.textContent = 'Agregar ítem';
                }
            }
        });
    }

    function actualizarSeleccion() {
        if (el.seleccion instanceof HTMLElement) {
            el.seleccion.hidden = selectedProduct === null;
        }

        if (el.seleccionNombre instanceof HTMLElement) {
            el.seleccionNombre.textContent = selectedProduct === null
                ? ''
                : String(selectedProduct.nombre ?? '');
        }

        if (el.seleccionUnidad instanceof HTMLElement) {
            el.seleccionUnidad.textContent = selectedProduct === null
                ? ''
                : `· Unidad: ${String(selectedProduct.unidad_base ?? '')}`;
        }
    }
}

/* Render de ítems -------------------------------------------------------- */

/**
 * @param {any} item
 * @returns {HTMLElement}
 */
function crearFila(item) {
    const li = document.createElement('li');
    li.className = 'detail-item list-group-item d-flex flex-wrap align-items-center gap-3';
    li.dataset.item = '';
    li.dataset.itemId = String(item.id);

    const info = document.createElement('div');
    info.className = 'detail-item__info flex-grow-1';

    const name = document.createElement('p');
    name.className = 'detail-item__name fw-semibold mb-0';
    name.textContent = String(item.nombre ?? '');

    const meta = document.createElement('p');
    meta.className = 'detail-item__meta text-muted small mb-0';
    meta.textContent = item.producto_id === null
        ? 'Ítem libre'
        : `Unidad: ${String(item.unidad_base ?? '')}`;

    info.append(name, meta);

    const fields = document.createElement('div');
    fields.className = 'detail-item__fields d-flex flex-wrap align-items-center gap-2';
    fields.append(
        crearCampo('Cantidad', formatQuantity(item.cantidad), 'cantidad', item.id),
        crearCampo('Precio', formatCurrency(item.precio_total), 'precio_total', item.id),
        crearCampoUnitario(item),
    );

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'detail-item__remove btn btn-sm btn-outline-danger';
    remove.dataset.removeItem = '';
    remove.dataset.itemId = String(item.id);
    remove.setAttribute('aria-label', `Borrar ${String(item.nombre ?? 'ítem')}`);
    remove.textContent = '×';

    li.append(info, fields, remove);

    return li;
}

/**
 * @param {string} label
 * @param {string} value
 * @param {'cantidad' | 'precio_total'} field
 * @param {number} itemId
 * @returns {HTMLElement}
 */
function crearCampo(label, value, field, itemId) {
    const wrapper = document.createElement('span');
    wrapper.className = 'detail-item__field d-flex flex-column';

    const caption = document.createElement('span');
    caption.className = 'detail-item__caption text-uppercase text-muted small';
    caption.textContent = label;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'detail-item__value btn btn-outline-secondary btn-sm text-start';
    button.dataset.edit = field;
    button.dataset.itemId = String(itemId);
    button.textContent = value;

    wrapper.append(caption, button);

    return wrapper;
}

/**
 * @param {any} item
 * @returns {HTMLElement}
 */
function crearCampoUnitario(item) {
    const wrapper = document.createElement('span');
    wrapper.className = 'detail-item__field detail-item__field--unit d-flex flex-column';

    const caption = document.createElement('span');
    caption.className = 'detail-item__caption text-uppercase text-muted small';
    caption.textContent = 'Unitario';

    const value = document.createElement('span');
    value.className = 'detail-item__unit-price badge text-bg-light text-start fw-semibold';

    const cantidad = Number(item.cantidad);
    const precio = Number(item.precio_total);
    const unitario = cantidad > 0 ? precio / cantidad : 0;

    value.textContent = item.producto_id === null
        ? formatCurrency(unitario)
        : `${formatCurrency(unitario)} / ${String(item.unidad_base ?? '')}`;

    wrapper.append(caption, value);

    return wrapper;
}

/* Utilidades ------------------------------------------------------------ */

/**
 * @param {string | undefined} raw
 * @returns {Array<any>}
 */
function parseItems(raw) {
    if (typeof raw !== 'string' || raw === '') {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);

        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * @param {string} raw
 * @param {number} decimals
 * @returns {number | null}
 */
function parseDecimal(raw, decimals) {
    if (raw === '' || !new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(raw)) {
        return null;
    }

    const value = Number(raw);

    return Number.isFinite(value) ? value : null;
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
 * @param {Element | null} slot
 * @param {string} message
 */
function setError(slot, message) {
    if (slot instanceof HTMLElement) {
        slot.textContent = message;
        slot.hidden = false;
    }
}

/**
 * @param {Element | null} slot
 */
function limpiarError(slot) {
    if (slot instanceof HTMLElement) {
        slot.textContent = '';
        slot.hidden = true;
    }
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatDayMonthYear(value) {
    const parts = String(value).split('-');

    if (parts.length !== 3) {
        return String(value);
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function bindLogout() {
    const logout = document.querySelector('[data-logout]');

    logout?.addEventListener('click', async () => {
        if (logout instanceof HTMLButtonElement) {
            logout.disabled = true;
        }

        try {
            await fetchApi('/api/auth/logout', { method: 'POST' });
        } catch {
            // Si la sesión ya expiró, igualmente volvemos al login.
        }

        window.location.replace('/login');
    });
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

/* Ticket original en modal --------------------------------------------- */

bindTicketPhoto();

function bindTicketPhoto() {
    const opener = document.querySelector('[data-ticket-foto-open]');
    const modal = document.querySelector('[data-ticket-foto-modal]');
    const image = document.querySelector('[data-ticket-foto-img]');
    const close = document.querySelector('[data-ticket-foto-close]');

    if (
        !(opener instanceof HTMLButtonElement)
        || !(modal instanceof HTMLElement)
        || !(image instanceof HTMLImageElement)
    ) {
        return;
    }

    const cerrar = () => {
        modal.hidden = true;
        document.body.classList.remove('ticket-photo-open');
        image.removeAttribute('src');
    };

    const abrir = () => {
        const url = opener.dataset.ticketFotoUrl ?? '';

        if (url === '') {
            return;
        }

        image.src = url;
        modal.hidden = false;
        document.body.classList.add('ticket-photo-open');

        if (close instanceof HTMLButtonElement) {
            close.focus();
        }
    };

    opener.addEventListener('click', abrir);
    close?.addEventListener('click', cerrar);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            cerrar();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            cerrar();
        }
    });
}
