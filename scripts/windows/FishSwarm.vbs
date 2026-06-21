Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = fso.BuildPath(scriptDir, "FishSwarm.ps1")

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & psScript & Chr(34)
shell.Run command, 1, False
