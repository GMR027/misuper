/**
 * Iconos de Bootstrap Icons asociados a las categorías de productos.
 */

export const CATEGORIA_ICONS = {
    todas: 'bi-grid-fill',
    lacteos: 'bi-droplet-half',
    carnes: 'bi-egg-fried',
    'frutas y verduras': 'bi-apple',
    'cereales y legumbres': 'bi-basket2-fill',
    bebidas: 'bi-cup-straw',
    limpieza: 'bi-brush-fill',
    hogar: 'bi-house-door-fill',
    otros: 'bi-box-seam',
};

/**
 * Icono de Bootstrap Icons para una categoría, con respaldo genérico.
 *
 * @param {string} label
 * @returns {string}
 */
export function iconoCategoria(label) {
    const key = String(label ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    return CATEGORIA_ICONS[key] ?? 'bi-tag-fill';
}
