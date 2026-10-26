# actualizar.bat — actualizar Prop Farm desde GitHub

Sirve para traer la última versión del código desde el repositorio privado `https://github.com/apriai/AI-Profit` sin usar ZIP.

## Antes de empezar (una sola vez)
- Bänéd debe haberte agregado como **colaboradora** del repositorio (usuario `karocerquera`). Acepta la invitación que llega a tu correo de GitHub.
- La primera vez se abre una ventana del navegador para **iniciar sesión en GitHub** (Git Credential Manager). Después recuerda tu sesión.

## Cómo se usa
1. Pon `actualizar.bat` y `actualizar.ps1` en la carpeta `TradingLink` (la misma donde está `tradinglink.mjs`).
2. Doble clic en `actualizar.bat`.

## Qué hace
1. Si falta `git-portable\cmd\git.exe`, descarga **Git portátil** (solo dentro de la carpeta; no instala nada en Windows ni cambia el PATH).
2. Si la carpeta aún no es un repositorio: `git init`, `git remote add origin https://github.com/apriai/AI-Profit.git`.
3. `git fetch` de `origin/main`.
4. **Respalda** cada archivo que va a ser reemplazado en `backups\pre-actualizar-<fecha-hora>\` (mantiene las mismas subcarpetas).
5. Actualiza **solo los archivos que están en el repositorio** (`git checkout origin/main -- .`). **No usa `git reset --hard`** y no borra nada.
6. Tus archivos personales (`accounts.json`, `sod.json`, `logros.json`, `metas.json`, `real-allowlist.json`, `historial\`, `reportes\`, `backups\`, `colchon-*.json*`, logs, `node-win\`) no están en el repositorio y quedan intactos.

## Después de actualizar
**Reinicia el servidor solo cuando estés plana y sin órdenes** (sin posición abierta ni órdenes de trabajo; ningún trade en curso). El código nuevo no se usa hasta reiniciar. Hasta entonces el servidor sigue con la versión anterior.

## Si algo sale mal
- Los archivos anteriores están en `backups\pre-actualizar-<fecha-hora>\`; cópialos de vuelta.
- Si dice `Repository not found` o error 403/404: aún no eres colaboradora, no aceptaste la invitación, o iniciaste sesión con otra cuenta de GitHub (debe ser `karocerquera`).
- Si tu agente modificó archivos de código, que los suba primero en la rama `caroline` (ver `README.md`) para no perder esos cambios.