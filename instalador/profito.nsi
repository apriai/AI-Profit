; Instalador de AI Profit / Profito.
; Mismo tipo que Profito-Setup.exe 0.10.2: NSIS Unicode, LZMA solida, sin administrador.
; Cada pantalla lleva una imagen de la granja (instalador\gfx).
Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "WinMessages.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef VERNUM
  !define VERNUM "0.0.0.0"
!endif

; La foto es la protagonista: 720x405 (16:9), de borde a borde.
; Debajo, una franja oscura de 72 px con una frase y el botón o la barra.
; No hay pantalla de carpeta: se instala en $LOCALAPPDATA\Profito, sin preguntar.
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "¿Salir?"
!define MUI_ICON "..\assets\abrir-granja-icon.ico"
!define MUI_UNICON "..\assets\abrir-granja-icon.ico"
!define MUI_TEXT_INSTALLING_TITLE "Instalando…"
!define MUI_TEXT_INSTALLING_SUBTITLE " "
!define MUI_CUSTOMFUNCTION_GUIINIT PrepararVentana

Name "Profito ${VERSION}"
OutFile "..\dist\Profito-Setup.exe"
InstallDir "$LOCALAPPDATA\Profito"
InstallDirRegKey HKCU "Software\AI Profit" "InstallDir"
Caption "AI Profit"
BrandingText " "
VIProductVersion "${VERNUM}"
VIAddVersionKey "ProductName" "AI Profit"
VIAddVersionKey "FileDescription" "Instalador de AI Profit"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Ai Profit Camp"

Var Dialogo
Var BmpPagina
Var BmpBoton
Var BrochaNoche

!define CLI_W 720
!define CLI_H 477
!define FOTO_H 405
!define FRANJA 72
!ifndef SS_NOTIFY
  !define SS_NOTIFY 0x00000100
!endif
!ifndef PBM_SETBARCOLOR
  !define PBM_SETBARCOLOR 0x0409
!endif
!ifndef PBM_SETBKCOLOR
  !define PBM_SETBKCOLOR 0x2001
!endif

Page custom BienvenidaCrear BienvenidaSalir
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ProgresoMostrar
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ProgresoSalir
!insertmacro MUI_PAGE_INSTFILES
Page custom ListoCrear ListoSalir

!insertmacro MUI_LANGUAGE "Spanish"
ShowInstDetails nevershow

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Profito necesita Windows 10 u 11, de 64 bits."
    Abort
  ${EndIf}
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuild"
  ${If} $0 < 10240
    MessageBox MB_OK|MB_ICONSTOP "Profito necesita Windows 10 u 11."
    Abort
  ${EndIf}
  InitPluginsDir
  SetOutPath $PLUGINSDIR
  File "gfx\p1-bienvenida.bmp"
  File "gfx\p2-carpeta.bmp"
  File "gfx\p4-listo.bmp"
  File "gfx\btn-instalar.bmp"
  File "gfx\btn-abrir.bmp"
FunctionEnd

Function PrepararVentana
  Call AjustarVentana
  Call PintarNoche
FunctionEnd

Function .onInstSuccess
  ; Al terminar, pasa solo a la pantalla final. El botón Siguiente está oculto.
  GetDlgItem $0 $HWNDPARENT 1
  EnableWindow $0 1
  SendMessage $0 ${BM_CLICK} 0 0
FunctionEnd

; Deja el área útil en 720x477: foto 720x405 y franja de 72.
Function AjustarVentana
  System::Call '*(i 0, i 0, i ${CLI_W}, i ${CLI_H}) p.R0'
  System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i -16) i.R1'
  System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i -20) i.R2'
  System::Call 'user32::AdjustWindowRectEx(p R0, i R1, i 0, i R2)'
  System::Call '*$R0(i.R3, i.R4, i.R5, i.R6)'
  System::Free $R0
  IntOp $R5 $R5 - $R3
  IntOp $R6 $R6 - $R4
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i R5, i R6, i 0x16)'
FunctionEnd

Function PintarNoche
  ${If} $BrochaNoche == 0
    ; COLORREF azul noche #160E30 (azul, verde, rojo).
    System::Call 'gdi32::CreateSolidBrush(i 0x300E16) p.R7'
    StrCpy $BrochaNoche $R7
  ${EndIf}
  System::Call 'user32::SetClassLongW(p $HWNDPARENT, i -10, i $BrochaNoche)'
  System::Call 'user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)'
FunctionEnd

!macro Ocultar ID
  GetDlgItem $R0 $HWNDPARENT ${ID}
  ShowWindow $R0 ${SW_HIDE}
!macroend

Function OcultarCromo
  !insertmacro Ocultar 1
  !insertmacro Ocultar 2
  !insertmacro Ocultar 3
  !insertmacro Ocultar 1028
  !insertmacro Ocultar 1034
  !insertmacro Ocultar 1035
  !insertmacro Ocultar 1036
  !insertmacro Ocultar 1037
  !insertmacro Ocultar 1038
  !insertmacro Ocultar 1039
  !insertmacro Ocultar 1045
  !insertmacro Ocultar 1256
FunctionEnd

Function SoltarImagen
  ${If} $BmpPagina != 0
    System::Call 'gdi32::DeleteObject(p $BmpPagina)'
    StrCpy $BmpPagina 0
  ${EndIf}
  ${If} $BmpBoton != 0
    System::Call 'gdi32::DeleteObject(p $BmpBoton)'
    StrCpy $BmpBoton 0
  ${EndIf}
FunctionEnd

; $Dialogo ya existe. Pone la foto 720x405 de borde a borde.
Function PonerFoto
  Exch $R9
  Call PintarNoche
  Call OcultarCromo
  System::Call 'user32::SetWindowPos(p $Dialogo, p 0, i 0, i 0, i ${CLI_W}, i ${CLI_H}, i 0x10)'
  SetCtlColors $Dialogo 0xF4F1FF 0x160E30
  System::Call 'user32::LoadImage(p 0, t "$PLUGINSDIR\$R9", i ${IMAGE_BITMAP}, i 0, i 0, i ${LR_LOADFROMFILE}) p.R2'
  StrCpy $BmpPagina $R2
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i ${WS_CHILD}|${WS_VISIBLE}|${SS_BITMAP}, i 0, i 0, i ${CLI_W}, i ${FOTO_H}, p $Dialogo, p 0, p 0, p 0) p.R3'
  System::Call 'user32::SendMessage(p $R3, i ${STM_SETIMAGE}, i ${IMAGE_BITMAP}, p $R2)'
  Pop $R9
FunctionEnd

Function PonerFrase
  Exch $R9
  CreateFont $R1 "Segoe UI" 16 700
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "$R9", i ${WS_CHILD}|${WS_VISIBLE}, i 22, i 426, i 210, i 28, p $Dialogo, p 0, p 0, p 0) p.R0'
  SendMessage $R0 ${WM_SETFONT} $R1 1
  SetCtlColors $R0 0xF4F1FF 0x160E30
  Pop $R9
FunctionEnd

Function PonerBoton
  Exch $R9
  System::Call 'user32::LoadImage(p 0, t "$PLUGINSDIR\$R9", i ${IMAGE_BITMAP}, i 0, i 0, i ${LR_LOADFROMFILE}) p.R2'
  StrCpy $BmpBoton $R2
  ; STATIC con aviso de clic: el BMP ya trae la pastilla verde, sin marco del botón de Windows.
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i ${WS_CHILD}|${WS_VISIBLE}|${WS_TABSTOP}|${SS_NOTIFY}|${SS_BITMAP}, i 570, i 420, i 132, i 36, p $Dialogo, p 0, p 0, p 0) p.R8'
  System::Call 'user32::SendMessage(p $R8, i ${STM_SETIMAGE}, i ${IMAGE_BITMAP}, p $R2)'
  Pop $R9
FunctionEnd

Function PulsarSiguiente
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${BM_CLICK} 0 0
FunctionEnd

Function PulsarAbrir
  ExecShell "open" "$INSTDIR\acceso\AI Profit.cmd"
  Quit
FunctionEnd

Function BienvenidaCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  Push "p1-bienvenida.bmp"
  Call PonerFoto
  Push "Instalar AI Profit"
  Call PonerFrase
  Push "btn-instalar.bmp"
  Call PonerBoton
  ${NSD_OnClick} $R8 PulsarSiguiente
  nsDialogs::Show
FunctionEnd

Function BienvenidaSalir
  Call SoltarImagen
FunctionEnd

Function ProgresoMostrar
  FindWindow $Dialogo "#32770" "" $HWNDPARENT
  GetDlgItem $R1 $Dialogo 1006
  ShowWindow $R1 ${SW_HIDE}
  GetDlgItem $R1 $Dialogo 1016
  ShowWindow $R1 ${SW_HIDE}
  GetDlgItem $R1 $Dialogo 1027
  ShowWindow $R1 ${SW_HIDE}
  Push "p2-carpeta.bmp"
  Call PonerFoto
  Push "Instalando…"
  Call PonerFrase
  GetDlgItem $R4 $Dialogo 1004
  System::Call 'uxtheme::SetWindowTheme(p $R4, p 0, p 0)'
  ; Barra verde #7CDB3D sobre el carril #2A1848. COLORREF es 0x00BBGGRR.
  SendMessage $R4 ${PBM_SETBARCOLOR} 0 0x3DDB7C
  SendMessage $R4 ${PBM_SETBKCOLOR} 0 0x48182A
  System::Call 'user32::SetWindowPos(p $R4, p 0, i 240, i 429, i 456, i 18, i 0x10)'
FunctionEnd

Function ProgresoSalir
  Call SoltarImagen
FunctionEnd

Function ListoCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  Push "p4-listo.bmp"
  Call PonerFoto
  Push "¡Listo!"
  Call PonerFrase
  Push "btn-abrir.bmp"
  Call PonerBoton
  ${NSD_OnClick} $R8 PulsarAbrir
  nsDialogs::Show
FunctionEnd

Function ListoSalir
  Call SoltarImagen
FunctionEnd

Section "Profito" SecMain
  IfFileExists "$INSTDIR\acceso\profito-estado.mjs" 0 sin_previo
  IfFileExists "$INSTDIR\node-win\node.exe" 0 sin_previo
  nsExec::ExecToStack '"$INSTDIR\node-win\node.exe" "$INSTDIR\acceso\profito-estado.mjs" parar "$PLUGINSDIR\parar.ini" "$INSTDIR"'
  Pop $0
  Pop $2
  ${If} $0 == 30
    MessageBox MB_OK|MB_ICONSTOP "Hay un trade abierto, o no pude comprobarlo. Espera a que termine y vuelve a abrir el instalador."
    Abort
  ${EndIf}
  ReadINIStr $1 "$PLUGINSDIR\parar.ini" "estado" "motivo"
  ${If} $1 == "operacion"
    MessageBox MB_OK|MB_ICONSTOP "Hay un trade abierto. Espera a que termine y vuelve a abrir el instalador."
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
  CreateDirectory "$SMPROGRAMS\Profito"
  CreateShortcut "$DESKTOP\AI Profit.lnk" "$INSTDIR\acceso\AI Profit.cmd" "" "$INSTDIR\assets\abrir-granja-icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Profito\AI Profit.lnk" "$INSTDIR\acceso\AI Profit.cmd" "" "$INSTDIR\assets\abrir-granja-icon.ico" 0
  CreateShortcut "$SMPROGRAMS\Profito\Quitar Profito.lnk" "$INSTDIR\Desinstalar AI Profit.exe"
  CreateShortcut "$SMPROGRAMS\Profito\Carpeta de datos.lnk" "$INSTDIR\datos"

  WriteRegStr HKCU "Software\AI Profit" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "DisplayName" "Profito ${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "Publisher" "Ai Profit Camp"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "UninstallString" "$\"$INSTDIR\Desinstalar AI Profit.exe$\""
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AIProfit" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\AI Profit.lnk"
  Delete "$SMPROGRAMS\Profito\AI Profit.lnk"
  Delete "$SMPROGRAMS\Profito\Quitar Profito.lnk"
  Delete "$SMPROGRAMS\Profito\Carpeta de datos.lnk"
  RMDir "$SMPROGRAMS\Profito"
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
