@echo off
rem Sin consola. El trabajo lo hace abrir-tradingview.ps1, oculto.
wscript.exe //B //Nologo "%~dp0lanzar-tradingview.vbs"
exit /b 0
