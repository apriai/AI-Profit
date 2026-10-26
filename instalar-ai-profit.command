#!/bin/zsh
# Crea en el Escritorio el enlace "AI Profit.command" al lanzador de esta carpeta.
# Le pone el icono assets/abrir-granja-icon.icns con NSWorkspace (JavaScript).
# No crea una app y no pide Rosetta. No llama al intérprete del sistema.
# No abre TradingView y no envía órdenes.

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
if [[ ! -f "$SCRIPT_DIR/tradinglink.mjs" ]]; then
  FALLBACK="$HOME/Documents/Grok Bot/TradingLink"
  if [[ -f "$FALLBACK/tradinglink.mjs" && -f "$FALLBACK/instalar-ai-profit.command" ]]; then
    SCRIPT_DIR="$FALLBACK"
  else
    fail "no encuentro tradinglink.mjs junto a este instalador ($SCRIPT_DIR)."
  fi
fi

LAUNCHER="$SCRIPT_DIR/AI Profit.command"
[[ -f "$LAUNCHER" ]] || fail "falta AI Profit.command"
chmod +x "$LAUNCHER" "$SCRIPT_DIR/instalar-ai-profit.command" "$SCRIPT_DIR/Abrir Granja.command" 2>/dev/null || true
if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$LAUNCHER" >/dev/null 2>&1 || true
  xattr -d com.apple.quarantine "$SCRIPT_DIR/instalar-ai-profit.command" >/dev/null 2>&1 || true
fi

ICON="$SCRIPT_DIR/assets/abrir-granja-icon.icns"
if [[ ! -f "$ICON" && -f "$SCRIPT_DIR/assets/abrir-granja-icon.png" ]]; then
  ICON="$SCRIPT_DIR/assets/abrir-granja-icon.png"
fi

DESKTOP=""
if command -v osascript >/dev/null 2>&1; then
  DESKTOP="$(osascript -e 'POSIX path of (path to desktop folder)' 2>/dev/null | tr -d '\r')"
  DESKTOP="${DESKTOP%/}"
fi
if [[ -z "$DESKTOP" || ! -d "$DESKTOP" ]]; then
  DESKTOP="$HOME/Desktop"
fi
mkdir -p "$DESKTOP" || fail "no puedo usar el Escritorio ($DESKTOP)."

# Una prueba anterior dejó una app que en Apple Silicon pide Rosetta. Se quita.
if [[ -e "$DESKTOP/AI Profit.app" ]]; then
  rm -rf "$DESKTOP/AI Profit.app"
  echo "Quité AI Profit.app del Escritorio (en Apple Silicon pedía instalar Rosetta)."
fi

LINK="$DESKTOP/AI Profit.command"
ln -sfn "$LAUNCHER" "$LINK" || fail "no pude crear el enlace en el Escritorio."
if command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$LINK" >/dev/null 2>&1 || true
fi

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
if [[ -f "$ICON" ]] && command -v osascript >/dev/null 2>&1; then
  if set_icon "$ICON" "$LAUNCHER"; then
    echo "Icono aplicado desde $ICON"
  else
    echo "El enlace quedó creado, pero no pude aplicar el icono."
    echo "Comprueba que existe assets/abrir-granja-icon.icns y vuelve a ejecutar este instalador."
  fi
else
  echo "No encontré assets/abrir-granja-icon.icns. El enlace quedó sin icono propio."
fi

echo ""
echo "Listo. En el Escritorio quedó AI Profit.command"
echo "Es un enlace a esta carpeta, no una app. No pide Rosetta."
echo "Un doble clic abre TradingView (puerto 9222), el servidor y la Granja en Chrome."
echo "No envía órdenes."
echo "Carpeta: $SCRIPT_DIR"
echo "Si mueves la carpeta de TradingLink, vuelve a ejecutar este instalador."
echo "Para cambiar el dibujo, sustituye assets/abrir-granja-icon.icns y ejecútalo otra vez."
