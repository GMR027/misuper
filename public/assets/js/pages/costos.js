/**
 * Precios y costos: precios por producto, historial y precio manual.
 */

import { fetchApi } from '../modules/api.js';
import { formatCurrency, formatDate, formatQuantity } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-costos]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        buscar: root.querySelector('[data-costos-buscar]'),
        estado: root.querySelector('[data-costos-estado]'),
        lista: root.querySelector('[data-costos-lista]'),
        status: root.querySelector('[data-costos-status]'),
        vacio: root.querySelector('[data-costos-vacio]'),
        statTotal: root.querySelector('[data-stat-total]'),
        statConPrecio: root.querySelector('[data-stat-con-precio]'),
        statSinPrecio: root.querySelector('[data-stat-sin-precio]'),
        statViejos: root.querySelector('[data-stat-viejos]'),
        modal: document.querySelector('[data-precio-modal]'),
        modalTitle: document.querySelector('[data-precio-modal-title]'),
        modalBody: document.querySelector('[data-precio-modal-body]'),
    };

    if (!(el.lista instanceof HTMLElement) || !(el.buscar instanceof HTMLInputElement)) {
        return;
    }

    let searchTimer = null;
    let token = 0;
    /** @type {number|null} */
    let productoAbierto = null;

    bindLogout();
    bindModal();
    cargar();

    el.buscar.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(cargar, 280);
    });

    el.estado?.addEventListener('change', cargar);

    async function cargar() {
        const actual = ++token;
        const q = el.buscar instanceof HTMLInputElement ? el.buscar.value.trim() : '';
        const estado = el.estado instanceof HTMLSelectElement ? el.estado.value : 'todos';

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando precios…';
        }

        try {
            const data = await fetchApi(
                `/api/precios?q=${encodeURIComponent(q)}&estado=${encodeURIComponent(estado)}`,
            );

            if (actual !== token) {
                return;
            }

            renderResumen(data?.resumen ?? {});
            renderLista(Array.isArray(data?.items) ? data.items : []);
        } catch (error) {
            if (actual !== token) {
                return;
            }

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'No se pudieron cargar los precios.';
            }

            showToast(error?.message ?? 'No se pudieron cargar los precios.', 'error');
        }
    }

    /**
     * @param {any} resumen
     */
    function renderResumen(resumen) {
        setText(el.statTotal, resumen.total);
        setText(el.statConPrecio, resumen.con_precio);
        setText(el.statSinPrecio, resumen.sin_precio);
        setText(el.statViejos, resumen.viejos);

        if (el.status instanceof HTMLElement) {
            el.status.textContent = `${Number(resumen.total ?? 0)} productos · `
                + `${Number(resumen.con_precio ?? 0)} con precio`;
        }
    }

    /**
     * @param {Array<any>} items
     */
    function renderLista(items) {
        if (!(el.lista instanceof HTMLElement)) {
            return;
        }

        el.lista.replaceChildren();

        if (el.vacio instanceof HTMLElement) {
            el.vacio.hidden = items.length > 0;
        }

        for (const item of items) {
            el.lista.append(crearItem(item));
        }
    }

    /**
     * @param {any} item
     * @returns {HTMLElement}
     */
    function crearItem(item) {
        const fila = document.createElement('article');
        fila.className = 'costos-item';

        const avatar = document.createElement('span');
        avatar.className = 'costos-item__avatar';
        avatar.setAttribute('aria-hidden', 'true');

        if (item.imagen_url) {
            const img = document.createElement('img');
            img.src = String(item.imagen_url);
            img.alt = '';
            img.loading = 'lazy';
            avatar.append(img);
        } else {
            avatar.textContent = inicial(String(item.nombre ?? ''));
        }

        const body = document.createElement('div');
        body.className = 'costos-item__body';

        const nombre = document.createElement('p');
        nombre.className = 'costos-item__name';
        nombre.textContent = String(item.nombre ?? '');

        const meta = document.createElement('div');
        meta.className = 'costos-item__meta';
        meta.append(crearBadge(String(item.categoria_nombre ?? 'Sin categoría'), 'muted'));

        if (item.origen === 'manual') {
            meta.append(crearBadge('Precio manual', ''));
        } else if (item.precio !== null && item.precio !== undefined) {
            meta.append(crearBadge(
                `${Number(item.muestras ?? 0)} ${Number(item.muestras ?? 0) === 1 ? 'compra' : 'compras'}`,
                '',
            ));
        }

        if (item.viejo) {
            meta.append(crearBadge('Precio viejo', 'warning'));
        }

        if (item.fecha) {
            const fecha = document.createElement('span');
            fecha.textContent = `Último: ${formatDate(String(item.fecha))}`;
            meta.append(fecha);
        }

        if (item.comercio) {
            const comercio = document.createElement('span');
            comercio.textContent = String(item.comercio);
            meta.append(comercio);
        }

        body.append(nombre, meta);

        const precio = document.createElement('div');
        precio.className = 'costos-item__price';

        if (item.precio === null || item.precio === undefined) {
            const sin = document.createElement('strong');
            sin.className = 'text-warning';
            sin.textContent = 'Sin precio';
            const nota = document.createElement('small');
            nota.textContent = 'Agrega uno manual';
            precio.append(sin, nota);
        } else {
            const valor = document.createElement('strong');
            valor.textContent = formatCurrency(item.precio);
            const unidad = document.createElement('small');
            unidad.textContent = `por ${String(item.unidad_base ?? '')}`;
            precio.append(valor, unidad);
        }

        const actions = document.createElement('div');
        actions.className = 'costos-item__actions';
        const ver = document.createElement('button');
        ver.type = 'button';
        ver.className = 'btn btn-sm btn-outline-secondary';
        ver.innerHTML = '<i class="bi bi-clock-history" aria-hidden="true"></i> Historial';
        ver.addEventListener('click', () => abrirDetalle(Number(item.id)));
        actions.append(ver);

        fila.append(avatar, body, precio, actions);

        return fila;
    }

    function bindModal() {
        if (!(el.modal instanceof HTMLElement)) {
            return;
        }

        el.modal.querySelectorAll('[data-precio-cerrar]').forEach((button) => {
            button.addEventListener('click', cerrarModal);
        });

        el.modal.addEventListener('click', (event) => {
            if (event.target === el.modal) {
                cerrarModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !el.modal.hidden) {
                cerrarModal();
            }
        });
    }

    function cerrarModal() {
        if (el.modal instanceof HTMLElement) {
            el.modal.hidden = true;
        }

        productoAbierto = null;
    }

    /**
     * @param {number} productoId
     */
    async function abrirDetalle(productoId) {
        if (!(el.modal instanceof HTMLElement) || !(el.modalBody instanceof HTMLElement)) {
            return;
        }

        productoAbierto = productoId;
        el.modal.hidden = false;

        if (el.modalTitle instanceof HTMLElement) {
            el.modalTitle.textContent = 'Precio del producto';
        }

        el.modalBody.innerHTML = '<p class="text-muted small mb-0">Cargando historial…</p>';

        try {
            const data = await fetchApi(`/api/precios/${productoId}`);

            if (productoAbierto !== productoId) {
                return;
            }

            renderDetalle(data);
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            el.modalBody.innerHTML = '<p class="text-muted small mb-0">No se pudo cargar el producto.</p>';
            showToast(error?.message ?? 'No se pudo cargar el producto.', 'error');
        }
    }

    /**
     * @param {any} data
     */
    function renderDetalle(data) {
        if (!(el.modalBody instanceof HTMLElement)) {
            return;
        }

        const producto = data?.producto ?? {};
        const precio = data?.precio ?? null;
        const manual = data?.manual ?? null;
        const historial = Array.isArray(data?.historial) ? data.historial : [];

        if (el.modalTitle instanceof HTMLElement) {
            el.modalTitle.textContent = String(producto.nombre ?? 'Precio del producto');
        }

        el.modalBody.replaceChildren();

        const resumen = document.createElement('div');
        resumen.className = 'costos-detalle__resumen';

        resumen.append(
            bloqueResumen('Precio vigente', precio ? formatCurrency(precio.precio) : 'Sin precio'),
            bloqueResumen('Unidad', String(producto.unidad_base ?? '')),
            bloqueResumen(
                'Origen',
                precio?.origen === 'manual'
                    ? 'Manual'
                    : precio
                        ? `${Number(precio.muestras ?? 0)} ${Number(precio.muestras ?? 0) === 1 ? 'compra' : 'compras'}`
                        : 'Sin datos',
            ),
            bloqueResumen(
                'Última compra',
                precio?.fecha ? formatDate(String(precio.fecha)) : '—',
            ),
        );

        el.modalBody.append(resumen);

        if (precio?.viejo) {
            const aviso = document.createElement('div');
            aviso.className = 'alert alert-warning py-2 small';
            aviso.textContent = 'Este precio tiene más de 60 días. Puede haber cambiado.';
            el.modalBody.append(aviso);
        }

        if (precio?.origen === 'manual') {
            const aviso = document.createElement('p');
            aviso.className = 'text-muted small';
            aviso.textContent = 'Se está usando tu precio manual porque no hay compras registradas.';
            el.modalBody.append(aviso);
        }

        const tablaWrap = document.createElement('div');
        tablaWrap.className = 'table-responsive';

        const tabla = document.createElement('table');
        tabla.className = 'table table-sm align-middle costos-historial';
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Precio unitario</th>
                    <th scope="col">Total</th>
                    <th scope="col">Comercio</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement('tbody');

        if (historial.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'text-muted small';
            td.textContent = 'Aún no hay compras registradas de este producto.';
            tr.append(td);
            tbody.append(tr);
        }

        for (const fila of historial) {
            const tr = document.createElement('tr');
            tr.append(
                celda(formatDate(String(fila.fecha ?? ''))),
                celda(`${formatQuantity(fila.cantidad)} ${String(fila.unidad ?? '')}`),
                celda(
                    fila.precio_base === null || fila.precio_base === undefined
                        ? 'Unidad incompatible'
                        : `${formatCurrency(fila.precio_base)} / ${String(producto.unidad_base ?? '')}`,
                    fila.precio_base === null ? 'text-warning' : '',
                ),
                celda(formatCurrency(fila.precio_total)),
                celda(String(fila.comercio ?? '—')),
            );
            tbody.append(tr);
        }

        tabla.append(tbody);
        tablaWrap.append(tabla);
        el.modalBody.append(tablaWrap);

        el.modalBody.append(crearFormManual(producto, manual, Boolean(precio && precio.origen === 'manual')));
    }

    /**
     * @param {any} producto
     * @param {any} manual
     * @param {boolean} enUso
     * @returns {HTMLElement}
     */
    function crearFormManual(producto, manual, enUso) {
        const form = document.createElement('form');
        form.className = 'costos-manual';

        const titulo = document.createElement('h6');
        titulo.className = 'mb-2';
        titulo.textContent = 'Precio manual';

        const ayuda = document.createElement('p');
        ayuda.className = 'text-muted small mb-2';
        ayuda.textContent = enUso
            ? 'Ahora mismo se usa este precio. Si lo borras, volverán a mandar tus compras.'
            : 'Se usa solo cuando no hay compras registradas del producto.';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.htmlFor = 'precio-manual-input';
        label.textContent = `Precio por ${String(producto.unidad_base ?? 'unidad')}`;

        const grupo = document.createElement('div');
        grupo.className = 'input-group mb-2';

        const prefijo = document.createElement('span');
        prefijo.className = 'input-group-text';
        prefijo.textContent = '$';

        const input = document.createElement('input');
        input.className = 'form-control';
        input.type = 'number';
        input.id = 'precio-manual-input';
        input.min = '0';
        input.step = '0.0001';
        input.inputMode = 'decimal';
        input.required = true;
        input.value = manual ? String(manual.precio_unidad) : '';

        grupo.append(prefijo, input);

        const actions = document.createElement('div');
        actions.className = 'd-flex flex-wrap gap-2';

        const guardar = document.createElement('button');
        guardar.type = 'submit';
        guardar.className = 'btn btn-primary';
        guardar.innerHTML = '<i class="bi bi-check2-circle" aria-hidden="true"></i> Guardar precio';

        actions.append(guardar);

        if (manual) {
            const borrar = document.createElement('button');
            borrar.type = 'button';
            borrar.className = 'btn btn-outline-danger';
            borrar.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i> Quitar precio manual';
            borrar.addEventListener('click', async () => {
                borrar.disabled = true;

                try {
                    const data = await fetchApi(`/api/precios/${Number(producto.id)}/manual`, {
                        method: 'DELETE',
                    });
                    showToast('Precio manual eliminado.', 'success');
                    renderDetalle(data);
                    cargar();
                } catch (error) {
                    borrar.disabled = false;

                    if (!redirectIfSessionLost(error)) {
                        showToast(error?.message ?? 'No se pudo quitar el precio.', 'error');
                    }
                }
            });
            actions.append(borrar);
        }

        form.append(titulo, ayuda, label, grupo, actions);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (!(input instanceof HTMLInputElement)) {
                return;
            }

            const valor = Number(input.value);

            if (!Number.isFinite(valor) || valor < 0) {
                showToast('Escribe un precio válido.', 'error');

                return;
            }

            guardar.disabled = true;

            try {
                const data = await fetchApi(`/api/precios/${Number(producto.id)}/manual`, {
                    method: 'POST',
                    body: { precio_unidad: valor },
                });
                showToast('Precio manual guardado.', 'success');
                renderDetalle(data);
                cargar();
            } catch (error) {
                guardar.disabled = false;

                if (!redirectIfSessionLost(error)) {
                    showToast(error?.message ?? 'No se pudo guardar el precio.', 'error');
                }
            }
        });

        return form;
    }
}

/**
 * @param {HTMLElement|null} element
 * @param {any} value
 */
function setText(element, value) {
    if (element instanceof HTMLElement) {
        element.textContent = value === null || value === undefined ? '—' : String(value);
    }
}

/**
 * @param {string} text
 * @param {string} tone
 * @returns {HTMLElement}
 */
function crearBadge(text, tone) {
    const badge = document.createElement('span');
    badge.className = `costos-badge${tone ? ` costos-badge--${tone}` : ''}`;
    badge.textContent = text;

    return badge;
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
function bloqueResumen(label, value) {
    const bloque = document.createElement('div');
    const caption = document.createElement('span');
    caption.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;

    bloque.append(caption, strong);

    return bloque;
}

/**
 * @param {string} text
 * @param {string} [className]
 * @returns {HTMLTableCellElement}
 */
function celda(text, className = '') {
    const td = document.createElement('td');
    td.textContent = text;

    if (className !== '') {
        td.className = className;
    }

    return td;
}

/**
 * @param {string} value
 * @returns {string}
 */
function inicial(value) {
    const letra = value.trim().charAt(0);

    return letra === '' ? '?' : letra.toUpperCase();
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
