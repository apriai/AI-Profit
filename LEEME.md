# TradingLink (Windows)

Lee tus cuentas Lucid desde TradingView Desktop y actualiza la Granja de Cuentas en http://localhost:8787.
Las ordenes estan en MODO SIMULACION (DRY_RUN = true): nunca se coloca una orden real.

## Requisitos
- TradingView Desktop (instalado desde Microsoft Store) con tu cuenta Lucid/Tradovate conectada.
- Node.js para Windows v18+ (la carpeta `node/` es de Mac y NO sirve en Windows).
  Opcion A: instalar Node LTS desde https://nodejs.org (requiere tu autorizacion).
  Opcion B (portable, sin instalar): descargar el zip "Windows x64" de nodejs.org y copiar `node.exe` en `node-win\`.

## Uso
1. Una sola vez: doble clic en `instalar-ai-profit.bat` (Mac: `instalar-ai-profit.command`).
   En Windows crea el acceso **AI Profit**. En Mac crea el applet **AI Profit**
   (icono de `assets/abrir-granja-icon.icns`, sin Rosetta).
2. Cada dia: doble clic en **AI Profit**.
   Abre TradingView con el puerto 9222, enciende el servidor y abre la Granja
   en http://localhost:8787/Granja-de-Cuentas-v2.html. No envia ordenes.
3. En TradingView abre el panel de cuentas (Account Manager) y dejalo visible.

Sin el acceso del Escritorio, en Windows: `abrir-tradingview.bat` y luego `iniciar-tradinglink.bat`.
En Mac, sin el applet: `AI Profit.command`. Detalle en `AI-PROFIT-ACCESO.md`.

## Estrategia (ordenes, en simulacion)
- 1 trade por dia por cuenta, siempre bracket.
- Evaluacion (LFE): TP +$630 / SL -$600. Exactamente 2 trades ganadores = +$1,260 (objetivo $1,250).
- Fondeada (LFF): primer trade TP +$1,600 / SL -$600.
- Tamano: hasta 2 NQ o 20 MNQ.
- No abrir despues de 3:00 PM ET; flat antes de 4:45 PM ET.
- Noticias carpeta roja: sin trades nuevos de 40 min antes a 5 min despues (pendiente conectar fuente; revisar a mano).
- Bot apagado por defecto; cada orden requiere confirmacion (60 s).

## Notas
- Si la granja muestra cuentas viejas, usa "Reiniciar datos" en la granja (se guardan en el navegador).
- Respaldos de archivos en `backups/`.