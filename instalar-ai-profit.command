#!/bin/bash
# Crea o actualiza el acceso de Escritorio "AI Profit".
# Apunta a "Abrir Granja.command" de esta carpeta y usa el icono
# assets/abrir-granja-icon.png (si falta, propfarm-logo.png).
# No abre TradingView y no envía órdenes. No hace falta Xcode.

fail() {
  echo ""
  echo "No se pudo instalar el acceso: $1"
  if [ -t 0 ]; then
    read -n 1 -r -p "Pulsa una tecla para cerrar."
    echo ""
  fi
  exit 1
}

SOURCE="$0"
if [ -n "${BASH_SOURCE:-}" ]; then
  SOURCE="${BASH_SOURCE[0]}"
fi
SCRIPT_DIR="$(cd "$(dirname "$SOURCE")" && pwd -P)" || fail "no pude leer la carpeta de este instalador."

if [ ! -f "$SCRIPT_DIR/tradinglink.mjs" ]; then
  FALLBACK="$HOME/Documents/Grok Bot/TradingLink"
  if [ -f "$FALLBACK/tradinglink.mjs" ] && [ -f "$FALLBACK/instalar-ai-profit.command" ]; then
    SCRIPT_DIR="$FALLBACK"
  else
    fail "no encuentro tradinglink.mjs junto a este instalador ($SCRIPT_DIR)."
  fi
fi

LAUNCHER="$SCRIPT_DIR/Abrir Granja.command"
[ -f "$LAUNCHER" ] || fail "falta Abrir Granja.command"
chmod +x "$LAUNCHER" "$SCRIPT_DIR/instalar-ai-profit.command" 2>/dev/null || true
if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$LAUNCHER" >/dev/null 2>&1 || true
fi

ICON_PNG=""
for candidate in \
  "$SCRIPT_DIR/assets/abrir-granja-icon.png" \
  "$SCRIPT_DIR/assets/ai-profit-icon.png" \
  "$SCRIPT_DIR/propfarm-logo.png" \
  "$SCRIPT_DIR/assets/propfarm-logo.png"
do
  if [ -f "$candidate" ]; then
    ICON_PNG="$candidate"
    break
  fi
done

ICON_ICNS="$SCRIPT_DIR/assets/abrir-granja-icon.icns"
mkdir -p "$SCRIPT_DIR/assets"

build_icns() {
  png="$1"
  out="$2"
  command -v sips >/dev/null 2>&1 || return 1
  command -v iconutil >/dev/null 2>&1 || return 1
  tmp="$(mktemp -d)"
  iconset="$tmp/AppIcon.iconset"
  mkdir -p "$iconset" || { rm -rf "$tmp"; return 1; }
  sips -z 16 16 "$png" --out "$iconset/icon_16x16.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 32 32 "$png" --out "$iconset/icon_16x16@2x.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 32 32 "$png" --out "$iconset/icon_32x32.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 64 64 "$png" --out "$iconset/icon_32x32@2x.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 128 128 "$png" --out "$iconset/icon_128x128.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 256 256 "$png" --out "$iconset/icon_128x128@2x.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 256 256 "$png" --out "$iconset/icon_256x256.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 512 512 "$png" --out "$iconset/icon_256x256@2x.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 512 512 "$png" --out "$iconset/icon_512x512.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  sips -z 1024 1024 "$png" --out "$iconset/icon_512x512@2x.png" >/dev/null || { rm -rf "$tmp"; return 1; }
  iconutil -c icns "$iconset" -o "$out" || { rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"
  return 0
}

if [ -n "$ICON_PNG" ]; then
  tmp_icns="$SCRIPT_DIR/assets/abrir-granja-icon.icns.tmp"
  if build_icns "$ICON_PNG" "$tmp_icns"; then
    mv -f "$tmp_icns" "$ICON_ICNS"
    echo "Icono actualizado: assets/abrir-granja-icon.icns"
  else
    rm -f "$tmp_icns"
    echo "No pude generar el .icns con sips/iconutil. Uso el que ya está en la carpeta, si existe."
  fi
fi

if command -v osascript >/dev/null 2>&1; then
  DESKTOP="$(osascript -e 'POSIX path of (path to desktop folder)' 2>/dev/null | tr -d '\r' | sed 's:/*$::')"
fi
if [ -z "${DESKTOP:-}" ] || [ ! -d "$DESKTOP" ]; then
  DESKTOP="$HOME/Desktop"
fi
mkdir -p "$DESKTOP" || fail "no puedo usar el Escritorio ($DESKTOP)."

APP="$DESKTOP/AI Profit.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" || fail "no pude crear $APP"

if [ -f "$ICON_ICNS" ]; then
  cp "$ICON_ICNS" "$APP/Contents/Resources/AppIcon.icns" || fail "no pude copiar el icono."
fi
if [ -n "$ICON_PNG" ]; then
  cp "$ICON_PNG" "$APP/Contents/Resources/abrir-granja-icon.png" || true
fi

cat >"$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>es</string>
  <key>CFBundleDisplayName</key>
  <string>AI Profit</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIdentifier</key>
  <string>com.aiprofitcamp.abrir-granja</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>AI Profit</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF
printf 'APPL????' >"$APP/Contents/PkgInfo"

LAUNCH_ESC=$(printf '%q' "$LAUNCHER")
cat >"$APP/Contents/MacOS/launcher" <<EOF
#!/bin/bash
# Acceso de Escritorio AI Profit. Abre el lanzador de la carpeta TradingLink.
# No envía órdenes.
open -- $LAUNCH_ESC
EOF
chmod +x "$APP/Contents/MacOS/launcher" || fail "no pude marcar el lanzador como ejecutable."
if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1 || true
fi

OLD_CMD="$DESKTOP/AI Profit.command"
if [ -f "$OLD_CMD" ] && grep -q "Abrir Granja.command" "$OLD_CMD" 2>/dev/null; then
  rm -f "$OLD_CMD"
fi

if [ -n "$ICON_PNG" ] && command -v osascript >/dev/null 2>&1; then
  osascript - "$ICON_PNG" "$APP" <<'APPLESCRIPT' >/dev/null 2>&1 || true
use framework "AppKit"
use scripting additions
on run argv
  set pngPath to item 1 of argv
  set appPath to item 2 of argv
  set img to current application's NSImage's alloc()'s initWithContentsOfFile:pngPath
  if img is missing value then error "sin imagen"
  set applied to current application's NSWorkspace's sharedWorkspace()'s setIcon:img forFile:appPath options:0
  if applied is false then error "no se pudo poner el icono"
end run
APPLESCRIPT
fi

touch "$APP"
echo ""
echo "Listo. En el Escritorio quedó el acceso AI Profit."
echo "Un doble clic abre TradingView (puerto 9222), el servidor y la Granja en Chrome."
echo "No envía órdenes."
echo "Carpeta: $SCRIPT_DIR"
if [ -n "$ICON_PNG" ]; then
  echo "Icono: $ICON_PNG"
fi
echo "Si mueves la carpeta de TradingLink, vuelve a ejecutar este instalador."
echo "Para cambiar el dibujo, sustituye assets/abrir-granja-icon.png y ejecútalo otra vez."
