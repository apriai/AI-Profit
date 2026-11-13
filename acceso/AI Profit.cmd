@echo off
rem Acceso de cada dia cuando no esta el AI Profit.exe compilado.
rem El exe viejo llama a profito-estado.mjs estado, que hace el mismo aviso.
setlocal EnableExtensions
set "ROOT=%~dp0.."
set "NODE="
if exist "%ROOT%\node-win\node.exe" set "NODE=%ROOT%\node-win\node.exe"
if not defined NODE where node >nul 2>nul && for /f "delims=" %%N in ('where node') do if not defined NODE set "NODE=%%N"
if not defined NODE (
  echo Falta Node en node-win.
  pause
  exit /b 1
)
"%NODE%" "%~dp0profito-estado.mjs" aviso "%TEMP%\profito-aviso.ini" "%ROOT%"
if errorlevel 20 exit /b 0
call "%~dp0Abrir Granja.bat"
exit /b %ERRORLEVEL%
