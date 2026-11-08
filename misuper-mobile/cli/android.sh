#!/usr/bin/env bash
# android.sh - build Mi Súper's Android app and install it on your phones.
#
# Usage:
#   pnpm android                       menu: build & install, or the phones
#   pnpm android devices               pair, connect, rename, delete phones
#   pnpm android [-d <nick>] [-y]      build the release APK and install it
#   pnpm android --dev                 debug build + Metro (for development)
#   --prebuild                         regenerate android/ even when up to date
#   --lang en|es                       skip the language question
#   -y                                 every default: English, bump the version,
#                                      no uninstall; still asks for the phones
#                                      when no -d is given
#   -d <nick>                          install on that phone (repeat -d, or
#                                      s24,g7) - fails if it cannot be reached
#   -h, --help                         this text
#
# The flow:
#   1. Version  - offer a patch bump (package.json, app.json's version and
#                 android.versionCode); -y bumps.
#   2. Native   - `expo prebuild --platform android --clean` when android/ is
#                 missing or older than app.json, package.json, a plugin, or an
#                 image app.json names (--prebuild forces it). Otherwise a bump
#                 is written into android/app/build.gradle directly.
#   3. Build    - ./gradlew assembleRelease for just the ABIs of the phones
#                 picked (arm64-v8a, usually). The JS bundle task always
#                 re-runs (--rerun): Gradle only checks the app's own .js/.ts
#                 files, so an edit to an asset or messages/*.json would
#                 otherwise ship the last bundle. --dev builds the debug APK.
#   4. Install  - adb install -r on every phone, then open the app. A phone
#                 holding a build signed with another key is offered an
#                 uninstall first (it erases the app's data; -y never does).
#                 The debug build uses app.misuper.debug, so it lives next to
#                 the release app instead of replacing it.
#
# The release APK is signed with the key this repo's `cli/release-key.sh`
# creates under ~/.android/, never with the debug key: an update installs over
# an app someone already has. Losing that key means uninstalling the app on
# every phone before the next build can be installed - back it up.
#
# Phones are saved under nicknames (cli/devices.sh): paired over Wi-Fi with
# Wireless debugging (the default, Android 11+) or over USB - kept on the
# cable, or switched to Wi-Fi with `adb tcpip 5555`. Phones are asked for
# before the build, so a run can be left alone once it starts building.
#
# Needs the Android SDK (adb in PATH, $ANDROID_HOME or ~/Android/Sdk), a JDK 17
# and pnpm. pnpm android takes care of the rest.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ui.sh
source "${SCRIPT_DIR}/lib/ui.sh"
# shellcheck source=devices.sh
source "${SCRIPT_DIR}/devices.sh"

APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_NAME="$(basename "${APP_DIR}")"

# ── i18n ──────────────────────────────────────────────────────────────────────

setup_strings() {
  local lang="$1"
  UI_LANG="${lang}"
  dev_setup_strings "${lang}"
  if [[ "${lang}" == "es" ]]; then
    WELCOME="Mi Súper · Android"
    SUBTITLE="Compila la app y instálala en tus teléfonos."
    ADB_MISSING="No se encontró adb (PATH, \$ANDROID_HOME o ~/Android/Sdk)."
    JAVA_MISSING="No se encontró un JDK con javac y keytool (JAVA_HOME o /usr/lib/jvm)."
    PNPM_MISSING="pnpm no está instalado o no está en PATH."
    TOOLS_HINT="Instala Java 17 y el Android SDK; luego vuelve a correr pnpm android."
    MENU_PROMPT="¿Qué quieres hacer?"
    MENU_BUILD="Compilar e instalar (release)"
    MENU_DEV="Compilar en modo desarrollo (debug + Metro)"
    MENU_DEVICES="Teléfonos (vincular, renombrar, eliminar)"
    MENU_QUIT="Salir"
    ARG_D_MISSING="-d necesita el apodo de un teléfono."
    ARG_UNKNOWN="Opción desconocida"
    TARGET_PROMPT="Instalar en"
    TARGET_HINT="Espacio marca · Enter sigue"
    TARGET_ADD="Vincular un teléfono nuevo"
    TARGET_UNSAVED="sin guardar"
    TARGET_NONE="No hay teléfonos guardados ni conectados."
    TARGET_PAIR_NOW="¿Vincular uno ahora?"
    TARGET_NONE_SELECTED="No se seleccionó ningún teléfono."
    TARGET_UNKNOWN_FMT='No hay un teléfono guardado como "%s".'
    TARGET_SAVED_LIST="Guardados"
    TARGET_SAVED_NONE="ninguno - vincula uno con: pnpm android devices"
    TARGET_UNREACHABLE_FMT='%s no está conectado: %s'
    TARGET_NONE_REACHED="No se alcanzó ningún teléfono."
    TARGET_RETRY="¿Intentar de nuevo?"
    TARGETS_TITLE="Teléfonos"
    STEP_VERSION="Versión"
    STEP_NATIVE="Proyecto nativo (android/)"
    STEP_BUILD="Compilando el APK"
    STEP_INSTALL="Instalando"
    VERSION_CURRENT="Versión actual"
    VERSION_BUMP_PROMPT="¿Subir la versión del patch?"
    VERSION_SKIPPED="Versión sin cambios"
    VERSION_DEV="En modo desarrollo no se cambia la versión."
    NATIVE_OK="android/ está al día."
    NATIVE_MISSING="android/ no existe todavía."
    NATIVE_STALE_FMT="%s cambió desde el último prebuild."
    NATIVE_FORCED="--prebuild: se regenera android/."
    PREBUILD_FAILED="expo prebuild falló."
    VERSION_GRADLE="Versión escrita en android/app/build.gradle (sin prebuild)."
    SIGNING_MISSING="No hay una clave de firma de release configurada."
    SIGNING_CREATE="¿Crearla ahora? (se guarda fuera del repo, en ~/.android y ~/.gradle)"
    SIGNING_FAILED="No se pudo preparar la clave de firma."
    BUILD_FAILED="El build de Gradle falló."
    GRADLE_STALE_CACHE="El daemon de Gradle apunta a un archivo de caché que ya no existe: se detienen los daemons y se reintenta."
    BUILD_OK="APK listo"
    APK_MISSING="Gradle terminó pero no se encontró el APK."
    INSTALLING_ON="Instalando en"
    INSTALL_OK="Instalada"
    INSTALL_FAILED="La instalación falló."
    INSTALL_SIGNATURE="El teléfono tiene esta app firmada con otra clave."
    INSTALL_UNINSTALL_PROMPT="¿Desinstalarla (borra sus datos) e instalar de nuevo?"
    LAUNCHED="App abierta."
    DEV_OK="APK de desarrollo instalado en todos los teléfonos."
    DEV_METRO="Inicia Metro en la PC con: pnpm mobile:start"
    RESULTS_TITLE="Resultado"
    RESULT_OK="instalada"
    RESULT_FAILED="falló"
    RESULT_BUILD_FAILED="el build falló"
    SOME_FAILED="Algo falló."
    ALL_DONE="¡Todo listo!"
    BYE="Listo."
  else
    WELCOME="Mi Súper · Android"
    SUBTITLE="Build the app and install it on your phones."
    ADB_MISSING="adb was not found (PATH, \$ANDROID_HOME or ~/Android/Sdk)."
    JAVA_MISSING="No JDK with javac and keytool found (JAVA_HOME or /usr/lib/jvm)."
    PNPM_MISSING="pnpm is not installed or not in PATH."
    TOOLS_HINT="Install Java 17 and the Android SDK, then run pnpm android again."
    MENU_PROMPT="What do you want to do?"
    MENU_BUILD="Build and install (release)"
    MENU_DEV="Build for development (debug + Metro)"
    MENU_DEVICES="Phones (pair, rename, delete)"
    MENU_QUIT="Quit"
    ARG_D_MISSING="-d needs a phone's nickname."
    ARG_UNKNOWN="Unknown option"
    TARGET_PROMPT="Install on"
    TARGET_HINT="Space toggles · Enter goes on"
    TARGET_ADD="Pair a new phone"
    TARGET_UNSAVED="not saved"
    TARGET_NONE="No phones saved or connected."
    TARGET_PAIR_NOW="Pair one now?"
    TARGET_NONE_SELECTED="No phones selected."
    TARGET_UNKNOWN_FMT='No phone is saved as "%s".'
    TARGET_SAVED_LIST="Saved"
    TARGET_SAVED_NONE="none - pair one with: pnpm android devices"
    TARGET_UNREACHABLE_FMT='%s is not connected: %s'
    TARGET_NONE_REACHED="No phone could be reached."
    TARGET_RETRY="Try again?"
    TARGETS_TITLE="Phones"
    STEP_VERSION="Version"
    STEP_NATIVE="Native project (android/)"
    STEP_BUILD="Building the APK"
    STEP_INSTALL="Installing"
    VERSION_CURRENT="Current version"
    VERSION_BUMP_PROMPT="Bump patch version?"
    VERSION_SKIPPED="Version unchanged"
    VERSION_DEV="Development builds do not change the version."
    NATIVE_OK="android/ is up to date."
    NATIVE_MISSING="android/ does not exist yet."
    NATIVE_STALE_FMT="%s changed since the last prebuild."
    NATIVE_FORCED="--prebuild: regenerating android/."
    PREBUILD_FAILED="expo prebuild failed."
    VERSION_GRADLE="Version written into android/app/build.gradle (no prebuild)."
    SIGNING_MISSING="No release signing key is configured."
    SIGNING_CREATE="Create it now? (kept outside the repo, in ~/.android and ~/.gradle)"
    SIGNING_FAILED="The signing key could not be prepared."
    BUILD_FAILED="Gradle build failed."
    GRADLE_STALE_CACHE="The Gradle daemon points at a cache file that no longer exists: stopping the daemons and retrying."
    BUILD_OK="APK ready"
    APK_MISSING="Gradle finished but the APK was not found."
    INSTALLING_ON="Installing on"
    INSTALL_OK="Installed"
    INSTALL_FAILED="Install failed."
    INSTALL_SIGNATURE="The phone holds this app signed with another key."
    INSTALL_UNINSTALL_PROMPT="Uninstall it (erases its data) and install again?"
    LAUNCHED="App opened."
    DEV_OK="Development APK installed on every phone."
    DEV_METRO="Start Metro on the PC with: pnpm mobile:start"
    RESULTS_TITLE="Results"
    RESULT_OK="installed"
    RESULT_FAILED="failed"
    RESULT_BUILD_FAILED="build failed"
    SOME_FAILED="Something failed."
    ALL_DONE="All done!"
    BYE="Done."
  fi
}

# ── Tools ─────────────────────────────────────────────────────────────────────

# find_jdk - export JAVA_HOME as a full JDK (javac and keytool), 17 first.
find_jdk() {
  [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/javac" ]] && return 0
  local j
  if [[ -x /usr/libexec/java_home ]] && j="$(/usr/libexec/java_home -v 17 2>/dev/null)"; then
    export JAVA_HOME="${j}"; return 0
  fi
  for j in /usr/lib/jvm/java-17-* /usr/lib/jvm/*17* /usr/lib/jvm/*; do
    [[ -x "${j}/bin/javac" ]] && { export JAVA_HOME="${j}"; return 0; }
  done
  return 1
}

# ── App helpers ───────────────────────────────────────────────────────────────

read_package_version() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('version', '0.0.0'))" "$1"
}

app_package() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['expo']['android']['package'])" \
    "${APP_DIR}/app.json" 2>/dev/null || true
}

bump_version() {
  local major minor patch
  IFS='.' read -r major minor patch <<< "$1"
  echo "${major:-0}.${minor:-0}.$(( ${patch:-0} + 1 ))"
}

# gradle_field <build.gradle> <versionCode|versionName|applicationId> - its value.
gradle_field() {
  [[ -f "$1" ]] || return 0
  sed -n "s/^[[:space:]]*$2[[:space:]]*[\"']\{0,1\}\([^\"']*\)[\"']\{0,1\}[[:space:]]*\$/\1/p" "$1" | sed -n 1p
}

# write_versions <app_dir> <version> - package.json's version; app.json's
# expo.version and expo.android.versionCode (one up from app.json's, else from
# the generated build.gradle's, else 1). Prints the new versionCode.
write_versions() {
  local app_dir="$1" version="$2" gradle_code
  gradle_code="$(gradle_field "${app_dir}/android/app/build.gradle" versionCode)"
  python3 - "${app_dir}" "${version}" "${gradle_code:-1}" <<'PYEOF'
import json, os, sys
app_dir, version, gradle_code = sys.argv[1], sys.argv[2], int(sys.argv[3] or 1)

def rewrite(path, change):
    with open(path) as f:
        data = json.load(f)
    change(data)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

rewrite(os.path.join(app_dir, 'package.json'), lambda d: d.__setitem__('version', version))

app_json = os.path.join(app_dir, 'app.json')
if os.path.exists(app_json):
    def bump(d):
        expo = d.get('expo', d)
        expo['version'] = version
        android = expo.setdefault('android', {})
        android['versionCode'] = int(android.get('versionCode', gradle_code)) + 1
        print(android['versionCode'])
    rewrite(app_json, bump)
PYEOF
}

# native_stale - why android/ needs a prebuild (a file, relative to the app),
# or nothing when it does not. android/app/build.gradle is what prebuild wrote
# last, so anything newer than it has not reached android/.
native_stale() {
  local ref="${APP_DIR}/android/app/build.gradle" f
  [[ -f "${ref}" ]] || { printf 'android/'; return 0; }
  local -a files=(app.json app.config.js app.config.ts package.json)
  for f in "${APP_DIR}"/modules/*/app.plugin.js "${APP_DIR}"/plugins/*.js; do
    [[ -f "${f}" ]] && files+=("${f#"${APP_DIR}"/}")
  done
  if [[ -f "${APP_DIR}/app.json" ]]; then
    while IFS= read -r f; do files+=("${f#./}"); done \
      < <(grep -o '"\./[^"]*"' "${APP_DIR}/app.json" | tr -d '"' | sort -u)
  fi
  for f in "${files[@]}"; do
    if [[ -f "${APP_DIR}/${f}" && "${APP_DIR}/${f}" -nt "${ref}" ]]; then
      printf '%s' "${f}"; return 0
    fi
  done
}

# ── Signing ───────────────────────────────────────────────────────────────────

prop_value() {
  [[ -f "$1" ]] || return 0
  sed -n "s/^$2=//p" "$1" | sed -n 1p
}

signing_ready() {
  local props="${HOME}/.gradle/gradle.properties" key pass
  key="$(prop_value "${props}" MISUPER_MOBILE_RELEASE_STORE_FILE)"
  pass="$(prop_value "${props}" MISUPER_MOBILE_RELEASE_STORE_PASSWORD)"
  [[ -n "${key}" && -f "${key}" && -n "${pass}" ]]
}

# ensure_signing <auto_yes> - the release build must never fall back to the
# debug key, so a missing one is created (outside the repo) or the run stops.
ensure_signing() {
  local auto_yes="$1"
  signing_ready && return 0
  printf "  %s %s\n" "$(clr_bold_yellow '!')" "${SIGNING_MISSING}"
  if ! confirm_yes "${SIGNING_CREATE}" "${auto_yes}"; then
    printf "  %s %s\n\n" "$(clr_bold_red '✗')" "${SIGNING_FAILED}"; exit 1
  fi
  if ! bash "${SCRIPT_DIR}/release-key.sh" --lang "${UI_LANG}"; then
    printf "\n  %s %s\n\n" "$(clr_bold_red '✗')" "${SIGNING_FAILED}"; exit 1
  fi
  echo ""
  signing_ready || { printf "  %s %s\n\n" "$(clr_bold_red '✗')" "${SIGNING_FAILED}"; exit 1; }
}

# ── Steps ─────────────────────────────────────────────────────────────────────

# step_version <auto_yes> <dev> - bump package.json/app.json; sets NEW_VERSION
# and BUMP_CODE (the versionCode written, empty when unchanged).
step_version() {
  local auto_yes="$1" dev="$2" current new code=""
  current="$(read_package_version "${APP_DIR}/package.json")"
  printf "\n  %s\n" "$(clr_bold_cyan "── [1/${STEPS}] ${STEP_VERSION} ──")"
  printf "  %-14s %s\n\n" "$(clr_dim "${VERSION_CURRENT}:")" "$(clr_cyan "${current}")"
  NEW_VERSION="${current}"; BUMP_CODE=""; BUMPED=0
  if [[ "${dev}" -eq 1 ]]; then
    printf "  %s\n" "$(clr_dim "${VERSION_DEV}")"
    return 0
  fi
  if confirm_yes "${VERSION_BUMP_PROMPT}" "${auto_yes}"; then
    new="$(bump_version "${current}")"
    code="$(write_versions "${APP_DIR}" "${new}")"
    NEW_VERSION="${new}"; BUMP_CODE="${code}"; BUMPED=1
    printf "  %s %s → %s%s\n" "$(clr_bold_green '✓')" "$(clr_dim "${current}")" "$(clr_bold "${new}")" \
      "${code:+ $(clr_dim "(versionCode ${code})")}"
  else
    printf "  %s (%s)\n" "$(clr_dim "${VERSION_SKIPPED}")" "${current}"
  fi
}

# step_native <force_prebuild> - prebuild when needed (or forced), else write
# the bumped version straight into build.gradle. STALE was measured before the
# version bump, which itself rewrites package.json and app.json.
step_native() {
  local force_prebuild="$1" stale="${STALE}" prebuild=0
  stale="$(native_stale)"
  printf "\n  %s\n\n" "$(clr_bold_cyan "── [2/${STEPS}] ${STEP_NATIVE} ──")"
  if [[ "${force_prebuild}" -eq 1 ]]; then
    printf "  %s\n" "${NATIVE_FORCED}"; prebuild=1
  elif [[ "${stale}" == android/ ]]; then
    printf "  %s\n" "${NATIVE_MISSING}"; prebuild=1
  elif [[ -n "${stale}" ]]; then
    # shellcheck disable=SC2059
    printf "  %s\n" "$(printf "${NATIVE_STALE_FMT}" "${stale}")"; prebuild=1
  fi

  if [[ ${prebuild} -eq 1 ]]; then
    printf "  %s expo prebuild --platform android --clean\n\n" "$(clr_bold_yellow '→')"
    # EXPO_NO_GIT_STATUS: --clean otherwise stops to ask about uncommitted work.
    if ! (cd "${APP_DIR}" && EXPO_NO_GIT_STATUS=1 pnpm exec expo prebuild --platform android --clean); then
      printf "\n  %s %s\n" "$(clr_bold_red '✗')" "${PREBUILD_FAILED}"; return 1
    fi
  else
    printf "  %s %s\n" "$(clr_bold_green '✓')" "${NATIVE_OK}"
    if [[ "${BUMPED:-0}" -eq 1 ]]; then
      local gradle="${APP_DIR}/android/app/build.gradle" tmp
      tmp="${gradle}.tmp.$$"
      sed -e "s/^\([[:space:]]*versionName[[:space:]]*\)[\"'][^\"']*[\"']/\1\"${NEW_VERSION}\"/" \
          -e "${BUMP_CODE:+s/^\([[:space:]]*versionCode[[:space:]]*\)[0-9][0-9]*/\1${BUMP_CODE}/}" \
          "${gradle}" > "${tmp}" && mv "${tmp}" "${gradle}"
      printf "  %s\n" "$(clr_dim "${VERSION_GRADLE}")"
    fi
  fi
}

# gradle_build <android dir> <gradle args...> - runs ./gradlew. When it fails on
# a file missing under ~/.gradle/caches (a daemon still pointing at a cache
# entry that cleanup removed), it stops the daemons and tries once more.
gradle_build() {
  local dir="$1" log rc=0
  shift
  log="$(mktemp)"
  (cd "${dir}" && ./gradlew "$@") 2>&1 | tee "${log}" || rc=$?
  if [[ ${rc} -ne 0 ]] && grep -q 'NoSuchFileException: .*/\.gradle/caches/' "${log}"; then
    printf "\n  %s %s\n\n" "$(clr_bold_yellow '!')" "${GRADLE_STALE_CACHE}"
    (cd "${dir}" && ./gradlew --stop) >/dev/null 2>&1 || true
    rc=0
    (cd "${dir}" && ./gradlew "$@") || rc=$?
  fi
  rm -f "${log}"
  return "${rc}"
}

# step_build <release|debug> <abis> - sets APK.
step_build() {
  local variant="$1" abis="$2" apk
  printf "\n  %s\n\n" "$(clr_bold_cyan "── [3/${STEPS}] ${STEP_BUILD} ──")"
  if [[ "${variant}" == debug ]]; then
    apk="${APP_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
    printf "  %s ./gradlew assembleDebug -PreactNativeArchitectures=%s\n\n" "$(clr_bold_yellow '→')" "${abis}"
    rm -f "${apk}"
    if ! gradle_build "${APP_DIR}/android" assembleDebug "-PreactNativeArchitectures=${abis}"; then
      printf "\n  %s %s\n" "$(clr_bold_red '✗')" "${BUILD_FAILED}"; return 1
    fi
  else
    apk="${APP_DIR}/android/app/build/outputs/apk/release/app-release.apk"
    printf "  %s ./gradlew createBundleReleaseJsAndAssets --rerun assembleRelease -PreactNativeArchitectures=%s\n\n" \
      "$(clr_bold_yellow '→')" "${abis}"
    rm -f "${apk}"
    # --rerun: Gradle's up-to-date check misses assets, JSON and native changes.
    if ! gradle_build "${APP_DIR}/android" createBundleReleaseJsAndAssets --rerun assembleRelease \
        "-PreactNativeArchitectures=${abis}"; then
      printf "\n  %s %s\n" "$(clr_bold_red '✗')" "${BUILD_FAILED}"; return 1
    fi
  fi
  if [[ ! -f "${apk}" ]]; then
    printf "\n  %s %s\n" "$(clr_bold_red '✗')" "${APK_MISSING}"; return 1
  fi
  APK="${apk}"
  local size
  size="$(du -h "${apk}" | cut -f1)"
  printf "\n  %s %s: %s %s\n" "$(clr_bold_green '✓')" "${BUILD_OK}" "${apk#"${REPO_ROOT}"/}" "$(clr_dim "(${size})")"
}

# install_one <apk> <adb id> <label> <package> <auto_yes> - 0 when installed.
install_one() {
  local apk="$1" id="$2" label="$3" pkg="$4" auto_yes="$5" out
  printf "  %s %s %s %s\n" "$(clr_bold_yellow '→')" "${INSTALLING_ON}" "$(clr_bold "${label}")" "$(clr_dim "(adb -s ${id} install -r)")"
  out="$("${ADB}" -s "${id}" install -r "${apk}" 2>&1 </dev/null || true)"
  if [[ "${out}" != *Success* && "${out}" == *INSTALL_FAILED_UPDATE_INCOMPATIBLE* && -n "${pkg}" ]]; then
    printf "  %s %s\n" "$(clr_bold_yellow '!')" "${INSTALL_SIGNATURE}"
    if [[ "${auto_yes}" -eq 0 ]] && confirm_no "${INSTALL_UNINSTALL_PROMPT}"; then
      "${ADB}" -s "${id}" uninstall "${pkg}" >/dev/null 2>&1 </dev/null || true
      out="$("${ADB}" -s "${id}" install -r "${apk}" 2>&1 </dev/null || true)"
    fi
  fi
  if [[ "${out}" != *Success* ]]; then
    printf "  %s %s\n" "$(clr_bold_red '✗')" "${INSTALL_FAILED}"
    printf '%s\n' "${out}" | grep -v '^Performing' | tail -n 4 | sed 's/^/      /'
    return 1
  fi
  printf "  %s %s\n" "$(clr_bold_green '✓')" "${INSTALL_OK}"
  if [[ -n "${pkg}" ]]; then
    "${ADB}" -s "${id}" reverse tcp:8081 tcp:8081 >/dev/null 2>&1 </dev/null || true
    if "${ADB}" -s "${id}" shell monkey -p "${pkg}" -c android.intent.category.LAUNCHER 1 \
        >/dev/null 2>&1 </dev/null; then
      printf "  %s\n" "$(clr_dim "${LAUNCHED}")"
    fi
  fi
}

# ── Targets ───────────────────────────────────────────────────────────────────
# Both fill T_IDS (adb -s ids) and T_LABELS (nickname, or the model of a phone
# that is connected but not saved).

T_IDS=() T_LABELS=()

targets_from_nicks() {
  local auto_yes="$1" nick i found interactive=1
  shift
  [[ "${auto_yes}" -eq 1 ]] && interactive=0
  dev_load
  for nick in "$@"; do
    if dev_index "${nick}"; then
      if ! dev_connect "${DEV_IDX}" "${interactive}"; then
        # shellcheck disable=SC2059
        printf "  %s %s\n\n" "$(clr_bold_red '✗')" "$(printf "${TARGET_UNREACHABLE_FMT}" "$(clr_bold "${nick}")" "${DEV_ERR}")"
        exit 1
      fi
      T_IDS+=("${DEV_ID}"); T_LABELS+=("${nick}")
      continue
    fi
    adb_scan
    found=""
    for (( i = 0; i < ${#ADB_IDS[@]}; i++ )); do
      [[ "$(lc "${ADB_IDS[$i]}")" == "${nick}" && "${ADB_STATES[$i]}" == device ]] && found="${ADB_IDS[$i]}"
    done
    if [[ -z "${found}" ]]; then
      # shellcheck disable=SC2059
      printf "  %s %s\n" "$(clr_bold_red '✗')" "$(printf "${TARGET_UNKNOWN_FMT}" "${nick}")"
      local saved=""
      [[ ${#D_NICK[@]} -gt 0 ]] && saved="$(printf '%s, ' "${D_NICK[@]}")" && saved="${saved%, }"
      printf "  %s\n\n" "$(clr_dim "${TARGET_SAVED_LIST}: ${saved:-${TARGET_SAVED_NONE}}")"
      exit 1
    fi
    T_IDS+=("${found}"); T_LABELS+=("${nick}")
  done
}

# pick_targets - the checklist: every saved phone, every connected phone that
# is not saved, and "pair a new phone". Connected ones start ticked.
pick_targets() {
  local i j n
  while true; do
    dev_load
    adb_scan
    local -a kinds=() refs=() rows=() notes=() checked=()
    local width=0
    for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
      [[ ${#D_NICK[$i]} -gt ${width} ]] && width=${#D_NICK[$i]}
    done
    for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
      kinds+=(saved); refs+=("${i}")
      rows+=("$(pad_right "${D_NICK[$i]}" "${width}")  ${D_MODEL[$i]}")
      notes+=("$(dev_mode_label "${D_MODE[$i]}") · $(dev_status "${D_SERIAL[$i]}")")
      if dev_find_online "${D_SERIAL[$i]}"; then checked+=(1); else checked+=(0); fi
    done
    adb_unsaved
    for j in "${U_IDX[@]+"${U_IDX[@]}"}"; do
      kinds+=(unsaved); refs+=("${j}")
      rows+=("${ADB_MODELS[$j]:-${ADB_IDS[$j]}}")
      notes+=("${TARGET_UNSAVED} · ${ADB_IDS[$j]}")
      checked+=(1)
    done
    n=${#kinds[@]}

    if [[ ${n} -eq 0 ]]; then
      printf "  %s\n\n" "$(clr_bold_yellow "${TARGET_NONE}")"
      if confirm_yes "${TARGET_PAIR_NOW}"; then
        echo ""; dev_add || true; echo ""; continue
      fi
      exit 0
    fi

    printf "  %s:\n" "$(clr_bold "${TARGET_PROMPT}")"
    printf "  %s\n\n" "$(clr_dim "${TARGET_HINT}")"
    UI_NOTES=("${notes[@]}" "")
    UI_CHECKED=("${checked[@]}" 0)
    ui_checkbox "${rows[@]}" "➕ ${TARGET_ADD}"
    echo ""

    local -a picked=("${UI_SELECTED[@]+"${UI_SELECTED[@]}"}")
    local pair=0 k
    for k in "${picked[@]+"${picked[@]}"}"; do [[ ${k} -eq ${n} ]] && pair=1; done
    local -a want_nicks=() want_ids=() want_labels=()
    for k in "${picked[@]+"${picked[@]}"}"; do
      [[ ${k} -eq ${n} ]] && continue
      if [[ "${kinds[$k]}" == saved ]]; then
        want_nicks+=("${D_NICK[${refs[$k]}]}")
      else
        want_ids+=("${ADB_IDS[${refs[$k]}]}"); want_labels+=("${ADB_MODELS[${refs[$k]}]:-${ADB_IDS[${refs[$k]}]}}")
      fi
    done
    if [[ ${pair} -eq 1 ]]; then
      dev_add && want_nicks+=("${DEV_ADDED}")
      echo ""
    fi
    if [[ ${#want_nicks[@]} -eq 0 && ${#want_ids[@]} -eq 0 ]]; then
      printf "  %s\n\n" "$(clr_dim "${TARGET_NONE_SELECTED}")"; exit 0
    fi

    T_IDS=(); T_LABELS=()
    local nick
    for nick in "${want_nicks[@]+"${want_nicks[@]}"}"; do
      dev_load
      dev_index "${nick}" || continue
      if dev_connect "${DEV_IDX}" 1; then
        T_IDS+=("${DEV_ID}"); T_LABELS+=("${nick}")
      else
        # shellcheck disable=SC2059
        printf "  %s %s\n" "$(clr_bold_red '✗')" "$(printf "${TARGET_UNREACHABLE_FMT}" "$(clr_bold "${nick}")" "${DEV_ERR}")"
      fi
    done
    for (( i = 0; i < ${#want_ids[@]}; i++ )); do
      T_IDS+=("${want_ids[$i]}"); T_LABELS+=("${want_labels[$i]}")
    done
    [[ ${#T_IDS[@]} -gt 0 ]] && return 0

    printf "\n  %s\n\n" "$(clr_bold_red "${TARGET_NONE_REACHED}")"
    confirm_yes "${TARGET_RETRY}" || exit 1
    echo ""
  done
}

# ── Main ──────────────────────────────────────────────────────────────────────

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "${BASH_SOURCE[0]}"
}

main() {
  local auto_yes=0 force_prebuild=0 want_devices=0 dev=0 lang=""
  local -a nick_args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes)   auto_yes=1 ;;
      --prebuild) force_prebuild=1 ;;
      --dev)      dev=1 ;;
      --lang)
        [[ "${2:-}" == en || "${2:-}" == es ]] || { setup_strings en; printf "  %s: --lang en|es\n" "${ARG_UNKNOWN}" >&2; exit 2; }
        lang="$2"; shift ;;
      -d|--device)
        [[ -n "${2:-}" && "${2}" != -* ]] || { setup_strings en; printf "  %s\n" "${ARG_D_MISSING}" >&2; exit 2; }
        nick_args+=(${2//,/ }); shift ;;
      -d=*|--device=*) nick_args+=(${1#*=}) ;;
      devices)    want_devices=1 ;;
      -h|--help)  usage; exit 0 ;;
      -*)         setup_strings en; printf "  %s: %s\n" "${ARG_UNKNOWN}" "$1" >&2; exit 2 ;;
      *)          setup_strings en; printf "  %s: %s\n" "${ARG_UNKNOWN}" "$1" >&2; exit 2 ;;
    esac
    shift
  done
  # "-d s24,g7" and "-d=s24,g7" both split on the comma above; lower-case them.
  local i
  for (( i = 0; i < ${#nick_args[@]}; i++ )); do nick_args[i]="$(lc "${nick_args[$i]//,/}")"; done

  local handed_over=0
  [[ -n "${lang}" ]] && handed_over=1
  [[ -z "${lang}" && ${auto_yes} -eq 0 ]] && lang="$(ui_pick_lang)"
  setup_strings "${lang:-en}"

  if [[ ${handed_over} -eq 0 ]]; then
    clear
    print_header
  fi

  # ── Tools ──────────────────────────────────────────────────────────────────
  if ! find_adb; then
    printf "  %s %s\n  %s\n\n" "$(clr_bold_red '✗')" "${ADB_MISSING}" "$(clr_dim "${TOOLS_HINT}")"; exit 1
  fi
  if [[ ${want_devices} -eq 0 ]]; then
    if ! find_jdk; then
      printf "  %s %s\n  %s\n\n" "$(clr_bold_red '✗')" "${JAVA_MISSING}" "$(clr_dim "${TOOLS_HINT}")"; exit 1
    fi
    if ! command -v pnpm >/dev/null 2>&1; then
      printf "  %s %s\n\n" "$(clr_bold_red '✗')" "${PNPM_MISSING}"; exit 1
    fi
  fi
  # Started now, so its "daemon started" lines do not land in a list.
  "${ADB}" start-server >/dev/null 2>&1 </dev/null || true

  if [[ ${want_devices} -eq 1 ]]; then
    devices_menu
    printf "\n  %s\n\n" "$(clr_bold_green "✓ ${BYE}")"
    exit 0
  fi

  REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

  # ── No arguments: build, or the phones ─────────────────────────────────────
  if [[ ${#nick_args[@]} -eq 0 && ${auto_yes} -eq 0 ]]; then
    while true; do
      printf "  %s:\n\n" "$(clr_bold "${MENU_PROMPT}")"
      ui_select "🚀 ${MENU_BUILD}" "🧪 ${MENU_DEV}" "📱 ${MENU_DEVICES}" "🚪 ${MENU_QUIT}"
      echo ""
      case "${UI_INDEX}" in
        0) dev=0; break ;;
        1) dev=1; break ;;
        2) devices_menu; clear; print_header ;;
        *) printf "  %s\n\n" "$(clr_bold_green "✓ ${BYE}")"; exit 0 ;;
      esac
    done
  fi

  # ── Phones ─────────────────────────────────────────────────────────────────
  print_section "${TARGETS_TITLE}"
  if [[ ${#nick_args[@]} -gt 0 ]]; then
    targets_from_nicks "${auto_yes}" "${nick_args[@]}"
  else
    pick_targets
  fi

  # The build carries only the ABIs these phones run.
  local abis="" abi width=0
  for (( i = 0; i < ${#T_LABELS[@]}; i++ )); do
    [[ ${#T_LABELS[$i]} -gt ${width} ]] && width=${#T_LABELS[$i]}
  done
  for (( i = 0; i < ${#T_IDS[@]}; i++ )); do
    abi="$(adb_prop "${T_IDS[$i]}" ro.product.cpu.abi)"
    [[ -z "${abi}" ]] && abi="arm64-v8a"
    [[ ",${abis}," == *",${abi},"* ]] || abis="${abis:+${abis},}${abi}"
    printf "  %s %s  %s\n" "$(clr_bold_green '✓')" "$(clr_bold "$(pad_right "${T_LABELS[$i]}" "${width}")")" \
      "$(clr_dim "$(adb_prop "${T_IDS[$i]}" ro.product.model) · ${abi} · ${T_IDS[$i]}")"
  done

  # ── Build and install ──────────────────────────────────────────────────────
  local pkg any_failed=0
  local -a RESULT_LINES=()
  APK=""
  pkg="$(app_package)"
  [[ -z "${pkg}" ]] && pkg="$(gradle_field "${APP_DIR}/android/app/build.gradle" applicationId)"
  # The debug build adds .debug (plugins/debug-app-id.js), so it installs next
  # to the release-signed app instead of clashing with it.
  [[ ${dev} -eq 1 ]] && pkg="${pkg}.debug"

  if [[ ${dev} -eq 1 ]]; then
    STEPS=3
    printf "\n  %s\n" "$(clr_bold_magenta "━━ ${APP_NAME} · debug ━━")"
    STALE="$(native_stale)"
    if ! step_native "${force_prebuild}"; then
      printf "\n  %s\n\n" "$(clr_bold_red "✗ ${SOME_FAILED}")"; exit 1
    fi
    if ! step_build debug "${abis}"; then
      printf "\n  %s\n\n" "$(clr_bold_red "✗ ${SOME_FAILED}")"; exit 1
    fi
  else
    STEPS=4
    printf "\n  %s\n" "$(clr_bold_magenta "━━ ${APP_NAME} ━━")"
    # Measured before the bump: the bump rewrites package.json and app.json.
    STALE="$(native_stale)"
    ensure_signing "${auto_yes}"
    step_version "${auto_yes}" 0
    if ! step_native "${force_prebuild}"; then
      printf "\n  %s\n\n" "$(clr_bold_red "✗ ${SOME_FAILED}")"; exit 1
    fi
    if ! step_build release "${abis}"; then
      printf "\n  %s\n\n" "$(clr_bold_red "✗ ${SOME_FAILED}")"; exit 1
    fi
  fi

  printf "\n  %s\n\n" "$(clr_bold_cyan "── [${STEPS}/${STEPS}] ${STEP_INSTALL} ──")"
  local t
  for (( t = 0; t < ${#T_IDS[@]}; t++ )); do
    if install_one "${APK}" "${T_IDS[$t]}" "${T_LABELS[$t]}" "${pkg}" "${auto_yes}"; then
      RESULT_LINES+=("✅|${APP_NAME}|${T_LABELS[$t]}|${RESULT_OK}")
    else
      any_failed=1
      RESULT_LINES+=("❌|${APP_NAME}|${T_LABELS[$t]}|${RESULT_FAILED}")
    fi
    echo ""
  done

  # ── Summary ────────────────────────────────────────────────────────────────
  if [[ ${#RESULT_LINES[@]} -gt 1 ]]; then
    print_section "${RESULTS_TITLE}"
    local line mark app phone what
    for line in "${RESULT_LINES[@]}"; do
      IFS='|' read -r mark app phone what <<< "${line}"
      printf "  %s %s%s  %s\n" "${mark}" "${app}" "${phone:+ → ${phone}}" "$(clr_dim "${what}")"
    done
    echo ""
  fi
  if [[ ${any_failed} -eq 1 ]]; then
    printf "  %s\n\n" "$(clr_bold_red "✗ ${SOME_FAILED}")"; exit 1
  fi
  if [[ ${dev} -eq 1 ]]; then
    printf "  %s\n  %s\n\n" "$(clr_bold_green "✓ ${DEV_OK}")" "$(clr_cyan "${DEV_METRO}")"
    exit 0
  fi
  printf "  %s\n\n" "$(clr_bold_green "✓ ${ALL_DONE}")"
}

main "$@"
