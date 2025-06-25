@echo off
cd %~dp0
title Kim Hunter Bot Manager
cls
echo Starting Bot Manager...
node bot-manager.js
if errorlevel 1 (
    echo.
    echo Error: Node.js not found!
    echo Please install Node.js from https://nodejs.org/
    echo.
)
pause