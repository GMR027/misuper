/** Shapes and small helpers for the weekly menu. */

import { getLocale } from "@/lib/i18n";

export const MOMENTOS = ["desayuno", "comida", "cena", "colacion", "otro"] as const;

export type Momento = (typeof MOMENTOS)[number];

export interface MenuSemana {
  semana: string;
  semana_fin: string;
  items: number;
  es_actual: boolean;
  es_pasada: boolean;
  es_futura: boolean;
}

export interface MenuItem {
  id: number;
  dia: number;
  momento: string;
  tipo: "receta" | "nota";
  etiqueta: string | null;
  receta_id: number | null;
  nombre: string;
  porciones: number;
  orden: number;
  nota: string | null;
  slug: string | null;
  imagen_url: string | null;
  tiempo_min: number | null;
  porciones_base: number | null;
  tipos: string[];
  disponible: boolean;
  kcal: number | null;
  nutricion: {
    total: number;
    porcion: number;
    sin_dato: number;
    completo: boolean;
  } | null;
  costo: {
    total: number;
    porcion: number;
    sin_precio: number;
    precios_viejos: number;
    completo: boolean;
  } | null;
}

export interface MenuDia {
  dia: number;
  nombre: string;
  fecha: string;
  es_hoy: boolean;
  items: MenuItem[];
  total: number;
  kcal_total: number;
  kcal_sin_dato: number;
  kcal_completo: boolean;
  sin_precio: number;
  completo: boolean;
}

export interface MenuResumen {
  items: number;
  recetas: number;
  total: number;
  kcal_total: number;
  kcal_sin_dato: number;
  kcal_completo: boolean;
  sin_precio: number;
  no_disponibles: number;
  precios_viejos: number;
  completo: boolean;
}

export interface MenuResponse {
  semana: string;
  semana_fin: string;
  menu: { id: number | null; nombre: string | null };
  dias: MenuDia[];
  resumen: MenuResumen;
  momentos: string[];
}

export interface MenuPreviewItem {
  clave: string;
  producto_id: number | null;
  nombre: string;
  cantidad: number;
  unidad_base: string;
  categoria_nombre: string | null;
  principal: boolean;
  basico: boolean;
  ya_comprado: boolean;
  origen: string;
  costo?: number | null;
  faltante?: boolean;
  motivo?: string | null;
}

export interface MenuPreview {
  semana: string;
  items: MenuPreviewItem[];
  recetas: { slug: string; nombre: string; porciones: number; porciones_base: number }[];
  total: number;
  costo: {
    total: number;
    items_con_precio: number;
    items_sin_precio: number;
    precios_viejos: number;
    completo: boolean;
  };
}

export function weekRangeLabel(start: string, end: string): string {
  const locale = getLocale() === "es" ? "es-MX" : "en-US";
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(from);
  const endDay = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(to);
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(to);
  return `${day}–${endDay} ${month}`;
}

export function shortDate(fecha: string): string {
  const locale = getLocale() === "es" ? "es-MX" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(new Date(`${fecha}T00:00:00`));
}

export function mondayOf(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function isoDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function currentMonday(): string {
  return isoDate(mondayOf(new Date()));
}

export function nextMonday(week: string): string {
  const date = new Date(`${week}T00:00:00`);
  date.setDate(date.getDate() + 7);
  return isoDate(date);
}
