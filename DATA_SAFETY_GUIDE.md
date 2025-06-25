# 🛡️ 데이터 무손실 버전업 가이드

## 📋 문제점 해결

### 이전 문제
- 봇이 시작할 때마다 모든 유저의 장비가 초기화됨
- `cleanupEquipmentData()` 함수가 매번 실행되어 데이터 손실 발생

### 해결 방법
- 마이그레이션 시스템 도입
- 각 데이터 변경사항을 한 번만 실행
- 실행 이력을 `migration-history.json`에 기록

## 🔧 마이그레이션 시스템

### 구조
```
database/
├── migrations.js         # 마이그레이션 시스템 코어
├── migrationList.js      # 마이그레이션 목록
└── connection.js         # DB 연결

migration-history.json    # 실행 이력 추적
```

### 작동 방식
1. 봇 시작 시 마이그레이션 체크
2. 이미 실행된 마이그레이션은 건너뜀
3. 새로운 마이그레이션만 실행
4. 실행 이력 저장

## 📝 현재 마이그레이션

### 1. `cleanup_equipment_objectid_2024_06_20`
- ObjectId 타입의 장비 데이터만 정리
- 정상적인 장비 데이터는 유지

### 2. `fix_artifact_data_types_2024_06_21`
- 잘못된 유물 데이터 타입 수정
- 배열이 아닌 경우 빈 배열로 초기화

### 3. `add_multiplayer_fields_2024_06_26`
- 멀티플레이 통계 필드 추가
- 업적 필드 추가

## 🚀 새 마이그레이션 추가 방법

1. `database/migrationList.js`에 새 마이그레이션 추가:
```javascript
'migration_name_YYYY_MM_DD': async () => {
    // 데이터 변경 로직
    const result = await User.updateMany(...);
    console.log(`변경된 데이터: ${result.modifiedCount}개`);
    return result;
}
```

2. 봇 재시작 시 자동 실행

## ⚠️ 주의사항

### DO:
- ✅ 조건부 업데이트 사용 (`$or`, `$exists`)
- ✅ 변경 대상을 명확히 지정
- ✅ 실행 결과 로깅
- ✅ 백업 후 실행

### DON'T:
- ❌ 무조건적인 전체 업데이트
- ❌ 데이터 삭제 작업
- ❌ 되돌릴 수 없는 변경

## 🔄 롤백 방법

1. 마이그레이션 이력 초기화:
```javascript
const { resetMigrations } = require('./database/migrations');
resetMigrations();
```

2. 데이터베이스 백업에서 복원

## 📊 모니터링

- 마이그레이션 실행 시 로그 확인
- `migration-history.json` 파일 확인
- 변경된 데이터 수 확인

## 🎯 베스트 프랙티스

1. **테스트 먼저**: 테스트 서버에서 먼저 실행
2. **백업 필수**: 실행 전 데이터베이스 백업
3. **점진적 적용**: 큰 변경은 여러 마이그레이션으로 분할
4. **명확한 네이밍**: `작업내용_날짜` 형식 사용
5. **문서화**: 각 마이그레이션의 목적과 영향 기록

---

이제 봇을 재시작해도 유저 데이터가 초기화되지 않습니다! 🎉