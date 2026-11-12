/**
 * Client-side twin of `NormalizadorService::paraBusqueda()`.
 *
 * The server stores `nombre_normalizado` already lowercased, without accents
 * or punctuation; the query has to go through the same transformation for the
 * offline `LIKE` to behave like the online one.
 *
 * `ñ` decomposes to `n` + a combining tilde, so NFD removal turns it into `n`
 * just like the server does.
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
