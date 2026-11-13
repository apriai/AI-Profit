@echo off
rem Abre TradingView Desktop con --remote-debugging-port=9222.
rem No envia ordenes y no hace clic dentro de TradingView.
rem Si el puerto 9222 ya responde, no toca TradingView.
rem El paquete MSIX (tradingview.com/desktop y la Store) se abre con
rem acceso\abrir-tradingview.ps1: alias, activacion del paquete y, si falla, el exe de WindowsApps.
setlocal EnableExtensions
cd /d "%~dp0"

call :listening 9222
if not errorlevel 1 (
  echo TradingView ya esta conectado. No se reinicia.
  exit /b 0
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo No encontre PowerShell. No puedo abrir TradingView.
  if not defined GRANJA_CALL pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-tradingview.ps1" -Port 9222
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo TradingView no se conecto.
  if not defined GRANJA_CALL pause
)
exit /b %RC%

:listening
set "PORT=%~1"
where curl.exe >nul 2>nul
if errorlevel 1 goto listening_ps
curl.exe -fsS -o NUL --max-time 2 "http://127.0.0.1:%PORT%/json/version" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:listening_ps
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/json/version'; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
