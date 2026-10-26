#!/bin/zsh
# Abre TradingView (con conexión) + servidor TradingLink + la Granja. No envía órdenes.
cd ~/Documents/"Grok Bot"/TradingLink
if ! curl -s -o /dev/null http://localhost:9222/json/version; then
  osascript -e 'quit app "TradingView"' 2>/dev/null; sleep 3
  open -a TradingView --args --remote-debugging-port=9222
  echo "Abriendo TradingView..."; sleep 15
fi
if ! pgrep -f "node tradinglink.mjs" >/dev/null; then
  nohup ./node/bin/node tradinglink.mjs > tradinglink.log 2>&1 &
  echo "Encendiendo TradingLink..."; sleep 3
fi
open -a "Google Chrome" "http://localhost:8787" || open "http://localhost:8787"
echo "Listo ✅ Puedes cerrar esta ventana."
