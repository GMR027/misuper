/**
 * Historial de compras: listado paginado y agrupado por mes.
 */

import { fetchApi } from '../modules/api.js';
import { formatCurrency, formatQuantity } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const MONTHS = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
];

const root = document.querySelector('[data-historial]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const list = root.querySelector('[data-historial-list]');
    const status = root.querySelector('[data-historial-status]');
    const pagination = root.querySelector('[data-historial-pagination]');

    bindLogout();
    showQueryToast();

    if (!(list instanceof HTMLElement) || !(status instanceof HTMLElement) || !(pagination instanceof HTMLElement)) {
        return;
    }

    let currentPage = readPage();
    let loading = false;

    bindPagination();
    load(currentPage);

    /* Carga y render ---------------------------------------------------- */

    async function load(page) {
        if (loading) {
            return;
        }

        loading = true;
        status.textContent = 'Cargando compras…';

        try {
            const data = await fetchApi(`/api/compras?page=${page}`);
            const items = Array.isArray(data?.items) ? data.items : [];
            const total = Number(data?.total ?? 0);
            const perPage = Number(data?.per_page ?? 20);
            const totalPages = Math.max(1, Math.ceil(total / perPage));

            if (items.length === 0 && page > 1 && page !== totalPages) {
                loading = false;
                await load(totalPages);

                return;
            }

            currentPage = page;
            render(items, total, totalPages);
            updateUrl(page);
        } catch (error) {
            if (!redirectIfSessionLost(error)) {
                status.textContent = 'No se pudo cargar el historial.';
                showToast(error?.message ?? 'No se pudo cargar el historial.', 'error');
            }
        } finally {
            loading = false;
        }
    }

    function render(items, total, totalPages) {
        list.replaceChildren();

        if (items.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'history-empty history-empty--inline alert alert-info';
            empty.textContent = total === 0
                ? 'Aún no has registrado compras. Empieza en la pantalla rápida.'
                : 'No hay compras en esta página.';
            list.append(empty);
            status.textContent = '0 compras';
            renderPagination(1);

            return;
        }

        const groups = new Map();

        for (const compra of items) {
            const key = String(compra.fecha).slice(0, 7);

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(compra);
        }

        for (const [key, compras] of groups) {
            list.append(crearGrupo(key, compras));
        }

        status.textContent = `${total} ${total === 1 ? 'compra' : 'compras'}`;
        renderPagination(totalPages);
    }

    function crearGrupo(key, compras) {
        const section = document.createElement('section');
        section.className = 'history-group';

        const title = document.createElement('h5');
        title.className = 'history-group__title text-muted mt-4 mb-2';
        title.textContent = monthLabel(key);

        const list = document.createElement('ul');
        list.className = 'history-list list-group mb-4';

        for (const compra of compras) {
            list.append(crearCompra(compra));
        }

        section.append(title, list);

        return section;
    }

    function crearCompra(compra) {
        const li = document.createElement('li');
        li.className = 'history-list__item';

        const link = document.createElement('a');
        link.className = 'history-row list-group-item list-group-item-action d-flex justify-content-between align-items-center';
        link.href = `/historial/${Number(compra.id)}`;
        link.dataset.compraId = String(compra.id);

        const info = document.createElement('div');

        const date = document.createElement('span');
        date.className = 'history-row__date fw-semibold d-block';
        date.textContent = formatDayMonthYear(compra.fecha);

        const items = document.createElement('small');
        items.className = 'history-row__items text-muted';
        items.textContent = `${Number(compra.items_count)} ${Number(compra.items_count) === 1 ? 'ítem' : 'ítems'}`;

        const meta = document.createElement('span');
        meta.className = 'history-row__meta';
        meta.append(items);

        if (Number(compra.kcal_total ?? 0) > 0) {
            const kcal = document.createElement('span');
            kcal.className = 'history-row__kcal text-muted';
            kcal.textContent = `≈ ${formatQuantity(Math.round(Number(compra.kcal_total)))} kcal`;
            meta.append(kcal);
        }

        if (Number(compra.ticket_id) > 0) {
            const ticket = document.createElement('span');
            ticket.className = 'history-row__ticket badge text-bg-light';
            ticket.innerHTML = '<i class="bi bi-receipt-cutoff" aria-hidden="true"></i> Ticket';
            meta.append(ticket);

            if (typeof compra.ticket_titulo === 'string' && compra.ticket_titulo.trim() !== '') {
                const title = document.createElement('span');
                title.className = 'history-row__ticket-title';
                title.textContent = compra.ticket_titulo;
                meta.append(title);
            }
        }

        info.append(date, meta);

        const total = document.createElement('span');
        total.className = 'history-row__total badge bg-primary rounded-pill fs-6';
        total.textContent = formatCurrency(compra.total);

        link.append(info, total);
        li.append(link);

        return li;
    }

    function renderPagination(totalPages) {
        pagination.replaceChildren();

        if (totalPages <= 1) {
            pagination.hidden = true;

            return;
        }

        pagination.hidden = false;

        const ul = document.createElement('ul');
        ul.className = 'pagination justify-content-center mb-0';

        const prevLi = document.createElement('li');
        prevLi.className = `page-item${currentPage <= 1 ? ' disabled' : ''}`;

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'page-link';
        prev.dataset.pagePrev = '';
        prev.textContent = 'Anterior';
        prev.disabled = currentPage <= 1;
        prevLi.append(prev);

        const statusLi = document.createElement('li');
        statusLi.className = 'page-item disabled';

        const pageStatus = document.createElement('span');
        pageStatus.className = 'page-link pagination__status';
        pageStatus.textContent = `Página ${currentPage} de ${totalPages}`;
        statusLi.append(pageStatus);

        const nextLi = document.createElement('li');
        nextLi.className = `page-item${currentPage >= totalPages ? ' disabled' : ''}`;

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'page-link';
        next.dataset.pageNext = '';
        next.textContent = 'Siguiente';
        next.disabled = currentPage >= totalPages;
        nextLi.append(next);

        ul.append(prevLi, statusLi, nextLi);
        pagination.append(ul);
    }

    function bindPagination() {
        pagination.addEventListener('click', (event) => {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            const prev = target.closest('[data-page-prev]');

            if (prev instanceof HTMLButtonElement && !prev.disabled) {
                load(currentPage - 1);

                return;
            }

            const next = target.closest('[data-page-next]');

            if (next instanceof HTMLButtonElement && !next.disabled) {
                load(currentPage + 1);
            }
        });
    }

    function readPage() {
        const params = new URLSearchParams(window.location.search);
        const page = Number.parseInt(params.get('page') ?? '1', 10);

        return Number.isInteger(page) && page > 0 ? page : 1;
    }

    function updateUrl(page) {
        const params = new URLSearchParams(window.location.search);

        if (page <= 1) {
            params.delete('page');
        } else {
            params.set('page', String(page));
        }

        const query = params.toString();
        window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${query === '' ? '' : `?${query}`}`,
        );
    }
}

/* Utilidades ------------------------------------------------------------ */

/**
 * @param {string} key
 * @returns {string}
 */
function monthLabel(key) {
    const [year, month] = String(key).split('-');
    const name = MONTHS[Number(month) - 1] ?? '';

    if (name === '') {
        return String(key);
    }

    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
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

function showQueryToast() {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (params.get('guardada') === '1') {
        // El aviso lo renderiza la vista como alert de Bootstrap.
        params.delete('guardada');
        changed = true;
    }

    if (params.get('eliminada') === '1') {
        showToast('Compra eliminada.', 'info');
        params.delete('eliminada');
        changed = true;
    }

    if (params.get('error') === 'no_encontrada') {
        showToast('Compra no encontrada.', 'error');
        params.delete('error');
        changed = true;
    }

    if (!changed) {
        return;
    }

    const query = params.toString();
    window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${query === '' ? '' : `?${query}`}`,
    );
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
