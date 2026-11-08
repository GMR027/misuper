/**
 * The app's key/value store, on `expo-sqlite`'s key-value API: settings are
 * read synchronously on start, so the first frame already wears the saved
 * theme, and a change writes only the key it sets.
 */

import Storage from "expo-sqlite/kv-store";

export function readText(key: string): string | null {
  return Storage.getItemSync(key);
}

export function writeText(key: string, value: string | null): void {
  if (value === null) Storage.removeItemSync(key);
  else Storage.setItemSync(key, value);
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = Storage.getItemSync(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  Storage.setItemSync(key, JSON.stringify(value));
}
