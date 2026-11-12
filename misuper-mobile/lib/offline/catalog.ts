/**
 * The local catalog: one snapshot download, cached prices and offline search.
 *
 * The server decides whether the snapshot changed (`version`); when it did
 * not, nothing is rewritten. Prices are not part of the snapshot because every
 * purchase would change its version, so they are remembered opportunistically
 * from the normal search and frequent responses.
 */

import { apiFetch, isOfflineError } from "@/lib/api";
import { normalizarBusqueda } from "@/lib/offline/normalize";
import {
  getDatabase,
  leerMeta,
} from "@/lib/offline/schema";
import type { Categoria, Producto } from "@/lib/products";
import { ordenarCoincidencias } from "@/lib/voice/match";

/** Same page size as `CompraService::PER_PAGE`. */
const PER_PAGE = 20;

const VERSION_KEY = "catalogo.version";

interface ProductoRemoto extends Producto {
  nombre_normalizado: string;
  nombre_orden: string;
}

interface SnapshotRemoto {
  version: string;
  sin_cambios: boolean;
  generado_en?: string;
  categorias?: Categoria[];
  productos?: ProductoRemoto[];
}

export interface BusquedaProductos {
  items: Producto[];
  total: number;
  page: number;
  per_page: number;
  /** Where the answer came from; the UI shows an offline hint for "local". */
  fuente: "red" | "local";
  /** Offline and the catalog was never downloaded on this phone. */
  sin_catalogo?: boolean;
}

interface FilaProducto {
  id: number;
  nombre: string;
  categoria_id: number;
  categoria_nombre: string;
  unidad_base: string;
  imagen_url: string | null;
  kcal_100: number | null;
  peso_pieza_g: number | null;
  ultimo_precio: number | null;
}

/**
 * Brings the local copy up to date. Returns true when the catalog was
 * rewritten, false when the version already matched.
 */
export async function syncCatalogo(): Promise<boolean> {
  const version = await leerMeta(VERSION_KEY);
  const path =
    version === null
      ? "/api/mobile/catalogo"
      : `/api/mobile/catalogo?version=${encodeURIComponent(version)}`;

  const data = await apiFetch<SnapshotRemoto>(path);

  if (data.sin_cambios) {
    return false;
  }

  const categorias = data.categorias ?? [];
  const productos = data.productos ?? [];
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM productos; DELETE FROM categorias;");

    const insertCategoria = await db.prepareAsync(
      "INSERT INTO categorias (id, nombre) VALUES (?, ?)",
    );
    const insertProducto = await db.prepareAsync(
      `INSERT INTO productos (
         id, nombre, nombre_normalizado, nombre_orden, categoria_id,
         unidad_base, imagen_url, kcal_100, peso_pieza_g
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    try {
      for (const categoria of categorias) {
        await insertCategoria.executeAsync(categoria.id, categoria.nombre);
      }

      for (const producto of productos) {
        await insertProducto.executeAsync(
          producto.id,
          producto.nombre,
          producto.nombre_normalizado,
          producto.nombre_orden,
          producto.categoria_id,
          producto.unidad_base,
          producto.imagen_url,
          producto.kcal_100 ?? null,
          producto.peso_pieza_g ?? null,
        );
      }
    } finally {
      await insertCategoria.finalizeAsync();
      await insertProducto.finalizeAsync();
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO meta (clave, valor) VALUES (?, ?)",
      VERSION_KEY,
      data.version,
    );
  });

  return true;
}

/** Refreshes the frecuentes snapshot and returns what the server sent. */
export async function syncFrecuentes(): Promise<Producto[]> {
  const items = await apiFetch<Producto[]>("/api/productos/frecuentes");

  if (!Array.isArray(items)) {
    return [];
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM frecuentes;");

    const insert = await db.prepareAsync(
      "INSERT INTO frecuentes (producto_id, orden, veces) VALUES (?, ?, ?)",
    );

    try {
      for (const [index, producto] of items.entries()) {
        await insert.executeAsync(
          producto.id,
          index,
          producto.veces_comprado ?? 0,
        );
      }
    } finally {
      await insert.finalizeAsync();
    }
  });

  void recordarPrecios(items);

  return items;
}

export async function leerCategorias(): Promise<Categoria[]> {
  const db = await getDatabase();

  return db.getAllAsync<Categoria>(
    "SELECT id, nombre FROM categorias ORDER BY nombre ASC",
  );
}

export async function leerFrecuentes(): Promise<Producto[]> {
  const db = await getDatabase();

  const filas = await db.getAllAsync<FilaProducto>(
    `SELECT p.id, p.nombre, p.categoria_id, c.nombre AS categoria_nombre,
            p.unidad_base, p.imagen_url, p.kcal_100, p.peso_pieza_g,
            pr.ultimo_precio
     FROM frecuentes f
     INNER JOIN productos p ON p.id = f.producto_id
     INNER JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN precios pr ON pr.producto_id = p.id
     ORDER BY f.orden ASC`,
  );

  return filas.map(aProducto);
}

/**
 * Online search with a local fallback. When the request never reaches the
 * server the phone answers from its own copy, so the store's basement still
 * works.
 */
export async function buscarProductos(
  q: string,
  categoriaId: number | null,
  page: number,
): Promise<BusquedaProductos> {
  const params = new URLSearchParams();

  if (q !== "") {
    params.set("q", q);
  }

  if (categoriaId !== null) {
    params.set("categoria_id", String(categoriaId));
  }

  params.set("page", String(page));

  try {
    const data = await apiFetch<Omit<BusquedaProductos, "fuente">>(
      `/api/productos/buscar?${params.toString()}`,
    );

    void recordarPrecios(data.items);

    return { ...data, fuente: "red" };
  } catch (error) {
    if (!isOfflineError(error)) {
      throw error;
    }

    return buscarLocal(q, categoriaId, page);
  }
}

async function buscarLocal(
  q: string,
  categoriaId: number | null,
  page: number,
): Promise<BusquedaProductos> {
  const db = await getDatabase();
  const version = await leerMeta(VERSION_KEY);

  if (version === null) {
    return {
      items: [],
      total: 0,
      page,
      per_page: PER_PAGE,
      fuente: "local",
      sin_catalogo: true,
    };
  }

  const where: string[] = [];
  const params: (string | number)[] = [];
  // Full-phrase match, like the server's LIKE over the normalized name.
  const termino = normalizarBusqueda(q);

  if (termino !== "") {
    where.push("p.nombre_normalizado LIKE ?");
    params.push(`%${termino}%`);
  }

  if (categoriaId !== null) {
    where.push("p.categoria_id = ?");
    params.push(categoriaId);
  }

  const filtro = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const offset = Math.max(0, (page - 1) * PER_PAGE);

  const conteo = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM productos p ${filtro}`,
    ...params,
  );

  const filas = await db.getAllAsync<FilaProducto>(
    `SELECT p.id, p.nombre, p.categoria_id, c.nombre AS categoria_nombre,
            p.unidad_base, p.imagen_url, p.kcal_100, p.peso_pieza_g,
            pr.ultimo_precio
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN precios pr ON pr.producto_id = p.id
     ${filtro}
     ORDER BY p.nombre_orden ASC, p.id ASC
     LIMIT ? OFFSET ?`,
    ...params,
    PER_PAGE,
    offset,
  );

  return {
    items: filas.map(aProducto),
    total: Number(conteo?.total ?? 0),
    page,
    per_page: PER_PAGE,
    fuente: "local",
  };
}

export interface CoincidenciaVoz {
  producto: Producto;
  puntaje: number;
}

/**
 * Ranks the local catalog against a spoken name. The voice sheet shows the
 * best candidates and asks when two of them are tied instead of guessing.
 */
export async function buscarParaVoz(
  nombre: string,
  limite = 4,
): Promise<CoincidenciaVoz[]> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<FilaProducto>(
    `SELECT p.id, p.nombre, p.categoria_id, c.nombre AS categoria_nombre,
            p.unidad_base, p.imagen_url, p.kcal_100, p.peso_pieza_g,
            pr.ultimo_precio
     FROM productos p
     INNER JOIN categorias c ON c.id = p.categoria_id
     LEFT JOIN precios pr ON pr.producto_id = p.id`,
  );

  return ordenarCoincidencias(
    nombre,
    filas.map(aProducto),
    limite,
  );
}

function aProducto(fila: FilaProducto): Producto {
  return {
    id: fila.id,
    nombre: fila.nombre,
    categoria_id: fila.categoria_id,
    categoria_nombre: fila.categoria_nombre,
    unidad_base: fila.unidad_base,
    imagen_url: fila.imagen_url,
    kcal_100: fila.kcal_100,
    peso_pieza_g: fila.peso_pieza_g,
    ultimo_precio: fila.ultimo_precio,
  };
}

/** Keeps the last price seen for each product; never breaks a search. */
async function recordarPrecios(items: Producto[]): Promise<void> {
  const conPrecio = items.filter(
    (producto) =>
      typeof producto.ultimo_precio === "number" && producto.ultimo_precio > 0,
  );

  if (conPrecio.length === 0) {
    return;
  }

  try {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      const upsert = await db.prepareAsync(
        "INSERT OR REPLACE INTO precios (producto_id, ultimo_precio, fecha) VALUES (?, ?, ?)",
      );

      try {
        for (const producto of conPrecio) {
          await upsert.executeAsync(
            producto.id,
            producto.ultimo_precio ?? null,
            producto.precio_fecha ?? null,
          );
        }
      } finally {
        await upsert.finalizeAsync();
      }
    });
  } catch {
    // Prices are a nicety; the search itself already succeeded.
  }
}

export { PER_PAGE };
