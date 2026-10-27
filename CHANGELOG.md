# Registro de cambios

Todos los cambios importantes de Prop Farm / TradingLink (Ai Profit Camp) se anotan aquí.
El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/).

## Cómo se versiona
- **Arreglo** (corrige algo sin agregar funciones): sube el último número. Ejemplo: `0.2.0` → `0.2.1`.
- **Función nueva**: sube el número del medio y el último vuelve a cero. Ejemplo: `0.2.1` → `0.3.0`.
- **`1.0.0`**: cuando la granja sea estable para que la usen otras personas.
- **Cada pull request debe subir el archivo `VERSION` y agregar una entrada en este `CHANGELOG.md`** (arriba, con la fecha). También hay que actualizar el texto de respaldo `vX.Y.Z` que se ve en la esquina de la granja (`Granja-de-Cuentas-v2.html`, el bloque `tl-version`).
- La versión actual está en el archivo `VERSION` y se muestra, pequeña, en la esquina inferior derecha de la granja.

## [0.2.0] - 2026-10-26
Versión actual de `main`. Reúne lo que se agregó después de la primera publicación.

### Agregado
- **Panel Operar, Negocio y estrategias** (PR #2, de Caroline): panel *Operar* más grande, con el orden cuenta → estrategia y BUY/SELL abajo; el *Negocio* (antes *Historial*) con ＋ para la comisión de afiliado; jardín de logros con flor de voxels; día y noche de 7:00 a 16:00 ET; montos en $ ocultos hasta hacer clic. Cuatro estrategias: *Evaluación* (predeterminada), *Evaluación con trailing*, *Día mínimo + colchón* y *Prueba BE*.
- **Quema de cuentas fondeadas** (PR #2): una fondeada LFF 25k se marca como quemada, de forma pegajosa, al perder $1,000 acumulados, aunque el daño se reparta en varios días.
- **Lectura de cuentas fondeadas con la pausa de lectura** (PR #2): con la pausa activa se siguen leyendo las LFF, y al reiniciar el servidor se publica el último saldo conocido.
- **Historial del Negocio en `negocio.json`** (PR #4): la página guarda su historial (que vivía solo en el navegador) en `negocio.json`, junto al servidor, con una copia diaria en `backups-negocio/` (las últimas 30). Si la página arranca vacía, lo restaura. Un historial vacío nunca sobrescribe uno con datos. Esos archivos están en `.gitignore` y no se suben nunca. Archivo nuevo: `negocio.mjs`.
- **README** profesional con el crédito «Hecho por Ai Profit Camp».
- **`AGENTS.md` e `INSTRUCCIONES-GROK.md`**: reglas para el Grok de Caroline (trabajar en la rama `caroline`, abrir pull requests, no tocar órdenes reales, no subir datos personales) y la sección «Cambios importantes».
- **Control de versiones**: archivos `VERSION` y `CHANGELOG.md`, y la versión visible en la esquina de la granja.

### Cambiado
- **5 contratos por defecto en todas las estrategias** (PR #3): *Evaluación* y *Evaluación con trailing* usaban 20 MNQ cuando no se indicaba cantidad; ahora usan MNQ 5 y NQ 1, igual que las otras dos.
- **Tope de P&L imposible más estricto** (PR #3): 2× el mayor entre disparo, SL y TP (antes 20×), en `colchon.mjs` y `colchon-src/`.
- El motor espera el contrato fechado antes de armar el bracket y puede leer solo un tipo de cuenta (PR #2).

### Corregido
- **Cuentas viejas ya no resucitan al arrancar** (PR #4): el servidor ya no vuelve a sembrar en la granja las cuentas de evaluación que TradingView dejó de listar (marca `gone` en `sod.json`). No se borra ningún historial. Las cuentas fondeadas nunca se marcan `gone`.
- **Error de la página (`glow` indefinido)** (PR #4): la página ya no se rompe con los árboles de flores de voxels.

## [0.1.0] - 2026-10-26
### Agregado
- Primera publicación de la granja (Prop Farm / TradingLink) en GitHub, saneada: sin cuentas, saldos, historial, registros ni datos personales.
