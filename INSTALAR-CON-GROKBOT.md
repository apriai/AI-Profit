# Instalar Profito con un bot de Grok (Windows 10 u 11, 64 bits)

Esta guía instala **la versión 0.8.5** que está en `main` (`93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76`, etiqueta `v0.8.5`). No usa la rama del reporte de trades: ese cambio todavía no está en `main`.

El programa queda en tu Escritorio, arranca un servidor solo en tu PC y abre la granja en el navegador. Tus cuentas aparecen después de que **tú** entres en TradingView, Tradovate y Lucid. No se copia la instalación de nadie más.

Detalle, lista de comprobaciones y problemas: [docs/instalacion/](docs/instalacion/).

## Antes de pegar el prompt

1. Windows 10 u 11, procesador de 64 bits.
2. El dueño del repositorio tiene que haberlo dejado **público**. Hoy, sin estar autenticado, este archivo responde **404** y no es una descarga:

   `https://github.com/apriai/AI-Profit/archive/refs/tags/v0.8.5.zip`

   El release `v0.8.5` no trae un zip adjunto (cero archivos). La descarga válida, cuando el repo sea público, es ese archivo de la etiqueta. No pegues un token de GitHub ni uses `git clone`. Si el 404 sigue, el bot se detiene: el repo todavía no es público.
3. TradingView Desktop ya instalado, o lo instalas tú desde la página oficial de TradingView cuando la guía lo pida. No va dentro del zip.
4. Al abrir **AI Profit**, si el puerto 9222 no responde, `acceso/Abrir Granja.bat` ejecuta `taskkill /F /IM TradingView.exe` y vuelve a abrir TradingView con ese puerto. No cierra posiciones ni stops en el bróker. Sí cierra el programa. **Guarda el gráfico y confirma que no hay posición ni órdenes de trabajo antes de ese doble clic.**

Bajar el zip no es tenerlo instalado. Instalado significa: carpeta en tu Escritorio, Node verificado, `VERSION` igual a `0.8.5`, sintaxis correcta, y `http://127.0.0.1:8787/` respondiendo.

## Prompt para copiar y pegar

Copia desde la línea `Eres el bot` hasta el final del bloque. El bot trabaja en **tu** Windows. No le pidas que use un agente en la nube para instalar esto.

```
Eres el bot de Grok en MI computadora con Windows. Instala Profito (TradingLink) solo con la guía INSTALAR-CON-GROKBOT.md y docs/instalacion/ del propio paquete. No uses un agente en la nube.

Reglas:
- Descubre mi Escritorio con [Environment]::GetFolderPath('Desktop'). No uses una ruta de otra persona ni inventes un usuario.
- Si https://github.com/apriai/AI-Profit/archive/refs/tags/v0.8.5.zip responde 404, DETENTE y dime que el repositorio aún no es público. No pidas ni uses un token de GitHub. No hagas git clone.
- La única versión de programa es la etiqueta v0.8.5, commit 93f6cb42d3bb326b6140dbd1cf5c3107c7f6ea76. El archivo VERSION dentro del zip tiene que decir 0.8.5. Si no, DETENTE.
- Node solo desde https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip (licencia MIT, el archivo LICENSE va dentro del zip). Comprueba SHA-256 cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20 contra https://nodejs.org/dist/v22.23.4/SHASUMS256.txt . Si no coincide, borra solo ese zip descargado y DETENTE. No instales Node en el sistema.
- No ejecutes npm ci ni npm install. El zip ya trae chrome-remote-interface, ws y commander, que es lo que el motor carga.
- Si la carpeta de destino ya existe y no tiene profito-guia.json con guia INSTALAR-CON-GROKBOT, DETENTE. No la sobrescribas.
- No copies accounts.json, sod.json, negocio.json, real-allowlist.json ni ningún dato de otra PC.
- No crees real-allowlist.json y no pongas allowAll. Sin ese archivo el motor no opera cuentas reales: déjalo así.
- No ejecutes taskkill. No abras, modifiques ni canceles órdenes. No hagas clic dentro de TradingView.
- No me pidas contraseñas, cookies ni tokens en el chat. Eso se escribe solo en las ventanas de TradingView, Tradovate y Lucid.
- Antes de ejecutar acceso\Abrir Granja.bat, avísame en voz alta: ese archivo cierra TradingView si el puerto 9222 no responde. Pídeme que guarde el gráfico y que confirme que no hay posición ni órdenes. Si no puedes comprobarlo, espera mi sí. Si digo que no, no lo ejecutes.
- Bajar el zip no es instalar. Solo di «instalado» si node-win\node.exe imprime v22.23.4, VERSION es 0.8.5, node --check pasa en motor\tradinglink.mjs y motor\colchon.mjs, y http://127.0.0.1:8787/ responde.
- La prueba sin órdenes es el botón Demo del panel Negocio en la página. No pulses Comprar ni Vender.
- Al terminar, el acceso del Escritorio se llama AI Profit (lo crea instalar-ai-profit.bat).

Pasos: sigue docs/instalacion/pasos.md en el zip.
```

Ese acceso del Escritorio se llama **AI Profit** porque así lo crea `instalar-ai-profit.ps1`. Es el mismo programa.
