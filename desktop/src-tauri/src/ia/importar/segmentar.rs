//! Segmentación heurística de un libro en candidatas a receta.
//!
//! Dos estrategias:
//! 1. **Anclas**: los recetarios modernos repiten un bloque de metadatos
//!    (tiempo, raciones, coste, calorías) al inicio de cada receta. Ese bloque
//!    es más fiable que los títulos, que a veces son imágenes.
//! 2. **Títulos**: para libros clásicos de texto corrido sin metadatos.
//!
//! La extracción fina se hará después con el modelo y un esquema validado.

use super::RecetaCandidata;
use crate::ia::importar::pdf::Pagina;
use std::collections::HashSet;

#[derive(Debug, Clone)]
struct Linea {
    texto: String,
    pagina: u32,
}

const SECCIONES: &[&str] = &[
    "index",
    "contents",
    "table of contents",
    "preface",
    "introduction",
    "chapter",
    "part",
    "appendix",
    "glossary",
    "bibliography",
    "soups",
    "fish",
    "meats",
    "meat",
    "vegetables",
    "desserts",
    "cakes",
    "puddings",
    "bread",
    "sauces",
    "poultry",
    "game",
    "salads",
    "beverages",
    "household",
    "carving",
    "pastry",
    "preserves",
    "entrantes",
    "ensaladas",
    "pastas",
    "carnes",
    "pescados",
    "postres",
];

const UNIDADES: &[&str] = &[
    "g",
    "gr",
    "gram",
    "grams",
    "gramo",
    "gramos",
    "kg",
    "kilo",
    "kilos",
    "mg",
    "ml",
    "l",
    "lt",
    "liter",
    "litre",
    "litro",
    "litros",
    "oz",
    "ounce",
    "ounces",
    "lb",
    "lbs",
    "pound",
    "pounds",
    "pint",
    "pints",
    "quart",
    "quarts",
    "cup",
    "cups",
    "cupful",
    "cupfuls",
    "tablespoon",
    "tablespoons",
    "tablespoonful",
    "tablespoonfuls",
    "teaspoon",
    "teaspoons",
    "teaspoonful",
    "teaspoonfuls",
    "tsp",
    "tbsp",
    "taza",
    "tazas",
    "cucharada",
    "cucharadas",
    "cucharadita",
    "cucharaditas",
    "pza",
    "pza.",
    "pieza",
    "piezas",
    "unidad",
    "unidades",
    "diente",
    "dientes",
    "rama",
    "ramas",
    "manojo",
    "manojos",
    "pizca",
    "pizcas",
    "lata",
    "latas",
    "paquete",
    "paquetes",
    "vaso",
    "vasos",
    "cda",
    "cdas",
    "cdta",
    "cdtas",
];

const VERBOS: &[&str] = &[
    "mix",
    "stir",
    "add",
    "heat",
    "cook",
    "bake",
    "boil",
    "fry",
    "place",
    "pour",
    "serve",
    "combine",
    "whisk",
    "season",
    "cut",
    "peel",
    "preheat",
    "drain",
    "remove",
    "transfer",
    "cover",
    "simmer",
    "roast",
    "grill",
    "saute",
    "sauté",
    "knead",
    "beat",
    "chop",
    "slice",
    "dice",
    "garnish",
    "batir",
    "mezclar",
    "añadir",
    "agregar",
    "calentar",
    "cocinar",
    "hornear",
    "hervir",
    "freír",
    "freir",
    "colocar",
    "verter",
    "servir",
    "combinar",
    "sazonar",
    "cortar",
    "pelar",
    "precalentar",
    "escurrir",
    "retirar",
    "cubrir",
    "sofreír",
    "sofreir",
    "revolver",
    "amasar",
    "lavar",
    "lavamos",
    "picar",
    "picamos",
    "sofreímos",
    "sofreimos",
    "añadimos",
    "agregamos",
    "colocamos",
    "mezclamos",
    "calentamos",
    "cocemos",
    "escurrimos",
    "retiramos",
    "servimos",
    "preparamos",
    "preparar",
];

const NUMEROS_PALABRA: &[&str] = &[
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
    "twelve", "half", "quarter", "un", "una", "uno", "dos", "tres", "cuatro", "cinco", "seis",
    "siete", "ocho", "nueve", "diez", "media", "medio", "unos", "unas",
];

const PALABRAS_PROSA: &[&str] = &[
    "es",
    "son",
    "está",
    "estan",
    "están",
    "tiene",
    "tienen",
    "puedes",
    "puede",
    "queremos",
    "quiere",
    "recomendamos",
    "hace",
    "hacer",
    "hemos",
    "hay",
    "ser",
    "muy",
    "pero",
    "porque",
    "cuando",
    "donde",
    "tras",
    "como",
    "debemos",
    "tenemos",
    "podemos",
    "serie",
    "cuenta",
    "contrapartida",
    "preferimos",
];

#[derive(Debug, Clone, Default)]
struct Rasgos {
    no_vacias: usize,
    ingredientes: usize,
    pasos: usize,
    verbos: usize,
    prosa_larga: usize,
    lineas_cortas: usize,
    parrafos: usize,
}

pub fn segmentar(paginas: &[Pagina]) -> Vec<RecetaCandidata> {
    let paginas = deduplicar_paginas(paginas);

    if paginas.is_empty() {
        return Vec::new();
    }

    let lineas = aplanar(&paginas);

    if lineas.is_empty() {
        return Vec::new();
    }

    let grupos = anclas_metadata(&lineas);

    if !grupos.is_empty() {
        let candidatas = segmentar_por_anclas(&lineas, &grupos);

        if !candidatas.is_empty() {
            return candidatas;
        }
    }

    segmentar_por_titulos(&lineas)
}

/// Elimina páginas repetidas (los PDF exportados desde web suelen duplicar la
/// primera página o repetir páginas completas).
fn deduplicar_paginas(paginas: &[Pagina]) -> Vec<Pagina> {
    let mut vistos: HashSet<String> = HashSet::new();
    let mut resultado = Vec::new();

    for pagina in paginas {
        let normalizado = pagina
            .lineas
            .iter()
            .map(|linea| linea.trim())
            .filter(|linea| !linea.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
            .to_lowercase();

        if normalizado.chars().count() < 40 {
            resultado.push(pagina.clone());
            continue;
        }

        if vistos.insert(normalizado) {
            resultado.push(pagina.clone());
        }
    }

    resultado
}

/// Detecta el bloque de metadatos que marca el inicio de una receta.
fn es_metadata(texto: &str) -> bool {
    let texto = texto.trim();

    if texto.chars().count() > 200 {
        return false;
    }

    let t = texto.to_lowercase();
    let tiempo = t.contains("tiempo");
    let raciones = t.contains("raciones")
        || (t.contains("para ") && (t.contains("persona") || t.contains("pers")))
        || t.contains("comensales");
    let coste = t.contains("coste")
        || t.contains("€/pers")
        || t.contains("euros/persona")
        || t.contains("€/persona")
        || t.contains("euros por persona");
    let calorias = t.contains("kcal") || t.contains("calorías") || t.contains("calorias");

    (tiempo && (raciones || coste || calorias || t.contains("min")))
        || (raciones && (coste || calorias))
        || (calorias && (coste || t.contains("para ") || t.contains("€")))
        || (t.contains("min") && t.contains("€") && t.contains("pers"))
}

fn es_ancla_ingredientes(texto: &str) -> bool {
    let normalizado = normalizar_titulo(texto);

    normalizado == "ingredientes" || normalizado == "ingredients"
}

fn anclas_metadata(lineas: &[Linea]) -> Vec<(usize, usize)> {
    let mut grupos: Vec<(usize, usize)> = Vec::new();

    for (indice, linea) in lineas.iter().enumerate() {
        if !es_metadata(&linea.texto) {
            continue;
        }

        match grupos.last_mut() {
            Some((_, fin)) if indice.saturating_sub(*fin) <= 2 => {
                *fin = indice;
            }
            _ => grupos.push((indice, indice)),
        }
    }

    let mut filtrados = Vec::new();
    let mut ultima_firma = String::new();
    let mut ultima_pagina = 0;

    for (inicio, fin) in grupos {
        let firma = lineas[inicio..=fin]
            .iter()
            .map(|linea| normalizar_titulo(&linea.texto))
            .collect::<Vec<_>>()
            .join("|");
        let pagina = lineas[inicio].pagina;

        if firma == ultima_firma && pagina.saturating_sub(ultima_pagina) <= 4 {
            ultima_pagina = pagina;
            continue;
        }

        filtrados.push((inicio, fin));
        ultima_firma = firma;
        ultima_pagina = pagina;
    }

    filtrados
}

fn segmentar_por_anclas(lineas: &[Linea], grupos: &[(usize, usize)]) -> Vec<RecetaCandidata> {
    struct Base {
        inicio: usize,
        grupo_fin: usize,
        titulo: String,
        provisional: bool,
    }

    let mut bases: Vec<Base> = Vec::new();

    for &(grupo_inicio, grupo_fin) in grupos {
        let (inicio, titulo_portada) = match portada_antes(lineas, grupo_inicio) {
            Some((inicio, titulo)) => (inicio, Some(titulo)),
            None => (grupo_inicio, None),
        };

        let (titulo, provisional) = match titulo_portada {
            Some(titulo) => (titulo, false),
            None => titulo_desde_grupo(lineas, grupo_inicio, grupo_fin),
        };

        let (titulo, provisional) = if !provisional && !es_titulo_probable(&titulo) {
            (
                format!(
                    "Receta sin título (p. {})",
                    lineas
                        .get(grupo_inicio)
                        .map(|linea| linea.pagina)
                        .unwrap_or(0)
                ),
                true,
            )
        } else {
            (titulo, provisional)
        };

        let inicio = if let Some(anterior) = bases.last() {
            inicio.max(anterior.inicio + 1)
        } else {
            inicio
        };

        bases.push(Base {
            inicio,
            grupo_fin,
            titulo,
            provisional,
        });
    }

    bases.sort_by_key(|base| base.inicio);

    let mut candidatas = Vec::new();
    let mut titulos_vistos: HashSet<String> = HashSet::new();

    for (posicion, base) in bases.iter().enumerate() {
        let fin = bases
            .get(posicion + 1)
            .map(|siguiente| siguiente.inicio)
            .unwrap_or(lineas.len());

        if fin <= base.inicio + 2 {
            continue;
        }

        let bloque = &lineas[base.inicio..fin];
        let rasgos = medir(bloque);
        let temprano = medir(ventana_inicial(bloque, 18));

        if rasgos.no_vacias < 4 {
            continue;
        }

        if temprano.ingredientes == 0 && temprano.verbos == 0 && temprano.pasos == 0 {
            continue;
        }

        let (estado, confianza, motivo) = clasificar(&rasgos, &base.titulo);

        let (estado, confianza, motivo) = if estado == "descartada" {
            (
                "dudosa".to_string(),
                confianza.max(35),
                Some("Se detectó una receta, pero faltan ingredientes o pasos claros.".to_string()),
            )
        } else {
            (estado, confianza, motivo)
        };

        let (estado, confianza, motivo) = if base.provisional {
            (
                "dudosa".to_string(),
                confianza,
                Some(
                    "No se encontró el título. Puedes buscarlo con visión o escribirlo al extraer."
                        .to_string(),
                ),
            )
        } else {
            let normalizado = normalizar_titulo(&base.titulo);

            if !normalizado.is_empty() && !titulos_vistos.insert(normalizado) {
                (
                    "dudosa".to_string(),
                    confianza,
                    Some("Título repetido; revisa si es la misma receta.".to_string()),
                )
            } else {
                (estado, confianza, motivo)
            }
        };

        let pagina_inicio = bloque
            .iter()
            .find(|linea| !linea.texto.trim().is_empty())
            .map(|linea| linea.pagina)
            .unwrap_or(0);

        let pagina_fin = bloque
            .iter()
            .rev()
            .find(|linea| !linea.texto.trim().is_empty())
            .map(|linea| linea.pagina)
            .unwrap_or(pagina_inicio);

        let texto = unir_texto(bloque, 14_000);

        candidatas.push(RecetaCandidata {
            id: candidatas.len() + 1,
            titulo: base.titulo.clone(),
            pagina_inicio,
            pagina_fin,
            confianza,
            estado,
            motivo,
            ingredientes_detectados: rasgos.ingredientes,
            pasos_detectados: rasgos.pasos,
            lineas: rasgos.no_vacias,
            vista_previa: recortar(&texto, 1_200),
            texto,
        });

        let _ = base.grupo_fin;
    }

    candidatas.truncate(300);
    candidatas
}

fn es_pie_portada(texto: &str) -> bool {
    let t = texto.to_lowercase();
    let palabras = texto.split_whitespace().count();

    t.starts_with("fácil")
        || t.starts_with("facil")
        || t.starts_with("difícil")
        || t.starts_with("dificil")
        || t.starts_with("por ")
        || t.starts_with("autor")
        || t.starts_with("dificultad")
        || (palabras <= 2 && texto.chars().all(|c| c.is_ascii_digit()))
        || (t.contains(" min") && t.contains("por "))
        || (t.contains("min") && palabras <= 6 && t.contains("autor"))
}

/// Si la página anterior es una portada de receta (título en imagen o diseño),
/// la usa como inicio y título.
fn portada_antes(lineas: &[Linea], grupo_inicio: usize) -> Option<(usize, String)> {
    let pagina = lineas.get(grupo_inicio)?.pagina;

    if pagina <= 1 {
        return None;
    }

    let inicio = lineas.iter().position(|linea| linea.pagina == pagina - 1)?;
    let fin = lineas
        .iter()
        .rposition(|linea| linea.pagina == pagina - 1)
        .map(|indice| indice + 1)?;

    let contenido: Vec<&Linea> = lineas[inicio..fin]
        .iter()
        .filter(|linea| {
            let texto = linea.texto.trim();
            !texto.is_empty() && !es_pie_portada(texto)
        })
        .collect();

    if contenido.is_empty() || contenido.len() > 6 {
        return None;
    }

    let palabras: usize = contenido
        .iter()
        .map(|linea| linea.texto.split_whitespace().count())
        .sum();

    if palabras > 30 {
        return None;
    }

    if contenido
        .iter()
        .any(|linea| es_metadata(&linea.texto) || es_ancla_ingredientes(&linea.texto))
    {
        return None;
    }

    if contenido
        .iter()
        .any(|linea| linea.texto.split_whitespace().count() > 14)
    {
        return None;
    }

    let titulo = contenido
        .iter()
        .map(|linea| linea.texto.trim())
        .collect::<Vec<_>>()
        .join(" ");

    if titulo.chars().count() < 3 || titulo.chars().count() > 140 {
        return None;
    }

    if !es_titulo_probable(&titulo) {
        return None;
    }

    let normalizado = normalizar_titulo(&titulo);

    if es_categoria(&titulo)
        || SECCIONES.contains(&normalizado.as_str())
        || normalizado.contains("seccion")
        || normalizado.contains("capitulo")
        || normalizado.contains("indice")
        || normalizado.starts_with("recetas de")
        || normalizado.starts_with("libro de")
    {
        return None;
    }

    Some((inicio, titulo))
}

fn unir_continuacion(lineas: &[Linea], inicio: usize, limite: usize) -> String {
    let mut titulo = limpiar_titulo(&lineas[inicio].texto);
    let fin = (inicio + 3).min(limite);

    for linea in &lineas[inicio + 1..fin] {
        let texto = linea.texto.trim();

        if texto.is_empty()
            || es_metadata(texto)
            || es_ancla_ingredientes(texto)
            || es_categoria(texto)
            || es_ingrediente(texto)
            || es_paso(texto)
        {
            break;
        }

        let empieza_minuscula = texto
            .chars()
            .find(|c| c.is_alphabetic())
            .map(|c| c.is_lowercase())
            .unwrap_or(false);

        if !empieza_minuscula || texto.chars().count() > 90 {
            break;
        }

        let unido = format!("{titulo} {texto}");

        if unido.chars().count() > 140 {
            break;
        }

        titulo = unido;
    }

    titulo
}

fn titulo_desde_grupo(lineas: &[Linea], grupo_inicio: usize, grupo_fin: usize) -> (String, bool) {
    // 1. Después de los metadatos y de la categoría. Es el caso de los
    //    recetarios con el título debajo del bloque de tiempo/raciones.
    let limite = (grupo_fin + 14).min(lineas.len());

    for (indice, linea) in lineas[grupo_fin + 1..limite].iter().enumerate() {
        let texto = linea.texto.trim();

        if texto.is_empty() || es_metadata(texto) {
            continue;
        }

        if es_ancla_ingredientes(texto) || es_ingrediente(texto) {
            break;
        }

        if es_categoria(texto) {
            continue;
        }

        if es_titulo_probable(texto) {
            let absoluto = grupo_fin + 1 + indice;
            return (unir_continuacion(lineas, absoluto, limite), false);
        }
    }

    // 2. Antes de los metadatos, por si el título está arriba.
    let desde = grupo_inicio.saturating_sub(6);

    for linea in lineas[desde..grupo_inicio].iter().rev() {
        let texto = linea.texto.trim();

        if texto.is_empty() || es_metadata(texto) || es_ancla_ingredientes(texto) {
            continue;
        }

        if es_categoria(texto) {
            continue;
        }

        if es_titulo_probable(texto) {
            return (limpiar_titulo(texto), false);
        }
    }

    // 3. Una frase entre comillas dentro de la introducción.
    let limite_cita = (grupo_inicio + 80).min(lineas.len());

    for linea in &lineas[grupo_inicio..limite_cita] {
        if let Some(cita) = extraer_cita(&linea.texto) {
            if es_titulo_probable(&cita) {
                return (cita, false);
            }
        }
    }

    let pagina = lineas
        .get(grupo_inicio)
        .map(|linea| linea.pagina)
        .unwrap_or(0);

    (format!("Receta sin título (p. {pagina})"), true)
}

fn es_categoria(texto: &str) -> bool {
    let texto = texto.trim();
    let palabras = texto.split_whitespace().count();

    if palabras == 0 || !es_mayusculas(texto) || texto.ends_with('.') {
        return false;
    }

    let comprimido: String = normalizar_titulo(texto)
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();

    let conocidas = [
        "entrantes",
        "entrantesytapas",
        "ensaladas",
        "pastas",
        "carnes",
        "pescados",
        "postres",
        "sopas",
        "aperitivos",
        "tapas",
    ];

    conocidas.iter().any(|clave| comprimido.contains(clave)) || palabras <= 2
}

fn es_titulo_probable(texto: &str) -> bool {
    let texto = texto.trim();

    if texto.chars().count() < 3 || texto.chars().count() > 140 {
        return false;
    }

    let palabras: Vec<&str> = texto.split_whitespace().collect();

    if palabras.len() < 2 || palabras.len() > 18 {
        return false;
    }

    let primera_letra = texto.chars().find(|c| c.is_alphabetic());

    if !primera_letra.map(|c| c.is_uppercase()).unwrap_or(false) {
        return false;
    }

    if texto.contains("http://") || texto.contains("https://") || texto.contains('@') {
        return false;
    }

    if texto.starts_with('¿')
        || texto.starts_with('¡')
        || texto.starts_with('-')
        || texto.starts_with('·')
    {
        return false;
    }

    let primera = texto.split_whitespace().next().unwrap_or("");

    if primera
        .chars()
        .next()
        .map(|c| c.is_ascii_digit())
        .unwrap_or(false)
        || es_cantidad(primera)
    {
        return false;
    }

    if texto.ends_with(',') || texto.ends_with(';') || texto.ends_with(':') {
        return false;
    }

    if es_metadata(texto) || es_ancla_ingredientes(texto) || es_paso(texto) || es_ingrediente(texto)
    {
        return false;
    }

    let normalizado = normalizar_titulo(texto);

    if SECCIONES.contains(&normalizado.as_str())
        || normalizado.starts_with("recetas de")
        || normalizado.starts_with("de rechupete")
        || normalizado.contains("indice")
        || normalizado == "hecho en casa"
    {
        return false;
    }

    let bajo = texto.to_lowercase();

    if palabras
        .iter()
        .any(|palabra| PALABRAS_PROSA.contains(&palabra.to_lowercase().as_str()))
    {
        return false;
    }

    if texto.ends_with('.') && palabras.len() >= 8 {
        return false;
    }

    if bajo.starts_with("modo")
        || bajo.starts_with("preparación")
        || bajo.starts_with("preparacion")
        || bajo.starts_with("elaboración")
        || bajo.starts_with("elaboracion")
        || bajo.starts_with("paso a paso")
    {
        return false;
    }

    true
}

fn extraer_cita(texto: &str) -> Option<String> {
    let pares = [('«', '»'), ('“', '”')];

    for (abre, cierra) in pares {
        if let Some(inicio) = texto.find(abre) {
            if let Some(fin_relativo) = texto[inicio + abre.len_utf8()..].find(cierra) {
                let fin = inicio + abre.len_utf8() + fin_relativo;
                let cita = texto[inicio + abre.len_utf8()..fin].trim();

                if cita.chars().count() >= 3
                    && cita.chars().count() <= 120
                    && cita.split_whitespace().count() >= 1
                {
                    return Some(limpiar_titulo(cita));
                }
            }
        }
    }

    None
}

fn segmentar_por_titulos(lineas: &[Linea]) -> Vec<RecetaCandidata> {
    let titulos: Vec<usize> = lineas
        .iter()
        .enumerate()
        .filter(|(indice, linea)| {
            let inicio_de_parrafo = *indice == 0
                || lineas
                    .get(indice.saturating_sub(1))
                    .map(|anterior| anterior.texto.trim().is_empty())
                    .unwrap_or(true);

            inicio_de_parrafo && es_candidato_titulo(&linea.texto)
        })
        .map(|(indice, _)| indice)
        .collect();

    let mut utiles = Vec::new();

    for (posicion, &inicio) in titulos.iter().enumerate() {
        let fin = titulos
            .get(posicion + 1)
            .copied()
            .unwrap_or_else(|| (inicio + 90).min(lineas.len()));

        let bloque = &lineas[inicio + 1..fin];
        let rasgos = medir(bloque);
        let temprano = medir(ventana_inicial(bloque, 14));
        let titulo = limpiar_titulo(&lineas[inicio].texto);

        if es_seccion(&titulo)
            || parece_indice(&rasgos)
            || (temprano.ingredientes == 0 && temprano.verbos == 0 && temprano.pasos == 0)
        {
            continue;
        }

        utiles.push((inicio, fin, rasgos, titulo));
    }

    let mut inicios: Vec<usize> = utiles.iter().map(|(inicio, _, _, _)| *inicio).collect();
    inicios.sort_unstable();

    let mut candidatas = Vec::new();
    let mut vistos: Vec<(String, String)> = Vec::new();

    for (posicion, &inicio) in inicios.iter().enumerate() {
        let fin = inicios
            .get(posicion + 1)
            .copied()
            .unwrap_or_else(|| (inicio + 90).min(lineas.len()));

        let bloque = &lineas[inicio + 1..fin];
        let rasgos = medir(bloque);
        let titulo = limpiar_titulo(&lineas[inicio].texto);

        if bloque.iter().filter(|l| !l.texto.trim().is_empty()).count() < 3 {
            continue;
        }

        if rasgos.ingredientes == 0 && rasgos.verbos == 0 && rasgos.pasos == 0 {
            continue;
        }

        let (estado, confianza, motivo) = clasificar(&rasgos, &titulo);

        let normalizado = normalizar_titulo(&titulo);
        let duplicada = vistos.iter().find(|(otro, _)| {
            *otro == normalizado
                || (otro.len() > 8 && normalizado.len() > 8 && levenshtein(otro, &normalizado) <= 2)
        });

        let (estado, motivo) = match duplicada {
            Some((_, original)) if estado != "descartada" => (
                "dudosa".to_string(),
                Some(format!(
                    "Título parecido a «{original}»; revisa si es la misma receta."
                )),
            ),
            _ => (estado, motivo),
        };

        let pagina_inicio = bloque
            .iter()
            .find(|l| !l.texto.trim().is_empty())
            .map(|l| l.pagina)
            .unwrap_or(lineas[inicio].pagina);

        let pagina_fin = bloque
            .iter()
            .rev()
            .find(|l| !l.texto.trim().is_empty())
            .map(|l| l.pagina)
            .unwrap_or(pagina_inicio);

        let texto = unir_texto(bloque, 14_000);
        let descartada = estado == "descartada";

        candidatas.push(RecetaCandidata {
            id: candidatas.len() + 1,
            titulo: titulo.clone(),
            pagina_inicio,
            pagina_fin,
            confianza,
            estado,
            motivo,
            ingredientes_detectados: rasgos.ingredientes,
            pasos_detectados: rasgos.pasos,
            lineas: rasgos.no_vacias,
            vista_previa: recortar(&texto, 1_200),
            texto,
        });

        if !normalizado.is_empty() && !descartada {
            vistos.push((normalizado, titulo));
        }
    }

    candidatas.truncate(300);
    candidatas
}

fn aplanar(paginas: &[Pagina]) -> Vec<Linea> {
    let mut lineas = Vec::new();

    for pagina in paginas {
        for texto in &pagina.lineas {
            lineas.push(Linea {
                texto: texto.trim().to_string(),
                pagina: pagina.numero,
            });
        }

        lineas.push(Linea {
            texto: String::new(),
            pagina: pagina.numero,
        });
    }

    lineas
}

fn medir(lineas: &[Linea]) -> Rasgos {
    let mut rasgos = Rasgos::default();
    let mut anterior_vacia = true;
    let mut en_ingredientes = false;

    for linea in lineas {
        let texto = linea.texto.trim();

        if texto.is_empty() {
            anterior_vacia = true;
            en_ingredientes = false;
            continue;
        }

        rasgos.no_vacias += 1;

        if es_ingrediente(texto) {
            en_ingredientes = true;
        }

        if en_ingredientes {
            let cantidades = contar_cantidades(texto);

            if cantidades > 0 {
                rasgos.ingredientes += cantidades;
            } else if !es_ingrediente(texto) {
                en_ingredientes = false;
            }
        }

        if es_paso(texto) {
            rasgos.pasos += 1;
        }

        if contiene_verbo(texto) {
            rasgos.verbos += 1;
        }

        if texto.split_whitespace().count() >= 18 {
            rasgos.prosa_larga += 1;
        }

        if texto.chars().count() <= 40 {
            rasgos.lineas_cortas += 1;
        }

        if anterior_vacia {
            rasgos.parrafos += 1;
        }

        anterior_vacia = false;
    }

    rasgos
}

fn ventana_inicial(lineas: &[Linea], maximo: usize) -> &[Linea] {
    let mut vistos = 0;

    for (indice, linea) in lineas.iter().enumerate() {
        if linea.texto.trim().is_empty() {
            continue;
        }

        vistos += 1;

        if vistos >= maximo {
            return &lineas[..=indice];
        }
    }

    lineas
}

fn clasificar(rasgos: &Rasgos, titulo: &str) -> (String, u8, Option<String>) {
    if rasgos.no_vacias < 3 {
        return (
            "descartada".to_string(),
            10,
            Some("El bloque es demasiado corto.".to_string()),
        );
    }

    if parece_indice(rasgos) {
        return (
            "descartada".to_string(),
            12,
            Some("Parece un índice o una lista de títulos.".to_string()),
        );
    }

    let confianza: u8 = if rasgos.ingredientes >= 3 && rasgos.pasos >= 1 && rasgos.verbos >= 2 {
        92
    } else if rasgos.ingredientes >= 2 && (rasgos.verbos >= 1 || rasgos.pasos >= 1) {
        80
    } else if rasgos.ingredientes >= 1 && (rasgos.pasos >= 1 || rasgos.verbos >= 2) {
        66
    } else if rasgos.verbos >= 2 && rasgos.prosa_larga >= 1 {
        54
    } else if rasgos.verbos >= 1 {
        38
    } else {
        18
    };

    let confianza = if titulo.split_whitespace().count() <= 2 && confianza < 80 {
        confianza.saturating_sub(8)
    } else {
        confianza
    };

    let (estado, motivo) = if confianza >= 60 {
        ("lista".to_string(), None)
    } else if confianza >= 30 {
        (
            "dudosa".to_string(),
            Some("Se detectó algo de cocina, pero faltan ingredientes o pasos claros.".to_string()),
        )
    } else {
        (
            "descartada".to_string(),
            Some("No se encontraron ingredientes ni pasos de cocina.".to_string()),
        )
    };

    (estado, confianza, motivo)
}

fn parece_indice(rasgos: &Rasgos) -> bool {
    rasgos.no_vacias >= 5
        && rasgos.ingredientes == 0
        && rasgos.verbos <= 1
        && rasgos.lineas_cortas as f32 / rasgos.no_vacias as f32 >= 0.6
}

fn es_seccion(titulo: &str) -> bool {
    let limpio = normalizar_titulo(titulo);

    SECCIONES.contains(&limpio.as_str())
        || limpio.contains("preface")
        || limpio.contains("index")
        || limpio.contains("table of contents")
        || limpio.starts_with("chapter ")
        || limpio.starts_with("capítulo ")
        || limpio.starts_with("parte ")
}

fn es_mayusculas(texto: &str) -> bool {
    let letras: Vec<char> = texto.chars().filter(|c| c.is_alphabetic()).collect();

    !letras.is_empty() && letras.iter().all(|c| c.is_uppercase())
}

fn es_candidato_titulo(texto: &str) -> bool {
    let texto = texto.trim();

    if texto.len() < 3 || texto.len() > 90 {
        return false;
    }

    let bajo = texto.to_lowercase();

    if bajo.starts_with("mode")
        || bajo.starts_with("method")
        || bajo.starts_with("directions")
        || bajo.starts_with("preparation")
        || bajo.starts_with("ingredients")
        || bajo.starts_with("ingredientes")
    {
        return false;
    }

    let palabras = texto.split_whitespace().count();

    if palabras > 12 || palabras == 0 {
        return false;
    }

    let Some(primera) = texto.chars().find(|c| c.is_alphabetic()) else {
        return false;
    };

    if !primera.is_uppercase() {
        return false;
    }

    if texto.contains("http://") || texto.contains("https://") || texto.contains('@') {
        return false;
    }

    if texto.ends_with(',') || texto.ends_with(';') || texto.ends_with(':') {
        return false;
    }

    if texto
        .chars()
        .filter(|c| c.is_alphabetic())
        .all(|c| c.is_lowercase())
    {
        return false;
    }

    if texto.ends_with('.') && (palabras > 8 || texto.contains(',')) {
        return false;
    }

    if texto.ends_with('.') && palabras >= 6 && !es_mayusculas(texto) {
        return false;
    }

    if texto
        .chars()
        .all(|c| c.is_ascii_digit() || c.is_whitespace() || c == '.')
    {
        return false;
    }

    if bajo.starts_with("no. ") || bajo.starts_with("fig.") || bajo.starts_with("page ") {
        return false;
    }

    if texto.starts_with('"') || texto.starts_with('“') {
        return false;
    }

    let palabras_bajo: Vec<&str> = bajo.split_whitespace().collect();
    let conectores_frase = [
        "may", "might", "is", "are", "was", "were", "has", "have", "had", "can", "will", "be",
        "been", "being", "this", "that", "these", "those",
    ];

    if palabras_bajo.len() >= 5
        && palabras_bajo
            .iter()
            .any(|palabra| conectores_frase.contains(palabra))
    {
        return false;
    }

    if let Some(ultima) = palabras_bajo.last() {
        if palabras_bajo.len() >= 4
            && [
                "and", "or", "of", "to", "the", "with", "for", "be", "by", "in",
            ]
            .contains(ultima)
        {
            return false;
        }
    }

    if ["commonly called", "continued", "concluded", "see also"]
        .iter()
        .any(|inicio| bajo.starts_with(inicio))
    {
        return false;
    }

    if palabras >= 10 && !es_mayusculas(texto) {
        return false;
    }

    if let Some(ultima) = palabras_bajo.last() {
        if ultima.chars().all(|c| c.is_ascii_digit()) && ultima.len() <= 4 {
            return false;
        }
    }

    true
}

fn es_ingrediente(texto: &str) -> bool {
    let limpio = texto
        .trim()
        .trim_start_matches(|c: char| c == '_' || c == '-' || c == '*' || c == '•' || c == '·')
        .trim();
    let bajo = limpio.to_lowercase();

    if bajo.starts_with("ingredients") || bajo.starts_with("ingredientes") {
        return true;
    }

    let Some(primera) = bajo.split_whitespace().next() else {
        return false;
    };

    if !es_cantidad(primera) {
        return false;
    }

    let palabras: Vec<&str> = bajo.split_whitespace().take(8).collect();
    let tiene_unidad = palabras
        .iter()
        .any(|palabra| UNIDADES.contains(&palabra.trim_matches(|c: char| !c.is_alphabetic())));

    tiene_unidad
        || limpio.contains("--")
        || limpio.contains('—')
        || bajo.contains(" of ")
        || limpio.matches(',').count() >= 2
}

fn es_cantidad(palabra: &str) -> bool {
    let limpia = palabra.trim_matches(|c: char| {
        !(c.is_ascii_alphanumeric()
            || c == '/'
            || c == '-'
            || c == '.'
            || c == '½'
            || c == '¼'
            || c == '¾'
            || c == '⅓'
            || c == '⅔')
    });

    if limpia.is_empty() {
        return false;
    }

    if limpia
        .chars()
        .next()
        .map(|c| c.is_ascii_digit() || "½¼¾⅓⅔".contains(c))
        .unwrap_or(false)
    {
        return true;
    }

    let bajo = limpia.to_lowercase();
    NUMEROS_PALABRA.contains(&bajo.as_str()) || bajo.starts_with("one-") || bajo.starts_with("two-")
}

fn es_paso(texto: &str) -> bool {
    let limpio = texto.trim();
    let bajo = limpio.to_lowercase();

    if bajo.starts_with("mode")
        || bajo.starts_with("method")
        || bajo.starts_with("directions")
        || bajo.starts_with("preparation")
        || bajo.starts_with("procedimiento")
        || bajo.starts_with("preparación")
        || bajo.starts_with("elaboración")
        || bajo.contains("mode.--")
        || bajo.contains("method.--")
        || bajo.contains("directions.--")
        || bajo.contains("preparation.--")
        || bajo.contains("mode:")
    {
        return true;
    }

    let empieza_numero = limpio
        .chars()
        .next()
        .map(|c| c.is_ascii_digit())
        .unwrap_or(false);

    if empieza_numero {
        let resto = limpio.trim_start_matches(|c: char| c.is_ascii_digit() || c == '.' || c == ')');

        if resto
            .trim_start()
            .chars()
            .next()
            .map(|c| c.is_uppercase())
            .unwrap_or(false)
            && resto.split_whitespace().count() >= 3
        {
            return true;
        }
    }

    let primera = bajo
        .trim_start_matches(|c: char| !c.is_alphabetic())
        .split_whitespace()
        .next()
        .unwrap_or("");

    VERBOS.contains(&primera) && texto.split_whitespace().count() >= 4
}

fn contar_cantidades(texto: &str) -> usize {
    texto
        .split_whitespace()
        .filter(|palabra| es_cantidad(palabra))
        .count()
}

fn contiene_verbo(texto: &str) -> bool {
    texto
        .to_lowercase()
        .split(|c: char| !c.is_alphabetic())
        .any(|palabra| VERBOS.contains(&palabra))
}

fn limpiar_titulo(texto: &str) -> String {
    let limpio = texto
        .trim()
        .trim_matches(|c: char| c == '_' || c == '*' || c == '#' || c == '=')
        .trim();

    let mut resultado = String::new();
    let mut anterior_espacio = false;

    for caracter in limpio.chars() {
        if caracter.is_whitespace() {
            if !anterior_espacio {
                resultado.push(' ');
            }
            anterior_espacio = true;
        } else {
            resultado.push(caracter);
            anterior_espacio = false;
        }
    }

    resultado.trim().to_string()
}

fn normalizar_titulo(titulo: &str) -> String {
    let sin_acentos = titulo
        .to_lowercase()
        .replace(['á', 'à', 'ä', 'â'], "a")
        .replace(['é', 'è', 'ë', 'ê'], "e")
        .replace(['í', 'ì', 'ï', 'î'], "i")
        .replace(['ó', 'ò', 'ö', 'ô'], "o")
        .replace(['ú', 'ù', 'ü', 'û'], "u")
        .replace('ñ', "n");

    sin_acentos
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn unir_texto(lineas: &[Linea], maximo: usize) -> String {
    let mut texto = String::new();

    for linea in lineas {
        if linea.texto.trim().is_empty() {
            if !texto.ends_with("\n\n") && !texto.is_empty() {
                texto.push_str("\n\n");
            }
            continue;
        }

        if !texto.is_empty() && !texto.ends_with('\n') {
            texto.push('\n');
        }

        texto.push_str(&linea.texto);

        if texto.chars().count() >= maximo {
            break;
        }
    }

    recortar(texto.trim(), maximo)
}

fn recortar(texto: &str, maximo: usize) -> String {
    if texto.chars().count() <= maximo {
        texto.to_string()
    } else {
        let recortado: String = texto.chars().take(maximo).collect();
        format!("{recortado}…")
    }
}

fn levenshtein(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();

    if a.is_empty() {
        return b.len();
    }

    if b.is_empty() {
        return a.len();
    }

    let mut anterior: Vec<usize> = (0..=b.len()).collect();
    let mut actual = vec![0; b.len() + 1];

    for (i, ca) in a.iter().enumerate() {
        actual[0] = i + 1;

        for (j, cb) in b.iter().enumerate() {
            let coste = usize::from(ca != cb);
            actual[j + 1] = (anterior[j] + coste)
                .min(anterior[j + 1] + 1)
                .min(actual[j] + 1);
        }

        std::mem::swap(&mut anterior, &mut actual);
    }

    anterior[b.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paginas(texto: &str) -> Vec<Pagina> {
        vec![Pagina {
            numero: 1,
            lineas: texto.lines().map(str::to_string).collect(),
        }]
    }

    #[test]
    fn detecta_recetas_con_ingredientes_y_pasos() {
        let texto = r#"
SOUPS.

RICH BEEF STOCK.

4 lbs. of shin of beef, 3 onions, 2 carrots, 1 head of celery.
1 oz. of salt, 12 peppercorns, 4 quarts of water.

Mode.--Line a stewpan with the ham, add the beef and water.
Simmer very slowly for five hours, then strain and serve.

MUSHROOM SOUP.

1 lb. of mushrooms, 2 oz. of butter, 1 pint of milk.
Pepper and salt to taste.

Mode.--Clean the mushrooms and cut them in pieces.
Stew them in butter, add the milk and boil for ten minutes.
"#;

        let candidatas = segmentar(&paginas(texto));
        let utiles: Vec<_> = candidatas
            .iter()
            .filter(|c| c.estado != "descartada")
            .collect();

        assert_eq!(utiles.len(), 2);
        assert_eq!(utiles[0].titulo, "RICH BEEF STOCK.");
        assert!(utiles[0].ingredientes_detectados >= 2);
    }

    #[test]
    fn descarta_un_indice() {
        let texto = r#"
CONTENTS.

Soups 12
Fish 34
Meats 56
Vegetables 78
Pastry 90
Preserves 120
"#;

        let candidatas = segmentar(&paginas(texto));
        assert!(candidatas.iter().all(|c| c.estado == "descartada"));
    }

    #[test]
    fn agrupa_por_metadatos_y_no_por_subtitulos() {
        let texto = r#"
PARA 4                 1.20€/PERS.    180KCAL/100G
Ingredientes
200 g de arroz
1 cebolla
Elaboración paso a paso
1 Lavamos el arroz y lo escurrimos.
2 Sofreímos la cebolla y añadimos el arroz.

PARA 2                 0.80€/PERS.    120KCAL/100G
Ingredientes
100 g de pasta
1 tomate
Preparación
1 Cocemos la pasta.
2 Añadimos el tomate y servimos.
"#;

        let candidatas = segmentar(&paginas(texto));
        let utiles: Vec<_> = candidatas
            .iter()
            .filter(|c| c.estado != "descartada")
            .collect();

        assert_eq!(utiles.len(), 2);
        assert!(utiles[0].titulo.starts_with("Receta sin título"));
    }
}
