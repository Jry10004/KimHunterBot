# API 문서

## 서비스 API

### CacheService

캐시 관리 서비스

#### 메서드

##### set(layer, key, value, ttl)
데이터를 캐시에 저장

**파라미터:**
- `layer` (string): 캐시 레이어 (user, game, temp, api)
- `key` (string): 캐시 키
- `value` (any): 저장할 값
- `ttl` (number): Time To Live (초)

**예시:**
```javascript
cacheService.set('user', 'user:123', userData, 3600);
```

##### get(layer, key)
캐시에서 데이터 조회

**파라미터:**
- `layer` (string): 캐시 레이어
- `key` (string): 캐시 키

**반환값:** 캐시된 값 또는 null

### DatabaseOptimizer

데이터베이스 최적화 서비스

#### 메서드

##### analyzeIndexes()
인덱스 분석 및 추천

**반환값:**
```javascript
{
  User: {
    existing: [...],
    suggested: [...],
    unused: [...]
  }
}
```

##### ensureSave(document, maxRetries)
안전한 문서 저장 (재시도 포함)

**파라미터:**
- `document` (Document): Mongoose 문서
- `maxRetries` (number): 최대 재시도 횟수

### NotificationService

실시간 알림 서비스

#### 메서드

##### subscribe(userId, notificationType, settings)
알림 구독

**파라미터:**
- `userId` (string): 사용자 ID
- `notificationType` (string): 알림 타입
- `settings` (object): 알림 설정

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
```javascript
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
```

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
```javascript
{
  allowed: boolean,
  reason: string,
  retryAfter: number,
  message: string
}
```

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
