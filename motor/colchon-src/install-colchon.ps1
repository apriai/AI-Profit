# Instala "Prueba colchón" en TradingLink (HERO). No abre ningún trade. Ejecutar en PowerShell:
#   powershell -ExecutionPolicy Bypass -File install-colchon.ps1 -Src <carpeta con colchon.mjs, colchon-ui.html, server-routes.js, probe.mjs>
param([string]$Src = $PSScriptRoot, [string]$Dst = "C:\Users\USUARIO\OneDrive\Escritorio\TradingLink")
$ErrorActionPreference = 'Stop'; Set-Location $Dst; $u = New-Object Text.UTF8Encoding($false); $ts = Get-Date -f yyyyMMdd-HHmmss
foreach ($f in 'tradinglink.mjs','orders.mjs','Granja-de-Cuentas-v2.html') { Copy-Item $f "backups\$($f -replace '\.(\w+)$',".$ts.`$1")" }
if (Test-Path colchon.mjs) { Copy-Item colchon.mjs "backups\colchon.$ts.mjs" }
Copy-Item "$Src\colchon.mjs","$Src\probe.mjs" $Dst -Force
# 1) servidor
$t = [IO.File]::ReadAllText("$Dst\tradinglink.mjs")
if ($t -notmatch "from './colchon.mjs'") {
  $t = $t.Replace("import * as orders from './orders.mjs';", "import * as orders from './orders.mjs';`nimport { colchon, CFG as colchonCFG } from './colchon.mjs';")
  $anchor = "  if (q.method === 'POST' || q.url === '/bot')"; if ($t.IndexOf($anchor) -lt 0) { throw "ancla de rutas no encontrada en tradinglink.mjs" }
  $t = $t.Replace($anchor, [IO.File]::ReadAllText("$Src\server-routes.js").TrimEnd() + "`n" + $anchor)
  [IO.File]::WriteAllText("$Dst\tradinglink.mjs", $t, $u) }
# 2) granja
$h = [IO.File]::ReadAllText("$Dst\Granja-de-Cuentas-v2.html")
$h = [regex]::Replace($h, '(?s)<script>/\*[^\n]*Modo prueba \+ Prueba colch.*?</script>', '')   # quita la UI vieja si existiera
if ($h -notmatch 'It,Lt\};window\.__granja') { if ($h.Contains('It};window.__granja')) { $h = $h.Replace('It};window.__granja', 'It,Lt};window.__granja') } else { Write-Warning 'No encontré window.__gx: la burbuja irá centrada' } }
if ($h -notmatch 'Prueba colch\S+n: bot\S+n "Prueba"') { $ui = [IO.File]::ReadAllText("$Src\colchon-ui.html").Trim(); $k = $h.LastIndexOf('</body>'); if ($k -lt 0) { $h += $ui } else { $h = $h.Substring(0,$k) + $ui + $h.Substring($k) } }
[IO.File]::WriteAllText("$Dst\Granja-de-Cuentas-v2.html", $h, $u)
# 3) verificación
& .\node-win\node.exe --check colchon.mjs; & .\node-win\node.exe --check tradinglink.mjs; & .\node-win\node.exe colchon.mjs --selftest
Select-String orders.mjs -Pattern 'DRY_RUN = true' | % { "orders.mjs: $($_.Line.Trim())" }
# 4) reiniciar servidor (oculto). No toca TradingView ni abre trades.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -match 'tradinglink' } | % { Stop-Process -Id $_.ProcessId -Force }; Start-Sleep 2
Start-Process cmd -ArgumentList "/c `"`"$Dst\node-win\node.exe`" tradinglink.mjs >> tradinglink.log 2>&1`"" -WorkingDirectory $Dst -WindowStyle Hidden; Start-Sleep 15
"pagina: " + (Invoke-WebRequest http://localhost:8787/ -UseBasicParsing).StatusCode
"check (solo lectura): " + (Invoke-WebRequest http://localhost:8787/api/colchon/check -UseBasicParsing).Content
"Sonda de la API (solo lectura): node-win\node.exe probe.mjs"
