# 🚀 빠른 배포 가이드

## 📦 필요한 파일 목록

### 핵심 파일
```
index.js                    # 메인 봇 파일
package.json               # 의존성 정보
package-lock.json          # 의존성 잠금
nodemon.json              # 개발 환경 설정
env.production.example    # 환경 변수 예시
```

### 명령어 파일
```
commands/
├── commands.js           # 명령어 정의
├── deployProductionCommands.js
└── deployProductionGuild.js
```

### 데이터 파일
```
data/
├── mushroomGame.js       # 독버섯 게임
├── mushroomGameEnhanced.js  # 독버섯 강화 기능
├── wordGameEnhanced.js   # 초성/끝말잇기 강화
├── wordList.js          # 단어 목록
├── prelaunchEvent.js    # 서버 오픈 이벤트
└── (기타 기존 데이터 파일들)
```

### 모델 파일
```
models/
├── User.js
├── IPBan.js
└── (기타 모델 파일들)
```

### 서비스 파일
```
services/
├── emailService.js
└── (기타 서비스 파일들)
```

### 데이터베이스 파일
```
database/
└── connection.js
```

## 🔧 본서버 설정 방법

### 1. 파일 복사
위 목록의 모든 파일을 본서버로 복사

### 2. 환경 변수 설정
```bash
# env.production.example을 .env로 복사
cp env.production.example .env

# .env 파일 편집하여 본서버 정보 입력
nano .env
```

### 3. 의존성 설치
```bash
npm install
```

### 4. 명령어 등록
```bash
node commands/deployProductionCommands.js
```

### 5. 봇 실행
```bash
# 일반 실행
node index.js

# PM2로 실행 (권장)
pm2 start index.js --name "kimhunter-prod"
```

## ⚠️ 중요 확인사항

1. **환경 변수**
   - `DISCORD_TOKEN`: 본서버 봇 토큰
   - `CLIENT_ID`: 본서버 봇 클라이언트 ID
   - `GUILD_ID`: 본서버 길드 ID
   - `MONGODB_URI`: 데이터베이스 연결 문자열

2. **관리자 설정**
   - 관리자 채널 ID: `1387483613913944145`
   - 관리자 ID: 요리, 하연94, 해물파전

3. **초기 상태**
   - 서버는 카운트다운 상태로 시작
   - `/서버오픈` 명령어로 정식 오픈

## 📝 변경 사항 요약

- ✅ 독버섯 게임 멀티플레이 강화 (아이템, 토너먼트, 반응)
- ✅ 초성/끝말잇기 멀티플레이 강화 (아이템, 파워업, 베팅)
- ✅ 팀전 모드 제거
- ✅ 장비/인벤토리 버그 수정
- ✅ 관리자 권한 시스템
- ✅ nodemon 개발 환경