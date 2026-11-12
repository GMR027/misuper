/**
 * Purchases saved without signal.
 *
 * Each save is one row with a `cliente_uuid`; the server returns the existing
 * purchase if the same UUID arrives twice, so a retry never duplicates. Rows
 * are retried in order, with a backoff, until they upload or the server
 * rejects them and the user decides what to do.
 */

import { ApiError, apiErrorMessage, apiFetch, isOfflineError } from "@/lib/api";
import { getDatabase } from "@/lib/offline/schema";
import { createStore, useStore } from "@/lib/store";

export interface CompraItemPayload {
  producto_id?: number;
  nombre_libre?: string;
  unidad_base: string;
  cantidad: number;
  precio_total: number;
}

export interface CompraPayload {
  fecha: string;
  comercio: string;
  cliente_uuid: string;
  items: CompraItemPayload[];
}

export interface CompraPendiente {
  id: number;
  uuid: string;
  fecha: string;
  comercio: string;
  itemsCount: number;
  total: number;
  intentos: number;
  ultimoError: string | null;
  bloqueado: boolean;
}

export interface FlushResultado {
  enviados: number;
  pendientes: number;
  bloqueados: number;
}

interface FilaOutbox {
  id: number;
  uuid: string;
  payload: string;
  creado_en: string;
  intentos: number;
  ultimo_intento: number | null;
  ultimo_error: string | null;
  bloqueado: number;
}

/** Backoff: 1, 2, 4, 8… minutes, never more than an hour. */
const MAX_ESPERA_SEGUNDOS = 3600;
const MAX_POR_TANDA = 20;

const pendientesStore = createStore(0);

export function usePendientes(): number {
  return useStore(pendientesStore);
}

export async function contarPendientes(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM outbox",
  );

  return Number(row?.total ?? 0);
}

/** Re-reads the badge count; call after anything that changes the queue. */
export async function refrescarPendientes(): Promise<number> {
  const total = await contarPendientes();
  pendientesStore.set(total);

  return total;
}

export async function encolarCompra(payload: CompraPayload): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO outbox (tipo, uuid, payload, creado_en)
     VALUES ('compra', ?, ?, ?)`,
    payload.cliente_uuid,
    JSON.stringify(payload),
    new Date().toISOString(),
  );

  await refrescarPendientes();
}

export async function listarPendientes(): Promise<CompraPendiente[]> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<FilaOutbox>(
    "SELECT * FROM outbox ORDER BY id ASC",
  );

  return filas.map((fila) => {
    const payload = leerPayload(fila.payload);
    const items = payload?.items ?? [];

    return {
      id: fila.id,
      uuid: fila.uuid,
      fecha: payload?.fecha ?? "",
      comercio: payload?.comercio ?? "",
      itemsCount: items.length,
      total: items.reduce((suma, item) => suma + Number(item.precio_total), 0),
      intentos: fila.intentos,
      ultimoError: fila.ultimo_error,
      bloqueado: fila.bloqueado === 1,
    };
  });
}

export async function descartarPendiente(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM outbox WHERE id = ?", id);
  await refrescarPendientes();
}

let enCurso: Promise<FlushResultado> | null = null;

/**
 * Uploads what is due. `forzar` ignores the backoff, for the manual button.
 * One flush runs at a time; concurrent callers share the same promise.
 */
export function flushOutbox({
  forzar = false,
}: {
  forzar?: boolean;
} = {}): Promise<FlushResultado> {
  if (enCurso !== null) {
    return enCurso;
  }

  enCurso = ejecutar(forzar).finally(() => {
    enCurso = null;
  });

  return enCurso;
}

async function ejecutar(forzar: boolean): Promise<FlushResultado> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<FilaOutbox>(
    `SELECT * FROM outbox
     WHERE bloqueado = 0
     ORDER BY id ASC
     LIMIT ${MAX_POR_TANDA}`,
  );

  let enviados = 0;
  let bloqueados = 0;

  for (const fila of filas) {
    if (!forzar && esperando(fila)) {
      continue;
    }

    const payload = leerPayload(fila.payload);

    if (payload === null) {
      await bloquear(db, fila.id, "El contenido guardado no es válido.");
      bloqueados += 1;
      continue;
    }

    try {
      await apiFetch<{ id: number }>("/api/compras", {
        method: "POST",
        body: payload,
      });

      await db.runAsync("DELETE FROM outbox WHERE id = ?", fila.id);
      enviados += 1;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        break;
      }

      if (isOfflineError(error) || (error instanceof ApiError && error.status >= 500)) {
        // No signal or the server is down: the rest would fail the same way.
        await anotarIntento(db, fila.id, apiErrorMessage(error));
        break;
      }

      await bloquear(db, fila.id, apiErrorMessage(error));
      bloqueados += 1;
    }
  }

  const pendientes = await refrescarPendientes();

  return { enviados, pendientes, bloqueados };
}

function esperando(fila: FilaOutbox): boolean {
  if (fila.intentos === 0 || fila.ultimo_intento === null) {
    return false;
  }

  const esperaSegundos = Math.min(
    MAX_ESPERA_SEGUNDOS,
    60 * 2 ** (fila.intentos - 1),
  );

  return Date.now() - fila.ultimo_intento < esperaSegundos * 1000;
}

function leerPayload(raw: string): CompraPayload | null {
  try {
    const data = JSON.parse(raw) as CompraPayload;

    if (
      typeof data?.fecha !== "string" ||
      typeof data?.cliente_uuid !== "string" ||
      !Array.isArray(data?.items) ||
      data.items.length === 0
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

type BaseDatos = Awaited<ReturnType<typeof getDatabase>>;

async function anotarIntento(
  db: BaseDatos,
  id: number,
  error: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox
     SET intentos = intentos + 1, ultimo_intento = ?, ultimo_error = ?
     WHERE id = ?`,
    Date.now(),
    error,
    id,
  );
}

async function bloquear(
  db: BaseDatos,
  id: number,
  error: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE outbox
     SET bloqueado = 1, intentos = intentos + 1, ultimo_intento = ?, ultimo_error = ?
     WHERE id = ?`,
    Date.now(),
    error,
    id,
  );
}
