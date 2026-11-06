# Si algo falla

## 404 al bajar v0.8.5.zip

El repositorio sigue privado o la etiqueta no está. No pidas un token. No clones. Espera a que el dueño lo haga público y vuelve a intentar esa misma URL. El release `v0.8.5` no incluye un archivo descargable propio.

## El SHA-256 de Node no coincide

No abras el zip. Bórralo. Vuelve a bajarlo de `https://nodejs.org/dist/v22.23.4/` y compara otra vez con `SHASUMS256.txt` de esa misma carpeta. No cambies de versión por tu cuenta.

## Falta node.exe o la versión no es v22.23.4

El servidor no arranca. `acceso/Abrir Granja.bat` también acepta un Node del sistema de la versión 18 o superior, pero esta guía no usa eso: el Node de la carpeta es el portable v22.23.4. No instales el MSI.

## La carpeta ya existía

Sin `profito-guia.json` de esta guía, detente. Puede ser la granja de alguien que ya opera. No copies archivos encima.

## TradingView no está

Instálalo desde el sitio oficial de TradingView (aplicación de escritorio o Microsoft Store). El zip de Profito no lo trae. `acceso/abrir-tradingview.bat` lo busca en `%LOCALAPPDATA%\TradingView`, en Archivos de programa y en el paquete de la Store.

## El 9222 no responde

No lances `taskkill` a mano. Pregunta, guarda el gráfico, confirma que no hay posición ni órdenes, y solo entonces usa el acceso **AI Profit**, que es quien cierra y reabre TradingView. Si TradingView se abrió desde el menú Inicio, normalmente no lleva el puerto 9222.

## El 8787 no responde

Mira la ventana minimizada «TradingLink». Si la cerraste, el servidor se apagó: vuelve a abrir **AI Profit** con el mismo aviso. Otro programa en ese puerto también impide arrancar; no lo mates a ciegas.

## No se ven cuentas

Hasta que entres en tu TradingView / Tradovate / Lucid, la lista puede ir vacía. Eso es normal en una instalación nueva. No pegues un `accounts.json` de otra computadora.

## Quiero operar en real

Eso no es parte de instalar. `motor/colchon.mjs` deja bloqueada toda cuenta real si no existe `real-allowlist.json`. No lo crees durante la instalación y no pongas `allowAll`. Quien opera lo decide después, fuera de este recorrido.

## Deshacer

Solo la carpeta que esta guía creó (tiene `profito-guia.json`), el acceso `AI Profit.lnk` y los zip de Temp. Si no está el marcador, no borres. Las cuentas guardadas por el servidor están dentro de esa carpeta: quien quiera conservarlas no debe borrarla.
