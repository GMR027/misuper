mod commands;
mod ia;
mod state;

use state::AppState;
use std::sync::{Arc, Mutex};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("No se pudo resolver la carpeta de datos: {e}"))?;

            let app_state = AppState::new(dir.clone())
                .map_err(|e| format!("No se pudo inicializar la app: {e}"))?;

            let argumentos: Vec<String> = std::env::args().collect();
            let abrir_ia = argumentos.iter().any(|arg| arg == "--ia");
            let abrir_ajustes = abrir_ia || argumentos.iter().any(|arg| arg == "--ajustes");
            let abrir_chef_flag = argumentos.iter().any(|arg| arg == "--chef");
            let pdf_inicial = argumentos
                .iter()
                .position(|arg| arg == "--pdf")
                .and_then(|indice| argumentos.get(indice + 1))
                .cloned();

            if abrir_ajustes {
                app_state.marcar_ajustes(true);
            }

            let server_inicial = app_state.servidor();
            let zoom_inicial = app_state.zoom();
            let local_url = app_state.local_url.clone();
            let allowed = app_state.allowed_origin.clone();

            app.manage(app_state);
            construir_menu(app)?;

            let handle_navegacion = app.handle().clone();

            let ventana =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Mi Súper")
                    .inner_size(1280.0, 860.0)
                    .min_inner_size(960.0, 640.0)
                    .data_directory(dir.join("webview"))
                    .initialization_script(ia::bridge::SCRIPT)
                    .on_page_load(|ventana, payload| {
                        if payload.event() != tauri::webview::PageLoadEvent::Finished {
                            return;
                        }

                        if payload.url().path() == "/login" || payload.url().path() == "/registro" {
                            if let Some(state) = ventana.app_handle().try_state::<AppState>() {
                                state.limpiar_sesion_cache();
                            }
                        }

                        ia::badge::inyectar(&ventana);
                    })
                    .on_navigation(move |url| {
                        if url.scheme() == "misuper-ia" {
                            commands::ir_a_ajustes_ia(&handle_navegacion);
                            return false;
                        }

                        permitir_navegacion(url, &allowed)
                    })
                    .build()?;

            if let Some(icono) = app.default_window_icon().cloned() {
                let _ = ventana.set_icon(icono);
            }

            let _ = ventana.set_zoom(zoom_inicial as f64 / 100.0);

            if abrir_ia {
                let url = commands::url_con_tab(&local_url, "ia");
                if let Ok(url) = tauri::Url::parse(&url) {
                    let _ = ventana.navigate(url);
                }
            } else if abrir_ajustes {
                if let Ok(url) = tauri::Url::parse(&local_url) {
                    let _ = ventana.navigate(url);
                }
            } else if let Some(ref server) = server_inicial {
                if let Ok(url) = tauri::Url::parse(&server) {
                    let _ = ventana.navigate(url);
                }
            }

            if abrir_chef_flag || pdf_inicial.is_some() {
                if let Err(error) = abrir_chef(app.handle(), pdf_inicial) {
                    eprintln!("[misuper] no se pudo abrir Chef: {error}");
                }
            }

            #[cfg(debug_assertions)]
            eprintln!(
                "[misuper] ventana lista · servidor={:?} · zoom={zoom_inicial} · local={local_url}",
                server_inicial
            );

            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            let state = app.state::<AppState>();

            match id.as_str() {
                "servidor" => {
                    state.marcar_ajustes(true);
                    let _ = commands::navegar(app, &state.local_url);
                }
                "ia" => commands::ir_a_ajustes_ia(app),
                "chef" => commands::ir_a_chef(app),
                "recargar" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.reload();
                    }
                }
                "navegador" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if let Ok(url) = window.url() {
                            let _ = open::that(url.as_str());
                        }
                    }
                }
                "atras" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("history.back()");
                    }
                }
                "adelante" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.eval("history.forward()");
                    }
                }
                "zoom-mas" => ajustar_zoom(app, state.zoom().saturating_add(10)),
                "zoom-menos" => ajustar_zoom(app, state.zoom().saturating_sub(10)),
                "zoom-reset" => ajustar_zoom(app, 100),
                "salir" => app.exit(0),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_state,
            commands::guardar_servidor,
            commands::abrir_ajustes,
            commands::abrir_ajustes_ia,
            commands::volver_web,
            commands::aplicar_zoom,
            commands::sesion_actual,
            commands::ia_estado,
            commands::ia_detectar,
            commands::ia_guardar_conexion,
            commands::ia_eliminar_conexion,
            commands::ia_activar,
            commands::ia_probar,
            commands::importar_analizar_pdf,
            commands::importar_elegir_pdf,
            commands::importar_extraer_receta,
            commands::importar_titulo_vision,
            commands::menu_completar,
            commands::abrir_chef,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar Mi Súper");
}

pub fn abrir_chef(app: &tauri::AppHandle, pdf: Option<String>) -> Result<(), String> {
    if let Some(ventana) = app.get_webview_window("chef") {
        let _ = ventana.unminimize();
        let _ = ventana.set_focus();

        if let Some(ruta) = pdf {
            let ruta = serde_json::to_string(&ruta).unwrap_or_else(|_| "null".to_string());
            let _ = ventana.eval(&format!(
                "window.__chefAbrirPdf && window.__chefAbrirPdf({ruta})"
            ));
        }

        return Ok(());
    }

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("No se pudo resolver la carpeta de datos: {error}"))?;

    let ventana = WebviewWindowBuilder::new(app, "chef", WebviewUrl::App("chef.html".into()))
        .title("Chef · Importar recetas")
        .inner_size(1120.0, 840.0)
        .min_inner_size(900.0, 640.0)
        .data_directory(dir.join("chef-webview"))
        .on_navigation(|url| {
            if matches!(url.scheme(), "tauri" | "about" | "data" | "blob") {
                return true;
            }

            if url.host_str() == Some("tauri.localhost") {
                return true;
            }

            if tauri::is_dev() && url.host_str() == Some("localhost") && url.port() == Some(1420) {
                return true;
            }

            if matches!(url.scheme(), "http" | "https") {
                let _ = open::that(url.as_str());
            }

            false
        })
        .build()
        .map_err(|error| format!("No se pudo abrir la ventana Chef: {error}"))?;

    if let Some(icono) = app.default_window_icon().cloned() {
        let _ = ventana.set_icon(icono);
    }

    if let Some(ruta) = pdf {
        if let Ok(mut url) = ventana.url() {
            url.query_pairs_mut().append_pair("pdf", &ruta);
            let _ = ventana.navigate(url);
        }
    }

    Ok(())
}

fn ajustar_zoom(app: &tauri::AppHandle, zoom: u32) {
    let state = app.state::<AppState>();
    if let Ok(zoom) = state.guardar_zoom(zoom) {
        commands::aplicar_zoom_ventana(app, zoom);
    }
}

fn construir_menu(app: &mut tauri::App) -> tauri::Result<()> {
    let servidor = MenuItemBuilder::with_id("servidor", "Servidor…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let ia = MenuItemBuilder::with_id("ia", "Inteligencia artificial…")
        .accelerator("CmdOrCtrl+Shift+A")
        .build(app)?;
    let chef = MenuItemBuilder::with_id("chef", "Chef: importar recetas…")
        .accelerator("CmdOrCtrl+Shift+C")
        .build(app)?;
    let recargar = MenuItemBuilder::with_id("recargar", "Recargar")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let navegador = MenuItemBuilder::with_id("navegador", "Abrir en el navegador").build(app)?;
    let atras = MenuItemBuilder::with_id("atras", "Atrás")
        .accelerator("Alt+Left")
        .build(app)?;
    let adelante = MenuItemBuilder::with_id("adelante", "Adelante")
        .accelerator("Alt+Right")
        .build(app)?;
    let salir = MenuItemBuilder::with_id("salir", "Salir")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    let zoom_mas = MenuItemBuilder::with_id("zoom-mas", "Acercar")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_menos = MenuItemBuilder::with_id("zoom-menos", "Alejar")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "Tamaño original")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;

    let app_menu = SubmenuBuilder::new(app, "Mi Súper")
        .item(&servidor)
        .item(&ia)
        .item(&chef)
        .separator()
        .item(&atras)
        .item(&adelante)
        .item(&recargar)
        .item(&navegador)
        .separator()
        .item(&salir)
        .build()?;

    let ver_menu = SubmenuBuilder::new(app, "Ver")
        .item(&zoom_mas)
        .item(&zoom_menos)
        .item(&zoom_reset)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[&app_menu, &ver_menu])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

fn permitir_navegacion(url: &tauri::Url, allowed: &Arc<Mutex<Option<String>>>) -> bool {
    let scheme = url.scheme();

    if matches!(scheme, "tauri" | "about" | "data" | "blob") {
        return true;
    }

    if url.host_str() == Some("tauri.localhost") {
        return true;
    }

    if let Some(origin) = allowed.lock().ok().and_then(|guard| guard.clone()) {
        if url.origin().ascii_serialization() == origin {
            return true;
        }

        // Permite redirecciones http → https dentro del mismo servidor.
        if let Ok(base) = tauri::Url::parse(&origin) {
            if url.host_str() == base.host_str() {
                return true;
            }
        }
    }

    // Página local servida por Vite durante el desarrollo.
    if tauri::is_dev() && url.host_str() == Some("localhost") && url.port() == Some(1420) {
        return true;
    }

    if scheme == "http" || scheme == "https" {
        let _ = open::that(url.as_str());
    }

    false
}
