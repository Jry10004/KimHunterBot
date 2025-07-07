# 배포 가이드

## 로컬 개발 환경

### 1. 사전 요구사항
- Node.js 16.0.0+
- MongoDB 4.4+
- Git

### 2. 설치
```bash
# 저장소 클론
git clone https://github.com/your-username/kimhunter-bot.git
cd kimhunter-bot

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집

# 개발 서버 실행
npm run dev
```

## 프로덕션 배포

### VPS/전용 서버 배포

#### 1. 서버 준비
```bash
# Ubuntu 20.04 LTS 기준

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Node.js 설치 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB 설치
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# PM2 설치
sudo npm install -g pm2
```

#### 2. 봇 배포
```bash
# 코드 가져오기
git clone https://github.com/your-username/kimhunter-bot.git
cd kimhunter-bot

# 의존성 설치
npm ci --production

# 환경 변수 설정
cp .env.example .env
nano .env # 프로덕션 값으로 수정

# PM2로 실행
pm2 start ecosystem.config.js --env production

# 시작 프로그램 등록
pm2 startup
pm2 save
```

#### 3. PM2 설정 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'kimhunter-bot',
    script: './index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

### Docker 배포

#### 1. Dockerfile
```dockerfile
FROM node:16-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --production

# 소스 코드 복사
COPY . .

# 비특권 사용자로 전환
USER node

# 봇 실행
CMD ["node", "index.js"]
```

#### 2. docker-compose.yml
```yaml
version: '3.8'

services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      - mongodb
    volumes:
      - ./logs:/app/logs
      - ./backups:/app/backups

  mongodb:
    image: mongo:4.4
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your_password
      MONGO_INITDB_DATABASE: kimhunter
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongodb_data:
```

#### 3. Docker 실행
```bash
# 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f bot

# 중지
docker-compose down
```

### 클라우드 플랫폼 배포

#### Heroku
```bash
# Heroku CLI 설치 후
heroku create kimhunter-bot
heroku addons:create mongolab:sandbox
heroku config:set TOKEN=your_token
git push heroku main
```

#### Railway
1. GitHub 저장소 연결
2. 환경 변수 설정
3. MongoDB 플러그인 추가
4. 배포

#### Google Cloud Platform
```bash
# App Engine 배포
gcloud app deploy

# Compute Engine 사용 시
# VPS 배포 가이드 참조
```

## 모니터링 설정

### 1. 헬스 체크
```nginx
# Nginx 리버스 프록시 설정
location /health {
    proxy_pass http://localhost:3000/health;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### 2. 로그 집계
```bash
# Logrotate 설정
/home/user/kimhunter-bot/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 user user
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 3. 알림 설정
- PM2 웹 대시보드
- Discord 웹훅 알림
- 이메일 알림

## 백업 전략

### 1. 자동 백업
```bash
# Cron 작업 추가
0 3 * * * cd /home/user/kimhunter-bot && npm run backup
```

### 2. 원격 백업
```bash
# S3 동기화
aws s3 sync ./backups s3://your-bucket/backups --delete
```

## 업데이트 절차

### 1. 무중단 업데이트
```bash
# 코드 업데이트
git pull origin main

# 의존성 업데이트
npm ci --production

# PM2 재시작
pm2 reload kimhunter-bot
```

### 2. 메이저 업데이트
```bash
# 백업 생성
npm run backup

# 유지보수 모드 활성화
pm2 stop kimhunter-bot

# 업데이트 실행
git pull origin main
npm ci --production
npm run migrate # 데이터베이스 마이그레이션

# 봇 재시작
pm2 start kimhunter-bot
```

## 문제 해결

### 일반적인 문제

1. **봇이 오프라인으로 표시됨**
   - 토큰 확인
   - 네트워크 연결 확인
   - Discord API 상태 확인

2. **명령어가 작동하지 않음**
   - 명령어 등록 확인
   - 권한 설정 확인
   - 에러 로그 확인

3. **데이터베이스 연결 실패**
   - MongoDB 서비스 상태 확인
   - 연결 문자열 확인
   - 방화벽 설정 확인

### 성능 문제

1. **높은 메모리 사용**
   - 메모리 누수 확인
   - 캐시 크기 조정
   - PM2 메모리 제한 설정

2. **느린 응답 시간**
   - 데이터베이스 인덱스 확인
   - 캐시 히트율 확인
   - 네트워크 지연 확인

## 보안 고려사항

1. **환경 변수**: .env 파일을 절대 커밋하지 않음
2. **포트**: 불필요한 포트는 방화벽으로 차단
3. **업데이트**: 정기적인 보안 업데이트 적용
4. **백업**: 정기적인 백업 및 복원 테스트
