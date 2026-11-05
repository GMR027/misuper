use crate::ia::model::{DeteccionIa, IaResumenDto, NuevaConexion, Proveedor, SesionDto};
use crate::ia::{self, badge, hardware, model, probe, providers, session};
use crate::state::{AppState, AppStateDto};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

const CACHE_SESION: Duration = Duration::from_secs(30);

#[tauri::command]
pub fn app_state(state: State<'_, AppState>) -> Result<AppStateDto, String> {
    state.estado()
}

#[tauri::command]
pub fn guardar_servidor(
    app: AppHandle,
    state: State<'_, AppState>,
    server: String,
) -> Result<AppStateDto, String> {
    let server = state.guardar_servidor(&server)?;
    navegar_despues(&app, server);
    state.estado()
}

#[tauri::command]
pub fn abrir_ajustes(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.marcar_ajustes(true);
    navegar_despues(&app, state.local_url.clone());
    Ok(())
}

#[tauri::command]
pub fn abrir_ajustes_ia(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.marcar_ajustes(true);
    let url = url_con_tab(&state.local_url, "ia");
    navegar_despues(&app, url);
    Ok(())
}

#[tauri::command]
pub fn volver_web(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.marcar_ajustes(false);

    match state.servidor() {
        Some(server) => navegar_despues(&app, server),
        None => navegar_despues(&app, state.local_url.clone()),
    }

    Ok(())
}

#[tauri::command]
pub fn aplicar_zoom(app: AppHandle, state: State<'_, AppState>, zoom: u32) -> Result<u32, String> {
    let zoom = state.guardar_zoom(zoom)?;
    aplicar_zoom_ventana(&app, zoom);
    Ok(zoom)
}

/// Devuelve la sesión actual de la web. No requiere ser administrador: la
/// página de ajustes la usa para mostrar u ocultar la pestaña de IA.
#[tauri::command]
pub async fn sesion_actual(app: AppHandle) -> Result<SesionDto, String> {
    let sesion = obtener_sesion(&app, false).await?;

    #[cfg(debug_assertions)]
    eprintln!(
        "[misuper] sesión web · autenticado={} · admin={}",
        sesion.autenticado, sesion.admin
    );

    Ok(sesion)
}

/// Estado de conexiones de IA + hardware. Solo administradores.
#[tauri::command]
pub async fn ia_estado(app: AppHandle) -> Result<IaResumenDto, String> {
    exigir_admin(&app).await?;
    let ia = app.state::<AppState>().ia();
    let hardware = hardware::detectar();

    #[cfg(debug_assertions)]
    eprintln!(
        "[misuper] ia_estado · conexiones={} · activa={:?}",
        ia.conexiones.len(),
        ia.activa
    );

    Ok(model::resumen(&ia, &hardware))
}

/// Detecta hardware y proveedores instalados. Solo administradores.
#[tauri::command]
pub async fn ia_detectar(app: AppHandle) -> Result<DeteccionIa, String> {
    exigir_admin(&app).await?;

    let ia = {
        let state = app.state::<AppState>();
        state.ia()
    };

    let hardware = hardware::detectar();
    let deteccion = providers::detectar(&hardware, &ia).await;

    #[cfg(debug_assertions)]
    eprintln!(
        "[misuper] ia_detectar · ollama={} opencode={} claude={}",
        deteccion.ollama.modelos.len(),
        deteccion.opencode.modelos.len(),
        deteccion.claude.modelos.len()
    );

    Ok(deteccion)
}

/// Crea o actualiza una conexión. Solo administradores.
#[tauri::command]
pub async fn ia_guardar_conexion(
    app: AppHandle,
    datos: NuevaConexion,
) -> Result<IaResumenDto, String> {
    exigir_admin(&app).await?;

    let mut datos = datos;
    ia::validar_conexion(&mut datos)?;

    let state = app.state::<AppState>();
    let mut config = state.ia();
    let ahora = ia::ahora_ms();

    match datos.id.as_deref() {
        Some(id) if !id.is_empty() => {
            let conexion = config
                .conexiones
                .iter_mut()
                .find(|c| c.id == id)
                .ok_or_else(|| "La conexión que intentas editar ya no existe.".to_string())?;

            let cambia_modelo = conexion.proveedor != datos.proveedor
                || conexion.modelo != datos.modelo
                || conexion.endpoint != datos.endpoint;

            conexion.nombre = datos.nombre;
            conexion.proveedor = datos.proveedor;
            conexion.modelo = datos.modelo;
            conexion.endpoint = datos.endpoint;
            conexion.comando = datos.comando;
            conexion.tamano_bytes = datos.tamano_bytes;
            conexion.parametros = datos.parametros;
            conexion.cuantizacion = datos.cuantizacion;
            conexion.capacidades = datos.capacidades;
            conexion.gratis = datos.gratis;

            if cambia_modelo {
                conexion.ultima_prueba = None;
            }
        }
        _ => {
            let id = uuid::Uuid::new_v4().to_string();
            config.conexiones.push(ia::model::ConexionIa {
                id: id.clone(),
                nombre: datos.nombre,
                proveedor: datos.proveedor,
                modelo: datos.modelo,
                endpoint: datos.endpoint,
                comando: datos.comando,
                tamano_bytes: datos.tamano_bytes,
                parametros: datos.parametros,
                cuantizacion: datos.cuantizacion,
                capacidades: datos.capacidades,
                gratis: datos.gratis,
                ultima_prueba: None,
                creada_ms: ahora,
            });

            if config.activa.is_none() {
                config.activa = Some(id);
            }
        }
    }

    config.normalizar();
    state.guardar_ia(&config)?;
    drop(state);

    let resumen = resumen_actual(&app);
    badge::inyectar_app(&app);
    Ok(resumen)
}

#[tauri::command]
pub async fn ia_eliminar_conexion(app: AppHandle, id: String) -> Result<IaResumenDto, String> {
    exigir_admin(&app).await?;

    let state = app.state::<AppState>();
    let mut config = state.ia();
    config.conexiones.retain(|c| c.id != id);

    if config.activa.as_deref() == Some(id.as_str()) {
        config.activa = config.conexiones.first().map(|c| c.id.clone());
    }

    config.normalizar();
    state.guardar_ia(&config)?;
    drop(state);

    let resumen = resumen_actual(&app);
    badge::inyectar_app(&app);
    Ok(resumen)
}

#[tauri::command]
pub async fn ia_activar(app: AppHandle, id: String) -> Result<IaResumenDto, String> {
    exigir_admin(&app).await?;

    let state = app.state::<AppState>();
    let mut config = state.ia();

    if !config.conexiones.iter().any(|c| c.id == id) {
        return Err("La conexión ya no existe.".to_string());
    }

    config.activa = Some(id);
    state.guardar_ia(&config)?;
    drop(state);

    let resumen = resumen_actual(&app);
    badge::inyectar_app(&app);
    Ok(resumen)
}

#[tauri::command]
pub async fn ia_probar(app: AppHandle, id: String) -> Result<IaResumenDto, String> {
    exigir_admin(&app).await?;

    let conexion = {
        let state = app.state::<AppState>();
        let config = state.ia();
        config
            .conexiones
            .iter()
            .find(|c| c.id == id)
            .cloned()
            .ok_or_else(|| "La conexión ya no existe.".to_string())?
    };

    let resultado = probe::probar(&conexion).await;

    let state = app.state::<AppState>();
    let mut config = state.ia();

    if let Some(guardada) = config.conexiones.iter_mut().find(|c| c.id == id) {
        guardada.ultima_prueba = Some(resultado);
    }

    state.guardar_ia(&config)?;
    drop(state);

    let resumen = resumen_actual(&app);
    badge::inyectar_app(&app);
    Ok(resumen)
}

#[tauri::command]
pub async fn importar_analizar_pdf(
    app: AppHandle,
    ruta: String,
) -> Result<crate::ia::importar::AnalisisPdf, String> {
    exigir_admin(&app).await?;

    let ruta_log = ruta.clone();
    let analisis =
        tauri::async_runtime::spawn_blocking(move || crate::ia::importar::analizar(&ruta))
            .await
            .map_err(|error| format!("No se pudo analizar el PDF: {error}"))??;

    #[cfg(debug_assertions)]
    eprintln!(
        "[misuper] importar · {} · {} candidatas",
        ruta_log,
        analisis.candidatas.len()
    );

    Ok(analisis)
}

#[tauri::command]
pub fn abrir_chef(app: AppHandle) -> Result<(), String> {
    ir_a_chef(&app);
    Ok(())
}

#[tauri::command]
pub async fn importar_elegir_pdf(app: AppHandle) -> Result<Option<String>, String> {
    exigir_admin(&app).await?;

    let handle = app.clone();
    let ruta = tauri::async_runtime::spawn_blocking(move || {
        use tauri_plugin_dialog::DialogExt;

        handle
            .dialog()
            .file()
            .add_filter("Documentos PDF", &["pdf"])
            .set_title("Elegir un libro de recetas")
            .blocking_pick_file()
    })
    .await
    .map_err(|error| format!("No se pudo abrir el selector de archivos: {error}"))?;

    Ok(ruta.map(|ruta| ruta.to_string()))
}

#[tauri::command]
pub async fn importar_extraer_receta(
    app: AppHandle,
    texto: String,
) -> Result<crate::ia::extraer::RecetaExtraida, String> {
    exigir_admin(&app).await?;

    let conexion = {
        let state = app.state::<AppState>();
        let ia = state.ia();
        ia.activa()
            .cloned()
            .ok_or_else(|| "Configura y activa una conexión de IA antes de extraer.".to_string())?
    };

    crate::ia::extraer::extraer(&texto, &conexion).await
}

/// Completion libre para sugerir un menú semanal. Solo administradores.
#[tauri::command]
pub async fn menu_completar(app: AppHandle, prompt: String) -> Result<String, String> {
    exigir_admin(&app).await?;

    let prompt = prompt.trim().to_string();

    if prompt.is_empty() {
        return Err("La solicitud para la IA está vacía.".to_string());
    }

    if prompt.len() > 200_000 {
        return Err("La solicitud para la IA es demasiado grande.".to_string());
    }

    let conexion = {
        let state = app.state::<AppState>();
        let ia = state.ia();
        ia.activa().cloned().ok_or_else(|| {
            "Configura y activa una conexión de IA antes de generar el menú.".to_string()
        })?
    };

    ia::gateway::completar(&conexion, &prompt).await
}

#[tauri::command]
pub async fn importar_titulo_vision(
    app: AppHandle,
    ruta: String,
    pagina: u32,
) -> Result<String, String> {
    exigir_admin(&app).await?;

    let endpoint = {
        let state = app.state::<AppState>();
        state
            .ia()
            .conexiones
            .iter()
            .find(|conexion| conexion.proveedor == Proveedor::Ollama)
            .and_then(|conexion| conexion.endpoint.clone())
    };

    crate::ia::vision::titulo(&ruta, pagina, endpoint.as_deref()).await
}

/// Abre Chef como página de la web (modo integrado). Si la web todavía no
/// tiene la ruta `/chef`, usa la ventana local como respaldo.
pub fn ir_a_chef(app: &AppHandle) {
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        let servidor = {
            let state = app.state::<AppState>();
            state.servidor()
        };

        let Some(servidor) = servidor else {
            let _ = crate::abrir_chef(&app, None);
            return;
        };

        let url = format!("{}/chef", servidor.trim_end_matches('/'));
        let disponible = match reqwest::Client::builder()
            .timeout(Duration::from_secs(4))
            .build()
        {
            Ok(cliente) => cliente
                .get(&url)
                .send()
                .await
                .map(|respuesta| respuesta.status().as_u16() != 404)
                .unwrap_or(false),
            Err(_) => false,
        };

        if disponible {
            let _ = navegar(&app, &url);
        } else {
            let _ = crate::abrir_chef(&app, None);
        }
    });
}

pub fn resumen_actual(app: &AppHandle) -> IaResumenDto {
    let state = app.state::<AppState>();
    let ia = state.ia();
    let hardware = hardware::detectar();
    model::resumen(&ia, &hardware)
}

async fn obtener_sesion(app: &AppHandle, refrescar: bool) -> Result<SesionDto, String> {
    if !refrescar {
        if let Some(sesion) = app.state::<AppState>().sesion_cacheada(CACHE_SESION) {
            return Ok(sesion);
        }
    }

    let servidor = {
        let state = app.state::<AppState>();
        state
            .servidor()
            .ok_or_else(|| "Primero configura la dirección del servidor.".to_string())?
    };

    let sesion = session::obtener(app, &servidor).await?;

    if sesion.autenticado {
        app.state::<AppState>().guardar_sesion_cache(&sesion);
    } else {
        app.state::<AppState>().limpiar_sesion_cache();
    }

    Ok(sesion)
}

pub async fn exigir_admin(app: &AppHandle) -> Result<SesionDto, String> {
    let sesion = obtener_sesion(app, false).await?;

    if !sesion.autenticado {
        return Err("Inicia sesión en Mi Súper antes de configurar la IA.".to_string());
    }

    if !sesion.admin {
        return Err("Solo los administradores pueden configurar la IA.".to_string());
    }

    Ok(sesion)
}

/// Abre la pestaña de IA desde el menú nativo o desde la insignia.
pub fn ir_a_ajustes_ia(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.marcar_ajustes(true);
    let url = url_con_tab(&state.local_url, "ia");
    navegar_despues(app, url);
}

pub fn url_con_tab(base: &str, tab: &str) -> String {
    match tauri::Url::parse(base) {
        Ok(mut url) => {
            url.query_pairs_mut().append_pair("tab", tab);
            url.to_string()
        }
        Err(_) => format!("{base}?tab={tab}"),
    }
}

pub fn navegar(app: &AppHandle, url: &str) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("La ventana principal no está disponible.".to_string());
    };

    let url = tauri::Url::parse(url).map_err(|_| "La dirección no es válida.".to_string())?;

    window
        .navigate(url)
        .map_err(|e| format!("No se pudo abrir la dirección: {e}"))
}

/// Navega un instante después de responder al frontend, para que el IPC no se
/// cancele por el cambio de página.
pub fn navegar_despues(app: &AppHandle, url: String) {
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(180));
        let _ = navegar(&app, &url);
    });
}

pub fn aplicar_zoom_ventana(app: &AppHandle, zoom: u32) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_zoom(zoom as f64 / 100.0);
    }
}
