# Registro de cambios

Todos los cambios importantes de Prop Farm / TradingLink (Ai Profit Camp) se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## Cómo se versiona
- **Arreglo** (corrige algo sin agregar funciones): sube el último número. Ejemplo: `0.2.0` → `0.2.1`.
- **Función nueva**: sube el número del medio y el último vuelve a cero. Ejemplo: `0.2.1` → `0.3.0`.
- **`1.0.0`**: cuando la granja sea estable para que la usen otras personas.
- **Cada pull request debe subir el archivo `VERSION` y agregar una entrada en este `CHANGELOG.md`** (arriba, con la fecha). También hay que actualizar el texto de respaldo `vX.Y.Z` que se ve en la esquina de la granja (`motor/Granja-de-Cuentas-v2.html`, el bloque `tl-version`).
- La versión actual está en el archivo `VERSION` y se muestra, pequeña, en la esquina inferior derecha de la granja.

## [0.4.0] - 2026-10-26
Stop en break even con 3 ticks de ganancia, panel de operación nuevo a la izquierda y un vigía visual para comprobar el stop en TradingView.

### Agregado
- **Panel de detalle de un trade** (`motor/Granja-de-Cuentas-v2.html`): al tocar un trade en «Historial de trades» se abre un panel con el mismo estilo del panel en vivo: P&L bruto grande, dirección, tamaño y símbolo, estrategia, cuenta enmascarada, motivo del cierre en español sencillo, entrada → salida, duración, horas en ET, barra pequeña, etiqueta de break even, pasos y ajuste de fill. Incluye secciones plegadas «Detalles técnicos», «Ver informe completo» y «Verificación visual del stop», y un botón «← Volver». Se lee bien a ~560 px y en pantalla ancha.
- **Ruta nueva de solo lectura `GET /api/colchon/detalle?at=<hora>`** (`motor/tradinglink.mjs`): junta, desde `colchon-eventos.jsonl`, el cierre del trade, los movimientos del stop, los disparos, la comparación broker/gráfico y el `visual_stop` de esa operación. No escribe nada, no toca órdenes y enmascara la cuenta (4 primeros + 3 últimos).
- **Mascota en la barra del panel en vivo:** reemplaza la bolita de precio por una mascota (bolita verde lima brillante con dos ojos negros verticales) que se mueve y se inclina hacia donde va el precio, con los ojos mirando ahí, un pequeño rebote al ganar y una respiración suave en reposo. Al perder se preocupa: el color cambia de forma continua de verde lima a naranja y a rojo en proporción al avance hacia el SL, con ojos más grandes que miran de lado, cejas, sudor y un temblor que se acelera cerca del SL. Todo es CSS liviano; con «reducir movimiento» (`prefers-reduced-motion`) se quitan las animaciones pero se mantiene el cambio de color. No se agregan bordes ni íconos rojos.
- **Sección «Logs» plegable en el panel en vivo:** las líneas de método y latencia, la línea «fuente» y las líneas de registro con hora quedan dentro de un solo botón «Logs», cerrado por defecto y que se abre hacia abajo. Se recuerda abierto o cerrado durante la sesión y no se reinicia con cada refresco.
- **`motor/vigia-visual.mjs` (vigía visual, solo lectura).** Después de mover el stop en una operación real (`real`), durante unos 5 s anota el precio de la orden en TradingView, si la página está visible y con foco, y toma 4 capturas JPEG en `colchon-visual/`. Registra el evento `visual_stop` en `colchon-eventos.jsonl` y solo guarda las últimas 40 carpetas. Se lanza sin esperar (fire-and-forget) y un error aquí nunca afecta a la operación. `colchon-visual/` está en `.gitignore`.
- **Panel de operación nuevo** (`motor/Granja-de-Cuentas-v2.html`): ahora está a la **izquierda**. Muestra el P&L bruto grande, una barra con SL a la izquierda y TP a la derecha, una marca de entrada y una bolita de precio que se mueve en proporción (limitada a los bordes), y una etiqueta verde «Stop en break even (+3 ticks)» cuando el stop ya se movió. Sin etiquetas encimadas y sin rojo alarmante. Solo un P&L (el bruto).

### Cambiado
- **«Estado» → «Status»** en la barra superior de la granja.
- **Etiqueta de break even del panel en vivo:** ahora dice solo «Stop en break even (+3 ticks)»; la nota sobre cómo TradingView muestra la línea pasó a un texto emergente (tooltip).
- **Botón «Detener y cerrar posición»:** ahora es rojo (con estado al pasar el mouse, al presionar y al enfocar), del mismo tamaño. Es el único elemento rojo del panel.
- **Barra del panel en vivo:** más espacio vertical para que la mascota no choque con las etiquetas de SL, TP y entrada.
- **Estrategia `prueba-be`** (`motor/strategies.mjs`, `motor/colchon.mjs`): el escalón ahora usa `lockTicks: 3`. Al llegar a +$15 el stop sube a **entrada + 3 ticks** (0.75 pts: +$1.50 con 1 MNQ, +$15 con 1 NQ) en vez de quedar exactamente en la entrada. Así se cubre al menos la comisión y TradingView ya no esconde la línea del stop pegada a la entrada. `stepsFor` acepta `lockTicks` y el disparo nunca queda a menos de 1 tick de ese stop. Las demás estrategias no cambian.
- **Barra de la página:** se corrigió el cálculo de la barra de SL/TP del panel, que antes tomaba los puntos del TP como si fueran un precio.

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
