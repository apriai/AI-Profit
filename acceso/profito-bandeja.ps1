# Bandeja de Profito y pantalla de carga. Sin consola.
# No envia ordenes. Cerrar Profito no cierra TradingView ni las ordenes del broker.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $aqui
$script:aqui = $aqui
$script:root = $root
. (Join-Path $aqui 'abrir-granja.ps1')

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class ProfitoWin {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  public static IntPtr Buscar(string texto) {
    IntPtr hallada = IntPtr.Zero;
    EnumWindows((h, l) => {
      if (!IsWindowVisible(h)) return true;
      var sb = new StringBuilder(512);
      GetWindowText(h, sb, sb.Capacity);
      if (sb.ToString().IndexOf(texto, StringComparison.OrdinalIgnoreCase) >= 0) { hallada = h; return false; }
      return true;
    }, IntPtr.Zero);
    return hallada;
  }
}
public static class ProfitoJob {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string name);
  [DllImport("kernel32.dll")]
  public static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpJobObjectInfo, uint cb);
  [DllImport("kernel32.dll")]
  public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")]
  public static extern bool CloseHandle(IntPtr h);
  public static IntPtr Crear() {
    IntPtr handle = CreateJobObject(IntPtr.Zero, null);
    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
    info.BasicLimitInformation.LimitFlags = 0x2000;
    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
    IntPtr ptr = Marshal.AllocHGlobal(length);
    Marshal.StructureToPtr(info, ptr, false);
    SetInformationJobObject(handle, 9, ptr, (uint)length);
    Marshal.FreeHGlobal(ptr);
    return handle;
  }
}
[StructLayout(LayoutKind.Sequential)]
public struct IO_COUNTERS {
  public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
  public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
}
[StructLayout(LayoutKind.Sequential)]
public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
  public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
  public uint LimitFlags;
  public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
  public uint ActiveProcessLimit;
  public long Affinity;
  public uint PriorityClass, SchedulingClass;
}
[StructLayout(LayoutKind.Sequential)]
public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
  public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
  public IO_COUNTERS IoInfo;
  public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
}
'@

function Carpeta-Logs {
  $base = $env:LOCALAPPDATA
  if (-not $base) { $base = Join-Path $env:USERPROFILE 'AppData\Local' }
  $dir = Join-Path $base 'Profito\datos\logs'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

function Add-Log([string]$linea) {
  $f = Join-Path (Carpeta-Logs) 'lanzador.log'
  if ((Test-Path -LiteralPath $f) -and ((Get-Item -LiteralPath $f).Length -ge 1MB)) {
    $ultimo = "$f.5"
    if (Test-Path -LiteralPath $ultimo) { Remove-Item -LiteralPath $ultimo -Force }
    for ($i = 4; $i -ge 1; $i--) {
      $desde = "$f.$i"
      if (Test-Path -LiteralPath $desde) { Move-Item -LiteralPath $desde -Destination ("$f." + ($i + 1)) -Force }
    }
    Move-Item -LiteralPath $f -Destination "$f.1" -Force
  }
  Add-Content -LiteralPath $f -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $linea) -Encoding UTF8
}

function Buscar-Granja {
  $h = [ProfitoWin]::Buscar('Prop Farm')
  if ($h -eq [IntPtr]::Zero) { $h = [ProfitoWin]::Buscar('8787') }
  return $h
}

function Enfocar-Granja {
  $h = Buscar-Granja
  if ($h -ne [IntPtr]::Zero) {
    [ProfitoWin]::ShowWindow($h, 9) | Out-Null
    [ProfitoWin]::SetForegroundWindow($h) | Out-Null
    return
  }
  Abrir-Granja $script:root
}

function Start-Oculto([string]$exe, [string]$argumentos, [string]$workdir, [switch]$Capturar) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $exe
  $psi.Arguments = $argumentos
  if ($workdir) { $psi.WorkingDirectory = $workdir }
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  if ($Capturar) {
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
  }
  return [System.Diagnostics.Process]::Start($psi)
}

function Invoke-NodeTexto([string]$argumentos) {
  $node = Get-NodeProfito $root
  if (-not $node) { return 'No encuentro Node.' }
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $node
  $psi.Arguments = $argumentos
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
  $p = [System.Diagnostics.Process]::Start($psi)
  $out = $p.StandardOutput.ReadToEnd()
  $p.WaitForExit()
  return $out
}

$creado = $false
$mutex = New-Object System.Threading.Mutex($false, 'Local\ProfitoBandeja', [ref]$creado)
if (-not $creado) {
  Enfocar-Granja
  exit 0
}

$script:inicio = Get-Date
$script:paso = 'Encendiendo servidor…'
try {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Join-Path (Carpeta-Logs) 'carga.txt'), $script:paso, $utf8)
} catch {}
$script:servidor = $null
$script:arranque = $null
$script:job = [IntPtr]::Zero

$ico = Join-Path $root 'assets\profito.ico'
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Cargando Profito…'
$form.FormBorderStyle = 'FixedDialog'
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(720, 460)
$form.BackColor = [System.Drawing.Color]::FromArgb(22, 14, 48)
if (Test-Path -LiteralPath $ico) { $form.Icon = New-Object System.Drawing.Icon($ico) }

$titulo = New-Object System.Windows.Forms.Label
$titulo.Text = 'Cargando Profito…'
$titulo.ForeColor = [System.Drawing.Color]::FromArgb(244, 241, 255)
$titulo.Font = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$titulo.Location = New-Object System.Drawing.Point(16, 8)
$titulo.AutoSize = $true
$form.Controls.Add($titulo)

$foto = New-Object System.Windows.Forms.PictureBox
$foto.SizeMode = 'Zoom'
$foto.Location = New-Object System.Drawing.Point(0, 40)
$foto.Size = New-Object System.Drawing.Size(720, 360)
$foto.BackColor = [System.Drawing.Color]::FromArgb(22, 14, 48)
$form.Controls.Add($foto)

$logo = New-Object System.Windows.Forms.PictureBox
$logo.SizeMode = 'Zoom'
$logo.Size = New-Object System.Drawing.Size(48, 48)
$logo.Location = New-Object System.Drawing.Point(656, 404)
$logo.BackColor = [System.Drawing.Color]::FromArgb(22, 14, 48)
$form.Controls.Add($logo)
$logoPath = Join-Path $root 'assets\propfarm-logo.png'
if (Test-Path -LiteralPath $logoPath) { $logo.Image = [System.Drawing.Image]::FromFile($logoPath) }

$estadoLbl = New-Object System.Windows.Forms.Label
$estadoLbl.Text = 'Encendiendo servidor…'
$estadoLbl.ForeColor = [System.Drawing.Color]::FromArgb(244, 241, 255)
$estadoLbl.Font = New-Object System.Drawing.Font('Segoe UI', 11)
$estadoLbl.Location = New-Object System.Drawing.Point(16, 408)
$estadoLbl.Size = New-Object System.Drawing.Size(630, 44)
$form.Controls.Add($estadoLbl)

# Otro orden que el instalador (1, 2, 4). Aqui: 3, 1, 4, 2.
$script:fotos = @(
  '3-granja-cerca.jpg',
  '1-escenario.jpg',
  '4-isla-granja.jpg',
  '2-multitud-islas.jpg'
)
$script:imagenes = New-Object System.Collections.Generic.List[System.Drawing.Image]
foreach ($nombre in $script:fotos) {
  $p = Join-Path $root "assets\carga\$nombre"
  if (-not (Test-Path -LiteralPath $p)) { $p = Join-Path $root "instalador\gfx\$nombre" }
  if (Test-Path -LiteralPath $p) { $script:imagenes.Add([System.Drawing.Image]::FromFile($p)) }
}
$script:fotoIdx = 0
if ($script:imagenes.Count -gt 0) { $foto.Image = $script:imagenes[0] }

$script:foto = $foto
$script:estadoLbl = $estadoLbl
$script:form = $form
$script:rotar = New-Object System.Windows.Forms.Timer
$script:rotar.Interval = 2800
$script:rotar.Add_Tick({
  if ($script:imagenes.Count -lt 2) { return }
  $script:fotoIdx = ($script:fotoIdx + 1) % $script:imagenes.Count
  $script:foto.Image = $script:imagenes[$script:fotoIdx]
})
$script:rotar.Start()

$script:vigilar = New-Object System.Windows.Forms.Timer
$script:vigilar.Interval = 400
$script:vigilar.Add_Tick({
  $ms = ((Get-Date) - $script:inicio).TotalMilliseconds
  $archivo = Join-Path (Carpeta-Logs) 'carga.txt'
  $linea = $script:paso
  if (Test-Path -LiteralPath $archivo) {
    try { $linea = (Get-Content -LiteralPath $archivo -Raw).Trim().TrimStart([char]0xFEFF) } catch {}
  }
  if ($linea -and $linea -ne 'LISTO') { $script:paso = $linea }
  if ($linea -eq 'LISTO' -or (Buscar-Granja) -ne [IntPtr]::Zero) {
    $script:rotar.Stop()
    $script:vigilar.Stop()
    $script:form.TopMost = $false
    $script:form.Close()
    return
  }
  if ($ms -ge 60000) {
    $script:estadoLbl.Text = "Sigue pendiente: $($script:paso) La granja se abrirá sola cuando termine."
  } elseif ($script:paso) {
    $script:estadoLbl.Text = $script:paso
  }
})
$script:vigilar.Start()

$node = Get-NodeProfito $root
if ($node) {
  try {
      $bandejaMjs = Join-Path $aqui 'profito-bandeja.mjs'
      $ya = $false
      try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 'http://127.0.0.1:8787/'
        if ($r.StatusCode -ge 200) { $ya = $true }
      } catch { $ya = $false }
      if (-not $ya) {
        $script:job = [ProfitoJob]::Crear()
        $script:servidor = Start-Oculto $node "`"$bandejaMjs`" servir `"$root`"" $root
        if ($script:servidor) {
          [ProfitoJob]::AssignProcessToJobObject($script:job, $script:servidor.Handle) | Out-Null
        }
      }
  } catch { Add-Log $_.Exception.Message }
} else {
  Add-Log 'Falta Node en node-win.'
  $estadoLbl.Text = 'Sigue pendiente: Encendiendo servidor… No encuentro Node.'
}

$arranquePs1 = Join-Path $aqui 'profito-arranque.ps1'
$script:arranque = Start-Oculto 'powershell.exe' "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$arranquePs1`" -Root `"$root`"" $root

$notify = New-Object System.Windows.Forms.NotifyIcon
if (Test-Path -LiteralPath $ico) {
  $tam = [System.Windows.Forms.SystemInformation]::SmallIconSize
  try { $notify.Icon = New-Object System.Drawing.Icon($ico, [int]$tam.Width, [int]$tam.Height) }
  catch { $notify.Icon = New-Object System.Drawing.Icon($ico) }
} else { $notify.Icon = [System.Drawing.SystemIcons]::Application }
$notify.Text = 'AI Profit'
$notify.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$itemAbrir = $menu.Items.Add('Abrir granja')
$itemEstado = $menu.Items.Add('Estado')
$itemLogs = $menu.Items.Add('Ver logs')
$itemCerrar = $menu.Items.Add('Cerrar Profito')
$script:notify = $notify
$itemAbrir.Add_Click({ Enfocar-Granja })
$itemEstado.Add_Click({
  $mjs = Join-Path $script:aqui 'profito-bandeja.mjs'
  $txt = Invoke-NodeTexto "`"$mjs`" estado"
  [System.Windows.Forms.MessageBox]::Show($txt, 'AI Profit') | Out-Null
})
$itemLogs.Add_Click({
  $dir = Carpeta-Logs
  Start-Process explorer.exe $dir
})
$itemCerrar.Add_Click({
  Add-Log 'Cerrar Profito. TradingView y las ordenes siguen.'
  $mjs = Join-Path $script:aqui 'profito-bandeja.mjs'
  try { Invoke-NodeTexto "`"$mjs`" cerrar --root `"$script:root`"" | Out-Null } catch {}
  if ($script:arranque -and -not $script:arranque.HasExited) {
    try { Stop-Process -Id $script:arranque.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  if ($script:job -ne [IntPtr]::Zero) { [ProfitoJob]::CloseHandle($script:job) | Out-Null }
  $script:notify.Visible = $false
  $script:form.Close()
  [System.Windows.Forms.Application]::ExitThread()
})
$notify.ContextMenuStrip = $menu
$notify.Add_Click({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Enfocar-Granja }
})

$form.Add_Shown({ $form.Activate() })
$form.Show()
[System.Windows.Forms.Application]::Run()
