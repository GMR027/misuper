/**
 * A minimal `t()` for English and Spanish: the one picked in Ajustes, else the
 * phone's. `t()` reads the language when it is called, so a screen re-renders
 * into a new one by calling `useLocale()`.
 */

import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { getSettings, useSettings, type AppLocale } from "@/lib/settings";

type Messages = typeof en;

const PHONE_LOCALE: AppLocale = Intl.DateTimeFormat()
  .resolvedOptions()
  .locale.startsWith("es")
  ? "es"
  : "en";

/** The language the app is showing now. */
export function getLocale(): AppLocale {
  return getSettings().language ?? PHONE_LOCALE;
}

/** `getLocale()`, re-rendering the caller when the language changes. */
export function useLocale(): AppLocale {
  return useSettings((s) => s.language) ?? PHONE_LOCALE;
}

/** `t("home.greeting", { name: "Edgar" })`; `{name}` placeholders are filled. */
export function t(
  key: string,
  values: Record<string, string | number> = {},
): string {
  const messages: Messages = getLocale() === "es" ? es : en;
  const lookup = (from: unknown) =>
    key
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        from,
      );
  const text = lookup(messages) ?? lookup(en);
  if (typeof text !== "string") return key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
