@echo off
echo IDE 서버 종료 중...
taskkill /f /im node.exe /fi "WINDOWTITLE eq KimHunter IDE*"
echo 완료!
pause