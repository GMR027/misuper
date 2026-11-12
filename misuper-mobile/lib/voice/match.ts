/**
 * Ranks catalog names against a spoken phrase.
 *
 * Pure and dependency-free so it can be exercised outside the app: the voice
 * sheet asks for the best candidates and shows a choice when two of them tie.
 */

import { normalizarBusqueda } from "../offline/normalize";

export interface Coincidencia<T> {
  producto: T;
  puntaje: number;
}

const PALABRAS_VACIAS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "con",
  "para",
  "en",
  "al",
  "mi",
  "mis",
]);

/** Singular/plural forms of a token: jitomates -> jitomate, limones -> limon. */
function variantes(palabra: string): string[] {
  const formas = new Set([palabra]);

  if (palabra.length > 4 && palabra.endsWith("ces")) {
    formas.add(`${palabra.slice(0, -3)}z`);
  }

  if (palabra.length > 3 && palabra.endsWith("es")) {
    formas.add(palabra.slice(0, -2));
  }

  if (palabra.length > 3 && palabra.endsWith("s")) {
    formas.add(palabra.slice(0, -1));
  }

  return [...formas];
}

function parecidos(a: string, b: string): boolean {
  const otras = variantes(b);

  return variantes(a).some((forma) => otras.includes(forma));
}

function tokensVoz(texto: string): string[] {
  return normalizarBusqueda(texto)
    .split(" ")
    .filter((token) => token.length > 1 && !PALABRAS_VACIAS.has(token));
}

export function ordenarCoincidencias<T extends { nombre: string }>(
  nombre: string,
  productos: T[],
  limite = 4,
): Coincidencia<T>[] {
  const consulta = tokensVoz(nombre);

  if (consulta.length === 0) {
    return [];
  }

  return productos
    .map((producto) => {
      const suyos = tokensVoz(producto.nombre);
      const compartidos = consulta.filter((token) =>
        suyos.some((suyo) => parecidos(token, suyo)),
      ).length;
      const cobertura = compartidos / consulta.length;
      const precision = compartidos / Math.max(1, suyos.length);

      return { producto, puntaje: cobertura * 0.7 + precision * 0.3 };
    })
    .filter((coincidencia) => coincidencia.puntaje >= 0.55)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite);
}
