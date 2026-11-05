//! Detección de proveedores: Ollama, opencode y Claude Code.

use super::hardware;
use super::model::{
    DeteccionIa, DeteccionProveedor, HardwareInfo, IaConfig, ModeloDisponible, Proveedor,
    Recomendacion,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

const OLLAMA_POR_DEFECTO: &str = "http://127.0.0.1:11434";

pub struct Salida {
    pub stdout: String,
    pub stderr: String,
    pub codigo: Option<i32>,
}

pub async fn detectar(hardware: &HardwareInfo, ia: &IaConfig) -> DeteccionIa {
    let endpoints = endpoints_ollama(ia);

    let (ollama, opencode, claude) = tokio::join!(
        detectar_ollama(hardware, &endpoints),
        detectar_opencode(),
        detectar_claude()
    );

    DeteccionIa {
        hardware: hardware.clone(),
        ollama,
        opencode,
        claude,
    }
}

fn endpoints_ollama(ia: &IaConfig) -> Vec<String> {
    let mut endpoints = Vec::new();

    if let Ok(host) = std::env::var("OLLAMA_HOST") {
        let host = host.trim();
        if !host.is_empty() {
            endpoints.push(normalizar_endpoint(host));
        }
    }

    for conexion in &ia.conexiones {
        if conexion.proveedor == Proveedor::Ollama {
            if let Some(endpoint) = &conexion.endpoint {
                endpoints.push(normalizar_endpoint(endpoint));
            }
        }
    }

    endpoints.push(OLLAMA_POR_DEFECTO.to_string());
    endpoints.dedup();
    endpoints
}

fn normalizar_endpoint(endpoint: &str) -> String {
    let endpoint = endpoint.trim().trim_end_matches('/');

    if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        endpoint.to_string()
    } else {
        format!("http://{endpoint}")
    }
}

async fn detectar_ollama(hardware: &HardwareInfo, endpoints: &[String]) -> DeteccionProveedor {
    let instalado = buscar_comando("ollama").is_some();
    let cliente = match reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
    {
        Ok(cliente) => cliente,
        Err(error) => {
            return DeteccionProveedor {
                proveedor: Proveedor::Ollama,
                instalado,
                disponible: false,
                autenticado: None,
                version: None,
                detalle: Some(format!("No se pudo preparar la conexión HTTP: {error}")),
                endpoint: None,
                modelos: Vec::new(),
            };
        }
    };

    let mut ultimo_error = None;

    for endpoint in endpoints {
        let url_tags = format!("{endpoint}/api/tags");
        let respuesta = cliente.get(&url_tags).send().await;

        match respuesta {
            Ok(respuesta) if respuesta.status().is_success() => {
                let json = match respuesta.json::<Value>().await {
                    Ok(json) => json,
                    Err(error) => {
                        ultimo_error = Some(format!("Respuesta inválida de {endpoint}: {error}"));
                        continue;
                    }
                };

                let modelos = modelos_ollama(&json, hardware);
                let version = version_ollama(&cliente, endpoint).await;

                return DeteccionProveedor {
                    proveedor: Proveedor::Ollama,
                    instalado: true,
                    disponible: true,
                    autenticado: None,
                    version,
                    detalle: Some(format!(
                        "Servicio activo en {endpoint} con {} modelo(s).",
                        modelos.len()
                    )),
                    endpoint: Some(endpoint.clone()),
                    modelos,
                };
            }
            Ok(respuesta) => {
                ultimo_error = Some(format!("{endpoint} respondió HTTP {}.", respuesta.status()));
            }
            Err(error) => {
                ultimo_error = Some(format!("No se pudo conectar con {endpoint}: {error}"));
            }
        }
    }

    DeteccionProveedor {
        proveedor: Proveedor::Ollama,
        instalado,
        disponible: false,
        autenticado: None,
        version: None,
        detalle: Some(if instalado {
            format!(
                "{}. Ollama está instalado, pero el servicio no responde. Arráncalo con `ollama serve`.",
                ultimo_error.unwrap_or_else(|| "No se encontró el servicio".to_string())
            )
        } else {
            "No se encontró Ollama instalado ni un servicio en 127.0.0.1:11434.".to_string()
        }),
        endpoint: None,
        modelos: Vec::new(),
    }
}

async fn version_ollama(cliente: &reqwest::Client, endpoint: &str) -> Option<String> {
    let respuesta = cliente
        .get(format!("{endpoint}/api/version"))
        .send()
        .await
        .ok()?;

    if !respuesta.status().is_success() {
        return None;
    }

    let json = respuesta.json::<Value>().await.ok()?;
    json.get("version")?.as_str().map(str::to_string)
}

fn modelos_ollama(json: &Value, hardware: &HardwareInfo) -> Vec<ModeloDisponible> {
    let Some(lista) = json.get("models").and_then(Value::as_array) else {
        return Vec::new();
    };

    let mut modelos: Vec<ModeloDisponible> = lista
        .iter()
        .filter_map(|modelo| {
            let id = modelo
                .get("name")
                .or_else(|| modelo.get("model"))
                .and_then(Value::as_str)?
                .to_string();

            let detalles = modelo.get("details");
            let tamano_bytes = modelo.get("size").and_then(Value::as_u64);
            let parametros = detalles
                .and_then(|d| d.get("parameter_size"))
                .and_then(Value::as_str)
                .map(str::to_string);
            let cuantizacion = detalles
                .and_then(|d| d.get("quantization_level"))
                .and_then(Value::as_str)
                .map(str::to_string);
            let capacidades = modelo
                .get("capabilities")
                .and_then(Value::as_array)
                .map(|valores| {
                    valores
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            // Descarta modelos que solo sirven para embeddings.
            if !capacidades.is_empty() && !capacidades.iter().any(|c| c == "completion") {
                return None;
            }

            Some(ModeloDisponible {
                id: id.clone(),
                nombre: id,
                proveedor: Proveedor::Ollama,
                tamano_bytes,
                parametros,
                cuantizacion,
                capacidades,
                gratis: true,
                recomendacion: hardware::recomendar(tamano_bytes, hardware),
            })
        })
        .collect();

    modelos.sort_by(|a, b| {
        let es_base = |m: &ModeloDisponible| {
            let nombre = m.id.to_lowercase();
            nombre.contains("base") || nombre.contains("embed")
        };

        let rank = |m: &ModeloDisponible| match m.recomendacion.as_ref().map(|r| r.nivel.as_str()) {
            Some("excelente") => 0,
            Some("buena") => 1,
            Some("lenta") => 2,
            Some("no_recomendada") => 3,
            _ => 4,
        };

        es_base(a)
            .cmp(&es_base(b))
            .then_with(|| rank(a).cmp(&rank(b)))
            .then_with(|| a.nombre.to_lowercase().cmp(&b.nombre.to_lowercase()))
    });

    modelos
}

async fn detectar_opencode() -> DeteccionProveedor {
    let Some(comando) = buscar_comando("opencode") else {
        return DeteccionProveedor {
            proveedor: Proveedor::Opencode,
            instalado: false,
            disponible: false,
            autenticado: None,
            version: None,
            detalle: Some(
                "No se encontró el CLI de opencode. Instálalo y ejecuta `opencode auth login`."
                    .to_string(),
            ),
            endpoint: None,
            modelos: Vec::new(),
        };
    };

    let version = ejecutar(&comando, &["--version".to_string()], 8)
        .await
        .ok()
        .map(|salida| salida.stdout.trim().to_string())
        .filter(|v| !v.is_empty());

    let auth = ejecutar(&comando, &["auth".to_string(), "list".to_string()], 12).await;
    let autenticado = auth.as_ref().ok().map(|salida| {
        salida
            .stdout
            .lines()
            .any(|linea| linea.to_lowercase().contains("stored"))
    });

    let salida_modelos = match ejecutar(&comando, &["models".to_string()], 25).await {
        Ok(salida) if salida.codigo == Some(0) => salida,
        Ok(salida) => {
            return DeteccionProveedor {
                proveedor: Proveedor::Opencode,
                instalado: true,
                disponible: false,
                autenticado,
                version,
                detalle: Some(format!(
                    "opencode respondió con error: {}",
                    recortar(salida.stderr.trim(), 280)
                )),
                endpoint: None,
                modelos: Vec::new(),
            };
        }
        Err(error) => {
            return DeteccionProveedor {
                proveedor: Proveedor::Opencode,
                instalado: true,
                disponible: false,
                autenticado,
                version,
                detalle: Some(format!(
                    "No se pudo listar los modelos de opencode: {error}"
                )),
                endpoint: None,
                modelos: Vec::new(),
            };
        }
    };

    let modelos = modelos_opencode(&salida_modelos.stdout);

    DeteccionProveedor {
        proveedor: Proveedor::Opencode,
        instalado: true,
        disponible: !modelos.is_empty(),
        autenticado,
        version,
        detalle: Some(if modelos.is_empty() {
            format!(
                "opencode no devolvió modelos de opencode-go. {}",
                recortar(salida_modelos.stdout.trim(), 240)
            )
        } else if autenticado == Some(false) {
            "Hay modelos disponibles, pero no se detectó una sesión guardada. Ejecuta `opencode auth login`."
                .to_string()
        } else {
            format!("{} modelo(s) de opencode-go detectados.", modelos.len())
        }),
        endpoint: None,
        modelos,
    }
}

fn modelos_opencode(salida: &str) -> Vec<ModeloDisponible> {
    let mut modelos: Vec<ModeloDisponible> = salida
        .lines()
        .map(str::trim)
        .filter(|linea| !linea.is_empty())
        .filter_map(|linea| {
            let (proveedor, modelo) = linea.split_once('/')?;

            if proveedor != "opencode-go" && proveedor != "opencode" {
                return None;
            }

            let id = linea.to_string();
            let gratis = modelo.contains("free") || modelo.contains("contributor");

            Some(ModeloDisponible {
                id,
                nombre: modelo.to_string(),
                proveedor: Proveedor::Opencode,
                tamano_bytes: None,
                parametros: None,
                cuantizacion: None,
                capacidades: Vec::new(),
                gratis,
                recomendacion: Some(recomendacion_remota(
                    "Requiere internet y una sesión activa de opencode.",
                )),
            })
        })
        .collect();

    modelos.sort_by(|a, b| {
        b.gratis
            .cmp(&a.gratis)
            .then_with(|| a.nombre.to_lowercase().cmp(&b.nombre.to_lowercase()))
    });

    modelos
}

async fn detectar_claude() -> DeteccionProveedor {
    let Some(comando) = buscar_comando("claude") else {
        return DeteccionProveedor {
            proveedor: Proveedor::Claude,
            instalado: false,
            disponible: false,
            autenticado: None,
            version: None,
            detalle: Some(
                "No se encontró Claude Code. Instálalo y ejecuta `claude auth login`.".to_string(),
            ),
            endpoint: None,
            modelos: Vec::new(),
        };
    };

    let version = ejecutar(&comando, &["--version".to_string()], 8)
        .await
        .ok()
        .map(|salida| salida.stdout.trim().to_string())
        .filter(|v| !v.is_empty());

    let auth = ejecutar(&comando, &["auth".to_string(), "status".to_string()], 12).await;
    let (autenticado, detalle_auth) = match auth {
        Ok(salida) => {
            let json = extraer_json(&salida.stdout);
            let logged = json
                .as_ref()
                .and_then(|j| j.get("loggedIn"))
                .and_then(Value::as_bool);
            let email = json
                .as_ref()
                .and_then(|j| j.get("email"))
                .and_then(Value::as_str)
                .map(str::to_string);
            let metodo = json
                .as_ref()
                .and_then(|j| j.get("authMethod"))
                .and_then(Value::as_str)
                .map(str::to_string);

            let detalle = match (logged, email, metodo) {
                (Some(true), Some(email), metodo) => Some(format!(
                    "Sesión iniciada como {email}{}.",
                    metodo.map(|m| format!(" ({m})")).unwrap_or_default()
                )),
                (Some(false), _, _) => Some(
                    "Claude Code no tiene sesión iniciada. Ejecuta `claude auth login`."
                        .to_string(),
                ),
                _ => Some("No se pudo interpretar el estado de sesión de Claude Code.".to_string()),
            };

            (logged, detalle)
        }
        Err(error) => (
            None,
            Some(format!(
                "No se pudo comprobar la sesión de Claude Code: {error}"
            )),
        ),
    };

    let modelos = vec![
        modelo_claude(
            "sonnet",
            "Claude Sonnet",
            "Equilibrio entre calidad y velocidad.",
        ),
        modelo_claude("opus", "Claude Opus", "Máxima calidad; consume más cuota."),
        modelo_claude("haiku", "Claude Haiku", "El más rápido y económico."),
    ];

    DeteccionProveedor {
        proveedor: Proveedor::Claude,
        instalado: true,
        disponible: true,
        autenticado,
        version,
        detalle: detalle_auth,
        endpoint: None,
        modelos,
    }
}

fn modelo_claude(id: &str, nombre: &str, detalle: &str) -> ModeloDisponible {
    ModeloDisponible {
        id: id.to_string(),
        nombre: nombre.to_string(),
        proveedor: Proveedor::Claude,
        tamano_bytes: None,
        parametros: None,
        cuantizacion: None,
        capacidades: Vec::new(),
        gratis: false,
        recomendacion: Some(recomendacion_remota(detalle)),
    }
}

fn recomendacion_remota(detalle: &str) -> Recomendacion {
    Recomendacion {
        nivel: "remota".to_string(),
        etiqueta: "Modelo remoto".to_string(),
        detalle: detalle.to_string(),
        memoria_estimada_bytes: None,
    }
}

/// Busca un ejecutable en PATH y en ubicaciones habituales de instalación.
pub fn buscar_comando(nombre: &str) -> Option<PathBuf> {
    if nombre.contains('/') {
        let ruta = PathBuf::from(nombre);
        return es_ejecutable(&ruta).then_some(ruta);
    }

    if let Ok(path) = std::env::var("PATH") {
        for directorio in path.split(':') {
            if directorio.is_empty() {
                continue;
            }

            let ruta = Path::new(directorio).join(nombre);
            if es_ejecutable(&ruta) {
                return Some(ruta);
            }
        }
    }

    let home = std::env::var("HOME").ok()?;
    let candidatos = [
        PathBuf::from(&home).join(".local/bin").join(nombre),
        PathBuf::from(&home).join(".opencode/bin").join(nombre),
        PathBuf::from(&home).join(".cargo/bin").join(nombre),
        PathBuf::from("/usr/local/bin").join(nombre),
        PathBuf::from("/usr/bin").join(nombre),
        PathBuf::from("/snap/bin").join(nombre),
    ];

    candidatos.into_iter().find(|ruta| es_ejecutable(ruta))
}

fn es_ejecutable(ruta: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        ruta.metadata()
            .map(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(not(unix))]
    {
        ruta.is_file()
    }
}

/// Ejecuta un comando sin shell, con timeout y salida acotada.
pub async fn ejecutar(
    programa: &Path,
    args: &[String],
    timeout_segundos: u64,
) -> Result<Salida, String> {
    let mut comando = Command::new(programa);
    comando
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let hijo = comando
        .spawn()
        .map_err(|error| format!("No se pudo ejecutar {}: {error}", programa.display()))?;

    let salida = tokio::time::timeout(
        Duration::from_secs(timeout_segundos),
        hijo.wait_with_output(),
    )
    .await
    .map_err(|_| {
        format!(
            "{} tardó más de {timeout_segundos} s en responder.",
            programa.display()
        )
    })?
    .map_err(|error| format!("Error al esperar a {}: {error}", programa.display()))?;

    Ok(Salida {
        stdout: recortar(&String::from_utf8_lossy(&salida.stdout), 64_000),
        stderr: recortar(&String::from_utf8_lossy(&salida.stderr), 16_000),
        codigo: salida.status.code(),
    })
}

fn extraer_json(texto: &str) -> Option<Value> {
    let inicio = texto.find('{')?;
    let fin = texto.rfind('}')?;

    if fin <= inicio {
        return None;
    }

    serde_json::from_str(&texto[inicio..=fin]).ok()
}

pub fn recortar(texto: &str, maximo: usize) -> String {
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

    #[test]
    fn parsea_modelos_de_opencode_go() {
        let salida = "opencode-go/beam-free\nopencode-go/deepseek-v4-pro\nollama/qwen2.5:7b\n\ngithub-copilot/claude-sonnet-5\n";
        let modelos = modelos_opencode(salida);

        assert_eq!(modelos.len(), 2);
        assert_eq!(modelos[0].id, "opencode-go/beam-free");
        assert!(modelos[0].gratis);
        assert!(!modelos[1].gratis);
    }

    #[test]
    fn encuentra_los_cli_instalados() {
        assert!(
            buscar_comando("ollama").is_some(),
            "Ollama debería estar instalado"
        );
        assert!(
            buscar_comando("opencode").is_some(),
            "opencode debería estar instalado"
        );
        assert!(
            buscar_comando("claude").is_some(),
            "Claude Code debería estar instalado"
        );
    }

    #[tokio::test]
    #[ignore = "consulta los proveedores reales del equipo"]
    async fn detecta_los_proveedores_reales() {
        let hardware = crate::ia::hardware::detectar();
        let deteccion = detectar(&hardware, &IaConfig::default()).await;

        println!(
            "hardware: {} · {} núcleos · RAM libre {} · GPU {:?}",
            hardware.cpu,
            hardware.nucleos,
            hardware.ram_disponible_bytes,
            hardware.gpu.as_ref().map(|g| &g.nombre)
        );
        println!(
            "ollama: {} modelos · {}",
            deteccion.ollama.modelos.len(),
            deteccion.ollama.detalle.clone().unwrap_or_default()
        );
        println!(
            "opencode: {} modelos · {}",
            deteccion.opencode.modelos.len(),
            deteccion.opencode.detalle.clone().unwrap_or_default()
        );
        println!(
            "claude: {} modelos · {}",
            deteccion.claude.modelos.len(),
            deteccion.claude.detalle.clone().unwrap_or_default()
        );

        assert!(deteccion.ollama.disponible);
        assert!(!deteccion.ollama.modelos.is_empty());
        assert!(deteccion.opencode.instalado);
        assert!(deteccion.claude.instalado);
    }

    #[tokio::test]
    #[ignore = "envía una petición real al modelo local"]
    async fn prueba_un_modelo_local() {
        let hardware = crate::ia::hardware::detectar();
        let deteccion = detectar(&hardware, &IaConfig::default()).await;
        let modelo = deteccion
            .ollama
            .modelos
            .iter()
            .min_by_key(|m| m.tamano_bytes.unwrap_or(u64::MAX))
            .expect("debe haber al menos un modelo de Ollama");

        let conexion = crate::ia::model::ConexionIa {
            id: "prueba".to_string(),
            nombre: "Prueba".to_string(),
            proveedor: Proveedor::Ollama,
            modelo: modelo.id.clone(),
            endpoint: deteccion.ollama.endpoint.clone(),
            comando: None,
            tamano_bytes: modelo.tamano_bytes,
            parametros: None,
            cuantizacion: None,
            capacidades: Vec::new(),
            gratis: true,
            ultima_prueba: None,
            creada_ms: 0,
        };

        let resultado = crate::ia::probe::probar(&conexion).await;
        println!("prueba: ok={} mensaje={}", resultado.ok, resultado.mensaje);
        assert!(resultado.ok, "{}", resultado.mensaje);
    }
}
