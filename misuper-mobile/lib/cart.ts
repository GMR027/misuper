/**
 * The quick-purchase cart. It survives restarts in the app's key/value store,
 * so a half-finished purchase is still there when the app reopens.
 *
 * `precio_total` is the amount paid for that line, as in the web app; the
 * unit price is derived when needed, never stored.
 */

import { createStore, useStore, useStoreSelect } from "@/lib/store";
import { readJson, writeJson } from "@/lib/db";

export type CartUnit = "kg" | "gr" | "L" | "ml" | "pza";

export interface CartItem {
  /** Stable key for the UI; it is not sent to the API. */
  uid: string;
  producto_id: number | null;
  nombre: string;
  unidad_base: CartUnit;
  categoria_nombre: string | null;
  kcal_100: number | null;
  peso_pieza_g: number | null;
  cantidad: number;
  precio_total: number;
}

export interface CartProduct {
  id: number;
  nombre: string;
  unidad_base: string;
  categoria_nombre?: string | null;
  kcal_100?: number | null;
  peso_pieza_g?: number | null;
}

const STORAGE_KEY = "misuper.cart.items";
const UNITS: CartUnit[] = ["kg", "gr", "L", "ml", "pza"];
export const MAX_CART_ITEMS = 100;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function newUid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function unit(value: string | null | undefined): CartUnit {
  return UNITS.includes(value as CartUnit) ? (value as CartUnit) : "pza";
}

function load(): CartItem[] {
  const saved = readJson<unknown>(STORAGE_KEY, []);

  if (!Array.isArray(saved)) return [];

  return saved
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item): CartItem => {
      const productoId = Number(item.producto_id);
      const cantidad = Number(item.cantidad);
      const precio = Number(item.precio_total);

      return {
        uid: typeof item.uid === "string" ? item.uid : newUid(),
        producto_id:
          Number.isInteger(productoId) && productoId > 0 ? productoId : null,
        nombre: typeof item.nombre === "string" ? item.nombre.trim() : "",
        unidad_base: unit(typeof item.unidad_base === "string" ? item.unidad_base : null),
        categoria_nombre:
          typeof item.categoria_nombre === "string" && item.categoria_nombre.trim()
            ? item.categoria_nombre.trim()
            : null,
        kcal_100:
          Number.isFinite(Number(item.kcal_100)) && Number(item.kcal_100) > 0
            ? Number(item.kcal_100)
            : null,
        peso_pieza_g:
          Number.isFinite(Number(item.peso_pieza_g)) && Number(item.peso_pieza_g) > 0
            ? Number(item.peso_pieza_g)
            : null,
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
        precio_total: Number.isFinite(precio) ? precio : 0,
      };
    })
    .filter(
      (item) =>
        item.nombre !== "" && item.cantidad > 0 && item.precio_total >= 0,
    )
    .slice(0, MAX_CART_ITEMS);
}

export const cartStore = createStore<CartItem[]>(load(), (items) => {
  writeJson(STORAGE_KEY, items);
});

/** Adds a catalog product. The same product increments its quantity. */
export function addProduct(
  product: CartProduct,
  extra: { cantidad?: number; precio_total?: number } = {},
): boolean {
  const items = cartStore.get();
  const cantidad = Number(extra.cantidad ?? 1);
  const precio = Number(extra.precio_total ?? 0);
  const existing = items.findIndex((item) => item.producto_id === product.id);

  if (existing >= 0) {
    cartStore.set(
      items.map((item, index) =>
        index === existing
          ? {
              ...item,
              cantidad: round(
                item.cantidad +
                  (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1),
                3,
              ),
            }
          : item,
      ),
    );
    return true;
  }

  if (items.length >= MAX_CART_ITEMS) return false;

  cartStore.set([
    ...items,
    {
      uid: newUid(),
      producto_id: product.id,
      nombre: product.nombre,
      unidad_base: unit(product.unidad_base),
      categoria_nombre: product.categoria_nombre ?? null,
      kcal_100:
        typeof product.kcal_100 === "number" && product.kcal_100 > 0
          ? product.kcal_100
          : null,
      peso_pieza_g:
        typeof product.peso_pieza_g === "number" && product.peso_pieza_g > 0
          ? product.peso_pieza_g
          : null,
      cantidad:
        Number.isFinite(cantidad) && cantidad > 0 ? round(cantidad, 3) : 1,
      precio_total:
        Number.isFinite(precio) && precio >= 0 ? round(precio, 2) : 0,
    },
  ]);

  return true;
}

/** Adds an item that is not in the catalog. */
export function addFreeItem(item: {
  nombre: string;
  unidad_base?: string;
  cantidad?: number;
  precio_total?: number;
}): boolean {
  const nombre = item.nombre.trim();
  const cantidad = Number(item.cantidad ?? 1);
  const precio = Number(item.precio_total ?? 0);

  if (nombre === "" || !Number.isFinite(cantidad) || cantidad <= 0) {
    return false;
  }

  const items = cartStore.get();

  if (items.length >= MAX_CART_ITEMS) return false;

  cartStore.set([
    ...items,
    {
      uid: newUid(),
      producto_id: null,
      nombre,
      unidad_base: unit(item.unidad_base),
      categoria_nombre: null,
      kcal_100: null,
      peso_pieza_g: null,
      cantidad: round(cantidad, 3),
      precio_total:
        Number.isFinite(precio) && precio >= 0 ? round(precio, 2) : 0,
    },
  ]);

  return true;
}

export function updateItem(
  index: number,
  patch: { cantidad?: number; precio_total?: number },
): boolean {
  const items = cartStore.get();

  if (index < 0 || index >= items.length) return false;

  let changed = false;
  const next = items.map((item, current) => {
    if (current !== index) return item;

    const cantidad = patch.cantidad ?? item.cantidad;
    const precio = patch.precio_total ?? item.precio_total;

    if (
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      return item;
    }

    changed = true;
    return {
      ...item,
      cantidad: round(cantidad, 3),
      precio_total: round(precio, 2),
    };
  });

  if (changed) cartStore.set(next);
  return changed;
}

export function removeItem(index: number): boolean {
  const items = cartStore.get();

  if (index < 0 || index >= items.length) return false;

  cartStore.set(items.filter((_, current) => current !== index));
  return true;
}

export function clearCart(): void {
  cartStore.set([]);
}

export function cartTotal(): number {
  return round(
    cartStore.get().reduce((sum, item) => sum + item.precio_total, 0),
    2,
  );
}

export function useCart(): CartItem[] {
  return useStore(cartStore);
}

export function useCartCount(): number {
  return useStoreSelect(cartStore, (items) => items.length);
}

export function useCartTotal(): number {
  return useStoreSelect(cartStore, (items) =>
    round(items.reduce((sum, item) => sum + item.precio_total, 0), 2),
  );
}
