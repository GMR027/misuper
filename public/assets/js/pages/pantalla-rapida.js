/**
 * Pantalla rápida: búsqueda, frecuentes, carrito y guardado de la compra.
 */

import { fetchApi } from '../modules/api.js';
import { confirmar } from '../modules/confirm.js';
import {
    addProduct,
    clearCart,
    importItems,
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
    formatDate,
    formatQuantity,
    subtractYearsISO,
    todayISO,
} from '../modules/format.js';
import { iconoCategoria } from '../modules/categorias.js';
import { guardarPrecioUnidad, leerPrecioUnidad, redondearImporte } from '../modules/precios.js';
import { registerRenderer, render, setState, state } from '../modules/state.js';
import { showToast } from '../modules/toast.js';

const UNIDADES_INFO = {
    kg: { label: 'kg', nombre: 'kilogramo' },
    gr: { label: 'gr', nombre: 'gramo' },
    L: { label: 'L', nombre: 'litro' },
    ml: { label: 'ml', nombre: 'mililitro' },
    pza: { label: 'pza', nombre: 'pieza' },
};

const VISTA_KEY = 'misuper:resultados-vista';

const root = document.querySelector('[data-quick]');

if (root instanceof HTMLElement) {
    void init(root);
}

/**
 * @param {HTMLElement} root
 */
async function init(root) {
    const el = {
        searchForm: root.querySelector('[data-search-form]'),
        search: root.querySelector('[data-buscador]'),
        chips: root.querySelector('[data-categorias]'),
        chipsSheet: root.querySelector('[data-categorias-sheet-grid]'),
        results: root.querySelector('[data-resultados]'),
        resultsStatus: root.querySelector('[data-resultados-status]'),
        toggleVista: root.querySelector('[data-toggle-vista]'),
        vistaIcon: root.querySelector('[data-vista-icon]'),
        frequentSection: root.querySelector('[data-frecuentes]'),
        frequentGrid: root.querySelector('[data-frecuentes-grid]'),
        cartItems: root.querySelector('[data-carrito-items]'),
        cartCounts: Array.from(root.querySelectorAll('[data-carrito-count]')),
        cartHeroCounts: Array.from(root.querySelectorAll('[data-carrito-hero-count]')),
        cartTotals: Array.from(root.querySelectorAll('[data-carrito-total]')),
        cartHeroTotals: Array.from(root.querySelectorAll('[data-carrito-hero-total]')),
        cartEmpty: root.querySelector('[data-carrito-vacio]'),
        save: root.querySelector('[data-guardar]'),
        cartSheet: root.querySelector('[data-cart-sheet]'),
        cartClose: root.querySelector('[data-cart-close]'),
        cartBackdrop: document.querySelector('[data-cart-backdrop]'),
        categoriasSheet: document.querySelector('[data-categorias-sheet]'),
        categoriasBackdrop: document.querySelector('[data-categorias-backdrop]'),
        categoriasClose: document.querySelector('[data-categorias-close]'),
        modalContinuar: document.querySelector('[data-modal-continuar]'),
        modalLibre: document.querySelector('[data-modal-libre]'),
        modalCalc: document.querySelector('[data-modal-calc]'),
        modalFecha: document.querySelector('[data-modal-fecha]'),
        calcHint: document.querySelector('[data-calc-precio-hint]'),
        comercio: document.querySelector('[data-comercio]'),
        comercios: document.querySelector('[data-comercios]'),
    };

    let categorias = [];
    /** @type {any[]|null} */
    let frecuentesCache = null;
    let searchTimer = null;
    let searchSequence = 0;
    let productoCalculo = null;
    let comerciosCargados = false;
    let vistaLista = leerVistaLista();
    /** @type {HTMLElement|null} */
    let ultimoFoco = null;

    loadCart();
    await importarListaSiAplica();

    registerRenderer(renderResultados);
    registerRenderer(renderCart);

    aplicarVista(vistaLista);

    // El buscador de la barra inferior también agrega productos al carrito.
    window.addEventListener('misuper:cart-changed', () => {
        loadCart();
        render();
    });

    bindLogout();
    bindSearch();
    bindSheets();
    bindVista();
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

    /* Vista de resultados ----------------------------------------------- */

    function bindVista() {
        if (!(el.toggleVista instanceof HTMLButtonElement)) {
            return;
        }

        el.toggleVista.addEventListener('click', () => {
            vistaLista = !vistaLista;
            aplicarVista(vistaLista);
            guardarVistaLista(vistaLista);
        });
    }

    /**
     * @param {boolean} lista
     */
    function aplicarVista(lista) {
        if (el.results instanceof HTMLElement) {
            el.results.classList.toggle('results--list', lista);
        }

        if (el.toggleVista instanceof HTMLButtonElement) {
            el.toggleVista.setAttribute('aria-pressed', lista ? 'true' : 'false');
            el.toggleVista.setAttribute('aria-label', lista ? 'Ver productos en cuadrícula' : 'Ver productos en lista');
            el.toggleVista.title = lista ? 'Ver productos en cuadrícula' : 'Ver productos en lista';
        }

        if (el.vistaIcon instanceof HTMLElement) {
            el.vistaIcon.className = `bi ${lista ? 'bi-grid-3x3-gap-fill' : 'bi-list-ul'}`;
        }
    }

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

    function bindSheets() {
        root.querySelector('[data-quick-menu]')?.addEventListener('click', () => {
            const menu = document.querySelector('[data-dock-menu]');

            if (menu instanceof HTMLElement) {
                menu.click();
            }
        });

        const abrirSheet = (sheet, backdrop, trigger) => {
            if (!(sheet instanceof HTMLElement) || !(backdrop instanceof HTMLElement)) {
                return;
            }

            ultimoFoco = trigger instanceof HTMLElement ? trigger : null;
            backdrop.hidden = false;
            sheet.hidden = false;
            document.body.classList.add('quick-sheet-open');

            const focusable = sheet.querySelector('button, input, select, textarea, a[href]');

            if (focusable instanceof HTMLElement) {
                focusable.focus();
            }
        };

        const cerrarSheet = (sheet, backdrop) => {
            if (sheet instanceof HTMLElement) {
                sheet.hidden = true;
            }

            if (backdrop instanceof HTMLElement) {
                backdrop.hidden = true;
            }

            document.body.classList.remove('quick-sheet-open');

            if (ultimoFoco instanceof HTMLElement) {
                ultimoFoco.focus();
            }
        };

        const abrirCarrito = (trigger) => {
            if (!(el.cartSheet instanceof HTMLElement) || !(el.cartBackdrop instanceof HTMLElement)) {
                return;
            }

            const esCelularHorizontal = window.matchMedia('(orientation: landscape) and (max-width: 767.98px)').matches;

            if (!esCelularHorizontal) {
                el.cartSheet.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }

            ultimoFoco = trigger instanceof HTMLElement ? trigger : null;
            el.cartSheet.classList.add('is-open');
            el.cartBackdrop.hidden = false;
            document.body.classList.add('quick-sheet-open');
            el.cartClose?.focus();
        };

        const cerrarCarrito = () => {
            if (el.cartSheet instanceof HTMLElement) {
                el.cartSheet.classList.remove('is-open');
            }

            if (el.cartBackdrop instanceof HTMLElement) {
                el.cartBackdrop.hidden = true;
            }

            document.body.classList.remove('quick-sheet-open');

            if (ultimoFoco instanceof HTMLElement) {
                ultimoFoco.focus();
            }
        };

        root.querySelectorAll('[data-cart-open]').forEach((button) => {
            button.addEventListener('click', () => abrirCarrito(button));
        });

        el.cartClose?.addEventListener('click', cerrarCarrito);
        el.cartBackdrop?.addEventListener('click', cerrarCarrito);

        root.querySelector('[data-categorias-open]')?.addEventListener('click', (event) => {
            abrirSheet(
                el.categoriasSheet,
                el.categoriasBackdrop,
                event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
            );
        });

        el.categoriasClose?.addEventListener('click', () => {
            cerrarSheet(el.categoriasSheet, el.categoriasBackdrop);
        });

        el.categoriasBackdrop?.addEventListener('click', () => {
            cerrarSheet(el.categoriasSheet, el.categoriasBackdrop);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (el.cartSheet instanceof HTMLElement && el.cartSheet.classList.contains('is-open')) {
                cerrarCarrito();
            }

            if (el.categoriasSheet instanceof HTMLElement && !el.categoriasSheet.hidden) {
                cerrarSheet(el.categoriasSheet, el.categoriasBackdrop);
            }
        });
    }

    async function buscar() {
        if (!(el.search instanceof HTMLInputElement)) {
            return;
        }

        const q = el.search.value.trim();
        const categoria = state.categoria_activa;
        state.busqueda = q;

        if (state.frecuentes_activo) {
            state.frecuentes_activo = false;
            actualizarChips();
        }

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
        for (const contenedor of [el.chips, el.chipsSheet]) {
            if (!(contenedor instanceof HTMLElement)) {
                continue;
            }

            contenedor.replaceChildren();
            contenedor.append(crearChipFrecuentes());
            contenedor.append(crearChip('Todas', null));

            for (const categoria of categorias) {
                contenedor.append(crearChip(String(categoria.nombre), Number(categoria.id)));
            }
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
        aplicarEstadoChip(button, !state.frecuentes_activo && state.categoria_activa === id);

        button.addEventListener('click', () => {
            state.categoria_activa = id;
            state.frecuentes_activo = false;
            actualizarChips();

            if (state.busqueda !== '' || id !== null) {
                buscar();
            } else {
                setState({ items: [] });
            }

            cerrarSheetCategorias();
        });

        return button;
    }

    /**
     * Chip que muestra las compras frecuentes dentro de la cuadrícula.
     *
     * @returns {HTMLButtonElement}
     */
    function crearChipFrecuentes() {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip--frecuentes btn btn-sm flex-shrink-0';
        button.dataset.frecuentesChip = '';

        const icon = document.createElement('i');
        icon.className = 'bi bi-stars';
        icon.setAttribute('aria-hidden', 'true');

        button.append(icon, document.createTextNode('Frecuentes'));
        aplicarEstadoChip(button, state.frecuentes_activo);

        button.addEventListener('click', () => {
            void activarFrecuentes();
        });

        return button;
    }

    function cerrarSheetCategorias() {
        if (el.categoriasSheet instanceof HTMLElement) {
            el.categoriasSheet.hidden = true;
        }

        if (el.categoriasBackdrop instanceof HTMLElement) {
            el.categoriasBackdrop.hidden = true;
        }

        document.body.classList.remove('quick-sheet-open');
    }

    async function activarFrecuentes() {
        state.frecuentes_activo = true;
        state.categoria_activa = null;
        state.busqueda = '';

        if (el.search instanceof HTMLInputElement) {
            el.search.value = '';
        }

        actualizarChips();
        cerrarSheetCategorias();

        if (frecuentesCache === null) {
            try {
                const data = await fetchApi('/api/productos/frecuentes');
                frecuentesCache = Array.isArray(data) ? data : [];
            } catch (error) {
                frecuentesCache = [];

                if (!redirectIfSessionLost(error)) {
                    showToast('No se pudieron cargar las compras frecuentes.', 'error');
                }
            }
        }

        setState({ items: frecuentesCache, categoria_activa: null, busqueda: '', frecuentes_activo: true });

        if (el.resultsStatus instanceof HTMLElement) {
            const total = frecuentesCache.length;
            el.resultsStatus.textContent = total === 0
                ? 'Aún no hay compras frecuentes.'
                : `${total} ${total === 1 ? 'producto frecuente' : 'productos frecuentes'}`;
        }
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
        for (const contenedor of [el.chips, el.chipsSheet]) {
            if (!(contenedor instanceof HTMLElement)) {
                continue;
            }

            for (const chip of contenedor.querySelectorAll('.chip')) {
                if (!(chip instanceof HTMLElement)) {
                    continue;
                }

                if (chip.hasAttribute('data-frecuentes-chip')) {
                    aplicarEstadoChip(chip, state.frecuentes_activo);
                    continue;
                }

                const raw = chip.dataset.categoriaId ?? '';
                const id = raw === '' ? null : Number(raw);
                aplicarEstadoChip(chip, !state.frecuentes_activo && id === state.categoria_activa);
            }
        }
    }

    /* Frecuentes -------------------------------------------------------- */

    async function loadFrecuentes() {
        try {
            const data = await fetchApi('/api/productos/frecuentes');
            frecuentesCache = Array.isArray(data) ? data : [];

            if (frecuentesCache.length === 0) {
                if (el.frequentSection instanceof HTMLElement) {
                    el.frequentSection.hidden = true;
                }

                return;
            }

            if (el.frequentGrid instanceof HTMLElement) {
                el.frequentGrid.replaceChildren();

                for (const product of frecuentesCache) {
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

        if (document.activeElement instanceof HTMLElement && el.results.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        el.results.replaceChildren();

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'quick-empty col-12';

            if (state.frecuentes_activo) {
                empty.textContent = 'Aún no tienes compras frecuentes. Agrega productos y vuelve a revisar.';
            } else if (state.busqueda !== '' || state.categoria_activa !== null) {
                const texto = document.createElement('p');
                texto.className = 'mb-3';
                texto.textContent = 'No encontramos productos con esa búsqueda.';

                const cta = document.createElement('button');
                cta.type = 'button';
                cta.className = 'btn btn-primary';
                cta.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i> Registrar nuevo producto';
                cta.addEventListener('click', () => {
                    abrirNuevoProducto(state.busqueda);
                });

                empty.append(texto, cta);
            } else {
                empty.textContent = 'Escribe un producto o elige una categoría para empezar.';
            }

            el.results.append(empty);

            if (el.resultsStatus instanceof HTMLElement) {
                if (state.frecuentes_activo) {
                    el.resultsStatus.textContent = 'Sin frecuentes.';
                } else if (state.busqueda !== '' || state.categoria_activa !== null) {
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
            const singular = items.length === 1;
            el.resultsStatus.textContent = state.frecuentes_activo
                ? `${items.length} ${singular ? 'producto frecuente' : 'productos frecuentes'}`
                : `${items.length} ${singular ? 'producto' : 'productos'}`;
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

        if (el.calcHint instanceof HTMLElement) {
            el.calcHint.textContent = textoPrecioSugerido(product);
        }

        if (precioInput instanceof HTMLInputElement) {
            const precioServidor = product?.ultimo_precio;
            const precioGuardado = typeof precioServidor === 'number'
                && Number.isFinite(precioServidor)
                && precioServidor > 0
                ? redondearImporte(precioServidor)
                : leerPrecioUnidad(product.id);

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

        el.cartItems.addEventListener('click', async (event) => {
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

                const confirmado = await confirmar({
                    title: 'Quitar del carrito',
                    message: `«${item.nombre}» dejará de formar parte de esta compra.`,
                    confirmText: 'Quitar',
                });

                if (confirmado) {
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

        for (const slot of el.cartCounts) {
            if (slot instanceof HTMLElement) {
                slot.textContent = countLabel;
            }
        }

        for (const slot of el.cartHeroCounts) {
            if (slot instanceof HTMLElement) {
                slot.textContent = countLabel;
            }
        }

        for (const slot of el.cartTotals) {
            if (slot instanceof HTMLElement) {
                slot.textContent = totalLabel;
            }
        }

        for (const slot of el.cartHeroTotals) {
            if (slot instanceof HTMLElement) {
                slot.textContent = totalLabel;
            }
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
        root.querySelectorAll('[data-libre-open]').forEach((button) => {
            button.addEventListener('click', () => {
                abrirNuevoProducto('');
            });
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
            closeModal(el.modalContinuar);
        });
    }

    /**
     * Abre el modal de alta de producto propio, opcionalmente con el nombre
     * buscado y la categoría activa.
     *
     * @param {string} nombre
     */
    function abrirNuevoProducto(nombre) {
        const form = el.modalLibre?.querySelector('[data-form-libre]');

        if (form instanceof HTMLFormElement) {
            form.reset();
        }

        poblarCategoriasModal();

        const nombreInput = el.modalLibre?.querySelector('[data-libre-nombre]');
        const categoriaInput = el.modalLibre?.querySelector('[data-libre-categoria]');

        if (nombreInput instanceof HTMLInputElement && nombre !== '') {
            nombreInput.value = nombre;
        }

        if (categoriaInput instanceof HTMLSelectElement && state.categoria_activa !== null) {
            categoriaInput.value = String(state.categoria_activa);
        }

        limpiarError(el.modalLibre?.querySelector('[data-libre-error]'));
        openModal(el.modalLibre);

        if (nombreInput instanceof HTMLInputElement) {
            nombreInput.focus();
            nombreInput.select();
        }
    }

    function poblarCategoriasModal() {
        const select = el.modalLibre?.querySelector('[data-libre-categoria]');

        if (!(select instanceof HTMLSelectElement)) {
            return;
        }

        const anterior = select.value;
        select.replaceChildren(new Option('Elige categoría', ''));

        for (const categoria of categorias) {
            select.append(new Option(String(categoria.nombre), String(categoria.id)));
        }

        if (state.categoria_activa !== null) {
            select.value = String(state.categoria_activa);
        } else if (anterior !== '') {
            select.value = anterior;
        }
    }

    function bindFreeForm() {
        const form = el.modalLibre?.querySelector('[data-form-libre]');

        if (!(form instanceof HTMLFormElement)) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const errorSlot = el.modalLibre?.querySelector('[data-libre-error]');
            const nombreInput = form.querySelector('[data-libre-nombre]');
            const categoriaInput = form.querySelector('[data-libre-categoria]');
            const unidadInput = form.querySelector('[data-libre-unidad]');
            const cantidadInput = form.querySelector('[data-libre-cantidad]');
            const precioInput = form.querySelector('[data-libre-precio]');
            const submit = form.querySelector('button[type="submit"]');

            const nombre = nombreInput instanceof HTMLInputElement ? nombreInput.value.trim() : '';
            const categoria = categoriaInput instanceof HTMLSelectElement ? categoriaInput.value : '';
            const unidad = unidadInput instanceof HTMLSelectElement ? unidadInput.value : '';
            const cantidadRaw = cantidadInput instanceof HTMLInputElement ? cantidadInput.value.trim() : '';
            const precioRaw = precioInput instanceof HTMLInputElement ? precioInput.value.trim() : '';

            if (nombre.length < 2 || nombre.length > 150) {
                setError(errorSlot, 'El nombre debe tener entre 2 y 150 caracteres.');

                return;
            }

            if (categoria === '' || !/^[1-9][0-9]*$/.test(categoria)) {
                setError(errorSlot, 'Selecciona una categoría.');

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

            limpiarError(errorSlot);

            if (submit instanceof HTMLButtonElement) {
                submit.disabled = true;
                submit.textContent = 'Registrando…';
            }

            try {
                const producto = await fetchApi('/api/productos', {
                    method: 'POST',
                    body: {
                        nombre,
                        categoria_id: Number(categoria),
                        unidad_base: unidad,
                    },
                });

                if (!addProduct(producto, { cantidad, precio_total: precio })) {
                    setError(errorSlot, 'El carrito alcanzó el límite de 100 ítems.');

                    return;
                }

                closeModal(el.modalLibre);
                render();
                showToast(`${nombre} registrado y agregado al carrito.`, 'success');
                void buscar();
            } catch (error) {
                if (redirectIfSessionLost(error)) {
                    return;
                }

                const detalle = error?.data && typeof error.data === 'object'
                    ? Object.values(error.data)[0]
                    : null;

                setError(
                    errorSlot,
                    typeof detalle === 'string'
                        ? detalle
                        : error?.message ?? 'No se pudo registrar el producto.',
                );
            } finally {
                if (submit instanceof HTMLButtonElement) {
                    submit.disabled = false;
                    submit.textContent = 'Registrar y agregar';
                }
            }
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

        cargarComercios();

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

    async function cargarComercios() {
        if (comerciosCargados || !(el.comercios instanceof HTMLElement)) {
            return;
        }

        try {
            const data = await fetchApi('/api/precios/comercios');
            const items = Array.isArray(data?.items) ? data.items : [];

            el.comercios.replaceChildren();

            for (const comercio of items) {
                const option = document.createElement('option');
                option.value = String(comercio);
                el.comercios.append(option);
            }

            comerciosCargados = true;
        } catch {
            // Sin sugerencias el campo sigue funcionando como texto libre.
        }
    }

    function textoPrecioSugerido(product) {
        const precio = Number(product?.ultimo_precio);
        const muestras = Number(product?.precio_muestras ?? 0);
        const origen = String(product?.precio_origen ?? '');
        const fecha = String(product?.precio_fecha ?? '');

        if (!Number.isFinite(precio) || precio <= 0) {
            return 'Sin precio registrado. Escríbelo para calcular el importe.';
        }

        if (origen === 'manual') {
            return 'Precio manual guardado para este producto.';
        }

        const base = `Sugerido con ${muestras} ${muestras === 1 ? 'compra reciente' : 'compras recientes'}`;
        const cuando = fecha !== '' ? ` · último ${formatDate(fecha)}` : '';

        return `${base}${cuando}${product?.precio_viejo ? ' · precio viejo' : ''}.`;
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
                        unidad_base: item.unidad_base ?? 'pza',
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
            const comercioInput = form.querySelector('[data-comercio]');
            const comercio = comercioInput instanceof HTMLInputElement
                ? comercioInput.value.trim()
                : '';

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
                    body: { fecha, comercio, items },
                });

                clearCart();
                closeModal(el.modalFecha);
                if (comercioInput instanceof HTMLInputElement) {
                    comercioInput.value = '';
                }

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

    async function importarListaSiAplica() {
        const params = new URLSearchParams(window.location.search);

        if (params.get('lista') !== '1') {
            return;
        }

        try {
            const data = await fetchApi('/api/lista-compras/consumir', { method: 'POST' });
            const items = Array.isArray(data?.items) ? data.items : [];

            if (items.length > 0) {
                const importados = importItems(items);
                loadCart();
                showToast(
                    `Se agregaron ${importados} ${importados === 1 ? 'producto' : 'productos'} de tu lista. Asigna precios y cantidades.`,
                    'success',
                );
            }
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo cargar la lista de compras.', 'error');
            }
        } finally {
            params.delete('lista');
            const query = params.toString();
            window.history.replaceState({}, '', `${window.location.pathname}${query === '' ? '' : `?${query}`}`);
        }
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
 * @returns {boolean}
 */
function leerVistaLista() {
    try {
        return window.localStorage.getItem(VISTA_KEY) === 'lista';
    } catch {
        return false;
    }
}

/**
 * @param {boolean} lista
 */
function guardarVistaLista(lista) {
    try {
        window.localStorage.setItem(VISTA_KEY, lista ? 'lista' : 'cuadricula');
    } catch {
        // Si el navegador bloquea localStorage, la vista solo dura la sesión.
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
