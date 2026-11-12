# Comprobaciones

Cada línea es un sí o un no. No abras un trade para comprobar.

| Comprobación | Sí | No |
|---|---|---|
| El zip del programa es el de la etiqueta de la última release (`tag_name` de `releases/latest`) y, si la URL dio 404, el bot se detuvo | Sigue | No está instalado |
| `VERSION` es esa etiqueta sin la `v` | Sigue | Borra solo la carpeta nueva |
| SHA-256 de `node-v22.23.4-win-x64.zip` es `cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20` y esa línea está en `SHASUMS256.txt` | Sigue | Borra solo ese zip |
| `node-win\node.exe --version` imprime `v22.23.4` | Sigue | No digas instalado |
| `node --check` de `motor\tradinglink.mjs`, `colchon.mjs`, `rutas.mjs` y `orders.mjs` sale 0 | Sigue | No arranques |
| Existen `tradingview-mcp\node_modules\chrome-remote-interface\index.js`, `ws\index.js` y `commander\index.js` | El motor puede hablar con TradingView | No hagas `npm ci` |
| La granja abre en el navegador | El servidor local está en marcha | Bajar el zip no cuenta como instalado |
| TradingView está conectado con la granja | Sigue | La granja abre igual; el bróker se conecta cuando TradingView quede conectado |
| En la granja, la luz de TradingView se enciende después de entrar tú a tu sesión | Tu TradingView está enlazado | No copies cuentas de otra PC |
| En la granja se ven **tus** cuentas después de ese inicio de sesión, y al cerrar y volver a abrir siguen en el JSON de esta carpeta | Los datos son de esta PC | Si la carpeta no tiene `profito-guia.json`, no la reutilices |
| Botón Demo del Negocio, sin pulsar Comprar ni Vender | Prueba sin órdenes | Un trade real no es parte de la instalación |
| Acceso `AI Profit` en el Escritorio | El día a día es ese doble clic | `instalar-ai-profit.bat` no abre el mercado; el acceso sí cierra y reabre TradingView si no está conectado |
| No existe `real-allowlist.json` creado por el bot | Las cuentas reales siguen bloqueadas por el motor | No lo crees para «probar» |

`archivoCuentas: true` en el comprobador solo dice que el archivo existe. No debe imprimir su contenido.

Las comprobaciones técnicas de cada fila (direcciones locales) están en «Notas técnicas internas» (`docs/instalacion/notas-internas.md`). Son para el bot, no para mostrarlas.
