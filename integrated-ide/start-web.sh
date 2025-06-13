#!/bin/bash

echo "🎮 KimHunter IDE 웹 서버 시작 중..."
echo ""

# 프로세스 종료
echo "기존 프로세스 정리 중..."
pkill -f "node server.js" 2>/dev/null

# 포트 확인
echo "포트 3000 상태 확인..."
if command -v netstat &> /dev/null; then
    netstat -tlnp | grep :3000
elif command -v ss &> /dev/null; then
    ss -tlnp | grep :3000
fi

echo ""
echo "🚀 서버 시작..."
echo "Ctrl+C로 서버를 중지할 수 있습니다."
echo ""

# 서버 실행
node server.js