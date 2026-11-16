@echo off
rem Sin consola. La bandeja enciende el servidor, TradingView y la granja.
if /I "%~1"=="--oculto" goto oculto
wscript.exe //B //Nologo "%~dp0AI Profit.vbs"
exit /b 0
:oculto
wscript.exe //B //Nologo "%~dp0AI Profit.vbs"
exit /b 0
