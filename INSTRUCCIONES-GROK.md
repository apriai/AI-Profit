# Instrucciones para el Grok de Caroline: actualizar Prop Farm desde GitHub

Eres el agente de Caroline (usuario de GitHub: `karocerquera`). Tu trabajo es dejar su Prop Farm / TradingLink con la misma parte de ejecución que ya está probada en la PC de Bänéd (HERO): abrir la orden, ajustar el stop y el take profit al precio real de entrada, mover el stop por Tradovate y leer el P&L directamente de Tradovate. Solo esa parte, más la página actualizada.

Repositorio privado: https://github.com/apriai/AI-Profit (rama `main`).

## Reglas que no se rompen
1. Nunca abras, modifiques, canceles ni cierres órdenes reales por tu cuenta. Solo Caroline lo hace desde la granja.
2. Nunca reinicies el servidor si hay una operación abierta u órdenes pendientes. Primero confirma que está sin posición y sin órdenes.
3. Haz copia de respaldo de cualquier archivo antes de editarlo (carpeta `backups\`).
4. No subas nunca al repositorio cuentas, saldos, historial, registros ni números de cuenta completos. Al mostrar una cuenta, enmascárala: primeros 4 y últimos 3 caracteres.
5. Trabaja solo en tu propia rama `caroline`. Nunca subas a `main`. Para proponer un cambio abre un pull request y espera a que Bänéd lo apruebe.
6. No instales nada en todo el sistema. Solo herramientas portátiles dentro de la carpeta de TradingLink.
7. No hagas clics dentro de TradingView.
8. No inventes números ni resultados. Si algo no se puede verificar, dilo.

## Paso 0: requisitos
- Caroline aceptó la invitación como colaboradora de `apriai/AI-Profit` (le llega por correo o aparece en https://github.com/notifications). Sin eso el paso 3 falla con "repository not found".
- Su carpeta de TradingLink es donde está `colchon.mjs`. Anota la ruta.

## Paso 1: conseguir `actualizar.bat`
Descarga `actualizar.bat` y `actualizar.ps1` desde el repositorio y ponlos en la carpeta de TradingLink, junto a `colchon.mjs`.

## Paso 2: antes de actualizar
- Verifica que `http://localhost:8787/api/colchon/conexion` responda y que no haya posición ni órdenes abiertas. Si hay una operación en curso, espera.
- Haz una copia manual de la carpeta de TradingLink (sin `node-win` ni `git-portable`) en `backups\manual-<fecha>`.

## Paso 3: actualizar
Doble clic en `actualizar.bat`.
- La primera vez descarga Git portátil dentro de la carpeta (`git-portable`), sin instalar nada en el sistema.
- Se abre una ventana del navegador para iniciar sesión en GitHub con la cuenta `karocerquera`. Es un paso que solo Caroline puede hacer.
- El script guarda una copia de los archivos que va a reemplazar en `backups\pre-actualizar-<fecha>` y los reemplaza desde `origin/main`. No borra nada y no toca `accounts.json`, `sod.json`, `logros.json`, `metas.json`, `real-allowlist.json`, `historial\` ni sus registros.

## Paso 4: dejar su configuración correcta
- `colchon-fuente.json` debe contener `{"modo":"broker"}` para leer el P&L real de Tradovate. Si no existe o dice otra cosa, créalo o corrígelo (con respaldo).
- Si falta `real-allowlist.json`, pídele a Caroline cuáles cuentas reales autoriza. No lo llenes tú.
- `strategies.mjs` debe tener `DEFAULT_QTY` MNQ en 5 en las estrategias `dia-minimo-colchon` y `prueba-be` (el valor por defecto actual).

## Paso 5: reiniciar el servidor (solo sin operaciones)
1. Confirma sin posición y sin órdenes.
2. Cierra la ventana de `tradinglink.mjs`.
3. Abre `iniciar-tradinglink.bat` (o el acceso directo "Prop Farm").

## Paso 6: TradingView
Solo funciona la versión abierta con `abrir-tradingview.bat` (puerto 9222). Si la granja dice "no conectado a TradingView/Tradovate", cierra TradingView y ábrelo con ese archivo.

## Paso 7: verificación
- `http://localhost:8787/api/colchon/conexion` debe mostrar `tradingview` y `tradovate` conectados y `broker` verdadero.
- En la página, el selector de contratos es un slider de 1 a 20, arranca en 5, y el fondo se pone rojo al subirlo.
- Pide a Caroline una prueba supervisada con la estrategia "PRUEBA BE" en una cuenta que ella elija. Confirma en el historial: `fuente: "broker"`, y que el stop se movió a break even en Tradovate. Sin esa prueba real, no digas que el movimiento a break even está verificado.

## Cómo seguir recibiendo actualizaciones
Cada vez que Bänéd avise que hay una versión nueva: repite los pasos 2, 3 y 5. Si hay cambios que tú quieras proponer, hazlos en la rama `caroline` y abre un pull request.

## Cambios importantes (26 oct 2026)
- **Historial del Negocio:** ahora se guarda también en `negocio.json`, junto al servidor (lo escribe `negocio.mjs`, que `tradinglink.mjs` importa: no lo borres). Hace una copia diaria en `backups-negocio/` (las últimas 30). Es personal: **nunca lo subas a GitHub** (está en `.gitignore`). Actualizar o reemplazar archivos nunca debe borrar `negocio.json` ni `backups-negocio/`.
- **Cuentas viejas:** al arrancar, el servidor ya no resucita las cuentas de evaluación antiguas guardadas en `sod.json`. Cuando TradingView ya no lista una cuenta (no fondeada), se marca con `gone` en `sod.json` y no se siembra más; si vuelve a aparecer, se quita la marca. Las cuentas fondeadas (LFF) **nunca** se marcan `gone`, a propósito, para que la lógica de cuenta quemada siga funcionando.
- **Error de la página:** se corrigió un fallo (`glow` indefinido) que rompía la página con los árboles de flores de voxels.
- **Actualizar:** `actualizar.ps1` solo copia archivos que están en el repositorio y no debe tocar `negocio.json`, `sod.json`, `accounts.json`, `metas.json` ni `logros.json`.

## Si algo falla
- "repository not found": falta aceptar la invitación o iniciar sesión con `karocerquera`.
- La granja no abre: el servidor está apagado; usa `iniciar-tradinglink.bat`.
- No se conecta a TradingView: reábrelo con `abrir-tradingview.bat`.
- Cualquier otra cosa: no improvises; copia el error exacto y avísale a Caroline y a Bänéd.
