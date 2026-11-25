# Reporte de trades en TradingView

Módulo: `motor/tv-reporte.mjs`.  
Nombre: **Reporte de trades en TradingView**.  
Si más adelante alguien dice «reporte trades en TradingView», se refiere a este módulo.

Dibuja en el gráfico el resultado de un trade que **acaba de cerrarse**, y también los cierres de hoy cuando se enciende el interruptor. No decide entradas, no mueve el stop y no cancela órdenes. Al apagarlo quita solo los dibujos de este reporte.

## Cuándo dibuja

El cierre confirmado se dibuja con el servidor y TradingView en marcha. El interruptor, además, pone o quita los de hoy.

- **Granja.** Al terminar un trade que sí se llenó, `motor/colchon.mjs` llama a `colchonHooks.onCierre`. Eso ocurre al final de `summarize()`, después de guardar el cierre. El aviso va con `setImmediate`: el motor no espera al dibujo y, si el reporte falla, el cierre y las órdenes no se tocan.
- **Manual.** Si el bróker avisa en vivo que una posición que estábamos viendo abierta pasó a cero, y hay fills de ese cierre, también se dibuja. Un aviso repetido del mismo cierre no dibuja otra vez.

No hay barrido al arrancar, ni al pulsar F5, ni al reconectar, ni un temporizador que recorra el historial. La primera vez que se instala no se dibujan los trades viejos.

El interruptor «Resumen de trades en TradingView» (`POST /api/resumen-tv`) sí cambia el gráfico, en segundo plano y sin bloquear la página:

- **De No a Sí.** Lee la lista completa de ejecuciones del bróker (`allExecutions`, y si viene vacía `executions`). No recorta esa lista por hora antes de emparejar: un cierre de hoy puede haber entrado ayer. Arma los cierres con `cierresDeFills` y se queda con los que **salieron** en el día calendario de Nueva York, de las 00:00 a las 24:00. No usa la sesión de las 18:00 a las 16:00. Si ese cierre ya está marcado como dibujado en `tv-reporte.json`, no lo repite. El SL y el TP salen del `fin_trade` de la granja, con la misma cruce que un cierre en vivo. El dibujo es el de siempre (`planDibujo`). Después, los cierres nuevos se siguen dibujando como hasta ahora. Si TradingView no está conectado, no se marcan como dibujados. Si hay un trade abierto, se salta su símbolo.
- **De Sí a No.** Quita esos dibujos con `removeEntity` sobre los ids guardados. Si alguno no está, busca las formas del grupo o del título `reporte` con `getAllShapes`. No usa `removeAllShapes` y no toca un dibujo del usuario. Los marca como quitados para que, al volver a Sí, se dibujen otra vez. El layout se guarda solo si ya tiene id.

Los dos sentidos van a una cola: un clic rápido no se pisa con el anterior ni con el dibujo de un cierre en vivo.

Si en el momento del cierre TradingView no responde (también cuando la API del bróker no está: `no-api`), faltan los fills o el gráfico todavía no está listo, el cierre **no se archiva para siempre**. Queda pendiente y se vuelve a intentar en un aviso posterior o al reconectar la escucha. Dentro del mismo intento las esperas son 0 ms, 350 ms, 800 ms, 2 s y 5 s. El lector de fills, si `allExecutions` viene vacío, pide también el contrato real `CME_MINI:MNQZ2026` y `CME_MINI:NQZ2026`, igual que las ejecuciones del bróker, y anota cuántos fills vio y por qué se omitió.

Un motivo que no es pasajero (otro símbolo, sin valor por punto, dibujo incompleto) sí se anota como omitido y no se reintenta. El envío de un dibujo que ya salió bien se hace **una sola vez**: no se duplican flechas al reconectar ni al reiniciar.

## Qué se dibuja

Estilo aprobado `unified-box-v2-outside`:

1. Flecha en la entrada (arriba si es largo, abajo si es corto), azul `#2962ff`.
2. Línea de la entrada a la salida, verde `#26a69a` si el P&L es ≥ 0 y roja `#ef5350` si es negativo.
3. Caja larga o corta de SL/TP **solo** si el bróker mostró los dos precios y caen del lado correcto. Si falta uno, o no cuadra con el tick, no hay caja y no se inventa el nivel. La caja termina 300 segundos después de la salida.
4. A la derecha, 360 segundos después de la salida y a la altura del precio de salida, un recuadro oscuro con borde azul. Dentro, en blanco, el número, el lado, los contratos, la hora de entrada en ET, los últimos 3 caracteres de la cuenta y la duración. El P&L va en otro texto, sin fondo ni borde, en el mismo punto: la API del gráfico solo admite un color por texto, así que el importe no puede ir de color dentro de la misma frase.

Esos dos textos tienen que seguir alineados. Si se mueve uno con el ratón, el otro no lo sigue. El motor no los vuelve a juntar.

Los precios, la hora, los contratos y el P&L salen de los fills del bróker (P&L bruto: diferencia de precio × valor del punto × contratos). Si el bróker no manda un dato, no se rellena con el estimado de la granja ni con la estrategia. Sin valor por punto conocido (MNQ, NQ, MES, ES, MYM, YM, M2K, RTY) no se dibuja.

Las velas se mandan atrás (`getSeries().sendToBack()`) y estos dibujos al frente (`bringToFront`). No se cambia el símbolo, ni el intervalo, ni el resto de los dibujos.

El título de grupo **reporte** se pone solo si el gráfico expone `shapesGroupController().createGroup` o una propiedad `title` en el dibujo. Si no existe, el reporte igual se dibuja, pero TradingView puede no mostrar ese nombre.

## Qué pasa después

Cuando el dibujo queda creado, el motor no lo recrea solo si alguien lo borra en el gráfico: ese cierre sigue marcado. Sí lo quita, y deja de marcarlo, cuando el interruptor pasa a No. Al volver a Sí se dibujan otra vez los de hoy.

La marca vive en `tv-reporte.json`, en la carpeta de datos de esta computadora (la raíz, si ahí están las cuentas, o `datos/` si la instalación es nueva). Ahí están los cierres ya atendidos (dibujados u omitidos). No es una cola. No se sube a GitHub.

Reiniciar el servidor o recargar el gráfico no recorre esa lista para volver a dibujar. Sirve para no repetir el mismo cierre si el aviso llega dos veces.

## Cuánto tarda

En las pruebas el reloj es simulado: con el gráfico y los fills listos, el dibujo sale en la primera pasada de ese cierre, sin espera. Si faltan fills o TradingView no responde, hay cuatro esperas (350 ms, 800 ms, 2 s y 5 s) y el cierre queda pendiente para otro intento. Eso mide el código, no promete un instante en la computadora real. En la práctica se suma el aviso del cierre, una lectura de fills y una llamada al gráfico. No se ha medido en la granja en vivo.

## Si el dibujo sigue ahí al día siguiente

Los dibujos creados con `createShape` / `createMultipointShape` forman parte del layout del gráfico (la librería de TradingView los guarda con el layout; no usamos `disableSave`). Este repositorio ya usa `TradingViewApi.getSavedCharts` y `loadChartFromServer`. El par de guardado que documenta TradingView es `saveChartToServer`, y también existe en la colección del gráfico.

Después de crear el reporte, si el layout abierto ya tiene id, se llama a `saveChartToServer` para pedir ese guardado. Si no hay id, no se llama: en una chart sin guardar esa llamada puede abrir el diálogo de «Guardar layout».

Eso no promete que el dibujo esté para siempre. Permanece si TradingView guarda el layout (ese pedido o su autoguardado) y nadie lo borra. Si se cierra el gráfico antes de guardar, se cambia de layout o se borra el dibujo, no vuelve. El motor no lo repone.

## Qué no hace

- No coloca, modifica ni cancela órdenes, ni cambia SL, TP o estrategia.
- No dibuja intentos fallidos ni posiciones que siguen abiertas.
- No copia al gráfico los cierres de otro día calendario.
- No borra dibujos del usuario. Solo quita los del grupo o título `reporte`, y solo al pasar el interruptor a No.

## Mantenimiento

El enganche está en `motor/tradinglink.mjs` (`attachReporte`) y el aviso de la granja en `summarize()` de `motor/colchon.mjs`. Para probar la lógica sin TradingView: `node motor/tv-reporte.test.mjs`.

Para que un cambio de código entre, hay que reiniciar el servidor, y solo sin posición abierta ni órdenes pendientes. La página se recarga con F5; el F5 no dibuja reportes.

No borres `tv-reporte.json` para «volver a dibujar»: un cierre marcado como dibujado no se repite. Para quitar los dibujos y volver a poner los de hoy, pasa el interruptor a No y otra vez a Sí. Lo que quedó pendiente por un fallo pasajero (sin fills, sin API, chart no listo) sí se reintenta al reconectar. Borrar el archivo solo olvida la marca anti-duplicado; no redibuja el pasado por sí solo y no borra lo que ya esté en el gráfico.
