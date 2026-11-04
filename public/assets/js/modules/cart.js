/**
 * Carrito de la pantalla rápida.
 *
 * Estructura persistida en localStorage:
 * { items: [{ producto_id, nombre, unidad_base, categoria_nombre, cantidad, precio_total }] }
 */

export const STORAGE_KEY = 'carrito_actual';

export const MAX_ITEMS = 100;

const UNIDADES = ['kg', 'gr', 'L', 'ml', 'pza'];

let items = [];

function round(value, decimals) {
    const factor = 10 ** decimals;

    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function persist() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
    } catch {
        // Si localStorage no está disponible, el carrito sigue en memoria.
    }
}

/**
 * Carga el carrito desde localStorage, descartando entradas inválidas.
 *
 * @returns {boolean} true si quedó al menos un ítem válido.
 */
export function loadCart() {
    let raw = null;

    try {
        raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        raw = null;
    }

    if (raw === null) {
        items = [];

        return false;
    }

    try {
        const parsed = JSON.parse(raw);
        const candidate = Array.isArray(parsed?.items) ? parsed.items : [];

        items = candidate
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
                const productoId = item.producto_id === null || item.producto_id === undefined
                    ? null
                    : Number(item.producto_id);
                const nombre = typeof item.nombre === 'string' ? item.nombre.trim() : '';
                const unidad = UNIDADES.includes(item.unidad_base) ? item.unidad_base : null;
                const categoria = typeof item.categoria_nombre === 'string'
                    ? item.categoria_nombre.trim()
                    : '';
                const cantidad = Number(item.cantidad);
                const precio = Number(item.precio_total);

                return {
                    producto_id: Number.isInteger(productoId) && productoId > 0 ? productoId : null,
                    nombre,
                    unidad_base: unidad,
                    categoria_nombre: categoria === '' ? null : categoria,
                    cantidad,
                    precio_total: precio,
                };
            })
            .filter((item) => (
                item.nombre !== ''
                && Number.isFinite(item.cantidad)
                && item.cantidad > 0
                && Number.isFinite(item.precio_total)
                && item.precio_total >= 0
            ))
            .slice(0, MAX_ITEMS);
    } catch {
        items = [];
    }

    if (items.length === 0) {
        clearCart();
    }

    return items.length > 0;
}

/**
 * @returns {Array<{producto_id: number|null, nombre: string, unidad_base: string|null, categoria_nombre: string|null, cantidad: number, precio_total: number}>}
 */
export function getItems() {
    return items.slice();
}

export function count() {
    return items.length;
}

export function hasItems() {
    return items.length > 0;
}

export function total() {
    return round(items.reduce((sum, item) => sum + Number(item.precio_total), 0), 2);
}

/**
 * Agrega un producto del catálogo. Por defecto entra con cantidad 1 y precio
 * pendiente; la calculadora puede pasar cantidad e importe ya resueltos.
 *
 * @param {{id: number, nombre: string, unidad_base: string}} product
 * @param {{cantidad?: number, precio_total?: number}} [extra]
 * @returns {boolean}
 */
export function addProduct(product, extra = {}) {
    if (items.length >= MAX_ITEMS) {
        return false;
    }

    const cantidad = Number(extra.cantidad ?? 1);
    const precio = Number(extra.precio_total ?? 0);

    const categoria = typeof product.categoria_nombre === 'string'
        ? product.categoria_nombre.trim()
        : '';

    items.push({
        producto_id: Number(product.id),
        nombre: String(product.nombre),
        unidad_base: UNIDADES.includes(product.unidad_base) ? product.unidad_base : 'pza',
        categoria_nombre: categoria === '' ? null : categoria,
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? round(cantidad, 3) : 1,
        precio_total: Number.isFinite(precio) && precio >= 0 ? round(precio, 2) : 0,
    });
    persist();

    return true;
}

/**
 * @param {number} index
 * @param {{cantidad?: number, precio_total?: number}} patch
 * @returns {boolean}
 */
export function updateItem(index, patch) {
    const item = items[index];

    if (item === undefined) {
        return false;
    }

    if (patch.cantidad !== undefined) {
        const cantidad = Number(patch.cantidad);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
            return false;
        }

        item.cantidad = round(cantidad, 3);
    }

    if (patch.precio_total !== undefined) {
        const precio = Number(patch.precio_total);

        if (!Number.isFinite(precio) || precio < 0) {
            return false;
        }

        item.precio_total = round(precio, 2);
    }

    persist();

    return true;
}

/**
 * @param {number} index
 * @returns {boolean}
 */
export function removeItem(index) {
    if (index < 0 || index >= items.length) {
        return false;
    }

    items.splice(index, 1);
    persist();

    return true;
}

export function clearCart() {
    items = [];

    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nada que hacer si localStorage no está disponible.
    }
}

/**
 * Agrega un ítem libre (sin producto del catálogo) al carrito.
 *
 * @param {{nombre: string, unidad_base?: string, categoria_nombre?: string|null, cantidad?: number, precio_total?: number}} item
 * @returns {boolean}
 */
export function addFreeItem(item) {
    if (items.length >= MAX_ITEMS) {
        return false;
    }

    const nombre = String(item.nombre ?? '').trim();
    const cantidad = Number(item.cantidad ?? 1);
    const precio = Number(item.precio_total ?? 0);

    if (nombre === '' || !Number.isFinite(cantidad) || cantidad <= 0) {
        return false;
    }

    items.push({
        producto_id: null,
        nombre,
        unidad_base: UNIDADES.includes(item.unidad_base) ? item.unidad_base : 'pza',
        categoria_nombre: typeof item.categoria_nombre === 'string' ? item.categoria_nombre : null,
        cantidad: round(cantidad, 3),
        precio_total: Number.isFinite(precio) && precio >= 0 ? round(precio, 2) : 0,
    });
    persist();

    return true;
}

/**
 * Importa varios ítems (por ejemplo, desde Productos por comprar) y suma
 * cantidades cuando el producto ya existe en el carrito.
 *
 * @param {Array<{producto_id?: number|null, nombre: string, unidad_base?: string, categoria_nombre?: string|null, cantidad?: number, precio_total?: number}>} lista
 * @returns {number} cantidad de ítems agregados o fusionados
 */
export function importItems(lista) {
    if (!Array.isArray(lista)) {
        return 0;
    }

    let importados = 0;

    for (const raw of lista) {
        if (!raw || typeof raw !== 'object' || items.length >= MAX_ITEMS) {
            continue;
        }

        const nombre = String(raw.nombre ?? '').trim();
        const cantidad = Number(raw.cantidad ?? 1);
        const unidad = UNIDADES.includes(raw.unidad_base) ? raw.unidad_base : 'pza';

        if (nombre === '' || !Number.isFinite(cantidad) || cantidad <= 0) {
            continue;
        }

        const productoId = raw.producto_id === null || raw.producto_id === undefined
            ? null
            : Number(raw.producto_id);
        const idValido = Number.isInteger(productoId) && productoId > 0 ? productoId : null;
        const existente = items.find((item) => (
            idValido !== null
                ? item.producto_id === idValido
                : item.producto_id === null
                    && item.nombre.toLocaleLowerCase('es-MX') === nombre.toLocaleLowerCase('es-MX')
                    && item.unidad_base === unidad
        ));

        if (existente !== undefined) {
            existente.cantidad = round(existente.cantidad + cantidad, 3);
            importados++;
            continue;
        }

        items.push({
            producto_id: idValido,
            nombre,
            unidad_base: unidad,
            categoria_nombre: typeof raw.categoria_nombre === 'string' ? raw.categoria_nombre : null,
            cantidad: round(cantidad, 3),
            precio_total: 0,
        });
        importados++;
    }

    if (importados > 0) {
        persist();
    }

    return importados;
}
