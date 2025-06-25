@echo off
echo ========================================
echo   김헌터 봇 본서버 배포 스크립트
echo ========================================
echo.

REM 색상 설정
color 0A

REM 현재 디렉토리 확인
echo [1/5] 현재 디렉토리: %cd%
echo.

REM Git 상태 확인
echo [2/5] Git 상태 확인 중...
git status --short
echo.

REM 변경사항 커밋 여부 확인
set /p commit="변경사항을 커밋하시겠습니까? (y/n): "
if /i "%commit%"=="y" (
    echo.
    echo 커밋 메시지를 입력하세요:
    set /p message="메시지: "
    git add -A
    git commit -m "%message%"
    echo 커밋 완료!
)
echo.

REM 파일 압축
echo [3/5] 배포 파일 압축 중...
if exist kimhunter-production.zip del kimhunter-production.zip

REM PowerShell을 사용하여 압축 (node_modules, logs, backups 제외)
powershell -Command "Compress-Archive -Path * -DestinationPath kimhunter-production.zip -Force -CompressionLevel Optimal -Update -Exclude @('node_modules', 'logs', 'backups', '.env', '.git', 'kimhunter-production.zip', 'bot-ide', 'prelaunchEventData_backup_*.json')"

echo 압축 완료! (kimhunter-production.zip)
echo.

REM 배포 체크리스트
echo [4/5] 배포 전 체크리스트:
echo.
echo [ ] .env 파일에서 본서버 봇 토큰으로 변경했나요?
echo [ ] CLIENT_ID를 본서버 봇 ID로 변경했나요?
echo [ ] GUILD_ID를 본서버 길드 ID로 변경했나요?
echo [ ] 데이터베이스 연결 문자열을 확인했나요?
echo [ ] 관리자 채널 ID가 올바른가요? (1387483613913944145)
echo.
set /p ready="모든 준비가 완료되었나요? (y/n): "
if /i not "%ready%"=="y" (
    echo 배포를 취소합니다.
    pause
    exit /b
)
echo.

REM 배포 명령어 안내
echo [5/5] 본서버 배포 명령어:
echo.
echo 1. 압축 파일을 본서버로 전송하세요
echo    - FTP, SCP, 또는 클라우드 스토리지 사용
echo.
echo 2. 본서버에서 다음 명령어를 실행하세요:
echo    - 압축 해제: unzip kimhunter-production.zip
echo    - 의존성 설치: npm install
echo    - .env 파일 생성 및 수정
echo    - 명령어 등록: npm run deploy-production
echo    - 봇 실행: pm2 start index.js --name kimhunter-production
echo.
echo 3. 테스트:
echo    - /서버오픈 명령어 테스트
echo    - 미니게임 멀티플레이 테스트
echo    - 관리자 권한 테스트
echo.

echo ========================================
echo 배포 준비가 완료되었습니다!
echo 파일: kimhunter-production.zip
echo ========================================

pause