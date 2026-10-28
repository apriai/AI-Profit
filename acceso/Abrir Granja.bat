@echo off
rem AI Profit: TradingView (puerto 9222) + servidor TradingLink + la Granja.
rem No envia ordenes. El icono del Escritorio lo crea instalar-ai-profit.bat.
setlocal EnableExtensions
set "ROOT=%~dp0.."
cd /d "%ROOT%"
title AI Profit

if not exist "%ROOT%\motor\tradinglink.mjs" (
  echo No encuentro motor\tradinglink.mjs. Este acceso tiene que estar en la carpeta acceso.
  pause
  exit /b 1
)

rem El servidor arranca primero, para que el atajo funcione aunque TradingView este cerrado.
call :listening_http 8787
if errorlevel 1 call :arrancar_servidor

call :listening 9222
if not errorlevel 1 goto server

echo El puerto 9222 no responde.
echo Se cierra TradingView si estaba abierto y se vuelve a abrir con depuracion.
echo Esto no envia ordenes.
echo Si tienes una operacion abierta, di que NO: cierra TradingView tu mismo cuando estes plana.
choice /C SN /N /M "Cerrar TradingView y abrirlo conectado? (S = si, N = no): "
if errorlevel 2 (
  echo No se cerro nada. Abre TradingView con el puerto 9222 cuando estes plana.
  echo La granja se abre igual; TradingView se conecta solo cuando lo abras con el puerto.
  goto server
)
taskkill /F /IM TradingView.exe >nul 2>&1
ping -n 4 127.0.0.1 >nul
set "GRANJA_CALL=1"
call "%~dp0abrir-tradingview.bat"
if errorlevel 1 (
  echo No se pudo abrir TradingView con el puerto 9222. La granja se abre igual.
  goto server
)
echo Esperando a TradingView...
set "TRIES=0"
:wait_tv
call :listening 9222
if not errorlevel 1 goto server
set /a TRIES+=1
if %TRIES% GEQ 20 (
  echo TradingView aun no responde en el puerto 9222. La granja se abrira igual.
  goto server
)
ping -n 2 127.0.0.1 >nul
goto wait_tv

:server
call :listening_http 8787
if not errorlevel 1 goto browser

set "NODE="
if exist "%ROOT%\node-win\node.exe" set "NODE=%ROOT%\node-win\node.exe"
if not defined NODE if exist "%ROOT%\node\node.exe" set "NODE=%ROOT%\node\node.exe"
if not defined NODE if exist "%ROOT%\node\bin\node.exe" set "NODE=%ROOT%\node\bin\node.exe"
if not defined NODE (
  for /f "delims=" %%N in ('where node 2^>nul') do (
    if not defined NODE set "NODE=%%N"
  )
)
if not defined NODE (
  echo Falta Node.js para Windows v18+.
  echo Copia node.exe en la carpeta node-win\ (en la raiz de TradingLink) o instalalo desde https://nodejs.org
  pause
  exit /b 1
)

echo Encendiendo TradingLink...
start "TradingLink" /MIN "%NODE%" "%ROOT%\motor\tradinglink.mjs"
set "TRIES=0"
:wait_srv
call :listening_http 8787
if not errorlevel 1 goto browser
set /a TRIES+=1
if %TRIES% GEQ 15 (
  echo El servidor no respondio en http://127.0.0.1:8787.
  echo Revisa la ventana minimizada TradingLink.
  goto browser
)
ping -n 2 127.0.0.1 >nul
goto wait_srv

:browser
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if defined CHROME (
  start "" "%CHROME%" "http://localhost:8787/Granja-de-Cuentas-v2.html"
) else (
  start "" "http://localhost:8787/Granja-de-Cuentas-v2.html"
)
echo.
echo Listo. Granja: http://localhost:8787/Granja-de-Cuentas-v2.html
echo No cierres la ventana minimizada TradingLink: ahi sigue el servidor.
echo Puedes cerrar esta ventana.
ping -n 6 127.0.0.1 >nul
exit /b 0

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

:listening_http
set "PORT=%~1"
where curl.exe >nul 2>nul
if errorlevel 1 goto listening_http_ps
curl.exe -fsS -o NUL --max-time 2 "http://127.0.0.1:%PORT%/" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:listening_http_ps
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:%PORT%/'; exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:arrancar_servidor
set "NODE="
if exist "%ROOT%\node-win\node.exe" set "NODE=%ROOT%\node-win\node.exe"
if not defined NODE if exist "%ROOT%\node\node.exe" set "NODE=%ROOT%\node\node.exe"
if not defined NODE if exist "%ROOT%\node\bin\node.exe" set "NODE=%ROOT%\node\bin\node.exe"
if not defined NODE (
  for /f "delims=" %%N in ('where node 2^>nul') do (
    if not defined NODE set "NODE=%%N"
  )
)
if not defined NODE exit /b 1
start "TradingLink" /MIN "%NODE%" "%ROOT%\motor\tradinglink.mjs"
exit /b 0
