/** Money and date formatting in the language Ajustes picked. */

import { getLocale } from "@/lib/i18n";

export const CURRENCY = "MXN";

const LOCALES = { es: "es-MX", en: "en-US" } as const;

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(LOCALES[getLocale()], {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 2,
  }).format(value);
}

/** The month of `date` ("noviembre", "November"). */
export function monthName(date: Date = new Date()): string {
  return new Intl.DateTimeFormat(LOCALES[getLocale()], {
    month: "long",
  }).format(date);
}

/** Today in the phone's own timezone, as the API's `YYYY-MM-DD`. */
export function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** A short date and time ("8 nov, 18:30"), or "" when the value is invalid. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(LOCALES[getLocale()], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** A quantity with at most 3 decimals ("1.25", "2"). */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat(LOCALES[getLocale()], {
    maximumFractionDigits: 3,
  }).format(value);
}

/** The unit's short label ("kg", "pza"). */
export function unitLabel(unit: string): string {
  return unit === "L" ? "L" : unit;
}
