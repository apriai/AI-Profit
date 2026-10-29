# Estado y versiones (léelo primero)

Documento de relevo para cualquier agente (Grok) que trabaje en este repositorio. Sin datos personales: no hay cuentas, saldos ni claves aquí.

## Versión actual
- **Última versión: 0.7.0** (2026-10-29). Está en el archivo `VERSION` y se ve en la esquina inferior derecha de la granja.
- Historial completo y detallado: `CHANGELOG.md`. Cada versión tiene su release en GitHub (`v0.5.1`, etc.).
- **Al terminar un cambio, actualiza este documento** (versión, fecha y la lista de abajo).

## Lo que cambió (29 oct 2026)
| Versión | Qué cambió |
|---|---|
| 0.4.1 | El acceso (`Abrir Granja.bat`) arranca primero el servidor y luego abre TradingView. |
| 0.4.2 | Al abrir AI Profit, TradingView se reinicia solo con el puerto 9222, sin preguntar. |
| 0.4.3 | P&L del día = saldo real de TradingView − saldo inicial (incluye comisiones). Las cuentas de evaluación nuevas empiezan el día en 25,000. |
| 0.5.0 | Modo Demo: botón «Demo» en el panel Negocio con datos de ejemplo inventados. Solo en el navegador, una carga de página, bloquea toda escritura. |
| 0.5.1 | El día de la granja termina a las 16:00 ET. El pico del max loss sube solo con saldos de cierre (corrige falsas cuentas «quemadas»). La página corrige sola un `burnedAt` erróneo. |
| 0.6.0 | Jardín de logros: cerezo rosa de voxels junto a la casa, una manzana por certificado, clic en el árbol para «Crear logro». Las parcelas que tapaban el tronco se mueven solo en la escena. |
| 0.7.0 | Catálogo: «Rascacielo + colchón» (mismo id `dia-minimo-colchon`), «Fast Breakeven» (mismo id `prueba-be`) y estrategia nueva `rascacielo` (SL 600 / TP 104, stop fijo). Orden: Evaluación, Evaluación con trailing, Rascacielo + colchón, Rascacielo, Fast Breakeven. |

## Datos clave que debes saber
- **Fin del día de la granja (`diaFarm()`, en `motor/colchon.mjs`, `motor/tradinglink.mjs` y la página):** se toma la fecha de Nueva York (`America/New_York`) y, **desde las 16:00 ET, cuenta como el día siguiente**. Sábado y domingo cuentan como lunes (viernes 16:00 pasa a lunes). Esa única regla vale para el P&L del día, la barra superior, el historial, el reporte diario y el Negocio. Las carpetas `historial/` viejas siguen con la regla anterior.
- **Max loss de Lucid (LucidFlex 25K): trailing de fin de día (EOD).** El pico es el **mayor saldo de cierre de sesión**, no el mayor saldo del día, y el piso es pico − $1,000. El servidor solo sube el pico con lecturas de 17:00 a 17:59 ET (o con el último saldo del día anterior si estaba apagado en el cierre). `breachedAt` solo se marca contra ese piso. La página no sube el pico con saldos intradía. Cuenta de evaluación = `LFE…`, fondeada = `LFF…`.
- **Los archivos del repositorio están saneados** (sin datos personales). Nunca copies archivos del PC en vivo encima de los del repositorio. Aplica los cambios como diffs sobre la versión del repositorio, y revisa que no se cuele ninguna cuenta, saldo ni nombre.
- **Flujo de trabajo:** según `AGENTS.md`, trabaja en tu rama `caroline` y abre un pull request; no subas a `main`. Bänéd aprueba el merge. Cada PR sube `VERSION`, agrega una entrada arriba en `CHANGELOG.md` (en español, con fecha) y actualiza el texto `vX.Y.Z` del bloque `tl-version` de `motor/Granja-de-Cuentas-v2.html`. Un PR solo de documentación puede no subir la versión.
- **Antes de reiniciar el servidor:** solo sin operaciones abiertas ni órdenes pendientes. La página se actualiza con recargar (F5). No se toca `orders.mjs`, `strategies.mjs` ni los stops sin que Bänéd lo pida.
