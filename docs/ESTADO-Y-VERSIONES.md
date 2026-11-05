# Estado y versiones (léelo primero)

Documento de relevo para cualquier agente (Grok) que trabaje en este repositorio. Sin datos personales: no hay cuentas, saldos ni claves aquí.

## Versión actual
- **Última versión: 0.8.3** (2026-11-05). Está en el archivo `VERSION` y se ve en la esquina inferior izquierda de la granja.
- Historial completo y detallado: `CHANGELOG.md`. Cada versión tiene su release en GitHub (`v0.5.1`, etc.).
- **Al terminar un cambio, actualiza este documento** (versión, fecha y la lista de abajo).

## Lo que cambió (31 oct 2026)
| Versión | Qué cambió |
|---|---|
| 0.8.3 | «Evaluación con trailing»: quita el falso «Probabilidad del trade 100%»; con trailing describe breakeven/protege ganancias, sin %. Solo página. |
| 0.8.2 | Listo por hoy: usa P&L del día (`pnlToday`), no saldo−inicial. Solo página. |
| 0.8.1 | Letrero verde «Listo por hoy» encima de plantas con P&L del día ≤ −$600 (límite diario LucidFlex). Solo página. |
| 0.8.0 | Estrategias de Karol (PR #19): Rascacielo (Dia Minimo+Colchon), Rascacielo (SL600/TP104) y Fast Breakeven. Ids estables; 8 MNQ por defecto. |
| 0.7.5 | Barra superior: trades del día (total / positivos / negativos) en vez del P&L en dólares. Mismo día granja 4 PM ET. Solo página. |
| 0.7.4 | Estrategia propia (nombre, SL, TP, hasta 3 pasos) guardada solo en `estrategias-propias.json` de esta computadora. El botón de operar espera como máximo ~2.5 s a una lectura de cuentas en curso. Las estrategias de serie no cambian (Rascacielo sigue en el PR #19). |
| 0.7.3 | Nombre de planta (persistente), saldo arriba de la planta, selector sin nombre duplicado, barra P&L −1000…+1000. Solo página. |
| 0.7.2 | Selector de cuenta legible: sin texto amarillo/celeste/gris en las opciones ⭐/💎/✖ (negrita en ⭐/💎). Solo página. |
| 0.7.1 | Celebración al ganar (confeti, Profito salta, moneda; grande con Take profit). Al perder: nube gris sobre la planta y tono suave. Botón 🔊/🔇. Arreglo: el resumen ya no se repite al recargar. Versión abajo a la izquierda. Solo página. |
| 0.7.0 | Arreglo mascota quieta (`CZ_FLOW_TO`). Profito sale dormido y la granja en pausa al abrir; riega con regadera y laptop durante un trade. Marcadores ⭐/💎 con saldo en el selector de cuentas y en las barras. Ojito de privacidad abajo a la derecha. Solo página. |
| 0.6.1 | Panel Métrica: botón junto al historial de trades y `GET /api/colchon/metricas`. Resume el historial de esta máquina (P&L, aciertos, profit factor, gráfica). No lee `negocio.json`. |
| 0.4.1 | El acceso (`Abrir Granja.bat`) arranca primero el servidor y luego abre TradingView. |
| 0.4.2 | Al abrir AI Profit, TradingView se reinicia solo con el puerto 9222, sin preguntar. |
| 0.4.3 | P&L del día = saldo real de TradingView − saldo inicial (incluye comisiones). Las cuentas de evaluación nuevas empiezan el día en 25,000. |
| 0.5.0 | Modo Demo: botón «Demo» en el panel Negocio con datos de ejemplo inventados. Solo en el navegador, una carga de página, bloquea toda escritura. |
| 0.5.1 | El día de la granja termina a las 16:00 ET. El pico del max loss sube solo con saldos de cierre (corrige falsas cuentas «quemadas»). La página corrige sola un `burnedAt` erróneo. |
| 0.6.4 | La etiqueta de cuentas de evaluación dice solo «Evaluación» (sin «no fondeada»). |
| 0.6.3 | Estrategia por defecto otra vez «Evaluación» (`evaluacion-simple`); siguen 8 contratos MNQ por defecto. |
| 0.6.2 | Por defecto: estrategia «Evaluación con trailing» y 8 contratos (página y servidor). Se pueden cambiar. |
| 0.6.0 | Jardín de logros: cerezo rosa de voxels junto a la casa, una manzana por certificado, clic en el árbol para «Crear logro». Las parcelas que tapaban el tronco se mueven solo en la escena. |

## Datos clave que debes saber
- **Fin del día de la granja (`diaFarm()`, en `motor/colchon.mjs`, `motor/tradinglink.mjs` y la página):** se toma la fecha de Nueva York (`America/New_York`) y, **desde las 16:00 ET, cuenta como el día siguiente**. Sábado y domingo cuentan como lunes (viernes 16:00 pasa a lunes). Esa única regla vale para el P&L del día, la barra superior (conteo de trades), el historial, el reporte diario y el Negocio. Las carpetas `historial/` viejas siguen con la regla anterior.
- **Max loss de Lucid (LucidFlex 25K): trailing de fin de día (EOD).** El pico es el **mayor saldo de cierre de sesión**, no el mayor saldo del día, y el piso es pico − $1,000. El servidor solo sube el pico con lecturas de 17:00 a 17:59 ET (o con el último saldo del día anterior si estaba apagado en el cierre). `breachedAt` solo se marca contra ese piso. La página no sube el pico con saldos intradía. Cuenta de evaluación = `LFE…`, fondeada = `LFF…`.
- **Los archivos del repositorio están saneados** (sin datos personales). Nunca copies archivos del PC en vivo encima de los del repositorio. Aplica los cambios como diffs sobre la versión del repositorio, y revisa que no se cuele ninguna cuenta, saldo ni nombre.
- **Flujo de trabajo:** según `AGENTS.md`, trabaja en tu rama `caroline` y abre un pull request; no subas a `main`. Bänéd aprueba el merge. Cada PR sube `VERSION`, agrega una entrada arriba en `CHANGELOG.md` (en español, con fecha) y actualiza el texto `vX.Y.Z` del bloque `tl-version` de `motor/Granja-de-Cuentas-v2.html`. Un PR solo de documentación puede no subir la versión.
- **Antes de reiniciar el servidor:** solo sin operaciones abiertas ni órdenes pendientes. La página se actualiza con recargar (F5). No se toca `orders.mjs`, `strategies.mjs` ni los stops sin que Bänéd lo pida.
