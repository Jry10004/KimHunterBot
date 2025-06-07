// 사냥터 데이터
const huntingAreas = [
    {
        id: 1,
        name: "꽃잎 마을 근처",
        levelRange: "Lv.1-20",
        unlockLevel: 1,
        huntingGif: "kim_hunting.gif",
        monsters: [
            { name: "방울방울 슬라임", rarity: "노멀", level: [1, 5], exp: [10, 25], gold: [5, 15], stats: { atk: 15, def: 5, dodge: 2, luck: 5 } },
            { name: "토실토실 토끼", rarity: "노멀", level: [3, 8], exp: [15, 35], gold: [8, 20], stats: { atk: 20, def: 8, dodge: 5, luck: 8 } },
            { name: "꼬마 머쉬룸", rarity: "레어", level: [5, 12], exp: [25, 60], gold: [15, 35], stats: { atk: 35, def: 15, dodge: 8, luck: 12 } },
            { name: "반짝 나비", rarity: "레어", level: [8, 15], exp: [40, 80], gold: [20, 45], stats: { atk: 30, def: 10, dodge: 15, luck: 20 } },
            { name: "포근 양", rarity: "에픽", level: [12, 20], exp: [70, 150], gold: [35, 80], stats: { atk: 50, def: 25, dodge: 10, luck: 25 } }
        ]
    },
    {
        id: 2,
        name: "무지개 초원",
        levelRange: "Lv.18-35",
        unlockLevel: 18,
        huntingGif: "kim_hunting_rainbow.gif",
        monsters: [
            { name: "춤추는 꽃", rarity: "노멀", level: [18, 23], exp: [80, 120], gold: [40, 60], stats: { atk: 60, def: 20, dodge: 8, luck: 10 } },
            { name: "통통 개구리", rarity: "레어", level: [22, 28], exp: [120, 180], gold: [60, 90], stats: { atk: 80, def: 30, dodge: 12, luck: 15 } },
            { name: "날으는 고양이", rarity: "레어", level: [25, 32], exp: [150, 220], gold: [75, 110], stats: { atk: 90, def: 25, dodge: 20, luck: 18 } },
            { name: "크리스탈 사슴", rarity: "에픽", level: [28, 35], exp: [200, 300], gold: [100, 150], stats: { atk: 120, def: 50, dodge: 15, luck: 25 } },
            { name: "무지개 유니콘", rarity: "유니크", level: [32, 35], exp: [350, 450], gold: [200, 280], stats: { atk: 150, def: 60, dodge: 25, luck: 40 } }
        ]
    },
    {
        id: 3,
        name: "속삭이는 숲",
        levelRange: "Lv.30-50",
        unlockLevel: 30,
        huntingGif: "kim_hunting_forest.gif",
        monsters: [
            { name: "수다쟁이 다람쥐", rarity: "노멀", level: [30, 35], exp: [150, 200], gold: [70, 100], stats: { atk: 100, def: 35, dodge: 18, luck: 12 } },
            { name: "까꿍 올빼미", rarity: "레어", level: [35, 42], exp: [200, 280], gold: [100, 140], stats: { atk: 130, def: 45, dodge: 22, luck: 20 } },
            { name: "장난꾸러기 원숭이", rarity: "레어", level: [38, 45], exp: [250, 350], gold: [120, 170], stats: { atk: 140, def: 40, dodge: 28, luck: 25 } },
            { name: "신비한 나무정령", rarity: "에픽", level: [42, 48], exp: [400, 550], gold: [200, 280], stats: { atk: 180, def: 80, dodge: 20, luck: 35 } },
            { name: "숲의 현자 곰", rarity: "유니크", level: [45, 50], exp: [600, 800], gold: [350, 450], stats: { atk: 220, def: 100, dodge: 15, luck: 45 } }
        ]
    },
    {
        id: 4,
        name: "반짝 크리스탈 동굴",
        levelRange: "Lv.45-70",
        unlockLevel: 45,
        huntingGif: "kim_hunting_crystal.gif",
        monsters: [
            { name: "반짝이 크리스탈", rarity: "노멀", level: [45, 50], exp: [400, 500], gold: [150, 200], stats: { atk: 200, def: 80, dodge: 5, luck: 8 } },
            { name: "보석 거북이", rarity: "노멀", level: [47, 52], exp: [450, 550], gold: [160, 220], stats: { atk: 220, def: 120, dodge: 3, luck: 6 } },
            { name: "다이아 나비", rarity: "노멀", level: [49, 54], exp: [500, 600], gold: [180, 250], stats: { atk: 180, def: 60, dodge: 15, luck: 12 } },
            { name: "수정 고양이", rarity: "레어", level: [52, 57], exp: [700, 850], gold: [250, 350], stats: { atk: 280, def: 100, dodge: 20, luck: 15 } },
            { name: "크리스탈 늑대", rarity: "레어", level: [56, 61], exp: [800, 950], gold: [300, 400], stats: { atk: 350, def: 140, dodge: 18, luck: 16 } },
            { name: "다이아 골렘", rarity: "에픽", level: [58, 63], exp: [1200, 1400], gold: [450, 600], stats: { atk: 450, def: 250, dodge: 8, luck: 20 } },
            { name: "크리스탈 정령왕", rarity: "유니크", level: [64, 69], exp: [2000, 2300], gold: [800, 1000], stats: { atk: 650, def: 300, dodge: 28, luck: 30 } },
            { name: "다이아몬드 킹", rarity: "레전드", level: [66, 70], exp: [2800, 3200], gold: [1200, 1500], stats: { atk: 800, def: 400, dodge: 25, luck: 35 } }
        ]
    }
];

module.exports = huntingAreas;