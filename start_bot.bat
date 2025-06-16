@echo off
title Kimhunter Game Bot Launcher

:menu
cls
echo ========================================
echo    Kimhunter Game Bot Launcher
echo ========================================
echo.
echo 1. Run Bot Only (Auto Restart)
echo 2. Run Bot + Claude Code
echo 3. Run Claude Code Only
echo 4. Exit
echo.
set /p choice="Select option (1-4): "

if "%choice%"=="1" goto start_bot
if "%choice%"=="2" goto start_both
if "%choice%"=="3" goto start_claude
if "%choice%"=="4" goto exit

echo Invalid choice. Please try again.
pause
goto menu

:start_bot
cls
echo ========================================
echo    Starting Bot...
echo ========================================
echo.
echo Bot will auto-restart when source is modified.
echo Press Ctrl+C to stop.
echo.
cd /d C:\Users\USER\Desktop\Kimhunter
wsl bash -c "cd /mnt/c/Users/USER/Desktop/Kimhunter && npm run dev"
pause
goto menu

:start_both
cls
echo ========================================
echo    Starting Bot + Claude Code...
echo ========================================
echo.

REM Start Claude Code in new terminal
start "Claude Code" wsl bash -c "claude code"

REM Wait a moment
timeout /t 2 > nul

REM Start bot
echo Starting bot...
echo.
cd /d C:\Users\USER\Desktop\Kimhunter
wsl bash -c "cd /mnt/c/Users/USER/Desktop/Kimhunter && npm run dev"
pause
goto menu

:start_claude
cls
echo ========================================
echo    Starting Claude Code...
echo ========================================
echo.
wsl bash -c "claude code"
pause
goto menu

:exit
echo Exiting program.
exit