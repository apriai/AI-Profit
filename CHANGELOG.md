# Registro de cambios

Todos los cambios importantes de Prop Farm / TradingLink (Ai Profit Camp) se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## Cómo se versiona
- **Arreglo** (corrige algo sin agregar funciones): sube el último número. Ejemplo: `0.2.0` → `0.2.1`.
- **Función nueva**: sube el número del medio y el último vuelve a cero. Ejemplo: `0.2.1` → `0.3.0`.
- **`1.0.0`**: cuando la granja sea estable para que la usen otras personas.
- **Cada pull request debe subir el archivo `VERSION` y agregar una entrada en este `CHANGELOG.md`** (arriba, con la fecha). También hay que actualizar el texto de respaldo `vX.Y.Z` que se ve en la esquina de la granja (`motor/Granja-de-Cuentas-v2.html`, el bloque `tl-version`).
- La versión actual está en el archivo `VERSION` y se muestra, pequeña, en la esquina inferior derecha de la granja.

## [0.10.6] — 2026-11-13
### Cambiado
- **El instalador deja la foto como protagonista.** Tres pantallas, sin la de elegir carpeta: se instala directo en la carpeta del usuario y no pide administrador. Cada foto va completa, de borde a borde, a 720×405 (16:9), sin recortar arriba ni abajo. El fondo es oscuro. En una franja baja va una frase corta y un botón verde redondeado, o la barra de progreso verde. Bienvenida: «Instalar AI Profit» y «Instalar». Progreso: «Instalando…». Final: «¡Listo!» y «Abrir».
- **Vista previa: solo dos líneas grises.** Al pasar el cursor por BUY o SELL se dibujan el stop y el take profit como dos líneas horizontales del mismo gris, de 1 píxel. Se crean una vez y, si cambia el lado o la cantidad, solo se les mueve el precio. Al salir el mouse o cerrar el panel se borran. Ya no hay caja de riesgo ni zona de color.
- **Tope de la 25K fondeada.** 10 MNQ (1 NQ) hasta un saldo de $26,100 (ganancia de $1,100 sobre 25,000); desde ahí, 20 MNQ (2 NQ). La 50K no cambia: 20, 30 desde $1,000 y 40 desde $2,000.
- **El instalador se publica solo.** Si `VERSION` cambia en `main`, GitHub Actions crea la etiqueta `vX.Y.Z`, construye `Profito-Setup.exe` y lo sube a una release publicada (ni borrador ni prerelease). Si esa versión es mayor que la Latest, queda como Latest.
### Corregido
- **La vista previa usa el tope de la cuenta.** Ya no se corta siempre en 20 MNQ. Usa `maxQtyFor`, el mismo tope del motor, también en la etapa fondeada.
- **TradingView en otra carpeta o en otro disco.** Si el desinstalador de Windows guarda la ruta, se usa aunque no esté en AppData ni en Archivos de programa. Si hay un ejecutable viejo y también el de la Store, y el viejo no abre el puerto, se prueba el de la Store. Si hay un trade abierto, el instalador se detiene por el código de salida, no solo por el archivo de estado.
### Notas
- No abre, no mueve y no cierra órdenes. La foto de la granja de cerca queda en `instalador/gfx` y no se muestra: la del progreso es la multitud y las islas, para no parpadear entre dos fotos mientras copia archivos.

## [0.10.5] — 2026-11-13
### Agregado
- **Aviso de actualización al abrir.** En Windows, al arrancar, se consulta la última release de GitHub. Si es más nueva que el `VERSION` de esta carpeta, una ventana pregunta: «Hay una versión nueva de Profito (X). ¿Actualizar ahora?» Sí descarga `Profito-Setup.exe` a la carpeta temporal, lo abre y cierra este Profito. Si no hay internet, si la página falla o si tarda, no dice nada y el arranque sigue. Si se pulsa No, ese día no vuelve a preguntar. No pregunta si hay una operación en curso.
- **Construcción del instalador.** `instalador/construir.ps1` arma `dist/Profito-Setup.exe` con NSIS, el mismo tipo de empaquetador que el de 0.10.2. Al publicar una etiqueta `v*`, GitHub Actions lo construye y lo sube a la release.
- **El instalador muestra la granja.** Cuatro pantallas, cada una con su foto completa en 16:9 (496×279), sin recortar arriba ni abajo: bienvenida (Profito en el escenario), carpeta (la multitud y las islas), instalación (la granja de cerca) y final (la isla). La ventana es más alta y el texto queda debajo. Textos cortos, en español.
### Notas
- No abre, no mueve y no cierra órdenes. El lanzador compilado `AI Profit.exe` no tiene fuente en el repositorio: el aviso entra por `acceso/profito-estado.mjs`, que ese exe ya ejecuta. El instalador nuevo crea el acceso con `acceso/AI Profit.cmd`.

## [0.10.4] — 2026-11-13
### Corregido
- **TradingView de la Store y de tradingview.com/desktop ya se detecta en Windows.** Esos instaladores dejan el paquete MSIX en `C:\Program Files\WindowsApps`. Esa carpeta niega el listado, así que comprobar si el archivo «existe» daba un falso «no está» aunque la app estuviera abierta. `acceso/profito-estado.mjs` acepta la carpeta que devuelve `Get-AppxPackage TradingView.Desktop` sin esa comprobación, y también el alias de `%LOCALAPPDATA%\Microsoft\WindowsApps`. Si el proceso ya está abierto y no hay ruta, el acceso reinicia TradingView en vez de abrir la página de descarga.
- **Arranque con conexión a la granja, con respaldo.** `acceso/abrir-tradingview.ps1` prueba el alias, después la activación del paquete (conserva la identidad de la Store) y, si el puerto no responde, el `TradingView.exe` de `WindowsApps`. `acceso/probar-tradingview.ps1` hace esa prueba en la PC e imprime OK o FALLA.
### Notas
- No abre, no mueve y no cierra órdenes. El cuadro de «¿Abro la página oficial?» sigue dentro de `AI Profit.exe` (el acceso compilado): con esta versión deja de salir cuando hay paquete o proceso, porque la ruta que recibe ya no va vacía. En la PC del dueño, con TradingView.Desktop 3.5.0.8375, el script de prueba respondió OK por activación del paquete y `http://127.0.0.1:9222/json/version` respondió.

## [0.10.3] — 2026-11-13
### Cambiado
- **Textos del selector según el tamaño de la cuenta.** En el panel de operar, el resumen de la estrategia (el texto corto y la descripción) usa los dólares de la cuenta elegida: los mismos que salen al operar. En 25K se ven las cifras guardadas; en 50K, el doble. Al cambiar de cuenta, el texto se vuelve a armar. No cambia cómo se calculan ni cómo se envían las órdenes.
- **Estrategia propia.** En una cuenta de 50K el editor, la vista previa y la lista muestran el stop, el take profit y los pasos ya duplicados. Lo que se guarda sigue siendo la base: al guardar no se escribe el doble.
### Notas
- Solo la página. No abre, no mueve y no cierra órdenes.

## [0.10.2] — 2026-11-12
### Cambiado
- **La guía de Grok Bot instala siempre la última versión.** `INSTALAR-CON-GROKBOT.md` y `docs/instalacion/` ya no fijan ningún número de versión. El bot consulta la última release publicada (`releases/latest`), baja el zip de esa etiqueta y comprueba que `VERSION` sea esa etiqueta sin la `v`. `profito-guia.json` guarda la versión, la etiqueta y el commit que se instalaron. El Node portable sigue fijado en `v22.23.4` con su SHA-256.
- **TradingView se reconecta sin preguntar.** Ni la guía ni los accesos piden confirmación para cerrar TradingView. Si no está conectado con la granja, el acceso AI Profit lo cierra y lo vuelve a abrir conectado, solo. El bot sigue sin abrir, reiniciar ni actualizar nada si la granja tiene una operación en curso, pero lo comprueba él, sin preguntar.
- **Sin puertos en lo que ve la persona.** Los mensajes de `acceso/Abrir Granja.bat`, `acceso/abrir-tradingview.bat`, `acceso/AI Profit.command`, `instalar-ai-profit.ps1` e `instalar-ai-profit.command`, el README, `docs/AI-PROFIT-ACCESO.md` y la guía ya no mencionan números de conexión ni la palabra «puerto». Si la granja no arranca, el mensaje es «No pude abrir la granja. Cierra y vuelve a abrir AI Profit.» Los detalles técnicos para el bot están en `docs/instalacion/notas-internas.md`. Los valores reales de conexión del código no cambian.
- **El comprobador ya no tiene una versión fija.** `acceso/comprobar-instalacion.mjs` compara el `VERSION` de la carpeta instalada con su marcador o, con `--ultima`, con la última release publicada. Una carpeta `v0.10.1` ya pasa.
### Notas
- No cambia el motor ni la página (solo el número de versión de la esquina). No abre, no mueve y no cierra órdenes.

## [0.10.1] — 2026-11-10
### Cambiado
- **PROFITO riega solo con el panel abierto.** Riega una flor únicamente mientras el panel de esa cuenta sigue abierto. Cerrar el panel por cualquier vía (la X, un clic afuera o el botón TRADE) corta el riego y esconde la regadera.
- **Abrir el panel lo despierta y lo lleva a la flor.** Siempre se levanta y camina hasta esa flor. No riega desde el banco, tampoco la flor que está justo al lado. El punto donde se para a regar queda al menos a unos 1,25 del asiento.
- **Bajar del banco ya no lo deja pegado.** Ya no recalcula en cada cuadro un camino en línea recta. Si se queda quieto cerca de 1 segundo, busca otro camino, se desliza o rodea. También puede salir del rincón sin salida que hay al sur de la casa.
- **El punto de riego se elige entre varios.** Prueba sitios alrededor de la flor y se queda con uno al que se puede llegar y que tiene espacio libre.
- **La mascota se aparta.** Cuando PROFITO va hacia una flor, la mascota sale del pasillo de su camino hasta que él llega. Si se cruzan, se mueve la mascota, no PROFITO.
- **El agua espera a que esté listo.** La regadera y las gotas salen solo cuando ya llegó al punto final, está quieto y mira la flor. Si lo empujan, el riego se pausa.
- **Se quitó el letrero de dormir.** Ya no aparece «Activado · durmiendo — toca «Agente» arriba». La animación zZ del modelo sigue.
- **Color nuevo «Verde Profit».** Es el verde lima del logo (`#C8E810`) y aparece el primero en el selector de color del agente. El color con el que arranca sigue siendo el blanco.
- **Los colores del agente se ven más vivos.** El cuerpo tiene menos barniz, un brillo suave y más saturación. Las muestras del selector también están más brillantes.
### Notas
- Solo la página (`motor/Granja-de-Cuentas-v2.html`). No abre, no mueve y no cierra órdenes.

## [0.10.0] — 2026-11-10
### Agregado
- **Estrategia «Dos disparos · 1:2»** (`dos-disparos`). Entra a mercado y el stop no se mueve. En una cuenta de 25K: SL −$300 / TP +$630. En una de 50K el motor dobla esos dólares: SL −$600 / TP +$1,260. Hasta 2 intentos al día: el segundo lo abre la persona; el motor no reentra solo. Sigue al final del selector, después de Fast Breakeven. Por defecto siguen 8 MNQ (1 NQ). La estrategia por defecto sigue siendo «Evaluación».
- **Tamaño de cuenta 25K / 50K** (`motor/account-size.mjs`). Se detecta sola: un id `LFE050` / `LFF050` o un token `50K` es 50K; `LFE025` / `LFF025` o un token `25K` es 25K (eso gana aunque el saldo de inicio haya crecido); si no hay id claro y algún saldo de plan es ≥ 45,000, es 50K; si no, 25K. Los dólares de todas las estrategias (SL, TP, pasos, colchón y disparo) se multiplican ×2 en 50K. La cantidad por defecto no se multiplica: sigue en 8 MNQ.
- **Tope de contratos por cuenta (LucidFlex).** Evaluación, sin escalar por beneficio: 25K máximo 20 MNQ (2 NQ); 50K máximo 40 MNQ (4 NQ). Fondeada, según el beneficio sobre el saldo inicial: 25K por debajo de $1,000 → 10 MNQ y desde $1,000 → 20; 50K por debajo de $1,000 → 20, de $1,000 a $1,999 → 30 y desde $2,000 → 40. Si no hay saldo, se usa el techo del plan. El motor publica ese tope, lo comprueba al abrir (antes de cambiar de cuenta) y el panel lo muestra en el control: al cambiar de cuenta recorta la cantidad si se pasa y rearma el deslizador. La cantidad con la que arranca sigue siendo 8 MNQ. Cifras de los artículos de LucidFlex (evaluation, funded y scaling plan) en support.lucidtrading.com.
- **Reglas por tamaño**, las mismas en el servidor, en la página y en el piso de quema: saldo inicial 25,000 / 50,000; drawdown 1,000 / 2,000 (piso inicial 24,000 / 48,000); «Listo por hoy» si el P&L del día llega a −$600 / −$1,200; meta de evaluación 1,250 / 3,000; trail de bloqueo al pasar 1,100 / 2,100 por encima del inicio; el piso bloqueado queda en inicio + $100 en los dos tamaños (no se dobla). La barra de la planta, la barra de drawdown, la flor que se marchita (`atRisk` 300 / 600) y el texto de la meta usan la cifra de esa cuenta. El límite diario de 50K ($1,200) es una suposición: LucidFlex no publica esa tabla; coincide con LucidPro 50K y con 600×2. La meta de 3,000 y el trail en 52,100 son las cifras publicadas de LucidFlex, no el doble exacto de 25K.
- **Vista previa en el gráfico** (`motor/tv-vista-previa.mjs`, `POST /api/vista-previa`). Con el panel de operar abierto, al pasar el cursor por BUY o SELL dibuja la entrada estimada, el SL y el TP. No es una orden: no coloca, no modifica y no cierra nada, y no guarda el dibujo como reporte. Al cerrar el panel, al lanzar la orden o al salir de la página se pide borrar solo esos trazos. Los dólares de la vista usan el tamaño de la cuenta elegida.
### Cambiado
- **Panel de operar en pantallas bajas:** el cuadro tiene alto máximo, se desplaza por dentro y los botones BUY / SELL se quedan pegados abajo.
- **P&L de un trade ganado:** en el resumen, un P&L positivo sale en verde (`#86ffa0`). El negativo sigue en rojo y el cero en neutro.
- **Sonido al ganar:** una sola fanfarria (notas que suben) y, al final, el golpe de la moneda. El mismo sonido vale para cualquier trade ganado; ya no hay una variante corta y otra larga.
- **Celebración al ganar, estilo Mario, unos 5,3 s.** PROFITO (sin brazos) se agacha y da 7 saltos con giros; el 4.º es una voltereta y suena un «Wiii». Cada salto lleva un boing. La mascota brinca y gira, sin ladrar. La casa da botes pequeños y, justo al caer la voltereta (unos 2,63 s), suena un popper y sale confeti en 360° por ventanas, puerta, chimenea, techo y paredes. No hay botón de prueba en la página. En la consola puede quedar `window.__tlProbarCelebracion` para ensayarla con cifras de ejemplo.
- **PROFITO y la mascota no atraviesan árboles**, tampoco el cerezo grande (obstáculo sólido). Si el camino recto está ocupado, rodean por puntos. Si ya estaban dentro, el lazo los empuja fuera.
- **Clic en una flor:** PROFITO camina hasta ella, saca la regadera al llegar y sigue regando mientras esa flor siga seleccionada.
- **Panel de la cuenta:** se quitó la frase «Cada flor que brota es progreso hacia la meta.». Arriba hay un botón grande verde lima «TRADE»: cierra ese panel, abre el de operar con esa cuenta ya elegida y despierta al agente. Ya no pregunta «Esta cuenta opera con dinero real. ¿Continuar?» ni en ese botón ni en el botón del agente dormido de la barra de arriba. La confirmación de BUY / SELL no cambia.
### Corregido
- **Marcas del reporte en TradingView** (`motor/tv-reporte.mjs`). El lector de fills también pide el contrato real (`CME_MINI:MNQZ2026` / `NQZ2026`), igual que las ejecuciones del bróker, y si la API no está trata el caso como TradingView no disponible. Las esperas del mismo cierre pasan a 0, 350, 800, 2,000 y 5,000 ms. Un «sin fills», un chart que aún no está o TradingView caído ya no se archivan para siempre: quedan pendientes y se reintentan al volver a avisar o al reconectar. Un dibujo ya hecho no se repite. El registro anota cuántos fills llegaron y por qué se omitió. No coloca órdenes. En la PC de Bänéd este arreglo estaba preparado y todavía no estaba aplicado en vivo.

## [0.9.0] — 2026-11-06
### Agregado
- **Reporte de trades en TradingView** (`motor/tv-reporte.mjs`). Cuando un trade se cierra de verdad (la granja lo confirma, o el bróker avisa en vivo un cierre manual con fills), dibuja el resultado en el gráfico de ese instrumento: flecha de entrada, línea hasta la salida, caja de SL/TP solo si esos precios se vieron en el bróker, y un recuadro azul con la duración y el P&L. En el gráfico el grupo se llama «reporte» cuando la API lo permite.
- El dibujo se hace una vez, en ese cierre, y el motor no lo vuelve a tocar. Si TradingView no está, o el gráfico está en otro símbolo, se anota como omitido y no se repone al reconectar, al reiniciar ni al recargar.
- El aviso sale después del cierre y no espera a que el dibujo termine: no coloca, no modifica y no cancela órdenes.

## [0.8.5] — 2026-11-06
### Cambiado
- **Botón Negocio:** el botón flotante de abajo a la derecha solo dice «Negocio». El total ya no sale en el botón cerrado; al abrirlo, el neto, lo cobrado y lo gastado siguen igual dentro del panel. Un refresco del libro no vuelve a poner el importe en el botón. Solo página.

## [0.8.4] — 2026-11-05
### Cambiado
- **Etiqueta arriba de cada planta:** si hay nombre propio (`plantName`), se muestra ese. Si no, solo los últimos 3 caracteres del número de cuenta. Vale para el letrero de la planta (árbol fondeado, flor de evaluación y quemada) y para la línea visible de encima (`pfMeta`). El saldo, la barra de P&L y el ojito de privacidad siguen igual. Solo página.

## [0.8.3] — 2026-11-05
### Corregido
- Estrategia «Evaluación con trailing»: ya no muestra «Probabilidad del trade 100%» (era falso; salía del lock a $0 / breakeven). Con trailing (pasos STEPS) la página muestra que mueve el stop a breakeven y protege ganancias, sin porcentaje inventado. Solo página.

## [0.8.2] - 2026-11-05
### Arreglado
- **Listo por hoy usa el P&L del día:** el letrero de 0.8.1 comparaba `saldo − inicial` (P&L total desde 25,000) en vez del P&L del día (`pnlToday` / `dayPnl`). Una cuenta que empezó el día arriba de 25,000 y perdió ≈$600 no mostraba el aviso. Ahora usa `pnlToday` (con `pnlDate`) y el umbral sigue en ≤ −$600. La barra ±1000 no cambia. Solo página.

## [0.8.1] - 2026-11-05
### Agregado
- **Listo por hoy:** si el P&L del día de una planta (saldo − inicial, mismo que la barra) llega a ≤ −$600, aparece arriba un letrero verde tipo pastilla/cristal que dice «Listo por hoy». Solo página; no cambia el motor ni las órdenes. El límite de $600 es el opcional diario de Lucid LucidFlex.

## [0.8.0] - 2026-11-05
### Agregado
- **Rascacielo** (`rascacielo`): estrategia nueva de Karol (PR #19). SL −$600 / TP +$104, stop fijo. Por defecto 8 MNQ / 1 NQ.
### Cambiado
- **`dia-minimo-colchon`** se muestra como **Rascacielo (Dia Minimo+Colchon)** (mismo id y parámetros: SL 600, TP 1600, colchón ~$100). Idea y nombre de Karol (PR #19).
- **`prueba-be`** se muestra como **Fast Breakeven** (mismo id y parámetros). Idea y nombre de Karol (PR #19).
- Orden del selector: Evaluación → Evaluación con trailing → Rascacielo (Dia Minimo+Colchon) → Rascacielo → Fast Breakeven → (propias al final).
### Notas
- Se conservan evaluación por defecto, 8 contratos MNQ, estrategia propia (0.7.4), barra de trades del día (0.7.5) y el resto de main.
- Crédito: Karol (@karocerquera), PR #19; integrado sobre main 0.7.5.

## [0.7.5] - 2026-11-05
### Cambiado
- **Barra superior:** ya no muestra el P&L en dólares. Muestra los trades de hoy de la granja: total, cuántos positivos y cuántos negativos (`Hoy N trades · X+ · Y−`). Usa el mismo día de la granja (`diaFarm` / `_pd`, desde las 4 PM ET). Solo página.

## [0.7.4] - 2026-11-05
### Agregado
- **Estrategia propia:** en el panel de la cuenta (junto al selector de estrategia) el botón «Estrategia propia» abre un cuadro centrado. Ahí se pone el nombre, el stop loss, el take profit y hasta 3 pasos (cuando el trade llega a +$X, protege $Y), con controles deslizantes. Se guarda solo en `estrategias-propias.json`, en la raíz de esta computadora. No se sube a GitHub. La estrategia aparece en el mismo selector que las de siempre y el motor la usa igual (`propia: true`). Rutas: `GET` / `POST` / `DELETE /api/estrategias-propias`.
### Arreglado
- **El botón de operar ya no se queda esperando la lectura de todas las cuentas.** Si hay una lectura completa en curso, se espera como máximo unos 2.5 segundos y se sigue. Un segundo clic mientras arranca dice «esperando lectura…». Mientras arranca un trade no se inicia un recorrido nuevo de cuentas (ni el de todas ni el de solo fondeadas) y esa espera cuenta como actividad reciente.
### Notas
- Las estrategias de serie no cambian. El PR #19 (Rascacielo, Rascacielo + colchón y Fast Breakeven) sigue aparte.
- Se conserva lo de 0.7.3 (nombre de planta, saldo arriba y barra de P&L). Esta entrada pasa a 0.7.4 porque 0.7.3 ya está en main.
- Hay que reiniciar el servidor (solo sin posición abierta ni órdenes pendientes) para la ruta nueva y para el arreglo de la espera. La página se actualiza al recargar (F5).

## [0.7.3] - 2026-11-05
Nombres de planta, saldo arriba y barra de P&L centrada (−1000…+1000). Solo página.

### Agregado
- **Nombre de planta:** en el panel de la cuenta (y en Editar) puedes poner un nombre propio. Se guarda en `granja.v2` (localStorage) y se sincroniza con `negocio.json`. No cambia el id de la cuenta en Tradovate.
- Arriba de cada planta se ven el nombre (o el de la cuenta) y el saldo.

### Cambiado
- **Selector de cuentas del panel de trade:** muestra nombre de planta + número corto (LFE…019), con ⭐/💎/✖. Ya no se repite el nombre por el texto «REAL · …».
- **Barra encima de cada planta:** de −$1,000 a +$1,000 centrada en 0, según el P&L de la cuenta (saldo − inicial). Roja a la izquierda si es negativo, verde a la derecha si es positivo.

## [0.7.2] - 2026-11-04
### Arreglado
- **Selector de cuenta legible:** en el panel de trading en vivo, las cuentas con ⭐ / 💎 / ✖ tenían el texto en color (amarillo `#ffd86b`, celeste `#7fd8ff`, gris `#888`) y no se leían bien sobre la lista blanca de Windows. Ahora usan el color normal (negro sobre blanco en la lista, blanco en el selector cerrado); ⭐ y 💎 van en negrita. La diferencia la da el emoji. Solo página.

## [0.7.1] - 2026-11-04
### Agregado
- **Celebración al ganar:** cuando un trade termina en ganancia (P&L final > 0), aparece confeti en toda la granja, Profito salta y suena una moneda (Web Audio, sin archivos). Con Take profit la celebración es grande y lleva fanfarria, y Profito además da una vuelta. Otras ganancias, o un P&L aproximado, tienen una celebración pequeña. Solo en tu computadora; no se envía nada.
- **Al perder, una nube gris suave:** si un trade cierra en negativo, una nube gris aparece unos segundos sobre la planta de esa cuenta y se desvanece. Profito sigue con su comportamiento normal.
- **Tono de stop loss:** al cerrar por stop loss o con P&L negativo suena un tono bajo, corto y muy suave. No hay sonido aparte para el Take profit: el sonido de la celebración es el de ganar.
- **Botón de silencio 🔊/🔇** encima del ojito, abajo a la derecha. Se guarda en el navegador (`tl_silencio`). Silencia también el tono de pérdida. El sonido se activa con el primer clic en la página (regla de los navegadores).
### Arreglado
- **El resumen del último trade volvía a aparecer al recargar (F5):** ahora solo se muestra (y se celebra) si es más reciente que el último visto (`tl_ultimoResumen`) y que la carga de la página.
### Cambiado
- La versión (`tl-version`) pasa a la esquina inferior izquierda para que los botones no la tapen.

## [0.7.0] - 2026-11-04
### Arreglado
- **La mascota (Profito) volvía a quedarse quieta por una planta del Jardín de logros:** las parcelas movidas por el cerezo caían junto al punto de inicio del campesino y lo dejaban encerrado. Ahora se mueven a un sitio libre (`CZ_FLOW_TO`).
### Agregado
- **Profito sale dormido:** al abrir o recargar la granja, empieza en pausa y Profito duerme en su banco hasta que se active el agente. Es la pausa visual de la granja; no toca el motor de trading ni los stops.
- **Profito riega con laptop durante un trade:** mientras hay una operación activa («Operando…»), se acerca a una planta y la riega con una regadera de voxels (con gotas) mientras sostiene una laptop pequeña con la pantalla encendida. El trade tiene prioridad sobre la pausa. Al terminar vuelve a lo normal.
- **Marcadores de etapa ⭐/💎 con saldo:** en el selector de cuentas del panel de trade, cada cuenta muestra su saldo entre paréntesis y un marcador: 💎 fondeada (`LFF…`), ⭐ evaluación con un trade positivo (saldo ≥ inicial + $550; le falta uno), ✖ quemada. Orden: fondeadas, ⭐, el resto, quemadas. Las barras de progreso de la granja muestran el mismo marcador (una sola regla compartida). No cambia la cuenta elegida por defecto ni la lógica de órdenes.
- **Ojito de privacidad:** botón con un ojo abajo a la derecha. Al cerrarlo se difuminan todos los importes ($, saldos, P&L, panel Negocio), también los que se actualizan en vivo; en el selector de cuentas el saldo se cambia por «(•••)». Los % y ⭐/💎 siguen visibles. Se guarda en el navegador (`tl_privado`), sigue después de F5.

## [0.6.4] - 2026-11-04
### Cambiado
- La etiqueta de las cuentas de evaluación (`LFE…`) dice solo «🌱 Evaluación» (antes «Evaluación · no fondeada»). Solo texto.

## [0.6.3] - 2026-11-04
### Cambiado
- **Estrategia por defecto de vuelta a «Evaluación»** (`evaluacion-simple`) en la página y el servidor. Se mantienen 8 contratos MNQ por defecto.

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
