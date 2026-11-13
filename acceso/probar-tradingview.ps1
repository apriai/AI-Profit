# Prueba en la PC de la clienta (Windows, TradingView Desktop de la Store o de tradingview.com/desktop).
# Detecta la ruta, cierra TradingView, lo abre con el puerto 9222 por el mismo metodo que Profito
# y comprueba http://127.0.0.1:9222/json . La ultima linea es OK o FALLA.
# Ejecutar:
#   powershell -NoProfile -ExecutionPolicy Bypass -File acceso\probar-tradingview.ps1
$ErrorActionPreference = 'Continue'
$lanzador = Join-Path $PSScriptRoot 'abrir-tradingview.ps1'
if (-not (Test-Path -LiteralPath $lanzador)) {
  Write-Output 'FALLA'
  Write-Output 'Falta acceso\abrir-tradingview.ps1'
  exit 1
}
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $lanzador -Port 9222 -Forzar
if ($LASTEXITCODE -eq 0) {
  Write-Output 'OK'
  exit 0
}
Write-Output 'FALLA'
exit 1
