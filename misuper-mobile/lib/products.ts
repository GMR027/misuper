/** Shared product shapes and image URL resolution for the quick screen. */

import { getApiUrl } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatars";

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  nombre: string;
  categoria_id: number;
  categoria_nombre?: string | null;
  unidad_base: string;
  imagen_url: string | null;
  kcal_100?: number | null;
  peso_pieza_g?: number | null;
  ultimo_precio?: number | null;
  precio_muestras?: number;
  precio_fecha?: string | null;
  precio_viejo?: boolean;
  precio_origen?: string | null;
  veces_comprado?: number;
}

/** The remote image, or null when the product has none. */
export function productImage(product: Producto): string | null {
  return resolveMediaUrl(product.imagen_url, getApiUrl());
}

/** The first letter used by image placeholders. */
export function productInitial(product: Producto): string {
  return product.nombre.trim().charAt(0).toUpperCase() || "?";
}
