/**
 * Tickets captured without signal.
 *
 * The photo is copied out of the picker's cache as soon as it is taken, then
 * uploaded when the phone can reach the server. The server runs OCR and
 * returns the editable proposal, which is cached with the row so the review
 * still works without a connection. Confirming always needs the server: it
 * creates the purchase.
 */

import { Directory, File, Paths } from "expo-file-system";
import {
  ApiError,
  apiErrorMessage,
  apiFetch,
  apiUpload,
  getApiUrl,
  isOfflineError,
} from "@/lib/api";
import { getDatabase } from "@/lib/offline/schema";
import { nuevoUuid } from "@/lib/offline/uuid";
import { createStore, useStore } from "@/lib/store";

export interface TicketItemProposal {
  nombre: string;
  cantidad: number;
  precio_total: number;
  producto_id: number | null;
  producto_nombre: string | null;
  unidad_base: string;
}

export interface TicketProposal {
  ticket: {
    id: number;
    titulo: string;
    estado: string;
    total_detectado: number | null;
  };
  titulo: string;
  fecha: string;
  total_detectado: number | null;
  total_suma: number;
  items: TicketItemProposal[];
  texto: string;
}

export type EstadoTicket = "capturado" | "subiendo" | "subido" | "error";

export interface TicketPendiente {
  id: number;
  uuid: string;
  archivo: string;
  titulo: string | null;
  estado: EstadoTicket;
  ticketId: number | null;
  propuesta: TicketProposal | null;
  creadoEn: string;
  intentos: number;
  ultimoIntento: number | null;
  ultimoError: string | null;
}

export interface TicketAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

interface FilaTicket {
  id: number;
  uuid: string;
  archivo: string;
  titulo: string | null;
  estado: EstadoTicket;
  ticket_id: number | null;
  propuesta: string | null;
  creado_en: string;
  intentos: number;
  ultimo_intento: number | null;
  ultimo_error: string | null;
}

const CARPETA = "tickets";
/** Photos kept on the phone before the user has to sync or discard. */
export const MAX_PENDIENTES = 30;
/** The health probe gives up quickly; the upload itself may take a minute. */
const PROBE_MS = 4_000;
const MAX_ESPERA_SEGUNDOS = 3600;

const pendientesStore = createStore<TicketPendiente[]>([]);

export function useTicketsPendientes(): TicketPendiente[] {
  return useStore(pendientesStore);
}

export async function listarTicketsPendientes(): Promise<TicketPendiente[]> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<FilaTicket>(
    "SELECT * FROM tickets_pendientes ORDER BY id ASC",
  );

  return filas.map(aTicketPendiente);
}

export async function refrescarTicketsPendientes(): Promise<TicketPendiente[]> {
  const lista = await listarTicketsPendientes();
  pendientesStore.set(lista);

  return lista;
}

/** Copies the photo out of the picker's cache and queues it. */
export async function capturarTicket(asset: TicketAsset): Promise<TicketPendiente> {
  const uuid = nuevoUuid();
  const archivo = await copiarArchivo(asset.uri, uuid);
  const db = await getDatabase();

  const resultado = await db.runAsync(
    `INSERT INTO tickets_pendientes (uuid, archivo, titulo, estado, creado_en)
     VALUES (?, ?, ?, 'capturado', ?)`,
    uuid,
    archivo,
    asset.fileName ?? null,
    new Date().toISOString(),
  );

  await refrescarTicketsPendientes();

  const pendiente = await buscarTicketPendiente(Number(resultado.lastInsertRowId));

  if (pendiente === null) {
    throw new Error("No se pudo guardar el ticket.");
  }

  return pendiente;
}

export async function buscarTicketPendiente(
  id: number,
): Promise<TicketPendiente | null> {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<FilaTicket>(
    "SELECT * FROM tickets_pendientes WHERE id = ?",
    id,
  );

  return fila === null ? null : aTicketPendiente(fila);
}

/**
 * Uploads one ticket and caches the proposal. Offline and 5xx keep it queued;
 * a 4xx marks it as an error for the user to decide. The UUID makes a retried
 * upload return the ticket already created instead of duplicating it.
 */
export async function subirTicketPendiente(id: number): Promise<TicketPendiente> {
  const pendiente = await buscarTicketPendiente(id);

  if (pendiente === null) {
    throw new Error("El ticket ya no existe.");
  }

  if (pendiente.estado === "subido") {
    return pendiente;
  }

  const db = await getDatabase();

  await db.runAsync(
    "UPDATE tickets_pendientes SET estado = 'subiendo', ultimo_error = NULL WHERE id = ?",
    id,
  );
  await refrescarTicketsPendientes();

  try {
    const form = new FormData();
    form.append(
      "foto",
      {
        uri: pendiente.archivo,
        name: `${pendiente.uuid}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob,
    );
    form.append("cliente_uuid", pendiente.uuid);

    const propuesta = await apiUpload<TicketProposal>("/api/tickets", form);

    await db.runAsync(
      `UPDATE tickets_pendientes
       SET estado = 'subido', ticket_id = ?, propuesta = ?,
           intentos = intentos + 1, ultimo_intento = ?
       WHERE id = ?`,
      propuesta.ticket.id,
      JSON.stringify(propuesta),
      Date.now(),
      id,
    );

    const actualizado = await buscarTicketPendiente(id);
    await refrescarTicketsPendientes();

    if (actualizado === null) {
      throw new Error("No se pudo leer el ticket recién subido.");
    }

    return actualizado;
  } catch (error) {
    const reintentar =
      isOfflineError(error) ||
      (error instanceof ApiError && (error.status >= 500 || error.status === 429));

    await db.runAsync(
      `UPDATE tickets_pendientes
       SET estado = ?, intentos = intentos + 1, ultimo_intento = ?, ultimo_error = ?
       WHERE id = ?`,
      reintentar ? "capturado" : "error",
      Date.now(),
      apiErrorMessage(error),
      id,
    );

    await refrescarTicketsPendientes();
    throw error;
  }
}

export async function descartarTicketPendiente(id: number): Promise<void> {
  const pendiente = await buscarTicketPendiente(id);

  if (pendiente === null) {
    return;
  }

  const db = await getDatabase();
  await db.runAsync("DELETE FROM tickets_pendientes WHERE id = ?", id);
  borrarArchivo(pendiente.archivo);
  await refrescarTicketsPendientes();

  // Remove the ticket the server created, so it does not stay orphaned.
  if (pendiente.ticketId !== null) {
    try {
      await apiFetch<{ deleted: boolean }>(`/api/tickets/${pendiente.ticketId}`, {
        method: "DELETE",
      });
    } catch {
      // Offline or already gone; the local copy is what the user sees.
    }
  }
}

/** Called after the confirmation created the purchase. */
export async function marcarTicketConfirmado(id: number): Promise<void> {
  const pendiente = await buscarTicketPendiente(id);

  if (pendiente === null) {
    return;
  }

  const db = await getDatabase();
  await db.runAsync("DELETE FROM tickets_pendientes WHERE id = ?", id);
  borrarArchivo(pendiente.archivo);
  await refrescarTicketsPendientes();
}

/** Removes pending tickets and their photos; used when the session ends. */
export async function limpiarTicketsPendientes(): Promise<void> {
  const pendientes = await listarTicketsPendientes();

  for (const pendiente of pendientes) {
    borrarArchivo(pendiente.archivo);
  }

  const db = await getDatabase();
  await db.execAsync("DELETE FROM tickets_pendientes;");
  pendientesStore.set([]);
}

let enCurso: Promise<void> | null = null;

/** Uploads the queued tickets one at a time: OCR is slow on the server. */
export function flushTickets(): Promise<void> {
  if (enCurso !== null) {
    return enCurso;
  }

  enCurso = ejecutar().finally(() => {
    enCurso = null;
  });

  return enCurso;
}

async function ejecutar(): Promise<void> {
  const pendientes = await listarTicketsPendientes();
  // `subiendo` only exists while an upload runs; if the app was killed
  // mid-upload the row stays that way, so it counts as queued again.
  const enEspera = pendientes.filter(
    (pendiente) =>
      (pendiente.estado === "capturado" || pendiente.estado === "subiendo") &&
      !esperando(pendiente),
  );

  if (enEspera.length === 0) {
    return;
  }

  if (!(await puedeSubir())) {
    return;
  }

  for (const pendiente of enEspera) {
    try {
      await subirTicketPendiente(pendiente.id);
    } catch (error) {
      // No signal, or the server's hourly limit: the next ones would fail too.
      if (
        isOfflineError(error) ||
        (error instanceof ApiError && error.status === 429)
      ) {
        break;
      }
      // A 4xx is already recorded on the row; keep with the next one.
    }
  }
}

/** A fast reachability check, so a dead network does not hang for minutes. */
export async function puedeSubir(): Promise<boolean> {
  const base = getApiUrl();

  if (!base) {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_MS);

  try {
    const respuesta = await fetch(`${base}/api/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    return respuesta.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function esperando(pendiente: TicketPendiente): boolean {
  if (pendiente.intentos === 0 || pendiente.ultimoIntento === null) {
    return false;
  }

  const esperaSegundos = Math.min(
    MAX_ESPERA_SEGUNDOS,
    60 * 2 ** (pendiente.intentos - 1),
  );

  return Date.now() - pendiente.ultimoIntento < esperaSegundos * 1000;
}

async function copiarArchivo(origen: string, uuid: string): Promise<string> {
  const carpeta = new Directory(Paths.document, CARPETA);

  if (!carpeta.exists) {
    carpeta.create({ idempotent: true, intermediates: true });
  }

  const destino = new File(carpeta, `${uuid}.jpg`);
  await new File(origen).copy(destino);

  return destino.uri;
}

function borrarArchivo(ruta: string): void {
  try {
    const archivo = new File(ruta);

    if (archivo.exists) {
      archivo.delete();
    }
  } catch {
    // The file may already be gone.
  }
}

function aTicketPendiente(fila: FilaTicket): TicketPendiente {
  return {
    id: fila.id,
    uuid: fila.uuid,
    archivo: fila.archivo,
    titulo: fila.titulo,
    estado: fila.estado,
    ticketId: fila.ticket_id,
    propuesta: parsearPropuesta(fila.propuesta),
    creadoEn: fila.creado_en,
    intentos: fila.intentos,
    ultimoIntento: fila.ultimo_intento,
    ultimoError: fila.ultimo_error,
  };
}

function parsearPropuesta(raw: string | null): TicketProposal | null {
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as TicketProposal;
  } catch {
    return null;
  }
}
