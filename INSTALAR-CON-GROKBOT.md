# Instalar Profito con un bot de Grok (Windows 10 u 11, 64 bits)

Esta guía instala **la última versión publicada** de Profito: la release marcada como «Latest» en `https://github.com/apriai/AI-Profit/releases/latest`. No fija ningún número de versión: el bot lo averigua al instalar. No usa la rama `main` suelta.

El programa queda en tu Escritorio, arranca un servidor solo en tu PC y abre la granja en el navegador. Tus cuentas aparecen después de que **tú** entres en TradingView, Tradovate y Lucid. No se copia la instalación de nadie más.

Detalle, lista de comprobaciones y problemas: [docs/instalacion/](docs/instalacion/).

## Antes de pegar el prompt

1. Windows 10 u 11, procesador de 64 bits.
2. El repositorio es **público**. El bot averigua la última versión en `https://api.github.com/repos/apriai/AI-Profit/releases/latest` (campo `tag_name`, la etiqueta) y baja el zip de esa etiqueta, sin autenticación:

   `https://github.com/apriai/AI-Profit/archive/refs/tags/<etiqueta>.zip`

   Usa ese archivo de la etiqueta. No pegues un token de GitHub ni uses `git clone`. Si la descarga responde 404, el bot se detiene: hay que verificar el acceso al repositorio y que la etiqueta siga disponible.
3. TradingView Desktop ya instalado, o lo instalas tú desde la página oficial de TradingView cuando la guía lo pida. No va dentro del zip.
4. Al abrir **AI Profit**, si TradingView no está conectado con la granja, el acceso lo cierra y lo vuelve a abrir ya conectado, solo y sin preguntar. Eso no cierra posiciones ni stops en el bróker.

Bajar el zip no es tenerlo instalado. Instalado significa: carpeta en tu Escritorio, Node verificado, `VERSION` igual a la última release (la etiqueta sin la `v`), sintaxis correcta, y la granja abriendo en el navegador.

## Prompt para copiar y pegar

Copia desde la línea `Eres el bot` hasta el final del bloque. El bot trabaja en **tu** Windows. No le pidas que use un agente en la nube para instalar esto.

```
Eres el bot de Grok en MI computadora con Windows. Instala Profito (TradingLink) solo con la guía INSTALAR-CON-GROKBOT.md y docs/instalacion/ del propio paquete. No uses un agente en la nube.

Reglas:
- Descubre mi Escritorio con [Environment]::GetFolderPath('Desktop'). No uses una ruta de otra persona ni inventes un usuario.
- Averigua la última versión: abre https://api.github.com/repos/apriai/AI-Profit/releases/latest y usa su tag_name como etiqueta. Si esa dirección no responde, abre https://github.com/apriai/AI-Profit/releases/latest y toma la etiqueta del final de la dirección a la que te lleva (.../releases/tag/<etiqueta>). Baja https://github.com/apriai/AI-Profit/archive/refs/tags/<etiqueta>.zip. Si responde 404, DETENTE y dime que el repositorio no es público. No pidas ni uses un token de GitHub. No hagas git clone.
- La única versión de programa es esa etiqueta de la última release. No uses la rama main ni una versión anterior. El archivo VERSION dentro del zip tiene que ser la etiqueta sin la v. Si no, DETENTE. Si la guía o docs/instalacion/ que vienen dentro del zip nombran otra versión fija, ignora ese número: manda la última release.
- Node solo desde https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip (licencia MIT, el archivo LICENSE va dentro del zip). Comprueba SHA-256 cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20 contra https://nodejs.org/dist/v22.23.4/SHASUMS256.txt . Si no coincide, borra solo ese zip descargado y DETENTE. No instales Node en el sistema.
- No ejecutes npm ci ni npm install. El zip ya trae chrome-remote-interface, ws y commander, que es lo que el motor carga.
- Si la carpeta de destino ya existe y no tiene profito-guia.json con guia INSTALAR-CON-GROKBOT, DETENTE. No la sobrescribas.
- No copies accounts.json, sod.json, negocio.json, real-allowlist.json ni ningún dato de otra PC.
- No crees real-allowlist.json y no pongas allowAll. Sin ese archivo el motor no opera cuentas reales: déjalo así.
- No ejecutes taskkill. No abras, modifiques ni canceles órdenes. No hagas clic dentro de TradingView.
- No me pidas contraseñas, cookies ni tokens en el chat. Eso se escribe solo en las ventanas de TradingView, Tradovate y Lucid.
- No me pidas confirmación ni me avises por TradingView. Si no está conectado con la granja, acceso\Abrir Granja.bat (el acceso AI Profit) lo cierra y lo vuelve a abrir conectado, solo. Antes de abrirlo haz tú, sin preguntarme, la comprobación interna de operación en curso de «Notas técnicas internas» (`docs/instalacion/notas-internas.md`): si hay una operación en curso, espera a que termine.
- Lo técnico (direcciones locales y números de conexión) está en «Notas técnicas internas» (`docs/instalacion/notas-internas.md`). Úsalo tú, pero nunca me lo digas ni me lo leas. Si algo falla, dímelo con palabras sencillas, por ejemplo «No pude abrir la granja. Cierra y vuelve a abrir AI Profit.»
- Bajar el zip no es instalar. Solo di «instalado» si node-win\node.exe imprime v22.23.4, VERSION es la etiqueta de la última release sin la v, node --check pasa en motor\tradinglink.mjs y motor\colchon.mjs, y la comprobación interna del servidor de «Notas técnicas internas» (`docs/instalacion/notas-internas.md`) pasa.
- La prueba sin órdenes es el botón Demo del panel Negocio en la página. No pulses Comprar ni Vender.
- Al terminar, el acceso del Escritorio se llama AI Profit (lo crea instalar-ai-profit.bat).

Pasos: sigue docs/instalacion/pasos.md. Si esa copia nombra otra versión fija, manda la última release.
```

Ese acceso del Escritorio se llama **AI Profit** porque así lo crea `instalar-ai-profit.ps1`. Es el mismo programa.
