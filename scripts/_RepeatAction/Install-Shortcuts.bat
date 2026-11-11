@echo off
setlocal EnableExtensions

rem Install-Shortcuts.bat
rem One-click setup for the Illustrator shortcut helper. No administrator rights.
rem
rem What it does, in order:
rem   1. Stays in this folder, so it works no matter where you double-click from.
rem   2. Checks the scripts are still in the repository layout.
rem   3. Finds the .NET Framework C# compiler that ships with Windows.
rem   4. Stops a helper that is already running, so the new file can replace it.
rem   5. Compiles RepeatActionHotkey.cs into RepeatActionHotkey.exe in this folder.
rem   6. Adds a current-user startup entry so the helper starts when you sign in.
rem   7. Starts the helper now.
rem
rem The download does not include an exe. This builds it on your PC.
rem Layout this file expects:
rem   ..\PasteToReplace.jsx
rem   ..\RepeatAction.jsx
rem   RepeatActionRun.jsx
rem   RepeatActionHotkey.cs
rem   Install-Shortcuts.bat

cd /d "%~dp0"

echo.
echo Illustrator shortcut helper - install
echo --------------------------------------
echo This builds the helper on this PC from RepeatActionHotkey.cs.
echo Nothing prebuilt is included in the download.
echo No administrator rights are required.
echo.

if not exist "RepeatActionHotkey.cs" (
  echo ERROR: RepeatActionHotkey.cs was not found next to this installer.
  echo Keep the _RepeatAction folder intact and run Install-Shortcuts.bat from inside it.
  goto fail
)
if not exist "RepeatActionRun.jsx" (
  echo ERROR: RepeatActionRun.jsx was not found next to this installer.
  echo Ctrl+Alt+R needs that file in the same folder as the helper.
  goto fail
)
if not exist "..\PasteToReplace.jsx" (
  echo ERROR: PasteToReplace.jsx was not found one folder up.
  echo Keep the scripts folder as it was downloaded. PasteToReplace.jsx belongs beside the _RepeatAction folder.
  goto fail
)

rem 64-bit compiler first, then the 32-bit Framework folder.
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo ERROR: The .NET Framework compiler csc.exe was not found.
  echo Looked in:
  echo   %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
  echo   %WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
  echo .NET Framework 4.x is part of Windows 10 and 11. If both paths are missing, enable the .NET Framework 4.8 feature and run this again.
  goto fail
)

echo Compiler:
echo   %CSC%
echo.

echo Stopping any running RepeatActionHotkey.exe ...
taskkill /F /IM RepeatActionHotkey.exe >nul 2>&1
rem taskkill exits with an error when the helper is not running. That is fine.
rem Wait so Windows can release the file before we overwrite it.
timeout /t 2 /nobreak >nul

echo Compiling RepeatActionHotkey.cs ...
"%CSC%" /nologo /target:winexe /out:"%~dp0RepeatActionHotkey.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "%~dp0RepeatActionHotkey.cs"
if errorlevel 1 (
  echo.
  echo ERROR: The compiler reported an error. The helper was not installed.
  echo If the message says the file is in use, exit the helper from its tray icon and run this again.
  goto fail
)
if not exist "%~dp0RepeatActionHotkey.exe" (
  echo ERROR: RepeatActionHotkey.exe was not created.
  goto fail
)

rem HKCU Run starts the program for this Windows user only. The value is a quoted path.
set "RUN_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
set "EXE=%~dp0RepeatActionHotkey.exe"
echo Registering startup entry ZeryabIllustratorShortcuts ...
reg add "%RUN_KEY%" /v ZeryabIllustratorShortcuts /t REG_SZ /d "\"%EXE%\"" /f >nul
if errorlevel 1 (
  echo ERROR: Could not write the startup entry. The helper was compiled but will not start at sign-in.
  goto fail
)

echo Starting the helper ...
ver >nul
start "" "%EXE%"
if errorlevel 1 (
  echo ERROR: The helper was compiled and registered, but Windows did not start it.
  echo Open RepeatActionHotkey.exe in this folder, or sign out and back in.
  goto fail
)

echo.
echo Success.
echo   Built:    %EXE%
echo   Startup:  ZeryabIllustratorShortcuts
echo.
echo Ctrl+Alt+R repeats the action chosen in the Repeat Action panel.
echo Ctrl+Alt+V runs Paste to Replace.
echo Both shortcuts work only while Illustrator is the active window.
echo The helper starts again the next time you sign in to Windows.
echo.
echo To remove it, double-click Uninstall-Shortcuts.bat in this folder.
echo.
pause
exit /b 0

:fail
echo.
echo Install did not finish. Read the ERROR line above.
echo.
pause
exit /b 1
