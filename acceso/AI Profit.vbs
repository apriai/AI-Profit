' Bandeja de Profito. wscript no abre consola.
Set fso = CreateObject("Scripting.FileSystemObject")
aqui = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = aqui & "\profito-bandeja.ps1"
cmd = "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
CreateObject("WScript.Shell").Run cmd, 0, False
