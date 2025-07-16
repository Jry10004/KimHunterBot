# 아이템 밸런스 개선 제안

## 문제점
현재 쓰레기(trash) 등급 아이템이 높은 옵션 수치를 가질 수 있어 점수가 75점까지 나오는 문제가 있습니다.

## 개선 방안

### 1. 등급별 스탯 제한 시스템

#### 쓰레기 (Trash) - 점수 범위: 1-10점
```javascript
trash: {
    attack: { min: 1, max: 3 },
    defense: { min: 1, max: 3 },
    strength: { min: 1, max: 2 },
    agility: { min: 1, max: 2 },
    intelligence: { min: 1, max: 2 },
    vitality: { min: 1, max: 2 },
    luck: { min: 1, max: 2 },
    hp: { min: 5, max: 10 },
    dodge: { min: 1, max: 2 }
}
```

#### 일반 (Normal) - 점수 범위: 11-25점
```javascript
normal: {
    attack: { min: 3, max: 10 },
    defense: { min: 3, max: 8 },
    strength: { min: 2, max: 5 },
    agility: { min: 2, max: 5 },
    intelligence: { min: 2, max: 5 },
    vitality: { min: 2, max: 5 },
    luck: { min: 2, max: 4 },
    hp: { min: 10, max: 30 },
    dodge: { min: 1, max: 3 }
}
```

### 2. 옵션 개수 제한

- **쓰레기**: 1개 옵션만 (현재 구현됨)
- **일반**: 1-2개 옵션
- **레어**: 2-3개 옵션
- **에픽**: 3-4개 옵션
- **유니크**: 4-5개 옵션
- **전설**: 5-6개 옵션

### 3. 점수 계산 개선

현재 점수 계산 방식을 개선하여 등급별 최대 점수를 제한:

```javascript
// 등급별 점수 배율
const scoreMultipliers = {
    trash: 0.1,      // 최대 10점
    normal: 0.25,    // 최대 25점
    rare: 0.5,       // 최대 50점
    epic: 0.7,       // 최대 70점
    unique: 0.85,    // 최대 85점
    legendary: 1.0   // 최대 100점
};

// 점수 계산
const baseScore = calculateBaseScore(stats);
const finalScore = Math.min(
    baseScore * scoreMultipliers[rarity],
    maxScoreByRarity[rarity]
);
```

### 4. 이름 등급과 실제 등급 연동

이름의 등급(prefix, adjective, itemName)이 모두 쓰레기인 경우, 스탯도 쓰레기 등급으로 제한:

```javascript
// 이름 등급 평균이 쓰레기면 스탯도 쓰레기로 제한
if (nameRarities.every(r => r === 'trash')) {
    // 강제로 쓰레기 스탯 범위 적용
    forceTrashStats = true;
}
```

### 5. 특별 쓰레기 아이템 시스템

역설적으로 재미있는 "레전더리 쓰레기" 개념 도입:
- "전설의 썩은 나무 막대기" - 점수는 낮지만 특수 효과 보유
- 예: 1% 확률로 적을 즉사시키는 "악취" 효과

### 6. 등급별 시각적 구분 강화

```javascript
const rarityVisuals = {
    trash: {
        color: '#8B4513',    // 갈색
        emoji: '💩',
        prefix: '[쓰레기]',
        maxScore: 10
    },
    normal: {
        color: '#95a5a6',    // 회색
        emoji: '⚪',
        prefix: '[일반]',
        maxScore: 25
    },
    // ... 등
};
```

## 구현 우선순위

1. **즉시 수정**: trash 등급 스탯 범위 추가 및 제한
2. **단기 개선**: 점수 계산 방식 개선
3. **장기 개선**: 특별 시스템 및 시각적 개선

이렇게 하면 쓰레기 등급은 진짜 "쓰레기"가 되어 1-10점 범위에만 머물게 됩니다.