# Pasos de instalación (Windows 10 u 11 x64)

Versión de programa fijada: **0.8.5**, etiqueta `v0.8.5`, commit `93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76`.

La etiqueta no tiene un zip propio en el release (la lista de archivos del release está vacía). Cuando el repositorio sea público, la descarga es:

`https://github.com/apriai/AI-Profit/archive/refs/tags/v0.8.5.zip`

Sin sesión y mientras sea privado, esa URL responde **404**. No se usa token ni `git clone`.

## 1. Carpeta nueva

En PowerShell:

```powershell
$escritorio = [Environment]::GetFolderPath('Desktop')
$destino = Join-Path $escritorio 'Profito'
```

Si `$destino` ya existe, mira `profito-guia.json`.

- No está, o no dice `"guia": "INSTALAR-CON-GROKBOT"`: **detente**. Es una instalación que esta guía no creó.
- Está y `"producto"` es `0.8.5`: no vuelvas a bajar el programa. Pasa a [Reabrir](#reabrir).
- Está y `"producto"` es otra versión: eso es una actualización. Lee [Actualizar](#actualizar). Solo sigue si la persona confirma que no hay posición ni órdenes.

## 2. Bajar y comprobar el programa

Guarda el zip fuera de la carpeta de destino, por ejemplo en `$env:TEMP`.

Cuando la URL deje de dar 404, descomprime. El zip de GitHub crea una carpeta `AI-Profit-0.8.5`. Muévela a `$destino` solo si `$destino` no existía.

Abre `VERSION`. Tiene que ser exactamente `0.8.5`. Si no, borra **solo** esa carpeta nueva y detente.

Escribe `profito-guia.json` en la raíz, con este texto y nada más:

```json
{
  "guia": "INSTALAR-CON-GROKBOT",
  "producto": "0.8.5",
  "tag": "v0.8.5",
  "commit": "93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76"
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

Cada uno termina sin texto y con código 0. Si `acceso\comprobar-instalacion.mjs` está en la carpeta (esta guía ya va en el repositorio; **el zip v0.8.5 todavía no lo trae**), también puedes correr:

```powershell
& "$destino\node-win\node.exe" "$destino\acceso\comprobar-instalacion.mjs" $destino
```

Ese script no descarga, no borra y no cierra TradingView. `instalado` es verdadero solo si además responde el puerto 8787.

## 5. Acceso del Escritorio

```powershell
& "$destino\instalar-ai-profit.bat"
```

Crea `AI Profit.lnk` en el Escritorio que devuelve `GetFolderPath('Desktop')`. No abre TradingView.

## 6. Avisar antes de abrir

Di esto y espera un sí:

> El acceso AI Profit, si el puerto 9222 no responde, cierra TradingView.exe y lo vuelve a abrir con el puerto de conexión. No cierra posiciones ni stops en el bróker. Guarda el gráfico. Confirma que no hay posición abierta ni órdenes de trabajo.

Si no hay forma de comprobarlo, no ejecutes `acceso\Abrir Granja.bat`.

Con el sí, un doble clic en **AI Profit**. Eso arranca `motor\tradinglink.mjs` en `127.0.0.1:8787`, abre el navegador (Chrome si está, si no el predeterminado) en `http://localhost:8787/Granja-de-Cuentas-v2.html` y deja TradingView en el puerto 9222.

No está instalado hasta que `http://127.0.0.1:8787/` responda.

## 7. Cuentas de esta persona

En la ventana de TradingView entra a TradingView, Tradovate y Lucid. Las contraseñas no se escriben en el chat ni en un comando.

La granja lee las cuentas de **esa** sesión y las guarda en esta PC (`accounts.json` y `sod.json` en la raíz o en `datos\`, según `motor/rutas.mjs`). Al abrir otro día, las vuelve a cargar. No se copia el archivo de otra persona.

No crees `real-allowlist.json`. Sin ese archivo, `motor/colchon.mjs` bloquea toda cuenta real. Dejarlo así es la instalación correcta. Activar dinero real es un paso aparte, decidido por quien opera, no por el bot.

Prueba sin órdenes: en la granja, panel Negocio, botón **Demo**. Son datos inventados de esa carga de página. No pulses Comprar ni Vender. No hagas clic dentro de TradingView.

## Reabrir

Doble clic en **AI Profit**, con el mismo aviso de TradingView si el puerto 9222 está caído. El servidor no arranca solo al encender la PC. La ventana minimizada «TradingLink» es el servidor: cerrarla lo apaga. Los JSON de cuentas se quedan en la carpeta.

## Actualizar

Solo si `profito-guia.json` es de esta guía y la persona confirma que no hay posición ni órdenes.

1. Baja el zip de la **etiqueta** nueva cuando exista. No uses la rama `main` suelta.
2. Copia del código actual a `backups\pre-actualizar-<fecha>\` (los archivos que vas a reemplazar).
3. Sustituye solo archivos que venían en el zip. No toques `accounts.json`, `sod.json`, `days.json`, `negocio.json`, `real-allowlist.json`, `estrategias-propias.json`, `logros.json`, `metas.json`, `historial\`, `reportes\`, `backups\`, `backups-negocio\`, `colchon-*`, `tv-reporte.json`, `*.log`, `.env` ni `node-win\` si el Node de esa carpeta sigue en v22.23.4.
4. Actualiza `profito-guia.json` al nuevo `producto` y `commit` que venga en `VERSION` y en la guía de esa etiqueta.
5. Reinicia el servidor solo estando sin posición y sin órdenes.

Hasta que no haya otra etiqueta, no hay actualización: se queda en 0.8.5.

## Quitar solo lo que creó esta guía

Si `profito-guia.json` no está, no borres nada.

Si está, y la persona lo pide:

- Borra el acceso `AI Profit.lnk` del Escritorio.
- Borra la carpeta `Profito` que esta guía creó, **solo** si acepta perder también los JSON de sus cuentas que el servidor escribió ahí. Si quiere conservar las cuentas, no borres la carpeta: para el servidor y deja los JSON.
- Borra el zip de Node y el zip del programa en Temp si siguen ahí.

No desinstales Node del sistema (no se instaló). No borres TradingView. No borres otra carpeta TradingLink que no tenga el marcador.
