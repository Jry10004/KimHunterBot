# 🧪 클로즈 베타 봇 설정 가이드

## 1. Discord에서 새 봇 생성

1. [Discord Developer Portal](https://discord.com/developers/applications) 접속
2. "New Application" 클릭
3. 이름: "김헌터 베타" 입력
4. Bot 섹션에서 "Add Bot" 클릭
5. Token 복사 (한 번만 표시됨!)

## 2. 베타 봇 초대

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_BETA_BOT_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

## 3. 환경 설정

1. `.env.beta` 파일 생성:
```bash
cp .env.beta.example .env.beta
```

2. `.env.beta` 편집하여 실제 값 입력:
- `DISCORD_TOKEN`: 베타 봇 토큰
- `CLIENT_ID`: 베타 봇 클라이언트 ID
- `GUILD_ID`: 클로즈 베타 서버 ID

## 4. 실행 방법

### 옵션 1: 별도 프로세스로 실행
```bash
# 개발 봇 (테스트 서버)
npm run dev

# 베타 봇 (다른 터미널에서)
./scripts/start-beta.sh
```

### 옵션 2: PM2로 관리
```bash
# PM2 설치 (최초 1회)
npm install -g pm2

# 모든 봇 시작
pm2 start ecosystem.config.js

# 특정 봇만 시작
pm2 start ecosystem.config.js --only kimhunter-beta

# 상태 확인
pm2 status

# 로그 보기
pm2 logs kimhunter-beta
```

## 5. 배포 워크플로우

```
1. 테스트 서버에서 개발 및 테스트
   ↓
2. Git commit & push
   ↓
3. /배포 베타 명령어 실행
   ↓
4. 베타 봇 자동 재시작
   ↓
5. 베타 테스터들이 테스트
   ↓
6. 피드백 수집 및 수정
```

## 6. 환경별 차이점

| 기능 | 개발 봇 | 베타 봇 | 프로덕션 봇 |
|------|---------|---------|-------------|
| 에러 상세 표시 | ✅ | ✅ | ❌ |
| 테스트 명령어 | ✅ | ❌ | ❌ |
| 자동 재시작 | ✅ | ✅ | ✅ |
| 디버그 모드 | ✅ | ❌ | ❌ |
| 데이터베이스 | dev DB | beta DB | prod DB |

## 7. 주의사항

1. **절대 프로덕션 토큰을 베타/개발에 사용하지 마세요**
2. 각 환경마다 별도의 봇 토큰 필요
3. 데이터베이스도 환경별로 분리 권장
4. 베타 배포 전 항상 Git에 커밋

## 8. 문제 해결

### 봇이 시작되지 않을 때
```bash
# 로그 확인
pm2 logs kimhunter-beta --lines 100

# 프로세스 재시작
pm2 restart kimhunter-beta

# 환경 변수 확인
pm2 env kimhunter-beta
```

### 명령어가 등록되지 않을 때
```bash
# 슬래시 명령어 재등록
node scripts/register-commands.js --env=beta
```