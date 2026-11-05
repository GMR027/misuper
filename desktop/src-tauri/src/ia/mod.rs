//! Integración de modelos de IA: detección, conexiones y comprobaciones.

pub mod badge;
pub mod bridge;
pub mod dietas;
pub mod extraer;
pub mod gateway;
pub mod hardware;
pub mod importar;
pub mod model;
pub mod probe;
pub mod providers;
pub mod session;
pub mod vision;

use model::{NuevaConexion, Proveedor};
use std::time::{SystemTime, UNIX_EPOCH};

pub fn ahora_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Valida y normaliza los datos que llegan de la interfaz.
pub fn validar_conexion(datos: &mut NuevaConexion) -> Result<(), String> {
    datos.nombre = datos.nombre.trim().to_string();
    datos.modelo = datos.modelo.trim().to_string();

    if datos.nombre.is_empty() {
        return Err("Ponle un nombre a la conexión.".to_string());
    }

    if datos.nombre.chars().count() > 80 {
        return Err("El nombre de la conexión es demasiado largo.".to_string());
    }

    if datos.modelo.is_empty() {
        return Err("Elige un modelo.".to_string());
    }

    if datos.modelo.chars().count() > 200 {
        return Err("El identificador del modelo es demasiado largo.".to_string());
    }

    let modelo_valido = datos
        .modelo
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "-._:/@+#".contains(c));

    if !modelo_valido || datos.modelo.starts_with('-') {
        return Err("El identificador del modelo contiene caracteres no válidos.".to_string());
    }

    if let Some(endpoint) = &datos.endpoint {
        let endpoint = endpoint.trim().trim_end_matches('/');
        if endpoint.is_empty() {
            datos.endpoint = None;
        } else {
            let url = tauri::Url::parse(endpoint)
                .map_err(|_| "La dirección del servidor de IA no es válida.".to_string())?;

            if !matches!(url.scheme(), "http" | "https") {
                return Err("El endpoint de IA debe usar http o https.".to_string());
            }

            datos.endpoint = Some(endpoint.to_string());
        }
    }

    if let Some(comando) = &datos.comando {
        let comando = comando.trim();
        if comando.is_empty() {
            datos.comando = None;
        } else {
            datos.comando = Some(comando.to_string());
        }
    }

    if datos.proveedor != Proveedor::Ollama && datos.endpoint.is_some() {
        datos.endpoint = None;
    }

    Ok(())
}
