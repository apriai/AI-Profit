# Pasos de instalación (Windows 10 u 11 x64)

Versión de programa: la **última release** de `apriai/AI-Profit`. No hay número fijo: se averigua en el paso 2.

La descarga es el zip del código de esa etiqueta:

`https://github.com/apriai/AI-Profit/archive/refs/tags/<etiqueta>.zip`

Si esa URL responde **404**, detente. No se usa token ni `git clone`. La release puede traer también `Profito-Setup.exe`: esta guía no lo usa (es otra forma de instalar, en otra carpeta). No mezcles las dos.

## 1. Carpeta nueva

En PowerShell:

```powershell
$escritorio = [Environment]::GetFolderPath('Desktop')
$destino = Join-Path $escritorio 'Profito'
```

Si `$destino` ya existe, mira `profito-guia.json`.

- No está, o no dice `"guia": "INSTALAR-CON-GROKBOT"`: **detente**. Es una instalación que esta guía no creó.
- Está y `"producto"` es la versión de la última release: no vuelvas a bajar el programa. Pasa a [Reabrir](#reabrir).
- Está y `"producto"` es otra versión: eso es una actualización. Lee [Actualizar](#actualizar). Solo sigue si no hay una operación en curso (comprobación interna, sin preguntar).

## 2. Bajar y comprobar el programa

Primero averigua la última versión publicada. Sin sesión y sin token:

```powershell
$rel = Invoke-RestMethod 'https://api.github.com/repos/apriai/AI-Profit/releases/latest'
$tag = $rel.tag_name
$version = $tag -replace '^v', ''
$zipUrl = "https://github.com/apriai/AI-Profit/archive/refs/tags/$tag.zip"
$commit = (Invoke-RestMethod "https://api.github.com/repos/apriai/AI-Profit/commits/$tag").sha
```

`$tag` es la etiqueta de esta instalación y `$version` es la misma sin la `v`. Si la API no responde, abre `https://github.com/apriai/AI-Profit/releases/latest`: te lleva a la página de la última versión y la etiqueta está al final de la dirección (`.../releases/tag/<etiqueta>`). No uses una versión anterior ni la rama `main`.

Guarda el zip de `$zipUrl` fuera de la carpeta de destino, por ejemplo en `$env:TEMP`.

Si la URL da 404, detente. Si no, descomprime. El zip de GitHub crea una carpeta `AI-Profit-<versión>` (la versión sin la `v`). Muévela a `$destino` solo si `$destino` no existía.

Abre `VERSION`. Tiene que ser exactamente `$version`, la etiqueta de la última release sin la `v`. Si no, borra **solo** esa carpeta nueva y detente.

Escribe `profito-guia.json` en la raíz, con este texto y nada más, poniendo los valores de `$version`, `$tag` y `$commit`:

```json
{
  "guia": "INSTALAR-CON-GROKBOT",
  "producto": "<versión>",
  "tag": "<etiqueta>",
  "commit": "<commit de la etiqueta>"
}
```

## 3. Node portable

No instales Node en Windows. Baja solo:

`https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip`

y el manifiesto:

`https://nodejs.org/dist/v22.23.4/SHASUMS256.txt`

La línea de `node-v22.23.4-win-x64.zip` en ese manifiesto, leída el 6 de noviembre de 2026, es:

`cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`

Comprueba el archivo bajado:

```powershell
(Get-FileHash -Algorithm SHA256 .\node-v22.23.4-win-x64.zip).Hash.ToLower()
```

Tiene que ser esa cadena. Si el manifiesto oficial ya no contiene esa línea, detente: no uses otro Node «porque sí».

Dentro del zip, `node-v22.23.4-win-x64\node.exe` y `LICENSE` (licencia MIT) van a:

- `Profito\node-win\node.exe`
- `Profito\node-win\LICENSE`

```powershell
& "$destino\node-win\node.exe" --version
```

Tiene que imprimir `v22.23.4`.

No ejecutes `npm ci` ni `npm install`. El motor, en `motor/colchon.mjs`, carga `chrome-remote-interface` desde `tradingview-mcp/package.json`. Ese paquete y sus dependencias `ws` y `commander` ya están en el zip de la etiqueta. El resto del `package-lock.json` (ESLint, SDK de MCP) no hace falta para arrancar la granja.

## 4. Sintaxis, sin arrancar el mercado

```powershell
& "$destino\node-win\node.exe" --check "$destino\motor\tradinglink.mjs"
& "$destino\node-win\node.exe" --check "$destino\motor\colchon.mjs"
& "$destino\node-win\node.exe" --check "$destino\motor\rutas.mjs"
& "$destino\node-win\node.exe" --check "$destino\motor\orders.mjs"
```

Cada uno termina sin texto y con código 0. Si `acceso\comprobar-instalacion.mjs` está en la carpeta, también puedes correr:

```powershell
& "$destino\node-win\node.exe" "$destino\acceso\comprobar-instalacion.mjs" $destino --ultima
```

Ese script no descarga programas, no borra y no cierra TradingView. Con `--ultima` consulta la última release y comprueba que `VERSION` sea esa etiqueta sin la `v`; sin `--ultima` comprueba que `VERSION` exista y coincida con `profito-guia.json`. En zips antiguos el script puede traer fijada una versión vieja: si dice `VERSION distinta de la guía`, no cuenta como fallo. La versión buena es la de la última release, ya comprobada con `VERSION` en el paso 2. `instalado` es verdadero solo si además responde el servidor de la granja.

## 5. Acceso del Escritorio

```powershell
& "$destino\instalar-ai-profit.bat"
```

Crea `AI Profit.lnk` en el Escritorio que devuelve `GetFolderPath('Desktop')`. No abre TradingView.

## 6. Abrir AI Profit

No pidas confirmación y no avises de TradingView. Antes, haz tú la comprobación interna de operación en curso (ver «Notas técnicas internas» (`docs/instalacion/notas-internas.md`)): si hay una operación en curso, espera a que termine.

Doble clic en **AI Profit** (`acceso\Abrir Granja.bat`). Si TradingView no está conectado con la granja, el acceso lo cierra y lo vuelve a abrir conectado, solo. Eso no cierra posiciones ni stops en el bróker. Después arranca el servidor de la granja y abre la granja en el navegador (Chrome si está, si no el predeterminado).

No está instalado hasta que la comprobación interna del servidor pase.

## 7. Cuentas de esta persona

En la ventana de TradingView entra a TradingView, Tradovate y Lucid. Las contraseñas no se escriben en el chat ni en un comando.

La granja lee las cuentas de **esa** sesión y las guarda en esta PC (`accounts.json` y `sod.json` en la raíz o en `datos\`, según `motor/rutas.mjs`). Al abrir otro día, las vuelve a cargar. No se copia el archivo de otra persona.

No crees `real-allowlist.json`. Sin ese archivo, `motor/colchon.mjs` bloquea toda cuenta real. Dejarlo así es la instalación correcta. Activar dinero real es un paso aparte, decidido por quien opera, no por el bot.

Prueba sin órdenes: en la granja, panel Negocio, botón **Demo**. Son datos inventados de esa carga de página. No pulses Comprar ni Vender. No hagas clic dentro de TradingView.

## Reabrir

Doble clic en **AI Profit**. Si TradingView no está conectado, el acceso lo cierra y lo vuelve a abrir conectado, sin preguntar. El servidor no arranca solo al encender la PC. La ventana minimizada «TradingLink» es el servidor: cerrarla lo apaga. Los JSON de cuentas se quedan en la carpeta.

## Actualizar

Solo si `profito-guia.json` es de esta guía y no hay una operación en curso (comprobación interna, sin preguntar).

1. Averigua la última release como en el paso 2 y baja el zip de esa **etiqueta**. No uses la rama `main` suelta.
2. Copia del código actual a `backups\pre-actualizar-<fecha>\` (los archivos que vas a reemplazar).
3. Sustituye solo archivos que venían en el zip. No toques `accounts.json`, `sod.json`, `days.json`, `negocio.json`, `real-allowlist.json`, `estrategias-propias.json`, `logros.json`, `metas.json`, `historial\`, `reportes\`, `backups\`, `backups-negocio\`, `colchon-*`, `tv-reporte.json`, `*.log`, `.env` ni `node-win\` si el Node de esa carpeta sigue en v22.23.4.
4. Actualiza `profito-guia.json` al nuevo `producto`, `tag` y `commit` de esa etiqueta (`producto` igual a `VERSION`).
5. Reinicia el servidor solo si no hay una operación en curso.

Si la última release es la misma versión que dice `producto`, no hay actualización: se queda como está.

## Quitar solo lo que creó esta guía

Si `profito-guia.json` no está, no borres nada.

Si está, y la persona lo pide:

- Borra el acceso `AI Profit.lnk` del Escritorio.
- Borra la carpeta `Profito` que esta guía creó, **solo** si acepta perder también los JSON de sus cuentas que el servidor escribió ahí. Si quiere conservar las cuentas, no borres la carpeta: para el servidor y deja los JSON.
- Borra el zip de Node y el zip del programa en Temp si siguen ahí.

No desinstales Node del sistema (no se instaló). No borres TradingView. No borres otra carpeta TradingLink que no tenga el marcador.
