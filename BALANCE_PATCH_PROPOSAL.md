# 김헌터 게임 밸런스 패치 제안서

## 📊 핵심 지표 설정

### 레벨 시스템 개편
- **만렙 설정**: 100레벨 (현재: 무제한 → 변경: 100)
- **목표 플레이타임**: 
  - 캐주얼 유저: 3개월 (일일 2시간)
  - 하드코어 유저: 1개월 (일일 8시간)

### 경험치 곡선 조정
```javascript
// 현재 경험치 공식
const expRequired = level * 100;

// 권장 경험치 공식
const getExpRequired = (level) => {
    if (level <= 30) return level * 100;
    if (level <= 70) return level * 150;
    return level * 200 + (level - 70) * 50;
};
```

## 🎯 즉시 적용 필요 항목

### 1. PVP 보상 시스템 대개편

#### 현재 문제점
- 보상 범위: 100 ~ 100,000 골드 (1,000배 차이)
- 완전 랜덤으로 경제 파괴 위험

#### 개선안
```javascript
// 현재
const reward = Math.floor(Math.random() * (100000 - 100 + 1)) + 100;

// 변경 후
const calculatePvpReward = (winnerRating, loserRating) => {
    const baseReward = (winnerRating + loserRating) * 5;
    const variance = baseReward * 0.2;
    const finalReward = baseReward + (Math.random() - 0.5) * variance * 2;
    return Math.floor(Math.max(1000, Math.min(50000, finalReward)));
};
```

### 2. 보스 보상 재조정

| 보스 | 레벨 | 현재 골드 | 변경 골드 | 현재 EXP | 변경 EXP |
|------|------|-----------|-----------|----------|----------|
| 고블린 족장 | 20 | 20,000 | 20,000 ✓ | 10,000 | 10,000 ✓ |
| 거대 거미 여왕 | 30 | 100,000 | 60,000 ↓ | 50,000 | 40,000 ↓ |
| 그림자 암살자 | 50 | 500,000 | 150,000 ↓ | 200,000 | 100,000 ↓ |
| 서리 거인 | 70 | 350,000 | 250,000 ↓ | 150,000 | 180,000 ↑ |
| 아카트리엘 | 80 | 450,000 | 350,000 ↓ | 250,000 | 250,000 ✓ |
| 데몬 로드 | 100 | 600,000 | 500,000 ↓ | 300,000 | 400,000 ↑ |

### 3. 사냥터 효율 조정

#### 크리스탈 동굴 (45-70레벨)
```javascript
// 현재
gold: { min: 150, max: 300 },  // 평균 225
special: { min: 500, max: 1500 } // 평균 1000

// 변경 후  
gold: { min: 100, max: 200 },  // 평균 150 (33% 감소)
special: { min: 350, max: 1000 } // 평균 675 (32.5% 감소)

// 대신 아이템 드롭률 상향
dropRate: 0.15 → 0.25 (66% 증가)
```

## 📈 중장기 개선 계획

### 1. 일일 제한 시스템

```javascript
const DAILY_LIMITS = {
    hunting: {
        kills: 300,        // 사냥 제한
        bonusExp: 1.5,     // 제한 내 경험치 보너스
        afterLimit: 0.3    // 제한 후 효율
    },
    pvp: {
        matches: 50,       // PVP 제한
        rewardMatches: 30, // 보상 획득 가능 경기
        ratingOnly: true   // 이후 레이팅만 변동
    },
    boss: {
        attempts: 3,       // 보스별 일일 도전
        weeklyBonus: 2     // 주간 추가 도전권
    }
};
```

### 2. 골드 싱크 추가

#### 고급 강화 시스템
```javascript
const ADVANCED_ENHANCEMENT = {
    // 100강 이후 초월 강화
    transcendent: {
        101: { cost: 1000000, successRate: 0.1 },
        102: { cost: 2000000, successRate: 0.08 },
        103: { cost: 4000000, successRate: 0.05 },
        // ... 최대 110강
    },
    // 강화 보조 아이템
    protectionScroll: 500000,    // 파괴 방지
    blessingScroll: 1000000,     // 성공률 2배
    restorationScroll: 2000000   // 파괴 복구
};
```

#### 길드 시스템
```javascript
const GUILD_COSTS = {
    creation: 10000000,           // 길드 생성
    upgrade: {
        level2: 5000000,
        level3: 20000000,
        level4: 50000000,
        level5: 100000000
    },
    weekly: {
        maintenance: 1000000,     // 주간 유지비
        buff: 500000             // 길드 버프
    }
};
```

### 3. 시즌제 도입

```javascript
const SEASON_SYSTEM = {
    duration: 90,                 // 90일 시즌
    rewards: {
        participation: 100000,    // 참가 보상
        top100: 1000000,         // 상위 100명
        top10: 5000000,          // 상위 10명
        top1: 20000000           // 1위
    },
    reset: {
        level: false,            // 레벨 유지
        items: false,            // 아이템 유지
        currency: 0.5,           // 골드 50% 유지
        rating: true             // 레이팅 리셋
    }
};
```

## 📊 예상 효과

### 경제 안정화
- PVP 골드 생성량: -70% 감소
- 보스 골드 생성량: -40% 감소
- 전체 인플레이션율: -55% 감소

### 플레이 시간 정상화
- 만렙 도달 시간: 평균 180시간 (현재 추정 400시간)
- 일일 플레이 권장: 2-3시간
- 컨텐츠 소진 방지: 시즌제로 해결

### 신규 유저 경험 개선
- 초반 성장 속도: 유지
- 중반 진입 장벽: -30% 완화
- 격차 해소: 일일 제한으로 완화

## 🚀 구현 우선순위

### Phase 1 (즉시)
1. PVP 보상 공식 변경
2. 보스 보상 조정
3. 크리스탈 동굴 너프

### Phase 2 (1주일 내)
1. 만렙 제한 설정
2. 경험치 곡선 조정
3. 일일 제한 시스템

### Phase 3 (1개월 내)
1. 고급 강화 시스템
2. 길드 시스템 베타
3. 시즌 1 준비

이 밸런스 패치를 통해 김헌터는 더욱 공정하고 지속가능한 게임 경제를 구축할 수 있을 것입니다.