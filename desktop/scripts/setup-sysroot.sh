#!/usr/bin/env bash
# Prepara las cabeceras de WebKitGTK que necesita Tauri sin usar sudo.
#
# En Zorin/Ubuntu lo normal es: sudo apt install libwebkit2gtk-4.1-dev ...
# Este script es el plan B para entornos donde no se puede usar sudo: descarga
# los .deb de desarrollo y los extrae en un sysroot del usuario.
set -euo pipefail

SYS="${HOME}/.local/share/tauri-sysroot"
DEBS="$(mktemp -d)"
trap 'rm -rf "$DEBS"' EXIT

echo "→ Descargando cabeceras de desarrollo…"
cd "$DEBS"
apt-get download \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev

echo "→ Extrayendo en $SYS…"
rm -rf "$SYS"
mkdir -p "$SYS"
for deb in ./*.deb; do
  dpkg-deb -x "$deb" "$SYS"
done

for pc in "$SYS"/usr/lib/x86_64-linux-gnu/pkgconfig/*.pc; do
  sed -i "s|^prefix=/usr$|prefix=$SYS/usr|" "$pc"
  # Las dependencias privadas (sysprof, libpsl, nghttp2…) no hacen falta para
  # enlazar contra la librería compartida del sistema y rompen pkg-config.
  sed -i '/^Requires\.private:/d' "$pc"
done

for lib in webkit2gtk-4.1 javascriptcoregtk-4.1 soup-3.0; do
  ln -sf "/usr/lib/x86_64-linux-gnu/lib${lib}.so.0" \
    "$SYS/usr/lib/x86_64-linux-gnu/lib${lib}.so"
done

cat > "$SYS/env.sh" <<EOF
export PKG_CONFIG_PATH="$SYS/usr/lib/x86_64-linux-gnu/pkgconfig\${PKG_CONFIG_PATH:+:\$PKG_CONFIG_PATH}"
EOF

echo "✓ Listo. Usa: source $SYS/env.sh"
echo "  pkg-config --modversion webkit2gtk-4.1"
