//! Reglas de dietas y categorías para la extracción de recetas.
//!
//! El modelo propone etiquetas; aquí se validan con reglas deterministas para
//! evitar afirmaciones imposibles (por ejemplo, "sin gluten" con harina de
//! trigo). Las dietas sensibles (kosher, diabético, DASH) solo se conservan si
//! el modelo las propone y pasan la validación.

use super::extraer::IngredienteExtraido;
use std::collections::BTreeSet;

pub const CATEGORIAS: &[&str] = &[
    "bebidas",
    "desayunos",
    "ensaladas",
    "sopas",
    "guisados",
    "platos-fuertes",
    "pastas",
    "complementos",
    "antojitos",
    "postres",
];

pub const TIPOS: &[&str] = &[
    "general",
    "diabetico",
    "kosher",
    "vegetariano",
    "sin_gluten",
    "mediterranea",
    "dash",
    "baja_carbohidratos",
    "keto",
];

/// Texto que se inyecta al prompt con los criterios de cada dieta.
pub const REGLAS_DIETAS: &str = r#"Criterios de dietas ("tipos"):
Incluye SIEMPRE "general" y añade TODAS las dietas que cumplan. No pongas una
dieta que no puedas justificar con los ingredientes escritos. Evalúa solo la
receta y sus ingredientes; NO supongas acompañamientos (tortillas, arroz, pan)
que no aparezcan en la lista. Las cantidades cuentan: una pizca no es lo mismo
que una taza.

- vegetariano: no lleva carne, aves, pescado ni mariscos. Huevo y lácteos sí.
  Rechaza si hay res, cerdo, pollo, pavo, cordero, jamón, tocino, chorizo,
  salchicha, pescado, atún, salmón, camarón, pulpo, calamar, etc.
- sin_gluten: no lleva trigo, harina de trigo, pan, pasta, espagueti, fideos,
  pan molido, empanizador, hojaldre, galleta, cebada, centeno, cerveza ni salsa
  de soya. Maíz, arroz, papa y frijol sí se permiten. La avena solo es segura
  si el texto dice "sin gluten"; si no, no pongas la dieta y anótalo en avisos.
- kosher: sin cerdo (cerdo, puerco, jamón, tocino, chorizo, salchicha, manteca)
  ni mariscos (camarón, langosta, cangrejo, pulpo, calamar, almeja, mejillón,
  ostión, vieira); pescado con aleta y escama (atún, salmón, tilapia) sí. No
  mezclar carne con lácteos en el mismo platillo (carne + leche, queso, crema,
  mantequilla o yogur). Es orientativa, no una certificación.
- diabetico: sin azúcar añadida, miel, piloncillo, jarabe, mermelada, refresco
  ni jugo industrial; base de verduras, legumbres, proteína y granos integrales;
  carbohidratos moderados. Rechaza postres dulces y recetas con harina refinada
  o más de un almidón alto (arroz blanco, papa, pan, pasta, tortilla).
- mediterranea: aceite de oliva como grasa principal y al menos dos de: pescado,
  legumbres, verduras, frutas, frutos secos o granos integrales. Rechaza si la
  grasa principal es mantequilla o manteca, o si hay embutidos en abundancia.
- dash: verduras, frutas, proteína magra, lácteos bajos en grasa y granos
  integrales; baja en sodio. Rechaza si hay caldo en polvo, consomé, salsa de
  soya, embutidos, tocino, enlatados, aceitunas, encurtidos, catsup, aderezo
  embotellado o botana salada. Si lleva sal, anótalo en avisos.
- baja_carbohidratos: sin azúcar ni harina; predominan proteína, verduras y
  grasas saludables; como máximo una porción de almidón o legumbre.
- keto: muy baja en carbohidratos. Rechaza azúcar, harina, arroz, pasta, papa,
  pan, maíz, legumbres y fruta dulce (plátano, mango, uva, higo, dátil, pasas).
  Debe tener grasa: aceite de oliva, aguacate, queso, crema, mantequilla,
  mayonesa, frutos secos o semillas.

Justifica cada dieta en "tipos_motivos" con una frase corta basada en los
ingredientes. Si dudas de un ingrediente (avena, salsa de soya, caldo en polvo,
gelatina, queso industrial), no pongas la dieta y anótalo en "avisos"."#;

/// Texto que se inyecta al prompt con los criterios de categoría.
pub const REGLAS_CATEGORIAS: &str = r#"Criterios de categoría (una sola):
- bebidas: se sirve para beber (agua, licuado, smoothie, café, té, atole,
  chocolate caliente, coctel, jugo).
- desayunos: huevos, hotcakes, molletes, avena, chilaquiles, pan dulce, o el
  título dice desayuno.
- ensaladas: verduras mezcladas, frías, con o sin proteína; ensalada de frutas.
- sopas: caldo, crema, consomé, sopa, pozole, menudo.
- guisados: platillo cocinado en salsa (mole, adobo, pipián, entomatado, tinga,
  a la mexicana, salsa verde o roja).
- platos-fuertes: proteína principal asada, a la plancha o al horno con
  guarnición, sin salsa dominante.
- pastas: pasta como protagonista (espagueti, lasaña, fideos, macarrones).
- complementos: guarnición, salsa, dip, arroz o frijoles de acompañamiento.
- antojitos: tacos, tostadas, quesadillas, tortas, sándwiches, tamales,
  gorditas, sopes, elotes.
- postres: dulces, pasteles, flanes, gelatinas, helados, fruta preparada.
Si el título es claro, esa categoría manda. Si no, decide por la técnica y el
formato. Justifica en "categoria_motivo"."#;

const CARNES: &[&str] = &[
    "carne",
    "cerdo",
    "puerco",
    "pollo",
    "pavo",
    "cordero",
    "ternera",
    "conejo",
    "pato",
    "jamon",
    "tocino",
    "panceta",
    "bacon",
    "beicon",
    "chorizo",
    "salchicha",
    "longaniza",
    "salami",
    "pepperoni",
    "mortadela",
    "bistec",
    "costilla",
    "chuleta",
    "higado",
    "moronga",
    "embutido",
    "hamburguesa",
    "prosciutto",
    "chicharron",
    "manteca",
];

const PESCADOS: &[&str] = &[
    "pescado",
    "atun",
    "salmon",
    "bacalao",
    "tilapia",
    "robalo",
    "huachinango",
    "merluza",
    "sardina",
    "anchoa",
    "trucha",
    "bonito",
    "pulpo",
    "calamar",
    "camaron",
    "langostino",
    "langosta",
    "cangrejo",
    "jaiba",
    "mejillon",
    "almeja",
    "ostion",
    "vieira",
    "marisco",
    "surimi",
];

const CERDO: &[&str] = &[
    "cerdo",
    "puerco",
    "jamon",
    "tocino",
    "panceta",
    "bacon",
    "beicon",
    "chorizo",
    "salchicha",
    "longaniza",
    "mortadela",
    "salami",
    "pepperoni",
    "manteca",
    "chicharron",
];

const MARISCOS: &[&str] = &[
    "camaron",
    "langostino",
    "langosta",
    "cangrejo",
    "jaiba",
    "mejillon",
    "almeja",
    "ostion",
    "vieira",
    "pulpo",
    "calamar",
    "marisco",
];

const LACTEOS: &[&str] = &[
    "leche",
    "crema",
    "mantequilla",
    "queso",
    "yogur",
    "requeson",
    "nata",
    "manchego",
    "oaxaca",
    "parmesano",
    "mozzarella",
    "provolone",
];

const GLUTEN: &[&str] = &[
    "trigo",
    "harina",
    "pan",
    "bolillo",
    "baguette",
    "pasta",
    "espagueti",
    "fideo",
    "macarron",
    "tallarin",
    "lasana",
    "cuscus",
    "cebada",
    "centeno",
    "pan molido",
    "pan rallado",
    "panko",
    "empanizador",
    "empanizado",
    "salsa de soya",
    "cerveza",
    "malta",
    "galleta",
    "hojaldre",
    "bizcocho",
    "tortilla de harina",
    "ramen",
    "seitan",
];

const AZUCARES: &[&str] = &[
    "azucar",
    "piloncillo",
    "miel",
    "jarabe",
    "sirope",
    "melaza",
    "mermelada",
    "cajeta",
    "glucosa",
    "dextrosa",
    "fructosa",
    "azucar glass",
    "refresco",
    "jugo industrial",
    "leche condensada",
    "leche evaporada",
];

const ALMIDONES: &[&str] = &[
    "arroz",
    "pasta",
    "espagueti",
    "fideo",
    "macarron",
    "papa",
    "patata",
    "pan",
    "harina",
    "tortilla",
    "maiz",
    "elote",
    "avena",
    "trigo",
    "galleta",
    "pastel",
    "bizcocho",
    "hojaldre",
];

const LEGUMBRES: &[&str] = &["frijol", "lenteja", "garbanzo", "alubia", "haba"];

const FRUTA_DULCE: &[&str] = &["platano", "mango", "uva", "pina", "higo", "datil", "pasa"];

const GRASAS: &[&str] = &[
    "aceite",
    "aguacate",
    "nuez",
    "almendra",
    "cacahuate",
    "pistache",
    "semilla",
    "chia",
    "linaza",
    "mayonesa",
    "crema",
    "queso",
    "mantequilla",
    "aceituna",
];

const SODIO_ALTO: &[&str] = &[
    "caldo en polvo",
    "consome",
    "cubito",
    "salsa de soya",
    "embutido",
    "jamon",
    "tocino",
    "chorizo",
    "salchicha",
    "aceituna",
    "encurtido",
    "catsup",
    "ketchup",
    "salsa inglesa",
    "aderezo",
    "botana",
    "parmesano",
    "sardina en lata",
    "atun en lata",
];

const MEDITERRANEOS: &[&str] = &[
    "aceite de oliva",
    "atun",
    "salmon",
    "sardina",
    "pescado",
    "frijol",
    "lenteja",
    "garbanzo",
    "jitomate",
    "calabacita",
    "berenjena",
    "pimiento",
    "espinaca",
    "acelga",
    "brocoli",
    "coliflor",
    "nuez",
    "almendra",
    "arroz integral",
    "trigo integral",
    "avena",
];

const GRASAS_ANIMALES: &[&str] = &["mantequilla", "manteca", "grasa de cerdo"];

fn normalizar(texto: &str) -> String {
    texto
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'ã' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            _ => c,
        })
        .collect()
}

fn nombres(ingredientes: &[IngredienteExtraido]) -> Vec<String> {
    ingredientes
        .iter()
        .map(|ingrediente| normalizar(&ingrediente.nombre))
        .collect()
}

fn coincide(nombres: &[String], terminos: &[&str]) -> bool {
    nombres
        .iter()
        .any(|nombre| terminos.iter().any(|termino| nombre.contains(termino)))
}

fn es_cerdo(nombre: &str) -> bool {
    if nombre.contains("jamon") && (nombre.contains("pavo") || nombre.contains("pollo")) {
        return false;
    }

    CERDO.iter().any(|termino| nombre.contains(termino))
}

fn es_lacteo(nombre: &str) -> bool {
    if nombre.contains("leche de coco")
        || nombre.contains("leche de almendra")
        || nombre.contains("leche de soya")
        || nombre.contains("leche de avena")
        || nombre.contains("leche de arroz")
        || nombre.contains("crema de coco")
        || nombre.contains("crema de cacahuate")
        || nombre.contains("crema de almendra")
        || nombre.contains("crema de avellana")
        || nombre.contains("mantequilla de mani")
        || nombre.contains("mantequilla de cacahuate")
    {
        return false;
    }

    LACTEOS.iter().any(|termino| nombre.contains(termino))
}

fn tiene_gluten(nombre: &str) -> bool {
    if nombre.contains("harina de maiz")
        || nombre.contains("harina de arroz")
        || nombre.contains("harina de almendra")
        || nombre.contains("harina de coco")
        || nombre.contains("pasta de tomate")
        || nombre.contains("pasta de jitomate")
        || nombre.contains("pasta de almendra")
        || nombre.contains("pasta de cacahuate")
        || nombre.contains("pasta de avellana")
        || nombre.contains("panela")
        || nombre.contains("panocha")
        || nombre.contains("salsa de soya tamari")
        || nombre.contains("tamari")
    {
        return false;
    }

    GLUTEN.iter().any(|termino| nombre.contains(termino))
}

fn es_fruta_dulce(nombre: &str) -> bool {
    if nombre.contains("espinaca") || nombre.contains("habanero") {
        return false;
    }

    FRUTA_DULCE.iter().any(|termino| nombre.contains(termino))
}

fn es_grasa(nombre: &str) -> bool {
    if nombre.contains("nuez moscada") {
        return false;
    }

    GRASAS.iter().any(|termino| nombre.contains(termino))
}

/// Una grasa "de verdad" para keto: frutos secos, queso, crema, mantequilla,
/// mayonesa o una cantidad apreciable de aceite (30 ml o más).
fn grasa_fuerte(ingredientes: &[IngredienteExtraido]) -> bool {
    const SOLIDAS: &[&str] = &[
        "aguacate",
        "queso",
        "crema",
        "mantequilla",
        "mayonesa",
        "nuez",
        "almendra",
        "cacahuate",
        "pistache",
        "semilla",
        "chia",
        "linaza",
    ];

    for ingrediente in ingredientes {
        let nombre = normalizar(&ingrediente.nombre);

        if SOLIDAS.iter().any(|termino| nombre.contains(termino)) {
            return true;
        }

        if nombre.contains("aceite") {
            if let Some(cantidad) = ingrediente.cantidad {
                let mililitros = if ingrediente.unidad == "L" {
                    cantidad * 1000.0
                } else {
                    cantidad
                };

                if mililitros >= 30.0 {
                    return true;
                }
            }
        }
    }

    false
}

fn tiene_azucar(nombre: &str) -> bool {
    if nombre.contains("sin azucar") || nombre.contains("endulzante") {
        return false;
    }

    AZUCARES.iter().any(|termino| nombre.contains(termino))
}

fn es_dulce(titulo: &str) -> bool {
    let titulo = normalizar(titulo);

    [
        "postre",
        "pastel",
        "tarta",
        "flan",
        "gelatina",
        "helado",
        "galleta",
        "brownie",
        "mousse",
        "tiramisu",
        "churro",
        "polvoron",
        "rosca",
        "trufa",
        "dulce",
        "mermelada",
        "cajeta",
    ]
    .iter()
    .any(|termino| titulo.contains(termino))
}

fn contar(nombres: &[String], terminos: &[&str]) -> usize {
    nombres
        .iter()
        .filter(|nombre| terminos.iter().any(|termino| nombre.contains(termino)))
        .count()
}

/// Ajusta las dietas propuestas por el modelo y devuelve avisos adicionales.
pub fn ajustar(
    propuestos: Vec<String>,
    titulo: &str,
    ingredientes: &[IngredienteExtraido],
) -> (Vec<String>, Vec<String>) {
    let nombres = nombres(ingredientes);

    let carne = coincide(&nombres, CARNES);
    let pescado = coincide(&nombres, PESCADOS);
    let lacteo = nombres.iter().any(|nombre| es_lacteo(nombre));
    let cerdo = nombres.iter().any(|nombre| es_cerdo(nombre));
    let marisco = coincide(&nombres, MARISCOS);
    let gluten = nombres.iter().any(|nombre| tiene_gluten(nombre));
    let avena = coincide(&nombres, &["avena"]);
    let azucar = nombres.iter().any(|nombre| tiene_azucar(nombre));
    let almidones = contar(&nombres, ALMIDONES);
    let legumbres = nombres
        .iter()
        .filter(|nombre| {
            !nombre.contains("habanero") && LEGUMBRES.iter().any(|termino| nombre.contains(termino))
        })
        .count();
    let fruta_dulce = nombres.iter().any(|nombre| es_fruta_dulce(nombre));
    let grasa = nombres.iter().any(|nombre| es_grasa(nombre));
    let grasa_fuerte = grasa_fuerte(ingredientes);
    let sodio_alto = coincide(&nombres, SODIO_ALTO);
    let mediterraneos = contar(&nombres, MEDITERRANEOS);
    let grasa_animal = coincide(&nombres, GRASAS_ANIMALES);
    let dulce = es_dulce(titulo);
    let carbohidratos = almidones + legumbres;

    let vegetarian_ok = !carne && !pescado;
    let sin_gluten_ok = !gluten;
    let kosher_ok = !cerdo && !marisco && !(carne && lacteo);
    let keto_ok = !azucar && carbohidratos == 0 && !fruta_dulce && grasa && grasa_fuerte;
    let baja_ok = !azucar && carbohidratos <= 1;
    let diabetico_ok = !azucar && !dulce && carbohidratos <= 1;
    let dash_ok = !sodio_alto;
    let mediterranea_ok = !grasa_animal && mediterraneos >= 2;

    let valida = |tipo: &str| -> bool {
        match tipo {
            "general" => true,
            "vegetariano" => vegetarian_ok,
            "sin_gluten" => sin_gluten_ok,
            "kosher" => kosher_ok,
            "keto" => keto_ok,
            "baja_carbohidratos" => baja_ok,
            "diabetico" => diabetico_ok,
            "dash" => dash_ok,
            "mediterranea" => mediterranea_ok,
            _ => false,
        }
    };

    let mut elegidos = BTreeSet::new();
    elegidos.insert("general");

    // Dietas que el modelo propuso y que las reglas confirman.
    for tipo in &propuestos {
        let tipo = tipo.trim().to_lowercase();

        if TIPOS.contains(&tipo.as_str()) && valida(&tipo) {
            elegidos.insert(
                TIPOS
                    .iter()
                    .find(|conocido| **conocido == tipo.as_str())
                    .copied()
                    .unwrap_or("general"),
            );
        }
    }

    // Dietas objetivas que se pueden deducir de los ingredientes aunque el
    // modelo no las haya propuesto.
    if vegetarian_ok {
        elegidos.insert("vegetariano");
    }

    if sin_gluten_ok {
        elegidos.insert("sin_gluten");
    }

    if keto_ok {
        elegidos.insert("keto");
    }

    if baja_ok {
        elegidos.insert("baja_carbohidratos");
    }

    if mediterranea_ok && coincide(&nombres, &["aceite de oliva"]) {
        elegidos.insert("mediterranea");
    }

    let finales: Vec<String> = TIPOS
        .iter()
        .filter(|tipo| elegidos.contains(**tipo))
        .map(|tipo| (*tipo).to_string())
        .collect();

    let mut avisos = Vec::new();

    if finales.iter().any(|tipo| tipo == "kosher") {
        avisos.push(
            "Kosher orientativo: no es una certificación rabínica; revisa ingredientes y utensilios."
                .to_string(),
        );
    }

    if finales.iter().any(|tipo| tipo == "diabetico") {
        avisos.push(
            "Apto para diabéticos orientativo: revisa porciones y carbohidratos con tu nutriólogo."
                .to_string(),
        );
    }

    if finales.iter().any(|tipo| tipo == "dash") {
        avisos.push(
            "DASH orientativo: revisa el sodio de la sal y de los productos envasados.".to_string(),
        );
    }

    if finales.iter().any(|tipo| tipo == "sin_gluten") && avena {
        avisos.push(
            "Revisar la avena: solo es sin gluten si el envase lo indica y no hay contaminación cruzada."
                .to_string(),
        );
    }

    (finales, avisos)
}

/// Corrige o completa la categoría con reglas del título y de los ingredientes.
pub fn categoria(titulo: &str, ingredientes: &[IngredienteExtraido], propuesta: &str) -> String {
    let titulo = normalizar(titulo);

    let por_titulo: &[(&str, &[&str])] = &[
        (
            "bebidas",
            &[
                "agua de",
                "licuado",
                "smoothie",
                "batido",
                "cafe",
                "te ",
                "atole",
                "chocolate caliente",
                "coctel",
                "jugo",
                "limonada",
                "naranjada",
                "horchata",
            ],
        ),
        (
            "postres",
            &[
                "postre",
                "pastel",
                "tarta",
                "flan",
                "gelatina",
                "helado",
                "galleta",
                "brownie",
                "mousse",
                "tiramisu",
                "churro",
                "polvoron",
                "rosca",
                "trufa",
                "arroz con leche",
            ],
        ),
        ("ensaladas", &["ensalada", "salpicon"]),
        (
            "sopas",
            &["sopa", "caldo", "consome", "pozole", "menudo", "crema de"],
        ),
        (
            "pastas",
            &[
                "pasta",
                "espagueti",
                "lasana",
                "fideo",
                "macarron",
                "tallarin",
                "raviol",
            ],
        ),
        (
            "antojitos",
            &[
                "taco",
                "tostada",
                "quesadilla",
                "torta",
                "sandwich",
                "tamal",
                "gordita",
                "sope",
                "burrito",
                "nachos",
            ],
        ),
        (
            "desayunos",
            &[
                "desayuno",
                "huevo",
                "hotcake",
                "panque",
                "avena",
                "chilaquiles",
                "mollete",
            ],
        ),
        (
            "complementos",
            &["salsa", "guarnicion", "dip", "aderezo", "pure"],
        ),
        (
            "guisados",
            &[
                "guisado",
                "mole",
                "adobo",
                "pipian",
                "entomatado",
                "tinga",
                "a la mexicana",
                "salsa verde",
                "salsa roja",
                "estofado",
            ],
        ),
        (
            "platos-fuertes",
            &[
                "bistec",
                "filete",
                "pollo asado",
                "pollo relleno",
                "lomo",
                "costilla",
                "pescado",
                "salmon",
                "atun",
                "cordero",
                "pierna",
                "chuleta",
                "asado",
                "a la plancha",
                "al horno",
                "gratinado",
            ],
        ),
    ];

    for (categoria, terminos) in por_titulo {
        if terminos.iter().any(|termino| titulo.contains(termino)) {
            return (*categoria).to_string();
        }
    }

    if CATEGORIAS.contains(&propuesta) {
        return propuesta.to_string();
    }

    let nombres = nombres(ingredientes);
    let liquido = coincide(&nombres, &["agua", "leche", "jugo", "cafe", "te "]);

    if liquido && !coincide(&nombres, &["carne", "pollo", "arroz", "pasta", "papa"]) {
        return "bebidas".to_string();
    }

    if coincide(&nombres, &["pasta", "espagueti", "fideo", "macarron"]) {
        return "pastas".to_string();
    }

    if coincide(&nombres, &["caldo", "consome"]) {
        return "sopas".to_string();
    }

    if coincide(&nombres, &["tortilla", "masa"]) {
        return "antojitos".to_string();
    }

    "guisados".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ingrediente(nombre: &str, cantidad: Option<f64>, unidad: &str) -> IngredienteExtraido {
        IngredienteExtraido {
            nombre: nombre.to_string(),
            cantidad,
            unidad: unidad.to_string(),
            producto: None,
            nota: None,
        }
    }

    fn tipos(nombres: &[(&str, Option<f64>, &str)]) -> Vec<String> {
        ajustar(
            vec!["general".to_string()],
            "Receta",
            &nombres
                .iter()
                .map(|(nombre, cantidad, unidad)| ingrediente(nombre, *cantidad, unidad))
                .collect::<Vec<_>>(),
        )
        .0
    }

    #[test]
    fn carne_y_queso_no_es_kosher_ni_vegetariano() {
        let resultado = tipos(&[
            ("Bistec de res", Some(500.0), "g"),
            ("Queso fresco", Some(200.0), "g"),
        ]);

        assert!(!resultado.contains(&"kosher".to_string()));
        assert!(!resultado.contains(&"vegetariano".to_string()));
    }

    #[test]
    fn camaron_no_es_kosher_ni_vegetariano() {
        let resultado = tipos(&[("Camarón", Some(500.0), "g")]);

        assert!(!resultado.contains(&"kosher".to_string()));
        assert!(!resultado.contains(&"vegetariano".to_string()));
    }

    #[test]
    fn trigo_quita_sin_gluten_y_keto() {
        let resultado = tipos(&[
            ("Harina de trigo", Some(200.0), "g"),
            ("Huevo", Some(2.0), "pza"),
        ]);

        assert!(!resultado.contains(&"sin_gluten".to_string()));
        assert!(!resultado.contains(&"keto".to_string()));
    }

    #[test]
    fn azucar_quita_keto_y_baja_carbohidratos() {
        let resultado = tipos(&[("Azúcar", Some(100.0), "g"), ("Leche", Some(500.0), "ml")]);

        assert!(!resultado.contains(&"keto".to_string()));
        assert!(!resultado.contains(&"baja_carbohidratos".to_string()));
    }

    #[test]
    fn verduras_con_aceite_de_oliva_es_vegetariano_y_sin_gluten() {
        let resultado = tipos(&[
            ("Calabacita", Some(500.0), "g"),
            ("Jitomate", Some(300.0), "g"),
            ("Aceite de oliva", Some(20.0), "ml"),
        ]);

        assert!(resultado.contains(&"general".to_string()));
        assert!(resultado.contains(&"vegetariano".to_string()));
        assert!(resultado.contains(&"sin_gluten".to_string()));
    }

    #[test]
    fn categoria_por_titulo() {
        assert_eq!(categoria("Ensalada César", &[], "guisados"), "ensaladas");
        assert_eq!(categoria("Sopa de tortilla", &[], "guisados"), "sopas");
        assert_eq!(categoria("Agua de limón", &[], "guisados"), "bebidas");
        assert_eq!(categoria("Tarta de queso", &[], "guisados"), "postres");
    }

    #[test]
    fn no_confunde_palabras_parecidas() {
        let resultado = tipos(&[
            ("Fresa", Some(200.0), "g"),
            ("Espinaca", Some(100.0), "g"),
            ("Pasta de tomate", Some(50.0), "g"),
            ("Aceite de oliva", Some(20.0), "ml"),
        ]);

        assert!(resultado.contains(&"vegetariano".to_string()));
        assert!(resultado.contains(&"sin_gluten".to_string()));
    }

    #[test]
    fn pan_rallado_quita_sin_gluten() {
        let resultado = tipos(&[
            ("Vieiras", Some(12.0), "pza"),
            ("Pan rallado", Some(20.0), "g"),
        ]);

        assert!(!resultado.contains(&"sin_gluten".to_string()));
    }

    #[test]
    fn crema_de_cacahuate_no_rompe_kosher() {
        let (con_leche, _) = ajustar(
            vec!["kosher".to_string()],
            "Carne",
            &[
                ingrediente("Bistec de res", Some(500.0), "g"),
                ingrediente("Leche", Some(200.0), "ml"),
            ],
        );
        let (con_cacahuate, _) = ajustar(
            vec!["kosher".to_string()],
            "Carne",
            &[
                ingrediente("Bistec de res", Some(500.0), "g"),
                ingrediente("Crema de cacahuate", Some(30.0), "g"),
            ],
        );

        assert!(!con_leche.contains(&"kosher".to_string()));
        assert!(con_cacahuate.contains(&"kosher".to_string()));
    }
}
