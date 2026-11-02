/**
 * Métricas: gasto por mes y top 10 productos del mes seleccionado.
 */

import { fetchApi } from '../modules/api.js';
import { formatCurrency, formatQuantity } from '../modules/format.js';
import { showToast } from '../modules/toast.js';

const MONTHS = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

const root = document.querySelector('[data-metricas]');

if (root instanceof HTMLElement) {
    init(root);
}

/**
 * @param {HTMLElement} root
 */
function init(root) {
    const anioSelect = root.querySelector('[data-anio-select]');
    const mesSelect = root.querySelector('[data-mes-select]');
    const gastoList = root.querySelector('[data-gasto-list]');
    const gastoStatus = root.querySelector('[data-gasto-status]');
    const topList = root.querySelector('[data-top-list]');
    const topStatus = root.querySelector('[data-top-status]');
    const topYear = root.querySelector('[data-top-year]');

    bindLogout();

    if (
        !(anioSelect instanceof HTMLSelectElement)
        || !(mesSelect instanceof HTMLSelectElement)
        || !(gastoList instanceof HTMLElement)
        || !(gastoStatus instanceof HTMLElement)
        || !(topList instanceof HTMLElement)
        || !(topStatus instanceof HTMLElement)
    ) {
        return;
    }

    let anio = readNumber(anioSelect.value, new Date().getFullYear());
    let mes = readNumber(mesSelect.value, new Date().getMonth() + 1);
    let gastoToken = 0;
    let topToken = 0;

    updateTopYear();
    loadGasto(anio);
    loadTop(mes, anio);

    anioSelect.addEventListener('change', () => {
        anio = readNumber(anioSelect.value, anio);
        updateTopYear();
        loadGasto(anio);
        loadTop(mes, anio);
    });

    mesSelect.addEventListener('change', () => {
        mes = readNumber(mesSelect.value, mes);
        loadTop(mes, anio);
    });

    /* Gasto por mes ----------------------------------------------------- */

    async function loadGasto(year) {
        const token = ++gastoToken;

        gastoList.replaceChildren();
        mostrarEstado(gastoStatus, 'Cargando gasto…', false);

        try {
            const data = await fetchApi(
                `/api/metricas/gasto-mensual?anio=${encodeURIComponent(year)}`,
            );

            if (token !== gastoToken) {
                return;
            }

            renderGasto(Array.isArray(data) ? data : [], year);
        } catch (error) {
            if (token !== gastoToken) {
                return;
            }

            if (!redirectIfSessionLost(error)) {
                gastoStatus.textContent = 'No se pudo cargar el gasto mensual.';
                showToast(error?.message ?? 'No se pudo cargar el gasto mensual.', 'error');
            }
        }
    }

    /**
     * @param {Array<{ mes: number, total: number }>} rows
     * @param {number} year
     */
    function renderGasto(rows, year) {
        gastoList.replaceChildren();

        if (rows.length === 0) {
            mostrarEstado(gastoStatus, `Sin compras en ${year}.`, true);

            return;
        }

        const max = rows.reduce((current, row) => {
            const total = Number(row.total) || 0;

            return total > current ? total : current;
        }, 0);

        const yearTotal = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

        mostrarEstado(gastoStatus, `${formatCurrency(yearTotal)} en ${year}.`, false);

        for (const row of rows) {
            const monthIndex = Number(row.mes) - 1;
            const label = MONTHS[monthIndex] ?? `Mes ${row.mes}`;
            const total = Number(row.total) || 0;
            const width = max > 0 ? Math.max((total / max) * 100, 2) : 0;

            const item = document.createElement('div');
            item.className = 'metrics-bar';

            const head = document.createElement('div');
            head.className = 'metrics-bar__head d-flex justify-content-between small mb-1';

            const name = document.createElement('span');
            name.className = 'metrics-bar__month fw-semibold';
            name.textContent = label;

            const amount = document.createElement('strong');
            amount.className = 'metrics-bar__amount';
            amount.textContent = formatCurrency(total);

            head.append(name, amount);

            const track = document.createElement('div');
            track.className = 'progress metrics-bar__track';
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-label', `${label}: ${formatCurrency(total)}`);
            track.setAttribute('aria-valuenow', String(Math.round(width)));
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', '100');

            const fill = document.createElement('span');
            fill.className = 'progress-bar metrics-bar__fill bg-success';
            fill.style.width = `${width}%`;
            track.append(fill);

            item.append(head, track);
            gastoList.append(item);
        }
    }

    /* Top de productos -------------------------------------------------- */

    async function loadTop(month, year) {
        const token = ++topToken;

        topList.replaceChildren();
        mostrarEstado(topStatus, 'Cargando top de productos…', false);

        try {
            const params = new URLSearchParams({
                mes: String(month),
                anio: String(year),
            });
            const data = await fetchApi(`/api/metricas/top-productos?${params.toString()}`);

            if (token !== topToken) {
                return;
            }

            renderTop(Array.isArray(data) ? data : []);
        } catch (error) {
            if (token !== topToken) {
                return;
            }

            if (!redirectIfSessionLost(error)) {
                topStatus.textContent = 'No se pudo cargar el top de productos.';
                showToast(error?.message ?? 'No se pudo cargar el top de productos.', 'error');
            }
        }
    }

    /**
     * @param {Array<{ producto_id: number|null, nombre: string, imagen_url: string|null, gasto: number, cantidad_total: number }>} items
     */
    function renderTop(items) {
        topList.replaceChildren();

        if (items.length === 0) {
            mostrarEstado(topStatus, 'Sin compras en este mes.', true);

            return;
        }

        mostrarEstado(
            topStatus,
            `${items.length} ${items.length === 1 ? 'producto' : 'productos'} en el top.`,
            false,
        );

        items.forEach((item, index) => {
            topList.append(crearTopItem(item, index + 1));
        });
    }

    /**
     * @param {any} item
     * @param {number} position
     * @returns {HTMLLIElement}
     */
    function crearTopItem(item, position) {
        const nombre = String(item?.nombre ?? 'Producto');
        const li = document.createElement('li');
        li.className = 'metrics-top__item list-group-item d-flex align-items-center gap-3';

        const positionEl = document.createElement('span');
        positionEl.className = 'metrics-top__position badge bg-secondary rounded-pill';
        positionEl.textContent = String(position);

        const info = document.createElement('div');
        info.className = 'metrics-top__info flex-grow-1';

        const name = document.createElement('p');
        name.className = 'metrics-top__name fw-semibold mb-0';
        name.textContent = nombre;

        const meta = document.createElement('p');
        meta.className = 'metrics-top__meta text-muted small mb-0';
        meta.textContent = `Cantidad total: ${formatQuantity(item?.cantidad_total ?? 0)}`;

        info.append(name, meta);

        const amount = document.createElement('strong');
        amount.className = 'metrics-top__amount fw-bold';
        amount.textContent = formatCurrency(item?.gasto ?? 0);

        li.append(positionEl, crearMiniatura(item, nombre), info, amount);

        return li;
    }

    /**
     * @param {any} item
     * @param {string} nombre
     * @returns {HTMLElement}
     */
    function crearMiniatura(item, nombre) {
        const url = typeof item?.imagen_url === 'string' ? item.imagen_url : '';

        if (url !== '' && isValidImageUrl(url)) {
            const image = document.createElement('img');
            image.className = 'metrics-top__thumb';
            image.src = url;
            image.alt = `Imagen de ${nombre}`;
            image.loading = 'lazy';
            image.width = 48;
            image.height = 48;

            return image;
        }

        const placeholder = document.createElement('span');
        placeholder.className = 'metrics-top__thumb metrics-top__thumb--empty';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = nombre.charAt(0).toUpperCase();

        return placeholder;
    }

    function updateTopYear() {
        if (topYear instanceof HTMLElement) {
            topYear.textContent = String(anio);
        }
    }

    /**
     * @param {HTMLElement} element
     * @param {string} text
     * @param {boolean} empty
     */
    function mostrarEstado(element, text, empty) {
        element.textContent = text;
        element.hidden = false;
        element.classList.toggle('alert', empty);
        element.classList.toggle('alert-info', empty);
        element.classList.toggle('text-muted', !empty);
        element.classList.toggle('small', !empty);
    }
}

/* Utilidades ------------------------------------------------------------ */

/**
 * @param {string} value
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(value, fallback) {
    const number = Number.parseInt(String(value), 10);

    return Number.isInteger(number) ? number : fallback;
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
