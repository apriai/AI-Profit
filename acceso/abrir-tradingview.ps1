# Abre TradingView Desktop con --remote-debugging-port=9222.
# No envia ordenes y no hace clic dentro de TradingView.
# Mismo orden de deteccion que elegirTv() en profito-estado.mjs.
# Si el primer arranque no abre el puerto, prueba el siguiente:
#   1. alias de ejecucion (%LOCALAPPDATA%\Microsoft\WindowsApps\TradingView.exe)
#   2. activacion del paquete MSIX (IApplicationActivationManager; conserva la identidad)
#   3. TradingView.exe dentro de WindowsApps, directo
param(
  [int]$Port = 9222,
  [switch]$Forzar
)

$ErrorActionPreference = 'Continue'

function Test-PuertoTv([int]$N) {
  foreach ($ruta in @('/json/version', '/json')) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri ("http://127.0.0.1:{0}{1}" -f $N, $ruta)
      if ($resp.StatusCode -eq 200 -and $resp.Content) { return $true }
    } catch {}
  }
  return $false
}

function Wait-PuertoTv([int]$N, [int]$Segundos) {
  for ($i = 0; $i -lt $Segundos; $i++) {
    if (Test-PuertoTv $N) { return $true }
    Start-Sleep -Seconds 1
  }
  return (Test-PuertoTv $N)
}

function Stop-TradingView {
  & taskkill.exe /F /IM TradingView.exe 2>$null | Out-Null
  Start-Sleep -Seconds 2
}

function Test-RutaWindowsApps([string]$Ruta) {
  return [bool]($Ruta -match '\\WindowsApps\\')
}

function Get-PaqueteTradingView {
  $pkg = Get-AppxPackage -Name 'TradingView.Desktop' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pkg) {
    $pkg = @(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object { $_.Name -like '*TradingView*' }) | Select-Object -First 1
  }
  return $pkg
}

function Get-DeteccionTv {
  $vacio = @{ Ruta = ''; Tipo = 'ninguno'; Alias = ''; Msix = ''; Paquete = $null }
  $clasicas = @()
  if ($env:LOCALAPPDATA) {
    $clasicas += (Join-Path $env:LOCALAPPDATA 'TradingView\TradingView.exe')
    $clasicas += (Join-Path $env:LOCALAPPDATA 'Programs\TradingView\TradingView.exe')
  }
  if ($env:ProgramFiles) { $clasicas += (Join-Path $env:ProgramFiles 'TradingView\TradingView.exe') }
  $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if ($pf86) { $clasicas += (Join-Path $pf86 'TradingView\TradingView.exe') }
  foreach ($f in $clasicas) {
    if ($f -and -not (Test-RutaWindowsApps $f) -and (Test-Path -LiteralPath $f)) {
      return @{ Ruta = $f; Tipo = 'clasico'; Alias = ''; Msix = ''; Paquete = $null }
    }
  }
  $alias = ''
  if ($env:LOCALAPPDATA) { $alias = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\TradingView.exe' }
  $tieneAlias = [bool]($alias -and (Test-Path -LiteralPath $alias))
  $pkg = Get-PaqueteTradingView
  $msix = ''
  if ($pkg -and $pkg.InstallLocation) { $msix = Join-Path $pkg.InstallLocation 'TradingView.exe' }
  if ($tieneAlias) { return @{ Ruta = $alias; Tipo = 'alias'; Alias = $alias; Msix = $msix; Paquete = $pkg } }
  if ($msix) { return @{ Ruta = $msix; Tipo = 'msix'; Alias = ''; Msix = $msix; Paquete = $pkg } }
  $proc = $null
  try { $proc = Get-CimInstance Win32_Process -Filter "Name = 'TradingView.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1 } catch {}
  if ($proc -and $proc.ExecutablePath) {
    $tipo = 'proceso'
    $msixProc = ''
    if (Test-RutaWindowsApps $proc.ExecutablePath) { $tipo = 'msix'; $msixProc = $proc.ExecutablePath }
    return @{ Ruta = $proc.ExecutablePath; Tipo = $tipo; Alias = ''; Msix = $msixProc; Paquete = $pkg }
  }
  $where = @()
  try { $where = @(& where.exe TradingView.exe 2>$null) } catch {}
  foreach ($w in $where) {
    $linea = ([string]$w).Trim()
    if (-not $linea) { continue }
    if ($linea -match '\\Microsoft\\WindowsApps\\TradingView\.exe$') {
      return @{ Ruta = $linea; Tipo = 'alias'; Alias = $linea; Msix = $msix; Paquete = $pkg }
    }
    if ((Test-RutaWindowsApps $linea) -or (Test-Path -LiteralPath $linea)) {
      if (Test-RutaWindowsApps $linea) {
        return @{ Ruta = $linea; Tipo = 'msix'; Alias = ''; Msix = $linea; Paquete = $pkg }
      }
      return @{ Ruta = $linea; Tipo = 'clasico'; Alias = ''; Msix = ''; Paquete = $null }
    }
  }
  return $vacio
}

function Start-ExeTv([string]$Archivo, [int]$N) {
  Start-Process -FilePath $Archivo -ArgumentList ("--remote-debugging-port={0}" -f $N) | Out-Null
}

function Get-AumidTv($Det) {
  try {
    $apps = @(Get-StartApps -ErrorAction SilentlyContinue | Where-Object { $_.AppID -match 'TradingView' -and $_.AppID -match '!' })
    $desk = $apps | Where-Object { $_.AppID -match 'Desktop' } | Select-Object -First 1
    if ($desk) { return [string]$desk.AppID }
    if ($apps.Count -gt 0) { return [string]$apps[0].AppID }
  } catch {}
  $pkg = $Det.Paquete
  if (-not $pkg -or -not $pkg.PackageFamilyName) { return $null }
  $id = 'TradingView.Desktop'
  if ($pkg.InstallLocation) {
    try {
      [xml]$xml = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -ErrorAction Stop
      $app = $xml.Package.Applications.Application
      if ($app -is [System.Array]) { $app = $app[0] }
      if ($app.Id) { $id = [string]$app.Id }
    } catch {}
  }
  return ($pkg.PackageFamilyName + '!' + $id)
}

function Start-ActivacionTv([string]$Aumid, [int]$N) {
  if (-not ('ProfitoTv.Puente' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace ProfitoTv {
  public enum Opciones { None = 0 }
  [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IGestor {
    void ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string id, [MarshalAs(UnmanagedType.LPWStr)] string args, Opciones opt, out uint pid);
    void ActivateForFile(IntPtr a, [MarshalAs(UnmanagedType.LPWStr)] string b, [MarshalAs(UnmanagedType.LPWStr)] string c, [MarshalAs(UnmanagedType.LPWStr)] string d, out uint pid);
    void ActivateForProtocol(IntPtr a, [MarshalAs(UnmanagedType.LPWStr)] string b, [MarshalAs(UnmanagedType.LPWStr)] string c, [MarshalAs(UnmanagedType.LPWStr)] string d, out uint pid);
  }
  public static class Puente {
    public static uint Abrir(string id, string args) {
      Type tipo = Type.GetTypeFromCLSID(new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C"));
      IGestor gestor = (IGestor)Activator.CreateInstance(tipo);
      uint pid;
      gestor.ActivateApplication(id, args, Opciones.None, out pid);
      return pid;
    }
  }
}
'@
  }
  [void][ProfitoTv.Puente]::Abrir($Aumid, ("--remote-debugging-port={0}" -f $N))
}

$det = Get-DeteccionTv
Write-Output ("RUTA={0}" -f $det.Ruta)
Write-Output ("TIPO={0}" -f $det.Tipo)

if ((Test-PuertoTv $Port) -and -not $Forzar) {
  Write-Output 'RESULTADO=OK'
  exit 0
}

$plan = @()
$aumid = $null
$directo = ''
if ($det.Tipo -eq 'clasico' -and $det.Ruta) {
  $plan += 'clasico'
} else {
  if ($det.Alias -and (Test-Path -LiteralPath $det.Alias)) { $plan += 'alias' }
  $aumid = Get-AumidTv $det
  if ($aumid) { $plan += 'activacion' }
  if ($det.Msix) { $directo = $det.Msix }
  elseif (Test-RutaWindowsApps $det.Ruta) { $directo = $det.Ruta }
  if ($directo) { $plan += 'windowsapps' }
}

if ($plan.Count -eq 0) {
  Write-Output 'RESULTADO=FALLA'
  Write-Output 'No hay TradingView Desktop (ni clasico, ni paquete, ni proceso).'
  exit 1
}

foreach ($nombre in $plan) {
  Stop-TradingView
  Write-Output ("INTENTO={0}" -f $nombre)
  try {
    if ($nombre -eq 'clasico') { Start-ExeTv $det.Ruta $Port }
    elseif ($nombre -eq 'alias') { Start-ExeTv $det.Alias $Port }
    elseif ($nombre -eq 'activacion') { Start-ActivacionTv $aumid $Port }
    elseif ($nombre -eq 'windowsapps') { Start-ExeTv $directo $Port }
  } catch {
    Write-Output ("FALLO={0} {1}" -f $nombre, $_.Exception.Message)
  }
  if (Wait-PuertoTv $Port 15) {
    Write-Output ("METODO={0}" -f $nombre)
    Write-Output 'RESULTADO=OK'
    exit 0
  }
}

Write-Output 'RESULTADO=FALLA'
Write-Output ("http://127.0.0.1:{0}/json no respondio" -f $Port)
exit 1
