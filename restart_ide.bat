@echo off
echo IDE 서버 재시작 중...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul
cd integrated-ide
node simple-server.js
pause