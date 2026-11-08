#!/usr/bin/env bash
# ui.sh - the one terminal UI every interactive script in cli/ is built on.
#
# Sourced, never executed:
#
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   # shellcheck source=../lib/ui.sh
#   source "${SCRIPT_DIR}/../lib/ui.sh"
#
# It exists so that every script looks and behaves the same: the same colours,
# the same header box, the same ✓ / ✗ / ! / → status marks, and the same list
# widgets with the same keys. Change something here and every script follows;
# do not copy a widget back into a script.
#
# Portable to macOS's bash 3.2 (setup-dev-env runs there): no namerefs, no
# associative arrays, no ${var,,}, no fractional `read -t`, and no expansion of
# a possibly-empty array under `set -u`.
#
# ── The list widgets ─────────────────────────────────────────────────────────
#
#   ui_select   "item" ...   one choice          → UI_INDEX
#   ui_radio    "item" ...   one choice, (●)/(○) → UI_INDEX
#   ui_checkbox "item" ...   any number, [✓]/[ ] → UI_SELECTED=(indices)
#                                                  UI_FLAGS=(0|1 per item)
#   ui_reorder  "item" ...   drag rows into order → UI_ORDER=(original indices);
#                            returns 1 when cancelled (Esc / q)
#
# Optional inputs, read once and then cleared by every call:
#   UI_DEFAULT=<index>     row the cursor starts on (select / radio)
#   UI_CHECKED=(0|1 ...)   initial state of each checkbox
#   UI_DISABLED=(0|1 ...)  rows that cannot be toggled (checkbox) or picked
#                          (select / radio); a disabled + checked row is drawn
#                          as a locked green ✓, a disabled + unchecked one as [-]
#   UI_NOTES=("..." ...)   dim text drawn after a row's label
#   UI_DESCS=("..." ...)   a longer description, shown under the list for the
#                          highlighted row only
#   UI_GROUPS=("..." ...)  a group heading drawn above that item (empty for no
#                          heading), e.g. ("Apps" "" "" "Services" ""). The
#                          cursor skips headings, a / n never tick them, and every
#                          result (UI_INDEX, UI_SELECTED, UI_FLAGS) still counts
#                          only the items. Ignored by ui_reorder.
#   UI_BACK=1              Esc goes back: the list is replaced by a dim "← back"
#                          line and the call returns 1 (select / radio /
#                          checkbox). prompt_visible takes it too, but it runs
#                          inside $(...), so set it on the call itself:
#                          v="$(UI_BACK=1 prompt_visible "Name")" || go_back
#
# Keys (the hint line under every list says the same, in UI_LANG):
#   ↑ ↓ / k j        move (wraps around)      ← → / h l   change column
#   PgUp PgDn        page                     Home End    first / last
#   Enter            confirm                  Ctrl-C      quit the script
#   Space            toggle (checkbox)        a / n       all / none (checkbox)
#   Space            grab / drop (reorder)    Esc / q     cancel (reorder)
#   Esc              back (with UI_BACK=1)
#
# A list never overflows the terminal - which is what used to make its first or
# last rows unreachable on a short screen. When it is taller than the rows left
# (terminal height minus UI_RESERVE for the prompt above it) it is laid out in
# as many columns as the terminal is wide enough for, filled top-to-bottom; if
# even that does not fit, it becomes a single column that scrolls, with a dim
# "↑ 3 more · ↓ 12 more" line. The layout is recomputed on every key, so a
# resized terminal is picked up on the next keypress.
#
# Labels may carry colour (a status suffix, say); the highlighted row and any
# row that has to be truncated are drawn from the plain text instead.

# ── Colours ──────────────────────────────────────────────────────────────────
# NO_COLOR (https://no-color.org) or UI_NO_COLOR=1, set before sourcing, turns
# every colour off - a script's --no-color flag sets the latter.

if [[ -n "${NO_COLOR:-}" || "${UI_NO_COLOR:-0}" -eq 1 ]]; then
  RESET='' BOLD='' DIM='' RED='' GREEN='' YELLOW='' MAGENTA='' CYAN=''
else
  RESET='\033[0m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RED='\033[31m'
  GREEN='\033[32m'
  YELLOW='\033[33m'
  MAGENTA='\033[35m'
  CYAN='\033[36m'
fi

clr_red()          { printf "${RED}%s${RESET}" "$*"; }
clr_green()        { printf "${GREEN}%s${RESET}" "$*"; }
clr_yellow()       { printf "${YELLOW}%s${RESET}" "$*"; }
clr_magenta()      { printf "${MAGENTA}%s${RESET}" "$*"; }
clr_cyan()         { printf "${CYAN}%s${RESET}" "$*"; }
clr_bold()         { printf "${BOLD}%s${RESET}" "$*"; }
clr_dim()          { printf "${DIM}%s${RESET}" "$*"; }
clr_bold_red()     { printf "${BOLD}${RED}%s${RESET}" "$*"; }
clr_bold_green()   { printf "${BOLD}${GREEN}%s${RESET}" "$*"; }
clr_bold_yellow()  { printf "${BOLD}${YELLOW}%s${RESET}" "$*"; }
clr_bold_magenta() { printf "${BOLD}${MAGENTA}%s${RESET}" "$*"; }
clr_bold_cyan()    { printf "${BOLD}${CYAN}%s${RESET}" "$*"; }

# ── Status lines ─────────────────────────────────────────────────────────────

ok()   { printf "  %s %s\n" "$(clr_bold_green '✓')" "$*"; }
fail() { printf "  %s %s\n" "$(clr_bold_red '✗')" "$*"; }
warn() { printf "  %s %s\n" "$(clr_bold_yellow '!')" "$*"; }
step() { printf "  %s %s\n" "$(clr_bold_yellow '→')" "$*"; }
note() { printf "  %s\n" "$(clr_dim "$*")"; }

print_section() { printf "\n  %s\n\n" "$(clr_bold_cyan "── $1 ──")"; }

# Portable lower-case (bash 3.2 has no ${var,,}).
lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# typed_path <text> - a path typed or dragged into a prompt: surrounding
# blanks, quotes and escaped spaces off, ~ expanded, and a relative path
# resolved against where the command was run (pnpm keeps it in INIT_CWD).
typed_path() {
  local p="$1"
  p="${p#"${p%%[![:space:]]*}"}"; p="${p%"${p##*[![:space:]]}"}"
  if [[ "${p}" == \'*\' || "${p}" == \"*\" ]]; then p="${p:1:${#p}-2}"; fi
  p="${p//\\ / }"
  [[ "${p}" == "~" || "${p}" == "~/"* ]] && p="${HOME}${p#\~}"
  [[ -n "${p}" && "${p}" != /* ]] && p="${INIT_CWD:-${PWD}}/${p}"
  printf '%s' "${p}"
}

# pad_right <text> <width> - pad with spaces to <width> CHARACTERS. printf's
# %-Ns counts bytes, which mis-aligns every accented letter.
pad_right() {
  local s="$1" n="$2"
  if [[ ${#s} -ge ${n} ]]; then printf '%s' "${s}"; else printf '%s%*s' "${s}" "$(( n - ${#s} ))" ""; fi
}

# ── Language ─────────────────────────────────────────────────────────────────
# UI_LANG (en|es) picks the widgets' hint text and the y/n answers the confirm
# helpers accept. Scripts set it from their own language prompt.

UI_LANG="${UI_LANG:-en}"

# ui_pick_lang - the shared "en/es" question. Echoes only the answer, so it is
# safe as `lang="$(ui_pick_lang)"`; the question goes to the terminal.
# CLI_LANG=en|es answers it without asking: `pnpm menu` exports the language
# picked there, so a script started from the menu does not ask again.
ui_pick_lang() {
  case "${CLI_LANG:-}" in en|es) printf '%s' "${CLI_LANG}"; return ;; esac
  if [[ ! -r /dev/tty ]]; then printf 'en'; return; fi
  local raw="" lang="en"
  printf "  Select language / Selecciona idioma [en/es] (en): " >/dev/tty
  IFS= read -r raw </dev/tty || true
  [[ "$(lc "${raw}")" == es* ]] && lang="es"
  printf '%s' "${lang}"
}

_ui_t() {
  # _ui_t <key> - a widget string in UI_LANG.
  if [[ "${UI_LANG}" == "es" ]]; then
    case "$1" in
      move)    printf '↑↓ mover' ;;
      columns) printf '←→ columnas' ;;
      page)    printf 'RePág/AvPág página' ;;
      select)  printf 'Enter elegir' ;;
      toggle)  printf 'Espacio marcar' ;;
      all)     printf 'a todo' ;;
      none)    printf 'n nada' ;;
      confirm) printf 'Enter confirmar' ;;
      above)   printf 'más arriba' ;;
      below)   printf 'más abajo' ;;
      grab)    printf 'Espacio tomar/soltar' ;;
      save)    printf 'Enter guardar' ;;
      cancel)  printf 'Esc cancelar' ;;
      back)    printf 'Esc volver' ;;
      went_back) printf '← volver' ;;
      yes)     printf 's' ;;
      yes_re)  printf '^[sSyY]' ;;
      no_re)   printf '^[nN]' ;;
      enter)   printf 'Presiona Enter para continuar...' ;;
    esac
  else
    case "$1" in
      move)    printf '↑↓ move' ;;
      columns) printf '←→ columns' ;;
      page)    printf 'PgUp/PgDn page' ;;
      select)  printf 'Enter select' ;;
      toggle)  printf 'Space toggle' ;;
      all)     printf 'a all' ;;
      none)    printf 'n none' ;;
      confirm) printf 'Enter confirm' ;;
      above)   printf 'more above' ;;
      below)   printf 'more below' ;;
      grab)    printf 'Space grab/drop' ;;
      save)    printf 'Enter save' ;;
      cancel)  printf 'Esc cancel' ;;
      back)    printf 'Esc back' ;;
      went_back) printf '← back' ;;
      yes)     printf 'y' ;;
      yes_re)  printf '^[yY]' ;;
      no_re)   printf '^[nN]' ;;
      enter)   printf 'Press Enter to continue...' ;;
    esac
  fi
}

# ── Header ───────────────────────────────────────────────────────────────────
# print_header [title] [subtitle] [extra line...] - the boxed banner every
# script opens with. Defaults to $WELCOME / $SUBTITLE. The box grows to fit the
# longest line (54 columns minimum) but never past the terminal.

print_header() {
  local title="${1:-${WELCOME:-}}" subtitle="${2:-${SUBTITLE:-}}"
  local extras=()
  [[ $# -gt 2 ]] && extras=("${@:3}")

  local inner=54 len max_inner
  max_inner=$(( $(_ui_term_cols) - 6 ))
  [[ ${#title} -gt $(( inner - 2 )) ]] && inner=$(( ${#title} + 2 ))
  [[ ${#subtitle} -gt $(( inner - 2 )) ]] && inner=$(( ${#subtitle} + 2 ))
  local e
  if [[ ${#extras[@]} -gt 0 ]]; then
    for e in "${extras[@]}"; do
      len="$(_ui_visible_len "${e}")"
      [[ ${len} -gt $(( inner - 2 )) ]] && inner=$(( len + 2 ))
    done
  fi
  [[ ${max_inner} -ge 20 && ${inner} -gt ${max_inner} ]] && inner=${max_inner}
  local w=$(( inner - 2 ))

  local line
  line="$(printf '─%.0s' $(seq 1 "${inner}"))"
  echo ""
  echo "  $(clr_bold_cyan "┌${line}┐")"
  _ui_header_row "$(clr_bold "${title:0:${w}}")" "${title:0:${w}}" "${w}"
  [[ -n "${subtitle}" ]] && _ui_header_row "$(clr_dim "${subtitle:0:${w}}")" "${subtitle:0:${w}}" "${w}"
  if [[ ${#extras[@]} -gt 0 ]]; then
    for e in "${extras[@]}"; do
      _ui_header_row "${e}" "$(_ui_strip "${e}")" "${w}"
    done
  fi
  echo "  $(clr_bold_cyan "└${line}┘")"
  echo ""
}

_ui_header_row() {
  # _ui_header_row <styled> <plain> <width>
  local pad=$(( $3 - ${#2} ))
  [[ ${pad} -lt 0 ]] && pad=0
  printf "  %s  %s%*s%s\n" "$(clr_bold_cyan '│')" "$1" "${pad}" "" "$(clr_bold_cyan '│')"
}

# ── Prompts ──────────────────────────────────────────────────────────────────
# All of them read the terminal directly and print the answer on stdout, so
# they work inside $(...) and when stdin is a pipe.
#
# UI_ASSUME_YES=1 (a script's --yes flag) takes every default without asking:
# confirm_yes is true, confirm_no is false, pause_menu does not wait.

UI_ASSUME_YES="${UI_ASSUME_YES:-0}"
UI_BACK="${UI_BACK:-}"

# UI_NONINTERACTIVE=1 (a script run headless, e.g. `edit-media.sh --job`) makes
# every widget and prompt fail loudly instead of answering for itself: with no
# terminal a widget would take its default and a "type a path" prompt would be
# asked again forever. _ui_noninteractive prints the question and ends the
# script with status 2 - from inside $(...) too, where a plain exit would only
# leave the subshell. A script may define ui_on_question <text> to record it
# first (edit-media writes it to its events file).
UI_NONINTERACTIVE="${UI_NONINTERACTIVE:-0}"

_ui_noninteractive() {
  [[ "${UI_NONINTERACTIVE}" -eq 1 ]] || return 0
  local q; q="$(_ui_strip "${1:-?}")"
  if declare -F ui_on_question >/dev/null; then ui_on_question "${q}"; fi
  printf '  ✗ asked with no terminal to answer it: %s\n' "${q}" >&2
  # In a subshell, take the main shell down with it (its USR2 trap, if any,
  # turns this into exit 2; by default USR2 ends the process).
  [[ "${BASHPID}" != "$$" ]] && kill -USR2 "$$" 2>/dev/null
  exit 2
}

# prompt_visible <label> [default] - echo the answer, or the default. With
# UI_BACK=1 on the call, Esc returns 1 instead.
prompt_visible() {
  local label="$1" default="${2:-}" val back=""
  _ui_noninteractive "${label}"
  [[ "${UI_BACK:-}" == 1 ]] && back=" $(clr_dim "[$(_ui_t back)]")"
  if [[ -n "${default}" ]]; then
    printf "  %s (%s)%s: " "$(clr_bold "${label}")" "$(clr_dim "${default}")" "${back}" >/dev/tty
  else
    printf "  %s%s: " "$(clr_bold "${label}")" "${back}" >/dev/tty
  fi
  if [[ -n "${back}" ]]; then
    val="$(_ui_read_line)" || return 1
  else
    IFS= read -r val </dev/tty || true
  fi
  [[ -z "${val}" ]] && val="${default}"
  printf '%s' "${val}"
}

# _ui_read_line - a line typed at the terminal, read a key at a time so that a
# lone Esc can be told apart (it returns 1). Backspace, Ctrl-U and Ctrl-W edit
# the line; arrow keys and other escape sequences are ignored.
_ui_read_line() {
  local val="" k c
  _ui_noninteractive "(a line of text)"
  if ! { : </dev/tty; } 2>/dev/null; then return 0; fi
  while IFS= read -r -s -n1 k </dev/tty; do
    case "${k}" in
      $'\x1b')
        if IFS= read -r -s -n1 -t "${_UI_ESC_WAIT}" c </dev/tty 2>/dev/null; then
          # ESC [ ... <final byte>, or ESC O <x>: a key we do not edit with.
          if [[ "${c}" == '[' ]]; then
            while IFS= read -r -s -n1 -t "${_UI_ESC_WAIT}" c </dev/tty 2>/dev/null; do
              [[ "${c}" == [@-~] ]] && break
            done
          elif [[ "${c}" == 'O' ]]; then
            IFS= read -r -s -n1 -t "${_UI_ESC_WAIT}" c </dev/tty 2>/dev/null || true
          fi
          continue
        fi
        printf '\r\033[K  %s\n' "$(clr_dim "$(_ui_t went_back)")" >/dev/tty
        return 1 ;;
      ''|$'\n'|$'\r') break ;;
      $'\x7f'|$'\x08')
        [[ -n "${val}" ]] && { val="${val%?}"; printf '\b \b' >/dev/tty; } ;;
      $'\x15')
        while [[ -n "${val}" ]]; do val="${val%?}"; printf '\b \b' >/dev/tty; done ;;
      $'\x17')
        while [[ "${val}" == *' ' ]]; do val="${val%?}"; printf '\b \b' >/dev/tty; done
        while [[ -n "${val}" && "${val}" != *' ' ]]; do val="${val%?}"; printf '\b \b' >/dev/tty; done ;;
      $'\x03'|$'\x04') _ui_abort ;;
      [[:cntrl:]]) ;;
      *) val+="${k}"; printf '%s' "${k}" >/dev/tty ;;
    esac
  done
  printf '\n' >/dev/tty
  printf '%s' "${val}"
}

# prompt_secret <label> [hint] - like prompt_visible, without echoing what is
# typed. The optional hint is shown dim after the label.
prompt_secret() {
  local label="$1" hint="${2:-}" val
  _ui_noninteractive "${label}"
  if [[ -n "${hint}" ]]; then
    printf "  %s %s: " "$(clr_bold "${label}")" "$(clr_dim "${hint}")" >/dev/tty
  else
    printf "  %s: " "$(clr_bold "${label}")" >/dev/tty
  fi
  IFS= read -r -s val </dev/tty || true
  printf '\n' >/dev/tty
  printf '%s' "${val}"
}

# confirm_yes <question> [auto] - [Y/n]; true unless the answer is "no".
# auto=1 (a script's -y flag) answers yes without asking, but still shows it.
confirm_yes() {
  local answer
  if [[ "${2:-0}" -eq 1 || "${UI_ASSUME_YES}" -eq 1 ]]; then
    printf "  %s %s %s\n" "$1" "$(clr_dim '[Y/n]')" "$(_ui_t yes)"
    return 0
  fi
  _ui_noninteractive "$1"
  if [[ "${UI_LANG}" == "es" ]]; then
    printf "  %s %s " "$1" "$(clr_dim '[S/n]')" >/dev/tty
  else
    printf "  %s %s " "$1" "$(clr_dim '[Y/n]')" >/dev/tty
  fi
  IFS= read -r answer </dev/tty || true
  [[ ! "${answer}" =~ $(_ui_t no_re) ]]
}

# confirm_no <question> [auto] - [y/N]; true only when the answer is "yes".
# auto=1 answers yes without asking.
confirm_no() {
  local answer
  if [[ "${2:-0}" -eq 1 ]]; then
    printf "  %s %s %s\n" "$1" "$(clr_dim '[y/N]')" "$(_ui_t yes)"
    return 0
  fi
  [[ "${UI_ASSUME_YES}" -eq 1 ]] && return 1
  _ui_noninteractive "$1"
  if [[ "${UI_LANG}" == "es" ]]; then
    printf "  %s %s " "$1" "$(clr_dim '[s/N]')" >/dev/tty
  else
    printf "  %s %s " "$1" "$(clr_dim '[y/N]')" >/dev/tty
  fi
  IFS= read -r answer </dev/tty || true
  [[ "${answer}" =~ $(_ui_t yes_re) ]]
}

# confirm_exact <question> <expected> - a typed confirmation for destructive
# work: true only when the answer is exactly <expected>.
confirm_exact() {
  local answer
  _ui_noninteractive "$1"
  printf "  %s: " "$1" >/dev/tty
  IFS= read -r answer </dev/tty || true
  [[ "${answer}" == "$2" ]]
}

# pause_menu [message] - wait for Enter.
pause_menu() {
  [[ "${UI_ASSUME_YES}" -eq 1 || "${UI_NONINTERACTIVE}" -eq 1 ]] && return 0
  printf "\n  %s" "$(clr_dim "${1:-$(_ui_t enter)}")" >/dev/tty
  IFS= read -r _ </dev/tty || true
  echo ""
}

# ── Terminal helpers ─────────────────────────────────────────────────────────

_ui_term_size() {
  # Sets _UI_ROWS / _UI_COLS from the terminal itself (not stdout, which may be
  # a pipe); 24x80 when there is no terminal to ask.
  local size
  size="$(stty size 2>/dev/null </dev/tty || true)"
  _UI_ROWS="${size%% *}"
  _UI_COLS="${size##* }"
  [[ "${_UI_ROWS}" =~ ^[0-9]+$ && "${_UI_ROWS}" -gt 0 ]] || _UI_ROWS="${LINES:-24}"
  [[ "${_UI_COLS}" =~ ^[0-9]+$ && "${_UI_COLS}" -gt 0 ]] || _UI_COLS="${COLUMNS:-80}"
}

_ui_term_cols() { _ui_term_size; printf '%s' "${_UI_COLS}"; }

# _ui_strip <text> - the text without SGR colour sequences (pure bash, no fork).
_ui_strip() {
  local s="$1" out="" esc=$'\033'
  while [[ "${s}" == *"${esc}"* ]]; do
    out+="${s%%"${esc}"*}"
    s="${s#*"${esc}"}"
    s="${s#*m}"
  done
  printf '%s' "${out}${s}"
}

_ui_visible_len() { local p; p="$(_ui_strip "$1")"; printf '%s' "${#p}"; }

# How long to wait after an Esc for the rest of an arrow key's sequence. A
# terminal sends the sequence in one write, so a tenth of a second is plenty
# and a lone Esc answers at once; bash 3.2 has no fractional timeout.
if [[ ${BASH_VERSINFO[0]} -ge 4 ]]; then _UI_ESC_WAIT=0.1; else _UI_ESC_WAIT=1; fi

# _ui_read_key - one keypress from the terminal into _UI_KEY: up down left
# right pgup pgdn home end enter space esc abort other, or "char:<c>".
_ui_read_key() {
  local k s t c rest
  _UI_KEY="other"
  if ! IFS= read -r -s -n1 k </dev/tty 2>/dev/null; then _UI_KEY="enter"; return; fi
  case "${k}" in
    $'\x1b')
      IFS= read -r -s -n1 -t "${_UI_ESC_WAIT}" s </dev/tty 2>/dev/null || s=""
      if [[ -z "${s}" ]]; then _UI_KEY="esc"; return 0; fi
      [[ "${s}" == '[' || "${s}" == 'O' ]] || return 0
      IFS= read -r -s -n1 -t 1 t </dev/tty 2>/dev/null || t=""
      case "${t}" in
        A) _UI_KEY="up" ;;    B) _UI_KEY="down" ;;
        C) _UI_KEY="right" ;; D) _UI_KEY="left" ;;
        H) _UI_KEY="home" ;;  F) _UI_KEY="end" ;;
        [0-9])
          # ESC [ <n> ~  (PgUp 5, PgDn 6, Home 1/7, End 4/8)
          rest="${t}"
          while IFS= read -r -s -n1 -t 1 c </dev/tty 2>/dev/null; do
            [[ "${c}" == '~' ]] && break
            rest+="${c}"
            [[ ${#rest} -gt 4 ]] && break
          done
          case "${rest}" in
            1|7) _UI_KEY="home" ;; 4|8) _UI_KEY="end" ;;
            5) _UI_KEY="pgup" ;;   6) _UI_KEY="pgdn" ;;
          esac
          ;;
      esac
      ;;
    ''|$'\n'|$'\r') _UI_KEY="enter" ;;
    ' ')            _UI_KEY="space" ;;
    $'\x03'|$'\x04') _UI_KEY="abort" ;;
    k) _UI_KEY="up" ;;   j) _UI_KEY="down" ;;
    h) _UI_KEY="left" ;; l) _UI_KEY="right" ;;
    *) _UI_KEY="char:${k}" ;;
  esac
}

# ── List engine ──────────────────────────────────────────────────────────────
# Shared by the three widgets. State lives in _UI_* globals for the duration
# of one call (bash 3.2 has no namerefs to pass arrays around).

UI_RESERVE="${UI_RESERVE:-4}"   # rows kept free above a list for its prompt

_ui_abort() {
  printf '\033[?25h\n' >/dev/tty 2>/dev/null || true
  exit 130
}

# _ui_layout - decide single column / grid / scrolling for the current size.
# Sets _UI_NCOLS _UI_NROWS (rows per column) _UI_VIEW (rows drawn) _UI_COLW
# _UI_SCROLL (1 when the single column scrolls) _UI_LABW (label width).
_ui_layout() {
  _ui_term_size
  local n="${_UI_N}"
  local avail=$(( _UI_ROWS - UI_RESERVE - 2 - _UI_HAS_DESC ))   # scroll + hint (+ description) lines
  [[ ${avail} -lt 3 ]] && avail=3
  local cell_pre=$(( 2 + _UI_MARKW ))            # "▶ " + marker
  local usable=$(( _UI_COLS - 3 ))               # 2 indent + 1 spare column

  _UI_NCOLS=1; _UI_SCROLL=0
  _UI_LABW=$(( usable - cell_pre ))
  [[ ${_UI_LABW} -lt 8 ]] && _UI_LABW=8

  if [[ ${n} -le ${avail} ]]; then
    _UI_NROWS=${n}; _UI_VIEW=${n}; return
  fi

  # Rows being dragged into an order read top to bottom: never in columns.
  if [[ "${_UI_KIND}" == reorder ]]; then
    _UI_SCROLL=1; _UI_NROWS=${n}; _UI_VIEW=${avail}; return
  fi

  # Columns, if every label fits whole: the fewest columns that make it fit.
  local gap=3 colw=$(( cell_pre + _UI_MAXLEN + 3 ))
  local fit=$(( (usable + gap) / colw ))
  local need=$(( (n + avail - 1) / avail ))
  if [[ ${need} -ge 2 && ${fit} -ge ${need} ]]; then
    _UI_NCOLS=${need}
    _UI_NROWS=$(( (n + need - 1) / need ))
    _UI_VIEW=${_UI_NROWS}
    _UI_COLW=${colw}
    _UI_LABW=${_UI_MAXLEN}
    return
  fi

  # Otherwise one scrolling column.
  _UI_SCROLL=1; _UI_NROWS=${n}; _UI_VIEW=${avail}
}

_ui_scroll_into_view() {
  if [[ ${_UI_SCROLL} -eq 0 ]]; then _UI_TOP=0; return 0; fi
  if [[ ${_UI_CUR} -lt ${_UI_TOP} ]]; then
    _UI_TOP=${_UI_CUR}
    # Scrolling up onto a group's first item brings its heading back with it.
    while [[ ${_UI_TOP} -gt 0 && "${_UI_HEAD[$(( _UI_TOP - 1 ))]:-0}" -eq 1 ]]; do
      _UI_TOP=$(( _UI_TOP - 1 ))
    done
  fi
  [[ ${_UI_CUR} -ge $(( _UI_TOP + _UI_VIEW )) ]] && _UI_TOP=$(( _UI_CUR - _UI_VIEW + 1 ))
  [[ ${_UI_TOP} -gt $(( _UI_N - _UI_VIEW )) ]] && _UI_TOP=$(( _UI_N - _UI_VIEW ))
  [[ ${_UI_TOP} -lt 0 ]] && _UI_TOP=0
  return 0
}

# Raw escape sequences for the render path, which builds each frame in one
# string without a subshell per row (a $(clr_...) per cell made long lists lag).
if [[ -n "${RESET}" ]]; then
  _UI_R=$'\033[0m'; _UI_B=$'\033[1m'; _UI_D=$'\033[2m'
  _UI_CY=$'\033[36m'; _UI_BCY=$'\033[1m\033[36m'; _UI_BGR=$'\033[1m\033[32m'
  _UI_BYE=$'\033[1m\033[33m'
else
  _UI_R=''; _UI_B=''; _UI_D=''; _UI_CY=''; _UI_BCY=''; _UI_BGR=''; _UI_BYE=''
fi

# _ui_cell <index> <pad-to-width|0> - append one row's cell to _UI_OUT.
_ui_cell() {
  local i="$1" padw="$2"

  # A group heading: no cursor, no marker, just the title from the cursor column.
  if [[ "${_UI_HEAD[$i]:-0}" -eq 1 ]]; then
    local h="${_UI_PLAIN[$i]}" hw=$(( _UI_LABW + 2 + _UI_MARKW ))
    [[ ${#h} -gt ${hw} ]] && h="${h:0:$(( hw - 1 ))}…"
    _UI_OUT+="${_UI_B}${h}${_UI_R}"
    if [[ ${padw} -gt 0 && ${padw} -gt ${#h} ]]; then
      _UI_OUT+="$(printf '%*s' "$(( padw - ${#h} ))" "")"
    fi
    return 0
  fi

  local label="${_UI_ITEMS[$i]}" plain="${_UI_PLAIN[$i]}"
  local note="${_UI_NOTES[$i]:-}" dis="${_UI_DIS[$i]:-0}"
  local is_cur=0; [[ ${i} -eq ${_UI_CUR} ]] && is_cur=1

  if [[ ${is_cur} -eq 1 && ${_UI_GRAB} -eq 1 ]]; then _UI_OUT+="${_UI_BYE}✋${_UI_R}"
  elif [[ ${is_cur} -eq 1 ]]; then _UI_OUT+="${_UI_CY}▶${_UI_R} "
  else _UI_OUT+="  "; fi

  case "${_UI_KIND}" in
    checkbox)
      if [[ ${dis} -eq 1 && "${_UI_CHK[$i]:-0}" -eq 1 ]]; then _UI_OUT+="${_UI_BGR}[✓]${_UI_R} "
      elif [[ ${dis} -eq 1 ]];                              then _UI_OUT+="${_UI_D}[-]${_UI_R} "
      elif [[ "${_UI_CHK[$i]:-0}" -eq 1 ]];                 then _UI_OUT+="${_UI_BCY}[✓]${_UI_R} "
      else                                                       _UI_OUT+="${_UI_D}[ ]${_UI_R} "
      fi ;;
    radio)
      if [[ ${is_cur} -eq 1 ]]; then _UI_OUT+="${_UI_BCY}(●)${_UI_R} "; else _UI_OUT+="${_UI_D}(○)${_UI_R} "; fi ;;
  esac

  # The label (plus note) truncated to the cell's width.
  local full_plain="${plain}"
  [[ -n "${note}" ]] && full_plain="${plain} ${note}"
  local w="${_UI_LABW}" len
  if [[ ${#full_plain} -gt ${w} ]]; then
    local cut="${full_plain:0:$(( w - 1 ))}…"
    len=${w}
    if [[ ${is_cur} -eq 1 ]]; then _UI_OUT+="${_UI_BCY}${cut}${_UI_R}"
    elif [[ ${dis} -eq 1 ]];     then _UI_OUT+="${_UI_D}${cut}${_UI_R}"
    else                              _UI_OUT+="${cut}"
    fi
  else
    len=${#full_plain}
    if [[ ${is_cur} -eq 1 ]]; then _UI_OUT+="${_UI_BCY}${plain}${_UI_R}"
    elif [[ ${dis} -eq 1 ]];     then _UI_OUT+="${_UI_D}${plain}${_UI_R}"
    else                              _UI_OUT+="${label}${_UI_R}"
    fi
    [[ -n "${note}" ]] && _UI_OUT+=" ${_UI_D}${note}${_UI_R}"
  fi

  if [[ ${padw} -gt 0 ]]; then
    local pad=$(( padw - 2 - _UI_MARKW - len ))
    [[ ${pad} -gt 0 ]] && _UI_OUT+="$(printf '%*s' "${pad}" "")"
  fi
  return 0
}

_ui_hint() {
  local h
  h="$(_ui_t move)"
  [[ ${_UI_NCOLS} -gt 1 ]] && h+=" · $(_ui_t columns)"
  [[ ${_UI_SCROLL} -eq 1 ]] && h+=" · $(_ui_t page)"
  if [[ "${_UI_KIND}" == "checkbox" ]]; then
    h+=" · $(_ui_t toggle) · $(_ui_t all) · $(_ui_t none) · $(_ui_t confirm)"
  elif [[ "${_UI_KIND}" == "reorder" ]]; then
    h+=" · $(_ui_t grab) · $(_ui_t save) · $(_ui_t cancel)"
  else
    h+=" · $(_ui_t select)"
  fi
  [[ ${_UI_BACK} -eq 1 ]] && h+=" · $(_ui_t back)"
  local max=$(( _UI_COLS - 3 ))
  [[ ${#h} -gt ${max} ]] && h="${h:0:$(( max - 1 ))}…"
  printf '%s' "${h}"
}

# _ui_render [final] - redraw the whole block in place. "final" drops the
# hint/scroll lines, leaving just the list with the chosen row(s).
_ui_render() {
  local final="${1:-}"
  _ui_layout
  _ui_scroll_into_view

  local r c i lines=0
  _UI_OUT=""
  [[ ${_UI_DRAWN} -gt 0 ]] && _UI_OUT+=$'\033['"${_UI_DRAWN}A"
  _UI_OUT+=$'\r\033[J'

  if [[ ${_UI_NCOLS} -gt 1 ]]; then
    for (( r = 0; r < _UI_NROWS; r++ )); do
      _UI_OUT+="  "
      for (( c = 0; c < _UI_NCOLS; c++ )); do
        i=$(( c * _UI_NROWS + r ))
        [[ ${i} -ge ${_UI_N} ]] && break
        local padw=${_UI_COLW}
        [[ $(( (c + 1) * _UI_NROWS + r )) -ge ${_UI_N} ]] && padw=0
        _ui_cell "${i}" "${padw}"
      done
      _UI_OUT+=$'\n'; lines=$(( lines + 1 ))
    done
  else
    local end=$(( _UI_TOP + _UI_VIEW ))
    [[ ${end} -gt ${_UI_N} ]] && end=${_UI_N}
    for (( i = _UI_TOP; i < end; i++ )); do
      _UI_OUT+="  "; _ui_cell "${i}" 0; _UI_OUT+=$'\n'
      lines=$(( lines + 1 ))
    done
  fi

  if [[ -z "${final}" ]]; then
    if [[ ${_UI_SCROLL} -eq 1 ]]; then
      local above=${_UI_TOP} below=$(( _UI_N - _UI_TOP - _UI_VIEW )) parts=""
      [[ ${above} -gt 0 ]] && parts="↑ ${above} $(_ui_t above)"
      [[ ${below} -gt 0 ]] && parts="${parts:+${parts}  ·  }↓ ${below} $(_ui_t below)"
      _UI_OUT+="  ${_UI_D}${parts}${_UI_R}"$'\n'; lines=$(( lines + 1 ))
    fi
    if [[ ${_UI_HAS_DESC} -eq 1 ]]; then
      local desc="${_UI_DESCS[$_UI_CUR]:-}" dmax=$(( _UI_COLS - 5 ))
      [[ ${#desc} -gt ${dmax} ]] && desc="${desc:0:$(( dmax - 1 ))}…"
      _UI_OUT+="  ${_UI_CY}›${_UI_R} ${desc}"$'\n'; lines=$(( lines + 1 ))
    fi
    _UI_OUT+="  ${_UI_D}$(_ui_hint)${_UI_R}"$'\n'; lines=$(( lines + 1 ))
  fi

  printf '%s' "${_UI_OUT}" >/dev/tty
  _UI_DRAWN=${lines}
}

# _ui_off_heading <+1|-1> <wrap|clamp> - step the cursor off a group heading in
# the direction it was moving. ↑ ↓ wrap around the list; every other key stops
# at the edge and turns back (PgUp onto the first heading lands on its item).
_ui_off_heading() {
  local dir="$1" mode="$2" n=${_UI_N}
  [[ "${_UI_HEAD[$_UI_CUR]:-0}" -eq 1 ]] || return 0
  if [[ "${mode}" == wrap ]]; then
    while [[ "${_UI_HEAD[$_UI_CUR]:-0}" -eq 1 ]]; do _UI_CUR=$(( (_UI_CUR + dir + n) % n )); done
    return 0
  fi
  local c=${_UI_CUR}
  while [[ ${c} -ge 0 && ${c} -lt ${n} && "${_UI_HEAD[$c]:-0}" -eq 1 ]]; do c=$(( c + dir )); done
  if [[ ${c} -lt 0 || ${c} -ge ${n} ]]; then
    c=${_UI_CUR}
    while [[ "${_UI_HEAD[$c]:-0}" -eq 1 ]]; do c=$(( c - dir )); done
  fi
  _UI_CUR=${c}
}

# _ui_move <key> - move the cursor for a navigation key.
_ui_move() {
  local n=${_UI_N} rows=${_UI_NROWS} page dir=1 mode=clamp
  case "$1" in
    up)   _UI_CUR=$(( (_UI_CUR - 1 + n) % n )); dir=-1; mode=wrap ;;
    down) _UI_CUR=$(( (_UI_CUR + 1) % n )); mode=wrap ;;
    home) _UI_CUR=0 ;;
    end)  _UI_CUR=$(( n - 1 )); dir=-1 ;;
    pgup|pgdn)
      [[ "$1" == pgup ]] && dir=-1
      page=${_UI_VIEW}; [[ ${_UI_NCOLS} -gt 1 ]] && page=${rows}
      if [[ "$1" == pgup ]]; then _UI_CUR=$(( _UI_CUR - page )); else _UI_CUR=$(( _UI_CUR + page )); fi
      [[ ${_UI_CUR} -lt 0 ]] && _UI_CUR=0
      [[ ${_UI_CUR} -ge ${n} ]] && _UI_CUR=$(( n - 1 ))
      ;;
    right)
      [[ ${_UI_NCOLS} -gt 1 ]] || return 0
      if [[ $(( _UI_CUR + rows )) -lt ${n} ]]; then _UI_CUR=$(( _UI_CUR + rows ))
      else _UI_CUR=$(( _UI_CUR % rows )); fi
      ;;
    left)
      [[ ${_UI_NCOLS} -gt 1 ]] || return 0
      if [[ $(( _UI_CUR - rows )) -ge 0 ]]; then _UI_CUR=$(( _UI_CUR - rows ))
      else
        local r=$(( _UI_CUR % rows )) c=$(( _UI_NCOLS - 1 ))
        while [[ $(( c * rows + r )) -ge ${n} ]]; do c=$(( c - 1 )); done
        _UI_CUR=$(( c * rows + r ))
      fi
      ;;
  esac
  _ui_off_heading "${dir}" "${mode}"
  return 0
}

# _ui_run <kind> <item>... - the shared event loop.
_ui_run() {
  _UI_KIND="$1"; shift

  # Every UI_GROUPS heading becomes a row of its own (after a blank spacer row,
  # unless it opens the list) that the cursor never lands on. _UI_SRC maps each
  # row back to the caller's index, -1 for a heading, so results stay in the
  # caller's numbering; the per-row UI_* inputs are read through it below.
  local -a args=("$@")
  local i p g r=0
  _UI_ITEMS=(); _UI_SRC=(); _UI_HEAD=()
  for (( i = 0; i < ${#args[@]}; i++ )); do
    g=""; [[ "${_UI_KIND}" != reorder ]] && g="${UI_GROUPS[$i]:-}"
    if [[ -n "${g}" ]]; then
      if [[ ${r} -gt 0 ]]; then _UI_ITEMS[$r]=""; _UI_SRC[$r]=-1; _UI_HEAD[$r]=1; r=$(( r + 1 )); fi
      _UI_ITEMS[$r]="${g}"; _UI_SRC[$r]=-1; _UI_HEAD[$r]=1; r=$(( r + 1 ))
    fi
    _UI_ITEMS[$r]="${args[$i]}"; _UI_SRC[$r]=${i}; _UI_HEAD[$r]=0; r=$(( r + 1 ))
  done
  _UI_N=${r}
  _UI_PLAIN=(); _UI_CHK=(); _UI_DIS=(); _UI_NOTES=(); _UI_DESCS=(); _UI_HAS_DESC=0
  _UI_MAXLEN=1; _UI_TOP=0; _UI_DRAWN=0; _UI_CUR=0
  _UI_GRAB=0; _UI_CANCELLED=0; _UI_ORDER=()
  _UI_BACK=0
  [[ "${_UI_KIND}" != reorder && "${UI_BACK:-}" == 1 ]] && _UI_BACK=1

  case "${_UI_KIND}" in
    checkbox|radio) _UI_MARKW=4 ;;
    *)              _UI_MARKW=0 ;;
  esac

  local s
  for (( i = 0; i < _UI_N; i++ )); do
    p="$(_ui_strip "${_UI_ITEMS[$i]}")"
    _UI_PLAIN[$i]="${p}"
    s=${_UI_SRC[$i]}
    if [[ ${s} -lt 0 ]]; then
      _UI_CHK[$i]=0; _UI_DIS[$i]=1; _UI_NOTES[$i]=""; _UI_DESCS[$i]=""
      [[ ${#p} -gt ${_UI_MAXLEN} ]] && _UI_MAXLEN=${#p}
      continue
    fi
    _UI_ORDER[$i]=${s}
    _UI_CHK[$i]="${UI_CHECKED[$s]:-0}"
    _UI_DIS[$i]="${UI_DISABLED[$s]:-0}"
    _UI_NOTES[$i]="${UI_NOTES[$s]:-}"
    _UI_DESCS[$i]="${UI_DESCS[$s]:-}"
    [[ -n "${_UI_DESCS[$i]}" ]] && _UI_HAS_DESC=1
    [[ -n "${_UI_NOTES[$i]}" ]] && p+=" ${_UI_NOTES[$i]}"
    [[ ${#p} -gt ${_UI_MAXLEN} ]] && _UI_MAXLEN=${#p}
  done

  # Starting row: the default, else the first row that can be acted on.
  local picked=0
  if [[ "${UI_DEFAULT:-}" =~ ^[0-9]+$ ]]; then
    for (( i = 0; i < _UI_N; i++ )); do
      if [[ ${_UI_SRC[$i]} -eq ${UI_DEFAULT} ]]; then _UI_CUR=${i}; picked=1; break; fi
    done
  fi
  if [[ ${picked} -eq 0 ]]; then
    for (( i = 0; i < _UI_N; i++ )); do
      if [[ ${_UI_DIS[$i]} -eq 0 ]]; then
        if [[ "${_UI_KIND}" != checkbox || ${_UI_CHK[$i]} -eq 0 ]]; then _UI_CUR=${i}; picked=1; break; fi
      fi
    done
  fi
  # Nothing to act on at all: still never start on a heading.
  _ui_off_heading 1 clamp
  UI_DEFAULT=""; UI_CHECKED=(); UI_DISABLED=(); UI_NOTES=(); UI_DESCS=(); UI_GROUPS=(); UI_BACK=""

  # Headless (UI_NONINTERACTIVE): a question nobody can answer is an error.
  [[ "${UI_NONINTERACTIVE}" -eq 1 ]] && _ui_noninteractive "$(_ui_join_first3)"
  # No terminal (CI, a pipe): take the defaults rather than hang.
  if ! { : </dev/tty; } 2>/dev/null; then return 0; fi

  local prev_int
  prev_int="$(trap -p INT)"
  trap _ui_abort INT
  printf '\033[?25l' >/dev/tty

  _ui_render
  while true; do
    _ui_read_key
    if [[ "${_UI_KIND}" == reorder ]]; then
      case "${_UI_KEY}" in
        esc|char:q|char:Q) _UI_CANCELLED=1; break ;;
        space) _UI_GRAB=$(( 1 - _UI_GRAB )); _ui_render; continue ;;
        up|down)
          if [[ ${_UI_GRAB} -eq 1 ]]; then
            local to=$(( _UI_CUR - 1 )); [[ "${_UI_KEY}" == down ]] && to=$(( _UI_CUR + 1 ))
            [[ ${to} -lt 0 || ${to} -ge ${_UI_N} ]] && continue
            _ui_swap "${_UI_CUR}" "${to}"
            _UI_CUR=${to}; _ui_render; continue
          fi ;;
      esac
    fi
    case "${_UI_KEY}" in
      up|down|left|right|home|end|pgup|pgdn) _ui_move "${_UI_KEY}" ;;
      abort) _ui_abort ;;
      esc)
        [[ ${_UI_BACK} -eq 1 ]] || continue
        _UI_CANCELLED=1; break ;;
      enter)
        [[ "${_UI_KIND}" != checkbox && ${_UI_DIS[$_UI_CUR]} -eq 1 ]] && continue
        break ;;
      space)
        if [[ "${_UI_KIND}" == checkbox ]]; then
          [[ ${_UI_DIS[$_UI_CUR]} -eq 0 ]] && _UI_CHK[$_UI_CUR]=$(( 1 - _UI_CHK[$_UI_CUR] ))
        else
          continue
        fi ;;
      char:a|char:A)
        [[ "${_UI_KIND}" == checkbox ]] || continue
        for (( i = 0; i < _UI_N; i++ )); do [[ ${_UI_DIS[$i]} -eq 0 ]] && _UI_CHK[$i]=1; done ;;
      char:n|char:N)
        [[ "${_UI_KIND}" == checkbox ]] || continue
        for (( i = 0; i < _UI_N; i++ )); do [[ ${_UI_DIS[$i]} -eq 0 ]] && _UI_CHK[$i]=0; done ;;
      *) continue ;;
    esac
    _ui_render
  done

  _UI_GRAB=0
  if [[ ${_UI_BACK} -eq 1 && ${_UI_CANCELLED} -eq 1 ]]; then
    # Backing out: the list goes, so the question asked again below is not
    # read as an answer to this one.
    printf '%s\r\033[J  %s\n' "$([[ ${_UI_DRAWN} -gt 0 ]] && printf '\033[%dA' "${_UI_DRAWN}")" \
      "${_UI_D}$(_ui_t went_back)${_UI_R}" >/dev/tty
  else
    _ui_render final
  fi
  printf '\033[?25h\n' >/dev/tty
  if [[ -n "${prev_int}" ]]; then eval "${prev_int}"; else trap - INT; fi
  return 0
}

# _ui_join_first3 - the first rows of the list being run, for the headless
# guard's message (the question itself was printed above it).
_ui_join_first3() {
  local i out=""
  for (( i = 0; i < _UI_N && i < 3; i++ )); do out+="${out:+ / }${_UI_PLAIN[$i]}"; done
  [[ ${_UI_N} -gt 3 ]] && out+=" …"
  printf '%s' "${out}"
}

# _ui_swap <i> <j> - swap two rows (reorder), keeping every per-row array in step.
_ui_swap() {
  local a="$1" b="$2" t
  t="${_UI_ITEMS[$a]}"; _UI_ITEMS[$a]="${_UI_ITEMS[$b]}"; _UI_ITEMS[$b]="${t}"
  t="${_UI_PLAIN[$a]}"; _UI_PLAIN[$a]="${_UI_PLAIN[$b]}"; _UI_PLAIN[$b]="${t}"
  t="${_UI_NOTES[$a]}"; _UI_NOTES[$a]="${_UI_NOTES[$b]}"; _UI_NOTES[$b]="${t}"
  t="${_UI_DESCS[$a]}"; _UI_DESCS[$a]="${_UI_DESCS[$b]}"; _UI_DESCS[$b]="${t}"
  t="${_UI_ORDER[$a]}"; _UI_ORDER[$a]="${_UI_ORDER[$b]}"; _UI_ORDER[$b]="${t}"
}

# ── The widgets ──────────────────────────────────────────────────────────────

# _ui_went_back - did the list just run end on Esc with UI_BACK=1?
_ui_went_back() { [[ ${_UI_BACK} -eq 1 && ${_UI_CANCELLED} -eq 1 ]]; }

# ui_select <item>... → UI_INDEX (returns 1 on Esc with UI_BACK=1)
ui_select() {
  UI_INDEX=0
  [[ $# -eq 0 ]] && { UI_BACK=""; return 0; }
  _ui_run select "$@"
  UI_INDEX=${_UI_SRC[$_UI_CUR]}
  _ui_went_back && return 1
  return 0
}

# ui_radio <item>... → UI_INDEX. The (●) marks the current row; UI_DEFAULT is
# where it starts, so pass the current value there. Returns 1 on Esc with
# UI_BACK=1.
ui_radio() {
  UI_INDEX=0
  [[ $# -eq 0 ]] && { UI_BACK=""; return 0; }
  _ui_run radio "$@"
  UI_INDEX=${_UI_SRC[$_UI_CUR]}
  _ui_went_back && return 1
  return 0
}

# ui_reorder <item>... → UI_ORDER=(the original indices, in the new order).
# Space picks a row up (✋) and puts it down; while held, ↑↓ carry it. Returns
# 1, leaving UI_ORDER as it was, when cancelled with Esc or q.
ui_reorder() {
  UI_ORDER=()
  [[ $# -eq 0 ]] && return 0
  _ui_run reorder "$@"
  local i
  if [[ ${_UI_CANCELLED} -eq 1 ]]; then
    for (( i = 0; i < _UI_N; i++ )); do UI_ORDER[$i]=${i}; done
    return 1
  fi
  UI_ORDER=("${_UI_ORDER[@]}")
  return 0
}

# ui_checkbox <item>... → UI_SELECTED=(checked indices, in order) and
# UI_FLAGS=(0|1 for every item), whichever the caller finds handier. Locked
# rows (UI_DISABLED + UI_CHECKED) count as checked; unavailable ones never do.
# Returns 1 on Esc with UI_BACK=1 (UI_SELECTED / UI_FLAGS are then the ticks
# as they were left, which the caller normally ignores).
ui_checkbox() {
  UI_SELECTED=(); UI_FLAGS=()
  [[ $# -eq 0 ]] && { UI_BACK=""; return 0; }
  _ui_run checkbox "$@"
  local i s
  for (( i = 0; i < _UI_N; i++ )); do
    s=${_UI_SRC[$i]}
    [[ ${s} -lt 0 ]] && continue
    UI_FLAGS[$s]=${_UI_CHK[$i]}
    [[ ${_UI_CHK[$i]} -eq 1 ]] && UI_SELECTED+=("${s}")
  done
  _ui_went_back && return 1
  return 0
}
