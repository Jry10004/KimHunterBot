# 🚀 본서버 봇 배포 가이드

## 📋 배포 전 체크리스트

### 1. 환경 변수 확인
- `.env` 파일에서 다음 값들을 본서버 봇 설정으로 변경:
  ```
  TOKEN=본서버_봇_토큰
  CLIENT_ID=본서버_봇_클라이언트_ID
  GUILD_ID=본서버_길드_ID
  ```

### 2. 권한 설정 확인
- 관리자 채널 ID: `1387483613913944145`
- 관리자 사용자 ID:
  - 요리: `424480594542592009`
  - 하연94: `295980447849250817`
  - 해물파전: `592659577384730645`

### 3. 데이터베이스 연결
- MongoDB 연결 문자열이 올바른지 확인
- 필요시 새로운 데이터베이스 생성

## 📦 파일 전송 방법

### 방법 1: Git을 통한 전송 (권장)
```bash
# 1. 원격 저장소에 푸시
git remote add production https://github.com/your-repo/kimhunter-production.git
git push production main

# 2. 본서버에서 클론
git clone https://github.com/your-repo/kimhunter-production.git
cd kimhunter-production
```

### 방법 2: 직접 파일 전송
```bash
# 1. 파일 압축
tar -czf kimhunter-production.tar.gz --exclude='node_modules' --exclude='.env' --exclude='logs' --exclude='backups' .

# 2. 파일 전송 (SCP 또는 FTP 사용)
scp kimhunter-production.tar.gz user@production-server:/path/to/destination

# 3. 본서버에서 압축 해제
tar -xzf kimhunter-production.tar.gz
```

## 🛠️ 본서버 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
```bash
# .env 파일 생성 및 본서버 봇 정보 입력
cp .env.example .env
nano .env
```

### 3. 명령어 등록
```bash
# 본서버에 명령어 등록
npm run deploy-production
```

### 4. 봇 실행
```bash
# 프로덕션 모드로 실행
npm start

# 또는 PM2 사용 (권장)
pm2 start index.js --name "kimhunter-production"
pm2 save
pm2 startup
```

## 📝 주요 변경사항

### 1. 새로운 기능
- 🍄 독버섯 게임 멀티플레이 강화
  - 특수 아이템 시스템
  - 토너먼트 모드
  - 이모티콘 반응
  - 연승 보너스
- 🎮 초성게임 & 끝말잇기 향상
  - 아이템 및 파워업
  - 토너먼트 대회
  - 실시간 랭킹
  - 관전자 베팅 시스템
- 🛠️ 시스템 개선
  - 장비/인벤토리 버그 수정
  - 유물 탐사 표시 개선
  - 미니게임 동시 진행 안정화

### 2. 권한 시스템
- 관리자 3명만 모든 명령어 사용 가능
- 관리자 채널에서는 제한 없음
- 일반 채널은 카운트다운 상태 유지

### 3. 제거된 기능
- 팀전 모드 (독버섯 게임)
- /카운트다운 명령어

## ⚠️ 주의사항

1. **데이터 마이그레이션**
   - 기존 사용자 데이터 백업 필수
   - 새로운 스키마 확인 후 마이그레이션

2. **서버 이모지**
   - 봇이 테스트 서버와 본서버 모두에 있어야 이모지 사용 가능
   - 필요시 이모지 ID 수정

3. **성능 모니터링**
   - 멀티플레이 기능으로 인한 부하 증가 가능
   - PM2 모니터링 활용 권장

4. **롤백 계획**
   - 이전 버전 백업 유지
   - 문제 발생 시 즉시 롤백 가능하도록 준비

## 📞 문제 발생 시

1. 로그 확인: `pm2 logs kimhunter-production`
2. 데이터베이스 연결 상태 확인
3. Discord API 상태 확인
4. 필요시 개발자에게 연락

---

### 변경 사항 요약
- ✅ 멀티플레이 미니게임 대규모 업데이트
- ✅ 관리자 권한 시스템 구현
- ✅ 버그 수정 및 성능 개선
- ✅ 개발 환경 개선 (nodemon)

배포 후 반드시 모든 기능을 테스트하여 정상 작동 확인하세요!