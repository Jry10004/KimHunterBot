// 🎲 랜덤 재미 컨텐츠 시스템
const RANDOM_EVENTS = {
    dailyFortune: [
        { type: 'lucky', message: '오늘은 행운의 날! 모든 드롭률 +50%', effect: { dropRate: 1.5, duration: 24 } },
        { type: 'unlucky', message: '불운한 하루... 강화 실패율 +20%', effect: { enhanceFail: 1.2, duration: 24 } },
        { type: 'gold', message: '황금비가 내린다! 골드 획득량 2배', effect: { goldRate: 2.0, duration: 12 } },
        { type: 'exp', message: '지혜의 바람이 분다! 경험치 획득량 +100%', effect: { expRate: 2.0, duration: 8 } },
        { type: 'market', message: '상인들의 축제! 모든 아이템 가격 -30%', effect: { shopDiscount: 0.7, duration: 6 } }
    ],
    
    randomEncounters: [
        {
            name: '신비한 상인',
            rarity: 0.5, // 0.5% 확률
            description: '수상한 망토를 입은 상인이 나타났다!',
            options: [
                { text: '거래하기', result: 'trade', price: 5000, reward: '신비한 상자' },
                { text: '무시하기', result: 'ignore', message: '상인이 실망스러운 표정을 지으며 사라졌다.' }
            ]
        },
        {
            name: '행운의 고양이',
            rarity: 1.0, // 1% 확률
            description: '길 위에서 새하얀 고양이를 발견했다!',
            options: [
                { text: '쓰다듬기', result: 'pet', reward: 'luck_boost', message: '고양이가 행복해하며 행운을 빌어준다!' },
                { text: '먹이주기', result: 'feed', cost: 100, reward: 'gold_boost', message: '고양이가 골드를 물어다 준다!' }
            ]
        },
        {
            name: '폐허의 보물상자',
            rarity: 0.3, // 0.3% 확률  
            description: '오래된 폐허에서 빛나는 보물상자를 발견했다!',
            options: [
                { text: '열어보기', result: 'open', rewards: ['rare_item', 'gold', 'exp'] },
                { text: '함정일지도?', result: 'trap_check', skill: 'luck', success: 'safe_open', fail: 'explode' }
            ]
        }
    ],
    
    weatherEffects: [
        { name: '맑음', emoji: '☀️', effect: { huntingBonus: 1.1 } },
        { name: '비', emoji: '🌧️', effect: { expBonus: 1.2 } },
        { name: '눈', emoji: '❄️', effect: { goldPenalty: 0.9 } },
        { name: '폭풍', emoji: '⛈️', effect: { huntingPenalty: 0.8, dropBonus: 1.3 } },
        { name: '무지개', emoji: '🌈', effect: { allBonus: 1.3 } }
    ],
    
    mysteryBoxes: [
        {
            name: '낡은 보물상자',
            price: 1000,
            rewards: [
                { item: '골드', amount: [500, 2000], weight: 40 },
                { item: '경험치', amount: [100, 500], weight: 30 },
                { item: '랜덤 주문서', rarity: '일반', weight: 20 },
                { item: '보호권', amount: 1, weight: 10 }
            ]
        },
        {
            name: '황금 보물상자',
            price: 10000,
            rewards: [
                { item: '골드', amount: [5000, 25000], weight: 30 },
                { item: '레어 주문서', rarity: '레어', weight: 25 },
                { item: '스탯 포인트', amount: [1, 3], weight: 20 },
                { item: '보호권', amount: [3, 5], weight: 15 },
                { item: '신비한 아이템', rarity: '에픽', weight: 10 }
            ]
        },
        {
            name: '전설의 보물상자',
            price: 100000,
            rewards: [
                { item: '대량 골드', amount: [50000, 200000], weight: 25 },
                { item: '전설 주문서', rarity: '레전드리', weight: 20 },
                { item: '스탯 포인트', amount: [5, 10], weight: 20 },
                { item: '보호권', amount: [10, 20], weight: 15 },
                { item: '신화 아이템', rarity: '신화', weight: 15 },
                { item: '레벨업 스크롤', amount: 1, weight: 5 }
            ]
        }
    ],
    
    secretMissions: [
        {
            name: '연속 사냥 도전',
            description: '1시간 내에 몬스터 50마리 처치하기',
            requirement: { type: 'hunt_count', target: 50, timeLimit: 3600000 },
            reward: { exp: 5000, gold: 10000, item: '사냥꾼의 증표' }
        },
        {
            name: '강화 도전',
            description: '강화 성공 5번 연속 달성하기',
            requirement: { type: 'enhance_streak', target: 5 },
            reward: { gold: 20000, item: '행운의 부적', protectionScrolls: 3 }
        },
        {
            name: '부자 되기',
            description: '골드 100만개 모으기',
            requirement: { type: 'gold_amount', target: 1000000 },
            reward: { exp: 10000, gold: 50000, statPoints: 5 }
        }
    ]
};

module.exports = RANDOM_EVENTS;