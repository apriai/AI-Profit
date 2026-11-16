# Prueba el instalador en Windows.
#   -Modo clic        manda un clic de ratón al botón verde y espera la copia.
#   -Modo silencioso  ejecuta el exe con /S.
# Sale 0 si la versión esperada quedó instalada. Si -DebeFallar, sale 0 cuando NO instala.
param(
  [ValidateSet('clic', 'silencioso')]
  [string]$Modo = 'clic',
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$Dir,
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Captura = '',
  [switch]$DebeFallar,
  [int]$EsperaSeg = 90
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Exe)) { throw "No esta $Exe" }

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
public class InstUI {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lp, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc lp, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public struct RECT { public int L, T, R, B; }
  public static List<IntPtr> Tops(uint pid) {
    var found = new List<IntPtr>();
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p == pid && IsWindowVisible(h)) found.Add(h);
      return true;
    }, IntPtr.Zero);
    return found;
  }
  public static void Children(IntPtr root, List<IntPtr> into) {
    EnumChildWindows(root, (h, l) => { into.Add(h); return true; }, IntPtr.Zero);
  }
  public static string ClassOf(IntPtr h) {
    var s = new StringBuilder(128);
    GetClassName(h, s, s.Capacity);
    return s.ToString();
  }
  public static string TextOf(IntPtr h) {
    var s = new StringBuilder(256);
    GetWindowText(h, s, s.Capacity);
    return s.ToString();
  }
  public static void Click(IntPtr h) {
    RECT r; GetWindowRect(h, out r);
    int x = Math.Max(1, (r.R - r.L) / 2);
    int y = Math.Max(1, (r.B - r.T) / 2);
    int packed = (y << 16) | (x & 0xFFFF);
    SendMessage(h, 0x0201, (IntPtr)1, (IntPtr)packed);
    SendMessage(h, 0x0202, IntPtr.Zero, (IntPtr)packed);
  }
  public static void Shot(IntPtr h, string path) {
    RECT r; if (!GetWindowRect(h, out r)) return;
    int w = Math.Max(1, r.R - r.L), hh = Math.Max(1, r.B - r.T);
    using (var bmp = new Bitmap(w, hh)) {
      using (var g = Graphics.FromImage(bmp)) {
        IntPtr hdc = g.GetHdc();
        PrintWindow(h, hdc, 0);
        g.ReleaseHdc(hdc);
      }
      var folder = System.IO.Path.GetDirectoryName(path);
      if (!string.IsNullOrEmpty(folder)) System.IO.Directory.CreateDirectory(folder);
      bmp.Save(path, ImageFormat.Png);
    }
  }
}
'@ -ReferencedAssemblies System.Drawing

function Esperar-Ventana([System.Diagnostics.Process]$Proc, [int]$Seg) {
  $fin = (Get-Date).AddSeconds($Seg)
  while ((Get-Date) -lt $fin) {
    $Proc.Refresh()
    if ($Proc.HasExited) { return [IntPtr]::Zero }
    $tops = [InstUI]::Tops([uint32]$Proc.Id)
    if ($tops.Count -gt 0) { return $tops[0] }
    Start-Sleep -Milliseconds 300
  }
  return [IntPtr]::Zero
}

function Elegir-Boton([IntPtr]$Raiz) {
  $hijos = New-Object System.Collections.Generic.List[IntPtr]
  [InstUI]::Children($Raiz, $hijos) | Out-Null
  $mejor = [IntPtr]::Zero
  $mejorX = -1
  foreach ($h in $hijos) {
    $r = New-Object InstUI+RECT
    if (-not [InstUI]::GetWindowRect($h, [ref]$r)) { continue }
    $w = $r.R - $r.L
    $hh = $r.B - $r.T
    $area = $w * $hh
    $clase = [InstUI]::ClassOf($h)
    $texto = [InstUI]::TextOf($h)
    Write-Output ("HIJO clase={0} texto={1} {2}x{3} x={4}" -f $clase, $texto, $w, $hh, $r.L)
    if ($area -ge 2500 -and $area -le 12000 -and $hh -ge 24 -and $hh -le 80 -and $r.L -gt $mejorX) {
      if ($clase -match 'Button|Static') {
        $mejor = $h
        $mejorX = $r.L
      }
    }
  }
  return $mejor
}

if (Test-Path -LiteralPath $Dir) { Remove-Item -LiteralPath $Dir -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dir) | Out-Null

if ($Modo -eq 'silencioso') {
  Write-Output "SILENCIOSO $Exe -> $Dir"
  $p = Start-Process -FilePath $Exe -ArgumentList @('/S', "/D=$Dir") -Wait -PassThru
  Write-Output ("EXIT={0}" -f $p.ExitCode)
} else {
  Write-Output "CLIC $Exe"
  $p = Start-Process -FilePath $Exe -PassThru
  $ventana = Esperar-Ventana $p 25
  if ($ventana -eq [IntPtr]::Zero) { throw 'No aparecio la ventana del instalador' }
  [InstUI]::SetForegroundWindow($ventana) | Out-Null
  Start-Sleep -Milliseconds 800
  if ($Captura) { [InstUI]::Shot($ventana, ($Captura -replace '\.png$', '-antes.png')) }
  $boton = Elegir-Boton $ventana
  if ($boton -eq [IntPtr]::Zero) { throw 'No encontre el boton verde' }
  Write-Output ("CLIC_EN clase={0} texto={1}" -f [InstUI]::ClassOf($boton), [InstUI]::TextOf($boton))
  [InstUI]::Click($boton)
  $fin = (Get-Date).AddSeconds($EsperaSeg)
  $marca = Join-Path $Dir 'VERSION'
  $wav1 = Join-Path $Dir 'motor\sonidos\clic-burbuja.wav'
  $wav2 = Join-Path $Dir 'motor\sonidos\despertar-wuhu.wav'
  while ((Get-Date) -lt $fin) {
    $lista = ''
    if (Test-Path -LiteralPath $marca) { $lista = (Get-Content -LiteralPath $marca -Raw).Trim() }
    if ($lista -eq $Version -and (Test-Path -LiteralPath $wav1) -and (Test-Path -LiteralPath $wav2)) { break }
    Start-Sleep -Milliseconds 400
  }
  if ($Captura) {
    $tops = [InstUI]::Tops([uint32]$p.Id)
    if ($tops.Count -gt 0) { [InstUI]::Shot($tops[0], $Captura) }
  }
  if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
}

$marca = Join-Path $Dir 'VERSION'
$leida = ''
if (Test-Path -LiteralPath $marca) { $leida = (Get-Content -LiteralPath $marca -Raw).Trim() }
Write-Output ("VERSION_LEIDA={0}" -f $leida)
$ok = $leida -eq $Version
if ($DebeFallar) {
  if ($ok) { throw "Instalo $Version y no debia" }
  Write-Output 'RESULTADO=NO_INSTALO'
  exit 0
}
if (-not $ok) { throw "Esperaba $Version y lei '$leida'" }
$wav1 = Join-Path $Dir 'motor\sonidos\clic-burbuja.wav'
$wav2 = Join-Path $Dir 'motor\sonidos\despertar-wuhu.wav'
if ($Modo -eq 'clic') {
  if (-not (Test-Path -LiteralPath $wav1)) { throw "Falta $wav1" }
  if (-not (Test-Path -LiteralPath $wav2)) { throw "Falta $wav2" }
}
Write-Output 'RESULTADO=OK'
exit 0
