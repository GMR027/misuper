/**
 * The phone's copy of the catalog.
 *
 * Settings already live in SQLite through the key/value API; this is a second
 * database so the catalog can be queried, counted and rewritten in bulk. The
 * cart stays in the key/value store and is not touched here.
 *
 * Everything in this database is derived from the server, so a schema change
 * simply drops and refills it instead of migrating rows.
 */

import * as SQLite from "expo-sqlite";

const FILE = "misuper.db";
const SCHEMA_VERSION = 3;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** The shared connection; the schema is created on first use. */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (opening === null) {
    opening = open();
  }

  return opening;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(FILE);

  await db.execAsync("PRAGMA journal_mode = WAL;");

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const actual = row?.user_version ?? 0;

  if (actual !== SCHEMA_VERSION) {
    // Derived data: cheaper and safer to drop it than to migrate it.
    await db.execAsync(`
      DROP TABLE IF EXISTS productos;
      DROP TABLE IF EXISTS categorias;
      DROP TABLE IF EXISTS frecuentes;
      DROP TABLE IF EXISTS precios;
      DROP TABLE IF EXISTS outbox;
      DROP TABLE IF EXISTS tickets_pendientes;
      DROP TABLE IF EXISTS meta;
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      nombre_normalizado TEXT NOT NULL,
      nombre_orden TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      unidad_base TEXT NOT NULL,
      imagen_url TEXT,
      kcal_100 REAL,
      peso_pieza_g REAL
    );

    CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (categoria_id);
    CREATE INDEX IF NOT EXISTS idx_productos_normalizado ON productos (nombre_normalizado);
    CREATE INDEX IF NOT EXISTS idx_productos_orden ON productos (nombre_orden);

    CREATE TABLE IF NOT EXISTS frecuentes (
      producto_id INTEGER PRIMARY KEY,
      orden INTEGER NOT NULL,
      veces INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS precios (
      producto_id INTEGER PRIMARY KEY,
      ultimo_precio REAL NOT NULL,
      fecha TEXT
    );

    -- Compras guardadas sin red, a la espera de subir. La columna bloqueado
    -- marca las que el servidor rechazó y necesitan que el usuario decida.
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      uuid TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      creado_en TEXT NOT NULL,
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_intento INTEGER,
      ultimo_error TEXT,
      bloqueado INTEGER NOT NULL DEFAULT 0
    );

    -- Tickets fotografiados sin red. La foto vive en documentDirectory/tickets;
    -- la propuesta se guarda al volver la conexion para revisarla sin senal.
    CREATE TABLE IF NOT EXISTS tickets_pendientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      archivo TEXT NOT NULL,
      titulo TEXT,
      estado TEXT NOT NULL,
      ticket_id INTEGER,
      propuesta TEXT,
      creado_en TEXT NOT NULL,
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_intento INTEGER,
      ultimo_error TEXT
    );
  `);

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);

  return db;
}

export async function leerMeta(clave: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ valor: string }>(
    "SELECT valor FROM meta WHERE clave = ?",
    clave,
  );

  return row?.valor ?? null;
}

/**
 * Empties everything that belongs to the signed-in account, keeping settings
 * and the cart (the cart is cleared separately by `clearSession`).
 */
export async function resetOfflineData(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    DELETE FROM productos;
    DELETE FROM categorias;
    DELETE FROM frecuentes;
    DELETE FROM precios;
    DELETE FROM outbox;
    DELETE FROM tickets_pendientes;
    DELETE FROM meta;
  `);
}
