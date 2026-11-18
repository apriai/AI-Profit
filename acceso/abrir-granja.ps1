# Abre la granja en su ventana, sin consola.
# El predeterminado si es Chrome, Edge o Brave. Si no, Chrome y despues Edge.
# navegador-granja.mjs elige el predeterminado.
function Get-NodeProfito([string]$Root) {
  $propio = Join-Path $Root 'node-win\node.exe'
  if (Test-Path -LiteralPath $propio) { return $propio }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  return $null
}

function Get-NavegadorGranja([string]$Root) {
  $node = Get-NodeProfito $Root
  $mjs = Join-Path $Root 'acceso\navegador-granja.mjs'
  if ($node -and (Test-Path -LiteralPath $mjs)) {
    try {
      $out = & $node $mjs 2>$null
      if ($out) {
        $linea = @($out) | Select-Object -First 1
        if ($linea) { return $linea.ToString().Trim() }
      }
    } catch {}
  }
  $pf86 = ${env:ProgramFiles(x86)}
  $candidatos = @(
    (Join-Path $env:ProgramFiles 'BraveSoftware\Brave-Browser\Application\brave.exe'),
    (Join-Path $pf86 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $pf86 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )
  foreach ($c in $candidatos) {
    if ($c -and (Test-Path -LiteralPath $c)) { return $c }
  }
  return $null
}

function Abrir-Granja([string]$Root) {
  $perfil = Join-Path $env:LOCALAPPDATA 'Profito\navegador'
  if (-not $env:LOCALAPPDATA) { $perfil = Join-Path $env:TEMP 'Profito-navegador' }
  $nav = Get-NavegadorGranja $Root
  if ($nav) {
    Start-Process -FilePath $nav -ArgumentList @(
      '--autoplay-policy=no-user-gesture-required',
      '--app=http://localhost:8787/Granja-de-Cuentas-v2.html',
      "--user-data-dir=$perfil",
      '--no-first-run',
      '--no-default-browser-check'
    )
    return $true
  }
  # ultimo recurso: start "" "http://localhost:8787/Granja-de-Cuentas-v2.html"
  Start-Process 'http://localhost:8787/Granja-de-Cuentas-v2.html'
  return $true
}

if ($MyInvocation.InvocationName -ne '.') {
  $raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
  Abrir-Granja $raiz
}
