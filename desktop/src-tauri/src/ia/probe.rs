//! Comprobaciones reales contra el modelo de una conexión.

use super::model::{ConexionIa, Proveedor, ResultadoPrueba};
use super::providers::{buscar_comando, ejecutar, recortar};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const PROMPT_PRUEBA: &str = "Responde únicamente con la palabra OK.";

pub async fn probar(conexion: &ConexionIa) -> ResultadoPrueba {
    let inicio = Instant::now();

    let resultado = match conexion.proveedor {
        Proveedor::Ollama => probar_ollama(conexion).await,
        Proveedor::Opencode => probar_opencode(conexion).await,
        Proveedor::Claude => probar_claude(conexion).await,
    };

    let latencia_ms = Some(inicio.elapsed().as_millis() as u64);

    match resultado {
        Ok(mensaje) => ResultadoPrueba {
            ok: true,
            mensaje,
            detalle: None,
            latencia_ms,
            fecha_ms: super::ahora_ms(),
        },
        Err(error) => ResultadoPrueba {
            ok: false,
            mensaje: recortar(&error, 400),
            detalle: Some(error),
            latencia_ms,
            fecha_ms: super::ahora_ms(),
        },
    }
}

async fn probar_ollama(conexion: &ConexionIa) -> Result<String, String> {
    let endpoint = conexion
        .endpoint
        .as_deref()
        .unwrap_or("http://127.0.0.1:11434")
        .trim()
        .trim_end_matches('/');

    let cliente = reqwest::Client::builder()
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|error| format!("No se pudo preparar la conexión HTTP: {error}"))?;

    let cuerpo = json!({
        "model": conexion.modelo,
        "messages": [
            { "role": "user", "content": PROMPT_PRUEBA }
        ],
        "stream": false,
        "options": { "num_predict": 16, "temperature": 0 }
    });

    let respuesta = cliente
        .post(format!("{endpoint}/api/chat"))
        .json(&cuerpo)
        .send()
        .await
        .map_err(|error| format!("No se pudo conectar con Ollama en {endpoint}: {error}"))?;

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
        .map_err(|error| format!("Ollama devolvió una respuesta inválida: {error}"))?;

    if let Some(error) = json.get("error").and_then(Value::as_str) {
        return Err(format!("Ollama devolvió un error: {error}"));
    }

    let contenido = json
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(Value::as_str)
        .or_else(|| json.get("response").and_then(Value::as_str))
        .unwrap_or("");

    if contenido.trim().is_empty() {
        return Err("Ollama respondió sin contenido.".to_string());
    }

    Ok(format!(
        "Ollama respondió correctamente: {}",
        recortar(contenido.trim(), 120)
    ))
}

async fn probar_opencode(conexion: &ConexionIa) -> Result<String, String> {
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
        PROMPT_PRUEBA.to_string(),
    ];

    let salida = ejecutar(&comando, &argumentos, 150).await?;

    if salida.codigo != Some(0) {
        let detalle = if salida.stderr.trim().is_empty() {
            salida.stdout.clone()
        } else {
            salida.stderr.clone()
        };

        return Err(format!(
            "opencode terminó con código {}: {}",
            salida
                .codigo
                .map(|c| c.to_string())
                .unwrap_or_else(|| "desconocido".to_string()),
            recortar(detalle.trim(), 400)
        ));
    }

    let texto = texto_opencode(&salida.stdout);

    if texto.trim().is_empty() {
        return Err("opencode terminó correctamente pero no devolvió texto.".to_string());
    }

    if texto.to_lowercase().contains("error") && !texto.to_lowercase().contains("ok") {
        return Err(format!(
            "opencode devolvió un posible error: {}",
            recortar(texto.trim(), 400)
        ));
    }

    Ok(format!(
        "opencode respondió correctamente: {}",
        recortar(texto.trim(), 120)
    ))
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
            .and_then(|p| p.get("text"))
            .and_then(Value::as_str)
        {
            textos.push(texto.to_string());
        }
    }

    if textos.is_empty() {
        salida.trim().to_string()
    } else {
        textos.join(" ")
    }
}

async fn probar_claude(conexion: &ConexionIa) -> Result<String, String> {
    let comando = conexion
        .comando
        .as_deref()
        .map(std::path::PathBuf::from)
        .or_else(|| buscar_comando("claude"))
        .ok_or_else(|| "No se encontró el CLI de Claude Code.".to_string())?;

    let argumentos = vec![
        "-p".to_string(),
        PROMPT_PRUEBA.to_string(),
        "--model".to_string(),
        conexion.modelo.clone(),
        "--output-format".to_string(),
        "json".to_string(),
    ];

    let salida = ejecutar(&comando, &argumentos, 150).await?;

    if salida.codigo != Some(0) {
        return Err(format!(
            "Claude Code terminó con código {}: {}",
            salida
                .codigo
                .map(|c| c.to_string())
                .unwrap_or_else(|| "desconocido".to_string()),
            recortar(salida.stderr.trim(), 400)
        ));
    }

    let json = extraer_json(&salida.stdout)
        .ok_or_else(|| "Claude Code devolvió una respuesta que no es JSON.".to_string())?;

    if json.get("is_error").and_then(Value::as_bool) == Some(true) {
        return Err(format!(
            "Claude Code devolvió un error: {}",
            json.get("result")
                .and_then(Value::as_str)
                .unwrap_or("sin detalle")
        ));
    }

    let texto = json
        .get("result")
        .and_then(Value::as_str)
        .or_else(|| json.get("text").and_then(Value::as_str))
        .unwrap_or("");

    if texto.trim().is_empty() {
        return Err("Claude Code respondió sin contenido.".to_string());
    }

    Ok(format!(
        "Claude Code respondió correctamente: {}",
        recortar(texto.trim(), 120)
    ))
}

fn extraer_json(texto: &str) -> Option<Value> {
    let inicio = texto.find('{')?;
    let fin = texto.rfind('}')?;

    if fin <= inicio {
        return None;
    }

    serde_json::from_str(&texto[inicio..=fin]).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ia::providers::buscar_comando;

    fn conexion(proveedor: Proveedor, modelo: &str) -> ConexionIa {
        ConexionIa {
            id: "prueba".to_string(),
            nombre: "Prueba".to_string(),
            proveedor,
            modelo: modelo.to_string(),
            endpoint: None,
            comando: None,
            tamano_bytes: None,
            parametros: None,
            cuantizacion: None,
            capacidades: Vec::new(),
            gratis: true,
            ultima_prueba: None,
            creada_ms: 0,
        }
    }

    #[tokio::test]
    #[ignore = "envía una petición real a opencode"]
    async fn prueba_opencode_go() {
        assert!(buscar_comando("opencode").is_some());
        let resultado = probar(&conexion(Proveedor::Opencode, "opencode-go/beam-free")).await;
        println!(
            "opencode: ok={} mensaje={}",
            resultado.ok, resultado.mensaje
        );
        assert!(resultado.ok, "{}", resultado.mensaje);
    }

    #[tokio::test]
    #[ignore = "envía una petición real a Claude Code"]
    async fn prueba_claude() {
        assert!(buscar_comando("claude").is_some());
        let resultado = probar(&conexion(Proveedor::Claude, "haiku")).await;
        println!("claude: ok={} mensaje={}", resultado.ok, resultado.mensaje);
        assert!(resultado.ok, "{}", resultado.mensaje);
    }
}
