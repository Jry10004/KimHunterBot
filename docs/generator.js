// 문서 자동 생성기
const fs = require('fs').promises;
const path = require('path');

class DocumentationGenerator {
    constructor() {
        this.docsDir = path.join(__dirname);
        this.config = {
            // 문서화할 디렉토리
            sourceDirs: [
                'commands',
                'models',
                'services',
                'systems',
                'utils',
                'handlers',
                'security',
                'middleware'
            ],
            // 제외할 파일 패턴
            excludePatterns: [
                '**/node_modules/**',
                '**/tests/**',
                '**/*.test.js',
                '**/*.spec.js'
            ],
            // 템플릿 설정
            templates: {
                main: 'templates/main.hbs',
                command: 'templates/command.hbs',
                api: 'templates/api.hbs'
            }
        };
    }
    
    // 문서 생성 시작
    async generate() {
        console.log('📚 문서 생성 시작...\n');
        
        try {
            // 1. README 생성
            await this.generateReadme();
            
            // 2. API 문서 생성
            await this.generateAPIDocs();
            
            // 3. 명령어 문서 생성
            await this.generateCommandDocs();
            
            // 4. 구성 문서 생성
            await this.generateConfigDocs();
            
            // 5. 아키텍처 문서 생성
            await this.generateArchitectureDocs();
            
            // 6. 보안 문서 생성
            await this.generateSecurityDocs();
            
            // 7. 배포 가이드 생성
            await this.generateDeploymentGuide();
            
            // 8. 개발자 가이드 생성
            await this.generateDeveloperGuide();
            
            console.log('\n✅ 모든 문서 생성 완료!');
            
        } catch (error) {
            console.error('❌ 문서 생성 실패:', error);
        }
    }
    
    // README.md 생성
    async generateReadme() {
        const content = `# KimHunter Discord Bot

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)

종합적인 게임 기능을 제공하는 Discord 봇입니다.

## 🚀 주요 기능

### 🎮 게임 시스템
- **사냥 시스템**: 다양한 사냥터에서 몬스터 사냥
- **PVP 시스템**: 실시간 플레이어 대전
- **던전 시스템**: 다층 던전 탐험
- **보스 레이드**: 협동 보스 전투
- **미니게임**: 가위바위보, 홀짝, 버섯 게임 등

### 💰 경제 시스템
- **화폐 시스템**: 골드 기반 경제
- **거래 시스템**: 플레이어 간 아이템 거래
- **상점 시스템**: 아이템 구매/판매
- **주식 시스템**: 가상 주식 거래

### 🏆 진행 시스템
- **레벨 시스템**: 경험치 기반 성장
- **퀘스트 시스템**: 일일/주간 퀘스트
- **업적 시스템**: 다양한 도전 과제
- **랭킹 시스템**: 경쟁 순위표

## 📋 요구사항

- Node.js 16.0.0 이상
- MongoDB 4.4 이상
- Discord Bot Token

## 🛠️ 설치 방법

1. 저장소 클론
\`\`\`bash
git clone https://github.com/your-username/kimhunter-bot.git
cd kimhunter-bot
\`\`\`

2. 의존성 설치
\`\`\`bash
npm install
\`\`\`

3. 환경 변수 설정
\`\`\`bash
cp .env.example .env
# .env 파일을 편집하여 필요한 값 설정
\`\`\`

4. 봇 실행
\`\`\`bash
npm start
\`\`\`

## 🏗️ 프로젝트 구조

\`\`\`
kimhunter-bot/
├── commands/         # Discord 명령어
├── models/          # 데이터베이스 모델
├── services/        # 비즈니스 로직 서비스
├── systems/         # 게임 시스템
├── handlers/        # 이벤트 핸들러
├── middleware/      # 미들웨어
├── security/        # 보안 모듈
├── utils/           # 유틸리티 함수
├── config/          # 설정 파일
├── tests/           # 테스트 파일
├── docs/            # 문서
└── index.js         # 진입점
\`\`\`

## 🧪 테스트

\`\`\`bash
# 모든 테스트 실행
npm test

# 커버리지 포함
npm run test:coverage

# 특정 테스트만 실행
npm run test:unit
npm run test:integration
npm run test:e2e
\`\`\`

## 📚 문서

- [API 문서](./docs/API.md)
- [명령어 가이드](./docs/COMMANDS.md)
- [설정 가이드](./docs/CONFIGURATION.md)
- [아키텍처](./docs/ARCHITECTURE.md)
- [보안 가이드](./docs/SECURITY.md)
- [배포 가이드](./docs/DEPLOYMENT.md)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the Branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 👥 팀

- 개발자: KimHunter Team
- 문의: support@kimhunter.bot

## 🙏 감사의 말

이 프로젝트에 기여해주신 모든 분들께 감사드립니다!
`;
        
        await fs.writeFile(path.join(__dirname, '..', 'README.md'), content);
        console.log('✅ README.md 생성 완료');
    }
    
    // API 문서 생성
    async generateAPIDocs() {
        const apiDoc = `# API 문서

## 서비스 API

### CacheService

캐시 관리 서비스

#### 메서드

##### set(layer, key, value, ttl)
데이터를 캐시에 저장

**파라미터:**
- \`layer\` (string): 캐시 레이어 (user, game, temp, api)
- \`key\` (string): 캐시 키
- \`value\` (any): 저장할 값
- \`ttl\` (number): Time To Live (초)

**예시:**
\`\`\`javascript
cacheService.set('user', 'user:123', userData, 3600);
\`\`\`

##### get(layer, key)
캐시에서 데이터 조회

**파라미터:**
- \`layer\` (string): 캐시 레이어
- \`key\` (string): 캐시 키

**반환값:** 캐시된 값 또는 null

### DatabaseOptimizer

데이터베이스 최적화 서비스

#### 메서드

##### analyzeIndexes()
인덱스 분석 및 추천

**반환값:**
\`\`\`javascript
{
  User: {
    existing: [...],
    suggested: [...],
    unused: [...]
  }
}
\`\`\`

##### ensureSave(document, maxRetries)
안전한 문서 저장 (재시도 포함)

**파라미터:**
- \`document\` (Document): Mongoose 문서
- \`maxRetries\` (number): 최대 재시도 횟수

### NotificationService

실시간 알림 서비스

#### 메서드

##### subscribe(userId, notificationType, settings)
알림 구독

**파라미터:**
- \`userId\` (string): 사용자 ID
- \`notificationType\` (string): 알림 타입
- \`settings\` (object): 알림 설정

**알림 타입:**
- BOSS_SPAWN: 보스 출현
- PVP_CHALLENGE: PVP 도전
- AUCTION_OUTBID: 경매 상위 입찰
- AUCTION_WON: 경매 낙찰
- STOCK_ALERT: 주식 알림
- ENERGY_FULL: 에너지 충전 완료
- LEVEL_UP: 레벨 업
- RARE_DROP: 희귀 아이템 획득

### SchedulerService

백그라운드 작업 스케줄러

#### 메서드

##### registerJob(id, config)
작업 등록

**파라미터:**
\`\`\`javascript
{
  name: '작업 이름',
  schedule: '*/5 * * * *', // cron 표현식
  handler: async () => { }, // 실행 함수
  priority: 1, // 우선순위
  enabled: true,
  runOnStart: false,
  maxRetries: 3,
  timeout: 30000
}
\`\`\`

## 보안 API

### InputValidator

입력 검증 서비스

#### 메서드

##### validate(value, type)
입력값 검증

**타입:**
- discordId: Discord ID
- username: 사용자명
- nickname: 닉네임
- email: 이메일
- commandName: 명령어 이름
- positiveInteger: 양의 정수

### RateLimiter

요청 제한 서비스

#### 메서드

##### checkRequest(userId, type, metadata)
요청 가능 여부 확인

**반환값:**
\`\`\`javascript
{
  allowed: boolean,
  reason: string,
  retryAfter: number,
  message: string
}
\`\`\`

### EncryptionService

암호화 서비스

#### 메서드

##### encrypt(data, additionalData)
데이터 암호화

##### decrypt(encryptedData, additionalData)
데이터 복호화

##### hashPassword(password)
비밀번호 해싱

##### generateToken(length)
안전한 토큰 생성
`;
        
        await fs.writeFile(path.join(this.docsDir, 'API.md'), apiDoc);
        console.log('✅ API.md 생성 완료');
    }
    
    // 명령어 문서 생성
    async generateCommandDocs() {
        const commandDoc = `# 명령어 가이드

## 기본 명령어

### /등록
봇에 계정을 등록합니다.

**사용법:** \`/등록\`

### /프로필
자신의 프로필을 확인합니다.

**사용법:** \`/프로필 [유저]\`

**옵션:**
- \`유저\`: 확인할 사용자 (선택)

### /도움말
명령어 목록을 확인합니다.

**사용법:** \`/도움말 [카테고리]\`

## 게임 명령어

### /사냥
사냥터에서 몬스터를 사냥합니다.

**사용법:** \`/사냥\`

**사냥터:**
- 🌲 숲 (레벨 1+)
- 🏜️ 사막 (레벨 10+)
- ⛰️ 산 (레벨 20+)
- 🏔️ 설산 (레벨 30+)
- 🌋 화산 (레벨 40+)
- 🏛️ 고대 유적 (레벨 50+)

### /던전
던전을 탐험합니다.

**사용법:** \`/던전 [난이도]\`

**난이도:**
- 쉬움: 레벨 10+
- 보통: 레벨 25+
- 어려움: 레벨 40+
- 지옥: 레벨 60+

### /결투
다른 플레이어와 PVP를 합니다.

**사용법:** \`/결투 <상대> [베팅금액]\`

**파라미터:**
- \`상대\`: 결투할 사용자 (필수)
- \`베팅금액\`: 베팅할 골드 (선택)

### /보스레이드
보스 레이드에 참가합니다.

**사용법:** \`/보스레이드 [액션]\`

**액션:**
- 시작: 새로운 레이드 시작
- 참가: 진행 중인 레이드 참가
- 상태: 현재 레이드 상태 확인

## 경제 명령어

### /일하기
골드를 획득합니다.

**사용법:** \`/일하기\`

**쿨다운:** 30분

### /상점
아이템 상점을 확인합니다.

**사용법:** \`/상점 [카테고리]\`

**카테고리:**
- 무기
- 방어구
- 소모품
- 특수

### /인벤토리
보유 아이템을 확인합니다.

**사용법:** \`/인벤토리 [페이지]\`

### /거래
다른 플레이어와 아이템을 거래합니다.

**사용법:** \`/거래 <상대>\`

### /주식
주식 시장을 확인합니다.

**사용법:** \`/주식 [액션] [종목] [수량]\`

**액션:**
- 목록: 주식 목록 확인
- 매수: 주식 구매
- 매도: 주식 판매
- 포트폴리오: 보유 주식 확인

## 미니게임 명령어

### /가위바위보
가위바위보 게임을 합니다.

**사용법:** \`/가위바위보 [모드]\`

**모드:**
- 싱글: 봇과 대전
- 멀티: 다른 플레이어와 대전

### /홀짝
홀짝 게임을 합니다.

**사용법:** \`/홀짝 <선택> <베팅금액>\`

### /버섯게임
독버섯 찾기 게임을 합니다.

**사용법:** \`/버섯게임 [난이도]\`

### /끝말잇기
끝말잇기 게임을 합니다.

**사용법:** \`/끝말잇기 <단어>\`

### /초성게임
초성 퀴즈를 합니다.

**사용법:** \`/초성게임\`

## 관리자 명령어

### /공지
공지사항을 발송합니다.

**사용법:** \`/공지 <내용>\`

**권한:** 관리자

### /지급
아이템이나 골드를 지급합니다.

**사용법:** \`/지급 <유저> <타입> <값>\`

**권한:** 관리자

### /밴
사용자를 차단합니다.

**사용법:** \`/밴 <유저> [사유]\`

**권한:** 관리자

### /언밴
차단을 해제합니다.

**사용법:** \`/언밴 <유저>\`

**권한:** 관리자

### /백업
데이터를 백업합니다.

**사용법:** \`/백업\`

**권한:** 관리자
`;
        
        await fs.writeFile(path.join(this.docsDir, 'COMMANDS.md'), commandDoc);
        console.log('✅ COMMANDS.md 생성 완료');
    }
    
    // 설정 문서 생성
    async generateConfigDocs() {
        const configDoc = `# 설정 가이드

## 환경 변수 설정

### 필수 환경 변수

\`\`\`env
# Discord 봇 설정
TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# MongoDB 설정
MONGODB_URI=mongodb://localhost:27017/kimhunter
# 또는 MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# 이메일 설정 (선택)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# 암호화 키 (프로덕션 필수)
ENCRYPTION_KEY=your_base64_encoded_32_byte_key
\`\`\`

### 선택 환경 변수

\`\`\`env
# 개발 모드
DEV_MODE=false
DEV_CHANNEL_IDS=channel_id1,channel_id2

# 채널 설정
REGISTRATION_CHANNEL_ID=등록_채널_ID
ANNOUNCEMENT_CHANNEL_ID=공지_채널_ID
NEWS_CHANNEL_ID=뉴스_채널_ID

# 로그 레벨
LOG_LEVEL=info # error, warn, info, http, verbose, debug

# 포트 설정
PORT=3000

# API 키
URIMAL_API_KEY=국립국어원_API_키
NEWS_API_KEY=뉴스_API_키
\`\`\`

## 게임 설정

### 레벨 시스템

\`\`\`javascript
// config/gameConfig.js
module.exports = {
    leveling: {
        baseExp: 100,
        expMultiplier: 1.2,
        maxLevel: 100
    }
};
\`\`\`

### 경제 시스템

\`\`\`javascript
module.exports = {
    economy: {
        workReward: { min: 50, max: 200 },
        workCooldown: 1800000, // 30분
        dailyReward: 1000,
        tradeTax: 0.05 // 5%
    }
};
\`\`\`

### PVP 설정

\`\`\`javascript
module.exports = {
    pvp: {
        minBet: 100,
        maxBet: 1000000,
        winnerTake: 0.9, // 승자 90%
        ratingChange: {
            base: 30,
            kFactor: 32
        }
    }
};
\`\`\`

## 보안 설정

### Rate Limiting

\`\`\`javascript
// security/RateLimiter.js
config: {
    commands: {
        default: { limit: 10, window: 60000 },
        hunt: { limit: 5, window: 60000 },
        work: { limit: 3, window: 300000 },
        daily: { limit: 1, window: 86400000 }
    },
    global: {
        user: { limit: 100, window: 60000 },
        guild: { limit: 1000, window: 60000 }
    }
}
\`\`\`

### 권한 설정

\`\`\`javascript
// security/PermissionManager.js
roles: {
    owner: { level: 100, permissions: ['*'] },
    admin: { level: 90, permissions: ['command.*', 'manage.*'] },
    moderator: { level: 50, permissions: ['command.ban', 'command.mute'] },
    vip: { level: 20, permissions: ['command.vip', 'bypass.cooldown'] },
    verified: { level: 10, permissions: ['command.trade', 'command.pvp'] },
    user: { level: 1, permissions: ['command.basic'] },
    guest: { level: 0, permissions: ['command.help', 'command.register'] }
}
\`\`\`

## 데이터베이스 설정

### 인덱스 최적화

\`\`\`javascript
// models/User.js
userSchema.index({ discordId: 1 }, { unique: true });
userSchema.index({ level: -1, exp: -1 }); // 랭킹용
userSchema.index({ 'pvp.rating': -1 }); // PVP 랭킹용
userSchema.index({ createdAt: 1 }); // 시간 기반 쿼리용
\`\`\`

### 연결 풀 설정

\`\`\`javascript
// database/enhancedConnection.js
const options = {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority'
};
\`\`\`

## 캐시 설정

### 레이어별 TTL

\`\`\`javascript
// services/CacheService.js
const defaultTTL = {
    user: 3600,    // 1시간
    game: 300,     // 5분
    temp: 60,      // 1분
    api: 1800      // 30분
};
\`\`\`

## 백업 설정

### 자동 백업

\`\`\`javascript
// systems/enhancedBackupSystem.js
config: {
    maxBackups: 30,
    compressionLevel: 9,
    incrementalEnabled: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24시간
    retentionDays: 30
}
\`\`\`

## 모니터링 설정

### 헬스 체크

\`\`\`javascript
// services/HealthCheck.js
// 헬스 체크 엔드포인트: /health
// 상세 정보: /health?verbose=true
\`\`\`

### 메트릭 수집

\`\`\`javascript
// services/MetricsCollector.js
config: {
    systemMetricsInterval: 30000, // 30초
    aggregationInterval: 300000,   // 5분
    retentionPeriod: 86400000     // 24시간
}
\`\`\`
`;
        
        await fs.writeFile(path.join(this.docsDir, 'CONFIGURATION.md'), configDoc);
        console.log('✅ CONFIGURATION.md 생성 완료');
    }
    
    // 아키텍처 문서 생성
    async generateArchitectureDocs() {
        const archDoc = `# 아키텍처

## 시스템 구조

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                        Discord Client                        │
├─────────────────────────────────────────────────────────────┤
│                     Command Handlers                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │   Game  │  │Economy  │  │  Social │  │  Admin  │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
├───────┴─────────────┴─────────────┴─────────────┴───────────┤
│                      Middleware Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Security │  │ Logging  │  │   Rate   │  │Permission│   │
│  │          │  │          │  │ Limiting │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Service Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │Cache Service│  │Notification │  │  Scheduler  │        │
│  │             │  │   Service   │  │   Service   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   MongoDB   │  │   Redis     │  │  File System│        │
│  │  (Primary)  │  │  (Cache)    │  │   (Logs)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## 모듈 구조

### 핵심 모듈

#### 1. Command System
- **위치**: \`/commands\`
- **역할**: Discord 슬래시 명령어 처리
- **특징**: 모듈화된 명령어 구조

#### 2. Event Handlers
- **위치**: \`/handlers\`
- **역할**: Discord 및 시스템 이벤트 처리
- **주요 이벤트**:
  - ready: 봇 시작
  - interactionCreate: 상호작용 처리
  - messageCreate: 메시지 처리
  - guildMemberAdd: 멤버 가입

#### 3. Game Systems
- **위치**: \`/systems\`
- **주요 시스템**:
  - 전투 시스템
  - 인벤토리 시스템
  - 퀘스트 시스템
  - 랭킹 시스템

### 서비스 계층

#### 1. CacheService
- **역할**: 다층 캐싱 관리
- **레이어**:
  - user: 사용자 데이터 (1시간)
  - game: 게임 데이터 (5분)
  - temp: 임시 데이터 (1분)
  - api: API 응답 (30분)

#### 2. NotificationService
- **역할**: 실시간 알림 관리
- **기능**:
  - 구독 관리
  - 알림 큐잉
  - 배치 전송

#### 3. SchedulerService
- **역할**: 백그라운드 작업 관리
- **작업 예시**:
  - 날씨 업데이트 (30분)
  - 주식 가격 갱신 (5분)
  - 일일 리셋 (자정)
  - 자동 백업 (새벽 3시)

### 보안 계층

#### 1. InputValidator
- **역할**: 입력 검증 및 살균
- **검증 항목**:
  - SQL 인젝션
  - NoSQL 인젝션
  - XSS 공격
  - 경로 순회

#### 2. RateLimiter
- **역할**: 요청 제한
- **제한 단위**:
  - 명령어별
  - 사용자별
  - 길드별
  - IP별

#### 3. PermissionManager
- **역할**: 권한 관리
- **권한 레벨**:
  - Owner (100)
  - Admin (90)
  - Moderator (50)
  - VIP (20)
  - Verified (10)
  - User (1)
  - Guest (0)

## 데이터 모델

### User Model
\`\`\`javascript
{
  discordId: String (unique),
  username: String,
  nickname: String,
  level: Number,
  exp: Number,
  gold: Number,
  inventory: [{
    itemId: String,
    quantity: Number
  }],
  stats: {
    str: Number,
    dex: Number,
    int: Number,
    luk: Number
  },
  pvp: {
    rating: Number,
    wins: Number,
    losses: Number
  }
}
\`\`\`

### 관계도
\`\`\`
User ──────┬──── UserGameStats
           ├──── UserInventory
           ├──── UserEconomy
           └──── UserArtifacts
\`\`\`

## 성능 최적화

### 1. 캐싱 전략
- **읽기**: 캐시 우선, 미스 시 DB 조회
- **쓰기**: Write-through 캐싱
- **무효화**: TTL 기반 + 이벤트 기반

### 2. 데이터베이스 최적화
- **인덱싱**: 자주 사용되는 필드에 인덱스
- **집계**: 사전 계산된 통계 저장
- **샤딩**: 사용자 ID 기반 (향후)

### 3. 비동기 처리
- **큐잉**: 무거운 작업은 큐에 추가
- **배치**: 대량 작업은 배치로 처리
- **스트리밍**: 대용량 데이터는 스트림 사용

## 확장성

### 수평 확장
- **Stateless 설계**: 세션 정보를 Redis에 저장
- **로드 밸런싱**: 여러 봇 인스턴스 실행 가능
- **샤딩**: Discord 샤딩 매니저 지원

### 모듈화
- **플러그인 시스템**: 새 기능을 플러그인으로 추가
- **이벤트 기반**: 느슨한 결합
- **의존성 주입**: 테스트 용이성

## 모니터링

### 1. 헬스 체크
- **엔드포인트**: /health
- **체크 항목**:
  - Database 연결
  - Memory 사용량
  - CPU 사용량
  - Discord 연결

### 2. 메트릭
- **수집 항목**:
  - 명령어 실행 횟수
  - 응답 시간
  - 에러율
  - 활성 사용자 수

### 3. 로깅
- **레벨**: error, warn, info, debug
- **저장**: 파일 + 콘솔
- **로테이션**: 일별, 최대 30일
`;
        
        await fs.writeFile(path.join(this.docsDir, 'ARCHITECTURE.md'), archDoc);
        console.log('✅ ARCHITECTURE.md 생성 완료');
    }
    
    // 보안 문서 생성
    async generateSecurityDocs() {
        const securityDoc = `# 보안 가이드

## 보안 원칙

1. **최소 권한 원칙**: 필요한 최소한의 권한만 부여
2. **심층 방어**: 여러 계층의 보안 적용
3. **제로 트러스트**: 모든 입력을 신뢰하지 않음
4. **감사 추적**: 모든 중요 작업 로깅

## 입력 검증

### 검증 계층

1. **Discord.js 검증**: 기본 타입 검증
2. **InputValidator**: 패턴 및 내용 검증
3. **데이터베이스 검증**: 스키마 레벨 검증

### 검증 예시

\`\`\`javascript
// 사용자 입력 검증
const validation = inputValidator.validate(userInput, 'username');
if (!validation.valid) {
    throw new Error(validation.error);
}

// MongoDB 쿼리 살균
const safeQuery = inputValidator.sanitizeMongoQuery(userQuery);
\`\`\`

## Rate Limiting

### 제한 정책

| 타입 | 제한 | 시간창 |
|------|------|--------|
| 기본 명령어 | 10회 | 1분 |
| 사냥 | 5회 | 1분 |
| 일하기 | 3회 | 5분 |
| 일일 보상 | 1회 | 24시간 |
| 전역 (사용자) | 100회 | 1분 |
| 전역 (길드) | 1000회 | 1분 |

### 차단 정책

- 1차 위반: 1분 차단
- 2차 위반: 5분 차단
- 3차 위반: 1시간 차단
- 지속적 위반: 24시간 차단

## 권한 관리

### 역할 기반 접근 제어 (RBAC)

\`\`\`javascript
// 권한 확인
const hasPermission = await permissionManager.hasPermission(
    userId,
    'command.admin',
    guildId
);

// 명령어 권한 확인
const canExecute = await permissionManager.canExecuteCommand(
    userId,
    'ban',
    guildId
);
\`\`\`

### 권한 계층

1. **Owner**: 모든 권한 (*)
2. **Admin**: 관리 권한 (command.*, manage.*)
3. **Moderator**: 중재 권한 (command.ban, command.mute)
4. **VIP**: 특별 권한 (bypass.cooldown)
5. **Verified**: 거래 권한 (command.trade)
6. **User**: 기본 권한
7. **Guest**: 제한된 권한

## 데이터 암호화

### 암호화 대상

- 이메일 주소
- 개인 메시지
- API 키
- 세션 토큰

### 암호화 방식

- **알고리즘**: AES-256-GCM
- **키 유도**: PBKDF2 (100,000 iterations)
- **키 로테이션**: 90일

### 사용 예시

\`\`\`javascript
// 데이터 암호화
const encrypted = await encryptionService.encrypt(sensitiveData);

// 데이터 복호화
const decrypted = await encryptionService.decrypt(encrypted);

// 필드 단위 암호화
const user = await encryptionService.encryptFields(userData, ['email', 'phone']);
\`\`\`

## 보안 미들웨어

### 명령어 보안

\`\`\`javascript
// 보안 미들웨어 적용
const secureHunt = secureCommand({
    rateLimit: true,
    validateInput: true,
    checkPermission: true,
    validationRules: {
        area: 'itemName'
    }
});
\`\`\`

### API 보안

\`\`\`javascript
// API 미들웨어
app.use(secureAPI({
    rateLimit: true,
    requireAuth: true,
    validateBody: true,
    cors: true
}));
\`\`\`

## 감사 로깅

### 로깅 대상

- 로그인/로그아웃
- 권한 변경
- 데이터 접근
- 관리자 작업
- 보안 위반

### 로그 형식

\`\`\`json
{
  "id": "abc123",
  "timestamp": "2024-01-01T00:00:00Z",
  "eventType": "auth.login.success",
  "userId": "123456789",
  "ip": "192.168.1.0",
  "data": {},
  "hash": "sha256..."
}
\`\`\`

## 보안 체크리스트

### 개발 단계
- [ ] 입력 검증 구현
- [ ] 출력 이스케이핑
- [ ] 에러 메시지 살균
- [ ] 민감한 정보 마스킹

### 배포 전
- [ ] 환경 변수 설정
- [ ] HTTPS 활성화
- [ ] 디버그 모드 비활성화
- [ ] 로그 레벨 조정

### 운영 중
- [ ] 정기 보안 업데이트
- [ ] 로그 모니터링
- [ ] 이상 징후 감지
- [ ] 백업 확인

## 사고 대응

### 보안 사고 발생 시

1. **격리**: 영향받은 시스템 격리
2. **조사**: 로그 분석 및 원인 파악
3. **복구**: 백업에서 복원
4. **보고**: 관련자에게 통보
5. **개선**: 재발 방지 대책 수립

### 연락처

- 보안 문제 보고: security@kimhunter.bot
- 긴급 연락처: [긴급 연락처]

## 베스트 프랙티스

1. **비밀번호**: 강력한 비밀번호 사용, 정기 변경
2. **2FA**: 관리자 계정에 2FA 활성화
3. **최소 권한**: 필요한 권한만 부여
4. **정기 감사**: 월 1회 보안 감사
5. **교육**: 팀원 보안 교육
`;
        
        await fs.writeFile(path.join(this.docsDir, 'SECURITY.md'), securityDoc);
        console.log('✅ SECURITY.md 생성 완료');
    }
    
    // 배포 가이드 생성
    async generateDeploymentGuide() {
        const deployDoc = `# 배포 가이드

## 로컬 개발 환경

### 1. 사전 요구사항
- Node.js 16.0.0+
- MongoDB 4.4+
- Git

### 2. 설치
\`\`\`bash
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
\`\`\`

## 프로덕션 배포

### VPS/전용 서버 배포

#### 1. 서버 준비
\`\`\`bash
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
\`\`\`

#### 2. 봇 배포
\`\`\`bash
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
\`\`\`

#### 3. PM2 설정 (ecosystem.config.js)
\`\`\`javascript
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
\`\`\`

### Docker 배포

#### 1. Dockerfile
\`\`\`dockerfile
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
\`\`\`

#### 2. docker-compose.yml
\`\`\`yaml
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
\`\`\`

#### 3. Docker 실행
\`\`\`bash
# 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f bot

# 중지
docker-compose down
\`\`\`

### 클라우드 플랫폼 배포

#### Heroku
\`\`\`bash
# Heroku CLI 설치 후
heroku create kimhunter-bot
heroku addons:create mongolab:sandbox
heroku config:set TOKEN=your_token
git push heroku main
\`\`\`

#### Railway
1. GitHub 저장소 연결
2. 환경 변수 설정
3. MongoDB 플러그인 추가
4. 배포

#### Google Cloud Platform
\`\`\`bash
# App Engine 배포
gcloud app deploy

# Compute Engine 사용 시
# VPS 배포 가이드 참조
\`\`\`

## 모니터링 설정

### 1. 헬스 체크
\`\`\`nginx
# Nginx 리버스 프록시 설정
location /health {
    proxy_pass http://localhost:3000/health;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
\`\`\`

### 2. 로그 집계
\`\`\`bash
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
\`\`\`

### 3. 알림 설정
- PM2 웹 대시보드
- Discord 웹훅 알림
- 이메일 알림

## 백업 전략

### 1. 자동 백업
\`\`\`bash
# Cron 작업 추가
0 3 * * * cd /home/user/kimhunter-bot && npm run backup
\`\`\`

### 2. 원격 백업
\`\`\`bash
# S3 동기화
aws s3 sync ./backups s3://your-bucket/backups --delete
\`\`\`

## 업데이트 절차

### 1. 무중단 업데이트
\`\`\`bash
# 코드 업데이트
git pull origin main

# 의존성 업데이트
npm ci --production

# PM2 재시작
pm2 reload kimhunter-bot
\`\`\`

### 2. 메이저 업데이트
\`\`\`bash
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
\`\`\`

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
`;
        
        await fs.writeFile(path.join(this.docsDir, 'DEPLOYMENT.md'), deployDoc);
        console.log('✅ DEPLOYMENT.md 생성 완료');
    }
    
    // 개발자 가이드 생성
    async generateDeveloperGuide() {
        const devDoc = `# 개발자 가이드

## 개발 환경 설정

### 1. 필수 도구
- Visual Studio Code (권장 에디터)
- Node.js 16+
- MongoDB Compass (DB 관리)
- Postman (API 테스트)
- Git

### 2. VS Code 확장 프로그램
- ESLint
- Prettier
- MongoDB for VS Code
- GitLens
- Thunder Client

### 3. 개발 설정
\`\`\`json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript"],
  "prettier.requireConfig": true
}
\`\`\`

## 코드 스타일 가이드

### 네이밍 규칙
- **파일명**: camelCase (예: userController.js)
- **클래스**: PascalCase (예: UserService)
- **함수/변수**: camelCase (예: getUserById)
- **상수**: UPPER_SNAKE_CASE (예: MAX_LEVEL)

### 코드 구조
\`\`\`javascript
// 모듈 임포트 순서
// 1. Node.js 내장 모듈
const fs = require('fs');
const path = require('path');

// 2. 외부 라이브러리
const discord = require('discord.js');
const mongoose = require('mongoose');

// 3. 내부 모듈
const User = require('./models/User');
const logger = require('./services/Logger');

// 클래스 정의
class ExampleService {
    constructor() {
        // 초기화
    }
    
    // Public 메서드
    async publicMethod() {
        // 구현
    }
    
    // Private 메서드 (언더스코어 접두사)
    _privateMethod() {
        // 구현
    }
}

// 모듈 내보내기
module.exports = ExampleService;
\`\`\`

## 새 기능 추가하기

### 1. 새 명령어 추가
\`\`\`javascript
// commands/newCommand.js
const { SlashCommandBuilder } = require('discord.js');
const { secureCommand } = require('../security/SecurityMiddleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newcommand')
        .setDescription('새로운 명령어'),
    
    security: secureCommand({
        rateLimit: true,
        validateInput: true,
        checkPermission: true
    }),
    
    async execute(interaction) {
        // 명령어 로직
        await interaction.reply('Hello World!');
    }
};
\`\`\`

### 2. 새 모델 추가
\`\`\`javascript
// models/NewModel.js
const mongoose = require('mongoose');

const newSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    value: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 인덱스
newSchema.index({ name: 1 });

// 메서드
newSchema.methods.increment = function(amount) {
    this.value += amount;
    return this.save();
};

module.exports = mongoose.model('NewModel', newSchema);
\`\`\`

### 3. 새 서비스 추가
\`\`\`javascript
// services/NewService.js
const logger = require('./Logger');
const cacheService = require('./CacheService');

class NewService {
    constructor() {
        this.cache = cacheService;
    }
    
    async getData(id) {
        // 캐시 확인
        const cached = this.cache.get('new', id);
        if (cached) return cached;
        
        // DB 조회
        const data = await this.fetchFromDB(id);
        
        // 캐시 저장
        this.cache.set('new', id, data, 300);
        
        return data;
    }
}

module.exports = new NewService();
\`\`\`

## 테스트 작성

### 단위 테스트
\`\`\`javascript
// tests/unit/services/NewService.test.js
const NewService = require('../../../services/NewService');

describe('NewService', () => {
    describe('getData', () => {
        test('캐시에서 데이터 반환', async () => {
            const mockData = { id: 1, name: 'Test' };
            cacheService.get = jest.fn().mockReturnValue(mockData);
            
            const result = await NewService.getData(1);
            
            expect(result).toEqual(mockData);
            expect(cacheService.get).toHaveBeenCalledWith('new', 1);
        });
    });
});
\`\`\`

### 통합 테스트
\`\`\`javascript
// tests/integration/commands/newCommand.test.js
describe('New Command Integration', () => {
    test('명령어 실행', async () => {
        const interaction = createMockInteraction({
            command: 'newcommand'
        });
        
        await commands.newcommand.execute(interaction);
        
        expect(interaction.replied).toBe(true);
        expect(interaction.getLastReply().content).toBe('Hello World!');
    });
});
\`\`\`

## 디버깅

### 로그 레벨
\`\`\`javascript
// 개발 환경에서 상세 로그
LOG_LEVEL=debug

// 로그 사용
logger.debug('상세 디버그 정보', { data });
logger.info('일반 정보');
logger.warn('경고');
logger.error('에러', { error });
\`\`\`

### 디버거 사용
\`\`\`json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Bot",
      "skipFiles": ["<node_internals>/**"],
      "program": "\${workspaceFolder}/index.js",
      "envFile": "\${workspaceFolder}/.env"
    }
  ]
}
\`\`\`

## 성능 최적화

### 1. 캐싱 활용
\`\`\`javascript
// 자주 조회되는 데이터 캐싱
const userData = await cacheService.getOrSet(
    'user',
    userId,
    () => User.findOne({ discordId: userId }),
    3600 // 1시간
);
\`\`\`

### 2. 데이터베이스 쿼리 최적화
\`\`\`javascript
// 나쁨: N+1 쿼리
const users = await User.find();
for (const user of users) {
    const items = await Item.find({ userId: user._id });
}

// 좋음: 조인 사용
const users = await User.aggregate([
    { $lookup: {
        from: 'items',
        localField: '_id',
        foreignField: 'userId',
        as: 'items'
    }}
]);
\`\`\`

### 3. 비동기 처리
\`\`\`javascript
// 나쁨: 순차 처리
const user = await User.findById(id);
const items = await Item.find({ userId: id });
const stats = await Stats.findOne({ userId: id });

// 좋음: 병렬 처리
const [user, items, stats] = await Promise.all([
    User.findById(id),
    Item.find({ userId: id }),
    Stats.findOne({ userId: id })
]);
\`\`\`

## Git 워크플로우

### 브랜치 전략
- \`main\`: 프로덕션 브랜치
- \`develop\`: 개발 브랜치
- \`feature/*\`: 기능 개발
- \`bugfix/*\`: 버그 수정
- \`hotfix/*\`: 긴급 수정

### 커밋 메시지
\`\`\`
<type>: <subject>

<body>

<footer>
\`\`\`

**Type:**
- feat: 새 기능
- fix: 버그 수정
- docs: 문서 수정
- style: 코드 포맷팅
- refactor: 리팩토링
- test: 테스트 추가
- chore: 빌드, 설정 수정

**예시:**
\`\`\`
feat: 거래 시스템 구현

- 아이템 거래 기능 추가
- 거래 내역 저장
- 거래 수수료 적용

Closes #123
\`\`\`

## 문제 해결 체크리스트

### 개발 중 일반적인 문제

1. **모듈을 찾을 수 없음**
   - 경로 확인
   - npm install 실행
   - require 구문 확인

2. **비동기 에러**
   - async/await 사용
   - Promise 체인 확인
   - 에러 핸들링 추가

3. **메모리 누수**
   - 이벤트 리스너 정리
   - 타이머 정리
   - 큰 객체 참조 해제

## 유용한 스니펫

### 에러 핸들링
\`\`\`javascript
try {
    // 위험한 작업
} catch (error) {
    logger.error('작업 실패', {
        error: error.message,
        stack: error.stack,
        context: { /* 추가 정보 */ }
    });
    
    // 사용자에게 친화적인 메시지
    await interaction.reply({
        content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        ephemeral: true
    });
}
\`\`\`

### 트랜잭션 처리
\`\`\`javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
    // 여러 DB 작업
    await User.updateOne({ _id: userId }, update, { session });
    await Item.create([newItem], { session });
    
    await session.commitTransaction();
} catch (error) {
    await session.abortTransaction();
    throw error;
} finally {
    session.endSession();
}
\`\`\`

## 리소스

- [Discord.js 가이드](https://discordjs.guide/)
- [Mongoose 문서](https://mongoosejs.com/docs/)
- [Node.js 베스트 프랙티스](https://github.com/goldbergyoni/nodebestpractices)
- [JavaScript 스타일 가이드](https://github.com/airbnb/javascript)
`;
        
        await fs.writeFile(path.join(this.docsDir, 'DEVELOPER.md'), devDoc);
        console.log('✅ DEVELOPER.md 생성 완료');
    }
}

// 문서 생성 실행
if (require.main === module) {
    const generator = new DocumentationGenerator();
    generator.generate().catch(console.error);
}

module.exports = DocumentationGenerator;