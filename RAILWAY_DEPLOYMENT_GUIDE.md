# Railway 배포 가이드

## 1. Railway 계정 준비
1. [Railway.app](https://railway.app) 접속
2. GitHub 계정으로 가입/로그인

## 2. GitHub 준비
1. 이 프로젝트를 GitHub에 푸시
2. `.env` 파일은 절대 푸시하지 마세요!

## 3. Railway 프로젝트 생성
1. Railway 대시보드에서 "New Project" 클릭
2. "Deploy from GitHub repo" 선택
3. 봇 레포지토리 선택

## 4. 환경변수 설정 (중요!)
Railway 프로젝트 > Variables 탭에서 다음 추가:

```
DISCORD_TOKEN=your_bot_token_here
MONGODB_URI=your_mongodb_connection_string
CLIENT_ID=your_bot_client_id
GUILD_ID=your_guild_id
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_google_cse_id
ADMIN_ID=your_discord_user_id
DEV_MODE=false
REGISTER_COMMANDS=true
NODE_ENV=production
```

## 5. MongoDB 설정
### 옵션 A: MongoDB Atlas (추천)
1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) 무료 계정 생성
2. 클러스터 생성 (M0 무료 티어)
3. 네트워크 접근: 0.0.0.0/0 (모든 IP 허용)
4. 연결 문자열 복사

### 옵션 B: Railway MongoDB
1. Railway에서 "New" > "Database" > "MongoDB"
2. 자동으로 연결됨

## 6. 배포
1. 코드를 GitHub에 푸시하면 자동 배포
2. Railway 대시보드에서 로그 확인

## 7. 추가 설정
- Settings > Restart Policy: "Always"
- Settings > Health Check 활성화

## 배포 체크리스트
- [ ] .env 파일이 .gitignore에 포함되어 있나요?
- [ ] 모든 환경변수를 Railway에 설정했나요?
- [ ] MongoDB 연결 문자열이 올바른가요?
- [ ] 봇 토큰이 정확한가요?

## 문제 해결
1. 봇이 시작되지 않음: 로그 확인
2. MongoDB 연결 실패: IP 화이트리스트 확인
3. 명령어 작동 안함: GUILD_ID 확인