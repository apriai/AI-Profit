# Notas técnicas internas (solo para el bot)

Esto no se lee en voz alta ni se le muestra a la persona. A ella háblale de «la granja» y de «TradingView conectado», sin direcciones locales ni números de conexión.

- Servidor de la granja: `motor\tradinglink.mjs` escucha en `127.0.0.1:8787`. La granja es `http://localhost:8787/Granja-de-Cuentas-v2.html`. Comprobación del servidor: `http://127.0.0.1:8787/` responde. Sin eso no está instalado.
- TradingView conectado: responde `http://127.0.0.1:9222/json/version` (TradingView abierto con `--remote-debugging-port=9222`). Si no responde, `acceso\Abrir Granja.bat` ejecuta `taskkill /F /IM TradingView.exe` y lo vuelve a abrir con ese parámetro, sin preguntar. No cierra posiciones ni stops en el bróker.
- Operación en curso: si el servidor ya estaba encendido, consulta `http://127.0.0.1:8787/api/colchon/status`. Si `state` es `running`, hay una operación en curso: no abras, no reinicies ni actualices nada y espera a que termine. Si el servidor no está encendido, no hay operación de la granja en curso. Es una comprobación tuya; no se la preguntes a la persona.
- Luz de TradingView: `http://127.0.0.1:8787/api/colchon/conexion` en verdadero después de que la persona entre a su sesión.
- `acceso\comprobar-instalacion.mjs`: `instalado` es verdadero solo si además responde `http://127.0.0.1:8787/`.
- Si el servidor no arranca porque otro programa ya usa `127.0.0.1:8787`, no lo cierres a ciegas. A la persona dile solo: «No pude abrir la granja. Cierra y vuelve a abrir AI Profit.»
