@echo off
rem Crea o actualiza el acceso directo "AI Profit" en el Escritorio.
rem El dibujo es assets\abrir-granja-icon.png (tambien se usa el .ico del repo).
rem No abre TradingView y no envia ordenes.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-ai-profit.ps1"
echo.
pause
