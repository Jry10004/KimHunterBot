@echo off
echo Installing KimHunter Bot IDE...
echo.

cd /d "%~dp0"

echo Installing dependencies...
call npm install

echo.
echo Building executable...
call npm run build

echo.
echo Installation complete!
echo.
echo You can now run the IDE using:
echo   - npm start (development)
echo   - dist\KimHunter Bot IDE.exe (standalone)
echo.
pause