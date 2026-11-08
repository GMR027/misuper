#!/usr/bin/env bash
# publish-apk.sh — publica el APK release más reciente para descarga.
#
# Uso:
#   pnpm mobile:publish              # publica el APK que ya compiló pnpm android
#   pnpm mobile:publish --force      # publica aunque no coincida con app.json
#
# Genera:
#   public/descargas/misuper.apk
#   public/descargas/version.json
#
# El APK y el JSON entran en la imagen Docker; después hay que desplegar con
# ./deploy.sh para que la web y la app los vean.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/misuper-mobile"
APK="${APP_DIR}/android/app/build/outputs/apk/release/app-release.apk"
OUT_DIR="${ROOT_DIR}/public/descargas"
OUT_APK="${OUT_DIR}/misuper.apk"
FORCE=0

verde() { printf '\033[32m%s\033[0m\n' "$*"; }
amarillo() { printf '\033[33m%s\033[0m\n' "$*"; }
rojo() { printf '\033[31m%s\033[0m\n' "$*" >&2; }

for arg in "$@"; do
  case "${arg}" in
    --force) FORCE=1 ;;
    -h|--help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      rojo "Opción desconocida: ${arg}"
      exit 1
      ;;
  esac
done

if [[ ! -f "${APK}" ]]; then
  rojo "No existe el APK release: ${APK#"${ROOT_DIR}"/}"
  rojo "Compílalo primero con: pnpm android"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  rojo "Falta python3."
  exit 1
fi

read -r APP_VERSION APP_CODE < <(
  python3 - "${APP_DIR}/app.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    app = json.load(handle)["expo"]

print(app.get("version", ""), int(app.get("android", {}).get("versionCode", 0)))
PY
)

if [[ -z "${APP_VERSION}" || "${APP_CODE}" == "0" ]]; then
  rojo "app.json no tiene version/versionCode."
  exit 1
fi

# Comprueba que el APK corresponda a la versión de app.json. Un APK viejo
# publicado como "la última versión" rompe la actualización de la app.
AAPT=""
for candidato in "${ANDROID_HOME:-${HOME}/Android/Sdk}"/build-tools/*/aapt; do
  [[ -x "${candidato}" ]] && AAPT="${candidato}"
done

if [[ -n "${AAPT}" ]]; then
  BADGING="$("${AAPT}" dump badging "${APK}" 2>/dev/null | head -n 1 || true)"
  APK_VERSION="$(printf '%s' "${BADGING}" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"
  APK_CODE="$(printf '%s' "${BADGING}" | sed -n "s/.*versionCode='\([^']*\)'.*/\1/p")"

  if [[ -n "${APK_VERSION}" && ( "${APK_VERSION}" != "${APP_VERSION}" || "${APK_CODE}" != "${APP_CODE}" ) ]]; then
    rojo "El APK es ${APK_VERSION} (${APK_CODE}) pero app.json dice ${APP_VERSION} (${APP_CODE})."
    rojo "Vuelve a compilar con: pnpm android"
    if [[ ${FORCE} -ne 1 ]]; then
      rojo "Usa --force para publicarlo de todas formas."
      exit 1
    fi
    amarillo "Publicando de todas formas por --force."
  fi
else
  amarillo "No se encontró aapt; no se pudo verificar la versión del APK."
fi

APK_LIST="$(unzip -l "${APK}" 2>/dev/null || true)"

if [[ "${APK_LIST}" != *"lib/arm64-v8a/"* ]]; then
  amarillo "Aviso: el APK no contiene lib/arm64-v8a; no funcionará en teléfonos arm64."
fi

mkdir -p "${OUT_DIR}"
cp "${APK}" "${OUT_APK}"

SIZE="$(stat -c '%s' "${OUT_APK}")"
SHA256="$(sha256sum "${OUT_APK}" | cut -d ' ' -f 1)"
MD5="$(md5sum "${OUT_APK}" | cut -d ' ' -f 1)"
PUBLISHED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

python3 - "${OUT_DIR}/version.json" <<PY
import json
import sys

datos = {
    "version": "${APP_VERSION}",
    "version_code": ${APP_CODE},
    "apk": "misuper.apk",
    "size": ${SIZE},
    "sha256": "${SHA256}",
    "md5": "${MD5}",
    "published_at": "${PUBLISHED_AT}",
}

with open(sys.argv[1], "w", encoding="utf-8") as handle:
    json.dump(datos, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

verde "✓ APK publicado: ${OUT_APK#"${ROOT_DIR}"/}"
printf '  Versión: %s (%s)\n' "${APP_VERSION}" "${APP_CODE}"
printf '  Tamaño:  %s\n' "$(du -h "${OUT_APK}" | cut -f1)"
printf '  SHA-256: %s\n' "${SHA256}"
printf '\n  Siguiente paso: ./deploy.sh\n'
