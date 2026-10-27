#!/bin/zsh
# Crea en el Escritorio el applet "AI Profit.app".
# osacompile deja un ejecutable universal (arm64 + x86_64). No es un script
# de shell dentro del bundle, así que en Apple Silicon no pide Rosetta.
# El applet solo abre "acceso/AI Profit.command" (ahí está el arranque).
# El dibujo es assets/abrir-granja-icon.icns (applet.icns y AppIcon.icns)
# y NSWorkspace lo confirma con el PNG.
# No abre herramientas de desarrollador. No abre TradingView ni envía órdenes.

fail() {
  echo ""
  echo "No se pudo instalar el acceso: $1"
  if [[ -t 0 ]]; then
    read -k 1 "?Pulsa una tecla para cerrar."
    echo ""
  fi
  exit 1
}

SCRIPT_DIR="${0:A:h}"
if [[ ! -f "$SCRIPT_DIR/motor/tradinglink.mjs" ]]; then
  FALLBACK="$HOME/Documents/Grok Bot/TradingLink"
  if [[ -f "$FALLBACK/motor/tradinglink.mjs" && -f "$FALLBACK/instalar-ai-profit.command" ]]; then
    SCRIPT_DIR="$FALLBACK"
  else
    fail "no encuentro motor/tradinglink.mjs junto a este instalador ($SCRIPT_DIR)."
  fi
fi

LAUNCHER="$SCRIPT_DIR/acceso/AI Profit.command"
[[ -f "$LAUNCHER" ]] || fail "falta acceso/AI Profit.command"
[[ -f "$SCRIPT_DIR/assets/abrir-granja-icon.icns" ]] || fail "falta assets/abrir-granja-icon.icns"
command -v osacompile >/dev/null 2>&1 || fail "no encuentro osacompile. Viene con macOS; no hace falta Xcode."
command -v plutil >/dev/null 2>&1 || fail "no encuentro plutil."
command -v osascript >/dev/null 2>&1 || fail "no encuentro osascript."

chmod +x "$LAUNCHER" "$SCRIPT_DIR/instalar-ai-profit.command" "$SCRIPT_DIR/acceso/Abrir Granja.command" 2>/dev/null || true
if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$LAUNCHER" >/dev/null 2>&1 || true
  xattr -d com.apple.quarantine "$SCRIPT_DIR/instalar-ai-profit.command" >/dev/null 2>&1 || true
fi

DESKTOP=""
DESKTOP="$(osascript -e 'POSIX path of (path to desktop folder)' 2>/dev/null | tr -d '\r')"
DESKTOP="${DESKTOP%/}"
if [[ -z "$DESKTOP" || ! -d "$DESKTOP" ]]; then
  DESKTOP="$HOME/Desktop"
fi
mkdir -p "$DESKTOP" || fail "no puedo usar el Escritorio ($DESKTOP)."

# El enlace o la copia .command del instalador anterior no muestra el dibujo.
OLD_CMD="$DESKTOP/AI Profit.command"
if [[ -L "$OLD_CMD" || -f "$OLD_CMD" ]]; then
  rm -f "$OLD_CMD"
  echo "Quité AI Profit.command del Escritorio (Finder lo dejaba con el icono genérico de terminal)."
fi

APP="$DESKTOP/AI Profit.app"
rm -rf "$APP"

# AppleScript: quoted form of protege espacios. El texto va entre comillas de AppleScript.
launcher_as="${LAUNCHER//\\/\\\\}"
launcher_as="${launcher_as//\"/\\\"}"
src="$(mktemp "${TMPDIR:-/tmp}/ai-profit-applet.XXXXXX")"
cat >"$src" <<EOF
-- Generado por instalar-ai-profit.command. No envía órdenes.
on run
  do shell script "open " & quoted form of "$launcher_as"
end run
EOF

osacompile -o "$APP" "$src" || { rm -f "$src"; fail "osacompile no pudo crear AI Profit.app"; }
rm -f "$src"

[[ -d "$APP/Contents/Resources" ]] || fail "el applet no tiene Contents/Resources."
[[ -f "$APP/Contents/MacOS/applet" ]] || fail "el applet no tiene el ejecutable universal Contents/MacOS/applet."

cp "$SCRIPT_DIR/assets/abrir-granja-icon.icns" "$APP/Contents/Resources/applet.icns" || fail "no pude copiar applet.icns"
cp "$SCRIPT_DIR/assets/abrir-granja-icon.icns" "$APP/Contents/Resources/AppIcon.icns" || fail "no pude copiar AppIcon.icns"

plist="$APP/Contents/Info.plist"
plutil -replace CFBundleName -string "AI Profit" "$plist" 2>/dev/null || plutil -insert CFBundleName -string "AI Profit" "$plist" || fail "no pude poner el nombre del applet"
plutil -replace CFBundleDisplayName -string "AI Profit" "$plist" 2>/dev/null || plutil -insert CFBundleDisplayName -string "AI Profit" "$plist" || fail "no pude poner CFBundleDisplayName"
plutil -replace CFBundleIconFile -string "applet" "$plist" 2>/dev/null || plutil -insert CFBundleIconFile -string "applet" "$plist" || true

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP" >/dev/null 2>&1 || true
fi

PNG="$SCRIPT_DIR/assets/abrir-granja-icon.png"
set_icon() {
  local result
  result="$(osascript -l JavaScript - "$1" "$2" <<'JS'
function run(argv) {
  ObjC.import("AppKit");
  var image = $.NSImage.alloc.initWithContentsOfFile($(argv[0]));
  if (!image || image.isNil()) return "sin-imagen";
  var ok = $.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, $(argv[1]), 0);
  return ok ? "ok" : "fallo";
}
JS
)" || return 1
  [[ "$result" == "ok" ]]
}

echo ""
if [[ -f "$PNG" ]]; then
  if set_icon "$PNG" "$APP"; then
    echo "Icono aplicado desde el PNG y desde assets/abrir-granja-icon.icns"
  else
    echo "El applet quedó creado con el .icns, pero NSWorkspace no pudo confirmar el PNG."
  fi
else
  echo "Icono del applet: assets/abrir-granja-icon.icns (no está el PNG para NSWorkspace)."
fi

touch "$APP"
echo ""
echo "Listo. En el Escritorio quedó AI Profit."
echo "Es un applet de AppleScript (arm64 nativo). No pide Rosetta."
echo "Un doble clic abre TradingView (puerto 9222), el servidor y la Granja en Chrome."
echo "No envía órdenes."
echo "Carpeta: $SCRIPT_DIR"
echo "Si mueves la carpeta de TradingLink, vuelve a ejecutar este instalador."
echo "Para cambiar el dibujo, sustituye assets/abrir-granja-icon.icns y el PNG, y ejecútalo otra vez."
