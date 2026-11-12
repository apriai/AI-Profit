# Crea o actualiza el acceso directo de Escritorio "AI Profit".
# Icono: assets\abrir-granja-icon.png -> assets\abrir-granja-icon.ico
# No abre TradingView y no envia ordenes.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $root 'acceso\Abrir Granja.bat'
if (-not (Test-Path -LiteralPath (Join-Path $root 'motor\tradinglink.mjs'))) {
  throw "No encuentro motor\tradinglink.mjs en $root"
}
if (-not (Test-Path -LiteralPath $bat)) {
  throw "Falta acceso\Abrir Granja.bat en $root"
}

function Convert-PngToIco([string]$PngPath, [string]$IcoPath) {
  Add-Type -AssemblyName System.Drawing
  $bytes = [System.IO.File]::ReadAllBytes($PngPath)
  $pngStream = [System.IO.MemoryStream]::new($bytes)
  $src = $null
  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $images = New-Object System.Collections.Generic.List[byte[]]
  try {
    $src = [System.Drawing.Image]::FromStream($pngStream)
    foreach ($size in $sizes) {
      $bmp = [System.Drawing.Bitmap]::new([int]$size, [int]$size)
      try {
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        try {
          $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $g.Clear([System.Drawing.Color]::Transparent)
          $g.DrawImage($src, 0, 0, [int]$size, [int]$size)
        } finally {
          $g.Dispose()
        }
        $ms = New-Object System.IO.MemoryStream
        try {
          $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
          $images.Add($ms.ToArray())
        } finally {
          $ms.Dispose()
        }
      } finally {
        $bmp.Dispose()
      }
    }
  } finally {
    if ($src) { $src.Dispose() }
    $pngStream.Dispose()
  }

  $dir = Split-Path -Parent $IcoPath
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
  $fs = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
  try {
    $fs.Write([BitConverter]::GetBytes([uint16]0), 0, 2)
    $fs.Write([BitConverter]::GetBytes([uint16]1), 0, 2)
    $fs.Write([BitConverter]::GetBytes([uint16]$images.Count), 0, 2)
    $offset = 6 + (16 * $images.Count)
    for ($i = 0; $i -lt $images.Count; $i++) {
      $size = [int]$sizes[$i]
      $dim = [byte]0
      if ($size -lt 256) { $dim = [byte]$size }
      $fs.WriteByte($dim)
      $fs.WriteByte($dim)
      $fs.WriteByte(0)
      $fs.WriteByte(0)
      $fs.Write([BitConverter]::GetBytes([uint16]1), 0, 2)
      $fs.Write([BitConverter]::GetBytes([uint16]32), 0, 2)
      $fs.Write([BitConverter]::GetBytes([uint32]$images[$i].Length), 0, 4)
      $fs.Write([BitConverter]::GetBytes([uint32]$offset), 0, 4)
      $offset += $images[$i].Length
    }
    foreach ($img in $images) {
      $fs.Write($img, 0, $img.Length)
    }
  } finally {
    $fs.Dispose()
  }
}

$png = $null
foreach ($candidate in @(
  (Join-Path $root 'assets\abrir-granja-icon.png'),
  (Join-Path $root 'assets\ai-profit-icon.png'),
  (Join-Path $root 'assets\propfarm-logo.png')
)) {
  if (Test-Path -LiteralPath $candidate) { $png = $candidate; break }
}

$ico = Join-Path $root 'assets\abrir-granja-icon.ico'
$iconNote = ''
if ($png) {
  try {
    Convert-PngToIco $png $ico
    $iconNote = "Icono actualizado desde $png"
  } catch {
    if (Test-Path -LiteralPath $ico) {
      $iconNote = "No pude regenerar el .ico ($($_.Exception.Message)). Uso el que ya esta en el repositorio."
    } else {
      $iconNote = "No pude crear el .ico ($($_.Exception.Message)). El acceso quedara con el icono por defecto de Windows."
    }
  }
} elseif (Test-Path -LiteralPath $ico) {
  $iconNote = 'Uso el .ico que ya viene en el repositorio.'
} else {
  $iconNote = 'No hay PNG ni ICO. El acceso quedara sin icono propio.'
}

$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) {
  throw 'No encuentro la carpeta Escritorio.'
}
$lnkPath = Join-Path $desktop 'AI Profit.lnk'
$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut($lnkPath)
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = $root
$lnk.WindowStyle = 1
$lnk.Description = 'Abre TradingView, TradingLink y la Granja de AI Profit. No envia ordenes.'
if (Test-Path -LiteralPath $ico) {
  $lnk.IconLocation = "$ico,0"
}
$lnk.Save()

Write-Host ''
Write-Host 'Listo. En el Escritorio quedo el acceso AI Profit.'
Write-Host 'Un doble clic abre TradingView conectado, el servidor y la Granja.'
Write-Host 'No envia ordenes.'
Write-Host "Carpeta: $root"
if ($iconNote) { Write-Host $iconNote }
Write-Host 'Si mueves la carpeta de TradingLink, vuelve a ejecutar este instalador.'
Write-Host 'Para cambiar el dibujo, sustituye assets\abrir-granja-icon.png y ejecutalo otra vez.'
