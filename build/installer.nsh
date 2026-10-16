; Custom NSIS snippet: when the app is UNINSTALLED (not when it is merely updated), ask whether to
; delete the user's data. Silent uninstalls and updates always keep it.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Do you also want to delete your notes, snippets and cat progress?$\r$\n$\r$\nYes  = delete them for good$\r$\nNo   = keep them (recommended if you may reinstall later)" /SD IDNO IDNO keepCatData
      RMDir /r "$APPDATA\windows-cat-companion"
    keepCatData:
  ${endIf}
!macroend
