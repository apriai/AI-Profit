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

; La foto va entera, 496x279 (16:9), en cada pantalla. No se usa el recorte 164x314.
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "¿Seguro que quieres salir? Profito no quedará instalado."
!define MUI_ICON "..\assets\abrir-granja-icon.ico"
!define MUI_UNICON "..\assets\abrir-granja-icon.ico"
!define MUI_TEXT_INSTALLING_TITLE "Instalando tu granja"
!define MUI_TEXT_INSTALLING_SUBTITLE "Espera un momentito. No cierres esta ventana."

Name "Profito ${VERSION}"
OutFile "..\dist\Profito-Setup.exe"
InstallDir "$LOCALAPPDATA\Profito"
InstallDirRegKey HKCU "Software\AI Profit" "InstallDir"
Caption "Instalar Profito"
BrandingText "Profito"
VIProductVersion "${VERNUM}"
VIAddVersionKey "ProductName" "AI Profit"
VIAddVersionKey "FileDescription" "Instalador de AI Profit"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Ai Profit Camp"

Var Dialogo
Var Imagen
Var ImagenHandle
Var CampoCarpeta
Var BmpProgreso

Page custom BienvenidaCrear BienvenidaSalir
Page custom CarpetaCrear CarpetaSalir
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ProgresoMostrar
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE ProgresoSalir
!insertmacro MUI_PAGE_INSTFILES
!undef MUI_PAGE_CUSTOMFUNCTION_SHOW
!undef MUI_PAGE_CUSTOMFUNCTION_LEAVE
Page custom ListoCrear

!insertmacro MUI_LANGUAGE "Spanish"

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
  File "gfx\p3-progreso.bmp"
  File "gfx\p4-listo.bmp"
  ShowInstDetails never
FunctionEnd

Function .onGUIInit
  ; Ventana más alta: la foto 16:9 (496x279) y el texto debajo.
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i 548, i 700, i 0x16)'
FunctionEnd

Function MoverBotones
  GetDlgItem $R0 $HWNDPARENT 1
  System::Call 'user32::SetWindowPos(p $R0, p 0, i 410, i 610, i 110, i 28, i 0x4)'
  GetDlgItem $R0 $HWNDPARENT 3
  System::Call 'user32::SetWindowPos(p $R0, p 0, i 290, i 610, i 110, i 28, i 0x4)'
  GetDlgItem $R0 $HWNDPARENT 2
  System::Call 'user32::SetWindowPos(p $R0, p 0, i 16, i 610, i 110, i 28, i 0x4)'
FunctionEnd

!macro Foto ARCHIVO
  System::Call 'user32::SetWindowPos(p $Dialogo, p 0, i 0, i 0, i 532, i 580, i 0x14)'
  System::Call 'user32::LoadImage(p 0, t "$PLUGINSDIR\${ARCHIVO}", i ${IMAGE_BITMAP}, i 0, i 0, i ${LR_LOADFROMFILE}) p.R2'
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i ${WS_CHILD}|${WS_VISIBLE}|${SS_BITMAP}, i 18, i 8, i 496, i 279, p $Dialogo, p 0, p 0, p 0) p.R3'
  System::Call 'user32::SendMessage(p $R3, i ${STM_SETIMAGE}, i ${IMAGE_BITMAP}, p $R2)'
  StrCpy $ImagenHandle $R2
  Call MoverBotones
!macroend

Function Botones
  Pop $R1
  GetDlgItem $R0 $HWNDPARENT 1
  SendMessage $R0 ${WM_SETTEXT} 0 "STR:$R1"
  GetDlgItem $R0 $HWNDPARENT 3
  SendMessage $R0 ${WM_SETTEXT} 0 "STR:Atrás"
  GetDlgItem $R0 $HWNDPARENT 2
  SendMessage $R0 ${WM_SETTEXT} 0 "STR:Cancelar"
FunctionEnd

Function BienvenidaCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  !insertmacro Foto "p1-bienvenida.bmp"
  CreateFont $R1 "Segoe UI" 12 700
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "Hola. Soy Profito.$\r$\n$\r$\nVoy a poner tu granja en esta computadora.$\r$\nPulsa Siguiente. Es fácil y no pide contraseña.", i ${WS_CHILD}|${WS_VISIBLE}, i 18, i 300, i 496, i 90, p $Dialogo, p 0, p 0, p 0) p.R0'
  SendMessage $R0 ${WM_SETFONT} $R1 0
  Push "Siguiente"
  Call Botones
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}
  nsDialogs::Show
FunctionEnd

Function BienvenidaSalir
  ${If} $ImagenHandle != 0
    System::Call 'gdi32::DeleteObject(p $ImagenHandle)'
  ${EndIf}
FunctionEnd

Function CarpetaCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  !insertmacro Foto "p2-carpeta.bmp"
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "¿Dónde la guardo?$\r$\nLa dejo en tu carpeta. Así está bien.$\r$\nSi quieres otro sitio, pulsa Examinar.", i ${WS_CHILD}|${WS_VISIBLE}, i 18, i 300, i 496, i 70, p $Dialogo, p 0, p 0, p 0) p.R0'
  System::Call 'user32::CreateWindowEx(i 0x200, t "EDIT", t "$INSTDIR", i ${WS_CHILD}|${WS_VISIBLE}|${ES_AUTOHSCROLL}, i 18, i 380, i 370, i 24, p $Dialogo, p 0, p 0, p 0) p.s'
  Pop $CampoCarpeta
  System::Call 'user32::CreateWindowEx(i 0, t "BUTTON", t "Examinar", i ${WS_CHILD}|${WS_VISIBLE}|${WS_TABSTOP}, i 400, i 378, i 114, i 28, p $Dialogo, p 0, p 0, p 0) p.R0'
  ${NSD_OnClick} $R0 ElegirCarpeta
  Push "Siguiente"
  Call Botones
  nsDialogs::Show
FunctionEnd

Function ElegirCarpeta
  System::Call 'user32::SendMessage(p $CampoCarpeta, i ${WM_GETTEXT}, i ${NSIS_MAX_STRLEN}, t.s)'
  Pop $R0
  nsDialogs::SelectFolderDialog "Elige una carpeta" $R0
  Pop $R0
  ${If} $R0 != error
  ${AndIf} $R0 != ""
    System::Call 'user32::SendMessage(p $CampoCarpeta, i ${WM_SETTEXT}, i 0, t R0)'
  ${EndIf}
FunctionEnd

Function CarpetaSalir
  System::Call 'user32::SendMessage(p $CampoCarpeta, i ${WM_GETTEXT}, i ${NSIS_MAX_STRLEN}, t.s)'
  Pop $INSTDIR
  ${If} $ImagenHandle != 0
    System::Call 'gdi32::DeleteObject(p $ImagenHandle)'
  ${EndIf}
  ${If} $INSTDIR == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Elige una carpeta para Profito."
    Abort
  ${EndIf}
FunctionEnd

Function ProgresoMostrar
  FindWindow $R0 "#32770" "" $HWNDPARENT
  GetDlgItem $R1 $R0 1016
  ShowWindow $R1 ${SW_HIDE}
  System::Call 'user32::SetWindowPos(p $R0, p 0, i 0, i 0, i 532, i 560, i 0x14)'
  Call MoverBotones
  System::Call 'user32::LoadImage(p 0, t "$PLUGINSDIR\p3-progreso.bmp", i ${IMAGE_BITMAP}, i 0, i 0, i ${LR_LOADFROMFILE}) p.R2'
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i ${WS_CHILD}|${WS_VISIBLE}|${SS_BITMAP}, i 18, i 8, i 496, i 279, p $R0, p 0, p 0, p 0) p.R3'
  GetDlgItem $R4 $R0 1006
  System::Call 'user32::SetWindowPos(p $R4, p 0, i 18, i 300, i 496, i 36, i 0x4)'
  GetDlgItem $R4 $R0 1004
  System::Call 'user32::SetWindowPos(p $R4, p 0, i 18, i 344, i 496, i 18, i 0x4)'
  System::Call 'user32::SendMessage(p $R3, i ${STM_SETIMAGE}, i ${IMAGE_BITMAP}, p $R2)'
  StrCpy $BmpProgreso $R2
  GetDlgItem $R1 $HWNDPARENT 1
  SendMessage $R1 ${WM_SETTEXT} 0 "STR:Siguiente"
  GetDlgItem $R1 $HWNDPARENT 3
  ShowWindow $R1 ${SW_HIDE}
FunctionEnd

Function ProgresoSalir
  ${If} $BmpProgreso != 0
    System::Call 'gdi32::DeleteObject(p $BmpProgreso)'
  ${EndIf}
FunctionEnd

Function ListoCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  !insertmacro Foto "p4-listo.bmp"
  CreateFont $R1 "Segoe UI" 12 700
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "¡Listo!$\r$\n$\r$\nProfito ya está en tu computadora.$\r$\nEn el escritorio verás AI Profit. Ábrelo con doble clic.", i ${WS_CHILD}|${WS_VISIBLE}, i 18, i 300, i 496, i 100, p $Dialogo, p 0, p 0, p 0) p.R0'
  SendMessage $R0 ${WM_SETFONT} $R1 0
  Push "Cerrar"
  Call Botones
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}
  GetDlgItem $R0 $HWNDPARENT 2
  ShowWindow $R0 ${SW_HIDE}
  nsDialogs::Show
FunctionEnd

Section "Profito" SecMain
  IfFileExists "$INSTDIR\acceso\profito-estado.mjs" 0 sin_previo
  IfFileExists "$INSTDIR\node-win\node.exe" 0 sin_previo
  nsExec::ExecToStack '"$INSTDIR\node-win\node.exe" "$INSTDIR\acceso\profito-estado.mjs" parar "$PLUGINSDIR\parar.ini" "$INSTDIR"'
  Pop $0
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
