# Acceso de Escritorio «AI Profit»

Una vez, en la carpeta que tiene `LEEME.md`:

- **Mac:** doble clic en `instalar-ai-profit.command`
- **Windows:** doble clic en `instalar-ai-profit.bat`

En Mac eso deja en el Escritorio **AI Profit**. Es un applet de AppleScript (`osacompile`): el programa de dentro es el binario universal de macOS, no un script de shell, así que en Apple Silicon no pide Rosetta. El dibujo es el de Karo (`assets/abrir-granja-icon.icns` y el PNG). El applet abre `acceso/AI Profit.command`. Si había un `AI Profit.command` en el Escritorio, el instalador lo quita: Finder no le ponía esa imagen.

En Windows deja el acceso **AI Profit** con `assets/abrir-granja-icon.ico`.

Cada día, doble clic en **AI Profit**. Si TradingView no está conectado con la granja, lo cierra y lo vuelve a abrir conectado, solo y sin preguntar. Después enciende el servidor y abre la Granja en Chrome. No envía órdenes.

Si mueves la carpeta, vuelve a ejecutar el instalador.
