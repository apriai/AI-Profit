; Instalador de AI Profit / Profito.
; El Profito-Setup.exe de 0.10.2 era NSIS Unicode con LZMA solida.
; Este script reconstruye un instalador por usuario, sin la interfaz ilustrada
; (los bmp del asistente no estan en el repositorio) y sin AI Profit.exe
; (ese lanzador tampoco tiene fuente: el acceso queda en acceso\AI Profit.cmd).
Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef VERNUM
  !define VERNUM "0.0.0.0"
!endif

Name "AI Profit ${VERSION}"
OutFile "..\dist\Profito-Setup.exe"
InstallDir "$LOCALAPPDATA\Profito"
InstallDirRegKey HKCU "Software\AI Profit" "InstallDir"
Caption "Instalar AI Profit ${VERSION}"
VIProductVersion "${VERNUM}"
VIAddVersionKey "ProductName" "AI Profit"
VIAddVersionKey "FileDescription" "Instalador de AI Profit"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Ai Profit Camp"

!define MUI_ABORTWARNING
!define MUI_ICON "..\assets\abrir-granja-icon.ico"
!define MUI_UNICON "..\assets\abrir-granja-icon.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "AI Profit necesita Windows de 64 bits."
    Abort
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuild"
  ; Windows 10 empieza en el build 10240.
  ${If} $0 < 10240
    MessageBox MB_OK|MB_ICONSTOP "AI Profit necesita Windows 10 u 11."
    Abort
  ${EndIf}
FunctionEnd

Section "AI Profit" SecMain
  IfFileExists "$INSTDIR\acceso\profito-estado.mjs" 0 sin_previo
  IfFileExists "$INSTDIR\node-win\node.exe" 0 sin_previo
  nsExec::ExecToStack '"$INSTDIR\node-win\node.exe" "$INSTDIR\acceso\profito-estado.mjs" parar "$PLUGINSDIR\parar.ini" "$INSTDIR"'
  Pop $0
  ReadINIStr $1 "$PLUGINSDIR\parar.ini" "estado" "motivo"
  ${If} $1 == "operacion"
    MessageBox MB_OK|MB_ICONSTOP "Hay una operacion en curso. Espera a que termine y vuelve a abrir el instalador."
    Abort
  ${EndIf}
  sin_previo:

  SetOutPath "$INSTDIR"
  File /r "stage\app\*.*"

  FileOpen $2 "$INSTDIR\profito-instalador.json" w
  FileWrite $2 '{"instalador":"Profito-Setup","producto":"${VERSION}"}$\r$\n'
  FileClose $2

  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Desinstalar AI Profit.exe"
  CreateDirectory "$SMPROGRAMS\AI Profit"
  CreateShortcut "$DESKTOP\AI Profit.lnk" "$INSTDIR\acceso\AI Profit.cmd" "" "$INSTDIR\assets\abrir-granja-icon.ico" 0
  CreateShortcut "$SMPROGRAMS\AI Profit\AI Profit.lnk" "$INSTDIR\acceso\AI Profit.cmd" "" "$INSTDIR\assets\abrir-granja-icon.ico" 0
  CreateShortcut "$SMPROGRAMS\AI Profit\Desinstalar AI Profit.lnk" "$INSTDIR\Desinstalar AI Profit.exe"
  CreateShortcut "$SMPROGRAMS\AI Profit\Carpeta de datos.lnk" "$INSTDIR\datos"

  WriteRegStr HKCU "Software\AI Profit" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "DisplayName" "AI Profit ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "Publisher" "Ai Profit Camp"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "UninstallString" "$\"$INSTDIR\Desinstalar AI Profit.exe$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\AI Profit.lnk"
  Delete "$SMPROGRAMS\AI Profit\AI Profit.lnk"
  Delete "$SMPROGRAMS\AI Profit\Desinstalar AI Profit.lnk"
  Delete "$SMPROGRAMS\AI Profit\Carpeta de datos.lnk"
  RMDir "$SMPROGRAMS\AI Profit"
  RMDir /r "$INSTDIR\motor"
  RMDir /r "$INSTDIR\acceso"
  RMDir /r "$INSTDIR\assets"
  RMDir /r "$INSTDIR\tradingview-mcp"
  RMDir /r "$INSTDIR\node-win"
  Delete "$INSTDIR\VERSION"
  Delete "$INSTDIR\LEEME.md"
  Delete "$INSTDIR\CHANGELOG.md"
  Delete "$INSTDIR\profito-instalador.json"
  Delete "$INSTDIR\Desinstalar AI Profit.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit"
  DeleteRegKey HKCU "Software\AI Profit"
SectionEnd
