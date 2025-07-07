# 보안 가이드

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

```javascript
// 사용자 입력 검증
const validation = inputValidator.validate(userInput, 'username');
if (!validation.valid) {
    throw new Error(validation.error);
}

// MongoDB 쿼리 살균
const safeQuery = inputValidator.sanitizeMongoQuery(userQuery);
```

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

```javascript
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
```

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

```javascript
// 데이터 암호화
const encrypted = await encryptionService.encrypt(sensitiveData);

// 데이터 복호화
const decrypted = await encryptionService.decrypt(encrypted);

// 필드 단위 암호화
const user = await encryptionService.encryptFields(userData, ['email', 'phone']);
```

## 보안 미들웨어

### 명령어 보안

```javascript
// 보안 미들웨어 적용
const secureHunt = secureCommand({
    rateLimit: true,
    validateInput: true,
    checkPermission: true,
    validationRules: {
        area: 'itemName'
    }
});
```

### API 보안

```javascript
// API 미들웨어
app.use(secureAPI({
    rateLimit: true,
    requireAuth: true,
    validateBody: true,
    cors: true
}));
```

## 감사 로깅

### 로깅 대상

- 로그인/로그아웃
- 권한 변경
- 데이터 접근
- 관리자 작업
- 보안 위반

### 로그 형식

```json
{
  "id": "abc123",
  "timestamp": "2024-01-01T00:00:00Z",
  "eventType": "auth.login.success",
  "userId": "123456789",
  "ip": "192.168.1.0",
  "data": {},
  "hash": "sha256..."
}
```

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
