#!/bin/bash

# 백업 스크립트
echo "🔄 김헌터 봇 백업 시작..."

# 타임스탬프 생성
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backup/$TIMESTAMP"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

# 중요 파일 백업
echo "📁 파일 백업 중..."
cp -r data/ "$BACKUP_DIR/"
cp -r models/ "$BACKUP_DIR/"
cp -r services/ "$BACKUP_DIR/"
cp -r database/ "$BACKUP_DIR/"
cp index.js "$BACKUP_DIR/"
cp package*.json "$BACKUP_DIR/"
cp .env.example "$BACKUP_DIR/"

# 백업 정보 파일 생성
echo "📝 백업 정보 저장 중..."
cat > "$BACKUP_DIR/backup_info.txt" << EOF
백업 일시: $(date)
Git 커밋: $(git rev-parse HEAD)
Git 브랜치: $(git branch --show-current)
파일 수: $(find . -type f -name "*.js" | wc -l) JavaScript 파일
데이터베이스: MongoDB (연결 정보는 .env 참조)
EOF

# 압축
echo "🗜️ 압축 중..."
cd backup
zip -r "kimhunter_backup_$TIMESTAMP.zip" "$TIMESTAMP/"

# 오래된 백업 삭제 (7일 이상)
find . -name "kimhunter_backup_*.zip" -mtime +7 -delete

echo "✅ 백업 완료: backup/kimhunter_backup_$TIMESTAMP.zip"
echo "💡 팁: 이 파일을 Google Drive나 외부 저장소에도 복사하세요!"