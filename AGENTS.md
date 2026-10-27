# AGENTS.md: reglas para cualquier agente (Grok) que trabaje en este repositorio

Repositorio privado de Prop Farm / TradingLink (motor y página, sin datos personales). El texto largo está en `docs/AGENTS.md`. Los pasos para actualizar están en `docs/INSTRUCCIONES-GROK.md`.

## Reglas que no se rompen
1. Nunca abras, modifiques, canceles ni cierres órdenes reales por tu cuenta. Solo Caroline lo hace desde la granja.
2. Nunca reinicies el servidor si hay una operación abierta u órdenes pendientes. Primero confirma que está sin posición y sin órdenes.
3. Haz copia de respaldo de cualquier archivo antes de editarlo (carpeta `backups\`).
4. No subas nunca al repositorio cuentas, saldos, historial, registros ni números de cuenta completos. Al mostrar una cuenta, enmascárala: primeros 4 y últimos 3 caracteres.
5. Trabaja solo en tu propia rama `caroline`. Nunca subas a `main`. Para proponer un cambio abre un pull request y espera a que Bänéd lo apruebe.
6. No instales nada en todo el sistema. Solo herramientas portátiles dentro de la carpeta de TradingLink.
7. No hagas clics dentro de TradingView.
8. No inventes números ni resultados. Si algo no se puede verificar, dilo.

El servidor está en `motor/`. Los datos personales van a `datos/` (o se quedan en la raíz si ya estaban ahí). No los subas.

## Cambios importantes (26 oct 2026)
- **Historial del Negocio:** ahora se guarda también en `negocio.json` (lo escribe `motor/negocio.mjs`, que `motor/tradinglink.mjs` importa: no lo borres). En una carpeta nueva queda en `datos/`; si ya estaba en la raíz, el servidor lo sigue usando ahí y no lo mueve. Hace una copia diaria en `backups-negocio/` (las últimas 30). Es personal: **nunca lo subas a GitHub** (está en `.gitignore`). Actualizar o reemplazar archivos nunca debe borrar `negocio.json` ni `backups-negocio/`.
- **Cuentas viejas:** al arrancar, el servidor ya no resucita las cuentas de evaluación antiguas guardadas en `sod.json`. Cuando TradingView ya no lista una cuenta (no fondeada), se marca con `gone` en `sod.json` y no se siembra más; si vuelve a aparecer, se quita la marca. Las cuentas fondeadas (LFF) **nunca** se marcan `gone`, a propósito, para que la lógica de cuenta quemada siga funcionando.
- **Error de la página:** se corrigió un fallo (`glow` indefinido) que rompía la página con los árboles de flores de voxels.
- **Actualizar:** `acceso/actualizar.ps1` solo copia archivos que están en el repositorio y no debe tocar `negocio.json`, `sod.json`, `accounts.json`, `metas.json` ni `logros.json`.

## Versiones
- Cada pull request debe **subir `VERSION`** (SemVer: arreglo `0.2.1`, función nueva `0.3.0`, estable para otras personas `1.0.0`) y **agregar una entrada arriba en `CHANGELOG.md`** (en español, con fecha).
- La versión se ve, pequeña, en la esquina inferior derecha de la granja. Al subir `VERSION`, actualiza también el texto de respaldo `vX.Y.Z` del bloque `tl-version` al final de `motor/Granja-de-Cuentas-v2.html`.
