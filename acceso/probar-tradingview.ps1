# Prueba en la PC (Windows). No envia ordenes.
# Sin argumentos: cierra TradingView y lo vuelve a abrir con el puerto de la granja.
# Con -SoloDetectar: solo dice donde esta, sin cerrarlo.
# La ultima linea es OK o FALLA.
#   powershell -NoProfile -ExecutionPolicy Bypass -File acceso\probar-tradingview.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File acceso\probar-tradingview.ps1 -SoloDetectar
param([switch]$SoloDetectar)
$ErrorActionPreference = 'Continue'
$lanzador = Join-Path $PSScriptRoot 'abrir-tradingview.ps1'
if (-not (Test-Path -LiteralPath $lanzador)) {
  Write-Output 'FALLA'
  Write-Output 'Falta acceso\abrir-tradingview.ps1'
  exit 1
}
if ($SoloDetectar) {
  Write-Output 'MODO=detectar'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $lanzador -SoloDetectar
} else {
  Write-Output 'AVISO=Esto cierra TradingView y lo vuelve a abrir. No cierra posiciones en el broker.'
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $lanzador -Port 9222 -Forzar
}
if ($LASTEXITCODE -eq 0) {
  Write-Output 'OK'
  exit 0
}
Write-Output 'FALLA'
exit 1
