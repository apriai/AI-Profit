# TradingLink + Granja de Cuentas: brief del proyecto

## 1. Qué es el proyecto
**Granja de Cuentas** es una app web (un solo HTML con Three.js) donde cada cuenta de prop firm (Lucid Flex 25K) es una parcela en una isla voxel. Cuando una cuenta pasa la evaluación ("fondeada"), su parcela se convierte en árbol dorado con animación. El personaje se llama **"tu agente"** (nunca "granjero"). Es solo para uso personal, corre local en la PC/Mac de Bänéd, no se vende ni se hostea.

- Archivo: `Granja-de-Cuentas-v2.html`
- Datos en `localStorage`, expuestos como `window.granjaStore` (`upsertAccount`, `setDaily`, etc.).

## 2. Qué es TradingLink
El puente entre TradingView Desktop y la granja:
1. **Lee** cuántas cuentas hay, su balance y P&L, y actualiza la granja automáticamente (`granjaStore.upsertAccount`).
2. **Coloca órdenes** (Buy/Sell) en TradingView, **solo con confirmación de Bänéd cada vez**.
3. **Switch on/off de órdenes**: con el bot apagado no se coloca ninguna orden aunque se pida; la lectura de cuentas sigue funcionando para que la granja refleje sus trades manuales (P&L, drawdown, fondeo).

## 3. Cómo se conecta (tradingview-mcp)
- Ruta elegida: **tradingview-mcp** controlando TradingView Desktop vía Chrome DevTools Protocol (puerto **9222**). No se usa la API de Tradovate.
- Requisitos: Node 18+ (la Mac ya tiene Node v24), TradingView Desktop instalado.
- Lanzar TradingView Desktop en modo debug:
  - Mac: `open -a "TradingView" --args --remote-debugging-port=9222`
  - Windows: `TradingView.exe --remote-debugging-port=9222`
- El mismo código sirve en Mac y Windows; solo cambia el comando de arranque.
- **Fijar (pin) la versión** de TradingView y del MCP: las actualizaciones pueden romperlo.
- Riesgo aceptado por Bänéd: automatizar TradingView podría afectar su cuenta; es uso personal y cuentas de evaluación.

## 4. Estado actual
- No hay cuentas Lucid ni Tradovate activas todavía (Tradovate no deja ni hacer login sin cuenta).
- Pruebas con **Paper Trading de TradingView** (ya activado).
- Carpeta planeada en la Mac: `Documentos/Grok Bot/TradingLink`.
- **No instalar nada en sus computadoras sin autorización explícita.**
- Tokens limitados: trabajar por fases y de forma económica.

## 5. Fases
- **Fase 1 (≈20–30 min):** instalar MCP fijado, leer cuentas/balance/P&L de Paper Trading y actualizar la granja. Solo lectura.
- **Fase 2:** órdenes con confirmación + switch on/off.
- **Fase 3:** reglas de evaluación automáticas.

## 6. Reglas de trading (Lucid Flex 25K)
- Objetivo: **+$1,250**.
- Drawdown: **$1,000 trailing end-of-day**.
- Estar **flat antes de 4:45 PM ET**.
- Noticias rojas: no abrir trades desde **40 min antes hasta 5 min después**; los trades ya abiertos siguen.
- Nunca operar sin confirmación del usuario.
