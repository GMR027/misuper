/**
 * Spanish phrases to cart lines.
 *
 * "dos kilos de jitomate y un litro de leche" becomes two items with quantity
 * and unit. The parser is deterministic on purpose: the user confirms the
 * product and the price before anything enters the cart, so a wrong guess is
 * visible and fixable instead of silent.
 */

export interface ItemVoz {
  /** The item as it was dictated, for display. */
  texto: string;
  /** The product name to match against the catalog. */
  nombre: string;
  cantidad: number | null;
  /** One of kg, gr, L, ml, pza — or null when the product decides. */
  unidad: string | null;
  precio: number | null;
}

const NUMEROS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
};

const FRACCIONES: [string, number][] = [
  ["tres cuartos", 0.75],
  ["un cuarto", 0.25],
  ["medio", 0.5],
  ["media", 0.5],
  ["cuarto", 0.25],
  ["cuarta", 0.25],
];

const UNIDADES: Record<string, string> = {
  kilo: "kg",
  kilos: "kg",
  kilogramo: "kg",
  kilogramos: "kg",
  kg: "kg",
  kgs: "kg",
  gramo: "gr",
  gramos: "gr",
  gr: "gr",
  grs: "gr",
  g: "gr",
  litro: "L",
  litros: "L",
  lt: "L",
  lts: "L",
  l: "L",
  mililitro: "ml",
  mililitros: "ml",
  ml: "ml",
  pieza: "pza",
  piezas: "pza",
  pza: "pza",
  pzas: "pza",
  unidad: "pza",
  unidades: "pza",
  manojo: "pza",
  manojos: "pza",
  bolsa: "pza",
  bolsas: "pza",
  caja: "pza",
  cajas: "pza",
  lata: "pza",
  latas: "pza",
  botella: "pza",
  botellas: "pza",
  paquete: "pza",
  paquetes: "pza",
  sobre: "pza",
  sobres: "pza",
};

const DOCENAS = new Set(["docena", "docenas"]);

const RELLENO_INICIAL =
  /^(?:agrega|agregar|anade|anadir|añade|añadir|pon|poner|compra|comprar|apunta|apuntar|anota|anotar|necesito|quiero|me falta|falta|agrega me|agregame)\s+/;

const CONECTORES = /^(?:de|del|la|el|los|las|un|una|unos|unas|mi|mis)\s+/;

/** Decimal "1,5" or "1.5"; never NaN. */
function aNumero(valor: string): number | null {
  const numero = Number(valor.replace(",", "."));

  return Number.isFinite(numero) ? numero : null;
}

/** Lowercase, no accents, punctuation kept where it separates items. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,.;/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsearVoz(frase: string): ItemVoz[] {
  const texto = normalizar(frase);

  if (texto === "") {
    return [];
  }

  return dividir(texto)
    .map(parsearItem)
    .filter((item): item is ItemVoz => item !== null);
}

/**
 * Splits on commas, semicolons and the word "y". A trailing "y medio" or
 * "y cuarto" belongs to the previous item, so it is protected first.
 */
function dividir(texto: string): string[] {
  const protegido = ` ${texto} `
    .replace(/\s+y\s+(medio|media|cuarto|cuarta)\b/g, " y~$1")
    .replace(/\s+por favor\s*/g, " ")
    .replace(/\s+gracias\s*$/g, " ");

  return protegido
    .split(/\s*(?:,|;|\s+y\s+|\s+mas\s+)\s*/)
    .map((parte) => parte.replace(/y~/g, "y ").trim())
    .filter((parte) => parte !== "");
}

function parsearItem(original: string): ItemVoz | null {
  let resto = original;

  // "agrega", "quiero", "me falta"…
  while (RELLENO_INICIAL.test(resto)) {
    resto = resto.replace(RELLENO_INICIAL, "").trim();
  }

  const precio = leerPrecio(resto);
  resto = precio.resto;

  let cantidad: number | null = null;
  let unidad: string | null = null;

  if (cantidad === null) {
    const fraccion = leerFraccion(resto);
    cantidad = fraccion.cantidad;
    resto = fraccion.resto;
  }

  if (cantidad === null) {
    const numero = leerNumero(resto);
    cantidad = numero.cantidad;
    resto = numero.resto;
  }

  const medida = leerUnidad(resto);
  unidad = medida.unidad;
  resto = medida.resto;

  if (medida.docena && cantidad !== null) {
    cantidad *= 12;
  }

  // "dos kilos y medio" / "kilo y medio"
  const sufijo = resto.match(/^y\s+(medio|media|cuarto|cuarta)\b\s*(.*)$/);

  if (sufijo !== null && unidad !== null) {
    const extra = sufijo[1] === "cuarto" || sufijo[1] === "cuarta" ? 0.25 : 0.5;
    cantidad = (cantidad ?? 1) + extra;
    resto = sufijo[2];
  }

  // A unit implies one of it when no number was said ("kilo de tomate").
  if (unidad !== null && cantidad === null) {
    cantidad = 1;
  }

  let nombre = limpiarNombre(resto);

  if (nombre === "") {
    return null;
  }

  // "a 35 el kilo" is a unit price, not the line total.
  nombre = nombre
    .replace(/\s+(?:a|en|por)\s+\$?\s*\d+(?:[.,]\d+)?\s+(?:el|la)\s+[a-z]+\s*$/, "")
    .trim();

  if (nombre === "") {
    return null;
  }

  return {
    texto: original,
    nombre,
    cantidad,
    unidad,
    precio: precio.precio,
  };
}

function leerPrecio(resto: string): {
  precio: number | null;
  resto: string;
} {
  const patrones: RegExp[] = [
    /^(.*?)\s+(?:a|en|por)\s+\$?\s*(\d+(?:[.,]\d+)?)\s*(?:pesos|mxn)?\s*$/,
    /^(.*?)\s+\$\s*(\d+(?:[.,]\d+)?)\s*$/,
    /^(.*?)\s+(\d+(?:[.,]\d+)?)\s+pesos\s*$/,
  ];

  for (const patron of patrones) {
    const encontrado = resto.match(patron);

    if (encontrado === null) {
      continue;
    }

    const precio = aNumero(encontrado[2]);

    if (precio === null) {
      continue;
    }

    return { precio, resto: encontrado[1].trim() };
  }

  return { precio: null, resto };
}

function leerFraccion(resto: string): { cantidad: number | null; resto: string } {
  for (const [palabra, valor] of FRACCIONES) {
    if (!resto.startsWith(`${palabra} `)) {
      continue;
    }

    // "tres cuartos DE kilo": the connector belongs to the unit phrase.
    const restoFraccion = resto
      .slice(palabra.length + 1)
      .replace(/^de\s+/, "")
      .trim();

    return { cantidad: valor, resto: restoFraccion };
  }

  // "1/2 kilo"
  const fraccion = resto.match(/^(\d+)\s*\/\s*(\d+)\s+(.*)$/);

  if (fraccion !== null) {
    const denominador = Number(fraccion[2]);

    if (denominador > 0) {
      return {
        cantidad: Number(fraccion[1]) / denominador,
        resto: fraccion[3].replace(/^de\s+/, "").trim(),
      };
    }
  }

  return { cantidad: null, resto };
}

function leerNumero(resto: string): { cantidad: number | null; resto: string } {
  const digitos = resto.match(/^(\d+(?:[.,]\d+)?)\s+(.*)$/);

  if (digitos !== null) {
    const cantidad = aNumero(digitos[1]);

    if (cantidad !== null) {
      return { cantidad, resto: digitos[2].trim() };
    }
  }

  const palabra = resto.match(/^([a-z]+)\s+(.*)$/);

  if (palabra !== null && palabra[1] in NUMEROS) {
    return { cantidad: NUMEROS[palabra[1]], resto: palabra[2].trim() };
  }

  return { cantidad: null, resto };
}

function leerUnidad(resto: string): {
  unidad: string | null;
  docena: boolean;
  resto: string;
} {
  const primera = resto.match(/^([a-z]+)\.?\s+(.*)$/);

  if (primera === null) {
    return { unidad: null, docena: false, resto };
  }

  const palabra = primera[1];

  if (palabra in UNIDADES) {
    return {
      unidad: UNIDADES[palabra],
      docena: false,
      resto: primera[2].trim(),
    };
  }

  if (DOCENAS.has(palabra)) {
    return { unidad: "pza", docena: true, resto: primera[2].trim() };
  }

  return { unidad: null, docena: false, resto };
}

function limpiarNombre(resto: string): string {
  let nombre = resto.trim().replace(/^[.,;]+|[.,;]+$/g, "");

  // "de la sal" -> "sal"; a couple of passes cover "de la".
  for (let vuelta = 0; vuelta < 2; vuelta += 1) {
    nombre = nombre.replace(CONECTORES, "").trim();
  }

  return nombre.replace(/\s+/g, " ").trim();
}
