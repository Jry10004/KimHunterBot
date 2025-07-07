# 설정 가이드

## 환경 변수 설정

### 필수 환경 변수

```env
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
```

### 선택 환경 변수

```env
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
```

## 게임 설정

### 레벨 시스템

```javascript
// config/gameConfig.js
module.exports = {
    leveling: {
        baseExp: 100,
        expMultiplier: 1.2,
        maxLevel: 100
    }
};
```

### 경제 시스템

```javascript
module.exports = {
    economy: {
        workReward: { min: 50, max: 200 },
        workCooldown: 1800000, // 30분
        dailyReward: 1000,
        tradeTax: 0.05 // 5%
    }
};
```

### PVP 설정

```javascript
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
```

## 보안 설정

### Rate Limiting

```javascript
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
```

### 권한 설정

```javascript
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
```

## 데이터베이스 설정

### 인덱스 최적화

```javascript
// models/User.js
userSchema.index({ discordId: 1 }, { unique: true });
userSchema.index({ level: -1, exp: -1 }); // 랭킹용
userSchema.index({ 'pvp.rating': -1 }); // PVP 랭킹용
userSchema.index({ createdAt: 1 }); // 시간 기반 쿼리용
```

### 연결 풀 설정

```javascript
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
```

## 캐시 설정

### 레이어별 TTL

```javascript
// services/CacheService.js
const defaultTTL = {
    user: 3600,    // 1시간
    game: 300,     // 5분
    temp: 60,      // 1분
    api: 1800      // 30분
};
```

## 백업 설정

### 자동 백업

```javascript
// systems/enhancedBackupSystem.js
config: {
    maxBackups: 30,
    compressionLevel: 9,
    incrementalEnabled: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24시간
    retentionDays: 30
}
```

## 모니터링 설정

### 헬스 체크

```javascript
// services/HealthCheck.js
// 헬스 체크 엔드포인트: /health
// 상세 정보: /health?verbose=true
```

### 메트릭 수집

```javascript
// services/MetricsCollector.js
config: {
    systemMetricsInterval: 30000, // 30초
    aggregationInterval: 300000,   // 5분
    retentionPeriod: 86400000     // 24시간
}
```
