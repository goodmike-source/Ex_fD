Unicode true
!include "MUI2.nsh"
Name "Tarkov Atlas"
OutFile "TarkovAtlas-0.1.0-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Tarkov Atlas"
RequestExecutionLevel user
ShowInstDetails show
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\TarkovAtlas.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Запустить Tarkov Atlas"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

Section "Tarkov Atlas" SecMain
  SetOutPath "$INSTDIR"
  File /r "dist\TarkovAtlas\*"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Tarkov Atlas"
  CreateShortCut "$SMPROGRAMS\Tarkov Atlas\Tarkov Atlas.lnk" "$INSTDIR\TarkovAtlas.exe"
  CreateShortCut "$SMPROGRAMS\Tarkov Atlas\Удалить Tarkov Atlas.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\Tarkov Atlas.lnk" "$INSTDIR\TarkovAtlas.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "DisplayName" "Tarkov Atlas"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "Publisher" "Tarkov Atlas (fan project)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Tarkov Atlas.lnk"
  Delete "$SMPROGRAMS\Tarkov Atlas\Tarkov Atlas.lnk"
  Delete "$SMPROGRAMS\Tarkov Atlas\Удалить Tarkov Atlas.lnk"
  RMDir "$SMPROGRAMS\Tarkov Atlas"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TarkovAtlas"
  ; Important: user's LOCALAPPDATA\Tarkov Atlas profile and backups are kept.
SectionEnd
