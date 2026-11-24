#!/usr/bin/env node
/**
 * Genera los mapas de iconos de web y Android desde shared/iconos.json.
 *
 * Un solo catálogo evita que la navegación vuelva a repetir iconos o que una
 * acción use el símbolo de otra. Se ejecuta a mano después de editar el JSON:
 *
 *   node scripts/gen-iconos.mjs
 *   node scripts/gen-iconos.mjs --check
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_FILE = resolve(ROOT, "shared/iconos.json");
const PHP_FILE = resolve(ROOT, "src/Support/Iconos.php");
const JS_FILE = resolve(ROOT, "public/assets/js/modules/iconos.generated.js");
const TS_FILE = resolve(ROOT, "misuper-mobile/lib/iconos.generated.ts");
const CHECK = process.argv.includes("--check");

const data = JSON.parse(readFileSync(JSON_FILE, "utf8"));
const groups = ["navegacion", "grupos", "acciones"];

function fail(message) {
  throw new Error(message);
}

function checkGroup(group) {
  if (!data[group] || typeof data[group] !== "object") {
    fail(`Falta el grupo "${group}" en shared/iconos.json.`);
  }

  for (const [key, value] of Object.entries(data[group])) {
    if (!/^[a-z0-9-]+$/.test(key)) {
      fail(`La clave "${group}.${key}" debe usar minúsculas y guiones.`);
    }
    for (const field of ["web", "android", "label"]) {
      if (typeof value[field] !== "string" || value[field].trim() === "") {
        fail(`Falta "${field}" en ${group}.${key}.`);
      }
    }
    if (!/^bi-[a-z0-9-]+$/.test(value.web)) {
      fail(`${group}.${key}.web no es una clase de Bootstrap Icons.`);
    }
    if (!/^[a-z0-9-]+$/.test(value.android)) {
      fail(`${group}.${key}.android debe usar minúsculas y guiones.`);
    }
  }

  // La navegación no puede repetir iconos: es la regla que evita que dos
  // secciones distintas se vean igual en el menú o en el dock.
  if (group === "navegacion" || group === "grupos") {
    for (const platform of ["web", "android"]) {
      const seen = new Map();

      for (const [key, value] of Object.entries(data[group])) {
        const icon = value[platform];
        if (seen.has(icon)) {
          fail(
            `Icono repetido en ${group} (${platform}): "${seen.get(icon)}" y "${key}" usan "${icon}".`,
          );
        }
        seen.set(icon, key);
      }
    }
  }
}

for (const group of groups) checkGroup(group);

function phpString(value) {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

function phpValue(value, indent = 0) {
  const pad = " ".repeat(indent);
  const next = " ".repeat(indent + 4);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value
      .map((item) => `${next}${phpValue(item, indent + 4)},`)
      .join("\n")}\n${pad}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "[]";
    return `[\n${entries
      .map(
        ([key, item]) =>
          `${next}${phpString(key)} => ${phpValue(item, indent + 4)},`,
      )
      .join("\n")}\n${pad}]`;
  }

  if (typeof value === "string") return phpString(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "null";
}

const header = `/* Archivo generado por scripts/gen-iconos.mjs desde shared/iconos.json.
 * No editar a mano: cambia el catálogo y vuelve a ejecutar el generador. */`;

const php = `<?php

declare(strict_types=1);

namespace App\\Support;

${header}

final class Iconos
{
    private const MAPA = ${phpValue(data)};

    /** La clase de Bootstrap Icons de una clave semántica. */
    public static function clase(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['web'] ?? '';
    }

    /** El nombre Material Symbols de una clave semántica. */
    public static function android(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['android'] ?? '';
    }

    /** La etiqueta humana de una clave semántica. */
    public static function etiqueta(string $grupo, string $clave): string
    {
        return self::MAPA[$grupo][$clave]['label'] ?? $clave;
    }

    /** Pinta el icono web; por defecto es decorativo y se oculta al lector. */
    public static function render(
        string $grupo,
        string $clave,
        string $extra = '',
        bool $decorativo = true,
    ): string {
        $clase = self::clase($grupo, $clave);

        if ($clase === '') {
            return '';
        }

        $clases = trim('bi ' . $clase . ' ' . $extra);
        $aria = $decorativo ? ' aria-hidden="true"' : '';

        return '<i class="' . htmlspecialchars($clases, ENT_QUOTES, 'UTF-8') . '"' . $aria . '></i>';
    }
}
`;

const js = `${header}

export const ICONOS = ${JSON.stringify(data, null, 2)};

/** Devuelve el HTML de un icono web por su clave semántica. */
export function icono(grupo, clave, extra = '') {
  const clase = ICONOS[grupo]?.[clave]?.web;

  if (!clase) {
    return '';
  }

  return \`<i class="bi \${clase}\${extra ? \` \${extra}\` : ''}" aria-hidden="true"></i>\`;
}

/** La etiqueta humana de una clave semántica. */
export function etiqueta(grupo, clave) {
  return ICONOS[grupo]?.[clave]?.label ?? clave;
}
`;

const ts = `${header}

import type { SymbolName } from "@/components/m3/symbols.generated";

export const ICONOS = ${JSON.stringify(data, null, 2)} as const satisfies Record<
  string,
  Record<string, { web: string; android: SymbolName; label: string }>
>;

export type IconoGrupo = keyof typeof ICONOS;
export type IconoNavegacion = keyof typeof ICONOS.navegacion;
export type IconoAccion = keyof typeof ICONOS.acciones;
`;

const outputs = [
  [PHP_FILE, php],
  [JS_FILE, js],
  [TS_FILE, ts],
];

let changed = 0;

for (const [file, content] of outputs) {
  const next = content.endsWith("\n") ? content : `${content}\n`;
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";

  if (CHECK) {
    if (current !== next) {
      fail(
        `${file.replace(`${ROOT}/`, "")} está desactualizado. Ejecuta node scripts/gen-iconos.mjs.`,
      );
    }
    continue;
  }

  if (current !== next) {
    writeFileSync(file, next, "utf8");
    changed += 1;
  }
}

if (CHECK) {
  console.log("Iconos: mapas y catálogo sincronizados.");
} else {
  console.log(`Iconos: ${changed} archivo(s) actualizados.`);
}
