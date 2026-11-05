//! Detección de hardware y recomendación de modelos locales.
//!
//! Solo se lee información del sistema; no se modifica nada.

use super::model::{GpuInfo, HardwareInfo, Recomendacion};
use std::fs;
use std::path::Path;
use std::process::Command;

const GIB: f64 = 1024.0 * 1024.0 * 1024.0;

pub fn detectar() -> HardwareInfo {
    let ram_total_bytes = leer_meminfo("MemTotal").unwrap_or(0);
    let ram_disponible_bytes = leer_meminfo("MemAvailable").unwrap_or(ram_total_bytes);

    HardwareInfo {
        cpu: leer_cpu(),
        nucleos: std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or_else(|_| leer_nucleos_cpu()),
        ram_total_bytes,
        ram_disponible_bytes,
        gpu: detectar_gpu(),
    }
}

fn leer_cpu() -> String {
    let Ok(contenido) = fs::read_to_string("/proc/cpuinfo") else {
        return "CPU desconocida".to_string();
    };

    for linea in contenido.lines() {
        if let Some(valor) = linea.strip_prefix("model name") {
            if let Some(valor) = valor.split(':').nth(1) {
                return valor.trim().to_string();
            }
        }
    }

    "CPU desconocida".to_string()
}

fn leer_nucleos_cpu() -> usize {
    fs::read_to_string("/proc/cpuinfo")
        .map(|contenido| {
            contenido
                .lines()
                .filter(|linea| linea.starts_with("processor"))
                .count()
        })
        .unwrap_or(1)
        .max(1)
}

fn leer_meminfo(clave: &str) -> Option<u64> {
    let contenido = fs::read_to_string("/proc/meminfo").ok()?;

    for linea in contenido.lines() {
        if linea.starts_with(clave) {
            let kb = linea.split_whitespace().nth(1)?.parse::<u64>().ok()?;
            return Some(kb.saturating_mul(1024));
        }
    }

    None
}

fn detectar_gpu() -> Option<GpuInfo> {
    detectar_nvidia()
        .or_else(detectar_amd)
        .or_else(detectar_por_lspci)
}

fn detectar_nvidia() -> Option<GpuInfo> {
    let salida = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total,memory.free",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !salida.status.success() {
        return None;
    }

    let texto = String::from_utf8_lossy(&salida.stdout);
    let linea = texto.lines().find(|l| !l.trim().is_empty())?;
    let partes: Vec<&str> = linea.split(',').map(str::trim).collect();

    if partes.len() < 3 {
        return None;
    }

    let total = partes[1].parse::<u64>().ok().map(|mib| mib * 1024 * 1024);
    let libre = partes[2].parse::<u64>().ok().map(|mib| mib * 1024 * 1024);

    Some(GpuInfo {
        nombre: partes[0].to_string(),
        vram_total_bytes: total,
        vram_libre_bytes: libre,
        integrada: false,
    })
}

fn detectar_amd() -> Option<GpuInfo> {
    let drm = Path::new("/sys/class/drm");
    let entradas = fs::read_dir(drm).ok()?;

    for entrada in entradas.flatten() {
        let nombre = entrada.file_name();
        let nombre = nombre.to_string_lossy();

        if !nombre.starts_with("card") || nombre.contains('-') {
            continue;
        }

        let base = entrada.path().join("device");
        let total = leer_u64(base.join("mem_info_vram_total"));
        let usado = leer_u64(base.join("mem_info_vram_used"));

        let Some(total) = total else {
            continue;
        };

        if total == 0 {
            continue;
        }

        return Some(GpuInfo {
            nombre: nombre_gpu_lspci().unwrap_or_else(|| format!("GPU AMD ({nombre})")),
            vram_total_bytes: Some(total),
            vram_libre_bytes: Some(total.saturating_sub(usado.unwrap_or(0))),
            integrada: false,
        });
    }

    None
}

fn detectar_por_lspci() -> Option<GpuInfo> {
    let nombre = nombre_gpu_lspci()?;

    Some(GpuInfo {
        nombre,
        vram_total_bytes: None,
        vram_libre_bytes: None,
        integrada: true,
    })
}

fn nombre_gpu_lspci() -> Option<String> {
    let salida = Command::new("lspci").output().ok()?;

    if !salida.status.success() {
        return None;
    }

    let texto = String::from_utf8_lossy(&salida.stdout);
    let linea = texto.lines().find(|l| {
        let l = l.to_lowercase();
        l.contains("vga compatible")
            || l.contains("3d controller")
            || l.contains("display controller")
    })?;

    let nombre = linea.split(':').nth(2)?.trim().to_string();

    if nombre.is_empty() {
        None
    } else {
        Some(nombre)
    }
}

fn leer_u64(ruta: impl AsRef<Path>) -> Option<u64> {
    fs::read_to_string(ruta).ok()?.trim().parse().ok()
}

/// Calcula si un modelo local cabe en la GPU, en la RAM o en ninguna.
pub fn recomendar(tamano_bytes: Option<u64>, hardware: &HardwareInfo) -> Option<Recomendacion> {
    let tamano = tamano_bytes?;

    // Peso del modelo + margen para contexto, caché y runtime.
    let requerido = (tamano as f64 * 1.18 + 1.5 * GIB).ceil() as u64;

    if let Some(gpu) = &hardware.gpu {
        if let Some(libre) = gpu.vram_libre_bytes {
            if libre >= requerido {
                return Some(Recomendacion {
                    nivel: "excelente".to_string(),
                    etiqueta: "Recomendado (GPU)".to_string(),
                    detalle: format!("Cabe en la VRAM libre de la {}.", acortar_gpu(&gpu.nombre)),
                    memoria_estimada_bytes: Some(requerido),
                });
            }
        }

        if let Some(total) = gpu.vram_total_bytes {
            if total >= requerido {
                return Some(Recomendacion {
                    nivel: "buena".to_string(),
                    etiqueta: "Recomendado (GPU, justo)".to_string(),
                    detalle: "Cabe en la GPU, pero puede compartir memoria con otras apps."
                        .to_string(),
                    memoria_estimada_bytes: Some(requerido),
                });
            }
        }
    }

    let margen_cpu = 2 * 1024 * 1024 * 1024;
    if hardware.ram_disponible_bytes >= requerido.saturating_add(margen_cpu) {
        return Some(Recomendacion {
            nivel: "lenta".to_string(),
            etiqueta: "Funciona en CPU".to_string(),
            detalle: "No cabe en la GPU; se ejecutará en CPU y será más lento.".to_string(),
            memoria_estimada_bytes: Some(requerido),
        });
    }

    Some(Recomendacion {
        nivel: "no_recomendada".to_string(),
        etiqueta: "No recomendado".to_string(),
        detalle: "No hay memoria suficiente para cargarlo con holgura.".to_string(),
        memoria_estimada_bytes: Some(requerido),
    })
}

fn acortar_gpu(nombre: &str) -> String {
    let nombre = nombre.trim();

    if nombre.len() > 42 {
        format!("{}…", &nombre[..41])
    } else {
        nombre.to_string()
    }
}
