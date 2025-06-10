// 드롭 아이템 데이터
const DROP_ITEMS = {
    // 꽃잎 마을 근처 드롭템
    "방울방울 슬라임": [
        { type: "scroll", name: "슬라임 젤리 주문서", rarity: "일반", dropRate: 1.2, effect: "무기에 회피력 +1~3", price: [500, 2500] },
        { type: "currency", name: "슬라임 코어", rarity: "일반", dropRate: 4.0, effect: "연금술 재료", price: [50, 800] }
    ],
    "토실토실 토끼": [
        { type: "scroll", name: "토끼발 행운 주문서", rarity: "고급", dropRate: 0.8, effect: "모든 장비에 행운 +1~2", price: [1000, 5000] }
    ],
    "꼬마 머쉬룸": [
        { type: "scroll", name: "버섯 포자 주문서", rarity: "고급", dropRate: 0.6, effect: "갑옷에 방어력 +2~5", price: [2000, 8000] }
    ],
    "반짝 나비": [
        { type: "consumable", name: "반짝이 가루", rarity: "일반", dropRate: 2.0, effect: "30분 경험치 +20%", price: [300, 1200] }
    ],
    "포근 양": [
        { type: "consumable", name: "양털 쿠션", rarity: "고급", dropRate: 1.0, effect: "HP 회복 + 임시 힘 +3", price: [800, 3000] }
    ],
    
    // 무지개 초원 드롭템
    "춤추는 꽃": [
        { type: "scroll", name: "춤추는 꽃 민첩서", rarity: "고급", dropRate: 0.9, effect: "부츠에 회피력 +2~5", price: [3000, 15000] },
        { type: "consumable", name: "무지개 물", rarity: "고급", dropRate: 1.2, effect: "모든 스탯 임시 +5", price: [2000, 8000] }
    ],
    "통통 개구리": [
        { type: "scroll", name: "개구리 점프 주문서", rarity: "레어", dropRate: 0.6, effect: "장갑에 민첩성 +1~3", price: [5000, 25000] }
    ],
    "날으는 고양이": [
        { type: "consumable", name: "고양이 털뭉치", rarity: "고급", dropRate: 1.0, effect: "행운 임시 +10", price: [1500, 6000] }
    ],
    "크리스탈 사슴": [
        { type: "scroll", name: "크리스탈 사슴 축복서", rarity: "에픽", dropRate: 0.3, effect: "액세서리에 체력 +2~4", price: [15000, 80000] },
        { type: "currency", name: "사슴뿔 가루", rarity: "레어", dropRate: 1.8, effect: "고급 제작 재료", price: [1000, 8000] }
    ],
    "무지개 유니콘": [
        { type: "scroll", name: "유니콘 전설 주문서", rarity: "레전드리", dropRate: 0.02, effect: "모든 스탯 +1~2", price: [50000, 500000] },
        { type: "consumable", name: "유니콘 눈물", rarity: "레전드리", dropRate: 0.008, effect: "모든 스탯 영구 +1", price: [200000, 2000000] }
    ],
    
    // 속삭이는 숲 드롭템
    "수다쟁이 다람쥐": [
        { type: "scroll", name: "다람쥐 민첩성서", rarity: "레어", dropRate: 0.7, effect: "장갑에 공격력 +3~8", price: [8000, 35000] }
    ],
    "까꿍 올빼미": [
        { type: "scroll", name: "올빼미 지혜서", rarity: "에픽", dropRate: 0.4, effect: "헬멧에 지능 +2~5", price: [12000, 50000] },
        { type: "currency", name: "지혜의 결정", rarity: "레어", dropRate: 0.6, effect: "특별 제작 재료", price: [8000, 60000] }
    ],
    "장난꾸러기 원숭이": [
        { type: "scroll", name: "원숭이 장난기서", rarity: "레어", dropRate: 0.5, effect: "무기에 공격력 +5~12", price: [10000, 45000] }
    ],
    "신비한 나무정령": [
        { type: "scroll", name: "나무정령 생명서", rarity: "에픽", dropRate: 0.25, effect: "갑옷에 방어력 +8~18", price: [20000, 120000] },
        { type: "consumable", name: "숲의 정수", rarity: "에픽", dropRate: 0.8, effect: "힘+체력 임시 +8", price: [8000, 30000] }
    ],
    "숲의 현자 곰": [
        { type: "scroll", name: "현자곰 지식서", rarity: "레전드리", dropRate: 0.08, effect: "체력 스탯 +3~6", price: [80000, 800000] },
        { type: "consumable", name: "현자의 꿀", rarity: "레전드리", dropRate: 0.15, effect: "스탯 포인트 +2", price: [50000, 400000] }
    ],
    
    // 반짝 크리스탈 동굴 드롭템
    "반짝이 크리스탈": [
        { type: "scroll", name: "크리스탈 공명서", rarity: "에픽", dropRate: 0.4, effect: "무기에 공격력 +8~20", price: [25000, 200000] }
    ],
    "보석 거북이": [
        { type: "scroll", name: "다이아 단단함서", rarity: "에픽", dropRate: 0.3, effect: "갑옷에 방어력 +12~25", price: [35000, 250000] }
    ],
    "다이아 나비": [
        { type: "scroll", name: "나비 환상서", rarity: "에픽", dropRate: 0.25, effect: "액세서리에 회피력 +8~15", price: [40000, 300000] }
    ],
    "수정 고양이": [
        { type: "currency", name: "크리스탈 파편", rarity: "고급", dropRate: 2.0, effect: "최고급 제작 재료", price: [1000, 15000] }
    ],
    "크리스탈 늑대": [
        { type: "currency", name: "다이아 원석", rarity: "에픽", dropRate: 0.8, effect: "레전드리 제작 재료", price: [10000, 100000] }
    ],
    "다이아 골렘": [
        { type: "scroll", name: "골렘 파워서", rarity: "레전드리", dropRate: 0.15, effect: "무기에 힘 +4~8", price: [60000, 500000] }
    ],
    "크리스탈 정령왕": [
        { type: "scroll", name: "정령왕 왕관서", rarity: "레전드리", dropRate: 0.05, effect: "헬멧에 모든 스탯 +2~4", price: [200000, 1500000] },
        { type: "consumable", name: "크리스탈 엘릭서", rarity: "레전드리", dropRate: 0.1, effect: "모든 스탯 임시 +12", price: [150000, 1200000] }
    ],
    "다이아몬드 킹": [
        { type: "scroll", name: "다이아몬드 킹 축복서", rarity: "신화", dropRate: 0.005, effect: "모든 스탯 +3~8", price: [1000000, 10000000] },
        { type: "consumable", name: "다이아몬드 물약", rarity: "신화", dropRate: 0.002, effect: "모든 스탯 영구 +2", price: [3000000, 30000000] },
        { type: "currency", name: "킹의 인장", rarity: "레전드리", dropRate: 0.3, effect: "특별 상점 입장권", price: [100000, 1000000] }
    ],
    
    // 모든 지역 공통 드롭 (각 지역별로 다른 이름)
    "ALL_AREAS": [
        { area: 1, name: "무지개 꽃잎", type: "currency", rarity: "레전드리", dropRate: 0.05, price: [10000, 50000] },
        { area: 2, name: "무지개 조각", type: "currency", rarity: "에픽", dropRate: 2.5, price: [200, 2000] },
        { area: 3, name: "고대 나무 수액", type: "currency", rarity: "에픽", dropRate: 1.2, price: [1500, 12000] },
        { area: 4, name: "크리스탈 파편", type: "currency", rarity: "레어", dropRate: 2.0, price: [1000, 15000] }
    ]
};

// 사냥터 데이터
const huntingAreas = [
    {
        id: 1,
        name: "꽃잎 마을 근처",
        levelRange: "Lv.1-20",
        unlockLevel: 1,
        huntingGif: "kim_hunting.gif",
        monsters: [
            { name: "방울방울 슬라임", rarity: "일반", level: [1, 5], exp: [10, 25], gold: [5, 15], stats: { atk: 15, def: 5, dodge: 2, luck: 5 } },
            { name: "토실토실 토끼", rarity: "일반", level: [3, 8], exp: [15, 35], gold: [8, 20], stats: { atk: 20, def: 8, dodge: 5, luck: 8 } },
            { name: "꼬마 머쉬룸", rarity: "고급", level: [5, 12], exp: [25, 60], gold: [15, 35], stats: { atk: 35, def: 15, dodge: 8, luck: 12 } },
            { name: "반짝 나비", rarity: "고급", level: [8, 15], exp: [40, 80], gold: [20, 45], stats: { atk: 30, def: 10, dodge: 15, luck: 20 } },
            { name: "포근 양", rarity: "레어", level: [12, 20], exp: [70, 150], gold: [35, 80], stats: { atk: 50, def: 25, dodge: 10, luck: 25 } }
        ]
    },
    {
        id: 2,
        name: "무지개 초원",
        levelRange: "Lv.18-35",
        unlockLevel: 18,
        huntingGif: "kim_hunting2.gif",
        monsters: [
            { name: "춤추는 꽃", rarity: "일반", level: [18, 23], exp: [80, 120], gold: [40, 60], stats: { atk: 60, def: 20, dodge: 8, luck: 10 } },
            { name: "통통 개구리", rarity: "고급", level: [22, 28], exp: [120, 180], gold: [60, 90], stats: { atk: 80, def: 30, dodge: 12, luck: 15 } },
            { name: "날으는 고양이", rarity: "고급", level: [25, 32], exp: [150, 220], gold: [75, 110], stats: { atk: 90, def: 25, dodge: 20, luck: 18 } },
            { name: "크리스탈 사슴", rarity: "레어", level: [28, 35], exp: [200, 300], gold: [100, 150], stats: { atk: 120, def: 50, dodge: 15, luck: 25 } },
            { name: "무지개 유니콘", rarity: "에픽", level: [32, 35], exp: [350, 450], gold: [200, 280], stats: { atk: 150, def: 60, dodge: 25, luck: 40 } }
        ]
    },
    {
        id: 3,
        name: "속삭이는 숲",
        levelRange: "Lv.30-50",
        unlockLevel: 30,
        huntingGif: "kim_hunting3.gif",
        monsters: [
            { name: "수다쟁이 다람쥐", rarity: "일반", level: [30, 35], exp: [150, 200], gold: [70, 100], stats: { atk: 100, def: 35, dodge: 18, luck: 12 } },
            { name: "까꿍 올빼미", rarity: "고급", level: [35, 42], exp: [200, 280], gold: [100, 140], stats: { atk: 130, def: 45, dodge: 22, luck: 20 } },
            { name: "장난꾸러기 원숭이", rarity: "고급", level: [38, 45], exp: [250, 350], gold: [120, 170], stats: { atk: 140, def: 40, dodge: 28, luck: 25 } },
            { name: "신비한 나무정령", rarity: "레어", level: [42, 48], exp: [400, 550], gold: [200, 280], stats: { atk: 180, def: 80, dodge: 20, luck: 35 } },
            { name: "숲의 현자 곰", rarity: "에픽", level: [45, 50], exp: [600, 800], gold: [350, 450], stats: { atk: 220, def: 100, dodge: 15, luck: 45 } }
        ]
    },
    {
        id: 4,
        name: "반짝 크리스탈 동굴",
        levelRange: "Lv.45-70",
        unlockLevel: 45,
        huntingGif: "kim_hunting4.gif",
        monsters: [
            { name: "반짝이 크리스탈", rarity: "일반", level: [45, 50], exp: [400, 500], gold: [150, 200], stats: { atk: 200, def: 80, dodge: 5, luck: 8 } },
            { name: "보석 거북이", rarity: "일반", level: [47, 52], exp: [450, 550], gold: [160, 220], stats: { atk: 220, def: 120, dodge: 3, luck: 6 } },
            { name: "다이아 나비", rarity: "일반", level: [49, 54], exp: [500, 600], gold: [180, 250], stats: { atk: 180, def: 60, dodge: 15, luck: 12 } },
            { name: "수정 고양이", rarity: "고급", level: [52, 57], exp: [700, 850], gold: [250, 350], stats: { atk: 280, def: 100, dodge: 20, luck: 15 } },
            { name: "크리스탈 늑대", rarity: "고급", level: [56, 61], exp: [800, 950], gold: [300, 400], stats: { atk: 350, def: 140, dodge: 18, luck: 16 } },
            { name: "다이아 골렘", rarity: "레어", level: [58, 63], exp: [1200, 1400], gold: [450, 600], stats: { atk: 450, def: 250, dodge: 8, luck: 20 } },
            { name: "크리스탈 정령왕", rarity: "에픽", level: [64, 69], exp: [2000, 2300], gold: [800, 1000], stats: { atk: 650, def: 300, dodge: 28, luck: 30 } },
            { name: "다이아몬드 킹", rarity: "레전드리", level: [66, 70], exp: [2800, 3200], gold: [1200, 1500], stats: { atk: 800, def: 400, dodge: 25, luck: 35 } }
        ]
    }
];

module.exports = { huntingAreas, DROP_ITEMS };