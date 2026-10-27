@echo off
rem Actualiza Prop Farm desde GitHub (apriai/AI-Profit). Ver docs\LEEME-ACTUALIZAR.md
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0actualizar.ps1"
echo.
pause