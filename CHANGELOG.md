# Registro de cambios

Todos los cambios importantes de Prop Farm / TradingLink (Ai Profit Camp) se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## Cómo se versiona
- **Arreglo** (corrige algo sin agregar funciones): sube el último número. Ejemplo: `0.2.0` → `0.2.1`.
- **Función nueva**: sube el número del medio y el último vuelve a cero. Ejemplo: `0.2.1` → `0.3.0`.
- **`1.0.0`**: cuando la granja sea estable para que la usen otras personas.
- **Cada pull request debe subir el archivo `VERSION` y agregar una entrada en este `CHANGELOG.md`** (arriba, con la fecha). También hay que actualizar el texto de respaldo `vX.Y.Z` que se ve en la esquina de la granja (`motor/Granja-de-Cuentas-v2.html`, el bloque `tl-version`).
- La versión actual está en el archivo `VERSION` y se muestra, pequeña, en la esquina inferior derecha de la granja.

## [0.6.2] - 2026-11-04
Valores por defecto al abrir una operación.

### Cambiado
- **Estrategia por defecto: «Evaluación con trailing»** (`evaluacion`) en la página y en el servidor (`DEFAULT_STRATEGY` en `motor/strategies.mjs`).
- **8 contratos por defecto** (MNQ) en la página y en el servidor (`DEFAULT_QTY` MNQ de todas las estrategias). Se pueden cambiar como siempre. No cambia la lógica del motor.

## [0.6.1] - 2026-10-31
Panel Métrica: el resumen del historial de trades de esta máquina (P&L, aciertos, profit factor y gráfica).

### Agregado
- **Botón «📊 Métrica»** junto a Historial de trades (`motor/Granja-de-Cuentas-v2.html`). Abre el panel con filtros HOY, SEMANA, MES y TODO. Abrir Métrica cierra el historial, y al revés.
- **Tarjetas:** P&L total, % de aciertos (ganados y perdidos), ganancia y pérdida media, % de días ganadores, profit factor y mejor día como % del P&L total (solo si ese total es positivo).
- **Gráfica** del P&L de cada día y del acumulado, más la lista de días. Si no hay trades cerrados, el panel lo dice.
- **`GET /api/colchon/metricas`** (`motor/tradinglink.mjs`). Acepta `rango=hoy|semana|mes|todo` o `desde=` y `hasta=` (`AAAA-MM-DD`). Junta cada día con los mismos cálculos que el historial (`tradesDe`: `historial/` de esta máquina y, si falta el archivo, los informes de la granja; el día en curso, las ejecuciones del bróker). No lee `negocio.json`.

### Notas
- Cada instalación ve solo su carpeta `historial/`. Esos archivos siguen fuera del repositorio.
- El modo Demo responde la misma ruta con los datos de ejemplo ya inventados.
- Hay que reiniciar el servidor (solo sin operaciones abiertas ni órdenes pendientes) para la ruta nueva. La página se actualiza al recargar (F5).

## [0.6.0] - 2026-10-29
Jardín de logros: las rosas pasan a ser un cerezo rosa de voxels, con una manzana por certificado.

### Agregado
- **Cerezo rosa junto a la casa** (a la izquierda) en `motor/Granja-de-Cuentas-v2.html`. Copa densa de cubos rosa más chicos, en racimos como nubes; tronco marrón grueso y texturado; flores pequeñas de adorno en el suelo, alrededor de la base.
- **Una manzana roja por logro** (certificado de cuenta fondeada). Las manzanas quedan siempre en la cara de la copa que mira a la cámara. Al pulsar una manzana se abre el panel «Certificado verificado», con la imagen y el botón de borrar (🗑).
- **Clic en el cerezo** abre el alta de certificado. El botón de confirmar dice «Crear logro». Se quitó el ＋ flotante.

### Cambiado
- Las parcelas de plantas y flores de las cuentas fondeadas que ocupaban el sitio del árbol se mueven solo en la escena, para no tapar el tronco. No cambia el esquema de datos (`logros.json`, cuentas ni el motor).

### Notas
- Solo cambia la página. No se toca el motor ni las órdenes. La página se actualiza al recargar (F5). No hace falta reiniciar el servidor.
- El texto de respaldo de la esquina queda en `v0.6.0` (en `0.5.1` se había quedado `vv0.5.1`).

## [0.5.1] - 2026-10-28
El día de la granja ahora cierra a las 16:00 ET, el pico del max loss solo sube con saldos de cierre, y una cuenta marcada «quemada» por error se corrige sola.

### Arreglado
- **Cuenta de evaluación marcada «quemada» sin estarlo** (`motor/tradinglink.mjs`, `motor/Granja-de-Cuentas-v2.html`). El pico (peak) subía con cualquier saldo intradía y el piso se calculaba desde ese pico, así que una ganancia pasajera durante el día levantaba el piso y una pérdida normal después se marcaba como max loss roto (sticky `breachedAt`, estado «Quemada»). En LucidFlex el max loss es trailing de fin de día (EOD): el pico es el **mayor saldo de cierre de sesión**, no el mayor saldo del día.
  - El servidor solo sube el pico con lecturas de la ventana de cierre (17:00 a 17:59 ET, mercado en pausa y todo plano). Un saldo intradía ya no lo sube.
  - Si el servidor estaba apagado en el cierre, la primera lectura del día nuevo usa el último saldo del día anterior como cierre.
  - `breachedAt` solo se marca si el saldo llega al piso calculado desde el pico de cierre (pico − $1,000).
  - La página ya no sube el pico por su cuenta con el saldo intradía (`setDaily`) y una cuenta nueva ya no nace con el saldo como pico: sigue el pico que manda el servidor.
- **La página se corrige sola:** si el servidor dice que la cuenta no está quemada y la página todavía tiene la marca `burnedAt`, la quita y toma el pico del servidor. Evita que una cuenta marcada por error sea archivada en Negocio. Hay que recargar la página (F5) una vez.

### Cambiado
- **El día de la granja termina a las 16:00 America/New_York** (fin de las sesiones de Nueva York), en lugar de las 18:00 o la medianoche (`motor/colchon.mjs`, `motor/tradinglink.mjs`, `motor/Granja-de-Cuentas-v2.html`). Desde las 16:00 todo cuenta como el día siguiente; sábado y domingo cuentan como lunes (viernes 16:00 pasa a lunes). Una sola regla (`diaFarm()`) para el P&L del día, la barra superior, el historial de trades, el reporte diario y el Negocio. El horario de verano lo resuelve la zona `America/New_York`.
  - A las 16:00 la barra superior vuelve a $0 y el historial «de hoy» queda vacío. El cierre del día anterior se guarda (`prev` en `sod.json`) y sus trades siguen visibles en el historial de ese día.
  - Hasta una hora después del cierre se siguen guardando los últimos trades del día que acaba de cerrar.

### Notas
- Reinicia el servidor solo sin operaciones abiertas ni órdenes pendientes. La página se actualiza al recargar (F5).
- No se tocan `orders.mjs`, `strategies.mjs`, stops ni órdenes.
- Las carpetas `historial/` ya guardadas siguen agrupadas con la regla vieja; los días nuevos usan la regla de las 16:00.
- Eval vs fondeada: se mantiene el candado de la fondeada de antes (piso 25,100 al superar 26,100). La documentación de Lucid y de terceros no coincide en si la evaluación topa el piso en 25,000 o en 25,100; solo importa si un cierre pasa de 26,000, así que no se cambió.

## [0.5.0] - 2026-10-28
Modo Demo: un botón en el panel Negocio muestra la granja con datos de ejemplo, para enseñarla sin mostrar tus cuentas reales.

### Agregado
- **Botón «Demo» en el panel Negocio** (`motor/Granja-de-Cuentas-v2.html`). Al pulsarlo, la página se recarga con datos de ejemplo inventados: +$600 de P&L del día, 14 trades ganadores, 2 cuentas de evaluación y 1 fondeada, y un Negocio de +$3,000. Aparece una marca pequeña y fina «demo» abajo a la derecha.
- Funciona solo en el navegador y solo durante esa carga de la página: al recargar vuelves a tus datos reales. Mientras está activo **bloquea todas las peticiones de escritura** y no toca tus datos reales ni el `localStorage`.
- Los datos de ejemplo no contienen nada personal ni real (ids de cuenta falsos, trades generados al azar y montos ilustrativos).

### Notas
- No cambia el motor: no se toca ningún archivo `.mjs`. El código de la demo va dentro de la propia página, en su propio bloque `<script>`.
- La página se actualiza al recargar; no hace falta reiniciar el servidor.

## [0.4.3] - 2026-10-28
El P&L del día ahora es el saldo real de TradingView menos el saldo inicial, e incluye comisiones.

### Cambiado
- **P&L del día = saldo real − saldo inicial** (`motor/Granja-de-Cuentas-v2.html`). La barra superior, la flor y el historial de trades muestran el saldo real de TradingView menos el saldo con que empezó el día (incluye comisiones). Antes mostraban la suma de los trades brutos, sin comisiones. Los trades brutos quedan como detalle: en el texto emergente de la barra superior y en una línea pequeña debajo del P&L del día del historial. Si todavía no hay saldo del día, se muestra el bruto como antes.
- **Fila de la flor renombrada:** ahora dice «P&L total (desde 25,000)» (usa el saldo inicial de la cuenta).

### Arreglado
- **Cuentas de evaluación nuevas empezaban el día en la primera lectura** (`motor/tradinglink.mjs`). Si aparecía una cuenta de evaluación nueva (id `LFE…`) en una granja que ya tenía cuentas, el día empezaba en la primera lectura de saldo, que podía traer una posición abierta con ganancia o pérdida flotante y descuadrar el P&L del día. Ahora empieza en 25,000 y se guarda `inicio: 25000`.

### Notas
- La instalación nueva (sin cuentas guardadas) y las cuentas fondeadas no cambian: siguen empezando en la primera lectura.
- El cambio del servidor solo toca cómo se guarda el saldo inicial del día de una cuenta nueva. No se toca `colchon.mjs`, `orders.mjs` ni `strategies.mjs`, ni las órdenes. Hay que reiniciar el servidor (solo sin operaciones abiertas) para que use el código nuevo; la página se actualiza al recargar.

## [0.4.2] - 2026-10-28
El acceso directo «AI Profit» ya no pregunta nada: reinicia TradingView solo.

### Cambiado
- **Sin pregunta S/N al abrir «AI Profit»** (`acceso/Abrir Granja.bat`). Antes, si el puerto 9222 no respondía, el lanzador preguntaba «¿Cerrar TradingView y abrirlo conectado? (S = sí, N = no)» y había que escribir S. Ahora no pregunta: al abrir AI Profit, TradingView se reinicia solo con el puerto de conexión. Se quitaron la pregunta y la rama de «N». Todo lo demás sigue igual: el servidor arranca primero, se cierra TradingView, se abre con el puerto 9222 y se espera la conexión; si no se puede abrir, la granja se abre igual.

### Notas
- Cerrar TradingView no cierra posiciones ni stops en el broker, pero la granja no puede moverlos hasta reconectar. Si tienes una operación abierta, no abras AI Profit hasta estar plana. El lanzador de Mac (`acceso/AI Profit.command`) ya reiniciaba TradingView sin preguntar, así que no cambia.
- Solo cambia el lanzador de Windows y el texto de versión `v0.4.2` de la esquina. No se toca el motor ni las órdenes.

## [0.4.1] - 2026-10-28
El acceso directo ahora levanta el servidor siempre, aunque TradingView esté cerrado o digas N.

### Arreglado
- **El acceso directo «AI Profit» no abría el servidor si TradingView estaba cerrado** (`acceso/Abrir Granja.bat`). Antes revisaba primero el puerto 9222 de TradingView y, si no respondía, preguntaba «¿Cerrar TradingView y abrirlo conectado? (S/N)»; con **N**, o si no se podía abrir TradingView, el archivo hacía `pause` y salía, así que el servidor nunca arrancaba y la granja no se abría. Ahora **el servidor arranca primero** (si `http://127.0.0.1:8787` no responde) y, con **N** o si falla la apertura de TradingView, solo avisa y sigue: la granja se abre igual y TradingView se conecta solo cuando lo abras con el puerto 9222.
- Subrutina nueva `:arrancar_servidor` al final del archivo: busca Node (`node-win\node.exe`, `node\node.exe`, `node\bin\node.exe` y luego `where node`) y lo inicia en la ventana minimizada «TradingLink».

### Notas
- Solo cambia el lanzador de Windows y el texto de versión `v0.4.1` de la esquina. No se toca el motor ni las órdenes. El lanzador de Mac (`acceso/AI Profit.command`) no tenía este problema: ya arrancaba el servidor aunque TradingView no abriera.

## [0.4.0] - 2026-10-27
Stop en break even con 3 ticks de ganancia, panel de operación nuevo a la izquierda y todos los paneles de detalle abiertos a la izquierda.

### Agregado
- **Puntos máximos del trade** (panel de detalle del historial): debajo de la barra, dos bloques separados: «Máx. en contra» (con los puntos hasta el stop inicial, por ejemplo «−35 pts · stop a 60 pts») y «Máx. a favor» (con los puntos hasta el objetivo, por ejemplo «+35 pts · objetivo a 63 pts»). Se calculan de las lecturas del broker (~1 por segundo) guardadas en `colchon-eventos.jsonl`; por eso **no son exactos al tick** y pueden dejar fuera un pico entre dos lecturas. Los trades sin registro muestran «sin dato». El motor no guarda estos máximos: los calcula la ruta de solo lectura `/api/colchon/detalle` (campo nuevo `puntos`, en `motor/tradinglink.mjs`).
- **Barra del detalle con «Protegido» y «Salió»:** la barra del trade muestra el precio donde quedó protegido el stop y donde salió. El precio de entrada sigue en el recuadro «Entrada → salida» y en un texto emergente sobre la marca amarilla.
- **Puntos al TP/SL y dólares por punto bajo el slider de contratos** (panel Evaluación): «31.5 pts al TP · 31.5 pts al SL» y, en otro renglón, «$20 por punto» (MNQ $2, NQ $20, por los contratos elegidos). Se recalcula al mover el slider y al cambiar de estrategia.
- **Panel de detalle de un trade** (`motor/Granja-de-Cuentas-v2.html`): al tocar un trade en «Historial de trades» se abre un panel con el mismo estilo del panel en vivo: P&L bruto grande, dirección, tamaño y símbolo, estrategia, cuenta enmascarada, motivo del cierre en español sencillo, entrada → salida, duración, horas en ET, barra pequeña, etiqueta de break even, pasos y ajuste de fill. Incluye secciones plegadas «Detalles técnicos» y «Ver informe completo», y un botón «← Volver». Se lee bien a ~560 px y en pantalla ancha.
- **Ruta nueva de solo lectura `GET /api/colchon/detalle?at=<hora>`** (`motor/tradinglink.mjs`): junta, desde `colchon-eventos.jsonl`, el cierre del trade, los movimientos del stop, los disparos y la comparación broker/gráfico de esa operación. No escribe nada, no toca órdenes y enmascara la cuenta (4 primeros + 3 últimos).
- **Mascota en la barra del panel en vivo:** reemplaza la bolita de precio por una mascota (bolita verde lima brillante con dos ojos negros verticales) que se mueve y se inclina hacia donde va el precio, con los ojos mirando ahí, un pequeño rebote al ganar y una respiración suave en reposo. Al perder se preocupa: el color cambia de forma continua de verde lima a naranja y a rojo en proporción al avance hacia el SL, con ojos más grandes que miran de lado, cejas, sudor y un temblor que se acelera cerca del SL. Todo es CSS liviano; con «reducir movimiento» (`prefers-reduced-motion`) se quitan las animaciones pero se mantiene el cambio de color. No se agregan bordes ni íconos rojos.
- **Sección «Logs» plegable en el panel en vivo:** las líneas de método y latencia, la línea «fuente» y las líneas de registro con hora quedan dentro de un solo botón «Logs», cerrado por defecto y que se abre hacia abajo. Se recuerda abierto o cerrado durante la sesión y no se reinicia con cada refresco.
- **Panel de operación nuevo** (`motor/Granja-de-Cuentas-v2.html`): ahora está a la **izquierda**. Muestra el P&L bruto grande, una barra con SL a la izquierda y TP a la derecha, una marca de entrada y una bolita de precio que se mueve en proporción (limitada a los bordes), y una etiqueta verde «Stop en break even (+3 ticks)» cuando el stop ya se movió. Sin etiquetas encimadas y sin rojo alarmante. Solo un P&L (el bruto).

### Cambiado
- **Contratos por defecto del panel de operación: 7.** Solo es el valor inicial del slider; el motor sigue usando `DEFAULT_QTY` 5 (NQ 1) cuando no se le manda una cantidad.
- **Texto «Probabilidad del trade»** con una subleyenda explicativa.
- **Se quita el borde giratorio** alrededor del panel de operación (diseño más sobrio, sin bordes ni íconos alarmantes).
- **Todos los paneles de detalle se abren a la izquierda.** Los de una burbuja sin fondear, una flor y una cuenta fondeada (el panel `#panel`) aparecían a la derecha; ahora se abren a la izquierda y, si el panel en vivo está abierto, justo a su derecha para no taparse. El panel «Negocio» (resumen, abierto desde el botón de abajo a la derecha) no cambió.
- **«Estado» → «Status»** en la barra superior de la granja.
- **Etiqueta de break even del panel en vivo:** ahora dice solo «Stop en break even (+3 ticks)»; la nota sobre cómo TradingView muestra la línea pasó a un texto emergente (tooltip).
- **Botón «Detener y cerrar posición»:** ahora es rojo (con estado al pasar el mouse, al presionar y al enfocar), del mismo tamaño. Es el único elemento rojo del panel.
- **Barra del panel en vivo:** más espacio vertical para que la mascota no choque con las etiquetas de SL, TP y entrada.
- **Estrategia `prueba-be`** (`motor/strategies.mjs`, `motor/colchon.mjs`): el escalón ahora usa `lockTicks: 3`. Al llegar a +$15 el stop sube a **entrada + 3 ticks** (0.75 pts: +$1.50 con 1 MNQ, +$15 con 1 NQ) en vez de quedar exactamente en la entrada. Así se cubre al menos la comisión y TradingView ya no esconde la línea del stop pegada a la entrada. `stepsFor` acepta `lockTicks` y el disparo nunca queda a menos de 1 tick de ese stop. Las demás estrategias no cambian.
- **Barra de la página:** se corrigió el cálculo de la barra de SL/TP del panel, que antes tomaba los puntos del TP como si fueran un precio.

### Eliminado
- **El vigía visual** (verificación del stop mirando el gráfico, `motor/vigia-visual.mjs`): se quitó.

### Notas
- Los PR #6 y #7 se cerraron sin fusionar porque sus cambios quedaron superados por 0.3.0 y 0.4.0.
- El motor (`motor/colchon.mjs`, `motor/strategies.mjs`) solo cambió por `lockTicks` para «Prueba BE». Los demás cambios de esta versión son de la página (`motor/Granja-de-Cuentas-v2.html`) y de la ruta de solo lectura `/api/colchon/detalle`.

## [0.3.1] - 2026-10-26
### Arreglado
- **Arreglo: el respaldo del Negocio (`negocio.json`) no se creaba con historiales grandes (>64 KB).** La página enviaba el respaldo con `keepalive:true`, y los navegadores rechazan en silencio cuerpos de más de 64 KiB con esa opción, así que con un historial grande (por ejemplo, un jardín de varios MB) el archivo nunca se creaba. Ahora `keepalive` solo se usa cuando el envío es pequeño (`motor/Granja-de-Cuentas-v2.html`).
- El servidor acepta hasta **25 MB** por envío a `/api/negocio` (antes 5 MB), porque el jardín crece (`motor/negocio.mjs`).
- El servidor envía `Cache-Control: no-store` en la página HTML, para que el navegador no se quede con una copia vieja sin el script de guardado (`motor/tradinglink.mjs`).

## [0.3.0] - 2026-10-26
Reorganización de carpetas y acceso de escritorio para Mac y Windows (PR #5 y #6 de Caroline, integrados y revisados por Bänéd).

### Agregado
- **Acceso de escritorio «AI Profit»** para Windows (`instalar-ai-profit.bat`) y Mac (`instalar-ai-profit.command`): un doble clic abre TradingView con el puerto 9222, el servidor y la granja. No envía órdenes. Iconos en `assets/`.
- **`motor/rutas.mjs`**: decide dónde están los datos personales. Si la carpeta ya tenía datos en la raíz, los sigue usando ahí; una carpeta nueva usa `datos/`.
- **Archivos de compatibilidad en la raíz** (`iniciar-tradinglink.bat`, `abrir-tradingview.bat`, `actualizar.bat`, `actualizar.ps1`): llaman a los de `acceso/`, así el acceso «Prop Farm» y el actualizador de siempre siguen funcionando.

### Cambiado
- **Carpetas ordenadas**: el código del servidor y la página pasan a `motor/`, los lanzadores y el actualizador a `acceso/`, la documentación a `docs/` y las imágenes a `assets/`. `VERSION` y `CHANGELOG.md` se quedan en la raíz.
- **`Abrir Granja.bat` pide confirmación** antes de cerrar TradingView para reabrirlo conectado (por si hay una operación abierta).
- **Mascota y agente** (PR #6): ya no se atraviesan al caminar; la mascota se aparta o se detiene un momento y el más cercano a la cámara se dibuja delante.

### Notas de migración
- Los archivos personales (`accounts.json`, `sod.json`, `negocio.json`, `backups-negocio/`, etc.) **no se mueven**: una instalación con datos en la raíz sigue usándolos ahí.
- `acceso/actualizar.ps1` no borra nada: los archivos viejos de la raíz (`tradinglink.mjs`, `colchon.mjs`, etc.) quedan sin usar; el arranque ya usa `motor/`. Reiniciar el servidor solo sin operaciones abiertas.

## [0.2.0] - 2026-10-26
Reúne lo que se agregó después de la primera publicación.

### Agregado
- **Panel Operar, Negocio y estrategias** (PR #2, de Caroline): panel *Operar* más grande, con el orden cuenta → estrategia y BUY/SELL abajo; el *Negocio* (antes *Historial*) con ＋ para la comisión de afiliado; jardín de logros con flor de voxels; día y noche de 7:00 a 16:00 ET; montos en $ ocultos hasta hacer clic. Cuatro estrategias: *Evaluación* (predeterminada), *Evaluación con trailing*, *Día mínimo + colchón* y *Prueba BE*.
- **Quema de cuentas fondeadas** (PR #2): una fondeada LFF 25k se marca como quemada, de forma pegajosa, al perder $1,000 acumulados, aunque el daño se reparta en varios días.
- **Lectura de cuentas fondeadas con la pausa de lectura** (PR #2): con la pausa activa se siguen leyendo las LFF, y al reiniciar el servidor se publica el último saldo conocido.
- **Historial del Negocio en `negocio.json`** (PR #4): la página guarda su historial (que vivía solo en el navegador) en `negocio.json`, junto al servidor, con una copia diaria en `backups-negocio/` (las últimas 30). Si la página arranca vacía, lo restaura. Un historial vacío nunca sobrescribe uno con datos. Esos archivos están en `.gitignore` y no se suben nunca. Archivo nuevo: `negocio.mjs`.
- **README** profesional con el crédito «Hecho por Ai Profit Camp».
- **`AGENTS.md` e `INSTRUCCIONES-GROK.md`**: reglas para el Grok de Caroline (trabajar en la rama `caroline`, abrir pull requests, no tocar órdenes reales, no subir datos personales) y la sección «Cambios importantes».
- **Control de versiones**: archivos `VERSION` y `CHANGELOG.md`, y la versión visible en la esquina de la granja.

### Cambiado
- **5 contratos por defecto en todas las estrategias** (PR #3): *Evaluación* y *Evaluación con trailing* usaban 20 MNQ cuando no se indicaba cantidad; ahora usan MNQ 5 y NQ 1, igual que las otras dos.
- **Tope de P&L imposible más estricto** (PR #3): 2× el mayor entre disparo, SL y TP (antes 20×), en `colchon.mjs` y `colchon-src/`.
- El motor espera el contrato fechado antes de armar el bracket y puede leer solo un tipo de cuenta (PR #2).

### Corregido
- **Cuentas viejas ya no resucitan al arrancar** (PR #4): el servidor ya no vuelve a sembrar en la granja las cuentas de evaluación que TradingView dejó de listar (marca `gone` en `sod.json`). No se borra ningún historial. Las cuentas fondeadas nunca se marcan `gone`.
- **Error de la página (`glow` indefinido)** (PR #4): la página ya no se rompe con los árboles de flores de voxels.

## [0.1.0] - 2026-10-26
### Agregado
- Primera publicación de la granja (Prop Farm / TradingLink) en GitHub, saneada: sin cuentas, saldos, historial, registros ni datos personales.
