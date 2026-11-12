#!/bin/zsh
# Abre TradingView (puerto 9222) + el servidor TradingLink + la Granja en Chrome.
# No envía órdenes y no hace clic dentro de TradingView.
# Lanzador zsh. El icono del Escritorio es el applet "AI Profit.app"
# (osacompile); ese applet abre este archivo.
# Este archivo vive en acceso/. La carpeta del programa es la de arriba.
# Si ahí no está el servidor, se prueba ~/Documents/Grok Bot/TradingLink.

fail() {
  echo ""
  echo "$1"
  if [[ -t 0 ]]; then
    read -k 1 "?Pulsa una tecla para cerrar."
    echo ""
  fi
  exit 1
}

SCRIPT_DIR="${0:A:h}"
ROOT=""
if [[ -f "$SCRIPT_DIR/../motor/tradinglink.mjs" ]]; then
  ROOT="${SCRIPT_DIR:h}"
else
  FALLBACK="$HOME/Documents/Grok Bot/TradingLink"
  if [[ -f "$FALLBACK/motor/tradinglink.mjs" ]]; then
    ROOT="$FALLBACK"
  elif [[ -f "$FALLBACK/tradinglink.mjs" ]]; then
    ROOT="$FALLBACK"
  fi
fi
if [[ -z "$ROOT" ]]; then
  fail "No encuentro TradingLink. Busqué: $SCRIPT_DIR/../motor y $HOME/Documents/Grok Bot/TradingLink"
fi
cd "$ROOT" || fail "No pude abrir $ROOT"

if [[ -f "$ROOT/motor/tradinglink.mjs" ]]; then
  SERVER="$ROOT/motor/tradinglink.mjs"
else
  SERVER="$ROOT/tradinglink.mjs"
fi

# Misma regla que motor/rutas.mjs: datos viejos en la raíz; si no, datos/.
LOG="$ROOT/datos/tradinglink.log"
if [[ -e "$ROOT/accounts.json" || -e "$ROOT/sod.json" || -e "$ROOT/negocio.json" || -e "$ROOT/real-allowlist.json" || -d "$ROOT/historial" ]]; then
  if [[ ! -e "$ROOT/datos/accounts.json" && ! -e "$ROOT/datos/sod.json" && ! -e "$ROOT/datos/negocio.json" && ! -e "$ROOT/datos/real-allowlist.json" && ! -d "$ROOT/datos/historial" ]]; then
    LOG="$ROOT/tradinglink.log"
  fi
fi
mkdir -p "$(dirname "$LOG")"

# Prueba de ruta, sin abrir TradingView ni el servidor.
if [[ "${AI_PROFIT_DRY_RUN:-}" == "1" ]]; then
  echo "ROOT=$ROOT"
  echo "SERVER=$SERVER"
  echo "LOG=$LOG"
  if [[ -x "$ROOT/node/bin/node" ]]; then
    echo "NODE=$ROOT/node/bin/node"
  fi
  exit 0
fi

listening() {
  curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${1}${2}" >/dev/null 2>&1
}

if ! listening 9222 /json/version; then
  echo "TradingView no está conectado con la granja. Se cierra y se vuelve a abrir conectado."
  echo "Esto no envía órdenes ni cierra posiciones."
  osascript -e 'quit app "TradingView"' >/dev/null 2>&1 || true
  sleep 3
  if ! open -a TradingView --args --remote-debugging-port=9222; then
    echo "No pude abrir TradingView. Si está instalado, ciérralo y vuelve a abrir AI Profit."
  fi
  echo "Abriendo TradingView..."
  i=0
  while (( i < 20 )); do
    if listening 9222 /json/version; then
      break
    fi
    i=$((i + 1))
    sleep 1
  done
fi

if ! listening 8787 /; then
  NODE=""
  if [[ -x "$ROOT/node/bin/node" ]]; then
    NODE="$ROOT/node/bin/node"
  elif command -v node >/dev/null 2>&1; then
    NODE="$(command -v node)"
  else
    fail "Falta Node. En Mac se espera node/bin/node (portable, arm64) dentro de la carpeta TradingLink."
  fi
  echo "Encendiendo TradingLink..."
  nohup "$NODE" "$SERVER" >>"$LOG" 2>&1 &!
  i=0
  while (( i < 15 )); do
    if listening 8787 /; then
      break
    fi
    i=$((i + 1))
    sleep 1
  done
fi

if ! listening 8787 /; then
  echo "No pude abrir la granja. Cierra y vuelve a abrir AI Profit."
fi

GRANJA_URL="http://localhost:8787/Granja-de-Cuentas-v2.html"
if ! open -a "Google Chrome" "$GRANJA_URL"; then
  open "$GRANJA_URL" || fail "No pude abrir el navegador."
fi
echo "Listo. La granja está en $GRANJA_URL. Puedes cerrar esta ventana."
