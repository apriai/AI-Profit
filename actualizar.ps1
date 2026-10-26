# actualizar.ps1 - trae el codigo mas reciente de https://github.com/apriai/AI-Profit (rama main)
# Solo actualiza archivos que estan en el repositorio. NO borra nada. NO usa reset --hard.
# Antes de reemplazar, respalda en backups\pre-actualizar-<fecha-hora>.
$ErrorActionPreference = 'Continue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir
$repo = 'https://github.com/apriai/AI-Profit.git'
$gitExe = Join-Path $dir 'git-portable\cmd\git.exe'

Write-Host '=== Actualizar Prop Farm desde GitHub ===' -ForegroundColor Cyan
Write-Host "Carpeta: $dir"
if (-not (Test-Path -LiteralPath (Join-Path $dir 'tradinglink.mjs'))) {
  Write-Host 'AVISO: aqui no veo tradinglink.mjs. Pon actualizar.bat en tu carpeta TradingLink. Sigo de todos modos (es la primera instalacion?).' -ForegroundColor Yellow
}

# 1) Git portatil (solo dentro de esta carpeta)
if (-not (Test-Path -LiteralPath $gitExe)) {
  Write-Host 'No encuentro git-portable. Descargando Git portatil (unos 60 MB)...'
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $rel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'actualizar-ps1' }
    $asset = $rel.assets | Where-Object { $_.name -match '^PortableGit-.*-64-bit\.7z\.exe$' } | Select-Object -First 1
    if (-not $asset) { throw 'No encontre PortableGit 64-bit en la ultima version.' }
    $tmp = Join-Path $env:TEMP $asset.name
    Invoke-WebRequest $asset.browser_download_url -OutFile $tmp -UseBasicParsing
    if ((Get-Item $tmp).Length -lt 30MB) { throw 'La descarga parece incompleta.' }
    $out = Join-Path $dir 'git-portable'
    Start-Process -FilePath $tmp -ArgumentList ('-o"' + $out + '"'), '-y' -Wait -NoNewWindow
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  } catch { Write-Host "ERROR descargando Git: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
  if (-not (Test-Path -LiteralPath $gitExe)) { Write-Host 'ERROR: Git portatil no quedo instalado.' -ForegroundColor Red; exit 1 }
}
# Solo para este proceso (no se cambia el PATH de Windows)
$env:PATH = (Join-Path $dir 'git-portable\cmd') + ';' + $env:PATH
Write-Host ((& $gitExe --version) -join ' ')

# 2) Repositorio local
if (-not (Test-Path -LiteralPath (Join-Path $dir '.git'))) {
  Write-Host 'Primera vez: preparando el repositorio local...'
  & $gitExe init -b main | Out-Null
  & $gitExe remote add origin $repo
} else {
  & $gitExe remote set-url origin $repo
}
& $gitExe config core.autocrlf false
& $gitExe config core.safecrlf false
& $gitExe config core.quotepath false
& $gitExe config user.name 'prop-farm-local'
& $gitExe config user.email 'prop-farm-local@users.noreply.github.com'

# 3) Descargar (aqui pide iniciar sesion en GitHub la primera vez: se abre el navegador)
Write-Host 'Conectando con GitHub (si se abre el navegador, inicia sesion con el usuario karocerquera)...'
& $gitExe fetch origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host 'ERROR: no pude descargar de GitHub. Revisa: (1) que Baned te agrego como colaboradora (usuario karocerquera), (2) que aceptaste la invitacion, (3) que iniciaste sesion con esa cuenta, (4) internet.' -ForegroundColor Red
  exit 1
}
$null = & $gitExe rev-parse --verify origin/main 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR: origin/main no existe todavia (el repositorio esta vacio).' -ForegroundColor Red; exit 1 }

# 4) Que archivos cambian? (compara el contenido local con el de GitHub)
$tree = & $gitExe ls-tree -r origin/main
$cambian = New-Object System.Collections.Generic.List[string]
$nuevos = 0
foreach ($line in $tree) {
  if ($line -notmatch '^(\d+) blob ([0-9a-f]+)\t(.+)$') { continue }
  $sha = $Matches[2]; $rel = $Matches[3]
  $loc = Join-Path $dir ($rel -replace '/', '\')
  if (Test-Path -LiteralPath $loc -PathType Leaf) {
    $h = (& $gitExe hash-object -- $loc)
    if ($h -ne $sha) { $cambian.Add($rel) }
  } else { $nuevos++ }
}
Write-Host ("Archivos que cambian: {0}   Archivos nuevos: {1}" -f $cambian.Count, $nuevos)

# 5) Respaldo de lo que se va a sobrescribir
if ($cambian.Count -gt 0) {
  $bk = Join-Path $dir ('backups\pre-actualizar-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  foreach ($rel in $cambian) {
    $src = Join-Path $dir ($rel -replace '/', '\')
    $dst = Join-Path $bk ($rel -replace '/', '\')
    New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }
  Write-Host "Respaldo guardado en: $bk" -ForegroundColor Green
}

# 6) Actualizar SOLO los archivos del repositorio (no borra nada, no toca archivos personales)
& $gitExe checkout origin/main -- .
if ($LASTEXITCODE -ne 0) { Write-Host 'ERROR al actualizar los archivos. Tus respaldos estan en backups\.' -ForegroundColor Red; exit 1 }
& $gitExe update-ref refs/heads/main origin/main
$corto = (& $gitExe rev-parse --short origin/main)
Write-Host ''
Write-Host "LISTO. Version del codigo: $corto" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Yellow
Write-Host ' IMPORTANTE: el codigo nuevo NO se usa hasta reiniciar el servidor.' -ForegroundColor Yellow
Write-Host ' Reinicia el servidor SOLO cuando estes plana y sin ordenes' -ForegroundColor Yellow
Write-Host ' (sin posicion abierta, sin ordenes de trabajo, ningun trade en curso).' -ForegroundColor Yellow
Write-Host '============================================================' -ForegroundColor Yellow