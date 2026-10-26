# AI-Profit (Prop Farm / TradingLink)

Repositorio **privado**. Contiene solo el **motor** (`colchon.mjs`, `orders.mjs`, `tradinglink.mjs`, `strategies.mjs`, `probe.mjs`, `busy.mjs`) y la **página** (`Granja-de-Cuentas-v2.html`), más la documentación (`MOTOR.md`, `docs/`) y las herramientas de apoyo (`colchon-src/`, `tradingview-mcp/`).

**No contiene datos personales**: ni saldos, ni cuentas, ni historial, ni registros, ni claves. Los archivos personales de cada PC (`accounts.json`, `sod.json`, `logros.json`, `metas.json`, `real-allowlist.json`, `historial/`, `reportes/`, `backups/`, `colchon-*.json*`, `*.log`) están en `.gitignore` y nunca se suben. Las ids de cuenta que aparecían escritas en el código se reemplazaron por ceros.

## Cómo actualizar tu PC (Caroline)

1. Copia `actualizar.bat` (y `actualizar.ps1`) a tu carpeta `TradingLink`, o ejecútalo desde ahí si ya está.
2. Haz doble clic en `actualizar.bat`. La primera vez se abre el navegador para que inicies sesión en GitHub (usuario `karocerquera`, que debe estar agregada como colaboradora).
3. El programa respalda lo que va a cambiar en `backups\pre-actualizar-<fecha-hora>` y actualiza **solo los archivos del código**. Tus archivos personales no se tocan ni se borran.
4. Reinicia el servidor **solo cuando estés plana y sin órdenes** (sin posición abierta ni órdenes de trabajo).

Más detalle en `LEEME-ACTUALIZAR.md`.

## Regla para el agente (Grok) de Caroline

- Trabaja **solo en su propia rama**: `caroline`. Nunca hace push a `main`.
- Para proponer un cambio: crea/usa la rama `caroline`, haz commit, push a `origin caroline` y abre un **pull request** hacia `main`.
- **Bänéd aprueba** el pull request. Solo lo que él apruebe llega a `main`, y de ahí a todos los PCs.
- Nunca subir saldos, cuentas, historial, registros, ids de cuenta completas, claves ni correos. Si dudas, no lo subas.
- El agente nunca coloca, modifica, cancela ni cierra órdenes reales por su cuenta.
- Antes de editar un archivo en producción, haz respaldo. No reiniciar el servidor si hay operación abierta.

## Para Bänéd (publicar)

Doble clic en `subir-a-github.bat` (carpeta `AI-Profit-repo`) o en `Subir a GitHub.bat` del escritorio. Sube todo a `main`.