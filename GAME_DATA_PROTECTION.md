# 🛡️ 게임 데이터 보호 시스템 종합 가이드

## 📋 개요

모든 게임 내 기록은 **절대 초기화되지 않도록** 다층 보호 시스템이 구축되었습니다.

## 🔐 보호 시스템 구성

### 1. **마이그레이션 시스템** (`database/migrations.js`)
- 일회성 데이터 변경만 수행
- 실행 이력 추적 (`migration-history.json`)
- 중복 실행 방지

### 2. **데이터 보호 시스템** (`database/dataProtection.js`)
- 자동 백업 (매일 새벽 3시)
- 중요 데이터 변경 시 즉시 백업
- 보호된 필드 정의
- 데이터 무결성 검증

### 3. **리셋 관리자** (`database/resetManager.js`)
- 중앙화된 리셋 처리
- 허용된 필드만 리셋
- 리셋 전 자동 백업

## 🚫 절대 초기화되지 않는 데이터

### 핵심 데이터
- ✅ 레벨, 경험치, 골드
- ✅ 스탯 포인트 및 스탯
- ✅ 인기도

### 장비 & 아이템
- ✅ 장비 슬롯
- ✅ 인벤토리
- ✅ 강화석
- ✅ 유물

### 전투 & 사냥
- ✅ 사냥 티켓
- ✅ PvP 티켓
- ✅ 보스 진행도

### 업적 & 기록
- ✅ 업적
- ✅ 칭호
- ✅ 멀티플레이 통계

### 경제 활동
- ✅ 주식 포트폴리오
- ✅ 경매 기록
- ✅ 거래 기록

### 소셜
- ✅ 친구 목록
- ✅ 차단 목록
- ✅ 길드 정보
- ✅ 결혼 정보

### 퀘스트
- ✅ 완료된 퀘스트
- ✅ 퀘스트 진행도
- ✅ 메인 퀘스트 단계

## ✔️ 리셋이 허용되는 데이터

### 일일 리셋 (매일 자정)
- ⏰ 일일 미션
- ⏰ 일일 출석
- ⏰ 일일 인기도 변화량
- ⏰ 일일 융합 횟수
- ⏰ 피트니스 일일 목표

### 주간 리셋 (매주 일요일)
- 📅 주간 출석
- 📅  주간 퀘스트
- 📅  피트니스 주간 목표

## 🔧 구현 세부사항

### 1. **자동 백업**
```javascript
// 매일 새벽 3시 자동 백업
scheduleAutoBackup();

// 중요 데이터 변경 시 즉시 백업
if (isModified('level') || isModified('gold')) {
    await backupUserData(userId);
}
```

### 2. **데이터 검증**
```javascript
// 저장 전 데이터 무결성 검사
await validateUserData(userId);
```

### 3. **안전한 업데이트**
```javascript
// 보호된 필드 체크 후 업데이트
await safeUpdateUser(userId, updateData);
```

## 📁 백업 구조

```
backups/
└── users/
    ├── user_424480594542592009_2024-06-26T03-00-00-000Z.json
    ├── user_295980447849250817_2024-06-26T03-00-00-000Z.json
    └── ...
```

## 🚨 데이터 복구

데이터 손실 시 복구 절차:

1. **백업 파일 확인**
   ```bash
   ls backups/users/user_[userId]_*.json
   ```

2. **데이터 복구**
   ```javascript
   await restoreUserData(userId, backupPath);
   ```

3. **무결성 검증**
   ```javascript
   await validateUserData(userId);
   ```

## ⚠️ 주의사항

### DO NOT:
- ❌ `User.updateMany({}, {...})` - 전체 유저 업데이트 금지
- ❌ 보호된 필드 직접 수정 금지
- ❌ 백업 없이 대량 데이터 변경 금지

### DO:
- ✅ 리셋 매니저 사용
- ✅ 마이그레이션 시스템 사용
- ✅ 변경 전 백업 수행

## 📊 모니터링

### 로그 확인
```bash
# 백업 로그
grep "백업" production.log

# 리셋 로그
grep "리셋" production.log

# 데이터 검증 로그
grep "검증" production.log
```

### 상태 확인
```javascript
// 리셋 필요 유저 확인
const status = await checkAllUsersResetStatus();
console.log(`일일 리셋 필요: ${status.needDailyReset}명`);
console.log(`주간 리셋 필요: ${status.needWeeklyReset}명`);
```

## 🎯 결론

이 시스템으로 인해:
1. **모든 중요 게임 데이터는 영구 보존**
2. **일일/주간 기능만 계획된 리셋**
3. **모든 변경사항은 백업 후 수행**
4. **데이터 손실 시 즉시 복구 가능**

플레이어의 노력과 시간이 절대 사라지지 않습니다! 🎮✨