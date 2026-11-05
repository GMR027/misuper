//! Lectura del PDF y segmentación en candidatas a receta.
//!
//! Esta primera versión no usa IA: extrae el texto con `pdftotext` y aplica
//! reglas para proponer qué partes del libro parecen recetas. La extracción
//! fina (ingredientes, pasos y reescritura) se conecta en la fase siguiente.

pub mod pdf;
pub mod segmentar;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct RecetaCandidata {
    pub id: usize,
    pub titulo: String,
    pub pagina_inicio: u32,
    pub pagina_fin: u32,
    pub confianza: u8,
    pub estado: String,
    pub motivo: Option<String>,
    pub ingredientes_detectados: usize,
    pub pasos_detectados: usize,
    pub lineas: usize,
    pub vista_previa: String,
    pub texto: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalisisPdf {
    pub archivo: String,
    pub nombre: String,
    pub paginas: u32,
    pub caracteres: usize,
    pub candidatas: Vec<RecetaCandidata>,
    pub avisos: Vec<String>,
}

pub fn analizar(ruta: &str) -> Result<AnalisisPdf, String> {
    let documento = pdf::leer(ruta)?;

    if documento.paginas.is_empty() {
        return Err("El PDF no tiene páginas legibles.".to_string());
    }

    let caracteres: usize = documento
        .paginas
        .iter()
        .map(|pagina| pagina.lineas.iter().map(String::len).sum::<usize>())
        .sum();

    let mut avisos = Vec::new();

    if caracteres < 200 {
        avisos.push(
            "Casi no se encontró texto. Puede ser un PDF escaneado: en esa versión hará falta visión."
                .to_string(),
        );
    }

    if documento.paginas.len() > 400 {
        avisos.push(
            "El archivo es grande; se analizarán las primeras 400 páginas para no bloquear la app."
                .to_string(),
        );
    }

    let paginas_limitadas: Vec<pdf::Pagina> = documento.paginas.into_iter().take(400).collect();
    let candidatas = segmentar::segmentar(&paginas_limitadas);

    if candidatas
        .iter()
        .filter(|c| c.estado != "descartada")
        .count()
        == 0
    {
        avisos.push(
            "No se detectaron recetas con claridad. Revisa que el PDF tenga texto seleccionable."
                .to_string(),
        );
    }

    Ok(AnalisisPdf {
        archivo: documento.ruta.display().to_string(),
        nombre: documento.nombre,
        paginas: paginas_limitadas.len() as u32,
        caracteres,
        candidatas,
        avisos,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ruta_fixture(nombre: &str) -> String {
        format!(
            "{}/../tests/fixtures/libros/{nombre}",
            env!("CARGO_MANIFEST_DIR")
        )
    }

    #[test]
    fn analiza_los_recetarios_reales() {
        if std::process::Command::new("pdftotext")
            .arg("-v")
            .output()
            .is_err()
        {
            eprintln!("pdftotext no está instalado; se omite la prueba con PDF reales.");
            return;
        }

        let libros = [
            ("recetario_cocina_gallega.pdf", 25),
            ("recetario_ensaladas.pdf", 25),
            ("recetas-cocina-italiana-web.pdf", 25),
        ];

        for (libro, minimo) in libros {
            let analisis =
                analizar(&ruta_fixture(libro)).unwrap_or_else(|error| panic!("{libro}: {error}"));

            let utiles: Vec<_> = analisis
                .candidatas
                .iter()
                .filter(|c| c.estado != "descartada")
                .collect();

            println!(
                "{libro}: {} páginas · {} candidatas · {} útiles",
                analisis.paginas,
                analisis.candidatas.len(),
                utiles.len()
            );

            for candidata in utiles.iter().take(10) {
                println!(
                    "  [{}] {} (p. {}–{}) · ing={} pasos={}",
                    candidata.estado,
                    candidata.titulo,
                    candidata.pagina_inicio,
                    candidata.pagina_fin,
                    candidata.ingredientes_detectados,
                    candidata.pasos_detectados
                );
            }

            assert!(
                utiles.len() >= minimo,
                "{libro}: se esperaban al menos {minimo} recetas útiles, se obtuvieron {}",
                utiles.len()
            );
        }
    }

    #[test]
    fn analiza_los_tres_libros_de_muestra() {
        if std::process::Command::new("pdftotext")
            .arg("-v")
            .output()
            .is_err()
        {
            eprintln!("pdftotext no está instalado; se omite la prueba con PDF reales.");
            return;
        }

        let libros = [
            "el-libro-de-la-casa.pdf",
            "la-cocina-blanca.pdf",
            "la-ama-de-casa.pdf",
        ];

        for libro in libros {
            let analisis =
                analizar(&ruta_fixture(libro)).unwrap_or_else(|error| panic!("{libro}: {error}"));

            let utiles: Vec<_> = analisis
                .candidatas
                .iter()
                .filter(|c| c.estado != "descartada")
                .collect();

            println!(
                "{libro}: {} páginas · {} candidatas · {} útiles",
                analisis.paginas,
                analisis.candidatas.len(),
                utiles.len()
            );

            for candidata in utiles.iter().take(8) {
                println!(
                    "  [{}] {} (p. {}–{}) · ing={} pasos={}",
                    candidata.estado,
                    candidata.titulo,
                    candidata.pagina_inicio,
                    candidata.pagina_fin,
                    candidata.ingredientes_detectados,
                    candidata.pasos_detectados
                );
            }

            assert!(
                utiles.len() >= 10,
                "{libro}: se esperaban al menos 10 recetas útiles"
            );
        }
    }
}
