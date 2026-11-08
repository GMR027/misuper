/**
 * The app's preferences: theme, language and the API's address. Read
 * synchronously on start (`getSettings`), so the first frame is already in the
 * saved theme; `useSettings(select)` re-renders on a change and
 * `setSettings(patch)` merges and saves only what it sets.
 */

import { useSyncExternalStore } from "react";
import { readText, writeText } from "@/lib/db";
import { PALETTE_IDS, type PaletteId } from "@/lib/palettes";

export type ThemeMode = "system" | "light" | "dark";
export type AppLocale = "en" | "es";
export type FocusColor = "auto" | string;

export interface AppSettings {
  /** Light / Dark override the phone's scheme; System follows it. */
  theme: ThemeMode;
  /** The web's 15 palettes. */
  palette: PaletteId;
  /** "auto" follows the palette's accent; otherwise a #rrggbb colour. */
  focusColor: FocusColor;
  /** 0..200, 100 = the palette's default strength. */
  focusIntensity: number;
  /** 50..250, 100 = the palette's default spread. */
  focusSpread: number;
  /** `null` follows the phone's language. */
  language: AppLocale | null;
  /** The PHP API's base URL, without a trailing slash. Empty: EXPO_PUBLIC_API_URL. */
  apiUrl: string;
}

const KEYS = {
  theme: "settings.theme",
  palette: "settings.palette",
  focusColor: "settings.focusColor",
  focusIntensity: "settings.focusIntensity",
  focusSpread: "settings.focusSpread",
  language: "settings.language",
  apiUrl: "settings.apiUrl",
} as const;

const THEMES: ThemeMode[] = ["system", "light", "dark"];
const LOCALES: AppLocale[] = ["en", "es"];
const HEX = /^#[0-9a-f]{6}$/i;

function isTheme(value: string | null): value is ThemeMode {
  return value !== null && (THEMES as string[]).includes(value);
}

function isPalette(value: string | null): value is PaletteId {
  return value !== null && (PALETTE_IDS as string[]).includes(value);
}

function isFocusColor(value: string | null): value is FocusColor {
  return value === "auto" || (value !== null && HEX.test(value));
}

function isLocale(value: string | null): value is AppLocale {
  return value !== null && (LOCALES as string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function load(): AppSettings {
  const theme = readText(KEYS.theme);
  const palette = readText(KEYS.palette);
  const focusColor = readText(KEYS.focusColor);
  const language = readText(KEYS.language);

  const intensity = Number.parseInt(
    readText(KEYS.focusIntensity) ?? "100",
    10,
  );
  const spread = Number.parseInt(readText(KEYS.focusSpread) ?? "100", 10);

  return {
    theme: isTheme(theme) ? theme : "system",
    palette: isPalette(palette) ? palette : "esmeralda",
    focusColor: isFocusColor(focusColor) ? focusColor : "auto",
    focusIntensity: Number.isFinite(intensity)
      ? clamp(intensity, 0, 200)
      : 100,
    focusSpread: Number.isFinite(spread) ? clamp(spread, 50, 250) : 100,
    language: isLocale(language) ? language : null,
    apiUrl: readText(KEYS.apiUrl) ?? "",
  };
}

let current = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSettings(): AppSettings {
  return current;
}

/** Merges `patch` and saves only its keys. */
export function setSettings(patch: Partial<AppSettings>): void {
  const next = { ...current, ...patch };
  if (Object.is(next, current)) return;
  current = next;
  if (patch.theme !== undefined) writeText(KEYS.theme, patch.theme);
  if (patch.palette !== undefined) writeText(KEYS.palette, patch.palette);
  if (patch.focusColor !== undefined)
    writeText(KEYS.focusColor, patch.focusColor);
  if (patch.focusIntensity !== undefined)
    writeText(KEYS.focusIntensity, String(patch.focusIntensity));
  if (patch.focusSpread !== undefined)
    writeText(KEYS.focusSpread, String(patch.focusSpread));
  if (patch.language !== undefined)
    writeText(KEYS.language, patch.language ?? null);
  if (patch.apiUrl !== undefined)
    writeText(KEYS.apiUrl, patch.apiUrl.trim() || null);
  emit();
}

export function useSettings<T>(select: (value: AppSettings) => T): T {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => select(current),
  );
}
