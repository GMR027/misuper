#!/usr/bin/env bash
# release-key.sh - creates Mi Súper's release signing key, once.
#
# The key lives outside the repo, so `expo prebuild --clean` and git never
# touch it:
#
#   keystore    ~/.android/misuper-mobile-release.jks
#   alias       misuper-mobile
#   properties  ~/.gradle/gradle.properties (MISUPER_MOBILE_RELEASE_*)
#
# Back the keystore up somewhere safe: every future update of the app must be
# signed with it. Losing it means uninstalling the app on every phone before a
# new build can be installed.
#
# Usage:
#   bash cli/release-key.sh          create it when missing (idempotent)
#   bash cli/release-key.sh --print  show the properties' values
#
# `pnpm android` calls this by itself when the key is missing.

set -euo pipefail

KEYSTORE="${MISUPER_MOBILE_RELEASE_STORE_FILE:-${HOME}/.android/misuper-mobile-release.jks}"
ALIAS="${MISUPER_MOBILE_RELEASE_KEY_ALIAS:-misuper-mobile}"
PROPS="${HOME}/.gradle/gradle.properties"

PROP_STORE_FILE="MISUPER_MOBILE_RELEASE_STORE_FILE"
PROP_STORE_PASSWORD="MISUPER_MOBILE_RELEASE_STORE_PASSWORD"
PROP_KEY_ALIAS="MISUPER_MOBILE_RELEASE_KEY_ALIAS"
PROP_KEY_PASSWORD="MISUPER_MOBILE_RELEASE_KEY_PASSWORD"

lang="es"
case "${LANG:-}" in en*) lang="en" ;; esac
print_only=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang) [[ "${2:-}" == en || "${2:-}" == es ]] && lang="$2"; shift ;;
    --print) print_only=1 ;;
  esac
  shift
done

say() {
  if [[ "${lang}" == "es" ]]; then printf '  %s\n' "$1"; else printf '  %s\n' "$2"; fi
}
die() { say "✗ $1" "✗ $2" >&2; exit 1; }

prop_get() {
  [[ -f "${PROPS}" ]] || return 0
  sed -n "s/^$1=//p" "${PROPS}" | sed -n 1p
}

prop_put() {
  local key="$1" value="$2" tmp
  mkdir -p "$(dirname "${PROPS}")"
  touch "${PROPS}"
  chmod 600 "${PROPS}"
  tmp="${PROPS}.tmp.$$"
  { grep -v "^${key}=" "${PROPS}" || true; printf '%s=%s\n' "${key}" "${value}"; } > "${tmp}"
  mv "${tmp}" "${PROPS}"
  chmod 600 "${PROPS}"
}

print_values() {
  printf '\n'
  say "Clave de firma" "Signing key"
  printf '  %-28s %s\n' "keystore" "${KEYSTORE}"
  printf '  %-28s %s\n' "alias" "${ALIAS}"
  printf '  %-28s %s\n' "${PROP_STORE_PASSWORD}" "$(prop_get "${PROP_STORE_PASSWORD}")"
  printf '  %-28s %s\n' "${PROP_KEY_PASSWORD}" "$(prop_get "${PROP_KEY_PASSWORD}")"
  printf '\n'
  say "Guarda el .jks y estas contraseñas: sin ellos no podrás actualizar la app." \
      "Keep the .jks and these passwords: without them the app cannot be updated."
  printf '\n'
}

if [[ "${print_only}" -eq 1 ]]; then
  print_values
  exit 0
fi

if ! command -v keytool >/dev/null 2>&1; then
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/keytool" ]]; then
    PATH="${JAVA_HOME}/bin:${PATH}"
  else
    die "No se encontró keytool: instala un JDK 17." \
        "keytool was not found: install a JDK 17."
  fi
fi

saved_store="$(prop_get "${PROP_STORE_FILE}")"
saved_pass="$(prop_get "${PROP_STORE_PASSWORD}")"
saved_alias="$(prop_get "${PROP_KEY_ALIAS}")"
saved_key_pass="$(prop_get "${PROP_KEY_PASSWORD}")"

if [[ -n "${saved_store}" || -f "${KEYSTORE}" ]]; then
  # Already set up: check that the pieces agree, never overwrite a key.
  [[ -z "${saved_store}" ]] && saved_store="${KEYSTORE}"
  if [[ ! -f "${saved_store}" ]]; then
    die "gradle.properties nombra ${saved_store}, que no existe. Restaura el .jks desde tu respaldo o borra las propiedades MISUPER_MOBILE_RELEASE_* para crear una clave nueva (las apps instaladas habrá que desinstalarlas)." \
        "gradle.properties names ${saved_store}, which does not exist. Restore the .jks from your backup, or delete the MISUPER_MOBILE_RELEASE_* properties to create a new key (installed apps will need an uninstall)."
  fi
  if [[ -z "${saved_pass}" || -z "${saved_key_pass}" ]]; then
    die "Faltan las contraseñas en ${PROPS}: restaura MISUPER_MOBILE_RELEASE_STORE_PASSWORD y _KEY_PASSWORD desde tu respaldo." \
        "The passwords are missing from ${PROPS}: restore MISUPER_MOBILE_RELEASE_STORE_PASSWORD and _KEY_PASSWORD from your backup."
  fi
  if ! keytool -list -keystore "${saved_store}" -storepass "${saved_pass}" -alias "${saved_alias:-${ALIAS}}" >/dev/null 2>&1; then
    die "La clave o las contraseñas de ${saved_store} no coinciden." \
        "The key or passwords for ${saved_store} do not match."
  fi
  prop_put "${PROP_STORE_FILE}" "${saved_store}"
  prop_put "${PROP_KEY_ALIAS}" "${saved_alias:-${ALIAS}}"
  say "✓ La clave de firma ya existe: ${saved_store}" \
      "✓ The signing key already exists: ${saved_store}"
  print_values
  exit 0
fi

password="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
mkdir -p "$(dirname "${KEYSTORE}")" "$(dirname "${PROPS}")"

keytool -genkeypair \
  -keystore "${KEYSTORE}" \
  -alias "${ALIAS}" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "${password}" -keypass "${password}" \
  -dname "CN=Mi Super, OU=Mobile, O=Mi Super, L=Mexico, ST=Mexico, C=MX" >/dev/null 2>&1

chmod 600 "${KEYSTORE}"
prop_put "${PROP_STORE_FILE}" "${KEYSTORE}"
prop_put "${PROP_STORE_PASSWORD}" "${password}"
prop_put "${PROP_KEY_ALIAS}" "${ALIAS}"
prop_put "${PROP_KEY_PASSWORD}" "${password}"

say "✓ Clave de firma creada." "✓ Signing key created."
print_values
say "SHA-256 (huella del certificado):" "SHA-256 (certificate fingerprint):"
keytool -list -v -keystore "${KEYSTORE}" -storepass "${password}" -alias "${ALIAS}" \
  | sed -n 's/^[[:space:]]*SHA256: /  /p' || true
printf '\n'
