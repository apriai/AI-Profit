# Prueba el instalador en Windows.
#   -Modo clic        manda un clic de ratón al botón verde y espera la copia.
#   -Modo silencioso  ejecuta el exe con /S.
# Sale 0 si la versión esperada quedó instalada. Si -DebeFallar, sale 0 cuando NO instala.
param(
  [ValidateSet('clic', 'silencioso', 'flujo')]
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
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, System.UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
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
  public static string Ultimo = "";
  public static IntPtr FindButton(IntPtr root) {
    IntPtr best = IntPtr.Zero;
    int bestX = -1;
    var log = new StringBuilder();
    EnumChildWindows(root, (h, l) => {
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      int w = r.R - r.L, hh = r.B - r.T, area = w * hh;
      var cls = new StringBuilder(128);
      var txt = new StringBuilder(256);
      GetClassName(h, cls, 128);
      GetWindowText(h, txt, 256);
      log.AppendLine(string.Format("HIJO clase={0} texto={1} {2}x{3} x={4}", cls, txt, w, hh, r.L));
      string c = cls.ToString();
      if (area >= 2500 && area <= 12000 && hh >= 24 && hh <= 80 && r.L > bestX && (c == "Button" || c == "Static")) {
        best = h;
        bestX = r.L;
      }
      return true;
    }, IntPtr.Zero);
    Ultimo = log.ToString();
    return best;
  }
  public static void Click(IntPtr h) {
    SendMessage(h, 0x00F5, IntPtr.Zero, IntPtr.Zero);
  }
  public static void RealClick(IntPtr top, IntPtr h) {
    RECT r; GetWindowRect(h, out r);
    int x = (r.L + r.R) / 2;
    int y = (r.T + r.B) / 2;
    keybd_event(0x12, 0, 0, System.UIntPtr.Zero);
    keybd_event(0x12, 0, 2, System.UIntPtr.Zero);
    SetForegroundWindow(top);
    SetCursorPos(x, y);
    mouse_event(0x0002, 0, 0, 0, System.UIntPtr.Zero);
    mouse_event(0x0004, 0, 0, 0, System.UIntPtr.Zero);
  }
  public static bool HasText(IntPtr root, string needle) {
    bool found = false;
    EnumChildWindows(root, (h, l) => {
      var txt = new StringBuilder(256);
      GetWindowTextW(h, txt, 256);
      if (txt.ToString().IndexOf(needle, System.StringComparison.Ordinal) >= 0) found = true;
      return true;
    }, IntPtr.Zero);
    return found;
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

Remove-Item -LiteralPath 'HKCU:\Software\AI Profit' -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $Dir) { Remove-Item -LiteralPath $Dir -Recurse -Force }

function Leer-Version([string]$Carpeta) {
  $marca = Join-Path $Carpeta 'VERSION'
  if (Test-Path -LiteralPath $marca) { return (Get-Content -LiteralPath $marca -Raw).Trim() }
  return ''
}

if ($Modo -eq 'silencioso') {
  Write-Output "SILENCIOSO $Exe -> $Dir"
  $p = Start-Process -FilePath $Exe -ArgumentList @('/S', "/D=$Dir") -Wait -PassThru
  Write-Output ("EXIT={0}" -f $p.ExitCode)
} elseif ($Modo -eq 'flujo') {
  Write-Output "FLUJO $Exe"
  $p = Start-Process -FilePath $Exe -PassThru
  $ventana = Esperar-Ventana $p 25
  if ($ventana -eq [IntPtr]::Zero) { throw 'No aparecio la ventana del instalador' }
  Start-Sleep -Milliseconds 800
  if ($Captura) { [InstUI]::Shot($ventana, ($Captura -replace '\.png$', '-01-bienvenida.png')) }
  $boton = [InstUI]::FindButton($ventana)
  if ($boton -eq [IntPtr]::Zero) { throw 'No encontre Instalar' }
  Write-Output ("CLIC_INSTALAR clase={0}" -f [InstUI]::ClassOf($boton))
  [InstUI]::RealClick($ventana, $boton)
  $fin = (Get-Date).AddSeconds($EsperaSeg)
  $vioListo = $false
  while ((Get-Date) -lt $fin) {
    $tops = [InstUI]::Tops([uint32]$p.Id)
    if ($tops.Count -gt 0 -and [InstUI]::HasText($tops[0], 'Listo')) { $vioListo = $true; $ventana = $tops[0]; break }
    if ((Leer-Version $Dir) -eq $Version) { }
    Start-Sleep -Milliseconds 400
  }
  if (-not $vioListo) { throw 'La barra termino pero no aparecio la pantalla Listo' }
  if ($Captura) { [InstUI]::Shot($ventana, ($Captura -replace '\.png$', '-02-listo.png')) }
  $abrir = [InstUI]::FindButton($ventana)
  if ($abrir -eq [IntPtr]::Zero) { throw 'No encontre Abrir' }
  Write-Output ("CLIC_ABRIR clase={0}" -f [InstUI]::ClassOf($abrir))
  [InstUI]::RealClick($ventana, $abrir)
  $fin = (Get-Date).AddSeconds(25)
  $abrio = $false
  while ((Get-Date) -lt $fin) {
    $procs = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -match 'AI Profit|Abrir Granja|tradinglink|profito-estado'
    })
    if ($procs.Count -gt 0) { $abrio = $true; Write-Output ("PROFITO_PROCESOS={0}" -f $procs.Count); break }
    Start-Sleep -Milliseconds 400
  }
  if ($Captura) {
    $tops = [InstUI]::Tops([uint32]$p.Id)
    if ($tops.Count -gt 0) { [InstUI]::Shot($tops[0], ($Captura -replace '\.png$', '-03-tras-abrir.png')) }
  }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match 'AI Profit|Abrir Granja|tradinglink|profito-estado|Profito-Setup'
  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  if (-not $abrio) { throw 'Abrir no arranco Profito' }
  Write-Output 'ABRIO=OK'
} else {
  Write-Output "CLIC $Exe"
  $p = Start-Process -FilePath $Exe -PassThru
  $ventana = Esperar-Ventana $p 25
  if ($ventana -eq [IntPtr]::Zero) { throw 'No aparecio la ventana del instalador' }
  [InstUI]::SetForegroundWindow($ventana) | Out-Null
  Start-Sleep -Milliseconds 800
  if ($Captura) { [InstUI]::Shot($ventana, ($Captura -replace '\.png$', '-antes.png')) }
  $boton = [InstUI]::FindButton($ventana)
  Write-Output [InstUI]::Ultimo
  if ($boton -eq [IntPtr]::Zero) { throw 'No encontre el boton verde' }
  Write-Output ("CLIC_EN clase={0} texto={1}" -f [InstUI]::ClassOf($boton), [InstUI]::TextOf($boton))
  [InstUI]::Click($boton)
  $fin = (Get-Date).AddSeconds($EsperaSeg)
  while ((Get-Date) -lt $fin) {
    if ((Leer-Version $Dir) -eq $Version) { break }
    $reg = ''
    try { $reg = (Get-ItemProperty -LiteralPath 'HKCU:\Software\AI Profit' -ErrorAction Stop).InstallDir } catch {}
    if ($reg -and (Leer-Version $reg) -eq $Version) { $script:Dir = $reg; break }
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

$leida = Leer-Version $Dir
$regDir = ''
try { $regDir = (Get-ItemProperty -LiteralPath 'HKCU:\Software\AI Profit' -ErrorAction Stop).InstallDir } catch {}
if (-not $leida -and $regDir) { $leida = Leer-Version $regDir; if ($leida) { $Dir = $regDir } }
Write-Output ("DIR={0}" -f $Dir)
Write-Output ("REGISTRO={0}" -f $regDir)
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
if ($Modo -eq 'clic' -or $Modo -eq 'flujo') {
  if (-not (Test-Path -LiteralPath $wav1)) { throw "Falta $wav1" }
  if (-not (Test-Path -LiteralPath $wav2)) { throw "Falta $wav2" }
}
Write-Output 'RESULTADO=OK'
exit 0
