@echo off
echo ===================================
echo 🚀 김헌터 IDE API 설정 도우미
echo ===================================
echo.
echo 실제 Claude와 연결하려면 Anthropic API 키가 필요합니다.
echo.
echo 1. https://console.anthropic.com/settings/keys 접속
echo 2. "Create Key" 클릭
echo 3. 키 이름 입력 (예: KimHunter-IDE)
echo 4. 생성된 키 복사 (sk-ant-로 시작)
echo.
echo 방법 1: .env 파일에 직접 입력
echo - integrated-ide/.env 파일 열기
echo - ANTHROPIC_API_KEY=sk-ant-... 형식으로 입력
echo.
echo 방법 2: IDE에서 직접 입력
echo - 인증 창에 API 키 붙여넣기
echo.
pause