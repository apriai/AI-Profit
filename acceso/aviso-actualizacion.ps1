# Ventana del aviso de actualización. Escribe si, no, o nada.
param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Profito'
$form.FormBorderStyle = 'FixedDialog'
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(440, 130)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 11)
$label = New-Object System.Windows.Forms.Label
$label.Text = "Hay una versión nueva de Profito ($Version). ¿Actualizar ahora?"
$label.Location = New-Object System.Drawing.Point(16, 16)
$label.Size = New-Object System.Drawing.Size(408, 48)
$si = New-Object System.Windows.Forms.Button
$si.Text = 'Sí'
$si.DialogResult = [System.Windows.Forms.DialogResult]::Yes
$si.Location = New-Object System.Drawing.Point(228, 80)
$si.Size = New-Object System.Drawing.Size(90, 32)
$no = New-Object System.Windows.Forms.Button
$no.Text = 'No'
$no.DialogResult = [System.Windows.Forms.DialogResult]::No
$no.Location = New-Object System.Drawing.Point(328, 80)
$no.Size = New-Object System.Drawing.Size(90, 32)
$form.Controls.AddRange(@($label, $si, $no))
$form.AcceptButton = $si
$form.CancelButton = $no
$r = $form.ShowDialog()
if ($r -eq [System.Windows.Forms.DialogResult]::Yes) { Write-Output 'si' }
elseif ($r -eq [System.Windows.Forms.DialogResult]::No) { Write-Output 'no' }
else { Write-Output 'nada' }
