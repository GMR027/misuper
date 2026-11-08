/**
 * Cálculo de calorías orientativas en el carrito.
 *
 * Replica las reglas de `NutricionService`: kcal por 100 g en productos
 * kg/gr/pza y por 100 ml en L/ml. Usa el peso por pieza cuando existe y la
 * aproximación de cocina 1 g ≈ 1 ml cuando hace falta.
 */

const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

/**
 * @param {string} unidad
 * @returns {string}
 */
export function normalizarUnidad(unidad) {
    const valor = String(unidad ?? '').trim().toLowerCase();

    if (['kg', 'kgs', 'kilogramo', 'kilogramos'].includes(valor)) {
        return 'kg';
    }

    if (['g', 'gr', 'grs', 'gramo', 'gramos'].includes(valor)) {
        return 'gr';
    }

    if (['l', 'lt', 'lts', 'litro', 'litros'].includes(valor)) {
        return 'L';
    }

    if (['ml', 'mililitro', 'mililitros'].includes(valor)) {
        return 'ml';
    }

    if (['pza', 'pzas', 'pieza', 'piezas', 'unidad', 'unidades'].includes(valor)) {
        return 'pza';
    }

    return UNIDADES.includes(valor) ? valor : '';
}

/**
 * @param {number} cantidad
 * @param {string} unidad
 * @param {number|null} peso
 * @returns {number|null}
 */
function aGramos(cantidad, unidad, peso) {
    if (unidad === 'kg') {
        return cantidad * 1000;
    }

    if (unidad === 'gr') {
        return cantidad;
    }

    if (unidad === 'pza') {
        return peso === null ? null : cantidad * peso;
    }

    return null;
}

/**
 * @param {number} cantidad
 * @param {string} unidad
 * @param {number|null} peso
 * @returns {number|null}
 */
function aMililitros(cantidad, unidad, peso) {
    if (unidad === 'L') {
        return cantidad * 1000;
    }

    if (unidad === 'ml') {
        return cantidad;
    }

    if (unidad === 'pza') {
        return peso === null ? null : cantidad * peso;
    }

    return null;
}

/**
 * kcal de una cantidad de producto. Devuelve null si no hay dato confiable.
 *
 * @param {{kcal_100?: number|null, peso_pieza_g?: number|null, unidad_base?: string}|null} producto
 * @param {number} cantidad
 * @param {string} unidad
 * @returns {number|null}
 */
export function calcularKcal(producto, cantidad, unidad) {
    if (!producto || producto.kcal_100 === null || producto.kcal_100 === undefined) {
        return null;
    }

    const kcal100 = Number(producto.kcal_100);
    const cant = Number(cantidad);
    const unidadNorm = normalizarUnidad(unidad);

    if (!Number.isFinite(kcal100) || kcal100 < 0 || !Number.isFinite(cant) || cant <= 0 || unidadNorm === '') {
        return null;
    }

    const base = normalizarUnidad(producto.unidad_base);
    const pesoNum = Number(producto.peso_pieza_g);
    const peso = Number.isFinite(pesoNum) && pesoNum > 0 ? pesoNum : null;

    if (base === 'L' || base === 'ml') {
        let mililitros = aMililitros(cant, unidadNorm, peso);

        if (mililitros === null) {
            // 1 g ≈ 1 ml cuando el producto es líquido y se mide en peso.
            mililitros = aGramos(cant, unidadNorm, null);
        }

        if (mililitros === null) {
            return null;
        }

        return Math.round((mililitros / 100) * kcal100 * 10) / 10;
    }

    let gramos = aGramos(cant, unidadNorm, peso);

    if (gramos === null && (base === 'pza' ? peso !== null : ['kg', 'gr'].includes(base))) {
        // 1 ml ≈ 1 g para envases por pieza y sólidos medidos en volumen.
        gramos = aMililitros(cant, unidadNorm, null);
    }

    if (gramos === null) {
        return null;
    }

    return Math.round((gramos / 100) * kcal100 * 10) / 10;
}
