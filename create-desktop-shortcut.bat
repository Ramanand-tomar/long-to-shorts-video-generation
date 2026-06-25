@echo off
setlocal
cd /d "%~dp0"
echo Creating desktop shortcut...

powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Long Short Generator.lnk')); $Shortcut.TargetPath = '%~dp0run-project.bat'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.Save();"

echo ===================================================
echo Desktop shortcut created successfully!
echo You can now close this window and double-click the 
echo "Long Short Generator" shortcut on your Desktop.
echo ===================================================
pause
