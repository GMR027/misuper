//! Persistencia local (SQLite) de Mi Súper.
//!
//! El esquema es un espejo del MySQL de la web. En esta primera etapa la
//! importación reemplaza catálogos (productos, recetas, tipos y categorías) y
//! hace upsert de las compras por id.

use misuper_core::{normalizar, Stats};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("error de base de datos: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("dato inválido en la importación: {0}")]
    Invalido(String),
}

pub type Result<T> = std::result::Result<T, StoreError>;

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'usuario',
    avatar_tipo TEXT,
    avatar_valor TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY,
    nombre TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER,
    nombre TEXT NOT NULL,
    nombre_norm TEXT NOT NULL,
    categoria_id INTEGER NOT NULL,
    unidad_base TEXT NOT NULL,
    imagen_url TEXT,
    imagen_estado TEXT,
    imagen_verificada_at TEXT,
    estado TEXT NOT NULL DEFAULT 'activo',
    created_at TEXT,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_productos_norm ON productos (nombre_norm);

CREATE TABLE IF NOT EXISTS compras (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras (fecha DESC);

CREATE TABLE IF NOT EXISTS compra_items (
    id INTEGER PRIMARY KEY,
    compra_id INTEGER NOT NULL,
    producto_id INTEGER,
    nombre_libre TEXT,
    nombre TEXT NOT NULL DEFAULT '',
    unidad_base TEXT,
    cantidad REAL NOT NULL DEFAULT 0,
    precio_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (compra_id) REFERENCES compras (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_items_compra ON compra_items (compra_id);

CREATE TABLE IF NOT EXISTS tipos_recetas (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    icono TEXT NOT NULL DEFAULT 'bi-tag',
    aviso TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categorias_recetas (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    icono TEXT NOT NULL DEFAULT 'bi-tag',
    orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recetas (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    tipos TEXT NOT NULL DEFAULT '[]',
    categoria_id INTEGER,
    porciones_base INTEGER NOT NULL DEFAULT 4,
    tiempo_min INTEGER NOT NULL DEFAULT 30,
    dificultad TEXT NOT NULL DEFAULT 'facil',
    ingredientes TEXT NOT NULL DEFAULT '[]',
    pasos TEXT NOT NULL DEFAULT '[]',
    imagen_url TEXT,
    video_youtube_id TEXT,
    video_titulo TEXT,
    estado TEXT NOT NULL DEFAULT 'publicada',
    creada_por INTEGER,
    created_at TEXT,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_recetas_nombre ON recetas (nombre);

CREATE TABLE IF NOT EXISTS receta_favoritos (
    usuario_id INTEGER NOT NULL,
    receta_id INTEGER NOT NULL,
    PRIMARY KEY (usuario_id, receta_id)
);

CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    contenido TEXT NOT NULL DEFAULT '',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS nota_fotos (
    id INTEGER PRIMARY KEY,
    nota_id INTEGER NOT NULL,
    ruta TEXT NOT NULL,
    FOREIGN KEY (nota_id) REFERENCES notas (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listas_compra (
    id INTEGER PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS lista_compra_items (
    id INTEGER PRIMARY KEY,
    lista_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    producto_id INTEGER,
    nombre TEXT NOT NULL,
    cantidad REAL NOT NULL DEFAULT 0,
    unidad_base TEXT NOT NULL DEFAULT 'pza',
    origen TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    categoria_nombre TEXT,
    imagen_url TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (lista_id) REFERENCES listas_compra (id) ON DELETE CASCADE
);
"#;

#[derive(Debug, Clone, Serialize)]
pub struct ProductoFila {
    pub id: i64,
    pub nombre: String,
    pub categoria_id: i64,
    pub categoria_nombre: Option<String>,
    pub unidad_base: String,
    pub imagen_url: Option<String>,
    pub estado: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompraFila {
    pub id: i64,
    pub fecha: String,
    pub total: f64,
    pub items_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CategoriaFila {
    pub id: i64,
    pub nombre: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompraItemFila {
    pub id: i64,
    pub producto_id: Option<i64>,
    pub nombre: String,
    pub unidad_base: Option<String>,
    pub cantidad: f64,
    pub precio_total: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompraDetalle {
    pub id: i64,
    pub fecha: String,
    pub total: f64,
    pub items: Vec<CompraItemFila>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompraPagina {
    pub items: Vec<CompraFila>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

pub struct Store {
    conn: Connection,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| StoreError::Invalido(e.to_string()))?;
        }

        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;

        Ok(Self { conn })
    }

    pub fn stats(&self) -> Result<Stats> {
        let row = self.conn.query_row(
            "SELECT
                (SELECT COUNT(*) FROM productos),
                (SELECT COUNT(*) FROM recetas),
                (SELECT COUNT(*) FROM compras),
                (SELECT COUNT(*) FROM compra_items),
                (SELECT COUNT(*) FROM categorias),
                (SELECT COUNT(*) FROM tipos_recetas),
                (SELECT COUNT(*) FROM categorias_recetas)",
            [],
            |r| {
                Ok(Stats {
                    productos: r.get(0)?,
                    recetas: r.get(1)?,
                    compras: r.get(2)?,
                    items: r.get(3)?,
                    categorias: r.get(4)?,
                    tipos_recetas: r.get(5)?,
                    categorias_recetas: r.get(6)?,
                })
            },
        )?;

        Ok(row)
    }

    pub fn ultima_importacion(&self) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row(
                "SELECT value FROM meta WHERE key = 'ultima_importacion'",
                [],
                |r| r.get::<_, String>(0),
            )
            .optional()?)
    }

    pub fn set_meta(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// Importa un snapshot con la forma que devuelve `misuper_sync`.
    pub fn importar(&mut self, snapshot: &Value) -> Result<Stats> {
        let tx = self.conn.transaction()?;

        if let Some(usuarios) = snapshot.get("usuarios").and_then(Value::as_array) {
            tx.execute("DELETE FROM usuarios", [])?;
            for usuario in usuarios {
                tx.execute(
                    "INSERT INTO usuarios (id, nombre, email, rol, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        int(usuario, "id"),
                        text(usuario, "nombre"),
                        text(usuario, "email"),
                        text_or(usuario, "rol", "usuario"),
                        opt_text(usuario, "created_at"),
                    ],
                )?;
            }
        } else if let Some(usuario) = snapshot.get("usuario") {
            tx.execute(
                "INSERT INTO usuarios (id, nombre, email, rol, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(id) DO UPDATE SET
                    nombre = excluded.nombre,
                    email = excluded.email,
                    rol = excluded.rol",
                params![
                    int(usuario, "id"),
                    text(usuario, "nombre"),
                    text(usuario, "email"),
                    text_or(usuario, "rol", "usuario"),
                    opt_text(usuario, "created_at"),
                ],
            )?;
        }

        tx.execute("DELETE FROM categorias", [])?;
        for c in array(snapshot, "categorias") {
            tx.execute(
                "INSERT INTO categorias (id, nombre) VALUES (?1, ?2)",
                params![int(c, "id"), text(c, "nombre")],
            )?;
        }

        tx.execute("DELETE FROM productos", [])?;
        for p in array(snapshot, "productos") {
            let nombre = text(p, "nombre");
            tx.execute(
                "INSERT INTO productos
                    (id, usuario_id, nombre, nombre_norm, categoria_id, unidad_base,
                     imagen_url, imagen_estado, imagen_verificada_at, estado, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    int(p, "id"),
                    opt_int(p, "usuario_id"),
                    nombre,
                    normalizar(&nombre),
                    int(p, "categoria_id"),
                    text(p, "unidad_base"),
                    opt_text(p, "imagen_url"),
                    opt_text(p, "imagen_estado"),
                    opt_text(p, "imagen_verificada_at"),
                    text_or(p, "estado", "activo"),
                    opt_text(p, "created_at"),
                    opt_text(p, "updated_at"),
                ],
            )?;
        }

        tx.execute("DELETE FROM tipos_recetas", [])?;
        for t in array(snapshot, "tipos_recetas") {
            tx.execute(
                "INSERT INTO tipos_recetas (id, slug, nombre, descripcion, icono, aviso)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    int(t, "id"),
                    text(t, "slug"),
                    text(t, "nombre"),
                    text_or(t, "descripcion", ""),
                    text_or(t, "icono", "bi-tag"),
                    text_or(t, "aviso", ""),
                ],
            )?;
        }

        tx.execute("DELETE FROM categorias_recetas", [])?;
        for c in array(snapshot, "categorias_recetas") {
            tx.execute(
                "INSERT INTO categorias_recetas (id, slug, nombre, descripcion, icono, orden)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    int(c, "id"),
                    text(c, "slug"),
                    text(c, "nombre"),
                    text_or(c, "descripcion", ""),
                    text_or(c, "icono", "bi-tag"),
                    int_or(c, "orden", 0),
                ],
            )?;
        }

        tx.execute("DELETE FROM recetas", [])?;
        for r in array(snapshot, "recetas") {
            tx.execute(
                "INSERT INTO recetas
                    (id, slug, nombre, descripcion, tipos, categoria_id, porciones_base,
                     tiempo_min, dificultad, ingredientes, pasos, imagen_url,
                     video_youtube_id, video_titulo, estado, creada_por, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
                params![
                    int(r, "id"),
                    text(r, "slug"),
                    text(r, "nombre"),
                    text_or(r, "descripcion", ""),
                    json_field(r, "tipos"),
                    opt_int(r, "categoria_id"),
                    int_or(r, "porciones_base", 4),
                    int_or(r, "tiempo_min", 30),
                    text_or(r, "dificultad", "facil"),
                    json_field(r, "ingredientes"),
                    json_field(r, "pasos"),
                    opt_text(r, "imagen_url"),
                    opt_text(r, "video_youtube_id"),
                    opt_text(r, "video_titulo"),
                    text_or(r, "estado", "publicada"),
                    opt_int(r, "creada_por"),
                    opt_text(r, "created_at"),
                    opt_text(r, "updated_at"),
                ],
            )?;
        }

        // Favoritos del usuario actual.
        tx.execute("DELETE FROM receta_favoritos", [])?;
        let usuario_id = snapshot
            .get("usuario")
            .map(|u| int(u, "id"))
            .unwrap_or(0);
        for favorito in array(snapshot, "favoritos") {
            let receta_id = favorito.as_i64().unwrap_or_else(|| int(&favorito, "id"));
            if receta_id > 0 {
                tx.execute(
                    "INSERT OR IGNORE INTO receta_favoritos (usuario_id, receta_id)
                     VALUES (?1, ?2)",
                    params![usuario_id, receta_id],
                )?;
            }
        }

        // Notas y sus fotos.
        tx.execute("DELETE FROM nota_fotos", [])?;
        tx.execute("DELETE FROM notas", [])?;
        for nota in array(snapshot, "notas") {
            let nota_id = int(nota, "id");
            tx.execute(
                "INSERT INTO notas (id, usuario_id, titulo, contenido, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    nota_id,
                    int_or(nota, "usuario_id", usuario_id),
                    text_or(nota, "titulo", ""),
                    text_or(nota, "contenido", ""),
                    opt_text(nota, "created_at"),
                    opt_text(nota, "updated_at"),
                ],
            )?;
            for foto in array(nota, "fotos") {
                tx.execute(
                    "INSERT INTO nota_fotos (id, nota_id, ruta) VALUES (?1, ?2, ?3)",
                    params![int(foto, "id"), nota_id, text(foto, "ruta")],
                )?;
            }
        }

        // Listas de compras y sus ítems.
        tx.execute("DELETE FROM lista_compra_items", [])?;
        tx.execute("DELETE FROM listas_compra", [])?;
        for lista in array(snapshot, "listas") {
            let lista_id = int(lista, "id");
            tx.execute(
                "INSERT INTO listas_compra (id, usuario_id, nombre, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    lista_id,
                    int_or(lista, "usuario_id", usuario_id),
                    text_or(lista, "nombre", "Lista"),
                    opt_text(lista, "created_at"),
                    opt_text(lista, "updated_at"),
                ],
            )?;
            for item in array(lista, "items") {
                tx.execute(
                    "INSERT INTO lista_compra_items
                        (id, lista_id, usuario_id, producto_id, nombre, cantidad, unidad_base,
                         origen, estado, categoria_nombre, imagen_url, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        int(item, "id"),
                        lista_id,
                        int_or(item, "usuario_id", usuario_id),
                        opt_int(item, "producto_id"),
                        text_or(item, "nombre", ""),
                        float(item, "cantidad"),
                        text_or(item, "unidad_base", "pza"),
                        opt_text(item, "origen"),
                        text_or(item, "estado", "pendiente"),
                        opt_text(item, "categoria_nombre"),
                        opt_text(item, "imagen_url"),
                        opt_text(item, "created_at"),
                        opt_text(item, "updated_at"),
                    ],
                )?;
            }
        }

        for compra in array(snapshot, "compras") {
            let compra_id = int(compra, "id");
            tx.execute(
                "INSERT INTO compras (id, usuario_id, fecha, total, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    usuario_id = excluded.usuario_id,
                    fecha = excluded.fecha,
                    total = excluded.total,
                    updated_at = excluded.updated_at",
                params![
                    compra_id,
                    int_or(compra, "usuario_id", 0),
                    text(compra, "fecha"),
                    float(compra, "total"),
                    opt_text(compra, "created_at"),
                    opt_text(compra, "updated_at"),
                ],
            )?;

            tx.execute(
                "DELETE FROM compra_items WHERE compra_id = ?1",
                params![compra_id],
            )?;

            for item in array(compra, "items") {
                tx.execute(
                    "INSERT INTO compra_items
                        (id, compra_id, producto_id, nombre_libre, nombre, unidad_base,
                         cantidad, precio_total)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        int(item, "id"),
                        compra_id,
                        opt_int(item, "producto_id"),
                        opt_text(item, "nombre_libre"),
                        text_or(item, "nombre", ""),
                        opt_text(item, "unidad_base"),
                        float(item, "cantidad"),
                        float(item, "precio_total"),
                    ],
                )?;
            }
        }

        tx.commit()?;
        Ok(self.stats()?)
    }

    pub fn categorias(&self) -> Result<Vec<CategoriaFila>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, nombre FROM categorias ORDER BY nombre ASC")?;
        let filas = stmt
            .query_map([], |r| {
                Ok(CategoriaFila {
                    id: r.get(0)?,
                    nombre: r.get(1)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(filas)
    }

    pub fn buscar_productos(
        &self,
        q: &str,
        categoria: Option<i64>,
        limite: i64,
    ) -> Result<Vec<ProductoFila>> {
        let q = normalizar(q);
        let like = format!("%{q}%");

        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.nombre, p.categoria_id, c.nombre, p.unidad_base, p.imagen_url, p.estado
             FROM productos p
             LEFT JOIN categorias c ON c.id = p.categoria_id
             WHERE p.estado = 'activo'
               AND (?1 = '' OR p.nombre_norm LIKE ?2)
               AND (?3 IS NULL OR p.categoria_id = ?3)
             ORDER BY p.nombre ASC
             LIMIT ?4",
        )?;

        let filas = stmt
            .query_map(params![q, like, categoria, limite], |r| {
                Ok(ProductoFila {
                    id: r.get(0)?,
                    nombre: r.get(1)?,
                    categoria_id: r.get(2)?,
                    categoria_nombre: r.get(3)?,
                    unidad_base: r.get(4)?,
                    imagen_url: r.get(5)?,
                    estado: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(filas)
    }

    pub fn frecuentes(&self, limite: i64) -> Result<Vec<ProductoFila>> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.nombre, p.categoria_id, c.nombre, p.unidad_base, p.imagen_url, p.estado,
                    COUNT(ci.id) AS veces
             FROM compra_items ci
             INNER JOIN productos p ON p.id = ci.producto_id
             LEFT JOIN categorias c ON c.id = p.categoria_id
             WHERE p.estado = 'activo'
             GROUP BY p.id, p.nombre, p.categoria_id, c.nombre, p.unidad_base, p.imagen_url, p.estado
             ORDER BY veces DESC, p.nombre ASC
             LIMIT ?1",
        )?;

        let filas = stmt
            .query_map(params![limite], |r| {
                Ok(ProductoFila {
                    id: r.get(0)?,
                    nombre: r.get(1)?,
                    categoria_id: r.get(2)?,
                    categoria_nombre: r.get(3)?,
                    unidad_base: r.get(4)?,
                    imagen_url: r.get(5)?,
                    estado: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(filas)
    }

    pub fn compras_pagina(&self, page: i64, per_page: i64) -> Result<CompraPagina> {
        let page = page.max(1);
        let per_page = per_page.clamp(1, 100);
        let total: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM compras", [], |r| r.get(0))?;

        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.fecha, c.total,
                    (SELECT COUNT(*) FROM compra_items ci WHERE ci.compra_id = c.id)
             FROM compras c
             ORDER BY c.fecha DESC, c.id DESC
             LIMIT ?1 OFFSET ?2",
        )?;

        let items = stmt
            .query_map(params![per_page, (page - 1) * per_page], |r| {
                Ok(CompraFila {
                    id: r.get(0)?,
                    fecha: r.get(1)?,
                    total: r.get(2)?,
                    items_count: r.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(CompraPagina {
            items,
            total,
            page,
            per_page,
        })
    }

    pub fn compra_detalle(&self, id: i64) -> Result<Option<CompraDetalle>> {
        let compra = self
            .conn
            .query_row(
                "SELECT id, fecha, total FROM compras WHERE id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, f64>(2)?,
                    ))
                },
            )
            .optional()?;

        let Some((id, fecha, total)) = compra else {
            return Ok(None);
        };

        let mut stmt = self.conn.prepare(
            "SELECT id, producto_id, nombre, unidad_base, cantidad, precio_total
             FROM compra_items WHERE compra_id = ?1 ORDER BY id ASC",
        )?;

        let items = stmt
            .query_map(params![id], |r| {
                Ok(CompraItemFila {
                    id: r.get(0)?,
                    producto_id: r.get(1)?,
                    nombre: r.get(2)?,
                    unidad_base: r.get(3)?,
                    cantidad: r.get(4)?,
                    precio_total: r.get(5)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(Some(CompraDetalle {
            id,
            fecha,
            total,
            items,
        }))
    }

    /// Reemplaza una compra local con el detalle devuelto por la web.
    pub fn reemplazar_compra(&mut self, compra: &Value) -> Result<()> {
        let tx = self.conn.transaction()?;
        let id = int(compra, "id");

        let total = compra
            .get("total")
            .and_then(|v| v.as_f64())
            .unwrap_or_else(|| {
                array(compra, "items")
                    .iter()
                    .map(|i| float(i, "precio_total"))
                    .sum()
            });

        tx.execute(
            "INSERT INTO compras (id, usuario_id, fecha, total, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                fecha = excluded.fecha,
                total = excluded.total,
                updated_at = excluded.updated_at",
            params![
                id,
                int_or(compra, "usuario_id", 0),
                text(compra, "fecha"),
                total,
                opt_text(compra, "created_at"),
                opt_text(compra, "updated_at"),
            ],
        )?;

        tx.execute("DELETE FROM compra_items WHERE compra_id = ?1", params![id])?;

        for item in array(compra, "items") {
            tx.execute(
                "INSERT INTO compra_items
                    (id, compra_id, producto_id, nombre_libre, nombre, unidad_base,
                     cantidad, precio_total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    int(item, "id"),
                    id,
                    opt_int(item, "producto_id"),
                    opt_text(item, "nombre_libre"),
                    text_or(item, "nombre", ""),
                    opt_text(item, "unidad_base"),
                    float(item, "cantidad"),
                    float(item, "precio_total"),
                ],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn eliminar_compra(&mut self, id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM compras WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn compras_recientes(&self, limite: i64) -> Result<Vec<CompraFila>> {
        let mut stmt = self.conn.prepare(
            "SELECT c.id, c.fecha, c.total,
                    (SELECT COUNT(*) FROM compra_items ci WHERE ci.compra_id = c.id)
             FROM compras c
             ORDER BY c.fecha DESC, c.id DESC
             LIMIT ?1",
        )?;

        let filas = stmt
            .query_map(params![limite], |r| {
                Ok(CompraFila {
                    id: r.get(0)?,
                    fecha: r.get(1)?,
                    total: r.get(2)?,
                    items_count: r.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(filas)
    }

    pub fn recetas_destacadas(&self, limite: i64) -> Result<Vec<(i64, String, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT r.id, r.nombre, COALESCE(cr.nombre, '') 
             FROM recetas r
             LEFT JOIN categorias_recetas cr ON cr.id = r.categoria_id
             WHERE r.estado = 'publicada'
             ORDER BY r.nombre ASC
             LIMIT ?1",
        )?;

        let filas = stmt
            .query_map(params![limite], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(filas)
    }
}

fn array<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v.get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn int(v: &Value, key: &str) -> i64 {
    v.get(key).and_then(Value::as_i64).unwrap_or(0)
}

fn int_or(v: &Value, key: &str, default: i64) -> i64 {
    v.get(key).and_then(Value::as_i64).unwrap_or(default)
}

fn opt_int(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(Value::as_i64)
}

fn float(v: &Value, key: &str) -> f64 {
    v.get(key)
        .and_then(|x| x.as_f64().or_else(|| x.as_str().and_then(|s| s.parse().ok())))
        .unwrap_or(0.0)
}

fn text(v: &Value, key: &str) -> String {
    match v.get(key) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        _ => String::new(),
    }
}

fn text_or(v: &Value, key: &str, default: &str) -> String {
    let t = text(v, key);
    if t.is_empty() {
        default.to_string()
    } else {
        t
    }
}

fn opt_text(v: &Value, key: &str) -> Option<String> {
    match v.get(key) {
        Some(Value::String(s)) if !s.is_empty() => Some(s.clone()),
        Some(Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
}

fn json_field(v: &Value, key: &str) -> String {
    match v.get(key) {
        Some(Value::String(s)) => s.clone(),
        Some(otro) => serde_json::to_string(otro).unwrap_or_else(|_| "[]".to_string()),
        None => "[]".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    fn temp_store() -> (Store, PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "misuper-test-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        (Store::open(&path).unwrap(), path)
    }

    #[test]
    fn importa_y_consulta() {
        let (mut store, path) = temp_store();

        let snapshot = json!({
            "usuario": {"id": 1, "nombre": "Admin", "email": "a@b.c", "rol": "admin"},
            "categorias": [{"id": 1, "nombre": "Frutas"}],
            "productos": [{
                "id": 10, "nombre": "Plátano", "categoria_id": 1,
                "unidad_base": "kg", "imagen_url": null, "estado": "activo"
            }],
            "tipos_recetas": [],
            "categorias_recetas": [],
            "recetas": [],
            "compras": [{
                "id": 5, "usuario_id": 1, "fecha": "2026-11-01", "total": 25.5,
                "items": [{
                    "id": 7, "producto_id": 10, "nombre": "Plátano",
                    "unidad_base": "kg", "cantidad": 1.5, "precio_total": 25.5
                }]
            }]
        });

        let stats = store.importar(&snapshot).unwrap();
        assert_eq!(stats.productos, 1);
        assert_eq!(stats.compras, 1);
        assert_eq!(stats.items, 1);

        let encontrados = store.buscar_productos("platano", None, 10).unwrap();
        assert_eq!(encontrados.len(), 1);
        assert_eq!(encontrados[0].nombre, "Plátano");

        let compras = store.compras_recientes(10).unwrap();
        assert_eq!(compras.len(), 1);
        assert_eq!(compras[0].total, 25.5);

        drop(store);
        let _ = std::fs::remove_file(path);
    }
}
