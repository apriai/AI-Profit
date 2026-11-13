@echo off
rem Lo abre AI Profit.exe (ShellExecute) cuando TradingView es el paquete MSIX.
rem El argumento --remote-debugging-port=9222 lo pone el acceso; aqui el puerto va fijo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0abrir-tradingview.ps1" -Port 9222
exit /b %ERRORLEVEL%
