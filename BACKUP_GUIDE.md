# 🛡️ 김헌터 봇 백업 가이드

## 🚨 중요 데이터 백업 체크리스트

### 1. **코드 백업 (GitHub)**
- ✅ 모든 변경사항이 GitHub에 푸시됨
- 저장소: https://github.com/Jry10004/KimHunterBot

### 2. **환경 변수 (.env)**
- ⚠️ **절대 GitHub에 업로드하지 마세요!**
- 별도로 안전한 곳에 백업 필요:
  - Discord 봇 토큰
  - MongoDB 연결 문자열
  - 이메일 설정

### 3. **MongoDB 데이터베이스**
- MongoDB Atlas 사용 시: 자동 백업 설정 확인
- 로컬 MongoDB 사용 시: `mongodump` 명령어로 백업

### 4. **백업 스크립트 사용법**
```bash
# 로컬 백업 실행
./backup.sh

# 수동으로 특정 파일 백업
cp index.js index.js.backup_$(date +%Y%m%d)
```

### 5. **복구 방법**

#### 코드 복구
```bash
# GitHub에서 클론
git clone https://github.com/Jry10004/KimHunterBot.git

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집하여 실제 값 입력
```

#### 데이터베이스 복구
```bash
# MongoDB 백업에서 복구
mongorestore --uri "mongodb://..." backup_folder/
```

### 6. **정기 백업 권장사항**

1. **일일 백업**
   - 코드 변경사항: Git commit & push
   - 데이터베이스: 자동 백업 확인

2. **주간 백업**
   - 전체 프로젝트 압축 백업
   - 외부 저장소에 복사 (Google Drive, Dropbox 등)

3. **월간 백업**
   - 전체 시스템 스냅샷
   - 오프사이트 백업 (다른 위치에 저장)

### 7. **긴급 복구 연락처**
- GitHub 저장소 문제: GitHub Support
- MongoDB 문제: MongoDB Atlas Support
- Discord 봇 문제: Discord Developer Portal

### 8. **백업 파일 위치**
```
/backup/              # 로컬 백업 (Git 제외)
.env.example         # 환경 변수 템플릿
package.json         # 의존성 목록
package-lock.json    # 정확한 버전 고정
```

## 🔐 보안 주의사항
1. `.env` 파일은 절대 공개 저장소에 업로드하지 마세요
2. 백업 파일에는 민감한 정보가 포함될 수 있으니 안전하게 보관하세요
3. 정기적으로 백업이 제대로 작동하는지 테스트하세요

---
최종 업데이트: $(date)