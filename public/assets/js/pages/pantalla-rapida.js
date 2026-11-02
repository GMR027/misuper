/**
 * Pantalla rápida: búsqueda, frecuentes, carrito y guardado de la compra.
 */

import { fetchApi } from '../modules/api.js';
import {
    addFree,
    addProduct,
    clearCart,
    count as cartCount,
    getItems,
    hasItems,
    loadCart,
    removeItem,
    total as cartTotal,
    updateItem,
} from '../modules/cart.js';
import {
    formatCurrency,
    formatQuantity,
    subtractYearsISO,
    todayISO,
} from '../modules/format.js';
import { iconoCategoria } from '../modules/categorias.js';
import { guardarPrecioUnidad, leerPrecioUnidad } from '../modules/precios.js';
import { registerRenderer, render, setState, state } from '../modules/state.js';
import { showToast } from '../modules/toast.js';

const UNIDADES_INFO = {
    kg: { label: 'kg', nombre: 'kilogramo' },
    gr: { label: 'gr', nombre: 'gramo' },
    L: { label: 'L', nombre: 'litro' },
    ml: { label: 'ml', nombre: 'mililitro' },
    pza: { label: 'pza', nombre: 'pieza' },
};

const root = document.querySelector('[data-quick]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        searchForm: root.querySelector('[data-search-form]'),
        search: root.querySelector('[data-buscador]'),
        chips: root.querySelector('[data-categorias]'),
        results: root.querySelector('[data-resultados]'),
        resultsStatus: root.querySelector('[data-resultados-status]'),
        frequentSection: root.querySelector('[data-frecuentes]'),
        frequentGrid: root.querySelector('[data-frecuentes-grid]'),
        cartItems: root.querySelector('[data-carrito-items]'),
        cartCount: root.querySelector('[data-carrito-count]'),
        cartHeroCount: root.querySelector('[data-carrito-hero-count]'),
        cartTotal: root.querySelector('[data-carrito-total]'),
        cartHeroTotal: root.querySelector('[data-carrito-hero-total]'),
        cartEmpty: root.querySelector('[data-carrito-vacio]'),
        save: root.querySelector('[data-guardar]'),
        modalContinuar: document.querySelector('[data-modal-continuar]'),
        modalLibre: document.querySelector('[data-modal-libre]'),
        modalCalc: document.querySelector('[data-modal-calc]'),
        modalFecha: document.querySelector('[data-modal-fecha]'),
    };

    let categorias = [];
    let searchTimer = null;
    let searchSequence = 0;
    let productoCalculo = null;

    loadCart();

    registerRenderer(renderResultados);
    registerRenderer(renderCart);

    // El buscador de la barra inferior también agrega productos al carrito.
    window.addEventListener('misuper:cart-changed', () => {
        loadCart();
        render();
    });

    bindLogout();
    bindSearch();
    bindCart();
    bindModals();
    bindFreeForm();
    bindCalcForm();
    bindDateForm();
    bindContinuation();

    loadCategorias();
    loadFrecuentes();

    render();

    if (hasItems()) {
        openModal(el.modalContinuar);
        el.modalContinuar?.querySelector('[data-continuar]')?.focus();
    }

    showSavedToastIfNeeded();

    /* Búsqueda ---------------------------------------------------------- */

    function bindSearch() {
        if (!(el.search instanceof HTMLInputElement) || !(el.searchForm instanceof HTMLFormElement)) {
            return;
        }

        el.search.addEventListener('input', () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => buscar(), 300);
        });

        el.searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            window.clearTimeout(searchTimer);
            buscar();
        });
    }

    async function buscar() {
        if (!(el.search instanceof HTMLInputElement)) {
            return;
        }

        const q = el.search.value.trim();
        const categoria = state.categoria_activa;
        state.busqueda = q;

        if (q === '' && categoria === null) {
            setState({ items: [] });
            return;
        }

        const sequence = ++searchSequence;

        if (el.resultsStatus instanceof HTMLElement) {
            el.resultsStatus.textContent = 'Buscando…';
        }

        const params = new URLSearchParams();

        if (q !== '') {
            params.set('q', q);
        }

        if (categoria !== null) {
            params.set('categoria_id', String(categoria));
        }

        try {
            const data = await fetchApi(`/api/productos/buscar?${params.toString()}`);

            if (sequence !== searchSequence) {
                return;
            }

            setState({ items: Array.isArray(data) ? data : [], busqueda: q });
        } catch (error) {
            if (sequence !== searchSequence) {
                return;
            }

            setState({ items: [] });

            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo buscar productos.', 'error');
            }
        }
    }

    /* Categorías -------------------------------------------------------- */

    async function loadCategorias() {
        try {
            const data = await fetchApi('/api/categorias');
            categorias = Array.isArray(data) ? data : [];
            renderChips();
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast('No se pudieron cargar las categorías.', 'error');
            }
        }
    }

    function renderChips() {
        if (!(el.chips instanceof HTMLElement)) {
            return;
        }

        el.chips.replaceChildren();
        el.chips.append(crearChip('Todas', null));

        for (const categoria of categorias) {
            el.chips.append(crearChip(String(categoria.nombre), Number(categoria.id)));
        }
    }

    /**
     * @param {string} label
     * @param {number | null} id
     * @returns {HTMLButtonElement}
     */
    function crearChip(label, id) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip btn btn-sm flex-shrink-0';
        button.dataset.categoriaId = id === null ? '' : String(id);

        const icon = document.createElement('i');
        icon.className = `bi ${iconoCategoria(label)}`;
        icon.setAttribute('aria-hidden', 'true');

        button.append(icon, document.createTextNode(label));
        aplicarEstadoChip(button, state.categoria_activa === id);

        button.addEventListener('click', () => {
            state.categoria_activa = id;
            actualizarChips();

            if (state.busqueda !== '' || id !== null) {
                buscar();
            } else {
                setState({ items: [] });
            }
        });

        return button;
    }

    /**
     * @param {HTMLButtonElement} chip
     * @param {boolean} activo
     */
    function aplicarEstadoChip(chip, activo) {
        chip.classList.toggle('btn-primary', activo);
        chip.classList.toggle('btn-outline-secondary', !activo);
        chip.classList.toggle('is-active', activo);
    }

    function actualizarChips() {
        if (!(el.chips instanceof HTMLElement)) {
            return;
        }

        for (const chip of el.chips.querySelectorAll('.chip')) {
            if (!(chip instanceof HTMLElement)) {
                continue;
            }

            const raw = chip.dataset.categoriaId ?? '';
            const id = raw === '' ? null : Number(raw);
            aplicarEstadoChip(chip, id === state.categoria_activa);
        }
    }

    /* Frecuentes -------------------------------------------------------- */

    async function loadFrecuentes() {
        try {
            const data = await fetchApi('/api/productos/frecuentes');

            if (!Array.isArray(data) || data.length === 0) {
                if (el.frequentSection instanceof HTMLElement) {
                    el.frequentSection.hidden = true;
                }

                return;
            }

            if (el.frequentGrid instanceof HTMLElement) {
                el.frequentGrid.replaceChildren();

                for (const product of data) {
                    el.frequentGrid.append(crearFrecuente(product));
                }
            }

            if (el.frequentSection instanceof HTMLElement) {
                el.frequentSection.hidden = false;
            }
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                if (el.frequentSection instanceof HTMLElement) {
                    el.frequentSection.hidden = true;
                }
            }
        }
    }

    /**
     * @param {any} product
     * @returns {HTMLButtonElement}
     */
    function crearFrecuente(product) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'frequent-card btn btn-outline-secondary flex-shrink-0 d-flex align-items-center gap-2 text-start';
        button.dataset.productId = String(product.id ?? '');
        button.append(crearMiniatura(product, 'frequent-card__thumb'));

        const text = document.createElement('span');
        text.className = 'frequent-card__text';

        const name = document.createElement('span');
        name.className = 'frequent-card__name';
        name.textContent = String(product.nombre ?? '');

        const meta = document.createElement('span');
        meta.className = 'frequent-card__meta';
        meta.textContent = `Unidad: ${String(product.unidad_base ?? '')}`;

        text.append(name, meta);
        button.append(text);

        button.addEventListener('click', () => agregarAlCarrito(product));

        return button;
    }

    /* Resultados -------------------------------------------------------- */

    function renderResultados() {
        if (!(el.results instanceof HTMLElement)) {
            return;
        }

        const items = Array.isArray(state.items) ? state.items : [];
        el.results.replaceChildren();

        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'quick-empty col-12';

            if (state.busqueda !== '' || state.categoria_activa !== null) {
                empty.textContent = 'No encontramos productos con esa búsqueda.';
            } else {
                empty.textContent = 'Escribe un producto o elige una categoría para empezar.';
            }

            el.results.append(empty);

            if (el.resultsStatus instanceof HTMLElement) {
                if (state.busqueda !== '' || state.categoria_activa !== null) {
                    el.resultsStatus.textContent = 'Sin resultados.';
                } else {
                    el.resultsStatus.textContent = 'Escribe un producto o elige una categoría.';
                }
            }

            return;
        }

        const fragment = document.createDocumentFragment();

        for (const product of items) {
            fragment.append(crearResultado(product));
        }

        el.results.append(fragment);

        if (el.resultsStatus instanceof HTMLElement) {
            el.resultsStatus.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;
        }
    }

    /**
     * @param {any} product
     * @returns {HTMLElement}
     */
    function crearResultado(product) {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4';

        const card = document.createElement('div');
        card.className = 'card h-100 product-card result';
        card.dataset.productId = String(product.id ?? '');
        card.append(crearMediaResultado(product));

        const body = document.createElement('div');
        body.className = 'card-body d-flex flex-column gap-2';

        const name = document.createElement('h6');
        name.className = 'card-title result__name mb-0';
        name.textContent = String(product.nombre ?? '');

        const meta = document.createElement('p');
        meta.className = 'card-text small text-muted result__meta mb-0';
        meta.textContent = `${String(product.categoria_nombre ?? 'Sin categoría')} · Unidad: ${String(product.unidad_base ?? '')}`;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm btn-primary result__add';
        button.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i> Agregar';
        button.addEventListener('click', () => agregarAlCarrito(product));

        const calc = document.createElement('button');
        calc.type = 'button';
        calc.className = 'btn btn-sm btn-outline-primary result__calc';
        calc.innerHTML = '<i class="bi bi-calculator" aria-hidden="true"></i>';
        calc.setAttribute('aria-label', `Calcular compra de ${String(product.nombre ?? 'producto')}`);
        calc.title = 'Calcular por cantidad';
        calc.addEventListener('click', () => abrirCalculadora(product));

        const actions = document.createElement('div');
        actions.className = 'result__actions';
        actions.append(button, calc);

        body.append(name, meta, actions);
        card.append(body);
        col.append(card);

        return col;
    }

    /**
     * Imagen o placeholder superior de la card de resultado.
     *
     * @param {any} product
     * @returns {HTMLElement}
     */
    function crearMediaResultado(product) {
        const url = typeof product.imagen_url === 'string' ? product.imagen_url : '';
        const className = 'result__thumb card-img-top';

        if (url !== '' && isValidImageUrl(url)) {
            const image = document.createElement('img');
            image.className = className;
            image.src = url;
            image.alt = `Imagen de ${String(product.nombre ?? 'producto')}`;
            image.loading = 'lazy';

            return image;
        }

        const placeholder = document.createElement('div');
        placeholder.className = `${className} result__thumb--empty`;
        placeholder.textContent = String(product.nombre ?? '?').charAt(0).toUpperCase();

        return placeholder;
    }

    /**
     * @param {any} product
     * @param {string} className
     * @returns {HTMLElement}
     */
    function crearMiniatura(product, className) {
        const url = typeof product.imagen_url === 'string' ? product.imagen_url : '';

        if (url !== '' && isValidImageUrl(url)) {
            const image = document.createElement('img');
            image.className = className;
            image.src = url;
            image.alt = `Imagen de ${String(product.nombre ?? 'producto')}`;
            image.loading = 'lazy';
            image.width = 56;
            image.height = 56;

            return image;
        }

        const placeholder = document.createElement('span');
        placeholder.className = `${className} ${className}--empty`;
        placeholder.textContent = String(product.nombre ?? '?').charAt(0).toUpperCase();

        return placeholder;
    }

    /**
     * @param {any} product
     */
    function agregarAlCarrito(product) {
        if (!addProduct(product)) {
            showToast('El carrito alcanzó el límite de 100 ítems.', 'error');

            return;
        }

        render();
        showToast(`${String(product.nombre ?? 'Producto')} agregado. Edita cantidad y precio.`, 'success');
    }

    /* Calculadora ------------------------------------------------------- */

    /**
     * @param {any} product
     */
    function abrirCalculadora(product) {
        productoCalculo = product;

        const unidad = unidadDeProducto(product);
        const info = UNIDADES_INFO[unidad];
        const precioInput = el.modalCalc?.querySelector('[data-calc-precio]');
        const cantidadInput = el.modalCalc?.querySelector('[data-calc-cantidad]');
        const nombreSlot = el.modalCalc?.querySelector('[data-calc-producto]');
        const detalleSlot = el.modalCalc?.querySelector('[data-calc-detalle]');
        const labelSlot = el.modalCalc?.querySelector('[data-calc-precio-label]');
        const unidadSlot = el.modalCalc?.querySelector('[data-calc-unidad]');

        if (nombreSlot instanceof HTMLElement) {
            nombreSlot.textContent = String(product.nombre ?? 'Producto');
        }

        if (detalleSlot instanceof HTMLElement) {
            detalleSlot.textContent = `Unidad base: ${info.label} — ${info.nombre}`;
        }

        if (labelSlot instanceof HTMLElement) {
            labelSlot.textContent = `Costo por ${unidad === 'pza' ? 'pieza' : info.label}`;
        }

        if (unidadSlot instanceof HTMLElement) {
            unidadSlot.textContent = info.label;
        }

        if (precioInput instanceof HTMLInputElement) {
            const precioGuardado = leerPrecioUnidad(product.id);
            precioInput.value = precioGuardado === null ? '' : String(precioGuardado);
        }

        if (cantidadInput instanceof HTMLInputElement) {
            cantidadInput.value = '1';
        }

        limpiarError(el.modalCalc?.querySelector('[data-calc-error]'));
        actualizarCalculo();
        openModal(el.modalCalc);

        if (precioInput instanceof HTMLInputElement) {
            precioInput.focus();
            precioInput.select();
        }
    }

    function actualizarCalculo() {
        const precioInput = el.modalCalc?.querySelector('[data-calc-precio]');
        const cantidadInput = el.modalCalc?.querySelector('[data-calc-cantidad]');
        const totalSlot = el.modalCalc?.querySelector('[data-calc-total]');
        const formulaSlot = el.modalCalc?.querySelector('[data-calc-formula]');
        const precioRaw = precioInput instanceof HTMLInputElement ? precioInput.value.trim() : '';
        const cantidadRaw = cantidadInput instanceof HTMLInputElement ? cantidadInput.value.trim() : '';
        const precio = parseDecimal(precioRaw, 2);
        const cantidad = parseDecimal(cantidadRaw, 3);

        if (precio === null || cantidad === null || cantidad <= 0) {
            if (totalSlot instanceof HTMLElement) {
                totalSlot.textContent = '—';
            }

            if (formulaSlot instanceof HTMLElement) {
                formulaSlot.textContent = '';
            }

            return;
        }

        const importe = calcularImporte(precio, cantidad);

        if (totalSlot instanceof HTMLElement) {
            totalSlot.textContent = formatCurrency(importe);
        }

        if (formulaSlot instanceof HTMLElement) {
            const unidad = unidadDeProducto(productoCalculo);
            formulaSlot.textContent = `${formatCurrency(precio)} × ${formatQuantity(cantidad)} ${unidad} = ${formatCurrency(importe)}`;
        }
    }

    function bindCalcForm() {
        const form = el.modalCalc?.querySelector('[data-form-calc]');

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.querySelector('[data-calc-precio]')?.addEventListener('input', actualizarCalculo);
        form.querySelector('[data-calc-cantidad]')?.addEventListener('input', actualizarCalculo);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const errorSlot = el.modalCalc?.querySelector('[data-calc-error]');
            const precioInput = form.querySelector('[data-calc-precio]');
            const cantidadInput = form.querySelector('[data-calc-cantidad]');
            const precioRaw = precioInput instanceof HTMLInputElement ? precioInput.value.trim() : '';
            const cantidadRaw = cantidadInput instanceof HTMLInputElement ? cantidadInput.value.trim() : '';
            const precio = parseDecimal(precioRaw, 2);
            const cantidad = parseDecimal(cantidadRaw, 3);

            if (productoCalculo === null) {
                setError(errorSlot, 'Vuelve a abrir la calculadora desde una tarjeta de producto.');

                return;
            }

            if (precio === null || precio < 0) {
                setError(errorSlot, 'El costo por unidad debe ser mayor o igual a 0 (máximo 2 decimales).');

                return;
            }

            if (cantidad === null || cantidad <= 0) {
                setError(errorSlot, 'La cantidad comprada debe ser mayor que 0 (máximo 3 decimales).');

                return;
            }

            const importe = calcularImporte(precio, cantidad);
            const product = productoCalculo;

            if (!addProduct(product, { cantidad, precio_total: importe })) {
                setError(errorSlot, 'El carrito alcanzó el límite de 100 ítems.');

                return;
            }

            guardarPrecioUnidad(product.id, precio);

            const nombre = String(product.nombre ?? 'Producto');
            const unidad = unidadDeProducto(product);

            productoCalculo = null;
            closeModal(el.modalCalc);
            render();
            showToast(
                `${nombre} agregado: ${formatQuantity(cantidad)} ${unidad} por ${formatCurrency(importe)}.`,
                'success',
            );
        });
    }

    /* Carrito ----------------------------------------------------------- */

    function bindCart() {
        if (!(el.cartItems instanceof HTMLElement)) {
            return;
        }

        el.cartItems.addEventListener('focusin', (event) => {
            const target = event.target;

            if (target instanceof HTMLInputElement && target.matches('[data-cart-field]')) {
                target.select();
            }
        });

        el.cartItems.addEventListener('change', (event) => {
            const target = event.target;

            if (target instanceof HTMLInputElement && target.matches('[data-cart-field]')) {
                commitCampo(target);
            }
        });

        el.cartItems.addEventListener('keydown', (event) => {
            const target = event.target;

            if (!(target instanceof HTMLInputElement) || !target.matches('[data-cart-field]')) {
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                target.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                const index = Number(target.dataset.index);
                const field = target.dataset.cartField;
                const item = getItems()[index];

                if (item !== undefined) {
                    target.value = field === 'cantidad'
                        ? String(item.cantidad)
                        : Number(item.precio_total).toFixed(2);
                }

                target.blur();
            }
        });

        el.cartItems.addEventListener('click', (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const remove = target.closest('[data-remove]');

            if (remove instanceof HTMLElement) {
                const index = Number(remove.dataset.index);
                const item = getItems()[index];

                if (item === undefined) {
                    return;
                }

                if (window.confirm(`¿Quitar "${item.nombre}" del carrito?`)) {
                    removeItem(index);
                    render();
                    showToast('Ítem eliminado del carrito.', 'info');
                }
            }
        });

        if (el.save instanceof HTMLButtonElement) {
            el.save.addEventListener('click', abrirGuardar);
        }
    }

    /**
     * Valida y guarda el valor de un campo del carrito.
     *
     * @param {HTMLInputElement} input
     */
    function commitCampo(input) {
        const index = Number(input.dataset.index);
        const field = input.dataset.cartField;
        const item = getItems()[index];

        if (item === undefined || (field !== 'cantidad' && field !== 'precio_total')) {
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

            input.value = field === 'cantidad'
                ? String(item.cantidad)
                : Number(item.precio_total).toFixed(2);
            input.blur();

            return;
        }

        updateItem(index, { [field]: value });

        const actualizado = getItems()[index];

        if (actualizado !== undefined) {
            input.value = field === 'cantidad'
                ? String(actualizado.cantidad)
                : Number(actualizado.precio_total).toFixed(2);

            const tag = input.closest('.cart-item')?.querySelector('.cart-item__tag--cost');
            const costo = crearCostoUnitario(actualizado);

            if (tag instanceof HTMLElement) {
                if (costo === null) {
                    tag.remove();
                } else {
                    tag.replaceWith(costo);
                }
            }
        }

        actualizarResumenCarrito();
    }

    function actualizarResumenCarrito() {
        const n = cartCount();
        const totalLabel = formatCurrency(cartTotal());
        const countLabel = `${n} ${n === 1 ? 'ítem' : 'ítems'}`;

        if (el.cartCount instanceof HTMLElement) {
            el.cartCount.textContent = countLabel;
        }

        if (el.cartHeroCount instanceof HTMLElement) {
            el.cartHeroCount.textContent = countLabel;
        }

        if (el.cartTotal instanceof HTMLElement) {
            el.cartTotal.textContent = totalLabel;
        }

        if (el.cartHeroTotal instanceof HTMLElement) {
            el.cartHeroTotal.textContent = totalLabel;
        }

        if (el.cartEmpty instanceof HTMLElement) {
            el.cartEmpty.hidden = n > 0;
        }

        if (el.save instanceof HTMLButtonElement) {
            el.save.disabled = n === 0;
        }
    }

    function renderCart() {
        const items = getItems();

        actualizarResumenCarrito();

        if (!(el.cartItems instanceof HTMLElement)) {
            return;
        }

        el.cartItems.replaceChildren();

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'cart-item';

            const head = document.createElement('div');
            head.className = 'cart-item__head';

            const avatar = document.createElement('span');
            avatar.className = 'cart-item__avatar';
            avatar.title = item.categoria_nombre ?? 'Producto no catalogado';
            avatar.setAttribute('aria-hidden', 'true');

            const avatarIcon = document.createElement('i');
            avatarIcon.className = `bi ${item.categoria_nombre ? iconoCategoria(item.categoria_nombre) : 'bi-tag-fill'}`;
            avatarIcon.setAttribute('aria-hidden', 'true');
            avatar.append(avatarIcon);

            const info = document.createElement('div');
            info.className = 'cart-item__info';

            const name = document.createElement('p');
            name.className = 'cart-item__name';
            name.textContent = item.nombre;

            const meta = document.createElement('div');
            meta.className = 'cart-item__meta';

            const unitTag = document.createElement('span');
            unitTag.className = 'cart-item__tag';
            unitTag.textContent = `Unidad: ${item.unidad_base ?? 'pza'}`;
            meta.append(unitTag);

            const unitCost = crearCostoUnitario(item);

            if (unitCost !== null) {
                meta.append(unitCost);
            }

            info.append(name, meta);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'cart-item__remove';
            remove.dataset.remove = '';
            remove.dataset.index = String(index);
            remove.setAttribute('aria-label', `Quitar ${item.nombre} del carrito`);
            remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';

            head.append(avatar, info, remove);

            const controls = document.createElement('div');
            controls.className = 'cart-item__controls';

            controls.append(
                crearCampo('Cantidad', 'cantidad', item.cantidad, index, item.unidad_base ?? 'pza', ''),
                crearCampo('Precio total', 'precio_total', item.precio_total, index, item.unidad_base ?? 'pza', '$'),
            );

            li.append(head, controls);
            el.cartItems.append(li);
        });
    }

    /**
     * Costo unitario derivado del importe del ítem.
     *
     * @param {{cantidad: number, precio_total: number, unidad_base: string}} item
     * @returns {HTMLElement | null}
     */
    function crearCostoUnitario(item) {
        const cantidad = Number(item.cantidad);
        const precio = Number(item.precio_total);

        if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precio)) {
            return null;
        }

        const span = document.createElement('span');
        span.className = 'cart-item__tag cart-item__tag--cost';

        if (precio <= 0) {
            span.textContent = 'Precio pendiente';
            span.classList.add('is-pending');
        } else {
            span.textContent = `${formatCurrency(precio / cantidad)} por ${item.unidad_base ?? 'pza'}`;
        }

        return span;
    }

    /**
     * Campo numérico grande y siempre visible para editar el ítem.
     *
     * @param {string} label
     * @param {'cantidad' | 'precio_total'} field
     * @param {number} value
     * @param {number} index
     * @param {string} unit
     * @param {string} prefix
     * @returns {HTMLElement}
     */
    function crearCampo(label, field, value, index, unit, prefix) {
        const wrapper = document.createElement('label');
        wrapper.className = 'cart-item__field';

        const caption = document.createElement('span');
        caption.className = 'cart-item__caption';
        caption.textContent = label;

        const control = document.createElement('span');
        control.className = 'cart-item__control';

        if (prefix !== '') {
            const affix = document.createElement('span');
            affix.className = 'cart-item__affix';
            affix.textContent = prefix;
            control.append(affix);
        }

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'cart-item__input';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.value = field === 'cantidad'
            ? String(value)
            : Number(value).toFixed(2);
        input.step = field === 'cantidad' ? '0.001' : '0.01';
        input.min = field === 'cantidad' ? '0.001' : '0';
        input.dataset.cartField = field;
        input.dataset.index = String(index);

        control.append(input);

        if (field === 'cantidad') {
            const suffix = document.createElement('span');
            suffix.className = 'cart-item__affix cart-item__affix--unit';
            suffix.textContent = unit || 'pza';
            control.append(suffix);
        }

        wrapper.append(caption, control);

        return wrapper;
    }

    /* Modales ----------------------------------------------------------- */

    function bindModals() {
        root.querySelector('[data-libre-open]')?.addEventListener('click', () => {
            const form = el.modalLibre?.querySelector('[data-form-libre]');

            if (form instanceof HTMLFormElement) {
                form.reset();
            }

            limpiarError(el.modalLibre?.querySelector('[data-libre-error]'));
            openModal(el.modalLibre);
            el.modalLibre?.querySelector('[data-libre-nombre]')?.focus();
        });

        document.querySelector('[data-close-libre]')?.addEventListener('click', () => {
            closeModal(el.modalLibre);
        });

        document.querySelector('[data-close-calc]')?.addEventListener('click', () => {
            productoCalculo = null;
            closeModal(el.modalCalc);
        });

        document.querySelector('[data-close-fecha]')?.addEventListener('click', () => {
            closeModal(el.modalFecha);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            closeModal(el.modalLibre);
            closeModal(el.modalCalc);
            closeModal(el.modalFecha);
        });
    }

    function bindFreeForm() {
        const form = el.modalLibre?.querySelector('[data-form-libre]');

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const errorSlot = el.modalLibre?.querySelector('[data-libre-error]');
            const nombreInput = form.querySelector('[data-libre-nombre]');
            const unidadInput = form.querySelector('[data-libre-unidad]');
            const cantidadInput = form.querySelector('[data-libre-cantidad]');
            const precioInput = form.querySelector('[data-libre-precio]');

            const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
            const unidad = unidadInput instanceof HTMLSelectElement ? unidadInput.value : '';
            const cantidadRaw = cantidadInput instanceof HTMLInputElement ? cantidadInput.value.trim() : '';
            const precioRaw = precioInput instanceof HTMLInputElement ? precioInput.value.trim() : '';

            if (nombre.length < 2 || nombre.length > 150) {
                setError(errorSlot, 'El nombre debe tener entre 2 y 150 caracteres.');

                return;
            }

            if (!['kg', 'gr', 'L', 'ml', 'pza'].includes(unidad)) {
                setError(errorSlot, 'Selecciona una unidad base válida.');

                return;
            }

            const cantidad = parseDecimal(cantidadRaw, 3);

            if (cantidad === null || cantidad <= 0) {
                setError(errorSlot, 'La cantidad debe ser mayor que 0 (máximo 3 decimales).');

                return;
            }

            const precio = parseDecimal(precioRaw, 2);

            if (precio === null || precio < 0) {
                setError(errorSlot, 'El precio debe ser mayor o igual a 0 (máximo 2 decimales).');

                return;
            }

            if (!addFree({ nombre, unidad_base: unidad, cantidad, precio_total: precio })) {
                setError(errorSlot, 'El carrito alcanzó el límite de 100 ítems.');

                return;
            }

            // La sugerencia es adicional: no bloquea ni condiciona el carrito.
            void registrarSugerencia(nombre);

            closeModal(el.modalLibre);
            render();
            showToast(`${nombre} agregado al carrito.`, 'success');
        });
    }

    function bindContinuation() {
        el.modalContinuar?.querySelector('[data-continuar]')?.addEventListener('click', () => {
            closeModal(el.modalContinuar);
        });

        el.modalContinuar?.querySelector('[data-nueva]')?.addEventListener('click', () => {
            clearCart();
            render();
            closeModal(el.modalContinuar);
            showToast('Empezamos una compra nueva.', 'info');
        });
    }

    /* Guardar compra ---------------------------------------------------- */

    function abrirGuardar() {
        if (!hasItems()) {
            showToast('Agrega al menos un producto antes de guardar.', 'error');

            return;
        }

        const dateInput = el.modalFecha?.querySelector('[data-fecha]');
        const errorSlot = el.modalFecha?.querySelector('[data-fecha-error]');
        const today = todayISO();

        if (dateInput instanceof HTMLInputElement) {
            dateInput.value = today;
            dateInput.max = today;
            dateInput.min = subtractYearsISO(today, 2);
        }

        limpiarError(errorSlot);
        openModal(el.modalFecha);
        dateInput?.focus();
    }

    function bindDateForm() {
        const form = el.modalFecha?.querySelector('[data-form-fecha]');

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const dateInput = form.querySelector('[data-fecha]');
            const errorSlot = el.modalFecha?.querySelector('[data-fecha-error]');
            const submit = form.querySelector('[data-confirmar-fecha]');
            const fecha = dateInput instanceof HTMLInputElement ? dateInput.value.trim() : '';
            const today = todayISO();

            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                setError(errorSlot, 'Selecciona una fecha válida.');

                return;
            }

            if (fecha > today) {
                setError(errorSlot, 'La fecha no puede ser futura.');

                return;
            }

            if (fecha < subtractYearsISO(today, 2)) {
                setError(errorSlot, 'La fecha no puede ser anterior a 2 años.');

                return;
            }

            const items = getItems().map((item) => (
                item.producto_id !== null
                    ? {
                        producto_id: item.producto_id,
                        cantidad: item.cantidad,
                        precio_total: item.precio_total,
                    }
                    : {
                        nombre_libre: item.nombre,
                        unidad_base: item.unidad_base ?? 'pza',
                        cantidad: item.cantidad,
                        precio_total: item.precio_total,
                    }
            ));

            if (items.length === 0) {
                setError(errorSlot, 'El carrito está vacío.');

                return;
            }

            limpiarError(errorSlot);

            if (submit instanceof HTMLButtonElement) {
                submit.disabled = true;
                submit.textContent = 'Guardando…';
            }

            try {
                await fetchApi('/api/compras', {
                    method: 'POST',
                    body: { fecha, items },
                });

                clearCart();
                closeModal(el.modalFecha);
                render();
                showToast('Compra guardada.', 'success');

                window.setTimeout(() => {
                    window.location.assign('/historial?guardada=1');
                }, 900);
            } catch (error) {
                if (submit instanceof HTMLButtonElement) {
                    submit.disabled = false;
                    submit.textContent = 'Guardar compra';
                }

                if (redirectIfSessionLost(error)) {
                    return;
                }

                setError(errorSlot, error?.message ?? 'No se pudo guardar la compra.');
                showToast(error?.message ?? 'No se pudo guardar la compra.', 'error');
            }
        });
    }

    /* Utilidades -------------------------------------------------------- */

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

    function showSavedToastIfNeeded() {
        const params = new URLSearchParams(window.location.search);

        if (params.get('guardada') !== '1') {
            return;
        }

        showToast('Compra guardada. El carrito está listo para la siguiente.', 'success');
        params.delete('guardada');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query === '' ? '' : `?${query}`}`);
    }
}

/**
 * @param {HTMLElement | null} [element]
 */
function openModal(element) {
    if (element instanceof HTMLElement) {
        element.hidden = false;
    }
}

/**
 * @param {HTMLElement | null} [element]
 */
function closeModal(element) {
    if (element instanceof HTMLElement) {
        element.hidden = true;
    }
}

/**
 * @param {Element | null | undefined} slot
 * @param {string} message
 */
function setError(slot, message) {
    if (slot instanceof HTMLElement) {
        slot.textContent = message;
        slot.hidden = false;
    }
}

/**
 * @param {Element | null | undefined} slot
 */
function limpiarError(slot) {
    if (slot instanceof HTMLElement) {
        slot.textContent = '';
        slot.hidden = true;
    }
}

/**
 * Registra una sugerencia en segundo plano. Un fallo no afecta al carrito:
 * solo se deja constancia en la consola.
 *
 * @param {string} nombre
 * @returns {Promise<void>}
 */
async function registrarSugerencia(nombre) {
    try {
        await fetchApi('/api/sugerencias', {
            method: 'POST',
            body: { nombre },
        });
    } catch (error) {
        console.warn('No se pudo registrar la sugerencia del producto libre.', error);
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

/**
 * @param {any} product
 * @returns {'kg' | 'gr' | 'L' | 'ml' | 'pza'}
 */
function unidadDeProducto(product) {
    const unidad = String(product?.unidad_base ?? '');

    return Object.hasOwn(UNIDADES_INFO, unidad) ? unidad : 'pza';
}

/**
 * Importe de la compra redondeado a centavos.
 *
 * @param {number} precio
 * @param {number} cantidad
 * @returns {number}
 */
function calcularImporte(precio, cantidad) {
    return Math.round((precio * cantidad + Number.EPSILON) * 100) / 100;
}
