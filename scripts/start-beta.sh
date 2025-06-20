#!/bin/bash

echo "🚀 클로즈 베타 봇 시작..."

# 환경 변수 설정
export ENV_TYPE=beta

# .env.beta 파일 사용
if [ -f .env.beta ]; then
    export $(cat .env.beta | grep -v '^#' | xargs)
else
    echo "❌ .env.beta 파일이 없습니다!"
    exit 1
fi

# PM2로 시작
pm2 start ecosystem.config.js --only kimhunter-beta

# 또는 일반 node로 시작
# node index.js

echo "✅ 베타 봇이 시작되었습니다!"
echo "📊 상태 확인: pm2 status kimhunter-beta"
echo "📜 로그 확인: pm2 logs kimhunter-beta"