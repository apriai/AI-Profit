#!/bin/zsh
# Abre TradingView (puerto 9222) + el servidor TradingLink + la Granja en Chrome.
# No envía órdenes y no hace clic dentro de TradingView.
# No es una app: es un script de zsh, nativo en Apple Silicon, sin Rosetta.
# La carpeta es la de este archivo (también si el Escritorio es un enlace).
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
if [[ -f "$SCRIPT_DIR/tradinglink.mjs" ]]; then
  ROOT="$SCRIPT_DIR"
else
  FALLBACK="$HOME/Documents/Grok Bot/TradingLink"
  if [[ -f "$FALLBACK/tradinglink.mjs" ]]; then
    ROOT="$FALLBACK"
  fi
fi
if [[ -z "$ROOT" ]]; then
  fail "No encuentro TradingLink. Busqué: $SCRIPT_DIR y $HOME/Documents/Grok Bot/TradingLink"
fi
cd "$ROOT" || fail "No pude abrir $ROOT"

# Prueba de ruta, sin abrir TradingView ni el servidor.
if [[ "${AI_PROFIT_DRY_RUN:-}" == "1" ]]; then
  echo "ROOT=$ROOT"
  exit 0
fi

listening() {
  curl -fsS -o /dev/null --max-time 2 "http://127.0.0.1:${1}${2}" >/dev/null 2>&1
}

if ! listening 9222 /json/version; then
  echo "El puerto 9222 no responde. Se cierra TradingView y se abre con depuración."
  echo "Esto no envía órdenes."
  osascript -e 'quit app "TradingView"' >/dev/null 2>&1 || true
  sleep 3
  if ! open -a TradingView --args --remote-debugging-port=9222; then
    echo "No pude abrir TradingView. Si está instalado, ábrelo con el puerto 9222."
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
  nohup "$NODE" "$ROOT/tradinglink.mjs" >>"$ROOT/tradinglink.log" 2>&1 &!
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
  echo "El servidor no respondió en http://127.0.0.1:8787. Revisa tradinglink.log."
fi

GRANJA_URL="http://localhost:8787/Granja-de-Cuentas-v2.html"
if ! open -a "Google Chrome" "$GRANJA_URL"; then
  open "$GRANJA_URL" || fail "No pude abrir el navegador."
fi
echo "Listo. La granja está en $GRANJA_URL. Puedes cerrar esta ventana."
