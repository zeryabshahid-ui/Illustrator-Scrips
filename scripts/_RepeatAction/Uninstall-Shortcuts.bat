@echo off
setlocal EnableExtensions

rem Uninstall-Shortcuts.bat
rem Removes the shortcut helper for the current user. No administrator rights.
rem
rem What it does, in order:
rem   1. Stops RepeatActionHotkey.exe if it is running.
rem   2. Deletes the current-user startup entry ZeryabIllustratorShortcuts.
rem   3. Deletes the compiled RepeatActionHotkey.exe in this folder.
rem
rem The .jsx scripts and the .cs source are left in place.

cd /d "%~dp0"

echo.
echo Illustrator shortcut helper - uninstall
echo ----------------------------------------
echo This stops the helper, removes its sign-in startup entry, and deletes the compiled program.
echo Your scripts are not deleted. No administrator rights are required.
echo.

echo Stopping RepeatActionHotkey.exe ...
taskkill /F /IM RepeatActionHotkey.exe >nul 2>&1
rem An error here only means it was not running.
timeout /t 2 /nobreak >nul

set "RUN_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
echo Removing startup entry ZeryabIllustratorShortcuts ...
reg delete "%RUN_KEY%" /v ZeryabIllustratorShortcuts /f >nul 2>&1
if errorlevel 1 (
  echo The startup entry was not there. It may already have been removed.
) else (
  echo Removed the startup entry.
)

if exist "%~dp0RepeatActionHotkey.exe" (
  del /f /q "%~dp0RepeatActionHotkey.exe"
  if exist "%~dp0RepeatActionHotkey.exe" (
    echo ERROR: Could not delete RepeatActionHotkey.exe.
    echo Right-click the tray icon, choose Exit shortcut helper, then run this file again.
    goto fail
  )
  echo Deleted RepeatActionHotkey.exe.
) else (
  echo RepeatActionHotkey.exe was not in this folder.
)

echo.
echo The shortcut helper is uninstalled.
echo Ctrl+Alt+R and Ctrl+Alt+V from this helper will no longer run.
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
