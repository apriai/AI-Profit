# Registro de cambios

Todos los cambios importantes de Prop Farm / TradingLink (Ai Profit Camp) se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## Cómo se versiona
- **Arreglo** (corrige algo sin agregar funciones): sube el último número. Ejemplo: `0.2.0` → `0.2.1`.
- **Función nueva**: sube el número del medio y el último vuelve a cero. Ejemplo: `0.2.1` → `0.3.0`.
- **`1.0.0`**: cuando la granja sea estable para que la usen otras personas.
- **Cada pull request debe subir el archivo `VERSION` y agregar una entrada en este `CHANGELOG.md`** (arriba, con la fecha). También hay que actualizar el texto de respaldo `vX.Y.Z` que se ve en la esquina de la granja (`motor/Granja-de-Cuentas-v2.html`, el bloque `tl-version`).
- La versión actual está en el archivo `VERSION` y se muestra, pequeña, en la esquina inferior derecha de la granja.

## [0.10.69] — 2026-11-26
### Corregido
- **El ojo de «Gex - Put/Call Walls»** ahora respeta lo que elijas. Al escribir los niveles en el indicador, la granja confirmaba con una comparación exacta de decimales; si TradingView devolvía un decimal un poco distinto, la confirmación fallaba y la granja reescribía el indicador cada 15 segundos, deshaciendo el ojo. Ahora: compara con tolerancia de medio centavo, no reescribe si ya está igual, espera 2 minutos antes de reintentar si falla, y deja el indicador visible u oculto como estaba antes de escribir.
- Al apagar o prender un indicador del ojo, se comprueba que TradingView lo cambió de verdad (si la API no lo cambia, se usa el modelo del gráfico) y se cambian todas las copias con ese nombre. Si no se pudo, lo dice en vez de marcar que sí.
- El servidor anota en su registro cada vez que se mueve un ojo (visible u oculto, por dónde y cuántas copias) y `gex.log` anota si el ojo se restauró al aplicar los niveles.
### Notas
- Los niveles anteriores se siguen mostrando si falla una descarga (no cambia). Session Levels y Profito Algoritmo no cambian.
- No cambia las órdenes. No se toca la barra de la mascota (`__tlViz`).

## [0.10.68] — 2026-11-26
### Añadido
- **«Gex - Put/Call Walls» en el ojo**, justo debajo de Profito Algoritmo, con el mismo ojito para mostrarlo u ocultarlo. Empieza visible. Es un indicador de Pine que se instala solo, igual que Profito Algoritmo.
- La granja baja las opciones de QQQ y SPY de CBOE a las **8:00, 9:30, 9:50, 11:00 y 12:00 (hora de Nueva York)**, solo en días de mercado, y una vez al arrancar. Usa solo las de vencimiento de hoy (0DTE) con open interest mayor que 0. Calcula Call Wall, Put Wall, Top GEX y Zero Gamma de cada una, y los escribe en el indicador. El indicador los pasa a NQ con el ratio en vivo y dibuja zonas de ±20 puntos, transparentes, y el Zero Gamma con líneas grises finas (NQ sólida, SPY punteada). Lo que sale de QQQ se llama «NQ …».
- **«Session Levels (High/Lows)» en el ojo**, justo debajo de Gex - Put/Call Walls, con el mismo ojito. Empieza visible. Es un indicador de Pine que se instala solo; no necesita datos de la granja.
- Cada vuelta anota en `gex.log` cuánto tardó: descarga de QQQ y de SPY, cálculo (y el Zero Gamma), aplicar en TradingView y total.
### Cambiado
- El botón «Descargar Logs y status» del ojo es más chico, queda a la izquierda, la letra es de 10 px y el texto cabe en una sola línea.
- En el ojo, Profito Algoritmo dice «Instalado» en vez de «instalado v2».
- En media sesión (como el día después de Thanksgiving) las opciones vencen a la 1:00 PM ET. El cálculo del GEX de la barra también lo usa.
### Notas
- Con el panel de operar abierto o un trade abierto no se calcula ni se cambia el indicador. Queda pendiente y corre en cuanto se cierra.
- No cambia las órdenes. No se toca la barra de la mascota (`__tlViz`).

## [0.10.67] — 2026-11-25
### Corregido
- **El color del Profito ya no se ve a través del sombrero** en la granja. Se tapa por dentro con un oclusor invisible y se baja un poco la punta del cuerpo, justo debajo del ala. La forma, los colores y la banda del sombrero no cambian.
### Notas
- No cambia las órdenes. No se toca la barra de la mascota (`__tlViz`) ni el muñequito que corre hacia el SL y el TP.

## [0.10.66] — 2026-11-25
### Añadido
- **Resumen de trades en TradingView.** Al pasar de No a Sí se dibujan los cierres de hoy, el día de calendario de Nueva York (de las 00:00 a las 24:00), con todas las ejecuciones del bróker. Al pasar de Sí a No se quitan esos dibujos y no se tocan los del usuario. Si TradingView no está conectado, no se marcan como dibujados. No barre al arrancar.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.65] — 2026-11-25
### Eliminado
- **Evaluación con rascacielos** ya no está en el selector. El id `evaluacion` cae en Evaluación, igual que una selección guardada que ya no existe. Un trade que ya estaba abierto sigue con las reglas que tenía al empezar.
### Notas
- Las demás estrategias no cambian. No cambia las órdenes ni la mascota.

## [0.10.64] — 2026-11-25
### Corregido
- **Las estrategias propias se reparan solas.** Si `estrategias-propias.json` está vacío, trae una marca de texto, es una sola estrategia, usa `estrategias` o trae las estrategias como objeto, se lee igual. Si el archivo está cortado o el formato no se reconoce, se copia tal cual a `estrategias-propias.corrupto-AAAAMMDD-HHMMSS.json` (se quedan las últimas 5), se escribe uno nuevo con lo que se pudo rescatar y ya se puede listar, guardar y borrar. La granja avisa una vez, sin bloquear.
### Notas
- El zip de «Descargar Logs y status» incluye `estrategias-propias.json`. No cambia las órdenes ni la mascota.

## [0.10.63] — 2026-11-25
### Corregido
- Un trade nuevo ya no hereda el promedio ni el tamaño de un Agregar anterior. El resumen usa la entrada y los contratos de ese trade.
- Las últimas 24 h siguen acotando la lectura del registro de eventos. Las ejecuciones del bróker no se recortan, para no emparejar mal la ida y la vuelta ni guardar mal el día.
- El SL y el TP recalculados de Agregar solo se usan si el cálculo salió bien. Si no, se quedan los de la cotización.
- Si el stop ya protegía, Agregar deja anotado ese precio como stop protegido.
- El aviso de que la pérdida abierta usa parte del riesgo solo sale cuando el P&L está en rojo.
- Los puntos, si no hay promedio de entrada y de salida, salen del P&L bruto antes que del primer y del último fill.
### Notas
- No cambia la mascota.

## [0.10.62] — 2026-11-25
### Corregido
- **La columna Puntos ya no sale en blanco.** Si el bróker trae el promedio de entrada y de salida, se usan esos. Si no, los precios guardados del trade (también en `historial/<día>.json` y en el cierre de la granja). Si tampoco están, los puntos salen del P&L bruto dividido por los contratos y el valor del punto (MNQ $2, NQ $20, MES $5, ES $50). «—» solo queda cuando no hay ninguno de esos datos.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.61] — 2026-11-25
### Corregido
- **Agregar usa el fill real.** Después de entrar a mercado, el SL y el TP se vuelven a calcular con el promedio y la cantidad que devolvió el bróker (el mismo riesgo en dólares y la misma meta del TP). Si el fill vino peor que la cotización, el stop no se queda más apretado. Si no hay promedio real, se dejan los precios de la cotización. El antes y el después quedan en `colchon.log`. Si no se pueden alinear, solo avisa «Revisa SL/TP en Tradovate» y no cierra.
- **El resumen aproximado, después de Agregar, usa el promedio y el tamaño nuevos**, con la comisión de todos los contratos. Sigue saliendo al momento y el bróker lo sustituye si llega; no se agregó espera.
### Añadido
- En Agregar, antes de confirmar, se ve en amarillo cuántos puntos hay del precio al SL de ahora y al SL nuevo (por ejemplo «SL: 75 → 8 pts del precio») y que la pérdida abierta ya usa parte del riesgo. Confirmar sigue disponible.
- En el historial, la columna **Puntos** (después de Resultado) muestra los puntos por contrato con signo, desde el promedio de entrada y el de salida de las ejecuciones. Si faltan, sale «—».
### Cambiado
- **Volver**, en el detalle de un trade, pinta al momento la lista que ya estaba cargada y el mismo scroll. Si hace falta, refresca detrás sin bloquear ni parpadear.
- Al abrir Historial o Métrica se leen solo las últimas 24 h (la sesión de hoy). Semana, mes, todo u otro día se piden cuando se eligen, con el mismo resultado de antes.
### Notas
- No cambia la barra de la mascota. No aplana la posición si Agregar no puede mover el stop.

## [0.10.60] — 2026-11-25
### Cambiado
- El GEX neto de QQQ se ve en la barra de arriba: «GEX + · Día de rango» o «GEX − · Día de expansión». Ya no se dibujan muros ni el gamma flip en TradingView, y el reloj de la barra se quitó. Sigue el cálculo cada 20 minutos y el registro en `gex.log`. Si hay un trade abierto, esa vuelta se salta.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.59] — 2026-11-25
### Añadido
- **«Muros GEX en TradingView»** en el ojo, debajo del resumen. Empieza en Sí. Cada 20 minutos baja las opciones de QQQ, calcula el call wall, el put wall y el gamma flip, y los dibuja en el gráfico de NQ. Si hay un trade abierto, se salta esa vuelta. Si la descarga falla, se quedan las líneas anteriores. El tiempo queda en `gex.log`.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.58] — 2026-11-25
### Cambiado
- En el ojo de Profito Algoritmo, la etiqueta del sonido ahora dice «Sonido de un Profito en TradingView». El interruptor sigue siendo el mismo.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.57] — 2026-11-25
### Añadido
- **«Descargar Logs y status»** al final del ojo de Profito Algoritmo. Guarda en Descargas un zip `Profito-logs-AAAA-MM-DD_HHMM.zip` con los `.log` de Profito (también `datos/logs/`, como `servidor.log` y `lanzador.log`, y `tradinglink.log` de Mac) y un `status.json` (versión, sistema, conexión, cuentas, drawdown, pérdida diaria e interruptores). Cada registro entra con sus últimas 5 MB. No incluye claves ni tokens, tampoco si van entre comillas en JSON.
### Notas
- No cambia las órdenes ni la mascota. El instalador también copia `motor/descargar-logs.mjs`.

## [0.10.56] — 2026-11-25
### Corregido
- El instalador ahora copia `motor/resumen-tv.mjs`. Sin ese archivo el motor no arrancaba (`ERR_MODULE_NOT_FOUND`) y la ventana decía que localhost no respondía.
### Notas
- No cambia las órdenes ni la mascota.

## [0.10.55] — 2026-11-25
### Añadido
- **Interruptor «Resumen de trades en TradingView»** en el ojo de Profito Algoritmo, debajo de «Sonido de la señal». Empieza en Sí. En No, el motor no dibuja el cierre en el gráfico. El P&L, el resumen de la granja y los registros siguen igual. La preferencia queda en el motor y aguanta un reinicio.
### Notas
- No cambia las órdenes ni Agregar/Promediar.

## [0.10.54] — 2026-11-25
### Cambiado
- **Agregar/Promediar ya no bloquea por daily loss ni por drawdown.** Si el SL nuevo se pasa de lo que queda, el cajón muestra un aviso amarillo («Este SL se pasa de tu daily loss» o «Este SL se pasa de tu drawdown») y Confirmar sigue. La persona decide. Siguen bloqueando el tope de contratos, un stop ya tocado, una distancia inválida y el redondeo.
### Notas
- No cambia el envío de la orden ni la barra de la mascota.

## [0.10.53] — 2026-11-25
### Cambiado
- **El resumen del cierre sale al momento.** La guarda de flat pide 2 lecturas vacías, unos 450 ms, y sigue exigiendo que no queden SL ni TP activos. El panel muestra enseguida el P&L aproximado, con «(aprox.)». Si en unos 3 s llega el P&L de las ejecuciones, se actualizan el resumen, la granja y `colchon-resumen.json` en el mismo cierre. Si no llega, se queda el aproximado. El sonido y la celebración suenan una sola vez.
### Notas
- No cambia el envío de órdenes ni la barra de la mascota.

## [0.10.52] — 2026-11-25
### Cambiado
- **Agregar/Promediar ya no deja el SL y el TP sueltos.** La suma entra a mercado con su propio bracket (el SL y el TP recalculados, ligados entre sí, del tamaño que se agrega). Después solo se cambia el precio del stop y del objetivo que ya estaban, nunca la cantidad. No se cancela nada y no hay un hueco sin stop. Si ese precio no queda, se reintenta una vez y el panel dice «Revisa SL/TP en Tradovate». No se cierra la posición. Cuando el colchón mueve el stop o el objetivo, cambia todos los de la posición.
### Notas
- Vale en la cuenta que ya está operando. No cambia la barra de la mascota ni el aspecto del panel.

## [0.10.51] — 2026-11-25
### Cambiado
- **Agregar/Promediar cancela el bracket viejo y pone uno nuevo.** Primero entra a mercado sin SL ni TP y lee el promedio real. Después cancela el stop y el objetivo anteriores y coloca uno de cada uno para toda la posición. Si eso no se verifica, lo reintenta una vez. Si sigue fallando, el panel dice «Sin SL/TP, ponlos a mano» y no cierra la posición. Ya no se agranda la cantidad de las órdenes viejas.
### Notas
- Vale en la cuenta que ya está operando. No cambia cómo abren las otras estrategias.

## [0.10.50] — 2026-11-25
### Añadido
- **Agregar/Promediar** en el panel del trade abierto. Suma contratos a mercado a la posición que ya está abierta y deja un solo SL y un solo TP para toda la posición. El riesgo en dólares se conserva (o la ganancia neta, si el colchón ya se movió) y el objetivo neto no baja. Sigue bloqueando el tope de contratos, el daily loss y el drawdown. El cajón pide Confirmar antes de enviar.
### Notas
- No cambia cómo abren las estrategias que ya estaban. La mascota del panel no cambia.

## [0.10.49] — 2026-11-25
### Añadido
- **Estrategia «Dia minimo (+ Colchon)»** (`dia-minimo-mas-colchon`), justo después de Rascacielo (Dia Minimo+Colchon). En 25K: SL −$100 / TP +$1,600 y el stop protege ~$100 netos. En 50K: SL −$150 / TP +$3,200 y el stop protege ~$150 netos. El disparo es ese neto más la comisión, 1 tick y el mismo extra, también según el tamaño ($15 en 25K, $22.50 en 50K). Sube una sola vez y el trade sigue hasta el TP o el SL. Solo sube, nunca baja. Las demás estrategias no cambian.
### Notas
- No cambia el envío de órdenes de las estrategias que ya estaban.

## [0.10.48] — 2026-11-24
### Arreglado
- **El DD restante usa el pico de cierre del servidor**, no un saldo intradía. Si la flor tenía un pico más alto, lo baja al pico de las 16:00 ET. En una 25K, el piso sigue siendo ese pico menos $1,000.
### Notas
- El pico llega en `/api/colchon/accounts` como `eodPeak`, leído de `sod.json`. No cambia el envío de órdenes.


## [0.10.47] — 2026-11-23
### Cambiado
- **El P&L de sesión de la flor es el saldo del bróker menos el saldo al empezar la sesión** (16:00 ET). Ya no suma trades aproximados. Si no hay foto de esta sesión, usa el primer saldo visto. Solo si no hay saldo se suman los trades.
### Notas
- La foto queda en `sesion-saldo.json`, en la carpeta de datos, y no se sube. No cambia el envío de órdenes.

## [0.10.46] — 2026-11-23
### Cambiado
- **La flor muestra el P&L de la sesión de esa cuenta**, de las 16:00 ET a las 16:00 ET del día siguiente. La fila se llama «P&L sesión» y el número es el neto, ya con las comisiones descontadas. Si esa cuenta tiene trades en la sesión, se suman. Si no, se usa el P&L del día que guardó el bróker.
### Notas
- No incluye la posición abierta. No cambia el envío de órdenes.

## [0.10.45] — 2026-11-20
### Arreglado
- **El panel sale de la operación abierta cuando el servidor ya la cerró**, también si se cerró a mano en TradingView o si hay otra ventana de la granja. El aviso de «ya visto» solo evita repetir la celebración. Si una lectura falla, el panel sigue preguntando.
### Notas
- No cambia el envío de órdenes.

## [0.10.44] — 2026-11-20
### Cambiado
- Al terminar una operación, el globo del agente dice «Operación terminada».
### Notas
- El resumen sigue diciendo «Resumen · Prueba» cuando no hay nombre de estrategia, y la confirmación de cuenta real sigue igual.

## [0.10.43] — 2026-11-20
### Arreglado
- **El granjero y la mascota ya no atraviesan la silla** junto a la casa. Usa el mismo disco sólido que el cerezo: si el camino pasa por encima, lo rodean, y si ya estaban dentro, el lazo los saca. Dormir en el banco sigue igual.
### Notas
- No cambia órdenes ni el sonido del panel.

## [0.10.42] — 2026-11-20
### Arreglado
- **El tirador despierta con un círculo en las 3 velas anteriores**, aunque esa vela no sea la que se está formando. El estudio solo devuelve velas con círculo; la vela viva se toma de la serie principal (y, si falta, del reloj). Cuando la vela del círculo ya salió de esas 4, el tirador se duerme.
### Notas
- No cambia el sonido, el dibujo ni el envío de órdenes.

## [0.10.41] — 2026-11-20
### Arreglado
- El instalador vuelve a copiar `motor/ajustar-profito.mjs`. Sin ese archivo el servidor no arrancaba (`ERR_MODULE_NOT_FOUND` desde `rutas-api.mjs`).

## [0.10.40] — 2026-11-20
### Cambiado
- **El tirador dormido es el Profito blanco aprobado.** Respira, lleva las z y la barra ya no se pone gris. Con círculo, el despierto tiene un borde verde que brilla. El texto dice «Ajustar a último Profito» y, al soltar al final, «Activo». Ese brillo recorre las letras también apagado. Al completar el desliz suena el desbloqueo.
- **Las barras de Cuenta y Estrategia quedan centradas**, del mismo ancho. El nombre ya no empuja el selector.
- **Si el círculo se apaga y la vela sigue entre las últimas 4,** el stop se queda en la apertura guardada y el objetivo y los contratos se recalculan cada segundo con el precio vivo. Cuando esa vela sale de las 4, el tirador se duerme solo y suena una vez el tono bajito de una operación perdida. Apagarlo a mano no suena.
### Notas
- No abre la orden. El dibujo dormido es el de `assets/profito-dormido.png`.

## [0.10.39] — 2026-11-20
### Cambiado
- **Sin círculo, el tirador es el Profito dormido:** la cara real con los ojos tapados y una «u» fina en el mismo lugar, en gris, y las z de la granja. Con círculo, se ve el Profito despierto (ojos abiertos, verde) y ya se puede deslizar. Activado, sigue despierto y la pista se ilumina.
- **El HTML abierto como archivo tiene un botón Demo** para pasar de sin círculo a con círculo y ver los tres estados. Dentro de la app, sin círculo, sigue bloqueado.
### Notas
- El dibujo dormido está en `assets/profito-dormido.png`, hecho a partir de `assets/profito-icon-1024.png`.

## [0.10.38] — 2026-11-20
### Cambiado
- **El tirador de la pista es el dibujo real del Profito despierto** (`assets/profito-icon-1024.png`, la misma cara que `assets/favicon-512.png`). Apagado, esa imagen se ve en gris y siguen las z de la granja. No hay un dibujo aparte del Profito dormido.
### Notas
- El HTML abierto como archivo sigue dejando probar el deslizador. Dentro de la app, sin círculo, sigue bloqueado.

## [0.10.37] — 2026-11-20
### Cambiado
- **El Profito despierto de la pista es la esfera verde lima de la granja:** brillo arriba a la derecha, borde más oscuro y dos ojos en píldora vertical, juntos y un poco arriba del centro. Los ojos dormidos, en «u», usan el mismo lugar.
### Notas
- No cambia el stop, el objetivo ni los contratos. El HTML abierto como archivo sigue dejando probar el deslizador.

## [0.10.36] — 2026-11-20
### Cambiado
- **Los ojos del Profito dormido en la pista son más chicos, más finos y más separados**, como en el granjero: una «u» oscura a cada lado de la cara, a media altura. Los del despierto usan la misma posición.
- **El HTML abierto como archivo deja deslizar la pista**, para probar dormir y despertar sin TradingView. Dentro de la app, sin círculo, sigue bloqueada.
### Notas
- No cambia el stop, el objetivo ni los contratos.

## [0.10.35] — 2026-11-20
### Cambiado
- **Los ojos del Profito dormido en la pista son la misma «u» del granjero.** Y la pista queda centrada en el panel.
### Notas
- No cambia el stop, el objetivo ni los contratos.

## [0.10.34] — 2026-11-20
### Cambiado
- **La pista de «Ajustar a último Profito» es corta.** El texto solo dice «Desliza». Apagado, el tirador es el Profito gris dormido, con las mismas z que usa cuando duerme. Activado, es el Profito despierto en Verde Profit (`#C8E810`), el verde de marca.
### Notas
- No cambia el stop, el objetivo ni los contratos.

## [0.10.33] — 2026-11-20
### Añadido
- **«Ajustar a último Profito» en el panel de operar.** Se prende deslizando el círculo de Profito hasta el final de la pista (el mismo verde o rojo del indicador). Si no se suelta al final, el círculo vuelve con un rebote. Tocarlo o devolverlo lo apaga. Solo se puede deslizar si hay un círculo del algoritmo en la vela abierta o en las 3 velas cerradas de justo antes. Si no hay, la pista queda atenuada, el círculo gris y el cursor no lo permite. Al activarla, el stop queda en la apertura de la vela del círculo más reciente, el objetivo a la misma distancia del otro lado, y los contratos salen del riesgo en dólares de la estrategia, sin pasar el tope de la cuenta (25K o 50K). Si el círculo se va, se quedan esos números mientras siga activada. Si aparece otro, se recalculan. No abre la orden: BUY o SELL siguen mandando, con el stop y el objetivo en la misma orden. Si el stop quedaría del lado incorrecto del precio vivo, no se envía y el panel lo dice.
### Notas
- No cambia el sonido del algoritmo ni cómo se mueve el stop después de entrar.

## [0.10.32] — 2026-11-19
### Cambiado
- **La explicación bajo Estrategia ya no se repite.** Solo queda el texto corto. Si el stop se mueve una vez (Fast Breakeven) se añade «Se mueve una sola vez.» Si es un colchón o tiene escalones, «Solo sube, nunca baja.» Si el stop no se mueve, el texto corto queda igual. Los dólares siguen saliendo de la cuenta, 25K o 50K.
- **El sonido del algoritmo solo suena en la vela que está abierta.** Al cambiar de marco, las velas ya cerradas que van apareciendo mientras carga no suenan y no tapan la vela en vivo. Tras el cambio espera ~1 s a que la lectura se quede en la misma barra. En esa vela sigue sonando cada vez que el círculo se enciende.
### Notas
- No cambia la orden ni el motor.

## [0.10.31] — 2026-11-19
### Corregido
- **El resumen usa el mismo P&L que el historial.** Al cerrarse la posición se lee la ida y vuelta de las ejecuciones del bróker (hasta ~3 s si tardan). El número es el de la fila, ya con la comisión. Solo si no se puede leer se queda el P&L aproximado. El motivo sale del precio de salida: a 1 pt del stop protegido es Stop loss, a 1 pt del objetivo es Take profit.
- **Detener y cerrar, con el trade abierto, cierra al momento.** Ya no pregunta.
- **BUY y SELL no preguntan si la cuenta es real.** La orden sale directo. El servidor sigue comprobando la cuenta. El registro dice «sin confirmación (desactivada)».
### Notas
- No cambia cómo se abre la orden ni cómo se mueve el stop.

## [0.10.30] — 2026-11-19
### Corregido
- **El reajuste al fill espera a que aparezcan el SL y el TP.** La posición puede verse en menos de un segundo, antes de que TradingView liste las órdenes hijas. Mientras faltan, no se reajusta y no se marca como hecho: se vuelve a mirar cada ~150 ms, hasta 2 s desde que se vio la posición. El paso, si toca, se mueve en cuanto el stop existe. Cuando están las dos, el reajuste sigue en orden (SL y después TP) y no baja un stop ya protegido. Si a los 2 s siguen sin verse, se dejan como se enviaron y el registro dice «Ajuste por fill omitido», sin aviso en pantalla. El fallo de un reajuste que sí se intentó también queda solo en el registro. Cuando aparecen, se anota «SL/TP visibles a los … ms».
- **El sonido de Profito Algoritmo no suena por barras viejas al cambiar el marco de TradingView.** Al cambiar de marco o de símbolo, o en la primera lectura, solo reanuda el estado y no suena. Una barra más vieja que la ya vista en ese marco se ignora. En la vela en curso sigue sonando cada vez que el círculo pasa de apagado a encendido. Cada sonido y cada reanudación quedan en el registro.
### Notas
- La orden sigue siendo una sola. No cambia cómo se decide el paso.

## [0.10.29] — 2026-11-19
### Añadido
- **El beneficio del DOM también decide el paso.** El P&L que ya llega del DOM (~cada 120 ms) entra como una fuente más, junto al gráfico, al bid/ask y al bróker. Gana la más alta que siga fresca. Solo cuenta si es de la misma cuenta y del mismo símbolo, en dólares de la posición. Un cero, un texto raro o el de otra cuenta no mueven el stop. El registro del paso dice `(dom)` cuando esa fue la que disparó.
### Corregido
- **La foto de ejecuciones y de historial, antes de enviar, no se queda colgada.** Cada lectura tiene un tope de ~300 ms. Si no llega, se envía igual con lo que se alcanzó a leer y se marca la foto como incompleta: después no se dice «no se llenó» por una lista a medias. El tiempo sale en `TIEMPOS:` como `snapshot`, aparte de placeOrder.
- **El aviso «Se llenó y se cerró» se cierra solo a los 6 s**, igual que Bloqueado, y así se suelta la pausa del recorrido de cuentas.
- **Si al llenarse el P&L ya pasó el disparo, el paso mueve el stop antes del reajuste.** La entrada es el precio real del fill. El reajuste sigue en orden (SL y después TP) y no baja un stop que el paso ya dejó más protegido. `TIEMPOS:` anota el orden (`paso→ajuste` o `ajuste`).
### Notas
- Después del fill, el stop se mueve como antes. La orden sigue siendo una sola.

## [0.10.28] — 2026-11-19
### Cambiado
- **Se quitó la estrategia Rascacielo de stop fijo** (SL −$600 / TP +$104). Sigue Rascacielo (Dia Minimo+Colchon). Si una selección guardada pide el id `rascacielo`, se usa la estrategia por defecto.
- **Evaluación con trailing ahora se llama Evaluación con rascacielos.** El id sigue siendo `evaluacion`. SL −$630 / TP +$630. En vez de tres escalones hay un solo colchón, el mismo del día mínimo: protege ~$100 netos, se mueve una vez y el trade sigue hasta el TP o el SL. En 50K los dólares se duplican.
### Notas
- No cambia cómo el motor mueve el stop. Solo qué estrategia se elige.

## [0.10.27] — 2026-11-19
### Corregido
- **Si la posición llega tarde, se vigila hasta un minuto y se gestiona.** Ya no se da por terminada a los 14 s con «se llenó y no aparece la posición». Si aparece dentro de ese minuto, entra al bucle de siempre. No se reenvía la orden.
- **Una ejecución vieja o sin hora no cuenta como este trade.** Hace falta marca de tiempo, y se descartan los ids que ya existían antes de enviar. Un rechazo o una orden que sigue trabajando se mira antes de decir que se abrió y se cerró.
- **Si no se pueden leer las ejecuciones, el registro lo dice.** No se inventa un «no se llenó» ni un cierre.
- **El registro dice de qué precio salió el bracket** (ask, bid, último o el lado opuesto), la edad de la cotización y si hubo que recalcularlo.
- **«Se llenó y se cerró» se muestra como aviso**, no bajo el título Bloqueado ni con el texto de las cuentas Lucid.
### Notas
- Después del fill, el stop se mueve como antes. La orden sigue siendo una sola.

## [0.10.26] — 2026-11-19
### Corregido
- **La orden de las 9:47 ya no se da por no llenada cuando el bróker sí la llenó.** El SL y el TP de la orden a mercado salían del cierre de la vela. En Rascacielo, con 20 MNQ, el objetivo son 2.5 pts. Ese día el fill fue 27727.75 y el cierre de la vela iba unos 3.5 pts más abajo, así que el límite de venta nacía en 27726.75, ya por debajo del precio, y Tradovate lo ejecutó en el mismo segundo (−$52.50 brutos y −$20 de comisión). Profito miró 6 s si había posición abierta, no la vio y escribió «no se llenó». Ahora el bracket se calcula con el precio vivo (ask en compra, bid en venta) justo antes de enviar, en la misma orden. Si el SL o el TP quedarían dentro del precio, se recalculan y, si siguieran dentro, no se envía nada. Si la orden se abre y se cierra en esa ventana, el registro dice «se llenó y se cerró» con los precios, y no se vuelve a enviar.
### Cambiado
- **Menos idas a TradingView antes de la orden.** Entre el clic de BUY o SELL y placeOrder quedan dos lecturas: la cuenta (y el cambio, si hace falta), el contrato y que no haya posición; y la cotización viva. Siguen la confirmación de cuenta real y «Elige una cuenta».
- **Tiempos en el registro.** Cada apertura deja una línea `TIEMPOS:` (clic, preparativos, cotización, placeOrder, posición, total). Cada movimiento del stop deja `LATENCIA: envío … ms · confirmación … ms`.
- **El panel de operar pausa el recorrido de cuentas.** Mientras está abierto, la granja no cambia de cuenta en TradingView para leer saldos. Al cerrarlo sigue. Si la página se cierra sin avisar, la pausa caduca sola.
### Notas
- La orden sigue siendo una sola, a mercado, con SL y TP en el mismo envío. Después del fill, el stop se mueve como antes.

## [0.10.25] — 2026-11-19
### Cambiado
- **El sonido del círculo suena cada vez que vuelve a aparecer.** En la vela que se está formando, Burbuja doble suena al pasar de sin círculo a círculo. Si el círculo se apaga y vuelve en esa misma vela, suena otra vez. Mientras sigue a la vista, no se repite. Al cerrar la vela se olvida. El interruptor «Sonido de la señal» sigue igual. BUY y SELL siguen en silencio.
### Notas
- No abre, no mueve y no cierra órdenes.

## [0.10.24] — 2026-11-18
### Corregido
- **El icono de Profito se ve nítido en Windows.** La carita verde se pinta a 1024 y de ahí salen los tamaños 16, 20, 24, 32, 40, 48, 64, 96, 128 y 256, sin agrandar un dibujo chico. La ventana de la granja (Chrome en modo aplicación) usa el favicon de 192 y de 512 y el manifiesto. El acceso del instalador, el del menú Inicio y el icono junto al reloj usan ese mismo `.ico`.
### Notas
- No abre, no mueve y no cierra órdenes.

## [0.10.23] — 2026-11-18
### Corregido
- **El menú del ojo queda sólido aunque se abra el archivo directo.** Al abrir `Granja-de-Cuentas-v2.html` en el navegador, sin servidor, el panel se marcaba desconectado y bajaba al 40 % de opacidad: se veía el árbol y el texto lavado. Ahora el panel sale de la barra (esa barra se desvanece al entrar), el fondo es `#1a1230` opaco y el texto es blanco. También al servirlo en localhost.
### Notas
- No abre, no mueve y no cierra órdenes. Solo es la página.

## [0.10.22] — 2026-11-18
### Corregido
- **El menú del ojo se lee sobre los árboles.** El panel de Profito Algoritmo, el aviso de instalación, el color del agente y la confirmación de activarlo quedan en un violeta casi opaco, con borde y sombra. El texto queda claro. La barra de arriba sigue en cristal.
### Notas
- No abre, no mueve y no cierra órdenes. Solo es la página.

## [0.10.21] — 2026-11-18
### Corregido
- **Abrir la granja ya no se cae en el Negocio.** Las cuentas ya vistas y las quemadas llegan como un conjunto (y, en instalaciones viejas, como un objeto o un texto). El Negocio las pedía como lista y al abrir salía «Algo salió mal». Ahora las acepta todas. Si el Negocio falla, la granja sigue abierta.
### Notas
- No abre, no mueve y no cierra órdenes.

## [0.10.20] — 2026-11-18
### Agregado
- **Suena cuando el círculo de Profito Algoritmo aparece en la vela que se está formando.** Una vez por vela y dirección: si se apaga y vuelve en la misma vela, no se repite. Si el indicador está oculto o no está en el gráfico, no suena. El interruptor «Sonido de la señal» queda encendido; se guarda en el navegador. El silencio general lo apaga también. BUY y SELL siguen en silencio. No lee ni toca órdenes ni la cuenta.
### Notas
- No abre, no mueve y no cierra órdenes.

## [0.10.19] — 2026-11-18
### Corregido
- **Cualquier cuenta se reconoce, no solo las que empiezan por LFE.** El saldo, la flor, el Negocio, el tamaño y la etiqueta usan la lista del bróker (`/api/colchon/accounts`) junto con `accounts.json`. Si el nombre no dice el tipo, se trata como evaluación. En el Negocio, un libro vacío anota la compra con el precio guardado (`tl_price`) y la nota «monto estimado — edítalo». Si el libro ya tiene esa cuenta, no se anota otra vez. Una fondeada que desaparece se marca quemada aunque el nombre no sea LFF.
- **Toda cuenta Lucid se puede operar, aunque el nombre no empiece por LFE o LFF.** El menú no deja la fila en gris por el nombre. `orders.mjs` ya no rechaza ese nombre. Paper y demo siguen siendo paper. La confirmación de cuenta real, la cuenta activa y el tope de contratos siguen igual.
- **25K o 50K sale del saldo.** Desde 37.500 es 50K; por debajo, 25K. Si ya se vio un saldo de 50K (pico, inicio o `planSaldo`), un drawdown no lo baja a 25K. El nombre «50K» o «25K» solo se usa cuando todavía no hay saldo.
- **El texto de la estrategia usa el tamaño de la cuenta elegida.** En 50K el stop, el objetivo, el colchón y los escalones salen del doble de la configuración que usa el motor, y cambian al cambiar de cuenta. La meta de la planta y el tope de contratos siguen ese mismo tamaño.
### Notas
- No abre, no mueve y no cierra órdenes por su cuenta. El filtro de simulación de `orders.mjs` sigue igual.

## [0.10.18] — 2026-11-16
### Agregado
- **Profito queda en la bandeja, junto al reloj.** El acceso AI Profit abre un icono con la mascota (tooltip «AI Profit») y no deja ventanas negras de consola. El menú dice: Abrir granja, Estado, Ver logs y Cerrar Profito. Cerrar apaga el servidor y lo que Profito arrancó. No cierra TradingView ni las órdenes del bróker. Los registros van a `%LOCALAPPDATA%\Profito\datos\logs` y rotan solos. Si ya está abierto, volver a abrirlo solo trae la granja al frente.
- **Pantalla de carga.** Al abrir sale «Cargando Profito…», con las fotos del instalador en otro orden, el logo y el paso en curso: Encendiendo servidor, Conectando TradingView, Abriendo granja. Se cierra sola cuando la granja ya está en pantalla. Si pasa cerca de un minuto, dice qué sigue pendiente.
### Corregido
- **El ojo de los algoritmos vuelve a mostrar y ocultar.** `POST /api/algo-tv` lo respondía el atajo de `/order` con «ruta desconocida» y el clic no hacía nada. Ahora esa ruta llega a `fijar`.
- **La flor sale en una instalación nueva.** La barra lee la cuenta en TradingView (`/api/colchon/accounts`). La flor solo miraba `accounts.json` y, si todavía no había saldo, no plantaba nada. Ahora usa la misma lista que la barra. Si el saldo aún no llegó, la flor usa el inicio del plan (25K o 50K).
### Cambiado
- **El cerezo ya no recibe certificados.** Sigue en la escena, con cinco manzanas fijas. No hay botón para subir, ni archivo, ni panel de certificado. Lo que ya estaba guardado en el navegador (`tl_garden_v1`) o en `logros.json` no se borra; la página deja de usarlo. Las plantas de las cuentas, los pagos (cubos dorados) y los árboles memoriales siguen.
- **Solo queda Profito Algoritmo.** Se quitó Smart Money Algo (antes Smart Money Structure). Si Profito lo había puesto en el gráfico, lo quita una vez y no toca órdenes ni posiciones. Ai Profit Camp Algo pasa a llamarse Profito Algoritmo en la granja y en el título del indicador. El script guardado se actualiza con `save/next` en la sesión de TradingView de esa persona.
### Notas
- No abre, no mueve y no cierra órdenes. `orders.mjs` sigue apagado.

## [0.10.17] — 2026-11-16
### Corregido
- **El estudio de Pine se añade con el inserter `{type:'pine'}`.** En Desktop 3.5.0 un texto cae en el inserter java y un metaInfo JSON hace que `insertStudy` devuelva null. El id `script$user;<hash>` se pasa como `pineId: 'USER;<hash>'` y `pineVersion: 'last'`. El texto queda solo para estudios estándar. Si el estudio ya está en el gráfico, no se añade otro.
### Cambiado
- **Los avisos de los algoritmos salen del ojo de la barra.** «Instalando…», «Algoritmos listos» y el motivo si quedó pendiente son una burbuja debajo de ese ojo, con una punta que lo señala. Se acomoda si cambia el tamaño de la ventana y no tapa los números de Hoy.
### Notas
- No abre, no mueve y no cierra órdenes. `orders.mjs` sigue apagado.

## [0.10.16] — 2026-11-16
### Corregido
- **Los algoritmos sí se añaden al gráfico en TradingView Desktop 3.5.0.** Al guardar, el id vuelve como `script$user;<hash>` y el gráfico lo rechazaba («unexpected study id»). Ahora se acepta ese formato y también `USER;`, `PUB;`, `STD;`, `Script$…` y variantes nuevas. Si falla, la granja dice el motivo y lo reintenta sola, en vez de quedarse en «pendiente» sin explicación.
- **La granja vuelve a abrir en su propia ventana.** Desde la 0.10.12 el acceso depende de `navegador-granja.mjs`. Si ese archivo no está en la instalación, el acceso abría una pestaña normal. Si falta, ahora prueba Brave, Edge y Chrome con `--app`, igual que antes. El instalador incluye el archivo.
### Cambiado
- **Smart Money Structure pasa a llamarse Smart Money Algo.** El indicador, el script guardado y el ojo de la barra usan ese nombre. Si ya estaba el estudio viejo, se reemplaza sin duplicarlo y se conserva si estaba oculto o visible. Durante ese cambio sale el aviso de instalación.
### Notas
- No abre, no mueve y no cierra órdenes. `orders.mjs` sigue apagado.

## [0.10.15] — 2026-11-16
### Corregido
- **Los indicadores se instalan aunque haya un trade y aunque la luz de Tradovate cambie.** Antes se quedaban en «pendiente» con el motivo «sin-broker» si el panel de órdenes de TradingView no devolvía el bróker, aunque las tres luces estuvieran verdes. Instalar o mostrar u ocultar un algoritmo ya no mira el bróker, la cuenta, el símbolo, las posiciones ni las órdenes. Un estudio que la persona ocultó sigue oculto.
### Agregado
- **Aviso mientras se instalan los algoritmos.** Cuando de verdad se guardan o se añaden al gráfico, la granja dice: «Instalando los algoritmos en tu TradingView. Tarda de 1 a 2 minutos. Es normal que veas moverse el gráfico y el editor de Pine.» Al terminar, un momento dice «Algoritmos listos». Si falla, vuelve a pendiente. No sale al mostrar u ocultar, ni si ya estaban instalados. `/api/algo-tv` marca `fase` y el estado `instalando`.
### Cambiado
- **El botón de abajo a la derecha que tapa los números ahora es un candado.** Cerrado: números ocultos. Abierto: números a la vista. El clic y el sonido siguen igual. El ojo de los algoritmos, arriba junto a Hoy, sigue siendo un ojo.
### Notas
- No abre, no mueve y no cierra órdenes. `orders.mjs` sigue apagado. El stop, el objetivo y el colchón no cambian.

## [0.10.14] — 2026-11-16
### Agregado
- **Indicadores de TradingView desde un manifiesto.** Cada `.pine` de `motor/pine/manifest.json` es un estudio aparte. Van Ai Profit Camp Algo y Smart Money Structure, cada uno con su propio ojo. Si falta en el gráfico se guarda y se añade; si ya está, aunque esté oculto, no se duplica ni se vuelve a mostrar. La barra de arriba tiene un ojo junto a Hoy: al abrirlo lista cada algoritmo y su ojo lo muestra o lo oculta en el gráfico. Abrir y cerrar suenan como los otros paneles; el ojo de cada fila suena como el interruptor. BUY y SELL siguen en silencio. Si TradingView no está conectado, la lista se ve apagada.
### Corregido
- **La granja volvía a abrir.** Las fechas de la sesión se asignaban sin declarar dentro del módulo de la página, y eso tapaba toda la granja con «Algo salió mal».
### Notas
- No abre, no mueve y no cierra órdenes. `orders.mjs` sigue apagado. El stop, el objetivo y el colchón no cambian.

## [0.10.13] — 2026-11-16
### Agregado
- **La versión en el panel Negocio.** Abajo, a la derecha de Demo, se lee «Versión x.y.z». Sale del archivo `VERSION` de esta instalación (`/api/version`). Si no se puede leer, no aparece nada.
- **La barra «Hoy» se puede pulsar.** Rota entre el conteo, el P&L neto del día y las rachas de hoy. Recuerda la última vista en este navegador y suena como los demás botones. BUY y SELL siguen en silencio, y el botón de silencio se respeta.
### Corregido
- **El P&L del día es el de toda la sesión.** La sesión va de las 18:00 a las 16:00 del día siguiente, hora de Nueva York, y se nombra con la fecha de esas 16:00. Un trade entre las 16:00 y las 18:00 (fuera de sesión) pasa a la sesión siguiente. El sábado y el domingo no se juntan con el lunes. El mismo corte vale para el encabezado, las rachas, el historial, las métricas, el Negocio, la pérdida diaria y «Listo por hoy». Antes, si la granja se abría tarde, el día empezaba en esa primera lectura y se perdían los trades de la sesión (en un caso, 534.5 en la granja y 610 en Lucid). Si el bróker manda la comisión, se usa. Si manda el saldo de inicio de sesión, se usa. Si no, se resta la comisión conocida (MNQ $1 y NQ $3.50 por contrato). La primera lectura tardía no cuenta como inicio.
- **Cualquier cuenta Lucid (LFE o LFF) se puede operar** aunque no exista `real-allowlist.json`, esté vacío o no se pueda leer. Siguen la confirmación, la cuenta activa, el tope de contratos, la pérdida del día y no operar con una posición abierta. Una cuenta que no sea Lucid ni Paper sigue bloqueada.
- **El pico del max loss usa el cierre de las 16:00 ET.** Sube con el saldo leído de las 16:00 a las 18:00, que es el hueco en que la sesión ya terminó. Un saldo de las 18:00 a las 15:59 no lo sube. Si la granja estaba apagada en ese hueco, al volver se usa el último saldo guardado.
- **`orders.mjs` sigue apagado y en simulación.** Su reloj usa el mismo corte: de las 16:00 a las 18:00 no abre y pide estar plano, y el conteo de «un trade hoy» usa el día de la sesión. No coloca órdenes.
- **La granja ya no cierra sola por la hora.** Se quitó el corte de las 4:45 PM ET. La posición se queda con su stop y su objetivo, y el colchón sigue vigilándola. El botón Detener sigue cerrando a mano.
### Notas
- No abre, no mueve y no cierra órdenes por su cuenta. `orders.mjs` sigue apagado y en simulación.

## [0.10.12] — 2026-11-16
### Corregido
- **La granja abre en el navegador de cada persona.** El acceso lee el navegador predeterminado. Si es Chrome, Edge o Brave, lo usa, con el mismo permiso para que la fanfarria suene al abrir. Si no es uno de esos, o no se puede leer, prueba Chrome y después Edge. Si no hay ninguno, abre la dirección con el programa que Windows tenga. No cambia la fanfarria.
### Notas
- No abre, no mueve y no cierra órdenes.

## [0.10.11] — 2026-11-16
### Cambiado
- **La fanfarria suena al abrir, junto con la celebración.** El acceso AI Profit abre la granja en una ventana de Edge o Chrome, con permiso para sonar sin un clic previo. En ese momento salen juntos el salto, la casa, el confeti y la fanfarria de un trade ganado (`window.__tlCelebrate`). Si el audio siguiera bloqueado, se ven los efectos y el sonido no queda para un clic posterior. El botón de silencio se respeta. No anota una ganancia.
- **La luz de Tradovate ve la cuenta aunque el panel esté cerrado.** Si TradingView no muestra el nombre en la página, se toma de la API del bróker (cuenta actual y su ficha). La luz puede ponerse verde y la comprobación de cuenta deja de decir que no la ve. Cambiar de cuenta para operar sigue exigiendo el nombre visible, y la lista de cuentas reales permitidas no cambia.
- **Sonidos de la interfaz, sintetizados.** Al abrir Historial, Métrica, Negocio o una planta suena abrir carta. Los botones suenan selección. Día/noche, silencio y el ojito suenan interruptor. Cerrar un panel suena un toque. Al despertar a Profito suena «DJ Inicio», en lugar del wuhu; si el agente ya está despierto, ese clic cierra el panel con un toque. La fanfarria de un trade, el sonido de pérdida y el silencio de BUY y SELL no cambian. Todo usa un solo AudioContext y respeta el silencio.
### Notas
- No abre, no mueve y no cierra órdenes. El arreglo del instalador está en 0.10.10, aquí abajo.

## [0.10.10] — 2026-11-16
### Corregido
- **Al terminar de copiar, el instalador pasa a ¡Listo!** La barra se llenaba y los archivos quedaban en la carpeta, pero la pantalla se quedaba en «Instalando…». El avance estaba en `.onInstSuccess`, y eso solo corre al cerrar el instalador. Ahora, al acabar la sección, la página de progreso se cierra sola y aparece «Abrir».
### Notas
- No abre, no mueve y no cierra órdenes. Esta versión aún no está publicada.

## [0.10.9] — 2026-11-16
### Corregido
- **El botón Instalar del instalador ya avanza.** El botón verde era una imagen estática con identificador 0, y el clic no llegaba. Aunque llegara, llamaba al botón Siguiente, que está oculto, y la página no cambiaba. Ahora es un botón de verdad y el avance se envía al asistente. La instalación puede empezar.
### Notas
- No abre, no mueve y no cierra órdenes. Esta versión aún no está publicada: el arreglo está en revisión.

## [0.10.8] — 2026-11-14
### Agregado
- **Celebración al abrir.** En el momento en que la granja abre, una sola vez, salen los mismos efectos visuales de un trade ganado: la casa salta, el confeti explota y el resto de la celebración. Usa la función que ya existe (`window.__tlCelebrate`), con `soloVisual` para no disparar la fanfarria ni los efectos de sonido. No abre el resumen, no anota una ganancia y no cambia saldos, historial ni métricas. Los sonidos quedan como estaban.
### Notas
- No abre, no mueve y no cierra órdenes. Solo la página.

## [0.10.7] — 2026-11-13
### Agregado
- **Sonidos de clic y de despertar.** Un clic corto de burbuja suena al dormir al agente (o si ya hay una operación en curso), al abrir Historial, Métrica o Negocio, al abrir una planta y al pulsar Trade. Al despertar al agente suena un wuhu, en lugar del clic. BUY y SELL no suenan. Si el audio falla, la página sigue igual.
### Notas
- No abre, no mueve y no cierra órdenes. Los archivos están en `motor/sonidos/clic-burbuja.wav` y `motor/sonidos/despertar-wuhu.wav`. El instalador los copia.

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
