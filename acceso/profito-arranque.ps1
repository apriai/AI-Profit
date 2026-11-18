# Arranque oculto: servidor, TradingView y la granja. La pantalla de carga lee carga.txt.
# No abre ordenes. No es una ventana.
param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)
$ErrorActionPreference = 'Continue'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $aqui 'abrir-granja.ps1')

function Carpeta-Logs {
  $base = $env:LOCALAPPDATA
  if (-not $base) { $base = Join-Path $env:USERPROFILE 'AppData\Local' }
  $dir = Join-Path $base 'Profito\datos\logs'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Escribir-Paso([string]$texto) {
  $dir = Carpeta-Logs
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Join-Path $dir 'carga.txt'), $texto, $utf8)
  Add-Content -LiteralPath (Join-Path $dir 'lanzador.log') -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto) -Encoding UTF8
}

function Esperar-Url([string]$url, [int]$segundos) {
  $fin = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fin) {
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 400
  }
  return $false
}

Escribir-Paso 'Encendiendo servidor…'
$servidorListo = Esperar-Url 'http://127.0.0.1:8787/' 25
if (-not $servidorListo) {
  Escribir-Paso 'Encendiendo servidor…'
}

Escribir-Paso 'Conectando TradingView…'
$tv = $false
try {
  $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:9222/json/version'
  if ($r.StatusCode -eq 200) { $tv = $true }
} catch { $tv = $false }
if (-not $tv) {
  $ps1 = Join-Path $aqui 'abrir-tradingview.ps1'
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'powershell.exe'
  $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ps1`" -Port 9222"
  $psi.WorkingDirectory = $Root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $p = [System.Diagnostics.Process]::Start($psi)
  if ($p) { $p.WaitForExit() }
  $tv = Esperar-Url 'http://127.0.0.1:9222/json/version' 8
}
if (-not $tv) { Escribir-Paso 'Conectando TradingView…' }

Escribir-Paso 'Abriendo granja…'
Abrir-Granja $Root
$abierta = Esperar-Url 'http://127.0.0.1:8787/Granja-de-Cuentas-v2.html' 20
if ($abierta) { Escribir-Paso 'LISTO' } else { Escribir-Paso 'Abriendo granja…' }
