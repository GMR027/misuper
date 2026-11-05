//! Llamadas de completion a la conexión de IA activa.

use crate::ia::model::{ConexionIa, Proveedor};
use crate::ia::providers::{buscar_comando, ejecutar};
use serde_json::{json, Value};
use std::time::Duration;

pub async fn completar(conexion: &ConexionIa, prompt: &str) -> Result<String, String> {
    match conexion.proveedor {
        Proveedor::Ollama => completar_ollama(conexion, prompt).await,
        Proveedor::Opencode => completar_opencode(conexion, prompt).await,
        Proveedor::Claude => completar_claude(conexion, prompt).await,
    }
}

async fn completar_ollama(conexion: &ConexionIa, prompt: &str) -> Result<String, String> {
    let endpoint = conexion
        .endpoint
        .as_deref()
        .unwrap_or("http://127.0.0.1:11434")
        .trim()
        .trim_end_matches('/');

    let cliente = reqwest::Client::builder()
        .timeout(Duration::from_secs(240))
        .build()
        .map_err(|error| format!("No se pudo preparar la petición a Ollama: {error}"))?;

    let cuerpo = json!({
        "model": conexion.modelo,
        "messages": [{ "role": "user", "content": prompt }],
        "stream": false,
        "format": "json",
        "options": { "temperature": 0.1 }
    });

    let respuesta = cliente
        .post(format!("{endpoint}/api/chat"))
        .json(&cuerpo)
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con Ollama: {error}"))?;

    let estado = respuesta.status();
    let texto = respuesta
        .text()
        .await
        .map_err(|error| format!("No se pudo leer la respuesta de Ollama: {error}"))?;

    if !estado.is_success() {
        return Err(format!(
            "Ollama respondió HTTP {estado}: {}",
            recortar(&texto, 300)
        ));
    }

    let json: Value = serde_json::from_str(&texto)
        .map_err(|error| format!("Respuesta inválida de Ollama: {error}"))?;

    json.get("message")
        .and_then(|mensaje| mensaje.get("content"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Ollama no devolvió contenido.".to_string())
}

async fn completar_opencode(conexion: &ConexionIa, prompt: &str) -> Result<String, String> {
    let comando = conexion
        .comando
        .as_deref()
        .map(std::path::PathBuf::from)
        .or_else(|| buscar_comando("opencode"))
        .ok_or_else(|| "No se encontró el CLI de opencode.".to_string())?;

    let argumentos = vec![
        "run".to_string(),
        "-m".to_string(),
        conexion.modelo.clone(),
        "--format".to_string(),
        "json".to_string(),
        prompt.to_string(),
    ];

    let salida = ejecutar(&comando, &argumentos, 240).await?;

    if salida.codigo != Some(0) {
        return Err(format!(
            "opencode terminó con código {}: {}",
            salida
                .codigo
                .map(|codigo| codigo.to_string())
                .unwrap_or_else(|| "desconocido".to_string()),
            recortar(salida.stderr.trim(), 400)
        ));
    }

    let textos = texto_opencode(&salida.stdout);

    if textos.trim().is_empty() {
        return Err("opencode no devolvió texto.".to_string());
    }

    Ok(textos)
}

async fn completar_claude(conexion: &ConexionIa, prompt: &str) -> Result<String, String> {
    let comando = conexion
        .comando
        .as_deref()
        .map(std::path::PathBuf::from)
        .or_else(|| buscar_comando("claude"))
        .ok_or_else(|| "No se encontró el CLI de Claude Code.".to_string())?;

    let argumentos = vec![
        "-p".to_string(),
        prompt.to_string(),
        "--model".to_string(),
        conexion.modelo.clone(),
        "--output-format".to_string(),
        "json".to_string(),
    ];

    let salida = ejecutar(&comando, &argumentos, 240).await?;

    if salida.codigo != Some(0) {
        return Err(format!(
            "Claude Code terminó con código {}: {}",
            salida
                .codigo
                .map(|codigo| codigo.to_string())
                .unwrap_or_else(|| "desconocido".to_string()),
            recortar(salida.stderr.trim(), 400)
        ));
    }

    let json =
        extraer_json(&salida.stdout).ok_or_else(|| "Claude Code no devolvió JSON.".to_string())?;

    if json.get("is_error").and_then(Value::as_bool) == Some(true) {
        return Err(format!(
            "Claude Code devolvió un error: {}",
            json.get("result")
                .and_then(Value::as_str)
                .unwrap_or("sin detalle")
        ));
    }

    json.get("result")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "Claude Code no devolvió contenido.".to_string())
}

fn texto_opencode(salida: &str) -> String {
    let mut textos = Vec::new();

    for linea in salida.lines() {
        let linea = linea.trim();

        if linea.is_empty() {
            continue;
        }

        let Ok(json) = serde_json::from_str::<Value>(linea) else {
            continue;
        };

        if let Some(texto) = json.get("text").and_then(Value::as_str) {
            textos.push(texto.to_string());
        } else if let Some(texto) = json
            .get("part")
            .and_then(|parte| parte.get("text"))
            .and_then(Value::as_str)
        {
            textos.push(texto.to_string());
        }
    }

    if textos.is_empty() {
        salida.trim().to_string()
    } else {
        textos.join("\n")
    }
}

fn extraer_json(texto: &str) -> Option<Value> {
    let inicio = texto.find('{')?;
    let fin = texto.rfind('}')?;

    if fin <= inicio {
        return None;
    }

    serde_json::from_str(&texto[inicio..=fin]).ok()
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
