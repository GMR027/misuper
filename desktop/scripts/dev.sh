#!/usr/bin/env bash
# Arranca Mi Súper en modo desarrollo (Vite + Tauri).
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="$HOME/.cargo/bin:$PATH"

SYS="$HOME/.local/share/tauri-sysroot"
if [ -f "$SYS/env.sh" ]; then
  # shellcheck disable=SC1090
  source "$SYS/env.sh"
elif [ -d "$SYS/usr/lib/x86_64-linux-gnu/pkgconfig" ]; then
  export PKG_CONFIG_PATH="$SYS/usr/lib/x86_64-linux-gnu/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
fi

exec npm run app
