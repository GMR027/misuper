#!/usr/bin/env node
/**
 * Cliente mínimo para el MCP de Google Stitch.
 *
 * Lee STITCH_API_KEY desde el entorno o desde .env (nunca la escribe en el
 * repositorio ni la imprime). Sirve para crear proyectos, generar pantallas
 * de referencia y descargar capturas/HTML mientras se rediseñan los controles.
 *
 * Uso:
 *   node scripts/stitch.mjs list
 *   node scripts/stitch.mjs create --title "Mi Súper · Controles"
 *   node scripts/stitch.mjs screens <projectId>
 *   node scripts/stitch.mjs get <projects/.../screens/...>
 *   node scripts/stitch.mjs generate <projectId> --device DESKTOP --prompt "..."
 *   node scripts/stitch.mjs edit <projectId> --screens id1,id2 --prompt "..."
 *   node scripts/stitch.mjs variants <projectId> --screens id1 --prompt "..." --count 2
 *   node scripts/stitch.mjs download <projects/.../files/...> --out ruta.png
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = "https://stitch.googleapis.com/mcp";
const ENV_FILE = resolve(ROOT, ".env");

function loadEnv() {
  if (!existsSync(ENV_FILE)) return;

  for (const raw of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const equals = line.indexOf("=");
    if (equals < 1) continue;

    const key = line.slice(0, equals).trim();
    if (process.env[key] !== undefined) continue;

    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function apiKey() {
  loadEnv();
  const key = (process.env.STITCH_API_KEY ?? "").trim();
  if (key === "") {
    throw new Error(
      "Falta STITCH_API_KEY. Añádela a .env o expórtala en el entorno.",
    );
  }
  return key;
}

function parseBody(text, contentType = "") {
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("Stitch devolvió una respuesta vacía.");

  if (trimmed.startsWith("{") && !contentType.includes("event-stream")) {
    return JSON.parse(trimmed);
  }

  const events = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((line) => line !== "" && line !== "[DONE]");

  for (let index = events.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(events[index]);
    } catch {
      // Un evento puede ser parcial; probamos con el anterior.
    }
  }

  return JSON.parse(trimmed);
}

async function rpc(method, params) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  const body = await response.text();
  const payload = parseBody(body, response.headers.get("content-type") ?? "");

  if (!response.ok || payload.error) {
    const detail =
      payload.error?.message ?? body.slice(0, 400) ?? response.statusText;
    throw new Error(`Stitch respondió ${response.status}: ${detail}`);
  }

  return payload.result;
}

async function callTool(name, args) {
  const result = await rpc("tools/call", { name, arguments: args });
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content.find((item) => item.type === "text")?.text ?? "";
  const isError = result?.isError === true;
  let data = text;

  try {
    data = text === "" ? result : JSON.parse(text);
  } catch {
    // Algunas herramientas devuelven texto plano.
  }

  if (isError) {
    const message =
      typeof data === "string" ? data : (data?.error?.message ?? text);
    throw new Error(`Stitch: ${message || "la herramienta falló"}`);
  }

  return data;
}

function option(args, name, fallback = "") {
  const grouped = args.find((arg) => arg === `--${name}`);
  if (grouped) {
    const next = args[args.indexOf(grouped) + 1];
    return next && !next.startsWith("--") ? next : fallback;
  }

  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : fallback;
}

function flag(args, name) {
  return args.includes(`--${name}`);
}

function print(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function screenSummary(screen) {
  return {
    name: screen.name,
    title: screen.title,
    deviceType: screen.deviceType,
    width: screen.width,
    height: screen.height,
    screenshot: screen.screenshot?.name ?? null,
    html: screen.htmlCode?.name ?? null,
  };
}

function outputPath(value, fallback) {
  const target = resolve(ROOT, value || fallback);
  mkdirSync(dirname(target), { recursive: true });
  return target;
}

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case "list": {
      const data = await callTool("list_projects", {});
      print({
        projects: (data.projects ?? []).map((project) => ({
          name: project.name,
          title: project.title,
          deviceType: project.deviceType,
          updateTime: project.updateTime,
        })),
      });
      break;
    }

    case "create": {
      const data = await callTool("create_project", {
        title: option(args, "title", "Mi Súper · Controles e iconos"),
      });
      print({
        name: data.name,
        title: data.title,
        deviceType: data.deviceType,
        designTheme: data.designTheme ?? null,
      });
      break;
    }

    case "screens": {
      const projectId = args.find((arg) => !arg.startsWith("--"));
      if (!projectId) throw new Error("Falta el id del proyecto.");
      const data = await callTool("list_screens", { projectId });
      print({
        screens: (data.screens ?? []).map(screenSummary),
      });
      break;
    }

    case "get": {
      const name = args.find((arg) => !arg.startsWith("--"));
      if (!name) throw new Error("Falta el nombre de la pantalla.");
      const data = await callTool("get_screen", { name });
      print(flag(args, "raw") ? data : screenSummary(data));
      break;
    }

    case "generate": {
      const projectId = args.find((arg) => !arg.startsWith("--"));
      if (!projectId) throw new Error("Falta el id del proyecto.");
      const prompt = option(args, "prompt");
      if (!prompt) throw new Error("Falta --prompt.");

      const data = await callTool("generate_screen_from_text", {
        projectId,
        prompt,
        deviceType: option(args, "device", "DESKTOP").toUpperCase(),
        ...(option(args, "design-system")
          ? { designSystem: option(args, "design-system") }
          : {}),
        ...(option(args, "model")
          ? { modelId: option(args, "model").toUpperCase() }
          : {}),
      });
      print(data, true);
      break;
    }

    case "edit": {
      const projectId = args.find((arg) => !arg.startsWith("--"));
      if (!projectId) throw new Error("Falta el id del proyecto.");
      const screens = option(args, "screens")
        .split(",")
        .map((screen) => screen.trim())
        .filter(Boolean);
      const prompt = option(args, "prompt");
      if (screens.length === 0) throw new Error("Falta --screens.");
      if (!prompt) throw new Error("Falta --prompt.");

      const data = await callTool("edit_screens", {
        projectId,
        selectedScreenIds: screens,
        prompt,
        deviceType: option(args, "device", "DESKTOP").toUpperCase(),
      });
      print(data, true);
      break;
    }

    case "variants": {
      const projectId = args.find((arg) => !arg.startsWith("--"));
      if (!projectId) throw new Error("Falta el id del proyecto.");
      const screens = option(args, "screens")
        .split(",")
        .map((screen) => screen.trim())
        .filter(Boolean);
      const prompt = option(args, "prompt");
      if (screens.length === 0) throw new Error("Falta --screens.");
      if (!prompt) throw new Error("Falta --prompt.");

      const data = await callTool("generate_variants", {
        projectId,
        selectedScreenIds: screens,
        prompt,
        deviceType: option(args, "device", "DESKTOP").toUpperCase(),
        variantOptions: {
          variantCount: Number(option(args, "count", "2")),
          creativeRange: option(args, "range", "REFINE").toUpperCase(),
        },
      });
      print(data, true);
      break;
    }

    case "download": {
      const name = args.find((arg) => !arg.startsWith("--"));
      if (!name) throw new Error("Falta el nombre del archivo.");
      const data = await callTool("download_file", { name });

      if (typeof data?.image === "string" && data.image !== "") {
        const target = outputPath(option(args, "out"), "stitch.png");
        writeFileSync(target, Buffer.from(data.image, "base64"));
        console.log(`Guardado ${target} (${data.imageMetadata?.width ?? "?"}×${data.imageMetadata?.height ?? "?"})`);
      } else if (typeof data?.html === "string") {
        const target = outputPath(option(args, "out"), "stitch.html");
        writeFileSync(target, data.html, "utf8");
        console.log(`Guardado ${target}`);
      } else {
        print(data, true);
      }
      break;
    }

    default:
      console.log(
        [
          "Uso:",
          "  node scripts/stitch.mjs list",
          "  node scripts/stitch.mjs create --title \"Mi Súper · Controles\"",
          "  node scripts/stitch.mjs screens <projectId>",
          "  node scripts/stitch.mjs get <screenName> [--raw]",
          "  node scripts/stitch.mjs generate <projectId> --device DESKTOP --prompt \"...\"",
          "  node scripts/stitch.mjs edit <projectId> --screens id1,id2 --prompt \"...\"",
          "  node scripts/stitch.mjs variants <projectId> --screens id1 --prompt \"...\" --count 2",
          "  node scripts/stitch.mjs download <fileResource> --out ruta.png",
        ].join("\n"),
      );
  }
} catch (error) {
  console.error(`✖ ${error.message}`);
  process.exitCode = 1;
}
