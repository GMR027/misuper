/**
 * Último costo por unidad recordado para cada producto.
 *
 * Se guarda en localStorage con la forma { "<producto_id>": numero }.
 */

export const PRECIOS_KEY = 'misuper.precios_unidad';

/**
 * Redondea a dos decimales sin errores de coma flotante.
 *
 * @param {number} value
 * @returns {number}
 */
export function redondearImporte(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * @param {unknown} productId
 * @returns {number | null}
 */
export function leerPrecioUnidad(productId) {
    const id = Number(productId);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    try {
        const data = JSON.parse(window.localStorage.getItem(PRECIOS_KEY) ?? '{}');
        const precio = Number(data?.[String(id)]);

        return Number.isFinite(precio) && precio >= 0 ? redondearImporte(precio) : null;
    } catch {
        return null;
    }
}

/**
 * @param {unknown} productId
 * @param {number} precio
 * @returns {void}
 */
export function guardarPrecioUnidad(productId, precio) {
    const id = Number(productId);

    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(precio) || precio < 0) {
        return;
    }

    let data = {};

    try {
        const parsed = JSON.parse(window.localStorage.getItem(PRECIOS_KEY) ?? '{}');

        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed;
        }
    } catch {
        data = {};
    }

    data[String(id)] = redondearImporte(precio);

    try {
        window.localStorage.setItem(PRECIOS_KEY, JSON.stringify(data));
    } catch {
        // Sin localStorage el cálculo sigue funcionando; solo no se recuerda.
    }
}
