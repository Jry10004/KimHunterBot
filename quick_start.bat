@echo off
title Kimhunter Bot + Claude Code Quick Start

echo ========================================
echo    Bot + Claude Code Quick Start
echo ========================================
echo.

REM Start Claude Code in new terminal
echo Starting Claude Code...
start "Claude Code" wsl bash -c "claude code"

REM Wait a moment
timeout /t 2 > nul

REM Start bot in current terminal
echo.
echo Starting bot (auto-restart enabled)...
echo.
cd /d C:\Users\USER\Desktop\Kimhunter
wsl bash -c "cd /mnt/c/Users/USER/Desktop/Kimhunter && npm run dev"

pause