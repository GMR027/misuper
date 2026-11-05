//! Respaldo con visión para recuperar títulos que el texto no conserva.
//!
//! Renderiza una página del PDF a imagen y pregunta a un modelo con visión de
//! Ollama. Si no hay ninguno instalado, devuelve una instrucción clara.

use base64::Engine;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const PROMPT: &str = "Mira esta página de un libro de recetas. Devuelve únicamente un JSON con la forma {\"titulo\": \"...\"} usando el nombre del platillo o de la receta que aparece como título principal. No inventes: si no hay un título visible, devuelve {\"titulo\": \"\"}. Responde solo el JSON, sin explicaciones.";

const FAMILIAS_VISION: &[&str] = &[
    "llava",
    "bakllava",
    "minicpm-v",
    "qwen2.5vl",
    "qwen2.5-vl",
    "qwen2-vl",
    "qwen2vl",
    "llama3.2-vision",
    "moondream",
    "gemma3",
];

pub async fn titulo(ruta: &str, pagina: u32, endpoint: Option<&str>) -> Result<String, String> {
    let endpoint = endpoint
        .unwrap_or("http://127.0.0.1:11434")
        .trim()
        .trim_end_matches('/');

    let modelo = modelo_vision(endpoint).await?;
    let imagen = renderizar_pagina(ruta, pagina)?;
    let bytes = std::fs::read(&imagen)
        .map_err(|error| format!("No se pudo leer la imagen de la página: {error}"))?;
    let _ = std::fs::remove_file(&imagen);

    if bytes.is_empty() {
        return Err("La página no se pudo convertir en imagen.".to_string());
    }

    let base64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    let cliente = reqwest::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| format!("No se pudo preparar la petición de visión: {error}"))?;

    let cuerpo = json!({
        "model": modelo,
        "messages": [{
            "role": "user",
            "content": PROMPT,
            "images": [base64]
        }],
        "stream": false,
        "format": "json",
        "options": { "temperature": 0 }
    });

    let respuesta = cliente
        .post(format!("{endpoint}/api/chat"))
        .json(&cuerpo)
        .send()
        .await
        .map_err(|error| format!("No se pudo consultar el modelo de visión: {error}"))?;

    let estado = respuesta.status();
    let texto = respuesta
        .text()
        .await
        .map_err(|error| format!("No se pudo leer la respuesta de visión: {error}"))?;

    if !estado.is_success() {
        return Err(format!(
            "Ollama respondió HTTP {estado} al usar visión: {}",
            recortar(&texto, 300)
        ));
    }

    let json: Value = serde_json::from_str(&texto)
        .map_err(|error| format!("La respuesta de visión no es JSON: {error}"))?;

    let contenido = json
        .get("message")
        .and_then(|mensaje| mensaje.get("content"))
        .and_then(Value::as_str)
        .ok_or_else(|| "El modelo de visión no devolvió contenido.".to_string())?;

    let titulo = extraer_titulo(contenido).unwrap_or_default();

    if titulo.trim().is_empty() {
        return Err("La visión no encontró un título claro en la página.".to_string());
    }

    Ok(titulo.trim().to_string())
}

async fn modelo_vision(endpoint: &str) -> Result<String, String> {
    let cliente = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("No se pudo preparar la consulta a Ollama: {error}"))?;

    let respuesta = cliente
        .get(format!("{endpoint}/api/tags"))
        .send()
        .await
        .map_err(|error| {
            format!("No se pudo consultar Ollama en {endpoint}: {error}. ¿Está en marcha?")
        })?;

    if !respuesta.status().is_success() {
        return Err(format!(
            "Ollama respondió HTTP {} al listar modelos.",
            respuesta.status()
        ));
    }

    let json: Value = respuesta
        .json()
        .await
        .map_err(|error| format!("Respuesta inválida de Ollama: {error}"))?;

    let modelos = json
        .get("models")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for modelo in modelos {
        let Some(nombre) = modelo.get("name").and_then(Value::as_str) else {
            continue;
        };

        let bajo = nombre.to_lowercase();

        if FAMILIAS_VISION.iter().any(|familia| bajo.contains(familia)) {
            return Ok(nombre.to_string());
        }
    }

    Err(
        "No hay un modelo con visión instalado en Ollama. Instala uno con: ollama pull qwen2.5vl:7b"
            .to_string(),
    )
}

fn renderizar_pagina(ruta: &str, pagina: u32) -> Result<PathBuf, String> {
    let prefijo = std::env::temp_dir().join(format!("misuper-vision-{}", uuid::Uuid::new_v4()));

    let salida = Command::new("pdftoppm")
        .args(["-f", &pagina.to_string(), "-l", &pagina.to_string()])
        .args(["-r", "120", "-png", "-singlefile"])
        .arg(ruta)
        .arg(&prefijo)
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "Falta la herramienta «pdftoppm». Instala poppler-utils.".to_string()
            } else {
                format!("No se pudo convertir la página en imagen: {error}")
            }
        })?;

    if !salida.status.success() {
        return Err(format!(
            "pdftoppm no pudo renderizar la página: {}",
            recortar(&String::from_utf8_lossy(&salida.stderr), 300)
        ));
    }

    let imagen = PathBuf::from(format!("{}.png", prefijo.display()));

    if !imagen.exists() {
        return Err("No se generó la imagen de la página.".to_string());
    }

    Ok(imagen)
}

fn extraer_titulo(contenido: &str) -> Option<String> {
    let inicio = contenido.find('{')?;
    let fin = contenido.rfind('}')?;
    let json: Value = serde_json::from_str(&contenido[inicio..=fin]).ok()?;

    json.get("titulo")
        .or_else(|| json.get("title"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn recortar(texto: &str, maximo: usize) -> String {
    let limpio = texto.trim();

    if limpio.chars().count() <= maximo {
        limpio.to_string()
    } else {
        let recortado: String = limpio.chars().take(maximo).collect();
        format!("{recortado}…")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "consulta Ollama y renderiza una página real"]
    async fn informa_si_no_hay_modelo_de_vision() {
        let ruta = format!(
            "{}/../tests/fixtures/libros/recetario_cocina_gallega.pdf",
            env!("CARGO_MANIFEST_DIR")
        );

        match titulo(&ruta, 5, None).await {
            Ok(titulo) => println!("visión: {titulo}"),
            Err(error) => println!("visión no disponible: {error}"),
        }
    }

    #[test]
    fn extrae_el_titulo_del_json() {
        assert_eq!(
            extraer_titulo("{\"titulo\": \"Ensalada Caprese\"}"),
            Some("Ensalada Caprese".to_string())
        );
        assert_eq!(
            extraer_titulo("Claro: {\"title\": \"Arancini\"}"),
            Some("Arancini".to_string())
        );
        assert_eq!(extraer_titulo("sin json"), None);
    }
}
