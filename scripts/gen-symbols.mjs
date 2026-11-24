#!/usr/bin/env node
/**
 * Descarga los Material Symbols que usa la app y regenera el mapa de Android.
 *
 * Los nombres salen de shared/iconos.json más los símbolos heredados que aún
 * pueden estar referenciados en pantallas. Los XML vienen del repositorio
 * oficial google/material-design-icons, en la misma revisión que el mapa
 * anterior.
 *
 *   node scripts/gen-symbols.mjs
 *   node scripts/gen-symbols.mjs --check
 *   node scripts/gen-symbols.mjs --force   # vuelve a descargar todos
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_FILE = resolve(ROOT, "shared/iconos.json");
const SYMBOLS_DIR = resolve(ROOT, "misuper-mobile/assets/symbols");
const GENERATED_FILE = resolve(
  ROOT,
  "misuper-mobile/components/m3/symbols.generated.ts",
);
const REVISION = "10ecc14";
const CHECK = process.argv.includes("--check");
const FORCE = process.argv.includes("--force");

const icons = JSON.parse(readFileSync(ICONS_FILE, "utf8"));

// Los que ya usa la app fuera del catálogo semántico. Se conservan para no
// romper pantallas que todavía no pasaron por el rediseño.
const LEGACY = [
  "add",
  "apps",
  "arrow-back",
  "calculate",
  "check",
  "chevron-right",
  "close",
  "contrast",
  "dark-mode",
  "delete",
  "grid-view",
  "home",
  "info",
  "language",
  "light-mode",
  "list",
  "menu",
  "mic",
  "receipt-long",
  "refresh",
  "savings",
  "search",
  "settings",
  "shopping-cart",
  "upload-file",
  "usb",
  "wifi",
];

const names = new Set(LEGACY);

for (const group of Object.values(icons)) {
  for (const icon of Object.values(group)) {
    names.add(icon.android);
  }
}

const sorted = [...names].sort();

function snake(name) {
  return name.replaceAll("-", "_");
}

function identifier(name) {
  const parts = name.split("-");
  return (
    parts[0] +
    parts
      .slice(1)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("") +
    "Symbol"
  );
}

async function download(name) {
  const file = resolve(SYMBOLS_DIR, `${name}.xml`);

  if (existsSync(file) && !FORCE) {
    const current = readFileSync(file, "utf8");
    if (current.trimStart().startsWith("<vector")) return false;
  }

  const symbol = snake(name);
  const url = `https://raw.githubusercontent.com/google/material-design-icons/${REVISION}/symbols/android/${symbol}/materialsymbolsoutlined/${symbol}_24px.xml`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${name} (${response.status}).`);
  }

  const body = await response.text();

  if (!body.trimStart().startsWith("<vector")) {
    throw new Error(`${name} no devolvió un vector drawable.`);
  }

  writeFileSync(file, body, "utf8");
  return true;
}

let downloaded = 0;

if (!CHECK) {
  for (const name of sorted) {
    if (await download(name)) downloaded += 1;
  }
}

const missing = sorted.filter(
  (name) => !existsSync(resolve(SYMBOLS_DIR, `${name}.xml`)),
);

if (missing.length > 0) {
  throw new Error(`Faltan símbolos: ${missing.join(", ")}`);
}

const imports = sorted
  .map(
    (name) =>
      `import ${identifier(name)} from "@/assets/symbols/${name}.xml";`,
  )
  .join("\n");

const entries = sorted
  .map((name) => `  "${name}": ${identifier(name)},`)
  .join("\n");

const header = `/* Generado por scripts/gen-symbols.mjs desde shared/iconos.json.
 * Material Symbols outlined, 24 dp, revisión ${REVISION}.
 * No editar a mano: añade el icono al catálogo y vuelve a ejecutar el script. */`;

const generated = `${header}

${imports}

export const SYMBOLS = {
${entries}
} as const;

export type SymbolName = keyof typeof SYMBOLS;
`;

const current = existsSync(GENERATED_FILE)
  ? readFileSync(GENERATED_FILE, "utf8")
  : "";
const next = generated.endsWith("\n") ? generated : `${generated}\n`;

if (CHECK) {
  if (current !== next) {
    throw new Error(
      "symbols.generated.ts está desactualizado. Ejecuta node scripts/gen-symbols.mjs.",
    );
  }
  console.log(`Símbolos: ${sorted.length} archivos presentes y mapa al día.`);
} else {
  if (current !== next) writeFileSync(GENERATED_FILE, next, "utf8");
  console.log(
    `Símbolos: ${sorted.length} en total, ${downloaded} descargado(s), mapa regenerado.`,
  );
}
