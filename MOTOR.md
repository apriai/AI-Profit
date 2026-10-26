# MOTOR.md — TradingLink: backend y motor «colchón»

Guía para futuros agentes. Se basa en el código vigente a 23-oct-2026 (11:40 AM ET). Todos los tiempos están en segundos y las horas en ET. Los ids de cuenta van enmascarados (LFE.0014). Este documento no incluye saldos.

## 1. Reglas de seguridad (leer primero)
- **La IA nunca coloca, modifica, cierra ni cancela órdenes en vivo.** Solo el usuario inicia trades desde la granja. Lo único que un agente puede hacer en vivo son lecturas CDP de solo lectura.
- **Nunca hacer clic dentro de TradingView.**
- **Copia de seguridad antes de cada edición:** `backups\<motivo>-AAAAMMDD-HHMMSS\` con los archivos que se van a tocar.
- **Después de cada cambio:** `node --check` y las pruebas mock (sección 15). No se instala nada en el sistema.
- **Reiniciar el servidor solo** si el motor no está `running` y la cuenta activa está sin posición y sin órdenes de trabajo (comprobado con `%TEMP%\busy.mjs`).
- **Nunca cambiar de cuenta** con un trade u órdenes abiertas, ni con TradingView en primer plano.

## 2. Arquitectura y archivos
Carpeta: `C:\Users\<usuario>\OneDrive\Escritorio\TradingLink` en HERO.

| Archivo | Para qué sirve |
|---|---|
| `tradinglink.mjs` | Servidor HTTP en 127.0.0.1:8787. Sirve la granja, la API, la lectura de cuentas en segundo plano y las órdenes manuales (`/order`, `/confirm`). |
| `colchon.mjs` | El motor: driver CDP (`apiDriver` + scripts `js.*` inyectados en TradingView), el controlador `createColchon`, `readAccounts` y `buildReport`. |
| `strategies.mjs` | El registro de estrategias. |
| `Granja-de-Cuentas-v2.html` | La página «granja». Lleva un único bloque `<script>/* Prueba colch…` con la UI del colchón (la fuente está en `colchon-src\colchon-ui.html`). El pill del agente (`#botToggle`) abre/cierra siempre el panel `#prCard` (fase «choose»); clic en el agente = solo selector de color. Ya no existen el botón «Prueba» (`#prBtn`) ni el panel antiguo «TradingLink Simulation» (`#tlPanel`). |
| `colchon-src\` | Fuentes de la UI y pruebas (`test-mock.mjs`). Su `colchon.mjs` es viejo: el bueno es el de la raíz. |
| `node-win\node.exe` | Node portable v22. No hay Node instalado en el sistema. |
| `abrir-tradingview.bat` | Abre TradingView Desktop (Store) con `--remote-debugging-port=9222`. |
| `iniciar-tradinglink.bat` | Arranca el servidor en una ventana visible y abre el navegador. |
| `real-allowlist.json` | Lista de cuentas reales permitidas (sección 10). |
| `colchon-fuente.json` | Fuente de P&L: `{"modo":"broker"}` (actual), `"mas-rapido"` o `"grafica"`. Se lee al iniciar cada trade, así que no hace falta reiniciar. |
| `accounts.json`, `sod.json` | Estado de las cuentas y saldo de inicio del día (los genera el servidor). |
| `pausa-lectura.flag` | Si existe, la lectura completa en segundo plano no cambia de cuenta. |
| `colchon.log`, `colchon-eventos.jsonl`, `colchon-latencia.log`, `colchon-resumen.json`, `tradinglink.log`, `reportes\` | Logs, eventos e informes (sección 12). |

## 3. Arranque
1. **TradingView con CDP.** Cerrar TradingView del todo (todos los procesos `TradingView`) y ejecutar `abrir-tradingview.bat`. Comprobar que 9222 escucha: `Get-NetTCPConnection -LocalPort 9222 -State Listen` o `http://127.0.0.1:9222/json/version`. Tarda unos 3 s. El panel de trading necesita unos 10 s más antes de que se puedan leer las cuentas.
2. **Servidor.** Lanzarlo oculto, como hacen los agentes: `cmd /c node-win\node.exe tradinglink.mjs >> tradinglink.log 2>&1` desde la carpeta (`Start-Process -WindowStyle Hidden`). Otra opción es `iniciar-tradinglink.bat`.
3. **Comprobar.** `GET /api/colchon/status` debe dar `state` igual a `idle` y `GET /Granja-de-Cuentas-v2.html` debe dar 200.
4. **Reinicio.** Matar los `node.exe` cuya línea de comandos contenga `tradinglink` y volver al paso 2. Antes, verificar el estado libre: `node-win\node.exe %TEMP%\busy.mjs` usa `readAccounts({all:false})` y devuelve `{busy, live, current}`. Solo se reinicia con `busy:false`.

## 4. Endpoints (http://localhost:8787)
| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/Granja-de-Cuentas-v2.html` | La página de la granja. |
| GET | `/accounts.json` | Estado de las cuentas. `live` es la lista viva de `accountsMetainfo`; la granja borra las que ya no están. |
| GET | `/api/colchon/status` | Estado del motor (`S`) más `cfg`. |
| GET | `/api/colchon/summary` | Último resumen de trade (`colchon-resumen.json`). |
| GET | `/api/colchon/strategies` | `listStrategies()`. |
| GET | `/api/colchon/accounts` | Cuentas que se pueden elegir (paper, más las reales permitidas). |
| GET | `/api/colchon/check` | Cuenta activa y si se puede operar: paper, real permitida o bloqueada. |
| POST | `/api/colchon/start` | `{side:'long'\|'short', symbol:'MNQ'\|'NQ', qty, strategyId, accountId?, confirmReal?}`. |
| POST | `/api/colchon/stop` | `{flatten?:bool}`: deja de vigilar y, opcionalmente, cierra. |
| GET | `/api/colchon/reporte?dia=AAAA-MM-DD` | Informe en Markdown (también se guarda en `reportes\<día>.md`). |
| GET/POST | `/api/colchon/lectura` | Consulta o cambia la pausa de la lectura en segundo plano (`{pause:bool}`). |
| GET/POST | `/bot` | Interruptor del bot de órdenes manuales. Devuelve `simulated` = DRY_RUN. |
| POST | `/order`, `/confirm`, `/cancel` | Flujo de órdenes manuales con confirmación. **No pertenece al motor colchón.** |

## 5. Estrategias (`strategies.mjs`)
Parámetros comunes: `SL_USD`, `TP_USD` (bracket en $), `STEPS` (escalones `{trigger, lock}` en $ brutos), `NET_USD`, `COMM_RT`, `SLIP_TICKS`, `TRIGGER_EXTRA_USD`, `DEFAULT_QTY`, `PROB`.

| id | Nombre | Parámetros |
|---|---|---|
| `dia-minimo-colchon` (por defecto) | Día mínimo + colchón | SL 600 / TP 1600; colchón = NET 100 + comisión + 1 tick, redondeado a tick hacia arriba; disparo = colchón + 15. DEFAULT_QTY MNQ 5 / NQ 2. |
| `evaluacion` | Trailing stop loss - Evaluación | SL 630 / TP 630; escalones +150→+100, +250→+200, +350→+300. |
| `evaluacion-simple` | Evaluación | SL 630 / TP 630; STEPS vacío (el stop nunca se mueve). |
| `prueba-be` | PRUEBA BE | SL 630 / TP 630; un solo paso: a +15, stop a la entrada (lock 0). `PROB:'tp'`, así que la probabilidad mostrada es 50 %. DEFAULT_QTY MNQ 5 / NQ 1. |

**Cómo añadir una estrategia:** crear una entrada nueva en `STRATEGIES` con `id`, `name`, `short`, `description` y `params`. La UI la lista sola. Después, `node --check` y las pruebas mock.

**Puntos desde dólares:** `ptsFor(usd) = round(usd / ($/pt × qty) / 0.25) × 0.25`.

**Tope de tamaño:** MNQ 20, NQ 2. Sin cantidad, se usa DEFAULT_QTY.

## 6. Flujo del motor (`_start` → `openBracket` → `loop`)
1. **Comprobación.** Se ejecuta `check()`. La cuenta tiene que ser paper o una real permitida con `confirmReal` (sección 10). Si se pide `accountId`, se cambia de cuenta solo si se puede (sección 9). Después del cambio se verifican el id y el nombre, y se vuelven a leer posiciones y órdenes.
2. **Símbolo.** El chart tiene que estar en `MNQ1!` o `NQ1!`; si está en otro, no abre nada. `js.tradeSymbol` lo traduce al contrato fechado (`CME_MINI:MNQZ2026`) a partir de `front_contract`. Tradovate solo acepta el contrato fechado; Paper acepta `1!`.
3. **Orden.** Se envía una sola orden a mercado (type 2) con `stopLoss` y `takeProfit` calculados desde el **precio de referencia** (el último precio del chart). **Regla WRITE sin reintento:** la colocación nunca se reintenta. Si falla, se informa del error y no se envía nada más.
4. **Comprobación del fill.** `js.fill` espera hasta 6 s a que aparezca la posición. Si no aparece, mira `ordersHistory`: status 5 significa rechazada y se muestra el motivo.
5. **Ajuste de SL/TP al fill** (nuevo, 23-oct). Ocurre en la primera lectura con `entry` (avgPrice), una sola vez por trade y en todas las estrategias:
   - Se calcula `SL = fill − s·slPts` y `TP = fill + s·tpPts` con `roundTick`.
   - El SL se mueve con la cascada del stop (paso 9).
   - El TP se mueve con `modifyTp`: api y después relectura por id. En Paper usa `editPositionBrackets` reenviando el SL; en Tradovate, `modifyOrder` con `limitPrice` sobre **la misma orden**.
   - Nunca cancela ni recrea órdenes.
   - Si el fill es igual a la referencia, no envía nada.
   - Queda registrado en el evento `ajuste_brackets`, en `S.ajuste` y en el resumen (`ajusteFill`). Si no se verifica, salta un aviso rojo.
6. **Bucle.** Lee cada 0.5 s (POLL_MS) la posición y el stop. Una lectura que lanza error es `lectura_fallida_transitoria`: no se cierra nada.
7. **Fuentes de P&L.**
   - **broker-evento:** suscripción a `positionUpdate`.
   - **broker-lectura:** lectura de `positions()`.
   - **grafica:** precio de la barra.
   - **bidask:** bid para largos y ask para cortos.
   - Además, `b:summary` y `b:dom` como ticks informativos.
   - Según `colchon-fuente.json`: `broker` usa solo broker-evento y broker-lectura (**modo actual**); `grafica` usa grafica y bidask; `mas-rapido` usa todas y manda la que cambia antes.
   - Los cambios se registran en `fuente_pl` y `fuente_lider`, y los totales en `fuentes_fin`.
8. **Escalones.** Cuando el P&L de la fuente permitida llega a `trigger`, el stop pasa a entrada + lock (redondeado a tick). Los escalones solo suben, cada uno se aplica una vez y se pueden saltar varios en la misma lectura.
9. **Cascada del stop** (`driver.modifyStop`), siempre sobre la **misma orden y el mismo precio**:
   1. **api** (tope 3 s): `editPositionBrackets` en Paper; `modifyOrder` sobre el stop hijo en Tradovate. La verificación relee durante 1.5 s.
   2. **relectura** por id (`stopById`, 0.8 s), por si la api confirmó tarde.
   3. **ui-interno** (`createEditOrderContext`, sin clics).
   4. Si nada funciona, aviso rojo.

   Si el precio ya está puesto (`ya:true`), no envía nada: así es idempotente. Nunca cancela ni recrea.
10. **Guarda de flat.** Se declara flat con 3 lecturas vacías seguidas, al menos 1 s desde la primera y **sin órdenes hijas SL/TP activas**. Si siguen activas más de 30 s, salta un aviso. Una lectura vacía aislada queda como `anomalia lectura_vacia_transitoria`.
11. **Cambio de cuenta en medio de la prueba.** Si la cuenta activa cambia, el motor deja de vigilar **sin cerrar nada** y muestra una alerta.
12. **4:45 PM ET** (FLAT_BY_MIN): cierra con `flatten` (`closePosition`) en paper y en real.
13. **Fin.** `summarize()` escribe `colchon-resumen.json`, el evento `fin_trade` y `reportes\<día>.md`.

## 7. Paper frente a Tradovate
| Aspecto | Paper Trading | Tradovate (Lucid) |
|---|---|---|
| Símbolo | `MNQ1!` vale | Solo el contrato fechado (`MNQZ2026`) |
| Brackets de posición | `editPositionBrackets` (SL y TP juntos; si se omite el TP, se borra, por eso siempre se reenvía) | `supportPositionBrackets:false`: `editPositionBrackets` devuelve false |
| Mover el SL | editPositionBrackets | `modifyOrder` sobre la orden stop hija (type 3) de `ab.orders()` |
| Mover el TP | editPositionBrackets | `modifyOrder` con `limitPrice` sobre la hija límite (type 1) |
| P&L en la posición | `pl`, `stopLoss` y `takeProfit` en la posición | `unrealizedPl`; sin SL ni TP en la posición; las hijas solo están en `ab.orders()` |
| `modifyOrder` | Puede quedarse colgado: tope de 3 s y relectura | En vivo, 0.48 s más 0.11 s de confirmación |

## 8. P&L, ticks y comisiones
- **Valor por punto:** MNQ $2/pt y NQ $20/pt. Un tick son 0.25 pts: MNQ $0.50 y NQ $5 por contrato.
- **Comisión Lucid (ida y vuelta, por contrato):** MNQ $1 y NQ $3.50. Se usa en el colchón neto.

## 9. Cuentas y cambio de cuenta
- `readAccounts` lee `accountsMetainfo`. `state.live` refleja la lista viva y la granja sincroniza cada 30 s (el desplegable del colchón también).
- La granja tiene una entrada recuerdo «🌱 Mi primer pago» que no se borra.
- **Lectura en segundo plano** (cada 5 min): la lectura completa recorre las cuentas cambiando de cuenta solo si no hay `pausa-lectura.flag`, el motor no está `running` y la cuenta activa no tiene posiciones ni órdenes. Si las tiene, se salta y se reintenta en 5 min.
- **El motor solo cambia de cuenta** si no está ocupado (sin posición ni órdenes de trabajo) y TradingView **no** está en primer plano (`document.visibilityState`/`hasFocus`). Después verifica el id y el nombre.

## 10. Cuentas reales
- **Lucid:** LFE = evaluación, LFF = fondeada (`/^LF[EF]\d+$/`).
- **`real-allowlist.json`:** `{"allowAll":true}` (actual) o `{"allow":["<nombre>"]}`. Sin el archivo, todo lo real queda bloqueado.
- **Para operar en real** hacen falta la cuenta en la allowlist y `confirmReal:true` (la UI lo pide). La UI muestra la insignia roja «CUENTA REAL».
- El cierre de las 4:45 PM se aplica también a las cuentas reales.

## 11. Pitfalls conocidos
- **TradingView abierto desde la barra de tareas o el menú Inicio arranca SIN 9222.** El motor y las lecturas fallan con `ECONNREFUSED 127.0.0.1:9222`. Solución: cerrar todos los procesos de TradingView y usar `abrir-tradingview.bat`.
- **El servidor no arranca solo después de reiniciar el PC.** Hay que lanzarlo a mano (sección 3).
- **`DRY_RUN` solo afecta a `/order` y `/confirm`** (órdenes manuales). **No afecta al motor colchón:** el motor opera de verdad en la cuenta que pase el check.
- Una orden a mercado puede llenarse unos ticks peor que la referencia. El 23-oct fueron 2 pts; por eso existe el ajuste al fill.
- Dentro de las plantillas `js.*` las regex necesitan doble barra (`\\d`).
- Si se modifica `editPositionBrackets` en Paper sin `takeProfit`, se borra el TP.

## 12. Logs, eventos e informes
- `colchon.log`: log legible, con horas en ET.
- `colchon-eventos.jsonl`: un JSON por línea con `type`. Tipos:
  - `lectura`, `fuente_pl`, `fuente_lider`, `fuentes_fin`
  - `ticks_inicio`, `ticks_fin`
  - `mover_stop` (con `intentos`), `ajuste_brackets`
  - `flat_contador`, `flat_decidido`
  - `anomalia`, `notificacion`, `fin_trade`
- `colchon-latencia.log`: una línea por cada movimiento del stop.
- `colchon-resumen.json`: el resumen del último trade.
- `reportes\<día>.md` (`buildReport`), con estas secciones: Trades, Ajuste SL/TP al fill, Movimientos del stop, Bróker vs chart, Fuentes, Anomalías.
- `tradinglink.log`: salida del servidor.

## 13. Resultado en vivo verificado — 23-oct-2026 (PRUEBA BE, LFE.0014, modo «más rápido»)
- **Orden:** COMPRA 2 MNQ con el símbolo `CME_MINI:MNQZ2026`. Referencia 29110.5, fill 29112.5 (2 pts peor). Era el código anterior al ajuste: SL 28953 y TP 29268 calculados desde la referencia.
- **Fill:** visto a los 1.1 s del envío.
- **Disparo de +$15:** lo vio primero bidask, 1.4 s después de abrir. broker-evento lo vio 0.44 s más tarde y broker-lectura 0.86 s más tarde.
- **Stop a BE (29112.5):** 1 intento, **api (`modifyOrder`)**, 0.59 s (modificar 0.48 s y confirmar 0.11 s), precio verificado. **Mismo id de orden stop antes y después**; no se canceló ni se recreó nada. Del disparo a la confirmación pasaron 0.6 s.
- **Hueco medio entre cambios por fuente:** grafica 0.68 s, bidask 0.65 s, broker-lectura 0.99 s, broker-evento 1.08 s. La diferencia entre bróker y chart fue de $5 de media y $6 como máximo.
- **Cierre:** por stop en BE, P&L $0 sin comisiones. Duración 4.2 s. La guarda de flat decidió tras 1.06 s. Sin anomalías.
- **Cambios posteriores:** ajuste SL/TP al fill (sección 6.5) y `modo:"broker"`. El servidor se reinició a las 11:04 AM ET con ese código.

## 14. Comprobación rápida del estado libre (solo lectura)
`node-win\node.exe %TEMP%\busy.mjs` devuelve `{"busy":false,...}` cuando la cuenta está sin posición y sin órdenes. Necesita 9222.

## 15. Pruebas mock
- **En el box:** `node test-mock.mjs` con la copia del código en `/workspace/tl`. Hay que tener `real-allowlist.json` **fuera** de esa carpeta. Simula una página de TradingView falsa, tanto Paper como Tradovate (`fakePage({tv:{}})`).
- **En HERO:** generar `%TEMP%\tm-run.mjs` a partir de `colchon-src\test-mock.mjs`:
  - Imports a `file:///C:/Users/<usuario>/OneDrive/Escritorio/TradingLink/…`.
  - `'/tmp/` a `C:/Users/<usuario>/AppData/Local/Temp/tl/`.
  - `createColchon(` a un wrapper `cc(` que pasa `realAllowFile` apuntando a un archivo inexistente.

  Después: `node-win\node.exe %TEMP%\tm-run.mjs`.
- **Resultado esperado al 23-oct:** 95 PASS, 0 FAIL. Tarda unos 70 a 130 s.

## 16. Mejoras visuales de la granja (23-oct-2026)
- **Panel del agente** (pill «Agente» → panel colchón, fase en curso): P&L en vivo grande (verde ≥ 0, rojo < 0) y una barra con SL (rojo), entrada (amarillo), TP (verde) y un punto con el precio actual. Función `window.__tlViz(s)` en el bloque `<script>/* Mejoras visuales…` al final de la página; usa `entry`, `price`, `pnl`, `sl`, `tp`, `side` de `/api/colchon/status`.
- **Cuenta real:** borde rojo pulsante alrededor de toda la página (`body.tl-real`) mientras la cuenta seleccionada es real permitida o hay un trade en modo real. El distintivo «CUENTA REAL» se mantiene.
- **Luces en la barra superior** (`#tlLuces`): Servidor, TradingView (CDP 9222) y Tradovate, verde/rojo, cada 5 s desde `/api/colchon/conexion`.
- **Historial de trades:** botón `#tradesBtn` abajo a la izquierda (mismo estilo que «Historial», que sigue a la derecha; la pista `#hint` se subió). Vista `#tradesView`: arriba P&L del día, nº de trades y ganados; selector de día; lista con hora ET, dirección, contratos, resultado $ (`*` = aproximado) y si el stop se movió. Al tocar un trade se abre su informe de `reportes\` (`<estrategiaId>-<día>.md`, si no el del día).
- **Endpoints nuevos en `tradinglink.mjs` (solo lectura, nunca órdenes):**
  - `GET /api/colchon/trades?dia=AAAA-MM-DD` → trades `fin_trade` de `colchon-eventos.jsonl` con totales; `stopMovido` = colchón movido o algún `mover_stop` ok.
  - `GET /api/colchon/informe?f=<archivo>.md` → texto de `reportes\` (solo nombres `[\w.-]+.md`).
  - `GET /api/colchon/conexion` → `{servidor, tradingview, tradovate, broker, real, cuenta}`; caché 10 s; CDP con `/json/version` (1.5 s); la cuenta/bróker se leen con `colchon.check()` (solo lectura) y **no** durante un trade en curso.
  - Todos los ids de cuenta salen enmascarados (`LFE…1234`).
- Backup previo: `backups\pre-visual-20261023-163659`.

## 17. Historial con P&L real del bróker + aviso de cuenta real (2026-10-23)
- `/api/colchon/trades`: para el día de hoy lee las ejecuciones reales de TradingView (solo lectura: `ab.allExecutions()`, o `ab.executions(símbolo)` para MNQZ2026/NQZ2026/símbolo del chart). Arma trades ida y vuelta por símbolo (MNQ $2/pt, NQ $20, MES $5, ES $50), los cruza con los `fin_trade` de la granja (±15 s, misma dirección) y marca los demás como "Manual / fuera de la granja". Caché 20 s, sin lecturas durante un trade.
- Campos nuevos: `fuente`, `saldoDia` (balance − inicio de día, neto con comisiones), `cuenta`, por trade `entrada`, `salida`, `pnlBruto`, `granja`, `pnlGranja`. Si no hay bróker, usa el estimado de la granja y lo indica en `fuente`.
- Las ejecuciones de Tradovate no traen comisión: el P&L por trade es bruto; el neto real es "Saldo del día".
- Se quitó el borde rojo. Al despertar el agente con cuenta real sale el modal "Cuenta real": "Esta cuenta opera con dinero real. ¿Continuar?", sin icono de alerta, botón "Continuar" verde (#3ddc6a, color de la granja) y "Cancelar" neutro, recordado por sesión (`sessionStorage.tl_real_ok`); reemplaza el `confirm()` anterior.
- Historial de trades: la columna Stop se reemplazó por "Cuenta" (id enmascarado: 4 primeros + "…" + 3 últimos, p. ej. LFE0…014, en toda la lista; `maskId` del servidor usa el mismo formato). Los trades reales iniciados por la granja llevan la etiqueta verde "AUTO" (antes "REAL" roja) y, si el agente movió el stop, una etiqueta "agente". "MANUAL" sin cambios.
- Historial permanente: `historial\AAAA-MM-DD.json` (por día, dentro `cuentas[<id enmascarado>]` con `trades`, `saldoDia`, `fuente`, `actualizado`). Se escribe/fusiona (por hora+dirección+contratos, nunca se borra) cada vez que se lee el historial de hoy con datos del bróker, a los 15 s de arrancar y cada 3 min (cubre el cierre del día). Días pasados: primero este archivo (+ trades de la granja no cruzados), si no existe, los informes de `reportes`. La lista de días incluye los archivos de historial.

## 18. Prop Farm: P&L de la barra superior conectado al bróker, logo y nombre (2026-10-23)
- Causa del $0: la barra sumaba solo las cuentas "vivas" del estado local de la granja. LFE…014 (balance 23,992 < piso 24,000 de la granja) se considera quemada y queda fuera, así que "P&L" y "hoy" daban $0 y "0 cuentas".
- Ahora un script (al final de la página) lee cada 30 s `/api/colchon/trades` y `/accounts.json` y guarda `window.__tlPnl` {neto = `daily[hoy]` (cambio real de balance con comisiones), bruto = total del historial, cuentas = nº de cuentas vivas}. `zu()` (HUD) usa esos valores si existen: "P&L −$332.50 hoy neto · bruto −$368.00". Sin datos, vuelve al cálculo local.
- Nombre "Prop Farm" (título, pestaña, cabecera). Logo: imagen del usuario recortada (fondo transparente) embebida como data URI en la cabecera y como favicon; copia en `propfarm-logo.png`.
- Contador de cuentas: el 📦 se reemplazó por una flor pixel-art (SVG 24 px, pétalos rosa #ff5ea8, centro amarillo, tallo verde, tierra marrón) al estilo de las plantas de la isla.

### 18.1 Un solo P&L (23-oct 5:48 PM ET)
- Se muestra un único P&L: la suma de trades del bróker (bruto). La barra superior dice "P&L −$X hoy". En Historial solo queda "P&L del día"; se quitaron "Saldo del día (neto)" y las notas de neto/bruto/comisiones.
- El neto sigue guardándose en JSON (window.__tlPnl.neto, saldoDia), pero ya no se muestra.

## 19. Jardín de logros, barras de meta y verde lima (23-oct-2026, 6:25 PM ET)
- Bloque `<script>/* Prop Farm: Jardín de logros…` al final de la página. El bundle solo cambia en `window.__gx={wt,Jr,Wu,…}` (Group y MeshStandardMaterial expuestos).
- **Jardín de logros** (rincón trasero izquierdo, `GP=[-7.6,-6.4]`, cartel «🌸 Jardín de logros»): árboles en flor rosados con brillo y chispas. Entradas: plantas `kind==="tree"` (fondeadas no quemadas), recuerdos `memorial` («🏆 Mi primer pago»; su planta original se oculta y pasa al jardín), ids `LFF…` de `/accounts.json` `live`, y `logros.json` (`{"logros":[{"cuenta","firma","tipo","fecha"}]}`). Quemadas no aparecen. Sin fecha ni P&L. Clic en ✨ → modal `#pfCert` «Certificado de prueba superada» (logo, cuenta enmascarada 4…3, firma). `window.__pfGarden.cert/entries/build`.
- **Barras de meta** (`.pfMeta`) sobre cada planta activa y fila con barra en el panel de detalle. Eval: (saldo−inicio)/meta; fondeada: (saldo−inicio)/metaRetiro. `metas.json` (por defecto `{"evaluacion":{"meta":1250},"fondeada":{"metaRetiro":1000}}`; 1250 = `ns.target` del código, 1000 = valor por defecto propio).
- **Verde lima del logo #cdea1d**: reemplaza #3ddc6a (salvo `fill=` de pixel-art), rgba(61,220,106) y #a6ff4d; botones primarios, luces, P&L positivo, AUTO/agente, píldora del agente, pestaña activa. Fondo morado sin cambios.
- `tradinglink.mjs`: ruta nueva `GET /logros.json` y `/metas.json` (solo lectura desde la carpeta). **Requiere reinicio**; no se reinició porque `busy.mjs` dio `busy:true`. Mientras tanto la página usa los valores por defecto.
- Backup: `backups\pre-jardin-20261023-181321`.
