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

!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "gfx\mui-cabecera.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "gfx\mui-bienvenida.bmp"
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
  File "gfx\mui-bienvenida.bmp"
  File "gfx\mui-cabecera.bmp"
  File "gfx\p1-bienvenida.bmp"
  File "gfx\p2-carpeta.bmp"
  File "gfx\p3-progreso.bmp"
  File "gfx\p4-listo.bmp"
  ShowInstDetails never
FunctionEnd

!macro Foto ARCHIVO
  ${NSD_CreateBitmap} 0 0 100% 78u
  Pop $Imagen
  ${NSD_SetImage} $Imagen "$PLUGINSDIR\${ARCHIVO}" $ImagenHandle
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
  ${NSD_CreateLabel} 12u 84u 90% 48u "Hola. Soy Profito.$\r$\n$\r$\nVoy a poner tu granja en esta computadora.$\r$\nPulsa Siguiente. Es fácil y no pide contraseña."
  Pop $R0
  CreateFont $R1 "Segoe UI" 11 700
  SendMessage $R0 ${WM_SETFONT} $R1 0
  Push "Siguiente"
  Call Botones
  GetDlgItem $R0 $HWNDPARENT 3
  ShowWindow $R0 ${SW_HIDE}
  nsDialogs::Show
FunctionEnd

Function BienvenidaSalir
  ${NSD_FreeImage} $ImagenHandle
FunctionEnd

Function CarpetaCrear
  nsDialogs::Create 1018
  Pop $Dialogo
  !insertmacro Foto "p2-carpeta.bmp"
  ${NSD_CreateLabel} 12u 82u 90% 28u "¿Dónde la guardo?$\r$\nLa dejo en tu carpeta. Así está bien. Si quieres otro sitio, pulsa Examinar."
  Pop $R0
  ${NSD_CreateDirRequest} 12u 114u 230u 14u "$INSTDIR"
  Pop $CampoCarpeta
  ${NSD_CreateBrowseButton} 248u 114u 40u 14u "Examinar"
  Pop $R0
  ${NSD_OnClick} $R0 ElegirCarpeta
  Push "Siguiente"
  Call Botones
  nsDialogs::Show
FunctionEnd

Function ElegirCarpeta
  ${NSD_GetText} $CampoCarpeta $R0
  nsDialogs::SelectFolderDialog "Elige una carpeta" $R0
  Pop $R0
  ${If} $R0 != error
  ${AndIf} $R0 != ""
    ${NSD_SetText} $CampoCarpeta $R0
  ${EndIf}
FunctionEnd

Function CarpetaSalir
  ${NSD_GetText} $CampoCarpeta $INSTDIR
  ${NSD_FreeImage} $ImagenHandle
  ${If} $INSTDIR == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Elige una carpeta para Profito."
    Abort
  ${EndIf}
FunctionEnd

Function ProgresoMostrar
  FindWindow $R0 "#32770" "" $HWNDPARENT
  GetDlgItem $R1 $R0 1016
  ShowWindow $R1 ${SW_HIDE}
  System::Call 'user32::LoadImage(p 0, t "$PLUGINSDIR\p3-progreso.bmp", i ${IMAGE_BITMAP}, i 470, i 120, i ${LR_LOADFROMFILE}) p.R2'
  System::Call 'user32::CreateWindowEx(i 0, t "STATIC", t "", i ${WS_CHILD}|${WS_VISIBLE}|${SS_BITMAP}, i 8, i 36, i 470, i 120, p $R0, p 0, p 0, p 0) p.R3'
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
  ${NSD_CreateLabel} 12u 84u 90% 48u "¡Listo!$\r$\n$\r$\nProfito ya está en tu computadora.$\r$\nEn el escritorio verás AI Profit. Ábrelo con doble clic."
  Pop $R0
  CreateFont $R1 "Segoe UI" 12 700
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
