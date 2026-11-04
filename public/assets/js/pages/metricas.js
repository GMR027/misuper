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
    const anualTotal = root.querySelector('[data-anual-total]');
    const anualYear = root.querySelector('[data-anual-year]');
    const anualVariacion = root.querySelector('[data-anual-variacion]');
    const anualPromedio = root.querySelector('[data-anual-promedio]');
    const anualList = root.querySelector('[data-anual-list]');
    const anualStatus = root.querySelector('[data-anual-status]');
    const anualMensual = root.querySelector('[data-anual-mensual]');
    const anualMejor = root.querySelector('[data-anual-mejor]');

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
    let anualToken = 0;

    updateTopYear();
    loadAnual(anio);
    loadGasto(anio);
    loadTop(mes, anio);

    anioSelect.addEventListener('change', () => {
        anio = readNumber(anioSelect.value, anio);
        updateTopYear();
        loadAnual(anio);
        loadGasto(anio);
        loadTop(mes, anio);
    });

    mesSelect.addEventListener('change', () => {
        mes = readNumber(mesSelect.value, mes);
        loadTop(mes, anio);
    });

    /* Gasto anual ------------------------------------------------------- */

    async function loadAnual(year) {
        const token = ++anualToken;

        anualList?.replaceChildren();

        if (anualStatus instanceof HTMLElement) {
            mostrarEstado(anualStatus, 'Cargando gasto anual…', false);
        }

        resetAnualResumen(year);

        try {
            const data = await fetchApi(
                `/api/metricas/gasto-anual?anio=${encodeURIComponent(year)}`,
            );

            if (token !== anualToken) {
                return;
            }

            renderAnual(data);
        } catch (error) {
            if (token !== anualToken) {
                return;
            }

            if (!redirectIfSessionLost(error)) {
                if (anualStatus instanceof HTMLElement) {
                    anualStatus.textContent = 'No se pudo cargar el gasto anual.';
                }

                showToast(error?.message ?? 'No se pudo cargar el gasto anual.', 'error');
            }
        }
    }

    /**
     * @param {any} data
     */
    function renderAnual(data) {
        const anios = Array.isArray(data?.anios) ? data.anios : [];
        const total = Number(data?.total) || 0;
        const anioSeleccionado = Number(data?.anio) || anio;
        const variacion = data?.variacion_porcentual;
        const promedio = data?.promedio_anteriores;

        if (anualYear instanceof HTMLElement) {
            anualYear.textContent = String(anioSeleccionado);
        }

        if (anualTotal instanceof HTMLElement) {
            anualTotal.textContent = formatCurrency(total);
        }

        if (anualVariacion instanceof HTMLElement) {
            anualVariacion.replaceChildren();

            if (variacion === null || variacion === undefined) {
                anualVariacion.textContent = 'Sin gasto registrado el año anterior.';
                anualVariacion.className = 'small mb-1 text-muted';
            } else {
                const valor = Number(variacion) || 0;
                const sube = valor > 0;
                const baja = valor < 0;
                const icon = document.createElement('i');
                icon.className = `bi ${sube ? 'bi-arrow-up-right' : baja ? 'bi-arrow-down-right' : 'bi-dash'}`;
                icon.setAttribute('aria-hidden', 'true');

                const signo = sube ? '+' : '';
                anualVariacion.className = `small mb-1 fw-semibold ${sube ? 'text-danger' : baja ? 'text-success' : 'text-muted'}`;
                anualVariacion.append(
                    icon,
                    ` ${signo}${valor.toLocaleString('es-MX', { maximumFractionDigits: 1 })}% vs ${Number(data?.anio_anterior)}`,
                );
            }
        }

        if (anualPromedio instanceof HTMLElement) {
            anualPromedio.textContent = promedio === null || promedio === undefined
                ? 'Sin años previos con gasto para comparar.'
                : `Promedio de los 3 años anteriores: ${formatCurrency(Number(promedio) || 0)}.`;
        }

        if (!(anualList instanceof HTMLElement) || !(anualStatus instanceof HTMLElement)) {
            return;
        }

        anualList.replaceChildren();

        if (anios.length === 0) {
            anualStatus.textContent = 'Sin compras registradas.';

            return;
        }

        const max = anios.reduce((current, row) => {
            const value = Number(row.total) || 0;

            return value > current ? value : current;
        }, 0);

        for (const row of anios) {
            const rowYear = Number(row.anio) || 0;
            const rowTotal = Number(row.total) || 0;
            const width = max > 0 ? Math.max((rowTotal / max) * 100, rowTotal > 0 ? 2 : 0) : 0;
            const actual = rowYear === anioSeleccionado;

            const item = document.createElement('div');
            item.className = 'metrics-bar';

            const head = document.createElement('div');
            head.className = 'd-flex justify-content-between small mb-1';

            const name = document.createElement('span');
            name.className = `fw-semibold${actual ? '' : ' text-muted'}`;
            name.textContent = actual ? `${rowYear} (año seleccionado)` : String(rowYear);

            const amount = document.createElement('strong');
            amount.className = actual ? 'text-success' : 'text-muted';
            amount.textContent = formatCurrency(rowTotal);

            head.append(name, amount);

            const track = document.createElement('div');
            track.className = 'progress metrics-bar__track';
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-label', `${rowYear}: ${formatCurrency(rowTotal)}`);
            track.setAttribute('aria-valuenow', String(Math.round(width)));
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', '100');

            const fill = document.createElement('span');
            fill.className = `progress-bar metrics-bar__fill ${actual ? 'bg-success' : 'bg-secondary'}`;
            fill.style.width = `${width}%`;
            track.append(fill);

            item.append(head, track);
            anualList.append(item);
        }

        anualStatus.textContent = `Comparando ${anios[0]?.anio ?? ''}–${anioSeleccionado}.`;
    }

    /**
     * @param {number} year
     */
    function resetAnualResumen(year) {
        if (anualYear instanceof HTMLElement) {
            anualYear.textContent = String(year);
        }

        if (anualTotal instanceof HTMLElement) {
            anualTotal.textContent = '—';
        }

        if (anualVariacion instanceof HTMLElement) {
            anualVariacion.textContent = '';
            anualVariacion.className = 'small mb-1';
        }

        if (anualPromedio instanceof HTMLElement) {
            anualPromedio.textContent = '';
        }
    }

    /* Gasto por mes ----------------------------------------------------- */

    async function loadGasto(year) {
        const token = ++gastoToken;

        gastoList.replaceChildren();
        mostrarEstado(gastoStatus, 'Cargando gasto…', false);

        if (anualMensual instanceof HTMLElement) {
            anualMensual.textContent = '—';
        }

        if (anualMejor instanceof HTMLElement) {
            anualMejor.textContent = '—';
            anualMejor.removeAttribute('title');
        }

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
            actualizarResumenMensual([], year);

            return;
        }

        const max = rows.reduce((current, row) => {
            const total = Number(row.total) || 0;

            return total > current ? total : current;
        }, 0);

        const yearTotal = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);

        mostrarEstado(gastoStatus, `${formatCurrency(yearTotal)} en ${year}.`, false);
        actualizarResumenMensual(rows, year);

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

    /**
     * @param {Array<{ mes: number, total: number }>} rows
     * @param {number} year
     */
    function actualizarResumenMensual(rows, year) {
        if (!(anualMensual instanceof HTMLElement) || !(anualMejor instanceof HTMLElement)) {
            return;
        }

        if (rows.length === 0) {
            anualMensual.textContent = '—';
            anualMejor.textContent = 'Sin datos';
            anualMejor.title = `Sin compras en ${year}`;

            return;
        }

        const total = rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
        const mejor = rows.reduce((actual, row) => (
            (Number(row.total) || 0) > (Number(actual.total) || 0) ? row : actual
        ), rows[0]);
        const mesMejor = MONTHS[Number(mejor.mes) - 1] ?? '';

        anualMensual.textContent = formatCurrency(total / rows.length);
        anualMejor.textContent = mesMejor;
        anualMejor.title = `${mesMejor}: ${formatCurrency(Number(mejor.total) || 0)}`;
    }

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
