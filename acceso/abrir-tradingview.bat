@echo off
rem Abre TradingView Desktop con --remote-debugging-port=9222.
rem No envia ordenes y no hace clic dentro de TradingView.
rem Si el puerto 9222 ya responde, no toca TradingView.
rem El acceso "AI Profit" (Abrir Granja.bat) lo cierra y lo vuelve a abrir
rem cuando estaba abierto sin ese puerto.
setlocal EnableExtensions
cd /d "%~dp0"

call :listening 9222
if not errorlevel 1 (
  echo TradingView ya escucha en el puerto 9222. No se reinicia.
  exit /b 0
)

call :find_tv
if not defined TV_EXE (
  echo No encontre TradingView.exe.
  echo Busque la app de Microsoft Store, %%LOCALAPPDATA%%\TradingView y Program Files.
  if not defined GRANJA_CALL pause
  exit /b 1
)

echo Abriendo: %TV_EXE%
start "" "%TV_EXE%" --remote-debugging-port=9222
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

:find_tv
set "TV_EXE="
if exist "%LOCALAPPDATA%\TradingView\TradingView.exe" set "TV_EXE=%LOCALAPPDATA%\TradingView\TradingView.exe"
if not defined TV_EXE if exist "%ProgramFiles%\TradingView\TradingView.exe" set "TV_EXE=%ProgramFiles%\TradingView\TradingView.exe"
if not defined TV_EXE if exist "%ProgramFiles(x86)%\TradingView\TradingView.exe" set "TV_EXE=%ProgramFiles(x86)%\TradingView\TradingView.exe"
if not defined TV_EXE (
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-AppxPackage TradingView.Desktop -ErrorAction SilentlyContinue).InstallLocation"`) do (
    if exist "%%i\TradingView.exe" set "TV_EXE=%%i\TradingView.exe"
  )
)
if not defined TV_EXE (
  for /f "delims=" %%i in ('where TradingView.exe 2^>nul') do (
    if not defined TV_EXE set "TV_EXE=%%i"
  )
)
exit /b 0
