@echo off
rem Abre TradingView Desktop (app de Microsoft Store) con modo debug en el puerto 9222.
rem Cierra TradingView antes de usar esto.
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-AppxPackage TradingView.Desktop).InstallLocation"') do set TVDIR=%%i
start "" "%TVDIR%\TradingView.exe" --remote-debugging-port=9222
