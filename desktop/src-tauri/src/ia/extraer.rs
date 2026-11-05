//! Extracción de una receta a partir del texto detectado en el PDF.
//!
//! El modelo propone; el código valida. Si el JSON no cumple el esquema se
//! pide una sola reparación y, si vuelve a fallar, se devuelve el error.

use super::dietas::{self, CATEGORIAS, TIPOS};
use super::gateway;
use super::model::ConexionIa;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngredienteExtraido {
    pub nombre: String,
    #[serde(default)]
    pub cantidad: Option<f64>,
    #[serde(default)]
    pub unidad: String,
    #[serde(default)]
    pub producto: Option<String>,
    #[serde(default)]
    pub nota: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecetaExtraida {
    pub nombre: String,
    #[serde(default)]
    pub descripcion: String,
    #[serde(default = "porciones_defecto")]
    pub porciones: u8,
    #[serde(default = "tiempo_defecto")]
    pub tiempo_min: u16,
    #[serde(default = "dificultad_defecto")]
    pub dificultad: String,
    #[serde(default)]
    pub categoria: String,
    #[serde(default)]
    pub categoria_motivo: String,
    #[serde(default)]
    pub tipos: Vec<String>,
    #[serde(default)]
    pub tipos_motivos: BTreeMap<String, String>,
    #[serde(default)]
    pub ingredientes: Vec<IngredienteExtraido>,
    #[serde(default)]
    pub pasos: Vec<String>,
    #[serde(default)]
    pub avisos: Vec<String>,
}

fn porciones_defecto() -> u8 {
    4
}

fn tiempo_defecto() -> u16 {
    30
}

fn dificultad_defecto() -> String {
    "facil".to_string()
}

pub async fn extraer(texto: &str, conexion: &ConexionIa) -> Result<RecetaExtraida, String> {
    if texto.trim().chars().count() < 60 {
        return Err("El texto de la receta es demasiado corto para extraerla.".to_string());
    }

    let prompt = construir_prompt(texto);
    let respuesta = gateway::completar(conexion, &prompt).await?;

    match interpretar(&respuesta) {
        Ok(mut receta) => {
            if !numeros_conservados(texto, &receta) {
                receta.avisos.push(
                    "Alguna cantidad no coincide con el texto original; revísala antes de publicar."
                        .to_string(),
                );
            }

            Ok(receta)
        }
        Err(error) => {
            let reparacion = format!(
                "La respuesta anterior no cumplió el esquema: {error}.\n\
                 Devuelve SOLO el JSON corregido, sin texto adicional.\n\n\
                 Respuesta anterior:\n{respuesta}\n\n\
                 Texto original:\n{texto}"
            );

            let segunda = gateway::completar(conexion, &reparacion).await?;
            interpretar(&segunda)
                .map_err(|segundo_error| format!("{error}. Reintento: {segundo_error}"))
        }
    }
}

fn construir_prompt(texto: &str) -> String {
    format!(
        r#"Eres un chef y nutriólogo experto en salud alimenticia. Extrae UNA receta del siguiente texto de un libro de cocina.

Devuelve únicamente un objeto JSON válido, sin markdown ni explicaciones, con esta forma exacta:
{{
  "nombre": "nombre del platillo",
  "descripcion": "una o dos frases, máximo 500 caracteres",
  "porciones": 4,
  "tiempo_min": 30,
  "dificultad": "facil",
  "categoria": "guisados",
  "categoria_motivo": "por qué corresponde a esa categoría",
  "tipos": ["general", "vegetariano"],
  "tipos_motivos": {{"vegetariano": "no contiene carne, pescado ni mariscos"}},
  "ingredientes": [
    {{"nombre": "jitomate", "cantidad": 2, "unidad": "pza", "producto": "Jitomate", "nota": null}}
  ],
  "pasos": ["paso redactado con voz propia"],
  "avisos": []
}}

Reglas obligatorias:
- "unidad" solo puede ser: g, ml, kg, L, pza, al_gusto.
- Si el texto dice "al gusto", "una pizca" o similar, usa "al_gusto" y cantidad null.
- Si el libro usa medidas caseras, conviértelas a ml: 1 cucharada = 15 ml, 1 cucharadita = 5 ml, 1 taza = 240 ml, 1 vaso = 250 ml.
- "cantidad" debe ser un número mayor que 0, o null solo para al_gusto.
- "categoria" solo puede ser: {categorias}.
- "tipos" solo puede contener: {tipos}.
- Incluye siempre "general" en "tipos" y añade TODAS las dietas que cumplan los criterios.
- No inventes dietas: cada dieta debe estar justificada en "tipos_motivos" con los ingredientes escritos.
- "dificultad" solo puede ser: facil, media, dificil.
- Reescribe los pasos con voz propia, en español, sin copiar literalmente el libro, pero CONSERVANDO exactamente las cantidades, temperaturas, tiempos y técnica.
- No inventes ingredientes ni cantidades que no estén en el texto.
- Si un dato falta, usa un valor razonable y anótalo en "avisos".
- "producto" es el nombre normalizado del ingrediente para el catálogo; puede ser null.
- Las dietas son orientativas: si dudas de un ingrediente, no pongas esa dieta y anótalo en "avisos".

{reglas_categorias}

{reglas_dietas}

Texto de la receta:
---
{texto}
---"#,
        categorias = CATEGORIAS.join(", "),
        tipos = TIPOS.join(", "),
        reglas_categorias = dietas::REGLAS_CATEGORIAS,
        reglas_dietas = dietas::REGLAS_DIETAS,
    )
}

fn interpretar(respuesta: &str) -> Result<RecetaExtraida, String> {
    let json = extraer_json(respuesta)
        .ok_or_else(|| "La respuesta no contiene un objeto JSON.".to_string())?;

    let mut receta: RecetaExtraida = serde_json::from_value(json)
        .map_err(|error| format!("El JSON no tiene la forma esperada: {error}"))?;

    normalizar(&mut receta)?;
    Ok(receta)
}

fn normalizar(receta: &mut RecetaExtraida) -> Result<(), String> {
    receta.nombre = receta.nombre.trim().to_string();
    receta.descripcion = receta.descripcion.trim().chars().take(500).collect();

    if receta.nombre.chars().count() < 2 || receta.nombre.chars().count() > 150 {
        return Err("El nombre de la receta no es válido.".to_string());
    }

    receta.porciones = receta.porciones.clamp(1, 50);
    receta.tiempo_min = receta.tiempo_min.clamp(1, 240);

    if !["facil", "media", "dificil"].contains(&receta.dificultad.as_str()) {
        receta.dificultad = "facil".to_string();
    }

    if receta.ingredientes.is_empty() {
        return Err("La receta no tiene ingredientes.".to_string());
    }

    for ingrediente in &mut receta.ingredientes {
        ingrediente.nombre = ingrediente.nombre.trim().to_string();

        if ingrediente.nombre.is_empty() {
            return Err("Hay un ingrediente sin nombre.".to_string());
        }

        ingrediente.unidad = normalizar_unidad(&ingrediente.unidad);

        if ingrediente.unidad == "al_gusto" {
            ingrediente.cantidad = None;
        } else if ingrediente.cantidad.unwrap_or(0.0) <= 0.0 {
            ingrediente.unidad = "al_gusto".to_string();
            ingrediente.cantidad = None;
            ingrediente
                .nota
                .get_or_insert_with(|| "Cantidad no indicada en el libro.".to_string());
        } else {
            ingrediente.cantidad = ingrediente
                .cantidad
                .map(|cantidad| (cantidad * 1000.0).round() / 1000.0);
        }

        ingrediente.producto = ingrediente
            .producto
            .as_deref()
            .map(str::trim)
            .filter(|producto| !producto.is_empty())
            .map(str::to_string);
    }

    receta.tipos = receta
        .tipos
        .iter()
        .map(|tipo| tipo.trim().to_lowercase())
        .filter(|tipo| TIPOS.contains(&tipo.as_str()))
        .collect();

    receta.categoria = dietas::categoria(&receta.nombre, &receta.ingredientes, &receta.categoria);

    let (tipos, avisos_dietas) =
        dietas::ajustar(receta.tipos.clone(), &receta.nombre, &receta.ingredientes);

    receta.tipos = tipos;

    for aviso in avisos_dietas {
        if !receta.avisos.contains(&aviso) {
            receta.avisos.push(aviso);
        }
    }

    let motivos: BTreeMap<String, String> = receta
        .tipos_motivos
        .iter()
        .filter(|(tipo, _)| receta.tipos.iter().any(|elegido| elegido == *tipo))
        .map(|(tipo, motivo)| {
            (
                tipo.clone(),
                motivo.trim().chars().take(200).collect::<String>(),
            )
        })
        .filter(|(_, motivo)| !motivo.is_empty())
        .collect();

    receta.tipos_motivos = motivos;
    receta.categoria_motivo = receta.categoria_motivo.trim().chars().take(200).collect();

    receta.pasos = receta
        .pasos
        .iter()
        .map(|paso| paso.trim().chars().take(1000).collect::<String>())
        .filter(|paso| !paso.is_empty())
        .collect();

    if receta.pasos.is_empty() {
        return Err("La receta no tiene pasos.".to_string());
    }

    let mut avisos: Vec<String> = Vec::new();

    for aviso in receta.avisos.drain(..) {
        let aviso = aviso.trim().chars().take(500).collect::<String>();

        if !aviso.is_empty() && !avisos.contains(&aviso) {
            avisos.push(aviso);
        }
    }

    receta.avisos = avisos;

    Ok(())
}

fn normalizar_unidad(unidad: &str) -> String {
    let unidad = unidad.trim().to_lowercase();

    match unidad.as_str() {
        "g" | "gr" | "grs" | "gramo" | "gramos" => "g",
        "ml" | "cc" | "mililitro" | "mililitros" => "ml",
        "kg" | "kilo" | "kilos" | "kilogramo" | "kilogramos" => "kg",
        "l" | "lt" | "litro" | "litros" => "L",
        "pza" | "pzas" | "pieza" | "piezas" | "unidad" | "unidades" => "pza",
        _ => "al_gusto",
    }
    .to_string()
}

fn extraer_json(texto: &str) -> Option<Value> {
    let inicio = texto.find('{')?;
    let fin = texto.rfind('}')?;

    if fin <= inicio {
        return None;
    }

    serde_json::from_str(&texto[inicio..=fin]).ok()
}

/// Comprueba que los números importantes del original sigan presentes.
pub fn numeros_conservados(original: &str, receta: &RecetaExtraida) -> bool {
    let original = original.to_lowercase();
    let mut faltantes = 0;

    for ingrediente in &receta.ingredientes {
        if let Some(cantidad) = ingrediente.cantidad {
            let texto = if cantidad.fract() == 0.0 {
                format!("{}", cantidad as i64)
            } else {
                format!("{cantidad}")
            };

            if !original.contains(&texto) {
                faltantes += 1;
            }
        }
    }

    faltantes == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normaliza_unidades_y_al_gusto() {
        let mut receta = RecetaExtraida {
            nombre: "Prueba".to_string(),
            descripcion: String::new(),
            porciones: 4,
            tiempo_min: 30,
            dificultad: "facil".to_string(),
            categoria: "guisados".to_string(),
            categoria_motivo: String::new(),
            tipos: vec![],
            tipos_motivos: BTreeMap::new(),
            ingredientes: vec![
                IngredienteExtraido {
                    nombre: "Harina".to_string(),
                    cantidad: Some(200.0),
                    unidad: "gramos".to_string(),
                    producto: None,
                    nota: None,
                },
                IngredienteExtraido {
                    nombre: "Sal".to_string(),
                    cantidad: None,
                    unidad: "pizca".to_string(),
                    producto: None,
                    nota: None,
                },
            ],
            pasos: vec!["Mezclar todo.".to_string()],
            avisos: vec![],
        };

        normalizar(&mut receta).unwrap();
        assert_eq!(receta.ingredientes[0].unidad, "g");
        assert_eq!(receta.ingredientes[1].unidad, "al_gusto");
        assert!(receta.tipos.contains(&"general".to_string()));
        assert!(receta.tipos.contains(&"vegetariano".to_string()));
    }

    #[tokio::test]
    #[ignore = "envía una petición real al modelo local"]
    async fn extrae_una_receta_real() {
        let conexion = ConexionIa {
            id: "prueba".to_string(),
            nombre: "Ollama local".to_string(),
            proveedor: crate::ia::model::Proveedor::Ollama,
            modelo: "qwen2.5:7b".to_string(),
            endpoint: Some("http://127.0.0.1:11434".to_string()),
            comando: None,
            tamano_bytes: None,
            parametros: None,
            cuantizacion: None,
            capacidades: Vec::new(),
            gratis: true,
            ultima_prueba: None,
            creada_ms: 0,
        };

        let texto = r#"
Vieiras rellenas y gratinadas al horno
INGREDIENTES
· 4 cebollas
· 5 lonchas de jamón serrano
· 1 cucharada de salsa de tomate casera
· 1 vaso de vino blanco
· 75 ml de aceite de oliva
· 2 cucharadas de pan rallado
· 12 vieiras
· Una pizca de sal y pimienta negra
Preparación
1 Pelamos y troceamos finamente las cebollas.
2 Troceamos el jamón y lo sofreímos con el aceite.
3 Añadimos la cebolla y cocinamos 3 minutos.
4 Añadimos el vino y dejamos evaporar 5 minutos.
5 Precalentamos el horno a 200º C.
6 Horneamos las vieiras 12-15 minutos y gratinamos 2 minutos.
"#;

        let receta = extraer(texto, &conexion).await.expect("debe extraer");
        println!("{}", serde_json::to_string_pretty(&receta).unwrap());
        assert!(!receta.ingredientes.is_empty());
        assert!(!receta.pasos.is_empty());
        assert!(receta.tiempo_min > 0);
    }

    #[tokio::test]
    #[ignore = "envía una petición real al modelo local"]
    async fn extrae_una_receta_vegetariana_real() {
        let conexion = ConexionIa {
            id: "prueba".to_string(),
            nombre: "Ollama local".to_string(),
            proveedor: crate::ia::model::Proveedor::Ollama,
            modelo: "qwen2.5:7b".to_string(),
            endpoint: Some("http://127.0.0.1:11434".to_string()),
            comando: None,
            tamano_bytes: None,
            parametros: None,
            cuantizacion: None,
            capacidades: Vec::new(),
            gratis: true,
            ultima_prueba: None,
            creada_ms: 0,
        };

        let texto = r#"
Calabacitas con jitomate
INGREDIENTES
· 800 g de calabacita
· 450 g de jitomate
· 150 g de cebolla blanca
· 15 ml de aceite de oliva
· Sal al gusto
Preparación
1 Lava y corta la calabacita y el jitomate en trozos.
2 Calienta el aceite de oliva y sofríe la cebolla.
3 Agrega la calabacita y el jitomate y cocina 15 minutos.
4 Ajusta la sal y sirve.
"#;

        let receta = extraer(texto, &conexion).await.expect("debe extraer");
        println!("{}", serde_json::to_string_pretty(&receta).unwrap());
        assert!(receta.tipos.contains(&"general".to_string()));
        assert!(receta.tipos.contains(&"vegetariano".to_string()));
        assert!(receta.tipos.contains(&"sin_gluten".to_string()));
    }

    #[test]
    fn detecta_numeros_conservados() {
        let receta = RecetaExtraida {
            nombre: "Prueba".to_string(),
            descripcion: String::new(),
            porciones: 4,
            tiempo_min: 30,
            dificultad: "facil".to_string(),
            categoria: "guisados".to_string(),
            categoria_motivo: String::new(),
            tipos: vec!["general".to_string()],
            tipos_motivos: BTreeMap::new(),
            ingredientes: vec![IngredienteExtraido {
                nombre: "Harina".to_string(),
                cantidad: Some(200.0),
                unidad: "g".to_string(),
                producto: None,
                nota: None,
            }],
            pasos: vec!["Mezclar.".to_string()],
            avisos: vec![],
        };

        assert!(numeros_conservados("200 g de harina", &receta));
        assert!(!numeros_conservados("300 g de harina", &receta));
    }
}
