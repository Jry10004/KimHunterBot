@echo off
echo 🎮 KimHunter IDE 시작 중...
echo.

REM Node.js 버전 확인
node --version > nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 다운로드하여 설치해주세요.
    pause
    exit /b 1
)

REM 현재 디렉토리로 이동
cd /d "%~dp0"

REM 의존성이 설치되어 있는지 확인
if not exist "node_modules" (
    echo 📦 의존성을 설치합니다...
    npm install
    if errorlevel 1 (
        echo ❌ 의존성 설치에 실패했습니다.
        pause
        exit /b 1
    )
)

REM 프로그램 실행
echo 🚀 KimHunter IDE를 시작합니다...
echo.
echo 💡 WSL에서는 GUI 프로그램 실행에 제한이 있을 수 있습니다.
echo 💡 Windows 명령 프롬프트나 PowerShell에서 실행하시는 것을 권장합니다.
echo.
npm start

pause