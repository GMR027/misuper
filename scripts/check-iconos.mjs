#!/usr/bin/env node
/**
 * Comprueba que el catálogo semántico no repita iconos de navegación y que
 * Android tenga un símbolo descargado para cada clave.
 *
 *   node scripts/check-iconos.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(resolve(ROOT, "shared/iconos.json"), "utf8"),
);
const symbolsFile = resolve(
  ROOT,
  "misuper-mobile/components/m3/symbols.generated.ts",
);
const symbols = existsSync(symbolsFile)
  ? readFileSync(symbolsFile, "utf8")
  : "";
const problems = [];

for (const group of ["navegacion", "grupos"]) {
  for (const platform of ["web", "android"]) {
    const seen = new Map();

    for (const [key, icon] of Object.entries(data[group] ?? {})) {
      const value = icon[platform];

      if (seen.has(value)) {
        problems.push(
          `${group}.${key} repite "${value}" con ${group}.${seen.get(value)} (${platform}).`,
        );
      }
      seen.set(value, key);
    }
  }
}

for (const group of Object.values(data)) {
  for (const [key, icon] of Object.entries(group)) {
    if (!/^bi-[a-z0-9-]+$/.test(icon.web)) {
      problems.push(`${key}: "${icon.web}" no es una clase de Bootstrap Icons.`);
    }
    if (!symbols.includes(`"${icon.android}":`)) {
      problems.push(
        `${key}: falta el símbolo Android "${icon.android}" en symbols.generated.ts.`,
      );
    }
  }
}

// La app Android debe usar el catálogo, no cadenas sueltas que vuelvan a
// repetir iconos con el tiempo.
const mobileRoot = resolve(ROOT, "misuper-mobile");

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "android" || entry === "ios") {
      continue;
    }

    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      const text = readFileSync(path, "utf8");
      if (
        /icon="[a-z-]+"/.test(text) ||
        /leadingIcon="[a-z-]+"/.test(text) ||
        /SymbolIcon name="[a-z-]+"/.test(text)
      ) {
        problems.push(
          `${path.replace(`${ROOT}/`, "")}: usa un icono literal; pásalo por ICONOS.`,
        );
      }
    }
  }
}

if (existsSync(mobileRoot)) {
  walk(mobileRoot);
}

if (problems.length > 0) {
  console.error("✖ Catálogo de iconos con problemas:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ Iconos: ${Object.keys(data.navegacion).length} destinos, ` +
      `${Object.keys(data.acciones).length} acciones, sin repetidos en navegación.`,
  );
}
