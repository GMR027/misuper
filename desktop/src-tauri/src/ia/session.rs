//! Lectura de la sesión de la web desde el webview.
//!
//! La app no guarda un token propio: reutiliza la cookie `misuper_session`
//! que el webview ya tiene tras el login en la web.

use super::model::SesionDto;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub async fn obtener(app: &AppHandle, servidor: &str) -> Result<SesionDto, String> {
    let base = servidor.trim().trim_end_matches('/');
    let url = tauri::Url::parse(&format!("{base}/api/me"))
        .map_err(|_| "La dirección del servidor no es válida.".to_string())?;

    let cookie = leer_cookie(app, url.clone())?;
    let cliente = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("No se pudo preparar la comprobación de sesión: {error}"))?;

    let mut peticion = cliente
        .get(url)
        .header("Accept", "application/json")
        .header("User-Agent", "MiSuperDesktop/0.2");

    if !cookie.is_empty() {
        peticion = peticion.header("Cookie", cookie);
    }

    let respuesta = peticion
        .send()
        .await
        .map_err(|error| format!("No se pudo comprobar la sesión con la web: {error}"))?;

    if respuesta.status().as_u16() == 401 || respuesta.status().as_u16() == 403 {
        return Ok(SesionDto::anonima());
    }

    if !respuesta.status().is_success() {
        return Err(format!(
            "La web respondió HTTP {} al comprobar la sesión.",
            respuesta.status()
        ));
    }

    let json: serde_json::Value = respuesta
        .json()
        .await
        .map_err(|error| format!("La web devolvió una respuesta de sesión inválida: {error}"))?;

    if json.get("ok").and_then(serde_json::Value::as_bool) != Some(true) {
        return Ok(SesionDto::anonima());
    }

    let data = json.get("data").cloned().unwrap_or(serde_json::Value::Null);

    let rol = data
        .get("rol")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string);

    Ok(SesionDto {
        autenticado: true,
        admin: rol.as_deref() == Some("admin"),
        nombre: data
            .get("nombre")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        email: data
            .get("email")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        rol,
    })
}

fn leer_cookie(app: &AppHandle, url: tauri::Url) -> Result<String, String> {
    let ventana = app
        .get_webview_window("main")
        .ok_or_else(|| "La ventana principal no está disponible.".to_string())?;

    let (tx, rx) = std::sync::mpsc::channel();
    let url_cookie = url.clone();

    app.run_on_main_thread(move || {
        let resultado = ventana
            .cookies_for_url(url_cookie)
            .map_err(|error| format!("No se pudieron leer las cookies de la sesión: {error}"));
        let _ = tx.send(resultado);
    })
    .map_err(|error| format!("No se pudo consultar el webview: {error}"))?;

    let cookies = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "El webview tardó demasiado en responder al leer la sesión.".to_string())??;

    Ok(cookies
        .iter()
        .map(|cookie| format!("{}={}", cookie.name(), cookie.value()))
        .collect::<Vec<_>>()
        .join("; "))
}
