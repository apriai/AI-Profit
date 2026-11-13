# Construye dist\Profito-Setup.exe (NSIS 3.x, el mismo tipo que el de 0.10.2).
# Uso, en la raiz del repo, con makensis en el PATH:
#   powershell -NoProfile -ExecutionPolicy Bypass -File instalador\construir.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$version = (Get-Content -LiteralPath (Join-Path $root 'VERSION') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "VERSION no es x.y.z: $version" }
$vernum = "$version.0"

$gfx = Join-Path $root 'instalador\gfx'
foreach ($nombre in @('mui-bienvenida.bmp','mui-cabecera.bmp','p1-bienvenida.bmp','p2-carpeta.bmp','p3-progreso.bmp','p4-listo.bmp')) {
  if (-not (Test-Path -LiteralPath (Join-Path $gfx $nombre))) { throw "Falta instalador\gfx\$nombre" }
}
Write-Output "Preparando archivos de $version"
& node (Join-Path $root 'instalador\preparar.mjs')
if ($LASTEXITCODE -ne 0) { throw "preparar.mjs salio $LASTEXITCODE" }

$stage = Join-Path $root 'instalador\stage\app'
$nodeDir = Join-Path $stage 'node-win'
$nodeExe = Join-Path $nodeDir 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExe)) {
  $zip = Join-Path $env:TEMP 'node-v22.23.4-win-x64.zip'
  $esperado = 'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'
  Write-Output 'Bajando Node portable v22.23.4'
  Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip' -OutFile $zip
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLower()
  if ($hash -ne $esperado) { throw "SHA-256 de Node no coincide: $hash" }
  $extraido = Join-Path $env:TEMP 'node-v22.23.4-win-x64'
  if (Test-Path $extraido) { Remove-Item -Recurse -Force $extraido }
  Expand-Archive -LiteralPath $zip -DestinationPath $env:TEMP
  New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
  Copy-Item (Join-Path $extraido 'node.exe') $nodeExe
  Copy-Item (Join-Path $extraido 'LICENSE') (Join-Path $nodeDir 'LICENSE')
}

$makensis = Get-Command makensis -ErrorAction SilentlyContinue
if (-not $makensis) { throw 'No esta makensis. Instala NSIS 3.11 y ponlo en el PATH.' }
New-Item -ItemType Directory -Force -Path (Join-Path $root 'dist') | Out-Null
Push-Location $PSScriptRoot
try {
  & makensis "/DVERSION=$version" "/DVERNUM=$vernum" "/INPUTCHARSET" "UTF8" ".\profito.nsi"
} finally {
  Pop-Location
}
if ($LASTEXITCODE -ne 0) { throw "makensis salio $LASTEXITCODE" }
$out = Join-Path $root 'dist\Profito-Setup.exe'
if (-not (Test-Path -LiteralPath $out)) { throw "No se escribio $out" }
Write-Output "LISTO $out"
