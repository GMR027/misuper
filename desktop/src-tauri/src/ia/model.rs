//! Tipos de la integración de IA.
//!
//! La configuración se guarda en `config.json`. No se guardan secretos: cada
//! proveedor reutiliza su propia sesión (Ollama, opencode, Claude Code).

use serde::{Deserialize, Serialize};

/// Proveedor de modelos.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Proveedor {
    Ollama,
    Opencode,
    Claude,
}

impl Proveedor {
    pub fn etiqueta(self) -> &'static str {
        match self {
            Self::Ollama => "Ollama",
            Self::Opencode => "opencode",
            Self::Claude => "Claude",
        }
    }
}

/// Conexión guardada por el administrador.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConexionIa {
    pub id: String,
    pub nombre: String,
    pub proveedor: Proveedor,
    pub modelo: String,
    #[serde(default)]
    pub endpoint: Option<String>,
    #[serde(default)]
    pub comando: Option<String>,
    #[serde(default)]
    pub tamano_bytes: Option<u64>,
    #[serde(default)]
    pub parametros: Option<String>,
    #[serde(default)]
    pub cuantizacion: Option<String>,
    #[serde(default)]
    pub capacidades: Vec<String>,
    #[serde(default)]
    pub gratis: bool,
    #[serde(default)]
    pub ultima_prueba: Option<ResultadoPrueba>,
    #[serde(default)]
    pub creada_ms: u64,
}

/// Configuración persistente de IA.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IaConfig {
    #[serde(default)]
    pub conexiones: Vec<ConexionIa>,
    #[serde(default)]
    pub activa: Option<String>,
}

impl IaConfig {
    /// Devuelve la conexión activa solamente si sigue existiendo.
    pub fn activa(&self) -> Option<&ConexionIa> {
        let id = self.activa.as_deref()?;
        self.conexiones.iter().find(|c| c.id == id)
    }

    pub fn normalizar(&mut self) {
        if self.activa().is_none() {
            self.activa = None;
        }
    }
}

/// Resultado de una comprobación real contra el modelo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultadoPrueba {
    pub ok: bool,
    pub mensaje: String,
    #[serde(default)]
    pub detalle: Option<String>,
    #[serde(default)]
    pub latencia_ms: Option<u64>,
    pub fecha_ms: u64,
}

/// Información de hardware útil para recomendar modelos locales.
#[derive(Debug, Clone, Serialize)]
pub struct HardwareInfo {
    pub cpu: String,
    pub nucleos: usize,
    pub ram_total_bytes: u64,
    pub ram_disponible_bytes: u64,
    pub gpu: Option<GpuInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub nombre: String,
    pub vram_total_bytes: Option<u64>,
    pub vram_libre_bytes: Option<u64>,
    pub integrada: bool,
}

/// Recomendación calculada, no persistida.
#[derive(Debug, Clone, Serialize)]
pub struct Recomendacion {
    pub nivel: String,
    pub etiqueta: String,
    pub detalle: String,
    pub memoria_estimada_bytes: Option<u64>,
}

/// Modelo disponible detectado en un proveedor.
#[derive(Debug, Clone, Serialize)]
pub struct ModeloDisponible {
    pub id: String,
    pub nombre: String,
    pub proveedor: Proveedor,
    pub tamano_bytes: Option<u64>,
    pub parametros: Option<String>,
    pub cuantizacion: Option<String>,
    pub capacidades: Vec<String>,
    pub gratis: bool,
    pub recomendacion: Option<Recomendacion>,
}

/// Estado de un proveedor tras la detección.
#[derive(Debug, Clone, Serialize)]
pub struct DeteccionProveedor {
    pub proveedor: Proveedor,
    pub instalado: bool,
    pub disponible: bool,
    pub autenticado: Option<bool>,
    pub version: Option<String>,
    pub detalle: Option<String>,
    pub endpoint: Option<String>,
    pub modelos: Vec<ModeloDisponible>,
}

/// Resultado completo de detectar hardware y proveedores.
#[derive(Debug, Clone, Serialize)]
pub struct DeteccionIa {
    pub hardware: HardwareInfo,
    pub ollama: DeteccionProveedor,
    pub opencode: DeteccionProveedor,
    pub claude: DeteccionProveedor,
}

/// Conexión tal como la consume la interfaz.
#[derive(Debug, Clone, Serialize)]
pub struct ConexionDto {
    pub id: String,
    pub nombre: String,
    pub proveedor: Proveedor,
    pub modelo: String,
    pub endpoint: Option<String>,
    pub comando: Option<String>,
    pub tamano_bytes: Option<u64>,
    pub parametros: Option<String>,
    pub cuantizacion: Option<String>,
    pub capacidades: Vec<String>,
    pub gratis: bool,
    pub ultima_prueba: Option<ResultadoPrueba>,
    pub creada_ms: u64,
    pub activa: bool,
    pub recomendacion: Option<Recomendacion>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IaResumenDto {
    pub conexiones: Vec<ConexionDto>,
    pub activa: Option<String>,
    pub hardware: HardwareInfo,
    pub estado_insignia: EstadoInsignia,
}

/// Estado que se pinta junto al avatar.
#[derive(Debug, Clone, Serialize)]
pub struct EstadoInsignia {
    pub visible: bool,
    pub estado: String,
    pub proveedor: Option<String>,
    pub modelo: Option<String>,
    pub detalle: Option<String>,
}

/// Datos que envía la interfaz al guardar una conexión.
#[derive(Debug, Clone, Deserialize)]
pub struct NuevaConexion {
    #[serde(default)]
    pub id: Option<String>,
    pub nombre: String,
    pub proveedor: Proveedor,
    pub modelo: String,
    #[serde(default)]
    pub endpoint: Option<String>,
    #[serde(default)]
    pub comando: Option<String>,
    #[serde(default)]
    pub tamano_bytes: Option<u64>,
    #[serde(default)]
    pub parametros: Option<String>,
    #[serde(default)]
    pub cuantizacion: Option<String>,
    #[serde(default)]
    pub capacidades: Vec<String>,
    #[serde(default)]
    pub gratis: bool,
}

/// Sesión del usuario de la web, leída desde la cookie del webview.
#[derive(Debug, Clone, Serialize)]
pub struct SesionDto {
    pub autenticado: bool,
    pub admin: bool,
    pub nombre: Option<String>,
    pub email: Option<String>,
    pub rol: Option<String>,
}

impl SesionDto {
    pub fn anonima() -> Self {
        Self {
            autenticado: false,
            admin: false,
            nombre: None,
            email: None,
            rol: None,
        }
    }
}

/// Construye el resumen que consume la interfaz.
pub fn resumen(ia: &IaConfig, hardware: &HardwareInfo) -> IaResumenDto {
    let conexiones = ia
        .conexiones
        .iter()
        .map(|c| ConexionDto {
            id: c.id.clone(),
            nombre: c.nombre.clone(),
            proveedor: c.proveedor,
            modelo: c.modelo.clone(),
            endpoint: c.endpoint.clone(),
            comando: c.comando.clone(),
            tamano_bytes: c.tamano_bytes,
            parametros: c.parametros.clone(),
            cuantizacion: c.cuantizacion.clone(),
            capacidades: c.capacidades.clone(),
            gratis: c.gratis,
            ultima_prueba: c.ultima_prueba.clone(),
            creada_ms: c.creada_ms,
            activa: ia.activa.as_deref() == Some(c.id.as_str()),
            recomendacion: match c.proveedor {
                Proveedor::Ollama => crate::ia::hardware::recomendar(c.tamano_bytes, hardware),
                _ => Some(Recomendacion {
                    nivel: "remota".to_string(),
                    etiqueta: "Modelo remoto".to_string(),
                    detalle: "Requiere internet y una sesión activa del proveedor.".to_string(),
                    memoria_estimada_bytes: None,
                }),
            },
        })
        .collect();

    IaResumenDto {
        conexiones,
        activa: ia.activa.clone(),
        hardware: hardware.clone(),
        estado_insignia: estado_insignia(ia),
    }
}

/// Deriva el color y el texto de la insignia a partir de la última prueba.
pub fn estado_insignia(ia: &IaConfig) -> EstadoInsignia {
    let Some(conexion) = ia.activa() else {
        return EstadoInsignia {
            visible: false,
            estado: "sin_conexion".to_string(),
            proveedor: None,
            modelo: None,
            detalle: Some("No hay ninguna conexión de IA activa.".to_string()),
        };
    };

    let ahora = crate::ia::ahora_ms();
    let (estado, detalle) = match &conexion.ultima_prueba {
        Some(prueba) if prueba.ok => {
            let edad = ahora.saturating_sub(prueba.fecha_ms);
            if edad <= 24 * 60 * 60 * 1000 {
                (
                    "ok",
                    format!(
                        "Conexión verificada{}.",
                        prueba
                            .latencia_ms
                            .map(|ms| format!(" · {ms} ms"))
                            .unwrap_or_default()
                    ),
                )
            } else {
                (
                    "aviso",
                    "La última comprobación tiene más de 24 horas.".to_string(),
                )
            }
        }
        Some(prueba) => ("error", prueba.mensaje.clone()),
        None => (
            "aviso",
            "Esta conexión todavía no se ha comprobado.".to_string(),
        ),
    };

    EstadoInsignia {
        visible: true,
        estado: estado.to_string(),
        proveedor: Some(conexion.proveedor.etiqueta().to_string()),
        modelo: Some(conexion.modelo.clone()),
        detalle: Some(detalle),
    }
}
