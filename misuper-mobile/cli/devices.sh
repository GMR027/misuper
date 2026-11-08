#!/usr/bin/env bash
# devices.sh - the phones `pnpm android` installs on, saved under nicknames:
# the list, finding and connecting a phone, pairing a new one (Wi-Fi or USB)
# and the screen that lists, renames, re-pairs and deletes them.
#
# Sourced after ui.sh, never executed - by android.sh and by lineageos.sh (the
# phone a LineageOS install or update runs on). Call dev_setup_strings <en|es>
# and find_adb (ADB = the adb binary) before anything else here.
#
# The list lives outside git - it names this machine's phones - one line each in
# ANDROID_DEVICES_FILE (default ${XDG_CONFIG_HOME:-~/.config}/iguzman/android-devices):
#
#   <nick>|<mode>|<serial>|<addr>|<model>
#
#   wifi   Wireless debugging (Android 11+), paired once with its 6-digit code.
#          Its port changes every time Wireless debugging is switched on, so
#          the phone is found again by its serial in adb's mDNS list
#          (adb-<serial>-xxxxxx  _adb-tls-connect._tcp  <ip>:<port>); <addr> is
#          the last ip:port that answered, tried when mDNS finds nothing.
#   tcpip  Paired over USB, then `adb tcpip 5555`: reached at <addr>
#          (<ip>:5555) until the phone reboots and adbd goes back to USB -
#          re-pair it over USB then. The only Wi-Fi way on Android 10 and older.
#   usb    The cable only.
#
# <serial> is ro.serialno - the id USB lists the phone under and the name mDNS
# gives it - so a phone is recognised however it is connected right now, and
# an address that answers as some other phone is refused.
#
# Every `adb shell` reads stdin, so each call here takes </dev/null: inside a
# `while read` loop it would otherwise swallow the rest of the list.
#
# Portable to bash 3.2, like ui.sh.

DEVICES_FILE="${ANDROID_DEVICES_FILE:-${XDG_CONFIG_HOME:-${HOME}/.config}/misuper/android-devices}"

D_NICK=() D_MODE=() D_SERIAL=() D_ADDR=() D_MODEL=()
ADB_IDS=() ADB_STATES=() ADB_SERIALS=() ADB_MODELS=()
DEV_ID=""      # the adb -s id of the phone just found or connected
DEV_ERR=""     # why it was not
DEV_ADDED=""   # the nickname dev_add just saved

# ── Strings and adb ──────────────────────────────────────────────────────────

# dev_setup_strings <en|es> - the DV_* strings every screen here uses.
dev_setup_strings() {
  if [[ "$1" == "es" ]]; then
    DV_TITLE="Teléfonos"
    DV_EMPTY="Aún no hay teléfonos guardados."
    DV_ADD="Vincular un teléfono"
    DV_SAVE_CONNECTED="Guardar"
    DV_BACK="Volver"
    DV_CONNECT="Conectar ahora"
    DV_RENAME="Renombrar"
    DV_REPAIR="Volver a vincular"
    DV_DELETE="Eliminar"
    DV_DELETE_CONFIRM="¿Eliminar %s de la lista?"
    DV_DELETED="Eliminado."
    DV_UPDATED="Actualizado."
    DV_F_MODE="Conexión"
    DV_F_SERIAL="Serie"
    DV_F_ADDR="Dirección"
    DV_F_STATUS="Estado"
    DV_ONLINE="conectado"
    DV_OFFLINE="no conectado"
    DV_MODE_WIFI="Wi-Fi"
    DV_MODE_TCPIP="Wi-Fi (adb tcpip)"
    DV_MODE_USB="USB"
    DV_HOW_PROMPT="¿Cómo lo vinculas?"
    DV_HOW_WIFI="Wi-Fi - Depuración inalámbrica"
    DV_HOW_WIFI_DESC="Android 11 o más nuevo: un código de 6 dígitos, sin cable. Se vuelve a encontrar solo cada vez que activas la Depuración inalámbrica."
    DV_HOW_USB="USB"
    DV_HOW_USB_DESC="Conéctalo con un cable. Después eliges si se queda en USB o pasa a Wi-Fi con adb tcpip (la única forma inalámbrica en Android 10 o anterior)."
    DV_WIFI_TITLE="Vincular por Wi-Fi"
    DV_WIFI_STEP1="El teléfono y esta PC en la misma red Wi-Fi."
    DV_WIFI_STEP2="En el teléfono: Ajustes → Opciones de desarrollador → Depuración inalámbrica → actívala."
    DV_WIFI_STEP3="Toca \"Vincular dispositivo con código de vinculación\" y deja esa pantalla abierta."
    DV_WIFI_READY="Presiona Enter cuando veas el código en el teléfono..."
    DV_WIFI_FOUND="Encontrado en"
    DV_PAIR_ADDR_PROMPT="Dirección IP y puerto de vinculación (bajo el código)"
    DV_PAIR_CODE_PROMPT="Código de vinculación"
    DV_PAIR_FAILED="La vinculación falló - revisa el código y que la pantalla siga abierta."
    DV_PAIRED="Vinculado."
    DV_CONNECTING="Conectando..."
    DV_CONNECTED="Conectado"
    DV_ADDR_PROMPT="Dirección IP y puerto"
    DV_ADDR_HINT="En el teléfono: Depuración inalámbrica → la \"Dirección IP y puerto\" de arriba (no la de vinculación)."
    DV_IP_PROMPT="IP del teléfono en el Wi-Fi"
    DV_IP_HINT="En el teléfono: Ajustes → Acerca del teléfono → Estado → Dirección IP. Si se reinició, vuelve a vincularlo por USB."
    DV_USB_TITLE="Vincular por USB"
    DV_USB_STEP1="En el teléfono: Ajustes → Opciones de desarrollador → Depuración USB → actívala."
    DV_USB_STEP2="Conéctalo y acepta \"¿Permitir la depuración USB?\" (marca Permitir siempre)."
    DV_USB_NONE="Aún no hay ningún teléfono por USB."
    DV_USB_PICK="Elige el teléfono"
    DV_USB_ACCEPT="acepta el aviso en el teléfono"
    DV_LOOK_AGAIN="Buscar de nuevo"
    DV_USB_REACH_PROMPT="¿Cómo lo alcanzas después?"
    DV_USB_ONLY="Solo por cable USB"
    DV_USB_ONLY_DESC="Se instala solo mientras esté conectado."
    DV_USB_TCPIP="Wi-Fi con adb tcpip 5555"
    DV_USB_TCPIP_DESC="Ya puedes desconectarlo: se alcanza en <IP>:5555 hasta que el teléfono se reinicie; entonces vuelve a vincularlo por USB."
    DV_TCPIP_FAILED="No se pudo pasar el teléfono a Wi-Fi."
    DV_TCPIP_OK="Se alcanza en %s - ya puedes desconectarlo."
    DV_NICK_PROMPT="Apodo"
    DV_NICK_HINT="El nombre corto para -d, p. ej. pnpm android -d s24"
    DV_NICK_INVALID="Usa minúsculas, números, - o _ (y no \"devices\")."
    DV_NICK_TAKEN="Ya hay un teléfono llamado %s."
    DV_ALREADY_SAVED="Este teléfono ya estaba guardado como %s: se actualiza."
    DV_SAVED_AS="Guardado como"
    DV_ERR_ADDR="Escríbelo como IP:puerto, p. ej. 192.168.0.31:37099."
    DV_ERR_NO_ANSWER="Sin respuesta."
    DV_ERR_UNAUTHORIZED="El teléfono no respondió: desbloquéalo y acepta el aviso de depuración."
    DV_ERR_OTHER_PHONE="%s ahora es otro teléfono (%s)."
    DV_ERR_WIFI="No está en la red: ¿Depuración inalámbrica activa y el teléfono en este Wi-Fi?"
    DV_ERR_TCPIP="Sin respuesta en %s: si se reinició, conéctalo por USB y vuelve a vincularlo."
    DV_ERR_USB="No está conectado por USB (o falta aceptar la depuración USB)."
  else
    DV_TITLE="Phones"
    DV_EMPTY="No phones saved yet."
    DV_ADD="Pair a phone"
    DV_SAVE_CONNECTED="Save"
    DV_BACK="Back"
    DV_CONNECT="Connect now"
    DV_RENAME="Rename"
    DV_REPAIR="Pair again"
    DV_DELETE="Delete"
    DV_DELETE_CONFIRM="Delete %s from the list?"
    DV_DELETED="Deleted."
    DV_UPDATED="Updated."
    DV_F_MODE="Link"
    DV_F_SERIAL="Serial"
    DV_F_ADDR="Address"
    DV_F_STATUS="Status"
    DV_ONLINE="connected"
    DV_OFFLINE="not connected"
    DV_MODE_WIFI="Wi-Fi"
    DV_MODE_TCPIP="Wi-Fi (adb tcpip)"
    DV_MODE_USB="USB"
    DV_HOW_PROMPT="How do you pair it?"
    DV_HOW_WIFI="Wi-Fi - Wireless debugging"
    DV_HOW_WIFI_DESC="Android 11 or newer: a 6-digit code, no cable. Found again by itself every time you turn Wireless debugging on."
    DV_HOW_USB="USB"
    DV_HOW_USB_DESC="Plug it in. Then choose whether it stays on USB or moves to Wi-Fi with adb tcpip (the only wireless way on Android 10 and older)."
    DV_WIFI_TITLE="Pair over Wi-Fi"
    DV_WIFI_STEP1="The phone and this PC on the same Wi-Fi."
    DV_WIFI_STEP2="On the phone: Settings → Developer options → Wireless debugging → turn it on."
    DV_WIFI_STEP3="Tap \"Pair device with pairing code\" and keep that screen open."
    DV_WIFI_READY="Press Enter once the code is on the phone..."
    DV_WIFI_FOUND="Found at"
    DV_PAIR_ADDR_PROMPT="Pairing IP address & port (under the code)"
    DV_PAIR_CODE_PROMPT="Pairing code"
    DV_PAIR_FAILED="Pairing failed - check the code and that the screen is still open."
    DV_PAIRED="Paired."
    DV_CONNECTING="Connecting..."
    DV_CONNECTED="Connected"
    DV_ADDR_PROMPT="IP address & port"
    DV_ADDR_HINT="On the phone: Wireless debugging → the \"IP address & Port\" at the top (not the pairing one)."
    DV_IP_PROMPT="The phone's Wi-Fi IP"
    DV_IP_HINT="On the phone: Settings → About phone → Status → IP address. If it rebooted, pair it again over USB."
    DV_USB_TITLE="Pair over USB"
    DV_USB_STEP1="On the phone: Settings → Developer options → USB debugging → turn it on."
    DV_USB_STEP2="Plug it in and accept \"Allow USB debugging?\" (tick Always allow)."
    DV_USB_NONE="No phone on USB yet."
    DV_USB_PICK="Pick the phone"
    DV_USB_ACCEPT="accept the prompt on the phone"
    DV_LOOK_AGAIN="Look again"
    DV_USB_REACH_PROMPT="How will you reach it afterwards?"
    DV_USB_ONLY="USB cable only"
    DV_USB_ONLY_DESC="Installs only while it is plugged in."
    DV_USB_TCPIP="Wi-Fi with adb tcpip 5555"
    DV_USB_TCPIP_DESC="Unplug it afterwards: it is reached at <IP>:5555 until the phone reboots; pair it again over USB then."
    DV_TCPIP_FAILED="Could not switch the phone to Wi-Fi."
    DV_TCPIP_OK="Reached at %s - you can unplug it now."
    DV_NICK_PROMPT="Nickname"
    DV_NICK_HINT="The short name for -d, e.g. pnpm android -d s24"
    DV_NICK_INVALID="Use lowercase letters, digits, - or _ (and not \"devices\")."
    DV_NICK_TAKEN="A phone is already called %s."
    DV_ALREADY_SAVED="This phone was already saved as %s: updating it."
    DV_SAVED_AS="Saved as"
    DV_ERR_ADDR="Type it as IP:port, e.g. 192.168.0.31:37099."
    DV_ERR_NO_ANSWER="No answer."
    DV_ERR_UNAUTHORIZED="The phone did not answer: unlock it and accept the debugging prompt."
    DV_ERR_OTHER_PHONE="%s is another phone now (%s)."
    DV_ERR_WIFI="Not on the network: is Wireless debugging on and the phone on this Wi-Fi?"
    DV_ERR_TCPIP="No answer at %s: if it rebooted, plug it in and pair it again over USB."
    DV_ERR_USB="Not plugged in over USB (or USB debugging not accepted yet)."
  fi
}

# find_adb - ADB = the adb binary; also exports ANDROID_HOME when it was unset
# and the SDK is in its usual place, since Gradle needs it too.
find_adb() {
  local sdk
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    for sdk in "${HOME}/Android/Sdk" "${HOME}/Library/Android/sdk"; do
      [[ -d "${sdk}" ]] && { export ANDROID_HOME="${sdk}"; break; }
    done
  fi
  ADB="${ADB:-}"
  [[ -n "${ADB}" && -x "${ADB}" ]] && return 0
  if [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/platform-tools/adb" ]]; then
    ADB="${ANDROID_HOME}/platform-tools/adb"
  elif command -v adb >/dev/null 2>&1; then
    ADB="$(command -v adb)"
  else
    return 1
  fi
}

# ── The list ─────────────────────────────────────────────────────────────────

dev_load() {
  D_NICK=(); D_MODE=(); D_SERIAL=(); D_ADDR=(); D_MODEL=()
  [[ -f "${DEVICES_FILE}" ]] || return 0
  local nick mode serial addr model
  while IFS='|' read -r nick mode serial addr model || [[ -n "${nick}" ]]; do
    [[ -z "${nick}" || "${nick}" == \#* ]] && continue
    D_NICK+=("${nick}"); D_MODE+=("${mode}"); D_SERIAL+=("${serial}")
    D_ADDR+=("${addr}"); D_MODEL+=("${model}")
  done < "${DEVICES_FILE}"
}

dev_write() {
  mkdir -p "$(dirname "${DEVICES_FILE}")"
  local tmp="${DEVICES_FILE}.tmp.$$" i
  {
    printf '# pnpm android - saved phones: nick|mode(wifi|tcpip|usb)|serial|addr|model\n'
    for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
      printf '%s|%s|%s|%s|%s\n' "${D_NICK[$i]}" "${D_MODE[$i]}" "${D_SERIAL[$i]}" "${D_ADDR[$i]}" "${D_MODEL[$i]}"
    done
  } > "${tmp}"
  mv "${tmp}" "${DEVICES_FILE}"
}

# dev_index <nick> - its row in the list, in DEV_IDX; 1 when there is none.
dev_index() {
  local i
  DEV_IDX=""
  for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
    [[ "${D_NICK[$i]}" == "$1" ]] && { DEV_IDX=$i; return 0; }
  done
  return 1
}

# dev_put <nick> <mode> <serial> <addr> <model> - add it, or replace the phone
# saved under that nickname.
dev_put() {
  dev_load
  if dev_index "$1"; then
    D_MODE[DEV_IDX]="$2"; D_SERIAL[DEV_IDX]="$3"; D_ADDR[DEV_IDX]="$4"; D_MODEL[DEV_IDX]="$5"
  else
    D_NICK+=("$1"); D_MODE+=("$2"); D_SERIAL+=("$3"); D_ADDR+=("$4"); D_MODEL+=("$5")
  fi
  dev_write
}

dev_drop() {
  local drop="$1" i
  local -a n=() m=() s=() a=() o=()
  for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
    [[ $i -eq ${drop} ]] && continue
    n+=("${D_NICK[$i]}"); m+=("${D_MODE[$i]}"); s+=("${D_SERIAL[$i]}")
    a+=("${D_ADDR[$i]}"); o+=("${D_MODEL[$i]}")
  done
  D_NICK=("${n[@]+"${n[@]}"}"); D_MODE=("${m[@]+"${m[@]}"}"); D_SERIAL=("${s[@]+"${s[@]}"}")
  D_ADDR=("${a[@]+"${a[@]}"}"); D_MODEL=("${o[@]+"${o[@]}"}")
  dev_write
}

# dev_remember <idx> <addr> - the address that just answered, for next time.
dev_remember() {
  [[ "${D_ADDR[$1]}" == "$2" ]] && return 0
  D_ADDR[$1]="$2"
  dev_write
}

dev_mode_label() {
  case "$1" in
    wifi)  printf '%s' "${DV_MODE_WIFI}" ;;
    tcpip) printf '%s' "${DV_MODE_TCPIP}" ;;
    *)     printf '%s' "${DV_MODE_USB}" ;;
  esac
}

dev_valid_nick() { [[ "$1" =~ ^[a-z0-9][a-z0-9_-]*$ && "$1" != devices ]]; }

# ── adb ──────────────────────────────────────────────────────────────────────

# _adb <seconds> <args>... - adb with a time limit (a phone that dropped off
# Wi-Fi can hang a call for minutes).
_adb() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "${secs}" "${ADB}" "$@" </dev/null
  else
    "${ADB}" "$@" </dev/null
  fi
}

adb_prop() { _adb 8 -s "$1" shell getprop "$2" 2>/dev/null | tr -d '\r' || true; }

# _id_serial <adb id> - the serial an id carries: a USB id is the serial, an
# mDNS one is adb-<serial>-<suffix>[._adb-tls-connect._tcp], ip:port has none.
_id_serial() {
  local s="$1"
  case "${s}" in
    adb-*) s="${s%%._adb*}"; s="${s#adb-}"; printf '%s' "${s%-*}" ;;
    *:*)   ;;
    *)     printf '%s' "${s}" ;;
  esac
}

# adb_scan - what `adb devices` lists now, with each online phone's serial and
# model asked of the phone itself (an ip:port id says neither).
adb_scan() {
  ADB_IDS=(); ADB_STATES=(); ADB_SERIALS=(); ADB_MODELS=()
  local id state rest serial model
  while read -r id state rest; do
    [[ -z "${id}" || "${id}" == List || "${id}" == \** || -z "${state}" ]] && continue
    serial="" model=""
    if [[ "${state}" == device ]]; then
      serial="$(adb_prop "${id}" ro.serialno)"
      model="$(adb_prop "${id}" ro.product.model)"
    fi
    [[ -z "${serial}" ]] && serial="$(_id_serial "${id}")"
    if [[ -z "${model}" && "${rest}" =~ model:([^ ]+) ]]; then model="${BASH_REMATCH[1]//_/-}"; fi
    ADB_IDS+=("${id}"); ADB_STATES+=("${state}"); ADB_SERIALS+=("${serial}"); ADB_MODELS+=("${model}")
  done < <(_adb 10 devices -l 2>/dev/null || true)
}

# dev_find_online <serial> - DEV_ID = the online id of that phone, USB first
# (it installs fastest). Uses the last adb_scan.
dev_find_online() {
  local serial="$1" i
  DEV_ID=""
  [[ -z "${serial}" ]] && return 1
  for (( i = 0; i < ${#ADB_IDS[@]}; i++ )); do
    [[ "${ADB_STATES[$i]}" == device && "${ADB_SERIALS[$i]}" == "${serial}" ]] || continue
    if [[ "${ADB_IDS[$i]}" == "${serial}" ]]; then DEV_ID="${serial}"; return 0; fi
    [[ -z "${DEV_ID}" ]] && DEV_ID="${ADB_IDS[$i]}"
  done
  [[ -n "${DEV_ID}" ]]
}

# mdns_services <connect|pairing> [serial] - "<name>|<ip:port>" per Wireless
# debugging service adb sees on the network, only that phone's with a serial.
mdns_services() {
  _adb 10 mdns services 2>/dev/null \
    | awk -v t="_adb-tls-$1" -v s="${2:+adb-$2-}" \
        'index($2, t) == 1 && (s == "" || index($1, s) == 1) { print $1 "|" $3 }' \
    || true
}

# adb_try_connect <ip:port> [serial] - connect, wait for the phone to answer
# and, given a serial, make sure it is that phone. DEV_ID on success, DEV_ERR not.
adb_try_connect() {
  local addr="$1" serial="${2:-}" out state="" real n
  DEV_ID=""
  out="$(_adb 15 connect "${addr}" 2>&1 || true)"
  if [[ "${out}" != *"connected to"* ]]; then
    DEV_ERR="${out##*$'\n'}"
    [[ -z "${DEV_ERR}" ]] && DEV_ERR="${DV_ERR_NO_ANSWER}"
    return 1
  fi
  for (( n = 0; n < 20; n++ )); do
    state="$(_adb 3 -s "${addr}" get-state 2>/dev/null || true)"
    [[ "${state}" == device ]] && break
    sleep 0.5
  done
  if [[ "${state}" != device ]]; then
    DEV_ERR="${DV_ERR_UNAUTHORIZED}"
    return 1
  fi
  if [[ -n "${serial}" ]]; then
    real="$(adb_prop "${addr}" ro.serialno)"
    if [[ "${real}" != "${serial}" ]]; then
      _adb 5 disconnect "${addr}" >/dev/null 2>&1 || true
      # shellcheck disable=SC2059
      DEV_ERR="$(printf "${DV_ERR_OTHER_PHONE}" "${addr}" "${real:-?}")"
      return 1
    fi
  fi
  DEV_ID="${addr}"
}

# dev_connect <idx> <interactive 0|1> - reach a saved phone: already online
# (any way), else by mode - mDNS then the last address for Wi-Fi, the saved
# address for tcpip. Interactive, a Wi-Fi or tcpip phone that was not found
# asks for its address. DEV_ID on success, DEV_ERR not.
dev_connect() {
  local i="$1" interactive="$2"
  local mode="${D_MODE[$1]}" serial="${D_SERIAL[$1]}" addr="${D_ADDR[$1]}" line="" found="" n
  DEV_ERR=""
  adb_scan
  dev_find_online "${serial}" && return 0

  case "${mode}" in
    wifi)
      # adb's mDNS browser may need a moment after its server started.
      for (( n = 0; n < 3; n++ )); do
        line="$(mdns_services connect "${serial}" | sed -n 1p)"
        [[ -n "${line}" ]] && break
        sleep 1
      done
      found="${line#*|}"
      if [[ -n "${line}" ]] && adb_try_connect "${found}" "${serial}"; then
        dev_remember "${i}" "${found}"; return 0
      fi
      if [[ -n "${addr}" && "${addr}" != "${found}" ]] && adb_try_connect "${addr}" "${serial}"; then
        return 0
      fi
      DEV_ERR="${DV_ERR_WIFI}"
      ;;
    tcpip)
      if [[ -n "${addr}" ]] && adb_try_connect "${addr}" "${serial}"; then return 0; fi
      # shellcheck disable=SC2059
      DEV_ERR="$(printf "${DV_ERR_TCPIP}" "${addr:-?}")"
      ;;
    *)
      DEV_ERR="${DV_ERR_USB}"
      ;;
  esac

  [[ "${interactive}" -eq 1 && "${mode}" != usb ]] || return 1

  printf "  %s %s\n" "$(clr_bold_yellow '!')" "${DEV_ERR}"
  local label hint typed
  if [[ "${mode}" == wifi ]]; then label="${DV_ADDR_PROMPT}"; hint="${DV_ADDR_HINT}"
  else label="${DV_IP_PROMPT}"; hint="${DV_IP_HINT}"; fi
  printf "  %s\n\n" "$(clr_dim "${hint}")"
  while true; do
    typed="$(UI_BACK=1 prompt_visible "${label}")" || return 1
    typed="${typed// /}"
    [[ -z "${typed}" ]] && return 1
    [[ "${mode}" == tcpip && "${typed}" != *:* ]] && typed="${typed}:5555"
    if adb_try_connect "${typed}" "${serial}"; then
      dev_remember "${i}" "${typed}"; return 0
    fi
    printf "  %s %s\n" "$(clr_bold_red '✗')" "${DEV_ERR}"
  done
}

# dev_status <serial> - "● connected" / "○ not connected" from the last scan.
dev_status() {
  if dev_find_online "$1"; then printf '%s' "$(clr_green "● ${DV_ONLINE}")"
  else printf '%s' "$(clr_dim "○ ${DV_OFFLINE}")"; fi
}

# ── Pairing ──────────────────────────────────────────────────────────────────

# dev_add [nick] - pair a phone over Wi-Fi (the default) or USB and save it.
# With a nickname it re-pairs that phone, keeping its name. DEV_ADDED = the
# nickname saved; 1 when nothing was.
dev_add() {
  local preset="${1:-}"
  DEV_ADDED=""
  printf "  %s:\n\n" "$(clr_bold "${DV_HOW_PROMPT}")"
  UI_DESCS=("${DV_HOW_WIFI_DESC}" "${DV_HOW_USB_DESC}")
  UI_BACK=1 ui_radio "📶 ${DV_HOW_WIFI}" "🔌 ${DV_HOW_USB}" || return 1
  echo ""
  if [[ "${UI_INDEX}" -eq 0 ]]; then dev_pair_wifi "${preset}"; else dev_pair_usb "${preset}"; fi
}

dev_pair_wifi() {
  local preset="$1" pairs="" default="" addr code out guid serial="" n line found=""
  print_section "${DV_WIFI_TITLE}"
  printf "  1. %s\n  2. %s\n  3. %s\n\n" "${DV_WIFI_STEP1}" "${DV_WIFI_STEP2}" "${DV_WIFI_STEP3}"
  pause_menu "${DV_WIFI_READY}"
  echo ""

  for (( n = 0; n < 3; n++ )); do
    pairs="$(mdns_services pairing)"
    [[ -n "${pairs}" ]] && break
    sleep 1
  done
  if [[ -n "${pairs}" && "$(printf '%s\n' "${pairs}" | wc -l)" -eq 1 ]]; then
    default="${pairs#*|}"
    printf "  %s %s %s\n\n" "$(clr_bold_green '✓')" "${DV_WIFI_FOUND}" "$(clr_bold "${default}")"
  fi

  addr="$(UI_BACK=1 prompt_visible "${DV_PAIR_ADDR_PROMPT}" "${default}")" || return 1
  addr="${addr// /}"
  if [[ "${addr}" != *:* ]]; then
    printf "  %s %s\n" "$(clr_bold_red '✗')" "${DV_ERR_ADDR}"; return 1
  fi
  code="$(UI_BACK=1 prompt_visible "${DV_PAIR_CODE_PROMPT}")" || return 1
  code="${code// /}"
  [[ -z "${code}" ]] && return 1

  echo ""
  printf "  %s adb pair %s ******\n" "$(clr_bold_yellow '→')" "${addr}"
  out="$(_adb 30 pair "${addr}" "${code}" 2>&1 || true)"
  if [[ "${out}" != *"Successfully paired"* ]]; then
    printf "  %s %s\n" "$(clr_bold_red '✗')" "${DV_PAIR_FAILED}"
    printf '%s\n' "${out}" | tail -n 3 | sed 's/^/      /'
    return 1
  fi
  guid="$(printf '%s' "${out}" | sed -n 's/.*guid=\([^]]*\)].*/\1/p')"
  serial="$(_id_serial "${guid}")"
  printf "  %s %s\n" "$(clr_bold_green '✓')" "${DV_PAIRED}"

  # The connect service has another port than the pairing one; adb usually
  # connects to it by itself a moment after pairing.
  printf "  %s %s\n" "$(clr_bold_yellow '→')" "${DV_CONNECTING}"
  DEV_ID=""
  for (( n = 0; n < 10; n++ )); do
    adb_scan
    dev_find_online "${serial}" && break
    line="$(mdns_services connect "${serial}" | sed -n 1p)"
    if [[ -n "${line}" ]]; then
      found="${line#*|}"
      adb_try_connect "${found}" "${serial}" && break
    fi
    sleep 1
  done

  if [[ -z "${DEV_ID}" ]]; then
    printf "  %s %s\n" "$(clr_bold_yellow '!')" "${DV_ERR_WIFI}"
    printf "  %s\n\n" "$(clr_dim "${DV_ADDR_HINT}")"
    while [[ -z "${DEV_ID}" ]]; do
      found="$(UI_BACK=1 prompt_visible "${DV_ADDR_PROMPT}")" || return 1
      found="${found// /}"
      [[ -z "${found}" ]] && return 1
      adb_try_connect "${found}" "${serial}" || printf "  %s %s\n" "$(clr_bold_red '✗')" "${DEV_ERR}"
    done
  fi

  [[ "${DEV_ID}" == *:* && "${DEV_ID}" != adb-* ]] && found="${DEV_ID}"
  serial="$(adb_prop "${DEV_ID}" ro.serialno)"
  printf "  %s %s %s\n" "$(clr_bold_green '✓')" "${DV_CONNECTED}" "$(clr_dim "${DEV_ID}")"
  echo ""
  dev_save_new "${preset}" wifi "${serial}" "${found}" "$(adb_prop "${DEV_ID}" ro.product.model)"
}

dev_pair_usb() {
  local preset="$1" id="" i n
  print_section "${DV_USB_TITLE}"
  printf "  1. %s\n  2. %s\n\n" "${DV_USB_STEP1}" "${DV_USB_STEP2}"

  while [[ -z "${id}" ]]; do
    adb_scan
    local -a ids=() rows=() notes=() disabled=()
    for (( i = 0; i < ${#ADB_IDS[@]}; i++ )); do
      [[ "${ADB_IDS[$i]}" == *:* || "${ADB_IDS[$i]}" == adb-* ]] && continue
      ids+=("${ADB_IDS[$i]}")
      if [[ "${ADB_STATES[$i]}" == device ]]; then
        rows+=("${ADB_MODELS[$i]:-${ADB_IDS[$i]}}"); notes+=("${ADB_IDS[$i]}"); disabled+=(0)
      else
        rows+=("${ADB_IDS[$i]}"); notes+=("${ADB_STATES[$i]} - ${DV_USB_ACCEPT}"); disabled+=(1)
      fi
    done
    n=${#ids[@]}
    [[ ${n} -eq 0 ]] && printf "  %s\n\n" "$(clr_dim "${DV_USB_NONE}")"
    printf "  %s:\n\n" "$(clr_bold "${DV_USB_PICK}")"
    UI_NOTES=("${notes[@]+"${notes[@]}"}" "" "")
    UI_DISABLED=("${disabled[@]+"${disabled[@]}"}" 0 0)
    UI_BACK=1 ui_select "${rows[@]+"${rows[@]}"}" "🔄 ${DV_LOOK_AGAIN}" "🔙 ${DV_BACK}" || return 1
    echo ""
    if [[ "${UI_INDEX}" -lt ${n} ]]; then id="${ids[$UI_INDEX]}"
    elif [[ "${UI_INDEX}" -gt ${n} ]]; then return 1; fi
  done

  local serial model mode=usb addr=""
  serial="$(adb_prop "${id}" ro.serialno)"
  model="$(adb_prop "${id}" ro.product.model)"

  printf "  %s:\n\n" "$(clr_bold "${DV_USB_REACH_PROMPT}")"
  UI_DESCS=("${DV_USB_ONLY_DESC}" "${DV_USB_TCPIP_DESC}")
  UI_BACK=1 ui_radio "🔌 ${DV_USB_ONLY}" "📶 ${DV_USB_TCPIP}" || return 1
  echo ""

  if [[ "${UI_INDEX}" -eq 1 ]]; then
    local ip
    ip="$(_adb 8 -s "${id}" shell ip -f inet addr show wlan0 2>/dev/null \
      | awk '/inet / { sub(/\/.*/, "", $2); print $2; exit }' || true)"
    if [[ -z "${ip}" ]]; then
      ip="$(UI_BACK=1 prompt_visible "${DV_IP_PROMPT}")" || return 1
      ip="${ip// /}"; ip="${ip%:*}"
      [[ -z "${ip}" ]] && return 1
    fi
    printf "  %s adb -s %s tcpip 5555\n" "$(clr_bold_yellow '→')" "${id}"
    if ! _adb 15 -s "${id}" tcpip 5555 >/dev/null 2>&1; then
      printf "  %s %s\n" "$(clr_bold_red '✗')" "${DV_TCPIP_FAILED}"; return 1
    fi
    # adbd restarts to listen on the port; give it a few tries.
    for (( n = 0; n < 5; n++ )); do
      sleep 1
      adb_try_connect "${ip}:5555" "${serial}" && break
    done
    if [[ -z "${DEV_ID}" ]]; then
      printf "  %s %s %s\n" "$(clr_bold_red '✗')" "${DV_TCPIP_FAILED}" "$(clr_dim "${DEV_ERR}")"; return 1
    fi
    printf "  %s %s\n" "$(clr_bold_green '✓')" "$(printf "${DV_TCPIP_OK}" "${ip}:5555")"
    mode=tcpip; addr="${ip}:5555"
  fi
  echo ""
  dev_save_new "${preset}" "${mode}" "${serial}" "${addr}" "${model}"
}

# dev_save_new <nick|""> <mode> <serial> <addr> <model> - save a phone just
# paired: under the given nickname, under the one it is already saved as, or
# under a new one asked for.
dev_save_new() {
  local nick="$1" mode="$2" serial="$3" addr="$4" model="$5" i suggestion
  dev_load
  if [[ -z "${nick}" && -n "${serial}" ]]; then
    for (( i = 0; i < ${#D_NICK[@]}; i++ )); do
      if [[ "${D_SERIAL[$i]}" == "${serial}" ]]; then
        nick="${D_NICK[$i]}"
        printf "  %s\n" "$(clr_dim "$(printf "${DV_ALREADY_SAVED}" "${nick}")")"
        break
      fi
    done
  fi
  if [[ -z "${nick}" ]]; then
    suggestion="$(lc "${model}" | tr -c 'a-z0-9\n' '-' | sed 's/--*/-/g; s/^-//; s/-$//')"
    printf "  %s\n\n" "$(clr_dim "${DV_NICK_HINT}")"
    while true; do
      nick="$(UI_BACK=1 prompt_visible "${DV_NICK_PROMPT}" "${suggestion}")" || return 1
      nick="$(lc "${nick// /}")"
      if ! dev_valid_nick "${nick}"; then
        printf "  %s %s\n" "$(clr_bold_red '✗')" "${DV_NICK_INVALID}"; continue
      fi
      if dev_index "${nick}"; then
        printf "  %s %s\n" "$(clr_bold_red '✗')" "$(printf "${DV_NICK_TAKEN}" "${nick}")"; continue
      fi
      break
    done
  fi
  dev_put "${nick}" "${mode}" "${serial}" "${addr}" "${model}"
  DEV_ADDED="${nick}"
  printf "\n  %s %s %s %s\n" "$(clr_bold_green '✓')" "${DV_SAVED_AS}" "$(clr_bold "${nick}")" \
    "$(clr_dim "(${model} · $(dev_mode_label "${mode}"))")"
}

# ── The Phones screen ────────────────────────────────────────────────────────

devices_menu() {
  local cursor=0 i n u
  while true; do
    clear
    print_header
    print_section "${DV_TITLE}"
    printf "  %s\n\n" "$(clr_dim "${DEVICES_FILE}")"
    dev_load
    adb_scan
    adb_unsaved
    n=${#D_NICK[@]}
    u=${#U_IDX[@]}
    local -a rows=() notes=()
    local width=0
    for (( i = 0; i < n; i++ )); do
      [[ ${#D_NICK[$i]} -gt ${width} ]] && width=${#D_NICK[$i]}
    done
    for (( i = 0; i < n; i++ )); do
      rows+=("$(pad_right "${D_NICK[$i]}" "${width}")  ${D_MODEL[$i]}")
      notes+=("$(dev_mode_label "${D_MODE[$i]}") · $(dev_status "${D_SERIAL[$i]}")")
    done
    # A phone adb already talks to (paired before this list existed) is saved
    # as it is, with no new pairing code.
    for (( i = 0; i < u; i++ )); do
      rows+=("💾 ${DV_SAVE_CONNECTED} ${ADB_MODELS[${U_IDX[$i]}]:-${ADB_IDS[${U_IDX[$i]}]}}")
      notes+=("$(clr_green "● ${DV_ONLINE}") · ${ADB_IDS[${U_IDX[$i]}]}")
    done
    [[ ${n} -eq 0 ]] && printf "  %s\n\n" "$(clr_dim "${DV_EMPTY}")"
    UI_NOTES=("${notes[@]+"${notes[@]}"}" "" "")
    [[ ${cursor} -gt $(( n + u + 1 )) ]] && cursor=0
    UI_DEFAULT="${cursor}"
    UI_BACK=1 ui_select "${rows[@]+"${rows[@]}"}" "➕ ${DV_ADD}" "🔙 ${DV_BACK}" || return 0
    cursor="${UI_INDEX}"
    echo ""
    if [[ ${cursor} -lt ${n} ]]; then
      device_menu "${D_NICK[$cursor]}" || true
    elif [[ ${cursor} -lt $(( n + u )) ]]; then
      dev_save_connected "${U_IDX[$(( cursor - n ))]}" || true
      pause_menu
    elif [[ ${cursor} -eq $(( n + u )) ]]; then
      dev_add || true
      pause_menu
    else
      return 0
    fi
  done
}

# adb_unsaved - U_IDX = the rows of the last adb_scan that are online phones
# no saved entry has the serial of. Uses the last dev_load.
U_IDX=()
adb_unsaved() {
  local i j known
  U_IDX=()
  for (( j = 0; j < ${#ADB_IDS[@]}; j++ )); do
    [[ "${ADB_STATES[$j]}" == device ]] || continue
    known=0
    for (( i = 0; i < ${#D_SERIAL[@]}; i++ )); do
      [[ -n "${D_SERIAL[$i]}" && "${D_SERIAL[$i]}" == "${ADB_SERIALS[$j]}" ]] && known=1
    done
    [[ ${known} -eq 0 ]] && U_IDX+=("${j}")
  done
  return 0
}

# dev_save_connected <adb scan row> - save a phone adb is connected to now,
# its mode read from how: ip:5555 is adb tcpip, another ip:port or an mDNS
# name is Wireless debugging, anything else USB.
dev_save_connected() {
  local j="$1" id="${ADB_IDS[$1]}" mode addr=""
  case "${id}" in
    *:5555) mode=tcpip; addr="${id}" ;;
    adb-*)  mode=wifi ;;
    *:*)    mode=wifi; addr="${id}" ;;
    *)      mode=usb ;;
  esac
  dev_save_new "" "${mode}" "${ADB_SERIALS[$j]}" "${addr}" "${ADB_MODELS[$j]}"
}

device_menu() {
  local nick="$1" new prompt_text
  while true; do
    dev_load
    dev_index "${nick}" || return 0
    local i="${DEV_IDX}"
    adb_scan
    echo ""
    printf "  %s  %s\n" "$(clr_bold "${nick}")" "$(clr_dim "${D_MODEL[$i]}")"
    printf "  %-10s %s\n" "$(clr_dim "${DV_F_MODE}")" "$(dev_mode_label "${D_MODE[$i]}")"
    printf "  %-10s %s\n" "$(clr_dim "${DV_F_SERIAL}")" "${D_SERIAL[$i]:--}"
    [[ -n "${D_ADDR[$i]}" ]] && printf "  %-10s %s\n" "$(clr_dim "${DV_F_ADDR}")" "${D_ADDR[$i]}"
    printf "  %-10s %s\n\n" "$(clr_dim "${DV_F_STATUS}")" "$(dev_status "${D_SERIAL[$i]}")"

    UI_BACK=1 ui_select "🔌 ${DV_CONNECT}" "✏️  ${DV_RENAME}" "🔄 ${DV_REPAIR}" "🗑️  ${DV_DELETE}" "🔙 ${DV_BACK}" || return 0
    local choice="${UI_INDEX}"
    echo ""
    case "${choice}" in
      0)
        if dev_connect "${i}" 1; then
          printf "  %s %s %s\n" "$(clr_bold_green '✓')" "${DV_CONNECTED}" "$(clr_dim "${DEV_ID}")"
        else
          printf "  %s %s\n" "$(clr_bold_red '✗')" "${DEV_ERR}"
        fi
        ;;
      1)
        new="$(UI_BACK=1 prompt_visible "${DV_NICK_PROMPT}" "${nick}")" || continue
        new="$(lc "${new// /}")"
        if ! dev_valid_nick "${new}"; then
          printf "  %s %s\n" "$(clr_bold_red '✗')" "${DV_NICK_INVALID}"
        elif [[ "${new}" != "${nick}" ]] && dev_index "${new}"; then
          printf "  %s %s\n" "$(clr_bold_red '✗')" "$(printf "${DV_NICK_TAKEN}" "${new}")"
        else
          D_NICK[i]="${new}"; dev_write; nick="${new}"
          printf "  %s %s\n" "$(clr_bold_green '✓')" "${DV_UPDATED}"
        fi
        ;;
      2)
        dev_add "${nick}" || true
        ;;
      3)
        printf -v prompt_text "${DV_DELETE_CONFIRM}" "${nick}"
        if confirm_no "${prompt_text}"; then
          [[ -n "${D_ADDR[$i]}" ]] && _adb 5 disconnect "${D_ADDR[$i]}" >/dev/null 2>&1 || true
          dev_drop "${i}"
          printf "\n  %s %s\n" "$(clr_bold_green '✓')" "${DV_DELETED}"
          pause_menu
          return 0
        fi
        printf "\n  %s\n" "$(clr_dim "${CANCELLED}")"
        ;;
      *)
        return 0
        ;;
    esac
    pause_menu
  done
}
