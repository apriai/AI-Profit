' Abre TradingView conectado, sin consola.
Set fso = CreateObject("Scripting.FileSystemObject")
aqui = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = aqui & "\abrir-tradingview.ps1"
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """ -Port 9222"
CreateObject("WScript.Shell").Run cmd, 0, False
