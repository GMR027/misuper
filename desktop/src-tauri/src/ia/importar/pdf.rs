//! Extracción de texto de un PDF local usando `pdftotext` (poppler-utils).

use std::path::PathBuf;
use std::process::Command;

const LIMITE_BYTES: u64 = 300 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct Pagina {
    pub numero: u32,
    pub lineas: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct Documento {
    pub ruta: PathBuf,
    pub nombre: String,
    pub paginas: Vec<Pagina>,
}

pub fn leer(ruta: &str) -> Result<Documento, String> {
    let ruta = PathBuf::from(ruta.trim());

    if ruta.as_os_str().is_empty() {
        return Err("No se indicó ningún archivo.".to_string());
    }

    let metadatos = std::fs::metadata(&ruta).map_err(|error| {
        format!(
            "No se pudo abrir «{}»: {error}",
            ruta.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| ruta.display().to_string())
        )
    })?;

    if !metadatos.is_file() {
        return Err("La ruta indicada no es un archivo.".to_string());
    }

    if metadatos.len() > LIMITE_BYTES {
        return Err("El PDF supera los 300 MB. Divídelo o usa una copia más ligera.".to_string());
    }

    let extension = ruta
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if extension != "pdf" {
        return Err("Por ahora solo se pueden importar archivos PDF.".to_string());
    }

    let salida = Command::new("pdftotext")
        .args(["-layout", "-enc", "UTF-8"])
        .arg(&ruta)
        .arg("-")
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "Falta la herramienta «pdftotext». Instala poppler-utils para importar PDF."
                    .to_string()
            } else {
                format!("No se pudo ejecutar pdftotext: {error}")
            }
        })?;

    if !salida.status.success() {
        let detalle = String::from_utf8_lossy(&salida.stderr);
        return Err(format!(
            "pdftotext no pudo leer el archivo: {}",
            recortar(detalle.trim(), 300)
        ));
    }

    let texto = String::from_utf8_lossy(&salida.stdout).replace("\r\n", "\n");
    let paginas = partir_paginas(&texto);

    if paginas.is_empty() {
        return Err("El PDF no contiene texto extraíble.".to_string());
    }

    let nombre = ruta
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| "Libro".to_string());

    Ok(Documento {
        ruta,
        nombre,
        paginas,
    })
}

fn partir_paginas(texto: &str) -> Vec<Pagina> {
    let mut paginas = Vec::new();

    for (indice, bloque) in texto.split('\u{000c}').enumerate() {
        let lineas: Vec<String> = bloque
            .replace('\u{00a0}', " ")
            .lines()
            .map(|linea| linea.trim_end().to_string())
            .collect();

        // pdftotext agrega un salto de página al final; no lo contamos como
        // página vacía.
        let tiene_contenido = lineas.iter().any(|linea| !linea.trim().is_empty());

        if !tiene_contenido {
            continue;
        }

        paginas.push(Pagina {
            numero: (indice + 1) as u32,
            lineas,
        });
    }

    paginas
}

fn recortar(texto: &str, maximo: usize) -> String {
    if texto.chars().count() <= maximo {
        texto.to_string()
    } else {
        let recortado: String = texto.chars().take(maximo).collect();
        format!("{recortado}…")
    }
}
