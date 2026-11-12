/**
 * Barra inferior móvil: accesos rápidos, buscador de productos y menú.
 *
 * El botón «+» abre un modal para buscar productos del catálogo. Cada
 * resultado se puede agregar directo o calcular por cantidad. El botón
 * «Menú» abre una hoja con el resto de secciones de la aplicación.
 */

import { fetchApi } from './modules/api.js';
import { addProduct, loadCart } from './modules/cart.js';
import { formatCurrency, formatQuantity } from './modules/format.js';
import { guardarPrecioUnidad, leerPrecioUnidad } from './modules/precios.js';
import { showToast } from './modules/toast.js';

const UNIDADES = {
    kg: 'kg',
    gr: 'gr',
    L: 'L',
    ml: 'ml',
    pza: 'pza',
};

const dock = document.querySelector('[data-dock]');

if (dock instanceof HTMLElement) {
    initDock(dock);
}

/**
 * @param {HTMLElement} dock
 */
function initDock(dock) {
    const botonNuevo = dock.querySelector('[data-dock-nuevo]');
    const botonMenu = dock.querySelector('[data-dock-menu]');
    const modalBuscar = document.querySelector('[data-dock-search-modal]');
    const modalMenu = document.querySelector('[data-dock-menu-modal]');

    const abrir = (modal, focus) => {
        if (!(modal instanceof HTMLElement)) {
            return;
        }

        modal.hidden = false;
        document.body.classList.add('dock-open');

        if (focus instanceof HTMLElement) {
            focus.focus();
        }
    };

    const cerrar = (modal) => {
        if (modal instanceof HTMLElement) {
            modal.hidden = true;
        }

        const abierto = [...document.querySelectorAll('.dock-modal')].some((item) => !item.hidden);

        if (!abierto) {
            document.body.classList.remove('dock-open');
        }

        if (modal === modalBuscar) {
            botonNuevo?.setAttribute('aria-expanded', 'false');
        }

        if (modal === modalMenu) {
            botonMenu?.setAttribute('aria-expanded', 'false');
        }
    };

    const cerrarTodos = () => {
        for (const modal of document.querySelectorAll('.dock-modal')) {
            if (modal instanceof HTMLElement && !modal.hidden) {
                cerrar(modal);
            }
        }
    };

    if (botonNuevo instanceof HTMLElement) {
        botonNuevo.addEventListener('click', () => {
            botonNuevo.setAttribute('aria-expanded', 'true');
            abrir(modalBuscar, modalBuscar?.querySelector('[data-dock-search]'));
        });
    }

    if (botonMenu instanceof HTMLElement) {
        botonMenu.addEventListener('click', () => {
            botonMenu.setAttribute('aria-expanded', 'true');
            abrir(modalMenu, modalMenu?.querySelector('[data-dock-close]'));
        });
    }

    // Cierre: botones con la X, clic en el fondo y tecla Escape.
    for (const modal of document.querySelectorAll('.dock-modal')) {
        if (!(modal instanceof HTMLElement)) {
            continue;
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                cerrar(modal);
            }
        });

        for (const boton of modal.querySelectorAll('[data-dock-close]')) {
            boton.addEventListener('click', () => cerrar(modal));
        }
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            cerrarTodos();
        }
    });

    if (modalBuscar instanceof HTMLElement) {
        initBuscador(modalBuscar);
    }
}

/**
 * Buscador de productos del modal inferior.
 *
 * @param {HTMLElement} modal
 */
function initBuscador(modal) {
    const input = modal.querySelector('[data-dock-search]');
    const status = modal.querySelector('[data-dock-search-status]');
    const results = modal.querySelector('[data-dock-results]');

    if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) {
        return;
    }

    let timer = null;
    let sequence = 0;

    const setStatus = (text) => {
        if (status instanceof HTMLElement) {
            status.textContent = text;
        }
    };

    const limpiar = (mensaje) => {
        results.replaceChildren();
        setStatus(mensaje);
    };

    async function buscar() {
        const q = input.value.trim();

        if (q === '') {
            sequence += 1;
            limpiar('Escribe el nombre de un producto para buscarlo.');

            return;
        }

        const actual = ++sequence;
        setStatus('Buscando…');

        try {
            const data = await fetchApi(`/api/productos/buscar?${new URLSearchParams({ q }).toString()}`);

            if (actual !== sequence) {
                return;
            }

            const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);

            if (items.length === 0) {
                limpiar(`No encontramos productos para «${q}».`);

                return;
            }

            results.replaceChildren();
            setStatus(`${items.length} ${items.length === 1 ? 'producto' : 'productos'}`);

            const fragment = document.createDocumentFragment();

            for (const product of items) {
                fragment.append(crearResultado(product));
            }

            results.append(fragment);
        } catch (error) {
            if (actual !== sequence) {
                return;
            }

            if (error?.status === 401) {
                window.location.replace('/login');

                return;
            }

            limpiar(error?.message ?? 'No se pudo buscar productos.');
        }
    }

    input.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(buscar, 300);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            window.clearTimeout(timer);
            buscar();
        }
    });

    limpiar('Escribe el nombre de un producto para buscarlo.');
}

/**
 * @param {any} product
 * @returns {HTMLLIElement}
 */
function crearResultado(product) {
    const li = document.createElement('li');
    li.className = 'dock-result';

    const row = document.createElement('div');
    row.className = 'dock-result__row';

    const thumbUrl = typeof product?.imagen_url === 'string' ? product.imagen_url : '';

    if (thumbUrl !== '' && /^https?:\/\//i.test(thumbUrl)) {
        const image = document.createElement('img');
        image.className = 'dock-result__thumb';
        image.src = thumbUrl;
        image.alt = '';
        image.loading = 'lazy';
        row.append(image);
    } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'dock-result__thumb dock-result__thumb--empty';
        placeholder.textContent = String(product?.nombre ?? '?').trim().charAt(0).toUpperCase() || '?';
        row.append(placeholder);
    }

    const body = document.createElement('span');
    body.className = 'dock-result__body';

    const name = document.createElement('span');
    name.className = 'dock-result__name';
    name.textContent = String(product?.nombre ?? '');

    const meta = document.createElement('span');
    meta.className = 'dock-result__meta';
    meta.textContent = `${String(product?.categoria_nombre ?? 'Sin categoría')} · ${String(product?.unidad_base ?? '')}`;

    body.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'dock-result__actions';

    const calc = document.createElement('button');
    calc.type = 'button';
    calc.className = 'dock-result__calc';
    calc.innerHTML = '<i class="bi bi-calculator" aria-hidden="true"></i>';
    calc.setAttribute('aria-label', `Calcular compra de ${String(product?.nombre ?? 'producto')}`);
    calc.title = 'Calcular por cantidad';
    calc.setAttribute('aria-expanded', 'false');

    const agregar = document.createElement('button');
    agregar.type = 'button';
    agregar.className = 'dock-result__add';
    agregar.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i>';
    agregar.setAttribute('aria-label', `Agregar ${String(product?.nombre ?? 'producto')} al carrito`);
    agregar.addEventListener('click', () => {
        if (agregarProducto(product)) {
            marcarAgregado(agregar);
        }
    });

    const calcForm = crearCalculadora(product, calc);

    actions.append(calc, agregar);
    row.append(body, actions);
    li.append(row, calcForm);

    calc.addEventListener('click', () => {
        const abierta = !calcForm.hidden;

        // Solo una calculadora abierta a la vez.
        for (const otra of document.querySelectorAll('.dock-result')) {
            const form = otra.querySelector('[data-dock-calc]');
            const boton = otra.querySelector('.dock-result__calc');

            if (form instanceof HTMLElement && !form.hidden && otra !== li) {
                form.hidden = true;
                boton?.setAttribute('aria-expanded', 'false');
            }
        }

        calcForm.hidden = abierta;
        calc.setAttribute('aria-expanded', abierta ? 'false' : 'true');

        if (!abierta) {
            const precio = calcForm.querySelector('[data-dock-calc-precio]');
            const guardado = leerPrecioUnidad(product?.id);

            if (precio instanceof HTMLInputElement) {
                if (precio.value === '' && guardado !== null) {
                    precio.value = String(guardado);
                    precio.dispatchEvent(new Event('input', { bubbles: true }));
                }

                precio.focus();
                precio.select();
            }
        }
    });

    return li;
}

/**
 * Formulario de cálculo por cantidad de un resultado.
 *
 * @param {any} product
 * @param {HTMLButtonElement} calc
 * @returns {HTMLFormElement}
 */
function crearCalculadora(product, calc) {
    const unidad = UNIDADES[String(product?.unidad_base ?? '')] ?? 'pza';

    const form = document.createElement('form');
    form.className = 'dock-calc';
    form.dataset.dockCalc = '';
    form.hidden = true;
    form.noValidate = true;

    const grid = document.createElement('div');
    grid.className = 'dock-calc__grid';

    const precioField = document.createElement('label');
    precioField.className = 'dock-calc__field';

    const precioLabel = document.createElement('span');
    precioLabel.className = 'dock-calc__label';
    precioLabel.textContent = `Costo por ${unidad === 'pza' ? 'pieza' : unidad}`;

    const precio = document.createElement('input');
    precio.type = 'number';
    precio.className = 'form-control form-control-sm';
    precio.min = '0';
    precio.step = '0.01';
    precio.inputMode = 'decimal';
    precio.placeholder = '0.00';
    precio.dataset.dockCalcPrecio = '';
    precio.setAttribute('aria-label', `Costo por ${unidad} de ${String(product?.nombre ?? 'producto')}`);

    precioField.append(precioLabel, precio);

    const cantidadField = document.createElement('label');
    cantidadField.className = 'dock-calc__field';

    const cantidadLabel = document.createElement('span');
    cantidadLabel.className = 'dock-calc__label';
    cantidadLabel.textContent = `Cantidad (${unidad})`;

    const cantidad = document.createElement('input');
    cantidad.type = 'number';
    cantidad.className = 'form-control form-control-sm';
    cantidad.min = '0.001';
    cantidad.step = '0.001';
    cantidad.inputMode = 'decimal';
    cantidad.value = '1';
    cantidad.dataset.dockCalcCantidad = '';
    cantidad.setAttribute('aria-label', `Cantidad en ${unidad}`);

    cantidadField.append(cantidadLabel, cantidad);

    grid.append(precioField, cantidadField);

    const foot = document.createElement('div');
    foot.className = 'dock-calc__foot';

    const totalSlot = document.createElement('span');
    totalSlot.className = 'dock-calc__total';

    const totalValue = document.createElement('strong');
    totalValue.dataset.dockCalcTotal = '';
    totalValue.textContent = '—';

    totalSlot.append('Importe: ', totalValue);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-sm btn-primary';
    submit.textContent = 'Agregar';

    foot.append(totalSlot, submit);

    const error = document.createElement('p');
    error.className = 'dock-calc__error';
    error.dataset.dockCalcError = '';
    error.hidden = true;

    const actualizar = () => {
        const precioValor = parseDecimal(precio.value, 2);
        const cantidadValor = parseDecimal(cantidad.value, 3);

        if (precioValor === null || cantidadValor === null || cantidadValor <= 0) {
            totalValue.textContent = '—';

            return;
        }

        totalValue.textContent = formatCurrency(calcularImporte(precioValor, cantidadValor));
    };

    precio.addEventListener('input', actualizar);
    cantidad.addEventListener('input', actualizar);

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const precioValor = parseDecimal(precio.value.trim(), 2);
        const cantidadValor = parseDecimal(cantidad.value.trim(), 3);

        error.hidden = true;

        if (precioValor === null || precioValor < 0) {
            error.textContent = 'El costo por unidad debe ser mayor o igual a 0 (máximo 2 decimales).';
            error.hidden = false;

            return;
        }

        if (cantidadValor === null || cantidadValor <= 0) {
            error.textContent = 'La cantidad debe ser mayor que 0 (máximo 3 decimales).';
            error.hidden = false;

            return;
        }

        const importe = calcularImporte(precioValor, cantidadValor);

        if (!agregarProducto(product, { cantidad: cantidadValor, precio_total: importe }, false)) {
            error.textContent = 'El carrito alcanzó el límite de 100 ítems.';
            error.hidden = false;

            return;
        }

        guardarPrecioUnidad(product?.id, precioValor);

        const nombre = String(product?.nombre ?? 'Producto');
        const agregar = form.closest('.dock-result')?.querySelector('.dock-result__add');

        if (agregar instanceof HTMLButtonElement) {
            marcarAgregado(agregar);
        }

        form.hidden = true;
        calc.setAttribute('aria-expanded', 'false');
        showToast(
            `${nombre}: ${formatQuantity(cantidadValor)} ${unidad} por ${formatCurrency(importe)}.`,
            'success',
        );
    });

    form.append(grid, foot, error);

    return form;
}

/**
 * Agrega un producto al carrito y avisa al resto de la página.
 *
 * @param {any} product
 * @param {{cantidad?: number, precio_total?: number}} [extra]
 * @param {boolean} [avisar] Muestra el aviso genérico de alta.
 * @returns {boolean}
 */
function agregarProducto(product, extra = {}, avisar = true) {
    loadCart();

    if (!addProduct(product, extra)) {
        showToast('El carrito alcanzó el límite de 100 ítems.', 'error');

        return false;
    }

    window.dispatchEvent(new CustomEvent('misuper:cart-changed'));

    if (avisar) {
        showToast(`${String(product?.nombre ?? 'Producto')} agregado al carrito.`, 'success');
    }

    return true;
}

/**
 * @param {HTMLButtonElement} boton
 */
function marcarAgregado(boton) {
    boton.classList.add('is-added');
    boton.innerHTML = '<i class="bi bi-check-lg" aria-hidden="true"></i>';

    window.setTimeout(() => {
        boton.classList.remove('is-added');
        boton.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i>';
    }, 1200);
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
 * @param {number} precio
 * @param {number} cantidad
 * @returns {number}
 */
function calcularImporte(precio, cantidad) {
    return Math.round((precio * cantidad + Number.EPSILON) * 100) / 100;
}
