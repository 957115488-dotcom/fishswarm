!macro customCheckAppRunning
  ; Kill the entire process tree before install/upgrade.
  ; /T = kill child processes (node.exe, MCP servers), /F = force
  ; Only during install pass; uninstaller pass is a no-op.
  !ifndef BUILD_UNINSTALLER
  nsExec::Exec 'taskkill /T /F /IM "FishSwarm.exe"'
  Pop $R0
  nsExec::Exec 'taskkill /T /F /IM "Fish Swarm.exe"'
  Pop $R0
  ; Kill orphaned node.exe from install directory via PowerShell (wmic deprecated on Win 11)
  ; $$ escapes dollar sign in NSIS so PowerShell receives $_ correctly
  nsExec::Exec 'powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq ''node.exe'' -and ($$_.ExecutablePath -like ''*FishSwarm*'' -or $$_.ExecutablePath -like ''*Fish Swarm*'') } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }"'
  Pop $R0
  ; Wait for processes to exit and release file locks
  Sleep 3000
  !endif
!macroend

Function FishSwarmShowLegacyUninstallHelp
  Exch $0
  DetailPrint `Legacy FishSwarm/Fish Swarm uninstall failed: $0`

  ; ── installer pass (BUILD_UNINSTALLER is NOT defined) ──────────────
  !ifndef BUILD_UNINSTALLER
    MessageBox MB_OK|MB_ICONEXCLAMATION "FishSwarm could not remove the previously installed version.$\r$\n$\r$\nThis usually means the legacy Windows uninstaller is damaged.$\r$\n$\r$\nNext steps:$\r$\n1. Close all FishSwarm windows.$\r$\n2. Run:$\r$\n$EXEDIR\Fish-Swarm-Legacy-Cleanup.cmd$\r$\n3. Start this installer again.$\r$\n$\r$\nAdd -RemoveAppData to the cleanup tool only if you also want to clear local settings."
  !endif

  ; ── uninstaller pass (BUILD_UNINSTALLER is defined) ────────────────
  !ifdef BUILD_UNINSTALLER
    MessageBox MB_OK|MB_ICONEXCLAMATION "FishSwarm could not remove the previously installed version.$\r$\n$\r$\nThis usually means the legacy Windows uninstaller is damaged.$\r$\n$\r$\nPlease close FishSwarm, delete the old install folder:$\r$\n$LOCALAPPDATA\Programs\Fish Swarm$\r$\nand then run this installer again.$\r$\n$\r$\nLocal settings may remain in AppData by design."
  !endif

  Pop $0
FunctionEnd

; ─────────────────────────────────────────────────────────────────────
; Uninstall check hooks
; electron-builder calls these when the old-version uninstall returns
; a non-zero exit code.  We show a helpful message instead of the
; default cryptic "uninstall failed" dialog.
; ─────────────────────────────────────────────────────────────────────

!macro customUnInstallCheck
  ${if} $R0 != 0
    Push $R0
    Call FishSwarmShowLegacyUninstallHelp
  ${endif}
!macroend

!macro customUnInstallCheckCurrentUser
  ${if} $R0 != 0
    Push $R0
    Call FishSwarmShowLegacyUninstallHelp
  ${endif}
!macroend
