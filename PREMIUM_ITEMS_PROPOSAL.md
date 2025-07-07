# 김헌터 프리미엄 소모품 시스템 제안

## 📊 레벨 시스템 재설계 (300레벨 기준)

### 경험치 곡선 설계
```javascript
const getExpRequired = (level) => {
    if (level <= 50) return level * 100;              // 초반: 빠른 성장
    if (level <= 100) return level * 200;             // 중반: 적당한 속도
    if (level <= 200) return level * 400 + (level - 100) * 100;  // 후반: 느린 성장
    return level * 800 + (level - 200) * 200;         // 최후반: 매우 느림
};

// 예시
// Lv.50: 5,000 EXP
// Lv.100: 20,000 EXP  
// Lv.200: 90,000 EXP
// Lv.300: 220,000 EXP
```

### 레벨대별 컨텐츠 배치
- **1-50**: 튜토리얼 구간 (기본 시스템 학습)
- **51-100**: 초보 구간 (모든 컨텐츠 해금)
- **101-200**: 중수 구간 (고급 컨텐츠)
- **201-300**: 고수 구간 (엔드게임)

## 💎 프리미엄 소모품 시스템

### 1. 경험치 부스터
```javascript
const EXP_BOOSTERS = {
    // 소형 경험치 부스터
    small: {
        name: "축복의 물약",
        cost: 10000,
        duration: 30, // 30분
        bonus: 1.5,   // 50% 추가
        stackable: false
    },
    // 중형 경험치 부스터
    medium: {
        name: "현자의 비약",
        cost: 50000,
        duration: 60, // 1시간
        bonus: 2.0,   // 100% 추가
        stackable: false
    },
    // 대형 경험치 부스터
    large: {
        name: "깨달음의 정수",
        cost: 200000,
        duration: 120, // 2시간
        bonus: 3.0,    // 200% 추가
        stackable: false
    },
    // 프리미엄 경험치 부스터
    premium: {
        name: "신의 축복",
        cost: 1000000,
        duration: 1440, // 24시간
        bonus: 2.0,     // 100% 추가
        stackable: true // 다른 부스터와 중첩 가능
    }
};
```

### 2. 드롭률 증가 아이템
```javascript
const DROP_BOOSTERS = {
    // 행운의 부적
    luckCharm: {
        name: "행운의 부적",
        cost: 30000,
        duration: 60,     // 1시간
        dropBonus: 1.5,   // 드롭률 50% 증가
        rareBonus: 1.2    // 레어 드롭 20% 증가
    },
    // 황금 나침반
    goldenCompass: {
        name: "황금 나침반",
        cost: 100000,
        duration: 120,    // 2시간
        dropBonus: 2.0,   // 드롭률 100% 증가
        rareBonus: 1.5,   // 레어 드롭 50% 증가
        goldBonus: 1.3    // 골드 드롭 30% 증가
    },
    // 보물 사냥꾼의 가호
    treasureHunter: {
        name: "보물 사냥꾼의 가호",
        cost: 500000,
        duration: 360,    // 6시간
        dropBonus: 2.5,   // 드롭률 150% 증가
        rareBonus: 2.0,   // 레어 드롭 100% 증가
        goldBonus: 1.5,   // 골드 드롭 50% 증가
        uniqueBonus: 1.1  // 유니크 드롭 10% 증가
    }
};
```

### 3. 전투 강화 아이템
```javascript
const COMBAT_BOOSTERS = {
    // 힘의 물약
    powerPotion: {
        name: "힘의 물약",
        cost: 20000,
        duration: 30,
        effects: {
            attackPower: 1.3,  // 공격력 30% 증가
            critRate: 1.2      // 치명타율 20% 증가
        }
    },
    // 광전사의 분노
    berserkerRage: {
        name: "광전사의 분노",
        cost: 80000,
        duration: 60,
        effects: {
            attackPower: 1.5,  // 공격력 50% 증가
            attackSpeed: 1.3,  // 공격속도 30% 증가
            defense: 0.8       // 방어력 20% 감소 (패널티)
        }
    },
    // 불사조의 가호
    phoenixBlessing: {
        name: "불사조의 가호",
        cost: 300000,
        duration: 120,
        effects: {
            attackPower: 1.4,
            defense: 1.4,
            resurrection: 1    // 사망 시 1회 부활
        }
    }
};
```

### 4. 특수 기능 아이템
```javascript
const SPECIAL_ITEMS = {
    // 순간이동 주문서
    teleportScroll: {
        name: "순간이동 주문서",
        cost: 5000,
        uses: 1,
        effect: "원하는 사냥터로 즉시 이동"
    },
    // 시간의 모래시계
    timeSand: {
        name: "시간의 모래시계",
        cost: 100000,
        uses: 1,
        effect: "모든 쿨다운 초기화"
    },
    // 기억의 수정구
    memoryCrystal: {
        name: "기억의 수정구",
        cost: 200000,
        uses: 1,
        effect: "스탯 포인트 전체 초기화"
    },
    // 도전자의 티켓
    challengerTicket: {
        name: "도전자의 티켓",
        cost: 50000,
        uses: 1,
        effect: "보스/던전 입장권 추가"
    },
    // 자동사냥 이용권
    autoHuntPass: {
        name: "자동사냥 이용권",
        cost: 500000,
        duration: 360,  // 6시간
        effect: "오프라인 자동사냥 (50% 효율)"
    }
};
```

### 5. 강화 보조 아이템
```javascript
const ENHANCEMENT_ITEMS = {
    // 보호의 주문서
    protectionScroll: {
        name: "보호의 주문서",
        cost: 100000,
        effect: "강화 실패 시 아이템 파괴 방지",
        applicableLevel: "모든 레벨"
    },
    // 축복의 주문서
    blessingScroll: {
        name: "축복의 주문서", 
        cost: 300000,
        effect: "강화 성공률 2배",
        applicableLevel: "30강 이하"
    },
    // 기적의 주문서
    miracleScroll: {
        name: "기적의 주문서",
        cost: 1000000,
        effect: "강화 성공률 3배",
        applicableLevel: "50강 이하"
    },
    // 복구의 주문서
    restorationScroll: {
        name: "복구의 주문서",
        cost: 2000000,
        effect: "파괴된 아이템 복구 (강화 수치 -5)",
        uses: 1
    },
    // 초월의 돌
    transcendentStone: {
        name: "초월의 돌",
        cost: 5000000,
        effect: "100강 이상 강화 시 필수 재료",
        consumed: true
    }
};
```

## 🎯 소모품 획득 방법

### 1. 상점 구매 (골드)
- 기본 소모품은 상점에서 골드로 구매 가능
- 일일 구매 제한 존재

### 2. 이벤트 보상
- 시즌 보상
- 출석 체크 보상
- 특별 이벤트

### 3. 보스 드롭
- 고레벨 보스에서 낮은 확률로 드롭
- 주간 보스는 확정 드롭

### 4. 제작 시스템
```javascript
const CRAFTING_RECIPES = {
    // 하급 -> 중급 합성
    mediumExpBooster: {
        materials: [
            { item: "small_exp_booster", count: 5 },
            { item: "gold", count: 20000 }
        ],
        result: "medium_exp_booster",
        successRate: 0.8
    },
    // 특수 제작
    autoHuntPass: {
        materials: [
            { item: "boss_essence", count: 10 },
            { item: "rare_crystal", count: 5 },
            { item: "gold", count: 300000 }
        ],
        result: "auto_hunt_pass",
        successRate: 0.6
    }
};
```

## 💰 예상 골드 싱크 효과

### 일일 평균 소비 예상
- **라이트 유저**: 50,000 ~ 100,000 골드
- **일반 유저**: 200,000 ~ 500,000 골드  
- **헤비 유저**: 1,000,000 ~ 3,000,000 골드

### 경제 안정화 효과
- 전체 골드 유통량 30-40% 감소 예상
- 고레벨 유저의 골드 축적 방지
- 신규-기존 유저 간 격차 완화

## 📱 UI/UX 제안

### 소모품 인벤토리
- 별도의 소모품 전용 인벤토리
- 자동 사용 설정 기능
- 남은 시간 실시간 표시

### 버프 상태창
- 현재 적용 중인 버프 목록
- 남은 시간 표시
- 중첩 가능 여부 표시

이러한 프리미엄 소모품 시스템은 골드 소비를 촉진하면서도 Pay-to-Win이 아닌 Time-to-Win 구조를 유지하여 게임의 건전성을 지킬 수 있습니다.