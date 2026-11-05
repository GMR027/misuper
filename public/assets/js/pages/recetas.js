/**
 * Recetario: filtros, detalle con porciones, selección y lista de compras.
 */

import { fetchApi } from '../modules/api.js';
import { formatCurrency, formatQuantity } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const root = document.querySelector('[data-recetas]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        buscar: root.querySelector('[data-receta-buscar]'),
        tiempo: root.querySelector('[data-receta-tiempo]'),
        solo: root.querySelector('[data-receta-solo]'),
        favoritas: root.querySelector('[data-receta-favoritas]'),
        categorias: root.querySelector('[data-receta-categorias]'),
        tipos: root.querySelector('[data-receta-tipos]'),
        tipoAviso: root.querySelector('[data-receta-tipo-aviso]'),
        despensa: root.querySelector('[data-recetas-despensa]'),
        status: root.querySelector('[data-recetas-status]'),
        grid: root.querySelector('[data-recetas-grid]'),
        paginacion: root.querySelector('[data-recetas-paginacion]'),
        paginas: root.querySelector('[data-recetas-paginas]'),
        empty: root.querySelector('[data-recetas-empty]'),
        listaCount: root.querySelector('[data-lista-count]'),
        seleccion: root.querySelector('[data-seleccion]'),
        seleccionCount: root.querySelector('[data-seleccion-count]'),
        seleccionItems: root.querySelector('[data-seleccion-items]'),
        seleccionLimpiar: root.querySelector('[data-seleccion-limpiar]'),
        preview: root.querySelector('[data-preview]'),
        detalleModal: document.querySelector('[data-receta-modal]'),
        detalleTitulo: document.querySelector('[data-receta-detalle-title]'),
        detalleBody: document.querySelector('[data-receta-detalle-body]'),
        detalleFooter: document.querySelector('[data-receta-detalle-footer]'),
        previewModal: document.querySelector('[data-preview-modal]'),
        previewResumen: document.querySelector('[data-preview-resumen]'),
        previewStatus: document.querySelector('[data-preview-status]'),
        previewItems: document.querySelector('[data-preview-items]'),
        previewGuardar: document.querySelector('[data-preview-guardar]'),
        previewLista: document.querySelector('[data-preview-lista]'),
        previewNueva: document.querySelector('[data-preview-nueva]'),
    };

    const POR_PAGINA = 20;
    /** @type {Array<any>} */
    let recetas = [];
    let paginaActual = 1;
    /** @type {Array<any>} */
    let tipos = [];
    /** @type {Array<any>} */
    let categorias = [];
    /** @type {Map<string, {slug: string, nombre: string, porciones: number, porciones_base: number}>} */
    const seleccion = new Map();
    /** @type {any|null} */
    let detalleActual = null;
    let detallePorciones = 4;
    let tipoActivo = '';
    let categoriaActiva = '';
    let soloFavoritas = false;
    let chipsListos = false;
    let searchTimer = null;
    /** @type {Array<any>} */
    let previewItems = [];

    bind();
    cargar();

    /* Eventos ----------------------------------------------------------- */

    function bind() {
        el.buscar?.addEventListener('input', () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(cargar, 300);
        });

        el.tiempo?.addEventListener('change', cargar);
        el.solo?.addEventListener('change', cargar);
        el.favoritas?.addEventListener('change', () => {
            soloFavoritas = el.favoritas instanceof HTMLInputElement ? el.favoritas.checked : false;
            cargar();
        });

        el.seleccionLimpiar?.addEventListener('click', () => {
            seleccion.clear();
            renderSeleccion();
            actualizarBotonesSeleccion();
        });

        el.preview?.addEventListener('click', abrirPreview);

        document.querySelectorAll('[data-receta-cerrar]').forEach((button) => {
            button.addEventListener('click', () => cerrarModal(el.detalleModal));
        });

        document.querySelectorAll('[data-preview-cerrar]').forEach((button) => {
            button.addEventListener('click', () => cerrarModal(el.previewModal));
        });

        el.previewGuardar?.addEventListener('click', guardarPreview);
        el.previewLista?.addEventListener('change', actualizarNuevaLista);

        document.querySelectorAll('[data-receta-modal], [data-preview-modal]').forEach((modal) => {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    cerrarModal(modal);
                }
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            const abierto = [el.previewModal, el.detalleModal].find(
                (modal) => modal instanceof HTMLElement && !modal.hidden,
            );

            if (abierto instanceof HTMLElement) {
                cerrarModal(abierto);
            }
        });
    }

    /* Carga y filtros --------------------------------------------------- */

    async function cargar() {
        const params = new URLSearchParams();

        if (el.buscar instanceof HTMLInputElement && el.buscar.value.trim() !== '') {
            params.set('q', el.buscar.value.trim());
        }

        if (categoriaActiva !== '') {
            params.set('categoria', categoriaActiva);
        }

        if (tipoActivo !== '') {
            params.set('tipo', tipoActivo);
        }

        if (el.tiempo instanceof HTMLSelectElement && el.tiempo.value !== '') {
            params.set('tiempo', el.tiempo.value);
        }

        if (el.solo instanceof HTMLInputElement && el.solo.checked) {
            params.set('solo_despensa', '1');
        }

        if (soloFavoritas) {
            params.set('favoritas', '1');
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando recetas…';
        }

        try {
            const data = await fetchApi(`/api/recetas?${params.toString()}`);
            recetas = Array.isArray(data?.items) ? data.items : [];
            paginaActual = 1;
            tipos = Array.isArray(data?.tipos) ? data.tipos : [];
            categorias = Array.isArray(data?.categorias) ? data.categorias : [];

            if (!chipsListos) {
                renderCategorias();
                renderChips();
                chipsListos = true;
            }

            renderRecetas();
            renderAviso();

            if (el.despensa instanceof HTMLElement) {
                const total = Number(data?.despensa?.total_productos ?? 0);
                const fecha = formatearFecha(data?.despensa?.fecha);

                if (total > 0) {
                    el.despensa.textContent = `Basado en tu última compra${fecha !== '' ? ` del ${fecha}` : ''} (${total} ${total === 1 ? 'producto' : 'productos'}).`;
                } else if (fecha !== '') {
                    el.despensa.textContent = `Tu última compra${fecha !== '' ? ` del ${fecha}` : ''} no tiene productos de despensa.`;
                } else {
                    el.despensa.textContent = 'Aún no tienes compras registradas; guarda una compra para usar este filtro.';
                }
            }

            // El estado y la paginación se actualizan en renderRecetas().
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'No se pudieron cargar las recetas.';
            }

            showToast(error?.message ?? 'No se pudieron cargar las recetas.', 'error');
        }
    }

    function renderCategorias() {
        if (!(el.categorias instanceof HTMLElement)) {
            return;
        }

        el.categorias.replaceChildren();
        el.categorias.append(crearChipCategoria('Todas', '', 'bi-grid-3x3-gap'));

        for (const categoria of categorias) {
            el.categorias.append(crearChipCategoria(
                String(categoria.nombre ?? categoria.slug),
                String(categoria.slug),
                String(categoria.icono ?? 'bi-tag')
            ));
        }
    }

    function renderChips() {
        if (!(el.tipos instanceof HTMLElement)) {
            return;
        }

        el.tipos.replaceChildren();
        el.tipos.append(crearChip('Todos', '', 'bi-grid-3x3-gap'));

        for (const tipo of tipos) {
            el.tipos.append(crearChip(String(tipo.nombre ?? tipo.slug), String(tipo.slug), String(tipo.icono ?? 'bi-tag')));
        }
    }

    /**
     * @param {string} label
     * @param {string} slug
     * @param {string} icono
     * @returns {HTMLButtonElement}
     */
    function crearChipCategoria(label, slug, icono) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'recipe-type-chip';
        button.dataset.categoria = slug;

        const icon = document.createElement('i');
        icon.className = `bi ${icono}`;
        icon.setAttribute('aria-hidden', 'true');

        button.append(icon, document.createTextNode(label));

        if (slug === categoriaActiva) {
            button.classList.add('is-active');
        }

        button.addEventListener('click', () => {
            categoriaActiva = slug;
            renderCategorias();
            cargar();
        });

        return button;
    }

    /**
     * @param {string} label
     * @param {string} slug
     * @param {string} icono
     * @returns {HTMLButtonElement}
     */
    function crearChip(label, slug, icono) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'recipe-type-chip';
        button.dataset.tipo = slug;

        const icon = document.createElement('i');
        icon.className = `bi ${icono}`;
        icon.setAttribute('aria-hidden', 'true');

        button.append(icon, document.createTextNode(label));

        if (slug === tipoActivo) {
            button.classList.add('is-active');
        }

        button.addEventListener('click', () => {
            tipoActivo = slug;
            renderChips();
            renderAviso();
            cargar();
        });

        return button;
    }

    function renderAviso() {
        if (!(el.tipoAviso instanceof HTMLElement)) {
            return;
        }

        const tipo = tipos.find((item) => String(item.slug) === tipoActivo);
        const aviso = typeof tipo?.aviso === 'string' ? tipo.aviso.trim() : '';

        if (aviso === '') {
            el.tipoAviso.hidden = true;
            el.tipoAviso.textContent = '';

            return;
        }

        el.tipoAviso.textContent = aviso;
        el.tipoAviso.hidden = false;
    }

    /* Tarjetas ---------------------------------------------------------- */

    function renderRecetas() {
        if (!(el.grid instanceof HTMLElement)) {
            return;
        }

        el.grid.replaceChildren();
        const total = recetas.length;
        const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

        if (paginaActual > totalPaginas) {
            paginaActual = totalPaginas;
        }

        const inicio = (paginaActual - 1) * POR_PAGINA;
        const fin = Math.min(inicio + POR_PAGINA, total);
        const visibles = recetas.slice(inicio, fin);

        if (total === 0) {
            if (el.empty instanceof HTMLElement) {
                el.empty.hidden = false;
                el.empty.textContent = el.solo instanceof HTMLInputElement && el.solo.checked
                    ? 'Ninguna receta se puede preparar solo con tu última compra. Desactiva el filtro para ver todas.'
                    : 'No hay recetas que coincidan con los filtros. Prueba con otro tipo o limpia la búsqueda.';
            }

            renderPaginacion(0, 1);
        } else {
            if (el.empty instanceof HTMLElement) {
                el.empty.hidden = true;
            }

            for (const receta of visibles) {
                el.grid.append(crearTarjeta(receta));
            }

            renderPaginacion(total, totalPaginas);
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = total === 0
                ? '0 recetas'
                : `${inicio + 1}–${fin} de ${total} ${total === 1 ? 'receta' : 'recetas'} · página ${paginaActual} de ${totalPaginas}`;
        }
    }

    /**
     * @param {number} total
     * @param {number} totalPaginas
     */
    function renderPaginacion(total, totalPaginas) {
        if (!(el.paginacion instanceof HTMLElement) || !(el.paginas instanceof HTMLElement)) {
            return;
        }

        el.paginas.replaceChildren();

        if (total <= POR_PAGINA) {
            el.paginacion.hidden = true;

            return;
        }

        el.paginacion.hidden = false;

        const crearItem = (contenido, pagina, opciones = {}) => {
            const li = document.createElement('li');
            li.className = 'page-item';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'page-link';
            button.innerHTML = contenido;

            if (opciones.activa) {
                li.classList.add('active');
                button.setAttribute('aria-current', 'page');
            }

            if (opciones.deshabilitada) {
                li.classList.add('disabled');
                button.disabled = true;
            }

            if (!opciones.deshabilitada && pagina !== null) {
                button.addEventListener('click', () => {
                    paginaActual = pagina;
                    renderRecetas();
                    el.grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }

            if (opciones.etiqueta) {
                button.setAttribute('aria-label', opciones.etiqueta);
            }

            li.append(button);

            return li;
        };

        el.paginas.append(crearItem(
            '<i class="bi bi-chevron-left" aria-hidden="true"></i>',
            Math.max(1, paginaActual - 1),
            { deshabilitada: paginaActual === 1, etiqueta: 'Página anterior' },
        ));

        const paginas = new Set([1, totalPaginas]);

        for (let pagina = Math.max(1, paginaActual - 2); pagina <= Math.min(totalPaginas, paginaActual + 2); pagina++) {
            paginas.add(pagina);
        }

        const ordenadas = Array.from(paginas).sort((a, b) => a - b);
        let anterior = 0;

        for (const pagina of ordenadas) {
            if (anterior !== 0 && pagina - anterior > 1) {
                const separador = document.createElement('li');
                separador.className = 'page-item disabled';
                const span = document.createElement('span');
                span.className = 'page-link';
                span.textContent = '…';
                separador.append(span);
                el.paginas.append(separador);
            }

            el.paginas.append(crearItem(
                String(pagina),
                pagina,
                { activa: pagina === paginaActual, etiqueta: `Página ${pagina}` },
            ));
            anterior = pagina;
        }

        el.paginas.append(crearItem(
            '<i class="bi bi-chevron-right" aria-hidden="true"></i>',
            Math.min(totalPaginas, paginaActual + 1),
            { deshabilitada: paginaActual === totalPaginas, etiqueta: 'Página siguiente' },
        ));
    }

    /**
     * @param {any} receta
     * @returns {HTMLElement}
     */
    function crearTarjeta(receta) {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-xl-4';

        const card = document.createElement('article');
        card.className = 'recipe-card';

        const media = document.createElement('div');
        media.className = 'recipe-card__media';

        const portada = receta.imagen_url || receta.video?.thumbnail_url;

        if (portada) {
            const img = document.createElement('img');
            img.src = String(portada);
            img.alt = '';
            img.loading = 'lazy';
            media.append(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'bi bi-egg-fried';
            icon.setAttribute('aria-hidden', 'true');
            media.append(icon);
        }

        const badges = document.createElement('div');
        badges.className = 'recipe-card__badges';

        if (receta.categoria) {
            const badge = document.createElement('span');
            badge.className = 'recipe-badge recipe-badge--categoria';
            badge.textContent = String(receta.categoria.nombre ?? '');
            badges.append(badge);
        }

        const maxTipos = receta.categoria ? 1 : 2;

        for (const tipo of (Array.isArray(receta.tipos) ? receta.tipos : []).slice(0, maxTipos)) {
            const badge = document.createElement('span');
            badge.className = 'recipe-badge';
            badge.textContent = nombreTipo(String(tipo));
            badges.append(badge);
        }

        media.append(badges);

        const favorito = document.createElement('button');
        favorito.type = 'button';
        favorito.className = 'recipe-card__fav';
        favorito.dataset.recetaFav = String(receta.slug);
        aplicarEstadoFavorito(favorito, Boolean(receta.favorita));
        favorito.addEventListener('click', () => toggleFavorito(String(receta.slug)));
        media.append(favorito);

        const body = document.createElement('div');
        body.className = 'recipe-card__body';

        const title = document.createElement('h3');
        title.className = 'recipe-card__title';
        title.textContent = String(receta.nombre ?? 'Receta');

        const desc = document.createElement('p');
        desc.className = 'recipe-card__desc';
        desc.textContent = String(receta.descripcion ?? '');

        const meta = document.createElement('div');
        meta.className = 'recipe-card__meta';
        meta.append(
            crearMeta('bi-clock', `${Number(receta.tiempo_min ?? 0)} min`),
            crearMeta('bi-people', `${Number(receta.porciones_base ?? 0)} porciones`),
        );

        const match = document.createElement('div');
        match.className = 'recipe-match';

        const matchText = document.createElement('div');
        matchText.className = 'recipe-match__text';

        const total = Number(receta.total_ingredientes ?? 0);
        const tienen = Number(receta.tiene_count ?? 0);
        const porcentaje = Math.round(Number(receta.coincidencia ?? 0) * 100);

        const left = document.createElement('span');
        left.textContent = total > 0 ? `${tienen} de ${total} ingredientes` : 'Sin datos de despensa';
        const right = document.createElement('span');
        right.textContent = `${porcentaje}%`;
        matchText.append(left, right);

        const bar = document.createElement('div');
        bar.className = 'recipe-match__bar';
        const fill = document.createElement('div');
        fill.className = 'recipe-match__fill';
        fill.style.width = `${Math.max(0, Math.min(100, porcentaje))}%`;
        bar.append(fill);
        match.append(matchText, bar);

        const missing = document.createElement('p');
        missing.className = 'recipe-card__missing';
        const faltan = Array.isArray(receta.faltan) ? receta.faltan : [];

        if (faltan.length === 0) {
            missing.textContent = total > 0 ? 'Tienes todos los ingredientes principales.' : 'Sin ingredientes registrados.';
        } else {
            const visibles = faltan.slice(0, 3).join(', ');
            missing.textContent = `Te falta: ${visibles}${faltan.length > 3 ? ` y ${faltan.length - 3} más` : ''}.`;
        }

        const actions = document.createElement('div');
        actions.className = 'recipe-card__actions';

        const ver = document.createElement('button');
        ver.type = 'button';
        ver.className = 'btn btn-sm btn-outline-secondary';
        ver.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i> Ver receta';
        ver.addEventListener('click', () => abrirDetalle(String(receta.slug)));

        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'btn btn-sm btn-outline-primary';
        select.dataset.recetaSelect = String(receta.slug);
        aplicarEstadoSeleccion(select, seleccion.has(String(receta.slug)));
        select.addEventListener('click', () => {
            togglearSeleccion(receta);
        });

        actions.append(ver, select);
        body.append(title, desc, meta, match, missing, actions);
        card.append(media, body);
        col.append(card);

        return col;
    }

    /**
     * @param {string} icono
     * @param {string} texto
     * @returns {HTMLSpanElement}
     */
    function crearMeta(icono, texto) {
        const span = document.createElement('span');
        const icon = document.createElement('i');
        icon.className = `bi ${icono}`;
        icon.setAttribute('aria-hidden', 'true');
        span.append(icon, document.createTextNode(texto));

        return span;
    }

    /**
     * @param {HTMLButtonElement} button
     * @param {boolean} activa
     */
    function aplicarEstadoSeleccion(button, activa) {
        button.classList.toggle('is-selected', activa);
        button.innerHTML = activa
            ? '<i class="bi bi-check2-circle" aria-hidden="true"></i> Seleccionada'
            : '<i class="bi bi-plus-circle" aria-hidden="true"></i> Seleccionar';
        button.setAttribute('aria-pressed', activa ? 'true' : 'false');
    }

    /**
     * @param {any} receta
     */
    function togglearSeleccion(receta) {
        const slug = String(receta.slug);

        if (seleccion.has(slug)) {
            seleccion.delete(slug);
        } else {
            seleccion.set(slug, {
                slug,
                nombre: String(receta.nombre ?? ''),
                porciones: Number(receta.porciones_base ?? 4),
                porciones_base: Number(receta.porciones_base ?? 4),
            });
        }

        renderSeleccion();
        actualizarBotonesSeleccion();
    }

    function actualizarBotonesSeleccion() {
        document.querySelectorAll('[data-receta-select]').forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }

            aplicarEstadoSeleccion(button, seleccion.has(String(button.dataset.recetaSelect)));
        });
    }

    /* Selección --------------------------------------------------------- */

    function renderSeleccion() {
        if (!(el.seleccion instanceof HTMLElement) || !(el.seleccionItems instanceof HTMLElement)) {
            return;
        }

        el.seleccion.hidden = seleccion.size === 0;

        if (el.seleccionCount instanceof HTMLElement) {
            el.seleccionCount.textContent = `${seleccion.size} ${seleccion.size === 1 ? 'receta seleccionada' : 'recetas seleccionadas'}`;
        }

        el.seleccionItems.replaceChildren();

        for (const item of seleccion.values()) {
            const row = document.createElement('div');
            row.className = 'recipe-tray__item';

            const name = document.createElement('span');
            name.className = 'recipe-tray__name';
            name.textContent = item.nombre;

            const porciones = document.createElement('label');
            porciones.className = 'recipe-tray__porciones';
            porciones.append(document.createTextNode('Porciones'));

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-control form-control-sm';
            input.min = '1';
            input.max = '50';
            input.step = '1';
            input.value = String(item.porciones);
            input.setAttribute('aria-label', `Porciones para ${item.nombre}`);
            input.addEventListener('change', () => {
                const value = Math.max(1, Math.min(50, Math.round(Number(input.value) || item.porciones_base)));
                input.value = String(value);
                item.porciones = value;
            });
            porciones.append(input);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'recipe-tray__remove';
            remove.setAttribute('aria-label', `Quitar ${item.nombre}`);
            remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
            remove.addEventListener('click', () => {
                seleccion.delete(item.slug);
                renderSeleccion();
                actualizarBotonesSeleccion();
            });

            row.append(name, porciones, remove);
            el.seleccionItems.append(row);
        }
    }

    /* Detalle ----------------------------------------------------------- */

    async function abrirDetalle(slug) {
        if (!(el.detalleModal instanceof HTMLElement)) {
            return;
        }

        detalleActual = null;
        abrirModal(el.detalleModal);

        if (el.detalleTitulo instanceof HTMLElement) {
            el.detalleTitulo.textContent = 'Receta';
        }

        if (el.detalleBody instanceof HTMLElement) {
            el.detalleBody.innerHTML = '<p class="text-muted small mb-0">Cargando receta…</p>';
        }

        if (el.detalleFooter instanceof HTMLElement) {
            el.detalleFooter.replaceChildren();
        }

        try {
            const receta = await fetchApi(`/api/recetas/${encodeURIComponent(slug)}`);
            detalleActual = receta;
            detallePorciones = Number(receta.porciones_base ?? 4);
            pintarDetalle();

            if (el.detalleTitulo instanceof HTMLElement) {
                el.detalleTitulo.textContent = String(receta.nombre ?? 'Receta');
            }
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.detalleBody instanceof HTMLElement) {
                el.detalleBody.innerHTML = '<p class="text-muted small mb-0">No se pudo cargar la receta.</p>';
            }
        }
    }

    /**
     * @param {any} costo
     * @param {number} factor
     * @param {number} porciones
     * @returns {HTMLElement}
     */
    function crearCostoReceta(costo, factor, porciones) {
        const section = document.createElement('div');
        section.className = 'recipe-detail__section recipe-cost';

        const title = document.createElement('h6');
        title.textContent = 'Costo estimado';

        const grid = document.createElement('div');
        grid.className = 'recipe-cost__grid';
        const total = Number(costo.total ?? 0) * factor;
        const falta = Number(costo.falta_comprar ?? 0) * factor;
        const porcion = Number(costo.porcion ?? 0);

        grid.append(
            bloqueCosto('Total', formatCurrency(total), `para ${porciones} porciones`),
            bloqueCosto('Por porción', formatCurrency(porcion), ''),
            bloqueCosto('Falta comprar', formatCurrency(falta), 'según tu despensa'),
        );

        section.append(title, grid);

        const faltantes = (Array.isArray(costo.items) ? costo.items : [])
            .filter((item) => item?.faltante)
            .map((item) => String(item.nombre ?? ''))
            .filter((nombre) => nombre !== '');

        if (!costo.completo) {
            const aviso = document.createElement('p');
            aviso.className = 'recipe-cost__aviso';
            aviso.textContent = faltantes.length > 0
                ? `Cálculo parcial: falta precio de ${faltantes.length} ${faltantes.length === 1 ? 'ingrediente' : 'ingredientes'} (${faltantes.join(', ')}).`
                : 'Cálculo parcial: hay ingredientes sin cantidad o con unidad incompatible.';
            section.append(aviso);
        }

        if (Number(costo.precios_viejos ?? 0) > 0) {
            const viejo = document.createElement('p');
            viejo.className = 'recipe-cost__aviso';
            viejo.textContent = `Hay ${Number(costo.precios_viejos)} precios con más de 60 días.`;
            section.append(viejo);
        }

        const nota = document.createElement('p');
        nota.className = 'text-muted small mb-0';
        nota.textContent = 'Calculado con tus compras y tickets. La despensa es lo que compraste, no un inventario exacto.';
        section.append(nota);

        return section;
    }

    /**
     * @param {string} label
     * @param {string} value
     * @param {string} detail
     * @returns {HTMLElement}
     */
    function bloqueCosto(label, value, detail) {
        const bloque = document.createElement('div');
        const caption = document.createElement('span');
        caption.textContent = label;
        const strong = document.createElement('strong');
        strong.textContent = value;
        const small = document.createElement('small');
        small.textContent = detail;
        bloque.append(caption, strong, small);

        return bloque;
    }

    function pintarDetalle() {
        if (!(detalleActual !== null) || !(el.detalleBody instanceof HTMLElement)) {
            return;
        }

        const receta = detalleActual;
        const factor = detallePorciones / Math.max(1, Number(receta.porciones_base ?? 4));
        el.detalleBody.replaceChildren();

        const types = document.createElement('div');
        types.className = 'recipe-detail__types';

        if (receta.categoria) {
            const badge = document.createElement('span');
            badge.className = 'recipe-badge recipe-badge--categoria';
            badge.textContent = String(receta.categoria.nombre ?? '');
            types.append(badge);
        }

        for (const tipo of (Array.isArray(receta.tipos) ? receta.tipos : [])) {
            const badge = document.createElement('span');
            badge.className = 'recipe-badge';
            badge.textContent = nombreTipo(String(tipo));
            types.append(badge);
        }

        if (receta.imagen_url) {
            const cover = document.createElement('div');
            cover.className = 'recipe-detail__cover';
            const img = document.createElement('img');
            img.src = String(receta.imagen_url);
            img.alt = '';
            img.loading = 'lazy';
            cover.append(img);
            el.detalleBody.append(cover);
        }

        const desc = document.createElement('p');
        desc.className = 'text-muted';
        desc.textContent = String(receta.descripcion ?? '');

        const meta = document.createElement('div');
        meta.className = 'recipe-detail__meta';
        meta.append(
            crearMeta('bi-clock', `${Number(receta.tiempo_min ?? 0)} min`),
            crearMeta('bi-people', `${detallePorciones} porciones`),
            crearMeta('bi-bar-chart', `${Math.round(Number(receta.coincidencia ?? 0) * 100)}% de coincidencia`),
        );

        const ingredients = document.createElement('div');
        ingredients.className = 'recipe-detail__section';

        const ingTitle = document.createElement('h6');
        ingTitle.textContent = 'Ingredientes';
        const ingList = document.createElement('ul');
        ingList.className = 'recipe-detail__ingredients';
        const faltan = new Set((Array.isArray(receta.faltan) ? receta.faltan : []).map(String));

        for (const ingrediente of (Array.isArray(receta.ingredientes) ? receta.ingredientes : [])) {
            const li = document.createElement('li');
            const nombre = String(ingrediente.nombre ?? '');
            const missing = faltan.has(nombre);

            if (missing) {
                li.classList.add('is-missing');
            }

            const name = document.createElement('span');
            name.className = 'recipe-detail__ingredient-name';
            const icon = document.createElement('i');
            icon.className = missing ? 'bi bi-circle' : 'bi bi-check-circle-fill';
            icon.setAttribute('aria-hidden', 'true');
            name.append(icon, document.createTextNode(nombre));

            const cantidad = document.createElement('span');
            cantidad.className = 'text-muted';

            if (ingrediente.unidad === 'al_gusto') {
                cantidad.textContent = 'Al gusto';
            } else {
                const qty = Math.round(Number(ingrediente.cantidad ?? 0) * factor * 1000) / 1000;
                cantidad.textContent = `${formatQuantity(qty)} ${String(ingrediente.unidad ?? '')}`;
            }

            li.append(name, cantidad);
            ingList.append(li);
        }

        ingredients.append(ingTitle, ingList);

        const steps = document.createElement('div');
        steps.className = 'recipe-detail__section';
        const stepsTitle = document.createElement('h6');
        stepsTitle.textContent = 'Preparación';
        const stepsList = document.createElement('ol');
        stepsList.className = 'recipe-detail__steps';

        for (const paso of (Array.isArray(receta.pasos) ? receta.pasos : [])) {
            const li = document.createElement('li');
            li.textContent = String(paso);
            stepsList.append(li);
        }

        steps.append(stepsTitle, stepsList);

        el.detalleBody.append(types, desc, meta, ingredients, steps);

        const costo = receta.costo;

        if (costo && typeof costo === 'object') {
            el.detalleBody.append(crearCostoReceta(costo, factor, detallePorciones));
        }

        if (receta.video?.embed_url) {
            const videoSection = document.createElement('div');
            videoSection.className = 'recipe-detail__section';
            const videoTitle = document.createElement('h6');
            videoTitle.textContent = 'Video';
            const wrapper = document.createElement('div');
            wrapper.className = 'recipe-detail__video';
            const iframe = document.createElement('iframe');
            iframe.src = String(receta.video.embed_url);
            iframe.title = String(receta.video.titulo ?? receta.nombre ?? 'Video de la receta');
            iframe.loading = 'lazy';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            wrapper.append(iframe);
            videoSection.append(videoTitle, wrapper);
            el.detalleBody.append(videoSection);
        }

        const avisos = new Set(
            (Array.isArray(receta.tipos_detalle) ? receta.tipos_detalle : [])
                .map((tipo) => String(tipo?.aviso ?? '').trim())
                .filter((aviso) => aviso !== ''),
        );

        for (const aviso of avisos) {
            const note = document.createElement('p');
            note.className = 'recipe-detail__aviso';
            note.textContent = aviso;
            el.detalleBody.append(note);
        }

        if (el.detalleFooter instanceof HTMLElement) {
            el.detalleFooter.replaceChildren();

            const favorito = document.createElement('button');
            favorito.type = 'button';
            favorito.className = 'btn btn-outline-secondary';
            favorito.dataset.recetaFav = String(receta.slug);
            aplicarEstadoFavorito(favorito, Boolean(receta.favorita));
            favorito.addEventListener('click', () => toggleFavorito(String(receta.slug)));

            const porciones = document.createElement('label');
            porciones.className = 'recipe-detail__porciones';
            porciones.append(document.createTextNode('Porciones'));

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-control form-control-sm';
            input.min = '1';
            input.max = '50';
            input.step = '1';
            input.value = String(detallePorciones);
            input.setAttribute('aria-label', 'Cantidad de porciones');
            input.addEventListener('change', () => {
                detallePorciones = Math.max(1, Math.min(50, Math.round(Number(input.value) || 1)));
                input.value = String(detallePorciones);
                pintarDetalle();
            });
            porciones.append(input);

            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'btn btn-primary';
            add.innerHTML = '<i class="bi bi-basket2-fill" aria-hidden="true"></i> Agregar a la lista';
            add.addEventListener('click', () => {
                seleccion.set(String(receta.slug), {
                    slug: String(receta.slug),
                    nombre: String(receta.nombre ?? ''),
                    porciones: detallePorciones,
                    porciones_base: Number(receta.porciones_base ?? 4),
                });
                renderSeleccion();
                actualizarBotonesSeleccion();
                cerrarModal(el.detalleModal);
                showToast(`${receta.nombre} agregada a tu selección.`, 'success');
            });

            el.detalleFooter.append(favorito, porciones, add);
        }
    }

    /* Preview de lista -------------------------------------------------- */

    async function abrirPreview() {
        if (seleccion.size === 0) {
            showToast('Selecciona al menos una receta.', 'error');

            return;
        }

        if (!(el.previewModal instanceof HTMLElement)) {
            return;
        }

        abrirModal(el.previewModal);
        previewItems = [];
        await cargarListasPreview();

        if (el.previewResumen instanceof HTMLElement) {
            el.previewResumen.textContent = '';
        }

        if (el.previewStatus instanceof HTMLElement) {
            el.previewStatus.textContent = 'Calculando ingredientes…';
        }

        if (el.previewItems instanceof HTMLElement) {
            el.previewItems.replaceChildren();
        }

        try {
            const recetasSeleccionadas = Array.from(seleccion.values()).map((item) => ({
                slug: item.slug,
                porciones: item.porciones,
            }));

            const data = await fetchApi('/api/recetas/preview-lista', {
                method: 'POST',
                body: { recetas: recetasSeleccionadas },
            });

            previewItems = Array.isArray(data?.items) ? data.items : [];

            if (el.previewResumen instanceof HTMLElement) {
                const totalRecetas = Array.isArray(data?.recetas) ? data.recetas.length : seleccion.size;
                el.previewResumen.textContent = `${totalRecetas} ${totalRecetas === 1 ? 'receta' : 'recetas'} · ${previewItems.length} ${previewItems.length === 1 ? 'producto' : 'productos'} sugeridos`;
            }

            if (el.previewStatus instanceof HTMLElement) {
                el.previewStatus.textContent = previewItems.length === 0
                    ? 'No hay ingredientes con cantidad para agregar.'
                    : 'Desmarca lo que ya tengas en casa.';
            }

            renderPreview();
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.previewStatus instanceof HTMLElement) {
                el.previewStatus.textContent = 'No se pudo calcular la lista.';
            }

            showToast(error?.message ?? 'No se pudo calcular la lista.', 'error');
        }
    }

    async function cargarListasPreview() {
        if (!(el.previewLista instanceof HTMLSelectElement)) {
            return;
        }

        el.previewLista.replaceChildren();
        const loading = document.createElement('option');
        loading.value = '';
        loading.textContent = 'Cargando listas…';
        el.previewLista.append(loading);

        try {
            const data = await fetchApi('/api/listas-compra');
            const listas = Array.isArray(data?.items) ? data.items : [];
            el.previewLista.replaceChildren();

            for (const lista of listas) {
                const option = document.createElement('option');
                option.value = String(lista.id);
                option.textContent = `${lista.nombre} (${Number(lista.items_count ?? 0)})`;
                el.previewLista.append(option);
            }

            const nueva = document.createElement('option');
            nueva.value = '__nueva__';
            nueva.textContent = 'Nueva lista…';
            el.previewLista.append(nueva);

            if (listas.length === 0) {
                el.previewLista.value = '__nueva__';
            }
        } catch {
            el.previewLista.replaceChildren();
            const option = document.createElement('option');
            option.value = '__nueva__';
            option.textContent = 'Nueva lista…';
            el.previewLista.append(option);
        }

        actualizarNuevaLista();
    }

    function actualizarNuevaLista() {
        if (!(el.previewLista instanceof HTMLSelectElement) || !(el.previewNueva instanceof HTMLInputElement)) {
            return;
        }

        const nueva = el.previewLista.value === '__nueva__' || el.previewLista.value === '';
        el.previewNueva.hidden = !nueva;

        if (nueva && el.previewNueva.value.trim() === '') {
            el.previewNueva.value = 'Lista de recetas';
        }
    }

    function renderPreview() {
        if (!(el.previewItems instanceof HTMLElement)) {
            return;
        }

        el.previewItems.replaceChildren();

        previewItems.forEach((item, index) => {
            const row = document.createElement('label');
            row.className = 'recipe-preview-item';

            const check = document.createElement('input');
            check.type = 'checkbox';
            check.className = 'form-check-input mt-1';
            check.checked = true;
            check.dataset.previewIndex = String(index);

            const body = document.createElement('span');
            body.className = 'recipe-preview-item__body';

            const name = document.createElement('span');
            name.className = 'recipe-preview-item__name';
            name.append(document.createTextNode(String(item.nombre ?? 'Producto')));

            if (item.ya_comprado) {
                name.append(crearBadge('Ya lo compraste antes', 'recipe-preview-item__badge--bought'));
            }

            if (item.basico) {
                name.append(crearBadge('Básico', 'recipe-preview-item__badge--basic'));
            }

            const meta = document.createElement('span');
            meta.className = 'recipe-preview-item__meta';
            meta.textContent = `${formatQuantity(Number(item.cantidad ?? 0))} ${String(item.unidad_base ?? 'pza')}${item.origen ? ` · ${item.origen}` : ''}`;

            body.append(name, meta);
            row.append(check, body);
            el.previewItems.append(row);
        });
    }

    /**
     * @param {string} text
     * @param {string} extraClass
     * @returns {HTMLSpanElement}
     */
    function crearBadge(text, extraClass = '') {
        const badge = document.createElement('span');
        badge.className = `recipe-preview-item__badge ${extraClass}`.trim();
        badge.textContent = text;

        return badge;
    }

    async function guardarPreview() {
        if (!(el.previewGuardar instanceof HTMLButtonElement)) {
            return;
        }

        const incluidos = previewItems.filter((item, index) => {
            const check = el.previewItems?.querySelector(`[data-preview-index="${index}"]`);

            return check instanceof HTMLInputElement && check.checked;
        });

        if (incluidos.length === 0) {
            showToast('Selecciona al menos un producto.', 'error');

            return;
        }

        el.previewGuardar.disabled = true;
        const texto = el.previewGuardar.innerHTML;
        el.previewGuardar.textContent = 'Guardando…';

        let listId = 0;

        try {
            if (!(el.previewLista instanceof HTMLSelectElement)) {
                throw new Error('No se pudo cargar el selector de listas.');
            }

            if (el.previewLista.value === '__nueva__' || el.previewLista.value === '') {
                const nombre = el.previewNueva instanceof HTMLInputElement
                    ? el.previewNueva.value.trim()
                    : '';

                if (nombre === '') {
                    throw new Error('Escribe un nombre para la nueva lista.');
                }

                const nueva = await fetchApi('/api/listas-compra', {
                    method: 'POST',
                    body: { nombre },
                });
                listId = Number(nueva?.id ?? 0);
            } else {
                listId = Number(el.previewLista.value);
            }

            if (!Number.isInteger(listId) || listId <= 0) {
                throw new Error('Selecciona una lista válida.');
            }

            await fetchApi(`/api/listas-compra/${listId}/items`, {
                method: 'POST',
                body: {
                    items: incluidos.map((item) => ({
                        producto_id: item.producto_id ?? null,
                        nombre: item.nombre,
                        cantidad: item.cantidad,
                        unidad_base: item.unidad_base,
                        origen: item.origen ?? null,
                    })),
                },
            });

            seleccion.clear();
            renderSeleccion();
            actualizarBotonesSeleccion();
            cerrarModal(el.previewModal);
            showToast('Lista guardada. Revisa los productos por comprar.', 'success');
            window.setTimeout(() => {
                window.location.assign(`/lista-compras?id=${listId}&ok=1`);
            }, 450);
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo guardar la lista.', 'error');
        } finally {
            el.previewGuardar.disabled = false;
            el.previewGuardar.innerHTML = texto;
        }
    }

    /* Favoritos --------------------------------------------------------- */

    async function toggleFavorito(slug) {
        try {
            const data = await fetchApi(`/api/recetas/${encodeURIComponent(slug)}/favorito`, {
                method: 'POST',
            });
            const favorita = Boolean(data?.favorita);
            const receta = recetas.find((item) => String(item.slug) === slug);

            if (receta !== undefined) {
                receta.favorita = favorita;
            }

            if (detalleActual !== null && String(detalleActual.slug) === slug) {
                detalleActual.favorita = favorita;
            }

            document.querySelectorAll(`[data-receta-fav="${slug.replace(/"/g, '\\"')}"]`).forEach((button) => {
                if (button instanceof HTMLButtonElement) {
                    aplicarEstadoFavorito(button, favorita);
                }
            });

            showToast(
                favorita ? 'Receta agregada a favoritas.' : 'Receta quitada de favoritas.',
                'success',
            );

            if (soloFavoritas && !favorita) {
                cargar();
            }
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            showToast(error?.message ?? 'No se pudo actualizar el favorito.', 'error');
        }
    }

    /**
     * @param {HTMLButtonElement} button
     * @param {boolean} favorita
     */
    function aplicarEstadoFavorito(button, favorita) {
        button.classList.toggle('is-favorita', favorita);
        button.setAttribute('aria-pressed', favorita ? 'true' : 'false');
        button.setAttribute('aria-label', favorita ? 'Quitar de favoritas' : 'Agregar a favoritas');
        button.title = favorita ? 'Quitar de favoritas' : 'Agregar a favoritas';
        button.innerHTML = favorita
            ? '<i class="bi bi-star-fill" aria-hidden="true"></i><span class="visually-hidden">Quitar de favoritas</span>'
            : '<i class="bi bi-star" aria-hidden="true"></i><span class="visually-hidden">Agregar a favoritas</span>';
    }

    /* Utilidades -------------------------------------------------------- */

    /**
     * @param {string} slug
     * @returns {string}
     */
    function nombreTipo(slug) {
        const tipo = tipos.find((item) => String(item.slug) === slug);

        return String(tipo?.nombre ?? slug);
    }

    /**
     * Formatea una fecha ISO (YYYY-MM-DD) como dd/mm.
     *
     * @param {unknown} valor
     * @returns {string}
     */
    function formatearFecha(valor) {
        if (typeof valor !== 'string') {
            return '';
        }

        const partes = valor.slice(0, 10).split('-');

        if (partes.length !== 3) {
            return '';
        }

        return `${partes[2]}/${partes[1]}`;
    }

    /**
     * @param {HTMLElement|null} element
     */
    function abrirModal(element) {
        if (element instanceof HTMLElement) {
            element.hidden = false;
            document.body.classList.add('modal-open');
        }
    }

    /**
     * @param {HTMLElement|null} element
     */
    function cerrarModal(element) {
        if (element instanceof HTMLElement) {
            element.hidden = true;

            if (!document.querySelector('.app-modal:not([hidden])')) {
                document.body.classList.remove('modal-open');
            }
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
}

/* Badge de la lista de compras ---------------------------------------- */

fetchApi('/api/listas-compra')
    .then((data) => {
        const badge = document.querySelector('[data-lista-count]');
        const pendientes = Number(data?.pendientes ?? 0);

        if (badge instanceof HTMLElement && pendientes > 0) {
            badge.textContent = String(pendientes);
            badge.hidden = false;
        }
    })
    .catch(() => {
        // Si falla, el badge simplemente no se muestra.
    });
