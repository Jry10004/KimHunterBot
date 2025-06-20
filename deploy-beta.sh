#!/bin/bash

echo "🚀 클로즈 베타 봇 배포 시작..."

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)

# 변경사항 확인
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ 커밋되지 않은 변경사항이 있습니다!"
    echo "먼저 변경사항을 커밋해주세요."
    exit 1
fi

# GitHub에 푸시
echo "📤 GitHub에 푸시 중..."
git push origin $CURRENT_BRANCH

# 베타 서버에 배포 (예시)
echo "🔄 베타 봇 재시작 중..."

# PM2를 사용하는 경우
# pm2 restart kimhunter-beta

# Docker를 사용하는 경우
# docker-compose -f docker-compose.beta.yml up -d

# 또는 SSH로 원격 서버에 배포
# ssh beta-server "cd /path/to/bot && git pull && npm install && pm2 restart kimhunter-beta"

echo "✅ 베타 배포 완료!"
echo "📊 베타 봇 상태 확인: pm2 status kimhunter-beta"