/**
 * Formatos de moneda, cantidad y fecha para la interfaz.
 */

const moneyFormatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
});

/**
 * @param {number | string} value
 * @returns {string}
 */
export function formatCurrency(value) {
    const number = Number(value);

    return moneyFormatter.format(Number.isFinite(number) ? number : 0);
}

/**
 * @param {number | string} value
 * @returns {string}
 */
export function formatQuantity(value) {
    const number = Number(value);

    return quantityFormatter.format(Number.isFinite(number) ? number : 0);
}

/**
 * Formatea una fecha YYYY-MM-DD sin desfase de zona horaria.
 *
 * @param {string} value
 * @returns {string}
 */
export function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));

    if (match === null) {
        return String(value);
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    return new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

/**
 * Fecha local de hoy en formato YYYY-MM-DD.
 *
 * @returns {string}
 */
export function todayISO() {
    return toISO(new Date());
}

/**
 * Resta años a una fecha YYYY-MM-DD manteniendo el formato local.
 *
 * @param {string} value
 * @param {number} years
 * @returns {string}
 */
export function subtractYearsISO(value, years) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));

    if (match === null) {
        return value;
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    date.setFullYear(date.getFullYear() - years);

    return toISO(date);
}

/**
 * @param {Date} date
 * @returns {string}
 */
function toISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
