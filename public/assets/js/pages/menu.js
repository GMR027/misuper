/**
 * Menú semanal: calendario, recetas, porciones, costos y lista de compra.
 */

import { fetchApi } from '../modules/api.js';
import { confirmar } from '../modules/confirm.js';
import { formatCurrency, formatDate, formatQuantity, todayISO } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MOMENTOS = {
    desayuno: 'Desayuno',
    comida: 'Comida',
    cena: 'Cena',
    colacion: 'Colación',
    otro: 'Extra',
};

const root = document.querySelector('[data-menu]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const el = {
        rango: root.querySelector('[data-menu-rango]'),
        status: root.querySelector('[data-menu-status]'),
        stats: {
            items: root.querySelector('[data-menu-stat-items]'),
            recetas: root.querySelector('[data-menu-stat-recetas]'),
            total: root.querySelector('[data-menu-stat-total]'),
            nota: root.querySelector('[data-menu-stat-nota]'),
            sin: root.querySelector('[data-menu-stat-sin]'),
        },
        tabs: root.querySelector('[data-menu-tabs]'),
        week: root.querySelector('[data-menu-week]'),
        picker: document.querySelector('[data-menu-picker]'),
        pickerTitle: document.querySelector('[data-menu-picker-title]'),
        pickerSubtitle: document.querySelector('[data-menu-picker-subtitle]'),
        pickerBuscar: document.querySelector('[data-menu-picker-buscar]'),
        pickerTiempo: document.querySelector('[data-menu-picker-tiempo]'),
        pickerFavoritas: document.querySelector('[data-menu-picker-favoritas]'),
        pickerDespensa: document.querySelector('[data-menu-picker-despensa]'),
        pickerStatus: document.querySelector('[data-menu-picker-status]'),
        pickerResultados: document.querySelector('[data-menu-picker-resultados]'),
        notaForm: document.querySelector('[data-menu-nota-form]'),
        notaInput: document.querySelector('[data-menu-nota-input]'),
        itemModal: document.querySelector('[data-menu-item-modal]'),
        itemForm: document.querySelector('[data-menu-item-form]'),
        itemTitle: document.querySelector('[data-menu-item-title]'),
        itemAviso: document.querySelector('[data-menu-item-aviso]'),
        itemPorcionesWrap: document.querySelector('[data-menu-item-porciones-wrap]'),
        itemPorciones: document.querySelector('[data-menu-item-porciones]'),
        itemDia: document.querySelector('[data-menu-item-dia]'),
        itemMomento: document.querySelector('[data-menu-item-momento]'),
        itemEtiqueta: document.querySelector('[data-menu-item-etiqueta]'),
        itemNota: document.querySelector('[data-menu-item-nota]'),
        itemError: document.querySelector('[data-menu-item-error]'),
        itemReemplazar: document.querySelector('[data-menu-item-reemplazar]'),
        listaModal: document.querySelector('[data-menu-lista-modal]'),
        listaForm: document.querySelector('[data-menu-lista-form]'),
        listaStatus: document.querySelector('[data-menu-lista-status]'),
        listaItems: document.querySelector('[data-menu-lista-items]'),
        listaSubtitle: document.querySelector('[data-menu-lista-subtitle]'),
        listaTotal: document.querySelector('[data-menu-lista-total]'),
        listaAviso: document.querySelector('[data-menu-lista-aviso]'),
        listaDestino: document.querySelector('[data-menu-lista-destino]'),
        listaNombreWrap: document.querySelector('[data-menu-lista-nombre-wrap]'),
        listaNombre: document.querySelector('[data-menu-lista-nombre]'),
        listaError: document.querySelector('[data-menu-lista-error]'),
        iaBoton: root.querySelector('[data-menu-ia]'),
        iaModal: document.querySelector('[data-menu-ia-modal]'),
        iaForm: document.querySelector('[data-menu-ia-form]'),
        iaPersonas: document.querySelector('[data-menu-ia-personas]'),
        iaTiempo: document.querySelector('[data-menu-ia-tiempo]'),
        iaFavoritas: document.querySelector('[data-menu-ia-favoritas]'),
        iaEvitar: document.querySelector('[data-menu-ia-evitar]'),
        iaStatus: document.querySelector('[data-menu-ia-status]'),
        iaError: document.querySelector('[data-menu-ia-error]'),
        iaResultados: document.querySelector('[data-menu-ia-resultados]'),
        iaLista: document.querySelector('[data-menu-ia-lista]'),
        iaResumen: document.querySelector('[data-menu-ia-resumen]'),
        iaGenerar: document.querySelector('[data-menu-ia-generar]'),
        iaAplicar: document.querySelector('[data-menu-ia-aplicar]'),
    };

    if (!(el.week instanceof HTMLElement)) {
        return;
    }

    const state = {
        semana: mondayISO(todayISO()),
        diaActivo: null,
        data: null,
        token: 0,
        picker: null,
        itemAbierto: null,
        preview: null,
        recetasToken: 0,
        arrastrando: null,
        iaSugerencias: [],
    };

    bind();
    revelarIa();
    cargar(state.semana);

    function bind() {
        root.querySelector('[data-menu-prev]')?.addEventListener('click', () => {
            cargar(addDaysISO(state.semana, -7));
        });

        root.querySelector('[data-menu-next]')?.addEventListener('click', () => {
            cargar(addDaysISO(state.semana, 7));
        });

        root.querySelector('[data-menu-hoy]')?.addEventListener('click', () => {
            cargar(mondayISO(todayISO()));
        });

        root.querySelector('[data-menu-copiar]')?.addEventListener('click', copiarSemana);
        root.querySelector('[data-menu-vaciar]')?.addEventListener('click', vaciarSemana);
        root.querySelector('[data-menu-lista]')?.addEventListener('click', abrirLista);
        el.iaBoton?.addEventListener('click', abrirIa);
        el.iaForm?.addEventListener('submit', generarIa);
        el.iaAplicar?.addEventListener('click', aplicarIa);
        el.iaModal?.querySelectorAll('[data-menu-ia-close]').forEach((boton) => {
            boton.addEventListener('click', cerrarIa);
        });
        el.iaModal?.addEventListener('click', (event) => {
            if (event.target === el.iaModal) {
                cerrarIa();
            }
        });

        el.picker?.querySelectorAll('[data-menu-picker-close]').forEach((boton) => {
            boton.addEventListener('click', cerrarPicker);
        });
        el.itemModal?.querySelectorAll('[data-menu-item-close]').forEach((boton) => {
            boton.addEventListener('click', cerrarItem);
        });
        el.listaModal?.querySelectorAll('[data-menu-lista-close]').forEach((boton) => {
            boton.addEventListener('click', cerrarLista);
        });

        el.picker?.addEventListener('click', (event) => {
            if (event.target === el.picker) {
                cerrarPicker();
            }
        });
        el.itemModal?.addEventListener('click', (event) => {
            if (event.target === el.itemModal) {
                cerrarItem();
            }
        });
        el.listaModal?.addEventListener('click', (event) => {
            if (event.target === el.listaModal) {
                cerrarLista();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (el.picker instanceof HTMLElement && !el.picker.hidden) {
                cerrarPicker();
            } else if (el.itemModal instanceof HTMLElement && !el.itemModal.hidden) {
                cerrarItem();
            } else if (el.listaModal instanceof HTMLElement && !el.listaModal.hidden) {
                cerrarLista();
            } else if (el.iaModal instanceof HTMLElement && !el.iaModal.hidden) {
                cerrarIa();
            }
        });

        let buscarTimer = null;
        el.pickerBuscar?.addEventListener('input', () => {
            window.clearTimeout(buscarTimer);
            buscarTimer = window.setTimeout(cargarRecetas, 250);
        });
        el.pickerTiempo?.addEventListener('change', cargarRecetas);
        el.pickerFavoritas?.addEventListener('change', cargarRecetas);
        el.pickerDespensa?.addEventListener('change', cargarRecetas);

        el.notaForm?.addEventListener('submit', agregarNota);
        el.itemForm?.addEventListener('submit', guardarItem);
        el.itemModal?.querySelector('[data-menu-item-borrar]')?.addEventListener('click', borrarItem);
        el.itemReemplazar?.addEventListener('click', reemplazarItem);
        el.listaForm?.addEventListener('submit', crearLista);
        el.listaDestino?.addEventListener('change', actualizarDestinoLista);

        el.week.addEventListener('click', (event) => {
            const agregar = event.target.closest('[data-slot-add]');

            if (agregar instanceof HTMLElement) {
                abrirPicker(
                    Number(agregar.dataset.dia),
                    String(agregar.dataset.momento),
                    agregar.dataset.etiqueta ?? '',
                );

                return;
            }

            const editar = event.target.closest('[data-item-edit]');

            if (editar instanceof HTMLElement) {
                const item = buscarItem(Number(editar.dataset.itemEdit));

                if (item !== null) {
                    abrirItem(item);
                }
            }
        });

        el.tabs?.addEventListener('click', (event) => {
            const tab = event.target.closest('[data-dia-tab]');

            if (tab instanceof HTMLElement) {
                state.diaActivo = Number(tab.dataset.diaTab);
                renderDias();
            }
        });

        bindArrastre();
        bindLogout();
    }

    /**
     * @param {string} semana
     */
    async function cargar(semana) {
        const actual = ++state.token;
        state.semana = mondayISO(semana);

        if (el.status instanceof HTMLElement) {
            el.status.textContent = 'Cargando…';
        }

        try {
            const data = await fetchApi(`/api/menu?semana=${encodeURIComponent(state.semana)}`);

            if (actual !== state.token) {
                return;
            }

            state.data = data;
            state.diaActivo = data.dias.find((dia) => dia.es_hoy)?.dia ?? 1;
            render();
        } catch (error) {
            if (actual !== state.token) {
                return;
            }

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.status instanceof HTMLElement) {
                el.status.textContent = 'No se pudo cargar el menú.';
            }

            showToast(error?.message ?? 'No se pudo cargar el menú.', 'error');
        }
    }

    function render() {
        if (state.data === null) {
            return;
        }

        const resumen = state.data.resumen ?? {};

        if (el.rango instanceof HTMLElement) {
            el.rango.textContent = `${formatDate(state.data.semana)} – ${formatDate(state.data.semana_fin)}`;
        }

        if (el.status instanceof HTMLElement) {
            el.status.textContent = `${Number(resumen.items ?? 0)} platillos · ${Number(resumen.recetas ?? 0)} recetas`;
        }

        setText(el.stats.items, resumen.items);
        setText(el.stats.recetas, resumen.recetas);
        setText(
            el.stats.total,
            Number(resumen.recetas ?? 0) === 0 ? '—' : formatCurrency(resumen.total),
        );
        setText(el.stats.sin, resumen.sin_precio);

        if (el.stats.nota instanceof HTMLElement) {
            const notas = [];

            if (Number(resumen.no_disponibles ?? 0) > 0) {
                notas.push(`${Number(resumen.no_disponibles)} sin receta`);
            }

            if (Number(resumen.precios_viejos ?? 0) > 0) {
                notas.push(`${Number(resumen.precios_viejos)} precios viejos`);
            }

            if (Number(resumen.sin_precio ?? 0) > 0) {
                notas.push('cálculo parcial');
            }

            if (notas.length === 0 && Number(resumen.recetas ?? 0) > 0) {
                notas.push('cálculo completo');
            }

            el.stats.nota.textContent = notas.join(' · ');
        }

        renderTabs();
        renderDias();
    }

    function renderTabs() {
        if (!(el.tabs instanceof HTMLElement) || state.data === null) {
            return;
        }

        el.tabs.replaceChildren();

        for (const dia of state.data.dias) {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.className = 'menu-tab' + (dia.dia === state.diaActivo ? ' is-active' : '')
                + (dia.es_hoy ? ' is-hoy' : '');
            boton.dataset.diaTab = String(dia.dia);
            boton.setAttribute('role', 'tab');
            boton.setAttribute('aria-selected', dia.dia === state.diaActivo ? 'true' : 'false');
            boton.textContent = `${DIAS_CORTOS[dia.dia - 1]} ${Number(dia.fecha.slice(8, 10))}`;
            el.tabs.append(boton);
        }
    }

    function renderDias() {
        if (!(el.week instanceof HTMLElement) || state.data === null) {
            return;
        }

        el.week.replaceChildren();

        for (const dia of state.data.dias) {
            const seccion = document.createElement('section');
            seccion.className = 'menu-day'
                + (dia.dia === state.diaActivo ? ' is-active' : '')
                + (dia.es_hoy ? ' is-hoy' : '');
            seccion.dataset.dia = String(dia.dia);

            const head = document.createElement('div');
            head.className = 'menu-day__head';

            const titulo = document.createElement('h3');
            titulo.className = 'menu-day__title';
            titulo.textContent = DIAS[dia.dia - 1];

            const fecha = document.createElement('span');
            fecha.className = 'menu-day__date';
            const tieneCosto = Number(dia.total ?? 0) > 0;

            fecha.textContent = tieneCosto
                ? `${formatDate(dia.fecha)} · ${formatCurrency(dia.total)}${Number(dia.sin_precio ?? 0) > 0 ? ' parcial' : ''}`
                : formatDate(dia.fecha);

            head.append(titulo, fecha);
            seccion.append(head);

            const momentos = momentosDelDia(dia.items);

            for (const momento of momentos) {
                const items = dia.items
                    .filter((item) => item.momento === momento.momento)
                    .sort((a, b) => Number(a.orden) - Number(b.orden) || Number(a.id) - Number(b.id));

                seccion.append(crearSlot(dia.dia, momento.momento, momento.etiqueta, items));
            }

            const extra = document.createElement('button');
            extra.type = 'button';
            extra.className = 'btn btn-sm btn-link text-decoration-none px-0';
            extra.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i> Tiempo extra';
            extra.addEventListener('click', () => abrirPicker(dia.dia, 'colacion', 'Colación'));
            seccion.append(extra);

            el.week.append(seccion);
        }
    }

    /**
     * @param {Array<any>} items
     * @returns {Array<{momento: string, etiqueta: string}>}
     */
    function momentosDelDia(items) {
        const base = [
            { momento: 'desayuno', etiqueta: '' },
            { momento: 'comida', etiqueta: '' },
            { momento: 'cena', etiqueta: '' },
        ];
        const extras = new Map();

        for (const item of items) {
            if (['desayuno', 'comida', 'cena'].includes(item.momento)) {
                continue;
            }

            const clave = item.momento + '|' + (item.etiqueta ?? '');
            extras.set(clave, {
                momento: item.momento,
                etiqueta: item.etiqueta ?? '',
            });
        }

        return base.concat(Array.from(extras.values()));
    }

    /**
     * @param {number} dia
     * @param {string} momento
     * @param {string} etiqueta
     * @param {Array<any>} items
     * @returns {HTMLElement}
     */
    function crearSlot(dia, momento, etiqueta, items) {
        const slot = document.createElement('div');
        slot.className = 'menu-slot';
        slot.dataset.slot = '1';
        slot.dataset.dia = String(dia);
        slot.dataset.momento = momento;
        slot.dataset.etiqueta = etiqueta;

        const head = document.createElement('div');
        head.className = 'menu-slot__head';

        const label = document.createElement('span');
        label.className = 'menu-slot__label';
        label.textContent = etiqueta !== '' ? etiqueta : (MOMENTOS[momento] ?? momento);

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'menu-slot__add';
        add.dataset.slotAdd = '1';
        add.dataset.dia = String(dia);
        add.dataset.momento = momento;
        add.dataset.etiqueta = etiqueta;
        add.setAttribute('aria-label', `Agregar receta a ${DIAS[dia - 1]} · ${label.textContent}`);
        add.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i>';

        head.append(label, add);
        slot.append(head);

        const lista = document.createElement('div');
        lista.className = 'menu-slot__items';

        if (items.length === 0) {
            const vacio = document.createElement('span');
            vacio.className = 'menu-slot__vacio';
            vacio.textContent = 'Sin platillos';
            lista.append(vacio);
        } else {
            for (const item of items) {
                lista.append(crearCard(item));
            }
        }

        slot.append(lista);

        return slot;
    }

    /**
     * @param {any} item
     * @returns {HTMLElement}
     */
    function crearCard(item) {
        const card = document.createElement('article');
        card.className = 'menu-card' + (item.tipo === 'nota' ? ' menu-card--nota' : '');
        card.dataset.itemId = String(item.id);

        const arrastrable = window.matchMedia('(min-width: 992px) and (pointer: fine)').matches;

        if (arrastrable && item.tipo === 'receta') {
            card.draggable = true;
        }

        const media = document.createElement('span');
        media.className = 'menu-card__media';
        media.setAttribute('aria-hidden', 'true');

        if (item.imagen_url) {
            const img = document.createElement('img');
            img.src = String(item.imagen_url);
            img.alt = '';
            img.loading = 'lazy';
            media.append(img);
        } else {
            media.innerHTML = item.tipo === 'nota'
                ? '<i class="bi bi-sticky"></i>'
                : '<i class="bi bi-egg-fried"></i>';
        }

        const body = document.createElement('div');
        body.className = 'menu-card__body';

        const nombre = document.createElement('p');
        nombre.className = 'menu-card__name';
        nombre.textContent = String(item.nombre ?? '');

        const meta = document.createElement('div');
        meta.className = 'menu-card__meta';

        if (item.tipo === 'nota') {
            const nota = document.createElement('span');
            nota.textContent = 'Nota';
            meta.append(nota);
        } else {
            const porciones = document.createElement('span');
            porciones.textContent = `${Number(item.porciones)} porciones`;
            meta.append(porciones);

            if (item.tiempo_min) {
                const tiempo = document.createElement('span');
                tiempo.textContent = `${Number(item.tiempo_min)} min`;
                meta.append(tiempo);
            }

            const costo = document.createElement('span');
            costo.className = 'menu-card__cost';

            if (!item.disponible) {
                costo.classList.add('menu-card__cost--falta');
                costo.textContent = 'Receta no disponible';
            } else if (item.costo === null) {
                costo.classList.add('menu-card__cost--falta');
                costo.textContent = 'Sin precio';
            } else if (!item.costo.completo) {
                costo.classList.add('menu-card__cost--parcial');
                costo.textContent = `Parcial ${formatCurrency(item.costo.total)}`;
            } else {
                costo.textContent = formatCurrency(item.costo.total);
            }

            meta.append(costo);
        }

        body.append(nombre, meta);

        const actions = document.createElement('div');
        actions.className = 'menu-card__actions';

        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'menu-card__action';
        editar.dataset.itemEdit = String(item.id);
        editar.setAttribute('aria-label', `Editar ${String(item.nombre ?? '')}`);
        editar.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';

        actions.append(editar);
        card.append(media, body, actions);

        return card;
    }

    function bindArrastre() {
        el.week.addEventListener('dragstart', (event) => {
            const card = event.target.closest('[data-item-id]');

            if (!(card instanceof HTMLElement) || !(event.dataTransfer instanceof DataTransfer)) {
                return;
            }

            state.arrastrando = Number(card.dataset.itemId);
            card.classList.add('is-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', card.dataset.itemId);
        });

        el.week.addEventListener('dragend', () => {
            state.arrastrando = null;
            el.week.querySelectorAll('.is-dragging').forEach((card) => card.classList.remove('is-dragging'));
            el.week.querySelectorAll('.is-drop-target').forEach((slot) => slot.classList.remove('is-drop-target'));
        });

        el.week.addEventListener('dragover', (event) => {
            const slot = event.target.closest('[data-slot]');

            if (!(slot instanceof HTMLElement) || state.arrastrando === null) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            el.week.querySelectorAll('.is-drop-target').forEach((otro) => {
                if (otro !== slot) {
                    otro.classList.remove('is-drop-target');
                }
            });
            slot.classList.add('is-drop-target');
        });

        el.week.addEventListener('dragleave', (event) => {
            const slot = event.target.closest('[data-slot]');

            if (slot instanceof HTMLElement && !slot.contains(event.relatedTarget)) {
                slot.classList.remove('is-drop-target');
            }
        });

        el.week.addEventListener('drop', async (event) => {
            const slot = event.target.closest('[data-slot]');

            if (!(slot instanceof HTMLElement) || state.arrastrando === null) {
                return;
            }

            event.preventDefault();
            const itemId = state.arrastrando;
            state.arrastrando = null;
            slot.classList.remove('is-drop-target');

            await moverItem(itemId, {
                dia: Number(slot.dataset.dia),
                momento: String(slot.dataset.momento),
                etiqueta: String(slot.dataset.etiqueta ?? ''),
            });
        });
    }

    /**
     * @param {number} itemId
     * @param {{dia: number, momento: string, etiqueta: string}} destino
     */
    async function moverItem(itemId, destino) {
        const item = buscarItem(itemId);

        if (
            item !== null
            && item.dia === destino.dia
            && item.momento === destino.momento
            && (item.etiqueta ?? '') === destino.etiqueta
        ) {
            return;
        }

        try {
            const data = await fetchApi(`/api/menu/items/${itemId}`, {
                method: 'PUT',
                body: destino,
            });
            aplicar(data);
            showToast('Platillo movido.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo mover el platillo.', 'error');
            }
        }
    }

    /**
     * @param {number} dia
     * @param {string} momento
     * @param {string} etiqueta
     */
    function abrirPicker(dia, momento, etiqueta = '', reemplazar = null) {
        if (!(el.picker instanceof HTMLElement)) {
            return;
        }

        state.picker = { dia, momento, etiqueta, reemplazar };
        el.picker.hidden = false;

        if (el.pickerTitle instanceof HTMLElement) {
            el.pickerTitle.textContent = reemplazar === null
                ? `Agregar a ${DIAS[dia - 1]} · ${etiqueta !== '' ? etiqueta : (MOMENTOS[momento] ?? momento)}`
                : `Reemplazar en ${DIAS[dia - 1]} · ${etiqueta !== '' ? etiqueta : (MOMENTOS[momento] ?? momento)}`;
        }

        if (el.pickerSubtitle instanceof HTMLElement) {
            el.pickerSubtitle.textContent = 'Elige una receta de tu recetario o agrega una nota.';
        }

        if (el.pickerBuscar instanceof HTMLInputElement) {
            el.pickerBuscar.value = '';
        }

        if (el.pickerTiempo instanceof HTMLSelectElement) {
            el.pickerTiempo.value = '';
        }

        if (el.pickerFavoritas instanceof HTMLInputElement) {
            el.pickerFavoritas.checked = false;
        }

        if (el.pickerDespensa instanceof HTMLInputElement) {
            el.pickerDespensa.checked = false;
        }

        if (el.notaInput instanceof HTMLInputElement) {
            el.notaInput.value = '';
        }

        if (el.notaForm instanceof HTMLElement) {
            el.notaForm.hidden = reemplazar !== null;
        }

        cargarRecetas();
        el.pickerBuscar?.focus();
    }

    function cerrarPicker() {
        if (el.picker instanceof HTMLElement) {
            el.picker.hidden = true;
        }

        state.picker = null;
    }

    async function cargarRecetas() {
        if (!(el.pickerResultados instanceof HTMLElement)) {
            return;
        }

        const actual = ++state.recetasToken;
        const params = new URLSearchParams();

        if (el.pickerBuscar instanceof HTMLInputElement && el.pickerBuscar.value.trim() !== '') {
            params.set('q', el.pickerBuscar.value.trim());
        }

        if (el.pickerTiempo instanceof HTMLSelectElement && el.pickerTiempo.value !== '') {
            params.set('tiempo', el.pickerTiempo.value);
        }

        if (el.pickerFavoritas instanceof HTMLInputElement && el.pickerFavoritas.checked) {
            params.set('favoritas', '1');
        }

        if (el.pickerDespensa instanceof HTMLInputElement && el.pickerDespensa.checked) {
            params.set('solo_despensa', '1');
        }

        if (el.pickerStatus instanceof HTMLElement) {
            el.pickerStatus.textContent = 'Buscando recetas…';
        }

        try {
            const data = await fetchApi(`/api/recetas?${params.toString()}`);

            if (actual !== state.recetasToken) {
                return;
            }

            const items = Array.isArray(data?.items) ? data.items : [];
            el.pickerResultados.replaceChildren();

            if (el.pickerStatus instanceof HTMLElement) {
                el.pickerStatus.textContent = `${items.length} ${items.length === 1 ? 'receta' : 'recetas'}`;
            }

            if (items.length === 0) {
                const vacio = document.createElement('p');
                vacio.className = 'text-muted small mb-0';
                vacio.textContent = 'No hay recetas con esos filtros.';
                el.pickerResultados.append(vacio);

                return;
            }

            for (const receta of items) {
                el.pickerResultados.append(crearResultado(receta));
            }
        } catch (error) {
            if (actual !== state.recetasToken) {
                return;
            }

            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.pickerStatus instanceof HTMLElement) {
                el.pickerStatus.textContent = 'No se pudieron cargar las recetas.';
            }
        }
    }

    /**
     * @param {any} receta
     * @returns {HTMLElement}
     */
    function crearResultado(receta) {
        const fila = document.createElement('div');
        fila.className = 'menu-picker__item';

        const media = document.createElement('span');
        media.className = 'menu-picker__media';
        media.setAttribute('aria-hidden', 'true');

        if (receta.imagen_url) {
            const img = document.createElement('img');
            img.src = String(receta.imagen_url);
            img.alt = '';
            img.loading = 'lazy';
            media.append(img);
        } else {
            media.innerHTML = '<i class="bi bi-egg-fried"></i>';
        }

        const body = document.createElement('div');
        const nombre = document.createElement('p');
        nombre.className = 'menu-picker__name';
        nombre.textContent = String(receta.nombre ?? '');

        const meta = document.createElement('p');
        meta.className = 'menu-picker__meta';
        const partes = [
            `${Number(receta.porciones_base ?? 4)} porciones`,
            `${Number(receta.tiempo_min ?? 0)} min`,
        ];

        if (Number(receta.faltan_principales ?? 0) > 0) {
            partes.push(`${Number(receta.faltan_principales)} ingredientes por comprar`);
        } else if (Number(receta.total_ingredientes ?? 0) > 0) {
            partes.push('con tu despensa');
        }

        meta.textContent = partes.join(' · ');
        body.append(nombre, meta);

        const agregar = document.createElement('button');
        agregar.type = 'button';
        agregar.className = 'btn btn-sm btn-primary';
        agregar.innerHTML = '<i class="bi bi-plus-lg" aria-hidden="true"></i> Agregar';
        agregar.addEventListener('click', async () => {
            agregar.disabled = true;
            const reemplazar = state.picker?.reemplazar ?? null;

            try {
                const data = reemplazar === null
                    ? await fetchApi('/api/menu/items', {
                        method: 'POST',
                        body: {
                            semana: state.semana,
                            dia: state.picker?.dia,
                            momento: state.picker?.momento,
                            etiqueta: state.picker?.etiqueta ?? '',
                            tipo: 'receta',
                            receta_id: receta.id,
                            porciones: receta.porciones_base,
                        },
                    })
                    : await fetchApi(`/api/menu/items/${reemplazar}`, {
                        method: 'PUT',
                        body: {
                            receta_id: receta.id,
                            porciones: receta.porciones_base,
                        },
                    });

                aplicar(data);
                cerrarPicker();
                showToast(
                    reemplazar === null ? 'Receta agregada al menú.' : 'Receta reemplazada.',
                    'success',
                );
            } catch (error) {
                agregar.disabled = false;

                if (!redirectIfSessionLost(error)) {
                    showToast(error?.message ?? 'No se pudo agregar la receta.', 'error');
                }
            }
        });

        fila.append(media, body, agregar);

        return fila;
    }

    async function agregarNota(event) {
        event.preventDefault();

        if (!(el.notaInput instanceof HTMLInputElement) || state.picker === null) {
            return;
        }

        const nota = el.notaInput.value.trim();

        if (nota.length < 2) {
            showToast('Escribe una nota de al menos 2 caracteres.', 'error');

            return;
        }

        try {
            const data = await fetchApi('/api/menu/items', {
                method: 'POST',
                body: {
                    semana: state.semana,
                    dia: state.picker.dia,
                    momento: state.picker.momento,
                    etiqueta: state.picker.etiqueta,
                    tipo: 'nota',
                    nota,
                },
            });
            aplicar(data);
            cerrarPicker();
            showToast('Nota agregada al menú.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo agregar la nota.', 'error');
            }
        }
    }

    /**
     * @param {any} item
     */
    function abrirItem(item) {
        if (!(el.itemModal instanceof HTMLElement)) {
            return;
        }

        state.itemAbierto = item;
        el.itemModal.hidden = false;

        if (el.itemTitle instanceof HTMLElement) {
            el.itemTitle.textContent = String(item.nombre ?? 'Editar platillo');
        }

        if (el.itemAviso instanceof HTMLElement) {
            const noDisponible = item.tipo === 'receta' && !item.disponible;
            el.itemAviso.hidden = !noDisponible;
            el.itemAviso.textContent = noDisponible
                ? 'Esta receta ya no está publicada. Puedes quitarla o cambiar sus porciones, pero su costo no se calcula.'
                : '';
        }

        if (el.itemPorcionesWrap instanceof HTMLElement) {
            el.itemPorcionesWrap.hidden = item.tipo !== 'receta';
        }

        if (el.itemReemplazar instanceof HTMLButtonElement) {
            el.itemReemplazar.hidden = item.tipo !== 'receta' || item.disponible;
        }

        if (el.itemPorciones instanceof HTMLInputElement) {
            el.itemPorciones.value = String(item.porciones ?? 4);
        }

        if (el.itemDia instanceof HTMLSelectElement) {
            el.itemDia.value = String(item.dia);
        }

        if (el.itemMomento instanceof HTMLSelectElement) {
            el.itemMomento.value = String(item.momento);
        }

        if (el.itemEtiqueta instanceof HTMLInputElement) {
            el.itemEtiqueta.value = String(item.etiqueta ?? '');
        }

        if (el.itemNota instanceof HTMLInputElement) {
            el.itemNota.value = String(item.nota ?? '');
        }

        mostrarErrorItem('');
    }

    function cerrarItem() {
        if (el.itemModal instanceof HTMLElement) {
            el.itemModal.hidden = true;
        }

        state.itemAbierto = null;
    }

    function reemplazarItem() {
        if (state.itemAbierto === null) {
            return;
        }

        const item = state.itemAbierto;
        cerrarItem();
        abrirPicker(item.dia, item.momento, item.etiqueta ?? '', item.id);
    }

    async function guardarItem(event) {
        event.preventDefault();

        if (state.itemAbierto === null) {
            return;
        }

        const item = state.itemAbierto;
        const momento = el.itemMomento instanceof HTMLSelectElement ? el.itemMomento.value : item.momento;
        const etiqueta = ['colacion', 'otro'].includes(momento) && el.itemEtiqueta instanceof HTMLInputElement
            ? el.itemEtiqueta.value.trim()
            : '';
        const body = {
            dia: el.itemDia instanceof HTMLSelectElement ? Number(el.itemDia.value) : item.dia,
            momento,
            etiqueta,
            nota: el.itemNota instanceof HTMLInputElement ? el.itemNota.value.trim() : '',
        };

        if (item.tipo === 'receta' && el.itemPorciones instanceof HTMLInputElement) {
            body.porciones = Number(el.itemPorciones.value);
        }

        try {
            const data = await fetchApi(`/api/menu/items/${item.id}`, {
                method: 'PUT',
                body,
            });
            aplicar(data);
            cerrarItem();
            showToast('Platillo actualizado.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                mostrarErrorItem(error?.message ?? 'No se pudo guardar el platillo.');
            }
        }
    }

    async function borrarItem() {
        if (state.itemAbierto === null) {
            return;
        }

        const item = state.itemAbierto;
        const ok = await confirmar({
            title: '¿Quitar del menú?',
            message: `Se quitará «${String(item.nombre ?? '')}» de este día.`,
            confirmText: 'Quitar',
        });

        if (!ok) {
            return;
        }

        try {
            const data = await fetchApi(`/api/menu/items/${item.id}`, { method: 'DELETE' });
            aplicar(data);
            cerrarItem();
            showToast('Platillo quitado del menú.', 'info');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                mostrarErrorItem(error?.message ?? 'No se pudo quitar el platillo.');
            }
        }
    }

    async function copiarSemana() {
        const anterior = addDaysISO(state.semana, -7);
        const ok = await confirmar({
            title: 'Copiar la semana anterior',
            message: `Se copiarán los platillos de la semana del ${formatDate(anterior)} y se reemplazará lo que ya tengas en esta semana.`,
            confirmText: 'Copiar',
            tone: 'primary',
        });

        if (!ok) {
            return;
        }

        try {
            const data = await fetchApi('/api/menu/copiar', {
                method: 'POST',
                body: {
                    origen_semana: anterior,
                    destino_semana: state.semana,
                    reemplazar: true,
                },
            });
            aplicar(data);
            showToast('Semana copiada.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo copiar la semana.', 'error');
            }
        }
    }

    async function vaciarSemana() {
        const ok = await confirmar({
            title: '¿Vaciar la semana?',
            message: 'Se quitarán todos los platillos y notas de esta semana.',
            confirmText: 'Vaciar',
        });

        if (!ok) {
            return;
        }

        try {
            const data = await fetchApi(`/api/menu?semana=${encodeURIComponent(state.semana)}`, {
                method: 'DELETE',
            });
            aplicar(data);
            showToast('Semana vaciada.', 'info');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                showToast(error?.message ?? 'No se pudo vaciar la semana.', 'error');
            }
        }
    }

    async function abrirLista() {
        if (!(el.listaModal instanceof HTMLElement)) {
            return;
        }

        el.listaModal.hidden = false;
        mostrarErrorLista('');
        setText(el.listaTotal, '—');

        if (el.listaStatus instanceof HTMLElement) {
            el.listaStatus.textContent = 'Calculando ingredientes…';
        }

        if (el.listaAviso instanceof HTMLElement) {
            el.listaAviso.textContent = '';
        }

        try {
            const [preview, listas] = await Promise.all([
                fetchApi('/api/menu/lista/preview', {
                    method: 'POST',
                    body: { semana: state.semana },
                }),
                fetchApi('/api/listas-compra'),
            ]);

            state.preview = preview;
            renderPreviewLista(preview);
            renderDestinosLista(Array.isArray(listas?.items) ? listas.items : []);
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            if (el.listaStatus instanceof HTMLElement) {
                el.listaStatus.textContent = 'No se pudo preparar la lista.';
            }

            mostrarErrorLista(error?.message ?? 'No se pudo preparar la lista.');
        }
    }

    function cerrarLista() {
        if (el.listaModal instanceof HTMLElement) {
            el.listaModal.hidden = true;
        }

        state.preview = null;
    }

    /**
     * @param {any} preview
     */
    function renderPreviewLista(preview) {
        if (!(el.listaItems instanceof HTMLElement)) {
            return;
        }

        const items = Array.isArray(preview?.items) ? preview.items : [];
        el.listaItems.replaceChildren();

        if (el.listaSubtitle instanceof HTMLElement) {
            el.listaSubtitle.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${formatDate(state.semana)}`;
        }

        if (el.listaStatus instanceof HTMLElement) {
            el.listaStatus.textContent = items.length === 0
                ? 'El menú no tiene ingredientes pendientes.'
                : 'Desmarca lo que ya tengas o no quieras comprar.';
        }

        for (const item of items) {
            const fila = document.createElement('label');
            fila.className = 'menu-lista__item';

            const check = document.createElement('input');
            check.className = 'form-check-input mt-0';
            check.type = 'checkbox';
            check.checked = true;
            check.dataset.listaClave = String(item.clave ?? '');

            const body = document.createElement('span');
            const nombre = document.createElement('strong');
            nombre.textContent = String(item.nombre ?? '');
            const detalle = document.createElement('small');
            const partes = [`${formatQuantity(item.cantidad)} ${String(item.unidad_base ?? '')}`];

            if (item.ya_comprado) {
                partes.push('ya lo tienes');
            }

            if (item.faltante) {
                partes.push('sin precio');
            }

            detalle.textContent = partes.join(' · ');
            body.append(nombre, document.createElement('br'), detalle);

            const costo = document.createElement('span');
            costo.textContent = item.costo === null || item.costo === undefined
                ? '—'
                : formatCurrency(item.costo);

            fila.append(check, body, costo);
            el.listaItems.append(fila);
        }

        actualizarTotalLista();
        el.listaItems.querySelectorAll('[data-lista-clave]').forEach((input) => {
            input.addEventListener('change', actualizarTotalLista);
        });

        const submit = el.listaForm?.querySelector('button[type="submit"]');

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = items.length === 0;
        }

        const costo = preview?.costo ?? {};
        if (el.listaAviso instanceof HTMLElement) {
            const avisos = [];

            if (costo.completo === false) {
                avisos.push('El total es parcial: falta algún precio o unidad compatible.');
            }

            if (Number(costo.precios_viejos ?? 0) > 0) {
                avisos.push(`${Number(costo.precios_viejos)} precios tienen más de 60 días.`);
            }

            el.listaAviso.textContent = avisos.join(' ');
        }
    }

    function actualizarTotalLista() {
        if (state.preview === null || !(el.listaItems instanceof HTMLElement)) {
            return;
        }

        const items = Array.isArray(state.preview.items) ? state.preview.items : [];
        let total = 0.0;
        let seleccionados = 0;

        el.listaItems.querySelectorAll('[data-lista-clave]').forEach((input) => {
            if (!(input instanceof HTMLInputElement) || !input.checked) {
                return;
            }

            seleccionados++;
            const item = items.find((fila) => String(fila.clave ?? '') === input.dataset.listaClave);

            if (item !== undefined && item.costo !== null && item.costo !== undefined) {
                total += Number(item.costo);
            }
        });

        setText(el.listaTotal, formatCurrency(total));

        const submit = el.listaForm?.querySelector('button[type="submit"]');

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = seleccionados === 0;
        }
    }

    /**
     * @param {Array<any>} listas
     */
    function renderDestinosLista(listas) {
        if (!(el.listaDestino instanceof HTMLSelectElement)) {
            return;
        }

        el.listaDestino.replaceChildren();

        const nueva = document.createElement('option');
        nueva.value = '__nueva__';
        nueva.textContent = 'Nueva lista…';
        el.listaDestino.append(nueva);

        for (const lista of listas) {
            const option = document.createElement('option');
            option.value = String(lista.id);
            option.textContent = `${String(lista.nombre)} (${Number(lista.items_count ?? 0)})`;
            el.listaDestino.append(option);
        }

        el.listaDestino.value = '__nueva__';

        if (el.listaNombre instanceof HTMLInputElement) {
            el.listaNombre.value = `Menú ${state.semana}`;
        }

        actualizarDestinoLista();
    }

    function actualizarDestinoLista() {
        if (!(el.listaDestino instanceof HTMLSelectElement) || !(el.listaNombreWrap instanceof HTMLElement)) {
            return;
        }

        el.listaNombreWrap.hidden = el.listaDestino.value !== '__nueva__';
    }

    async function crearLista(event) {
        event.preventDefault();

        if (!(el.listaItems instanceof HTMLElement)) {
            return;
        }

        const excluir = [];

        el.listaItems.querySelectorAll('[data-lista-clave]').forEach((input) => {
            if (input instanceof HTMLInputElement && !input.checked) {
                excluir.push(input.dataset.listaClave);
            }
        });

        const destino = el.listaDestino instanceof HTMLSelectElement ? el.listaDestino.value : '__nueva__';
        const body = {
            semana: state.semana,
            excluir,
        };

        if (destino === '__nueva__') {
            body.nombre = el.listaNombre instanceof HTMLInputElement ? el.listaNombre.value.trim() : '';
        } else {
            body.lista_id = Number(destino);
        }

        const submit = el.listaForm?.querySelector('button[type="submit"]');

        if (submit instanceof HTMLButtonElement) {
            submit.disabled = true;
        }

        mostrarErrorLista('');

        try {
            const data = await fetchApi('/api/menu/lista', {
                method: 'POST',
                body,
            });
            const listaId = Number(data?.lista?.id ?? 0);
            showToast(`Lista creada con ${Number(data?.agregados ?? 0)} productos.`, 'success');
            cerrarLista();

            if (listaId > 0) {
                window.location.assign(`/lista-compras?id=${listaId}`);
            }
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                mostrarErrorLista(error?.message ?? 'No se pudo crear la lista.');
            }
        } finally {
            if (submit instanceof HTMLButtonElement) {
                submit.disabled = false;
            }
        }
    }

    /**
     * El botón de IA solo existe para admin y con el puente de escritorio.
     */
    function revelarIa() {
        if (!(el.iaBoton instanceof HTMLButtonElement)) {
            return;
        }

        const puente = window.MiSuperDesktop;
        const disponible = root.dataset.rol === 'admin'
            && puente !== undefined
            && puente !== null
            && puente.disponible === true
            && typeof puente.menuCompletar === 'function';

        el.iaBoton.hidden = !disponible;
    }

    function abrirIa() {
        if (!(el.iaModal instanceof HTMLElement)) {
            return;
        }

        state.iaSugerencias = [];
        el.iaModal.hidden = false;
        mostrarErrorIa('');
        setText(el.iaStatus, '');
        setText(el.iaResumen, '');

        if (el.iaResultados instanceof HTMLElement) {
            el.iaResultados.hidden = true;
        }

        if (el.iaLista instanceof HTMLElement) {
            el.iaLista.replaceChildren();
        }

        if (el.iaAplicar instanceof HTMLButtonElement) {
            el.iaAplicar.hidden = true;
        }

        if (el.iaGenerar instanceof HTMLButtonElement) {
            el.iaGenerar.disabled = false;
        }
    }

    function cerrarIa() {
        if (el.iaModal instanceof HTMLElement) {
            el.iaModal.hidden = true;
        }

        state.iaSugerencias = [];
    }

    function filtrosIa() {
        const modo = el.iaModal?.querySelector('input[name="menu-ia-modo"]:checked');

        return {
            modo: modo instanceof HTMLInputElement ? modo.value : 'completar',
            personas: el.iaPersonas instanceof HTMLInputElement ? Number(el.iaPersonas.value) : 4,
            tiempo: el.iaTiempo instanceof HTMLSelectElement ? Number(el.iaTiempo.value) : 0,
            favoritas: el.iaFavoritas instanceof HTMLInputElement && el.iaFavoritas.checked,
            evitar_repetir: el.iaEvitar instanceof HTMLInputElement && el.iaEvitar.checked,
        };
    }

    async function generarIa(event) {
        event.preventDefault();

        const puente = window.MiSuperDesktop;

        if (
            puente === undefined
            || puente === null
            || typeof puente.menuCompletar !== 'function'
        ) {
            mostrarErrorIa('La generación con IA solo está disponible en Mi Súper Desktop.');

            return;
        }

        const filtros = filtrosIa();

        if (el.iaGenerar instanceof HTMLButtonElement) {
            el.iaGenerar.disabled = true;
        }

        if (el.iaAplicar instanceof HTMLButtonElement) {
            el.iaAplicar.hidden = true;
        }

        if (el.iaResultados instanceof HTMLElement) {
            el.iaResultados.hidden = true;
        }

        mostrarErrorIa('');
        setText(el.iaStatus, 'Preparando la propuesta…');
        setText(el.iaResumen, '');

        try {
            const preparado = await fetchApi('/api/menu/ia/preparar', {
                method: 'POST',
                body: {
                    semana: state.semana,
                    modo: filtros.modo,
                    personas: filtros.personas,
                    tiempo: filtros.tiempo,
                    favoritas: filtros.favoritas,
                    evitar_repetir: filtros.evitar_repetir,
                },
            });

            setText(
                el.iaStatus,
                `Consultando el modelo con ${Number(preparado.recetas)} recetas y ${Number(preparado.huecos)} huecos…`,
            );

            const respuesta = await puente.menuCompletar(preparado.prompt);

            if (typeof respuesta !== 'string' || respuesta.trim() === '') {
                throw new Error('La IA no devolvió ninguna propuesta.');
            }

            setText(el.iaStatus, 'Validando la propuesta…');

            const validado = await fetchApi('/api/menu/ia/validar', {
                method: 'POST',
                body: {
                    semana: state.semana,
                    modo: filtros.modo,
                    filtros: {
                        personas: filtros.personas,
                        tiempo: filtros.tiempo,
                        favoritas: filtros.favoritas,
                        evitar_repetir: filtros.evitar_repetir,
                    },
                    respuesta,
                },
            });

            state.iaSugerencias = Array.isArray(validado.sugerencias) ? validado.sugerencias : [];
            renderIa(validado, filtros.modo);
        } catch (error) {
            if (redirectIfSessionLost(error)) {
                return;
            }

            mostrarErrorIa(error?.message ?? 'No se pudo generar la propuesta.');
            setText(el.iaStatus, '');
        } finally {
            if (el.iaGenerar instanceof HTMLButtonElement) {
                el.iaGenerar.disabled = false;
            }
        }
    }

    /**
     * @param {any} data
     * @param {string} modo
     */
    function renderIa(data, modo) {
        if (!(el.iaLista instanceof HTMLElement) || !(el.iaResultados instanceof HTMLElement)) {
            return;
        }

        el.iaLista.replaceChildren();
        el.iaResultados.hidden = false;

        for (const [indice, sugerencia] of state.iaSugerencias.entries()) {
            const fila = document.createElement('label');
            fila.className = 'menu-lista__item';

            const check = document.createElement('input');
            check.className = 'form-check-input mt-0';
            check.type = 'checkbox';
            check.checked = true;
            check.dataset.iaSugerencia = String(indice);

            const body = document.createElement('span');
            const nombre = document.createElement('strong');
            nombre.textContent = String(sugerencia.nombre ?? '');
            const detalle = document.createElement('small');
            detalle.textContent = `${String(sugerencia.dia_nombre)} · ${String(sugerencia.momento_nombre)} · ${Number(sugerencia.porciones)} porciones`;
            body.append(nombre, document.createElement('br'), detalle);

            const tiempo = document.createElement('span');
            tiempo.textContent = `${Number(sugerencia.tiempo_min ?? 0)} min`;

            fila.append(check, body, tiempo);
            el.iaLista.append(fila);
        }

        const resumen = data?.resumen ?? {};
        setText(
            el.iaResumen,
            `${Number(resumen.sugerencias ?? 0)} de ${Number(resumen.huecos ?? 0)} huecos propuestos`
                + (Number(data?.descartadas ?? 0) > 0
                    ? ` · ${Number(data.descartadas)} descartados por validación`
                    : ''),
        );
        setText(
            el.iaStatus,
            modo === 'reemplazar'
                ? 'Revisa la propuesta. Al aplicarla se reemplazará toda la semana.'
                : 'Revisa la propuesta. Solo se agregarán los tiempos que elijas.',
        );

        if (el.iaAplicar instanceof HTMLButtonElement) {
            el.iaAplicar.hidden = state.iaSugerencias.length === 0;
        }
    }

    async function aplicarIa() {
        if (!(el.iaLista instanceof HTMLElement)) {
            return;
        }

        const modo = filtrosIa().modo;
        const seleccionadas = [];

        el.iaLista.querySelectorAll('[data-ia-sugerencia]').forEach((input) => {
            if (input instanceof HTMLInputElement && input.checked) {
                const sugerencia = state.iaSugerencias[Number(input.dataset.iaSugerencia)];

                if (sugerencia !== undefined) {
                    seleccionadas.push(sugerencia);
                }
            }
        });

        if (seleccionadas.length === 0) {
            mostrarErrorIa('Selecciona al menos una propuesta.');

            return;
        }

        if (modo === 'reemplazar') {
            const ok = await confirmar({
                title: '¿Reemplazar la semana?',
                message: 'Se quitarán todos los platillos actuales y se guardarán solo los que aprobaste.',
                confirmText: 'Reemplazar',
            });

            if (!ok) {
                return;
            }
        }

        if (el.iaAplicar instanceof HTMLButtonElement) {
            el.iaAplicar.disabled = true;
        }

        mostrarErrorIa('');

        try {
            const data = await fetchApi('/api/menu/ia/aplicar', {
                method: 'POST',
                body: {
                    semana: state.semana,
                    modo,
                    sugerencias: seleccionadas,
                },
            });
            aplicar(data);
            cerrarIa();
            showToast('Menú actualizado con la propuesta.', 'success');
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                mostrarErrorIa(error?.message ?? 'No se pudo aplicar la propuesta.');
            }
        } finally {
            if (el.iaAplicar instanceof HTMLButtonElement) {
                el.iaAplicar.disabled = false;
            }
        }
    }

    /**
     * @param {string} mensaje
     */
    function mostrarErrorIa(mensaje) {
        if (el.iaError instanceof HTMLElement) {
            el.iaError.textContent = mensaje;
            el.iaError.hidden = mensaje === '';
        }
    }

    /**
     * @param {any} data
     */
    function aplicar(data) {
        if (data === null || typeof data !== 'object' || !Array.isArray(data.dias)) {
            cargar(state.semana);

            return;
        }

        state.data = data;
        render();
    }

    /**
     * @param {number} id
     * @returns {any|null}
     */
    function buscarItem(id) {
        if (state.data === null) {
            return null;
        }

        for (const dia of state.data.dias) {
            const item = dia.items.find((fila) => Number(fila.id) === id);

            if (item !== undefined) {
                return item;
            }
        }

        return null;
    }

    /**
     * @param {string} mensaje
     */
    function mostrarErrorItem(mensaje) {
        if (el.itemError instanceof HTMLElement) {
            el.itemError.textContent = mensaje;
            el.itemError.hidden = mensaje === '';
        }
    }

    /**
     * @param {string} mensaje
     */
    function mostrarErrorLista(mensaje) {
        if (el.listaError instanceof HTMLElement) {
            el.listaError.textContent = mensaje;
            el.listaError.hidden = mensaje === '';
        }
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
 * @param {string} iso
 * @returns {Date}
 */
function parseISO(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);

    if (match === null) {
        return new Date();
    }

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toISO(date) {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function mondayISO(iso) {
    const date = parseISO(iso);
    const dia = date.getDay();
    const diferencia = dia === 0 ? -6 : 1 - dia;
    date.setDate(date.getDate() + diferencia);

    return toISO(date);
}

/**
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
function addDaysISO(iso, days) {
    const date = parseISO(iso);
    date.setDate(date.getDate() + days);

    return toISO(date);
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
