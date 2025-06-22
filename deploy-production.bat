@echo off
echo ===============================================
echo   Kimhunter Production Deployment
echo ===============================================
echo.

REM Check if .env.production exists
if not exist .env.production (
    echo ERROR: .env.production file not found!
    echo Please create .env.production with production credentials.
    pause
    exit /b 1
)

REM Menu
:menu
echo Choose an option:
echo 1. Deploy Commands (Register slash commands)
echo 2. Start Production Bot
echo 3. Stop Production Bot
echo 4. Restart Production Bot
echo 5. View Production Logs
echo 6. Production Status
echo 7. Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto deploy_commands
if "%choice%"=="2" goto start_bot
if "%choice%"=="3" goto stop_bot
if "%choice%"=="4" goto restart_bot
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto status
if "%choice%"=="7" goto end

echo Invalid choice. Please try again.
echo.
goto menu

:deploy_commands
echo.
echo Deploying production commands...
node commands/deployProductionCommands.js
echo.
pause
goto menu

:start_bot
echo.
echo Starting production bot...
pm2 start ecosystem.config.js --only kimhunter-prod
echo.
pause
goto menu

:stop_bot
echo.
echo Stopping production bot...
pm2 stop kimhunter-prod
echo.
pause
goto menu

:restart_bot
echo.
echo Restarting production bot...
pm2 restart kimhunter-prod
echo.
pause
goto menu

:view_logs
echo.
echo Showing production logs (Press Ctrl+C to exit)...
pm2 logs kimhunter-prod
echo.
pause
goto menu

:status
echo.
echo Production bot status:
pm2 status kimhunter-prod
echo.
pause
goto menu

:end
echo.
echo Goodbye!
pause