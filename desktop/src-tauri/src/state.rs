//! Estado local de la app: servidor configurado, zoom y modo de ajustes.
//!
//! La sesión de la web no se guarda aquí: vive en el almacén de cookies del
//! webview, igual que en un navegador. Este archivo solo contiene preferencias.

use crate::ia::model::{IaConfig, SesionDto};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server_url: Option<String>,
    #[serde(default = "zoom_defecto")]
    pub zoom: u32,
    #[serde(default)]
    pub ia: IaConfig,
}

fn zoom_defecto() -> u32 {
    100
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_url: None,
            zoom: 100,
            ia: IaConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AppStateDto {
    pub configured: bool,
    pub server_url: Option<String>,
    pub zoom: u32,
    pub settings: bool,
    pub local_url: String,
}

pub struct AppState {
    pub dir: PathBuf,
    pub config: Mutex<Config>,
    pub settings: AtomicBool,
    pub local_url: String,
    /// Origen permitido dentro del webview. El resto de enlaces se abre fuera.
    pub allowed_origin: Arc<Mutex<Option<String>>>,
    /// Caché breve de la sesión de la web para no consultar /api/me en cada comando.
    pub sesion_cache: Mutex<Option<(SesionDto, Instant)>>,
}

impl AppState {
    pub fn new(dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("No se pudo crear la carpeta de datos: {e}"))?;

        let config = leer_config(&dir);
        let allowed_origin = Arc::new(Mutex::new(config.server_url.as_deref().and_then(origen_de)));

        let local_url = if tauri::is_dev() {
            "http://localhost:1420/index.html".to_string()
        } else {
            "tauri://localhost/index.html".to_string()
        };

        Ok(Self {
            dir,
            config: Mutex::new(config),
            settings: AtomicBool::new(false),
            local_url,
            allowed_origin,
            sesion_cache: Mutex::new(None),
        })
    }

    pub fn estado(&self) -> Result<AppStateDto, String> {
        let config = self.config.lock().map_err(lock_err)?.clone();

        Ok(AppStateDto {
            configured: config.server_url.is_some(),
            server_url: config.server_url,
            zoom: config.zoom,
            settings: self.settings.load(Ordering::Relaxed),
            local_url: self.local_url.clone(),
        })
    }

    pub fn guardar_servidor(&self, server: &str) -> Result<String, String> {
        let server = normalizar_servidor(server)?;
        let origen = origen_de(&server)
            .ok_or_else(|| "La dirección del servidor no es válida.".to_string())?;

        {
            let mut config = self.config.lock().map_err(lock_err)?;
            config.server_url = Some(server.clone());
            escribir_config(&self.dir, &config)?;
        }

        *self.allowed_origin.lock().map_err(lock_err)? = Some(origen);
        self.settings.store(false, Ordering::Relaxed);
        self.limpiar_sesion_cache();

        Ok(server)
    }

    pub fn guardar_zoom(&self, zoom: u32) -> Result<u32, String> {
        let zoom = zoom.clamp(50, 200);
        let mut config = self.config.lock().map_err(lock_err)?;
        config.zoom = zoom;
        escribir_config(&self.dir, &config)?;
        Ok(zoom)
    }

    pub fn zoom(&self) -> u32 {
        self.config.lock().map(|c| c.zoom).unwrap_or(100)
    }

    pub fn marcar_ajustes(&self, activo: bool) {
        self.settings.store(activo, Ordering::Relaxed);
    }

    pub fn servidor(&self) -> Option<String> {
        self.config.lock().ok().and_then(|c| c.server_url.clone())
    }

    /// Copia de la configuración de IA.
    pub fn ia(&self) -> IaConfig {
        self.config.lock().map(|c| c.ia.clone()).unwrap_or_default()
    }

    /// Guarda la configuración de IA de forma atómica.
    pub fn guardar_ia(&self, ia: &IaConfig) -> Result<(), String> {
        let mut config = self.config.lock().map_err(lock_err)?;
        config.ia = ia.clone();
        escribir_config(&self.dir, &config)
    }

    pub fn sesion_cacheada(&self, max_age: Duration) -> Option<SesionDto> {
        let cache = self.sesion_cache.lock().ok()?;
        let (sesion, momento) = cache.as_ref()?;

        (momento.elapsed() <= max_age).then(|| sesion.clone())
    }

    pub fn guardar_sesion_cache(&self, sesion: &SesionDto) {
        if let Ok(mut cache) = self.sesion_cache.lock() {
            *cache = Some((sesion.clone(), Instant::now()));
        }
    }

    pub fn limpiar_sesion_cache(&self) {
        if let Ok(mut cache) = self.sesion_cache.lock() {
            *cache = None;
        }
    }
}

pub fn normalizar_servidor(server: &str) -> Result<String, String> {
    let mut s = server.trim().trim_end_matches('/').to_string();

    if s.is_empty() {
        return Err("Escribe la dirección del servidor.".to_string());
    }

    if !s.starts_with("http://") && !s.starts_with("https://") {
        s = format!("http://{s}");
    }

    if tauri::Url::parse(&s).is_err() {
        return Err("La dirección del servidor no es válida.".to_string());
    }

    Ok(s)
}

fn origen_de(server: &str) -> Option<String> {
    tauri::Url::parse(server)
        .ok()
        .map(|url| url.origin().ascii_serialization())
}

fn leer_config(dir: &PathBuf) -> Config {
    let mut config = std::fs::read_to_string(dir.join("config.json"))
        .ok()
        .and_then(|s| serde_json::from_str::<Config>(&s).ok())
        .unwrap_or_default();

    config.ia.normalizar();
    config
}

fn escribir_config(dir: &PathBuf, config: &Config) -> Result<(), String> {
    let tmp = dir.join("config.json.tmp");
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, json).map_err(|e| format!("No se pudo guardar la configuración: {e}"))?;
    std::fs::rename(tmp, dir.join("config.json"))
        .map_err(|e| format!("No se pudo guardar la configuración: {e}"))?;
    Ok(())
}

fn lock_err<T>(_: T) -> String {
    "El estado interno de la app está bloqueado.".to_string()
}
