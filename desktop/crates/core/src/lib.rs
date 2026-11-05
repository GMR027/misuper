//! Reglas y tipos de dominio de Mi Súper.
//!
//! Este crate no hace IO: todo lo que hay aquí se puede probar con `cargo test`.
//! Las reglas que hoy viven en PHP se irán portando aquí fase por fase.

use serde::{Deserialize, Serialize};

/// Resumen de datos locales que muestra el inicio de la app.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Stats {
    pub productos: i64,
    pub recetas: i64,
    pub compras: i64,
    pub items: i64,
    pub categorias: i64,
    pub tipos_recetas: i64,
    pub categorias_recetas: i64,
}

/// Normaliza texto para búsquedas: minúsculas, sin acentos y sin espacios extra.
pub fn normalizar(texto: &str) -> String {
    let mut salida = String::with_capacity(texto.len());
    let mut espacio = false;

    for c in texto.trim().chars() {
        let c = match c {
            'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
            'ñ' | 'Ñ' => 'n',
            otro => otro,
        };

        if c.is_whitespace() {
            if !espacio && !salida.is_empty() {
                salida.push(' ');
                espacio = true;
            }
        } else {
            for min in c.to_lowercase() {
                salida.push(min);
            }
            espacio = false;
        }
    }

    while salida.ends_with(' ') {
        salida.pop();
    }

    salida
}

/// Formatea un importe en pesos mexicanos, igual que la web.
pub fn moneda(valor: f64) -> String {
    format!("${:.2}", valor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normaliza_acentos_y_espacios() {
        assert_eq!(normalizar("  Plátano   Macho "), "platano macho");
        assert_eq!(normalizar("Jamón de Pavo"), "jamon de pavo");
        assert_eq!(normalizar("Niño"), "nino");
    }

    #[test]
    fn formatea_moneda() {
        assert_eq!(moneda(12.5), "$12.50");
    }
}
