@echo off
rem Solo el servidor. Para un clic (TradingView + servidor + granja) usa Abrir Granja.bat o el acceso AI Profit.
cd /d "%~dp0.."
if exist "%~dp0..\node-win\node.exe" set "PATH=%~dp0..\node-win;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js para Windows v18+. Instalalo desde https://nodejs.org o copia node.exe en la carpeta node-win\ de TradingLink
  pause
  exit /b 1
)
start "" http://localhost:8787/Granja-de-Cuentas-v2.html
node "%~dp0..\motor\tradinglink.mjs"
pause
