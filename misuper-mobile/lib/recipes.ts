/** Recipe shapes shared by the list, detail, menu and shopping-list screens. */

import { getApiUrl } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatars";
import { readJson, writeJson } from "@/lib/db";

export interface RecetaCategoria {
  id: number;
  slug: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  orden?: number;
}

export interface RecetaTipo {
  id: number;
  slug: string;
  nombre: string;
  descripcion?: string;
  icono?: string;
  aviso?: string;
}

export interface RecetaVideo {
  youtube_id: string;
  titulo: string | null;
  embed_url: string;
  thumbnail_url: string;
}

export interface RecetaIngrediente {
  nombre: string;
  producto?: string | null;
  cantidad: number | null;
  unidad: string;
  principal?: boolean;
  basico?: boolean;
}

export interface RecetaCostoItem {
  nombre?: string;
  costo?: number | null;
  faltante?: boolean;
  motivo?: string | null;
}

export interface RecetaCosto {
  total: number;
  porcion: number;
  falta_comprar?: number;
  items_sin_precio?: number;
  precios_viejos?: number;
  completo: boolean;
  items?: RecetaCostoItem[];
}

export interface RecetaNutricion {
  total: number;
  porcion: number;
  porciones_base?: number;
  completo: boolean;
  sin_dato: number;
  items?: Record<string, unknown>[];
}

export interface RecetaResumen {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  imagen_url: string | null;
  fuente_nombre: string | null;
  fuente_url: string | null;
  referencia: boolean;
  categoria: RecetaCategoria | null;
  tipos: string[];
  porciones_base: number;
  tiempo_min: number;
  dificultad: string;
  coincidencia: number;
  tiene_count: number;
  total_ingredientes: number;
  faltan: string[];
  faltan_principales: number;
  ingredientes_resumen: string[];
  video: RecetaVideo | null;
  favorita: boolean;
}

export interface RecetaDetalle extends RecetaResumen {
  ingredientes: RecetaIngrediente[];
  pasos: string[];
  costo: RecetaCosto;
  nutricion: RecetaNutricion;
  tipos_detalle: RecetaTipo[];
  fuente_autor?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RecetasDespensa {
  modo: string;
  total_productos: number;
  compra_id: number | null;
  fecha: string | null;
  compra_ids: number[];
  compras: CompraResumen[];
}

export interface RecetasResponse {
  items: RecetaResumen[];
  total: number;
  despensa: RecetasDespensa;
  tipos: RecetaTipo[];
  categorias: RecetaCategoria[];
}

export interface CompraResumen {
  id: number;
  fecha: string;
  total: number;
  comercio: string | null;
  items_count: number;
  ticket_titulo?: string | null;
}

export interface RecetaFiltros {
  q: string;
  categoria: string;
  tipo: string;
  tiempo: number | null;
  favoritas: boolean;
  soloDespensa: boolean;
  compras: number[];
}

export const EMPTY_RECIPE_FILTERS: RecetaFiltros = {
  q: "",
  categoria: "",
  tipo: "",
  tiempo: null,
  favoritas: false,
  soloDespensa: false,
  compras: [],
};

const COMPRAS_KEY = "misuper.recipes.compras";

export function readSelectedPurchases(): number[] {
  const saved = readJson<unknown>(COMPRAS_KEY, []);

  if (!Array.isArray(saved)) return [];

  return saved
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function saveSelectedPurchases(ids: number[]): void {
  writeJson(
    COMPRAS_KEY,
    Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0))),
  );
}

export function recipeImage(recipe: {
  imagen_url: string | null;
  video?: RecetaVideo | null;
}): string | null {
  return resolveMediaUrl(
    recipe.imagen_url ?? recipe.video?.thumbnail_url ?? null,
    getApiUrl(),
  );
}

export function recipeInitial(recipe: { nombre: string }): string {
  return recipe.nombre.trim().charAt(0).toUpperCase() || "?";
}

export function recipeVideoWatchUrl(video: RecetaVideo): string {
  return `https://www.youtube.com/watch?v=${video.youtube_id}`;
}

export function recipeQuery(filters: RecetaFiltros, pageSize?: number): string {
  const params = new URLSearchParams();

  if (filters.q.trim() !== "") params.set("q", filters.q.trim());
  if (filters.categoria !== "") params.set("categoria", filters.categoria);
  if (filters.tipo !== "") params.set("tipo", filters.tipo);
  if (filters.tiempo !== null) params.set("tiempo", String(filters.tiempo));
  if (filters.favoritas) params.set("favoritas", "1");
  if (filters.soloDespensa) params.set("solo_despensa", "1");
  if (filters.compras.length > 0) {
    params.set("compras", filters.compras.join(","));
  }
  if (pageSize !== undefined) params.set("limit", String(pageSize));

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

export function difficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case "facil":
      return "recipes.difficulty.easy";
    case "media":
      return "recipes.difficulty.medium";
    case "dificil":
      return "recipes.difficulty.hard";
    default:
      return "recipes.difficulty.easy";
  }
}

/** "al_gusto" and the usual measurement units as the app shows them. */
export function ingredientUnit(unit: string): string {
  switch (unit) {
    case "al_gusto":
      return "recipes.toTaste";
    case "l":
    case "lt":
    case "lts":
    case "L":
      return "L";
    case "kg":
    case "kgs":
      return "kg";
    case "g":
    case "gr":
    case "grs":
      return "g";
    case "ml":
      return "ml";
    case "pza":
    case "pzas":
    case "pieza":
    case "piezas":
      return "pza";
    default:
      return unit;
  }
}
