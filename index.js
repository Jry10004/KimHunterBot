require('dotenv').config();
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const connectDB = require('./database/connection');
const User = require('./models/User');
const { generateVerificationCode, sendVerificationEmail } = require('./services/emailService');
const { huntingAreas, DROP_ITEMS } = require('./data/huntingAreas');

// 아이템 경매장 시스템
const AUCTION_HOUSE = {
    listings: new Map(), // 경매 리스팅 저장소
    priceHistory: new Map(), // 아이템별 가격 이력
    marketVolume: new Map(), // 일일 거래량
    topItems: [], // 인기 아이템 순위
    events: [] // 시장 이벤트
};

// 아이템 시세 데이터 (주식처럼 차트 관리)
const ITEM_MARKET = {
    categories: {
        scrolls: { name: '주문서', volatility: 0.25, baseMultiplier: 1.2 },
        consumables: { name: '소비템', volatility: 0.15, baseMultiplier: 0.8 },
        currency: { name: '재료/코인', volatility: 0.30, baseMultiplier: 1.0 },
        rare: { name: '레어템', volatility: 0.40, baseMultiplier: 2.0 }
    },
    priceFactors: {
        supply: 0.4,      // 공급량 (많을수록 가격 하락)
        demand: 0.3,      // 수요량 (구매 주문량)
        rarity: 0.2,      // 희귀도 가중치
        events: 0.1       // 특별 이벤트 영향
    },
    dailyEvents: [
        { name: '대풍작의 날', effect: { type: 'supply_increase', value: 2.0, items: ['currency'] } },
        { name: '모험가 축제', effect: { type: 'demand_increase', value: 1.5, items: ['scrolls'] } },
        { name: '마법사 파업', effect: { type: 'price_spike', value: 3.0, items: ['consumables'] } },
        { name: '용사의 귀환', effect: { type: 'market_crash', value: 0.5, items: ['all'] } },
        { name: '골드러시', effect: { type: 'price_boost', value: 1.8, items: ['rare'] } }
    ]
};

// 현재 시장 상황 저장소
let currentMarketEvent = null;
let lastMarketUpdate = 0;

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

// 현재 활성 이벤트들
let dailyFortune = null;
let currentWeather = null;
let activeMissions = new Map();

// 데이터 저장/로드 시스템
const DATA_FILE_PATH = path.join(__dirname, 'data', 'gameData.json');

// 게임 데이터 저장
function saveGameData() {
    try {
        const gameData = {
            auctionHouse: {
                listings: Object.fromEntries(AUCTION_HOUSE.listings),
                priceHistory: Object.fromEntries(AUCTION_HOUSE.priceHistory),
                marketVolume: Object.fromEntries(AUCTION_HOUSE.marketVolume),
                topItems: AUCTION_HOUSE.topItems,
                events: AUCTION_HOUSE.events
            },
            currentWeather: currentWeather,
            dailyFortune: dailyFortune,
            activeMissions: Object.fromEntries(activeMissions),
            lastWeatherUpdate: lastMarketUpdate,
            lastFortuneUpdate: lastMarketUpdate,
            lastMarketUpdate: lastMarketUpdate,
            currentMarketEvent: currentMarketEvent
        };
        
        fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(gameData, null, 2));
        console.log('게임 데이터 저장 완료');
    } catch (error) {
        console.error('게임 데이터 저장 실패:', error);
    }
}

// 게임 데이터 로드
function loadGameData() {
    try {
        if (fs.existsSync(DATA_FILE_PATH)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE_PATH, 'utf8'));
            
            // 경매장 데이터 복원
            if (data.auctionHouse) {
                AUCTION_HOUSE.listings = new Map(Object.entries(data.auctionHouse.listings || {}));
                AUCTION_HOUSE.priceHistory = new Map(Object.entries(data.auctionHouse.priceHistory || {}));
                AUCTION_HOUSE.marketVolume = new Map(Object.entries(data.auctionHouse.marketVolume || {}));
                AUCTION_HOUSE.topItems = data.auctionHouse.topItems || [];
                AUCTION_HOUSE.events = data.auctionHouse.events || [];
            }
            
            // 날씨/운세 데이터 복원
            currentWeather = data.currentWeather;
            dailyFortune = data.dailyFortune;
            activeMissions = new Map(Object.entries(data.activeMissions || {}));
            lastMarketUpdate = data.lastMarketUpdate || 0;
            currentMarketEvent = data.currentMarketEvent;
            
            console.log('게임 데이터 로드 완료');
        } else {
            console.log('게임 데이터 파일이 없어 기본값으로 시작');
        }
    } catch (error) {
        console.error('게임 데이터 로드 실패:', error);
        console.log('기본값으로 초기화');
    }
}

// 주기적 데이터 저장 (5분마다)
setInterval(saveGameData, 5 * 60 * 1000);

// 봇 종료 시 데이터 저장
process.on('SIGINT', () => {
    console.log('봇 종료 중... 데이터 저장');
    saveGameData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('봇 종료 중... 데이터 저장');
    saveGameData();
    process.exit(0);
});
const fs = require('fs');
const Jimp = require('jimp');
const GifEncoder = require('gif-encoder-2');

// 상점 아이템 데이터 (레벨 시스템 포함)
const shopItems = [
    {
        id: 'basic_sword',
        name: '기본 검',
        type: 'weapon',
        rarity: '노멀',
        level: 1,
        price: 500,
        stats: { attack: 10, defense: 0, hp: 0, mp: 0 },
        description: '모험가를 위한 기본적인 검입니다.'
    },
    {
        id: 'basic_armor',
        name: '기본 갑옷',
        type: 'armor',
        rarity: '노멀',
        level: 1,
        price: 800,
        stats: { attack: 0, defense: 15, hp: 50, mp: 0 },
        description: '기본적인 방어력을 제공하는 갑옷입니다.'
    },
    {
        id: 'steel_sword',
        name: '강철 검',
        type: 'weapon',
        rarity: '레어',
        level: 10,
        price: 2000,
        stats: { attack: 25, defense: 0, hp: 0, mp: 0 },
        description: '단단한 강철로 만든 검입니다.'
    },
    {
        id: 'health_potion',
        name: '체력 포션',
        type: 'consumable',
        rarity: '노멀',
        level: 1,
        price: 100,
        stats: { attack: 0, defense: 0, hp: 100, mp: 0 },
        description: '체력을 회복시켜주는 포션입니다.'
    },
    {
        id: 'mana_potion',
        name: '마나 포션',
        type: 'consumable',
        rarity: '노멀',
        level: 1,
        price: 100,
        stats: { attack: 0, defense: 0, hp: 0, mp: 50 },
        description: '마나를 회복시켜주는 포션입니다.'
    }
];

// 상점 카테고리 데이터 정의 (전역으로 사용)
const SHOP_CATEGORIES = {
    weapon: {
        name: '무기',
        emoji: '⚔️',
        gif: 'kim_shop_weapon.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 칼', 
                rarity: '일반', 
                price: 500, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃의 힘이 깃든 기본 무기입니다.',
                stats: { 
                    attack: [15, 25], 
                    defense: [5, 10], 
                    dodge: [0, 0], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '꽃다발 도끼', 
                rarity: '일반', 
                price: 600, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃다발처럼 아름답지만 강력한 도끼입니다.',
                stats: { 
                    attack: [25, 35], 
                    defense: [3, 8], 
                    dodge: [-2, -2], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '꽃향기 활', 
                rarity: '일반', 
                price: 550, 
                type: 'weapon',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃향기가 퍼지며 행운을 부르는 활입니다.',
                stats: { 
                    attack: [18, 28], 
                    defense: [0, 0], 
                    dodge: [0, 0], 
                    luck: [5, 10] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 칼', 
                rarity: '고급', 
                price: 2500, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '별의 힘이 깃든 무기입니다.',
                stats: { 
                    attack: [50, 70], 
                    defense: [15, 25], 
                    dodge: [3, 3], 
                    luck: [0, 0] 
                }
            },
            { 
                name: '유성 도끼', 
                rarity: '고급', 
                price: 2800, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '유성의 파괴력이 담긴 강력한 도끼입니다.',
                stats: { 
                    attack: [70, 95], 
                    defense: [10, 20], 
                    dodge: [-3, -3], 
                    luck: [5, 5] 
                }
            },
            { 
                name: '은하 활', 
                rarity: '고급', 
                price: 2600, 
                type: 'weapon',
                setName: '별빛 세트',
                level: 20,
                description: '은하의 신비로운 힘을 담은 활입니다.',
                stats: { 
                    attack: [55, 75], 
                    defense: [0, 0], 
                    dodge: [8, 8], 
                    luck: [12, 20] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 킬러', 
                rarity: '레어', 
                price: 12000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '용을 처치할 수 있는 강력한 무기입니다.',
                stats: { 
                    attack: [120, 180], 
                    defense: [40, 60], 
                    dodge: [0, 0], 
                    luck: [8, 8] 
                }
            },
            { 
                name: '용의 분노 도끼', 
                rarity: '레어', 
                price: 15000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 분노가 담긴 파괴적인 도끼입니다.',
                stats: { 
                    attack: [180, 250], 
                    defense: [25, 45], 
                    dodge: [-5, -5], 
                    luck: [10, 10] 
                }
            },
            { 
                name: '드래곤브레스 활', 
                rarity: '레어', 
                price: 13000, 
                type: 'weapon',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 브레스를 사용하는 신비한 활입니다.',
                stats: { 
                    attack: [140, 200], 
                    defense: [0, 0], 
                    dodge: [15, 15], 
                    luck: [20, 35] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시간의 칼', 
                rarity: '에픽', 
                price: 50000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '시간을 조작할 수 있는 신비한 능력이 담긴 칼입니다.',
                stats: { 
                    attack: [300, 450], 
                    defense: [100, 150], 
                    dodge: [20, 20], 
                    luck: [15, 15] 
                }
            },
            { 
                name: '공간 절단 도끼', 
                rarity: '에픽', 
                price: 60000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '공간을 절단할 수 있는 차원 조작 도끼입니다.',
                stats: { 
                    attack: [450, 650], 
                    defense: [80, 120], 
                    dodge: [-8, -8], 
                    luck: [20, 20] 
                }
            },
            { 
                name: '차원 활', 
                rarity: '에픽', 
                price: 55000, 
                type: 'weapon',
                setName: '시공 세트',
                level: 60,
                description: '다른 차원에서 화살을 소환하는 신비한 활입니다.',
                stats: { 
                    attack: [350, 500], 
                    defense: [0, 0], 
                    dodge: [30, 30], 
                    luck: [40, 60] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 칼', 
                rarity: '레전드리', 
                price: 200000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 왜이 되어 전설이 된 최강의 칼입니다.',
                stats: { 
                    attack: [600, 900], 
                    defense: [200, 300], 
                    dodge: [30, 30], 
                    luck: [25, 25] 
                }
            },
            { 
                name: '절대 파괴 도끼', 
                rarity: '레전드리', 
                price: 250000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '모든 것을 파괴할 수 있는 절대적인 힘의 도끼입니다.',
                stats: { 
                    attack: [900, 1300], 
                    defense: [150, 250], 
                    dodge: [-10, -10], 
                    luck: [35, 35] 
                }
            },
            { 
                name: '운명 지배 활', 
                rarity: '레전드리', 
                price: 220000, 
                type: 'weapon',
                setName: '강화왕 세트',
                level: 80,
                description: '운명을 지배하여 절대적인 사격을 보장하는 전설의 활입니다.',
                stats: { 
                    attack: [700, 1000], 
                    defense: [0, 0], 
                    dodge: [50, 50], 
                    luck: [60, 90] 
                }
            }
        ]
    },
    helmet: {
        name: '헬멧',
        emoji: '⛑️',
        gif: 'kim_shop_hood.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃 화관', 
                rarity: '일반', 
                price: 400, 
                type: 'helmet',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃잎으로 만든 아름다운 머리 장식입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [8, 15], 
                    dodge: [3, 6], 
                    luck: [0, 0] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별자리 관', 
                rarity: '고급', 
                price: 2000, 
                type: 'helmet',
                setName: '별빛 세트',
                level: 20,
                description: '별자리의 축복이 담긴 신비한 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [20, 35], 
                    dodge: [8, 15], 
                    luck: [5, 5] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '용 투구', 
                rarity: '레어', 
                price: 10000, 
                type: 'helmet',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 비늘로 만든 강력한 방어력의 투구입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [50, 80], 
                    dodge: [15, 25], 
                    luck: [10, 10] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 관', 
                rarity: '에픽', 
                price: 40000, 
                type: 'helmet',
                setName: '시공 세트',
                level: 60,
                description: '시공간을 조작할 수 있는 신비한 힘이 담긴 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [120, 180], 
                    dodge: [25, 40], 
                    luck: [20, 20] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕 관', 
                rarity: '레전드리', 
                price: 180000, 
                type: 'helmet',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 왕이 착용하는 최고급 대마법사의 관입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [250, 380], 
                    dodge: [40, 60], 
                    luck: [35, 35] 
                }
            }
        ]
    },
    armor: {
        name: '갑옷',
        emoji: '🛡️',
        gif: 'kim_shop_armor.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 옷', 
                rarity: '일반', 
                price: 450, 
                type: 'armor',
                setName: '꽃잎 세트',
                level: 1,
                description: '꽃잎으로 만든 가벼운 방어구입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [10, 20], 
                    dodge: [2, 4], 
                    luck: [0, 0] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 갑옷', 
                rarity: '고급', 
                price: 2200, 
                type: 'armor',
                setName: '별빛 세트',
                level: 20,
                description: '별빛이 반짝이는 신비로운 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [30, 50], 
                    dodge: [5, 10], 
                    luck: [3, 3] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 스케일 갑옷', 
                rarity: '레어', 
                price: 11000, 
                type: 'armor',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 비늘로 만든 단단한 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [80, 120], 
                    dodge: [10, 18], 
                    luck: [8, 8] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 갑옷', 
                rarity: '에픽', 
                price: 45000, 
                type: 'armor',
                setName: '시공 세트',
                level: 60,
                description: '시공간의 왜곡으로 공격을 방어하는 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [150, 230], 
                    dodge: [20, 35], 
                    luck: [15, 15] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 갑옷', 
                rarity: '레전드리', 
                price: 190000, 
                type: 'armor',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 절대자가 착용하는 최강의 갑옷입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [300, 450], 
                    dodge: [35, 55], 
                    luck: [30, 30] 
                }
            }
        ]
    },
    gloves: {
        name: '장갑',
        emoji: '🧤',
        gif: 'kim_shop_gloves.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 장갑', 
                rarity: '일반', 
                price: 350, 
                type: 'gloves',
                setName: '꽃잎 세트',
                level: 1,
                description: '부드러운 꽃잎으로 만든 장갑입니다.',
                stats: { 
                    attack: [3, 8], 
                    defense: [5, 10], 
                    dodge: [5, 8], 
                    luck: [2, 2] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 장갑', 
                rarity: '고급', 
                price: 1800, 
                type: 'gloves',
                setName: '별빛 세트',
                level: 20,
                description: '별의 힘이 깃든 민첩한 장갑입니다.',
                stats: { 
                    attack: [10, 20], 
                    defense: [15, 25], 
                    dodge: [12, 20], 
                    luck: [8, 8] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 클로', 
                rarity: '레어', 
                price: 9000, 
                type: 'gloves',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 발톱을 모방한 공격적인 장갑입니다.',
                stats: { 
                    attack: [30, 50], 
                    defense: [30, 50], 
                    dodge: [20, 30], 
                    luck: [15, 15] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 장갑', 
                rarity: '에픽', 
                price: 38000, 
                type: 'gloves',
                setName: '시공 세트',
                level: 60,
                description: '시공간을 조작하는 능력이 담긴 장갑입니다.',
                stats: { 
                    attack: [60, 100], 
                    defense: [60, 100], 
                    dodge: [35, 50], 
                    luck: [25, 25] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 장갑', 
                rarity: '레전드리', 
                price: 170000, 
                type: 'gloves',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 힘을 극대화시키는 전설의 장갑입니다.',
                stats: { 
                    attack: [120, 200], 
                    defense: [120, 200], 
                    dodge: [50, 70], 
                    luck: [40, 40] 
                }
            }
        ]
    },
    boots: {
        name: '부츠',
        emoji: '👢',
        gif: 'kim_shop_boots.png',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 신발', 
                rarity: '일반', 
                price: 380, 
                type: 'boots',
                setName: '꽃잎 세트',
                level: 1,
                description: '가볍고 편안한 꽃잎 신발입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [6, 12], 
                    dodge: [8, 12], 
                    luck: [1, 1] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 부츠', 
                rarity: '고급', 
                price: 1900, 
                type: 'boots',
                setName: '별빛 세트',
                level: 20,
                description: '별처럼 빠른 속도를 자랑하는 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [18, 30], 
                    dodge: [18, 28], 
                    luck: [6, 6] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 워커', 
                rarity: '레어', 
                price: 9500, 
                type: 'boots',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 발걸음처럼 묵직한 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [40, 70], 
                    dodge: [30, 45], 
                    luck: [12, 12] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 부츠', 
                rarity: '에픽', 
                price: 42000, 
                type: 'boots',
                setName: '시공 세트',
                level: 60,
                description: '순간이동이 가능한 신비한 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [80, 130], 
                    dodge: [60, 85], 
                    luck: [22, 22] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 부츠', 
                rarity: '레전드리', 
                price: 175000, 
                type: 'boots',
                setName: '강화왕 세트',
                level: 80,
                description: '절대적인 속도와 회피를 보장하는 전설의 부츠입니다.',
                stats: { 
                    attack: [0, 0], 
                    defense: [160, 260], 
                    dodge: [100, 140], 
                    luck: [38, 38] 
                }
            }
        ]
    },
    accessory: {
        name: '액세서리',
        emoji: '💎',
        gif: 'kim_equipment_acce.gif',
        items: [
            // 🌸 일반 등급 - 꽃잎 세트
            { 
                name: '꽃잎 목걸이', 
                rarity: '일반', 
                price: 420, 
                type: 'accessory',
                setName: '꽃잎 세트',
                level: 1,
                description: '행운을 부르는 꽃잎 목걸이입니다.',
                stats: { 
                    attack: [2, 5], 
                    defense: [2, 5], 
                    dodge: [2, 2], 
                    luck: [8, 12] 
                }
            },
            // ⭐ 고급 등급 - 별빛 세트
            { 
                name: '별빛 반지', 
                rarity: '고급', 
                price: 2100, 
                type: 'accessory',
                setName: '별빛 세트',
                level: 20,
                description: '별의 축복이 담긴 신비한 반지입니다.',
                stats: { 
                    attack: [8, 15], 
                    defense: [8, 15], 
                    dodge: [5, 5], 
                    luck: [20, 30] 
                }
            },
            // 🔥 레어 등급 - 드래곤 세트
            { 
                name: '드래곤 하트', 
                rarity: '레어', 
                price: 10500, 
                type: 'accessory',
                setName: '드래곤 세트',
                level: 40,
                description: '드래곤의 심장이 담긴 강력한 액세서리입니다.',
                stats: { 
                    attack: [20, 35], 
                    defense: [20, 35], 
                    dodge: [8, 8], 
                    luck: [40, 60] 
                }
            },
            // 🌙 에픽 등급 - 시공 세트
            { 
                name: '시공간 크리스탈', 
                rarity: '에픽', 
                price: 48000, 
                type: 'accessory',
                setName: '시공 세트',
                level: 60,
                description: '시공간의 힘이 응축된 크리스탈입니다.',
                stats: { 
                    attack: [40, 70], 
                    defense: [40, 70], 
                    dodge: [15, 15], 
                    luck: [80, 120] 
                }
            },
            // ✨ 레전드리 등급 - 강화왕 세트
            { 
                name: '강화왕의 증표', 
                rarity: '레전드리', 
                price: 195000, 
                type: 'accessory',
                setName: '강화왕 세트',
                level: 80,
                description: '강화의 절대자임을 증명하는 최고의 액세서리입니다.',
                stats: { 
                    attack: [80, 140], 
                    defense: [80, 140], 
                    dodge: [25, 25], 
                    luck: [150, 220] 
                }
            }
        ]
    },
    consumable: {
        name: '소비',
        emoji: '💊',
        gif: 'kim_shop_con.gif',
        items: [
            // 소비 아이템 추가 예정
        ]
    },
    enhancement: {
        name: '주문서',
        emoji: '⚒️',
        gif: 'kim_shop_examples.gif',
        items: [
            // 주문서 아이템 추가 예정
        ]
    },
    coin: {
        name: '코인',
        emoji: '🪙',
        gif: 'kim_shop_coin.gif',
        items: [
            // 코인 아이템 추가 예정
        ]
    }
};

// 의뢰 시스템 데이터
const QUEST_CLIENTS = {
    // 💰 의뢰주화를 얻는 의뢰 (20가지)
    villagers: [
        {
            id: 1,
            name: '마을 주민 김봉순',
            type: 'reward',
            title: '고양이 구출 작전',
            description: '아, 당신! 혹시 시간 있으세요? 우리 집 고양이가 또 나무에 올라가서 내려오질 못하고 있어요. 도와주시면 작은 보답을 드릴게요!',
            emoji: '🐱'
        },
        {
            id: 2,
            name: '마을 주민 박철수',
            type: 'reward',
            title: '우물 소음 조사',
            description: '어머, 모험가님! 마침 잘 오셨네요. 마을 우물에서 이상한 소리가 나는데... 혹시 한 번 봐주실 수 있나요? 물론 수고비는 드릴게요.',
            emoji: '🏺'
        },
        {
            id: 3,
            name: '마을 주민 이영희',
            type: 'reward',
            title: '할머니의 약초 수집',
            description: '저기요, 모험가님! 우리 할머니가 약초를 구해달라고 하시는데... 마을 근처에서 쉽게 찾을 수 있는 거라고 하네요. 부탁드려도 될까요?',
            emoji: '🌿'
        },
        {
            id: 4,
            name: '마을 주민 최민수',
            type: 'reward',
            title: '창고 쥐 퇴치',
            description: '아! 당신이 그 유명한 모험가군요! 우리 마을 창고에 쥐들이 너무 많아졌어요. 좀 쫓아내 주실 수 있나요? 감사의 마음을 담아 보상을 드릴게요.',
            emoji: '🐭'
        },
        {
            id: 5,
            name: '마을 주민 정수연',
            type: 'reward',
            title: '마을 간판 복구',
            description: '모험가님, 잠깐만요! 마을 입구 간판이 바람에 넘어졌는데 혼자서는 다시 세우기 힘들어요. 도와주시면 고맙겠어요!',
            emoji: '📋'
        },
        {
            id: 6,
            name: '마을 주민 강지훈',
            type: 'reward',
            title: '편지 전달 부탁',
            description: '어라, 모험가님! 마침 잘 만났네요. 이웃집에 편지 좀 전해주실 수 있나요? 다리가 아파서 직접 가기가 힘들어서요...',
            emoji: '💌'
        },
        {
            id: 7,
            name: '마을 주민 윤미나',
            type: 'reward',
            title: '광장 청소 도움',
            description: '저기, 혹시 바쁘지 않으시다면... 마을 광장에 떨어진 낙엽들을 좀 치워주실 수 있나요? 마을 축제 준비 때문에 급해서요.',
            emoji: '🍂'
        },
        {
            id: 8,
            name: '마을 주민 임현우',
            type: 'reward',
            title: '지붕 위 공 회수',
            description: '모험가님! 우리 아이가 공을 지붕 위에 올려버렸어요. 사다리가 있긴 한데 혼자서는 위험해서... 도와주실 수 있나요?',
            emoji: '⚽'
        },
        {
            id: 9,
            name: '마을 주민 송다은',
            type: 'reward',
            title: '멧돼지 퇴치',
            description: '아, 당신! 마을 뒤편 텃밭에 멧돼지가 나타나서 농작물을 망가뜨리고 있어요. 쫓아내 주시면 정말 감사하겠어요!',
            emoji: '🐗'
        },
        {
            id: 10,
            name: '마을 주민 한지우',
            type: 'reward',
            title: '우물 이물질 제거',
            description: '모험가님, 잠시만요! 마을 우물물이 탁해졌는데 밑에 뭔가 떨어진 것 같아요. 건져내 주실 수 있나요? 보상은 당연히 드릴게요.',
            emoji: '🪣'
        }
    ],
    merchants: [
        {
            id: 11,
            name: '잡화상 돈복이',
            type: 'reward',
            title: '창고 정리 알바',
            description: '어어, 모험가님! 마침 잘 오셨어요. 제가 물건을 너무 많이 주문해서 창고가 꽉 찼어요. 정리 좀 도와주시면 수고비를 드릴게요!',
            emoji: '📦'
        },
        {
            id: 12,
            name: '잡화상 장사꾼',
            type: 'reward',
            title: '간판 청소 작업',
            description: '오, 모험가님! 혹시 시간 되시면 제 가게 간판 좀 닦아주실 수 있나요? 높은 곳이라 제가 하기엔 위험해서요. 물론 품삯은 드릴게요.',
            emoji: '🪧'
        },
        {
            id: 13,
            name: '잡화상 심술맨',
            type: 'reward',
            title: '야간 경비 업무',
            description: '아! 당신이 그 실력자군요! 제 상점에 도둑이 들어올까 봐 걱정인데... 오늘 밤 한 번만 지켜봐 주실 수 있나요? 사례는 충분히 드릴게요.',
            emoji: '🌙'
        },
        {
            id: 14,
            name: '잡화상 택배왕',
            type: 'reward',
            title: '물건 배달 서비스',
            description: '모험가님, 잠깐만요! 다른 마을에서 주문한 물건이 있는데 직접 배달해 주실 수 있나요? 저는 가게를 비울 수가 없어서요.',
            emoji: '📮'
        },
        {
            id: 15,
            name: '잡화상 코막힘',
            type: 'reward',
            title: '지하창고 냄새 조사',
            description: '어머, 모험가님! 제 가게 지하창고에 이상한 냄새가 나는데... 혹시 한 번 확인해 주실 수 있나요? 뭔가 썩은 것 같아서 걱정이에요.',
            emoji: '🤢'
        },
        {
            id: 16,
            name: '잡화상 겁쟁이',
            type: 'reward',
            title: '물건 수송 호위',
            description: '오, 잘 오셨어요! 제가 팔 물건들을 다른 마을에서 가져와야 하는데 길이 위험해서요. 호위해 주시면 넉넉히 보상해 드릴게요.',
            emoji: '🛡️'
        },
        {
            id: 17,
            name: '잡화상 정보통',
            type: 'reward',
            title: '특별 주문 수집',
            description: '모험가님! 마침 좋은 타이밍이네요. 제 단골손님이 특별한 물건을 찾고 있는데 구해다 주실 수 있나요? 수수료는 충분히 드릴게요.',
            emoji: '🔍'
        },
        {
            id: 18,
            name: '잡화상 스파이',
            type: 'reward',
            title: '경쟁업체 정찰',
            description: '어라, 모험가님! 제 경쟁업체가 자꾸 제 손님들을 빼앗아 가는데... 그쪽 가격이나 알아봐 주실 수 있나요? 정보비는 드릴게요.',
            emoji: '🕵️'
        },
        {
            id: 19,
            name: '잡화상 굴착맨',
            type: 'reward',
            title: '미스터리 구멍 조사',
            description: '아, 당신! 제 가게 뒤편에 이상한 구멍이 생겼는데 뭔지 확인해 주실 수 있나요? 혹시 지하에 뭔가 있을지도 몰라서요.',
            emoji: '🕳️'
        },
        {
            id: 20,
            name: '잡화상 손놈이',
            type: 'reward',
            title: '열쇠 찾기 대작전',
            description: '모험가님, 부탁이 있어요! 제가 실수로 중요한 열쇠를 연못에 빠뜨렸는데... 찾아주시면 정말 감사하겠어요. 보상은 확실히 드릴게요!',
            emoji: '🗝️'
        }
    ],
    scammers: [
        {
            id: 21,
            name: '수상한상인 약장수',
            type: 'scam',
            title: '특별 물약 시음회',
            description: '오오, 모험가님! 특별한 기회를 드릴게요! 이 마법 물약을 미리 맛보기로 드시면 효과를 보장해 드려요. 단돈 3만 골드면 되고요... 어떠세요?',
            emoji: '🧪',
            scamAmount: 30000
        },
        {
            id: 22,
            name: '수상한상인 정보꾼',
            type: 'scam',
            title: '보물 위치 정보 판매',
            description: '어어, 실력자시네요! 제가 특별한 정보를 하나 알고 있는데... 근처 동굴에 보물이 숨겨져 있어요. 위치를 알려드릴 테니 2만 골드만 주세요!',
            emoji: '🗺️',
            scamAmount: 20000
        },
        {
            id: 23,
            name: '수상한상인 마법사',
            type: 'scam',
            title: '행운의 마법 반지',
            description: '모험가님! 이 반지 보세요. 마법이 걸려있어서 운이 엄청 좋아진다고 해요! 원래 10만 골드인데 당신에게만 특가 4만 골드에 드릴게요!',
            emoji: '💍',
            scamAmount: 40000
        },
        {
            id: 24,
            name: '수상한상인 빚쟁이',
            type: 'scam',
            title: '급한 돈 대여 부탁',
            description: '아, 당신! 혹시 여기 근처에서 수상한 놈들을 본 적 있나요? 제가 물어보는 이유가... 아니, 일단 5만 골드부터 빌려주시면 설명해 드릴게요.',
            emoji: '💸',
            scamAmount: 50000
        },
        {
            id: 25,
            name: '수상한상인 사기꾼',
            type: 'scam',
            title: '친구 응급 치료비',
            description: '모험가님, 긴급상황이에요! 제 친구가 다른 마을에서 사고를 당했는데 치료비가 필요해요. 1만 골드만 빌려주시면 내일 두 배로 갚을게요!',
            emoji: '🚑',
            scamAmount: 10000
        },
        {
            id: 26,
            name: '수상한상인 보관꾼',
            type: 'scam',
            title: '귀중품 보관 서비스',
            description: '어머, 모험가님! 제가 귀중한 물건을 맡아드릴게요. 보관료로 3만 골드만 주시면... 아, 미안해요! 지금 급한 일이 생겨서 가봐야겠어요!',
            emoji: '🏃',
            scamAmount: 30000
        }
    ],
    travelers: [
        {
            id: 27,
            name: '수상한여행자 도박꾼',
            type: 'scam',
            title: '특별한 주사위 게임',
            description: '저기요! 혹시 도박 한 판 어떠세요? 이 주사위는 특별해서 거의 이길 수 있어요! 판돈 2만 골드만 걸어보시면... 분명 재미있을 거예요!',
            emoji: '🎲',
            scamAmount: 20000
        },
        {
            id: 28,
            name: '수상한여행자 모험가',
            type: 'scam',
            title: '보물찾기 동업 제안',
            description: '모험가님! 저와 함께 보물찾기를 하시겠어요? 지도도 있고 장비도 준비했는데... 참가비로 4만 골드만 내시면 절반씩 나눠가져요!',
            emoji: '🏴‍☠️',
            scamAmount: 40000
        },
        {
            id: 29,
            name: '수상한여행자 피해자',
            type: 'scam',
            title: '귀중품 수색 의뢰',
            description: '아! 당신 같은 실력자를 찾고 있었어요! 제가 몬스터에게 습격당해서 귀중품을 뺏겼는데... 찾아주시면 5만 골드를 드릴게요. 단, 수색비로 1만 골드가 필요해요.',
            emoji: '👹',
            scamAmount: 10000
        },
        {
            id: 30,
            name: '수상한여행자 거지',
            type: 'scam',
            title: '강도 피해 도움 요청',
            description: '모험가님, 급해요! 제가 마을 입구에서 강도를 당했는데 지갑을 다 털렸어요. 숙박비 1만5천 골드만 빌려주시면 고향에 가서 꼭 갚을게요!',
            emoji: '🥺',
            scamAmount: 15000
        }
    ]
};

// 🚀 혁신적인 차원 주식 거래소 시스템
const STOCK_MARKET = {
    // 12개 환상 지역의 기업들
    regions: {
        crystal_cave: {
            name: '💎 크리스탈 동굴',
            companies: [
                { id: 'crystal_mining', name: '크리스탈 채굴공사', price: 1000, change: 0, volume: 0, sector: 'mining' },
                { id: 'crystal_processing', name: '수정 가공업체', price: 850, change: 0, volume: 0, sector: 'manufacturing' }
            ]
        },
        cloud_castle: {
            name: '☁️ 솜사탕 구름성',
            companies: [
                { id: 'cotton_candy', name: '솜사탕 제과회사', price: 750, change: 0, volume: 0, sector: 'food' },
                { id: 'cloud_transport', name: '구름 운송업', price: 920, change: 0, volume: 0, sector: 'logistics' }
            ]
        },
        starlight_lake: {
            name: '⭐ 별빛 호수',
            companies: [
                { id: 'starlight_research', name: '별빛 연구소', price: 1200, change: 0, volume: 0, sector: 'research' },
                { id: 'moonlight_fishing', name: '달빛 어업', price: 680, change: 0, volume: 0, sector: 'fishing' }
            ]
        },
        magic_library: {
            name: '📚 마법 도서관',
            companies: [
                { id: 'wisdom_publishing', name: '지혜 출판사', price: 800, change: 0, volume: 0, sector: 'publishing' },
                { id: 'magic_research', name: '마법 연구원', price: 1100, change: 0, volume: 0, sector: 'research' }
            ]
        },
        dragon_village: {
            name: '🐲 용용이 마을',
            companies: [
                { id: 'dragon_weapons', name: '드래곤 무기점', price: 1350, change: 0, volume: 0, sector: 'weapons' },
                { id: 'dragon_armor', name: '용린 방어구', price: 1180, change: 0, volume: 0, sector: 'armor' }
            ]
        },
        time_garden: {
            name: '⏰ 시간의 정원',
            companies: [
                { id: 'time_management', name: '시공 관리공사', price: 1500, change: 0, volume: 0, sector: 'technology' },
                { id: 'garden_agriculture', name: '정원 농업', price: 550, change: 0, volume: 0, sector: 'agriculture' }
            ]
        },
        dream_palace: {
            name: '💫 꿈의 궁전',
            companies: [
                { id: 'fantasy_entertainment', name: '환상 엔터테인먼트', price: 980, change: 0, volume: 0, sector: 'entertainment' },
                { id: 'dream_healing', name: '꿈결 힐링센터', price: 720, change: 0, volume: 0, sector: 'healthcare' }
            ]
        },
        heaven_bridge: {
            name: '👼 천상의 구름다리',
            companies: [
                { id: 'angel_medical', name: '천사 의료원', price: 1400, change: 0, volume: 0, sector: 'healthcare' },
                { id: 'cloud_construction', name: '구름다리 건설', price: 950, change: 0, volume: 0, sector: 'construction' }
            ]
        },
        galaxy_temple: {
            name: '🌌 은하수 사원',
            companies: [
                { id: 'space_development', name: '우주 개발공사', price: 1800, change: 0, volume: 0, sector: 'aerospace' },
                { id: 'stellar_energy', name: '성운 에너지', price: 1250, change: 0, volume: 0, sector: 'energy' }
            ]
        },
        aurora_palace: {
            name: '🌨️ 오로라 빙궁',
            companies: [
                { id: 'ice_storage', name: '빙설 냉동업', price: 650, change: 0, volume: 0, sector: 'storage' },
                { id: 'aurora_tourism', name: '오로라 관광', price: 880, change: 0, volume: 0, sector: 'tourism' }
            ]
        },
        chaos_realm: {
            name: '👹 혼돈의 마경',
            companies: [
                { id: 'dark_mining', name: '어둠 광업', price: 1050, change: 0, volume: 0, sector: 'mining' },
                { id: 'chaos_mercenary', name: '마경 용병단', price: 1300, change: 0, volume: 0, sector: 'military' }
            ]
        },
        creation_temple: {
            name: '🏛️ 창조의 신전',
            companies: [
                { id: 'creation_tech', name: '창조 기술원', price: 2000, change: 0, volume: 0, sector: 'technology' },
                { id: 'divine_service', name: '신성 서비스', price: 1600, change: 0, volume: 0, sector: 'service' }
            ]
        }
    },
    
    // 전 지역 체인 기업들
    chains: [
        { id: 'potion_shop', name: '만능 포션샵', price: 900, change: 0, volume: 0, sector: 'retail' },
        { id: 'weapon_store', name: '범용 무기고', price: 1000, change: 0, volume: 0, sector: 'retail' },
        { id: 'adventure_tailor', name: '모험가 의상실', price: 750, change: 0, volume: 0, sector: 'retail' },
        { id: 'general_store', name: '만물상 마트', price: 600, change: 0, volume: 0, sector: 'retail' },
        { id: 'traveler_inn', name: '여행자 여관', price: 800, change: 0, volume: 0, sector: 'hospitality' }
    ],

    // NPC 감정 상태
    npc_emotions: {
        villagers: { happiness: 50, stress: 30, excitement: 40 },
        merchants: { greed: 60, satisfaction: 45, anxiety: 35 },
        scammers: { confidence: 70, suspicion: 20, desperation: 40 },
        travelers: { wanderlust: 80, homesickness: 25, curiosity: 90 }
    },

    // 글로벌 시장 상태
    market_state: {
        overall_trend: 0, // -100 to +100
        volatility: 30, // 0 to 100
        player_actions: {
            total_enhancement_attempts: 0,
            successful_enhancements: 0,
            legendary_crafts: 0,
            shop_purchases: 0,
            hunt_sessions: 0
        }
    },
    
    // 실시간 차트 데이터 (최대 50개 데이터포인트)
    chart_history: {
        timestamps: [],
        market_index: [], // 전체 시장 지수
        top_companies: {} // 주요 기업별 가격 히스토리
    }
};

// 혁신적인 이벤트 시스템
const MARKET_EVENTS = [
    // 몬스터 관련 이벤트 (1-20)
    {
        id: 1,
        title: "크리스탈 동굴에 다이아 나비 떼 대량 출현!",
        description: "채굴 작업 일시 중단되어 크리스탈 공급 부족",
        effects: [
            { company: 'crystal_mining', change: -25 },
            { company: 'potion_shop', change: 15 }
        ],
        triggers: ['monster_spawn_crystal_cave'],
        probability: 15
    },
    {
        id: 2,
        title: "솜사탕 구름성에서 천사 고래 목격!",
        description: "관광객 몰려들어 지역 경제 활성화",
        effects: [
            { company: 'cotton_candy', change: 30 },
            { company: 'cloud_transport', change: 20 },
            { company: 'traveler_inn', change: 25 }
        ],
        triggers: ['rare_monster_sighting'],
        probability: 8
    },
    // 강화 관련 이벤트 (21-35) - +20강 이상으로 수정
    {
        id: 21,
        title: "전설의 +20강 달성! 전국 강화 열풍 재점화",
        description: "강화왕의 업적에 모험가들이 열광하며 강화 관련 업계 대호황",
        effects: [
            { company: 'crystal_processing', change: 60 },
            { company: 'dragon_weapons', change: 45 },
            { company: 'weapon_store', change: 40 },
            { company: 'potion_shop', change: 35 }
        ],
        triggers: ['player_enhancement_20_plus'],
        probability: 100 // 플레이어가 +20강 달성시 100% 발생
    },
    {
        id: 22,
        title: "연속 강화 실패로 모험가들 좌절감 확산",
        description: "힐링 서비스와 위로 관련 업계에 특수 발생",
        effects: [
            { company: 'dream_healing', change: 35 },
            { company: 'angel_medical', change: 25 },
            { company: 'traveler_inn', change: 20 },
            { company: 'crystal_processing', change: -15 }
        ],
        triggers: ['multiple_enhancement_failures'],
        probability: 30
    },
    // 시간대별 이벤트
    {
        id: 51,
        title: "새벽의 고요 속 야행성 몬스터 활동 증가",
        description: "밤샘 모험가들을 위한 서비스 수요 급증",
        effects: [
            { company: 'potion_shop', change: 20 },
            { company: 'angel_medical', change: 15 }
        ],
        triggers: ['time_2_6'],
        probability: 60
    },
    {
        id: 52,
        title: "점심시간 대형 길드들의 단체 식사",
        description: "음식 관련 업계와 사교 서비스 호황",
        effects: [
            { company: 'cotton_candy', change: 25 },
            { company: 'traveler_inn', change: 20 }
        ],
        triggers: ['time_12_14'],
        probability: 40
    }
];

// 플레이어별 포트폴리오 저장용 글로벌 변수
global.playerPortfolios = new Map();

// 🚀 혁신적인 주식 시스템 핵심 함수들

// 모든 회사 주식 가격 업데이트 함수
function updateStockPrices() {
    // 시간대별 효과 적용
    const hour = new Date().getHours();
    applyTimeBasedEffects(hour);
    
    // NPC 감정 변화 적용
    updateNPCEmotions();
    
    // 랜덤 이벤트 발생 확인
    checkRandomEvents();
    
    // 기본 시장 변동성 적용
    applyBaseVolatility();
}

// NPC 감정 변화 함수
function updateNPCEmotions() {
    const emotions = STOCK_MARKET.npc_emotions;
    
    // 의뢰 성공/실패에 따른 NPC 감정 변화
    Object.keys(emotions).forEach(npcType => {
        // 랜덤 감정 변화 (-5 ~ +5)
        Object.keys(emotions[npcType]).forEach(emotion => {
            emotions[npcType][emotion] += (Math.random() - 0.5) * 10;
            emotions[npcType][emotion] = Math.max(0, Math.min(100, emotions[npcType][emotion]));
        });
    });
    
    // 감정에 따른 주식 변동
    if (emotions.villagers.happiness > 70) {
        adjustStockPrice('traveler_inn', 5);
        adjustStockPrice('cotton_candy', 3);
    }
    
    if (emotions.merchants.greed > 80) {
        adjustStockPrice('weapon_store', 8);
        adjustStockPrice('potion_shop', 6);
    }
}

// 시간대별 효과 적용
function applyTimeBasedEffects(hour) {
    if (hour >= 2 && hour <= 6) {
        // 새벽 시간 - 야행성 서비스 상승
        adjustStockPrice('potion_shop', 3);
        adjustStockPrice('angel_medical', 2);
    } else if (hour >= 12 && hour <= 14) {
        // 점심 시간 - 음식 관련 상승
        adjustStockPrice('cotton_candy', 4);
        adjustStockPrice('traveler_inn', 3);
    } else if (hour >= 18 && hour <= 22) {
        // 저녁 시간 - 엔터테인먼트 상승
        adjustStockPrice('fantasy_entertainment', 5);
        adjustStockPrice('dream_healing', 3);
    }
}

// 강화 성공/실패 이벤트 트리거
function triggerEnhancementEvent(enhanceLevel, success) {
    if (success && enhanceLevel >= 20) {
        // +20강 이상 성공시 대형 이벤트
        triggerMarketEvent(21);
        STOCK_MARKET.market_state.player_actions.successful_enhancements++;
    } else if (!success) {
        // 강화 실패시 힐링 관련주 상승
        adjustStockPrice('dream_healing', 8);
        adjustStockPrice('angel_medical', 5);
    }
    
    STOCK_MARKET.market_state.player_actions.total_enhancement_attempts++;
}

// 플레이어 행동 기록 함수
function recordPlayerAction(actionType, details = {}) {
    const actions = STOCK_MARKET.market_state.player_actions;
    
    switch(actionType) {
        case 'shop_purchase':
            actions.shop_purchases++;
            adjustStockPrice('general_store', 1);
            break;
        case 'hunt_start':
            actions.hunt_sessions++;
            adjustStockPrice('weapon_store', 2);
            adjustStockPrice('potion_shop', 2);
            break;
        case 'legendary_craft':
            actions.legendary_crafts++;
            adjustStockPrice('creation_tech', 20);
            break;
        case 'racing_event':
            // 레이싱 이벤트가 주식 시장에 미치는 영향
            if (details.potSize > 30000) {
                adjustStockPrice('fantasy_entertainment', 15); // 엔터테인먼트
                adjustStockPrice('traveler_inn', 10);           // 여관업
            }
            if (details.participants >= 6) {
                adjustStockPrice('aurora_tourism', 8); // 관광업
            }
            break;
    }
}

// 랜덤 이벤트 체크
function checkRandomEvents() {
    MARKET_EVENTS.forEach(event => {
        if (Math.random() * 100 < event.probability) {
            triggerMarketEvent(event.id);
        }
    });
}

// 마켓 이벤트 발생 함수
function triggerMarketEvent(eventId) {
    const event = MARKET_EVENTS.find(e => e.id === eventId);
    if (!event) return;
    
    // 이벤트 효과 적용
    event.effects.forEach(effect => {
        adjustStockPrice(effect.company, effect.change);
    });
    
    // 글로벌 채널에 뉴스 발송 (나중에 구현)
    console.log(`📰 마켓 뉴스: ${event.title}`);
    
    return event;
}

// 주식 가격 조정 함수
function adjustStockPrice(companyId, changePercent) {
    // 지역 기업들 확인
    for (const region of Object.values(STOCK_MARKET.regions)) {
        const company = region.companies.find(c => c.id === companyId);
        if (company) {
            const oldPrice = company.price;
            company.price = Math.max(50, Math.floor(company.price * (1 + changePercent / 100)));
            company.change = ((company.price - oldPrice) / oldPrice * 100);
            company.volume += Math.floor(Math.random() * 1000) + 100;
            return;
        }
    }
    
    // 체인 기업들 확인
    const chainCompany = STOCK_MARKET.chains.find(c => c.id === companyId);
    if (chainCompany) {
        const oldPrice = chainCompany.price;
        chainCompany.price = Math.max(50, Math.floor(chainCompany.price * (1 + changePercent / 100)));
        chainCompany.change = ((chainCompany.price - oldPrice) / oldPrice * 100);
        chainCompany.volume += Math.floor(Math.random() * 1000) + 100;
    }
}

// 기본 시장 변동성 적용
function applyBaseVolatility() {
    const volatility = STOCK_MARKET.market_state.volatility;
    
    // 모든 주식에 기본 랜덤 변동 적용
    for (const region of Object.values(STOCK_MARKET.regions)) {
        region.companies.forEach(company => {
            const randomChange = (Math.random() - 0.5) * (volatility / 10);
            adjustStockPrice(company.id, randomChange);
        });
    }
    
    STOCK_MARKET.chains.forEach(company => {
        const randomChange = (Math.random() - 0.5) * (volatility / 10);
        adjustStockPrice(company.id, randomChange);
    });
}

// 포트폴리오 관리 함수들
function getPlayerPortfolio(userId) {
    if (!global.playerPortfolios.has(userId)) {
        global.playerPortfolios.set(userId, {
            cash: 10000, // 시작 자금
            stocks: new Map(), // companyId -> { shares, avgPrice }
            totalValue: 10000
        });
    }
    return global.playerPortfolios.get(userId);
}

function buyStock(userId, companyId, shares) {
    const portfolio = getPlayerPortfolio(userId);
    const company = findCompany(companyId);
    
    if (!company) return { success: false, message: '존재하지 않는 기업입니다!' };
    
    const totalCost = company.price * shares;
    if (portfolio.cash < totalCost) {
        return { success: false, message: '자금이 부족합니다!' };
    }
    
    // 구매 실행
    portfolio.cash -= totalCost;
    
    if (portfolio.stocks.has(companyId)) {
        const existing = portfolio.stocks.get(companyId);
        const newAvgPrice = (existing.avgPrice * existing.shares + totalCost) / (existing.shares + shares);
        existing.shares += shares;
        existing.avgPrice = newAvgPrice;
    } else {
        portfolio.stocks.set(companyId, { shares, avgPrice: company.price });
    }
    
    // 거래량 증가
    company.volume += shares;
    
    return { success: true, message: `${company.name} ${shares}주를 ${totalCost.toLocaleString()}골드에 매수했습니다!` };
}

function sellStock(userId, companyId, shares) {
    const portfolio = getPlayerPortfolio(userId);
    const company = findCompany(companyId);
    
    if (!company) return { success: false, message: '존재하지 않는 기업입니다!' };
    if (!portfolio.stocks.has(companyId)) return { success: false, message: '보유하지 않은 주식입니다!' };
    
    const holding = portfolio.stocks.get(companyId);
    if (holding.shares < shares) return { success: false, message: '보유 수량이 부족합니다!' };
    
    // 매도 실행
    const totalValue = company.price * shares;
    portfolio.cash += totalValue;
    holding.shares -= shares;
    
    if (holding.shares === 0) {
        portfolio.stocks.delete(companyId);
    }
    
    // 거래량 증가
    company.volume += shares;
    
    return { success: true, message: `${company.name} ${shares}주를 ${totalValue.toLocaleString()}골드에 매도했습니다!` };
}

function findCompany(companyId) {
    // 지역 기업들 검색
    for (const region of Object.values(STOCK_MARKET.regions)) {
        const company = region.companies.find(c => c.id === companyId);
        if (company) return company;
    }
    
    // 체인 기업들 검색
    return STOCK_MARKET.chains.find(c => c.id === companyId);
}

// 차트 데이터 업데이트 함수
function updateChartData() {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // 전체 시장 지수 계산
    let totalValue = 0;
    let companyCount = 0;
    const topCompanies = [];
    
    // 모든 기업 가격 수집
    for (const region of Object.values(STOCK_MARKET.regions)) {
        for (const company of region.companies) {
            totalValue += company.price;
            companyCount++;
            topCompanies.push(company);
        }
    }
    
    for (const company of STOCK_MARKET.chains) {
        totalValue += company.price;
        companyCount++;
        topCompanies.push(company);
    }
    
    const marketIndex = Math.round(totalValue / companyCount);
    
    // 차트 히스토리 업데이트
    STOCK_MARKET.chart_history.timestamps.push(timestamp);
    STOCK_MARKET.chart_history.market_index.push(marketIndex);
    
    // 모든 기업 추적 (차트 표시용)
    for (const company of topCompanies) {
        if (!STOCK_MARKET.chart_history.top_companies[company.id]) {
            STOCK_MARKET.chart_history.top_companies[company.id] = [];
        }
        STOCK_MARKET.chart_history.top_companies[company.id].push(company.price);
    }
    
    // 최대 50개 데이터포인트 유지
    const maxPoints = 50;
    if (STOCK_MARKET.chart_history.timestamps.length > maxPoints) {
        STOCK_MARKET.chart_history.timestamps = STOCK_MARKET.chart_history.timestamps.slice(-maxPoints);
        STOCK_MARKET.chart_history.market_index = STOCK_MARKET.chart_history.market_index.slice(-maxPoints);
        
        for (const companyId in STOCK_MARKET.chart_history.top_companies) {
            STOCK_MARKET.chart_history.top_companies[companyId] = 
                STOCK_MARKET.chart_history.top_companies[companyId].slice(-maxPoints);
        }
    }
}

// 정기적으로 주식 가격 업데이트 (5분마다)
setInterval(() => {
    updateStockPrices();
    updateChartData();
}, 5 * 60 * 1000);

// 초기 차트 데이터 생성
updateChartData();

// 임시: 차트 데이터 빠르게 채우기 (개발용)
function fillChartDataForDevelopment() {
    console.log('차트 데이터 초기화 중...');
    // 최근 1시간 데이터를 시뮬레이션 (5분 간격으로 12개)
    for (let i = 0; i < 12; i++) {
        updateStockPrices();
        updateChartData();
    }
    console.log('차트 데이터 초기화 완료!');
}

// 봇 시작시 차트 데이터 채우기
setTimeout(() => {
    fillChartDataForDevelopment();
}, 2000);

// QuickChart API를 사용한 실제 차트 생성
async function generateRealChart(chartData, title, type = 'line') {
    try {
        if (!chartData || chartData.length < 2) {
            console.log('차트 데이터가 부족합니다:', chartData?.length || 0);
            return null;
        }
        
        // 데이터를 최대 20개로 제한
        const limitedData = chartData.slice(-20);
        
        // 간단한 시간 레이블 생성
        const labels = [];
        for (let i = 0; i < limitedData.length; i++) {
            labels.push(`-${(limitedData.length - i - 1) * 5}분`);
        }
        
        // 차트 색상 결정
        const isPositive = limitedData[limitedData.length - 1] > limitedData[0];
        
        // 간소화된 차트 설정
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: limitedData,
                    borderColor: isPositive ? '#00ff88' : '#ff4444',
                    backgroundColor: isPositive ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                    borderWidth: 3,
                    fill: true
                }]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: title
                    }
                }
            }
        };
        
        // QuickChart URL 생성 (간소화)
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400`;
        
        console.log('차트 Config:', JSON.stringify(chartConfig, null, 2));
        console.log('차트 URL 생성 완료');
        
        return chartUrl;
    } catch (error) {
        console.error('generateRealChart 오류:', error);
        return null;
    }
}

// 다중 데이터셋 차트 생성 (시장 전체 + 상위 기업들)
async function generateMarketOverviewChart() {
    try {
        const chartHistory = STOCK_MARKET.chart_history;
        
        if (chartHistory.timestamps.length === 0) return null;
        
        // 최근 15개 데이터만 사용 (URL 길이 단축)
        const dataPoints = 15;
        const labels = [];
        for (let i = 0; i < dataPoints; i++) {
            labels.push(`-${(dataPoints - i - 1) * 5}분`);
        }
        
        // 간소화된 데이터셋
        const datasets = [{
            label: '종합지수',
            data: chartHistory.market_index.slice(-dataPoints),
            borderColor: '#00D4AA',
            borderWidth: 3
        }];
        
        // 상위 2개 기업만 추가 (URL 길이 단축)
        const allCompanies = [];
        for (const region of Object.values(STOCK_MARKET.regions)) {
            allCompanies.push(...region.companies);
        }
        allCompanies.push(...STOCK_MARKET.chains);
        
        const topCompanies = allCompanies
            .sort((a, b) => b.price - a.price)
            .slice(0, 2);
            
        const colors = ['#FF6B6B', '#4ECDC4'];
        topCompanies.forEach((company, index) => {
            if (chartHistory.top_companies[company.id] && chartHistory.top_companies[company.id].length > 1) {
                datasets.push({
                    label: company.name,
                    data: chartHistory.top_companies[company.id].slice(-dataPoints),
                    borderColor: colors[index],
                    borderWidth: 2
                });
            }
        });
        
        // 최소화된 차트 설정
        const chartConfig = {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: '김헌터 실시간 차트'
                    }
                }
            }
        };
        
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400&bkg=rgb(47,49,54)`;
        
        console.log('Market chart URL length:', chartUrl.length);
        
        // URL이 너무 길면 단일 데이터셋으로 축소
        if (chartUrl.length > 2000) {
            const simpleConfig = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '종합지수',
                        data: chartHistory.market_index.slice(-dataPoints),
                        borderColor: '#00D4AA',
                        borderWidth: 3
                    }]
                }
            };
            
            return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(simpleConfig))}&width=800&height=400`;
        }
        
        return chartUrl;
    } catch (error) {
        console.error('generateMarketOverviewChart 오류:', error);
        return null;
    }
}

// ASCII 주식 차트 생성 함수
function generateStockChart() {
    const chartHistory = STOCK_MARKET.chart_history;
    
    if (chartHistory.timestamps.length === 0) {
        return null;
    }

    return generateAdvancedASCIIChart(
        chartHistory.market_index, 
        `김헌터 종합지수 (${chartHistory.timestamps[0]} ~ ${chartHistory.timestamps[chartHistory.timestamps.length - 1]})`
    );
}

// 캔들스틱 차트 생성 (고급)
async function generateCandlestickChart(companyId, companyName) {
    const chartHistory = STOCK_MARKET.chart_history;
    
    if (!chartHistory.top_companies[companyId] || chartHistory.top_companies[companyId].length < 4) {
        return null;
    }
    
    const prices = chartHistory.top_companies[companyId];
    const candleData = [];
    
    // 캔들스틱 데이터 생성 (4개씩 묶어서 OHLC 생성)
    for (let i = 0; i < prices.length - 3; i += 4) {
        const slice = prices.slice(i, i + 4);
        candleData.push({
            x: i,
            o: slice[0],
            h: Math.max(...slice),
            l: Math.min(...slice),
            c: slice[3]
        });
    }
    
    const chartConfig = {
        type: 'candlestick',
        data: {
            datasets: [{
                label: companyName,
                data: candleData,
                color: {
                    up: '#00ff88',
                    down: '#ff4444',
                    unchanged: '#999999'
                }
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    offset: true
                },
                y: {
                    beginAtZero: false
                }
            }
        }
    };
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=400&backgroundColor=rgb(47,49,54)`;
    
    return chartUrl;
}

// 🏁 아바타 레이싱 시스템
class BettingRaceSystem {
    constructor() {
        this.isRacing = false;
        this.waitingPlayers = new Map(); // userId -> player info
        this.raceStartTimer = null;
        this.botTimer = null; // 봇 매칭 타이머
        this.minPlayers = 3;
        this.maxPlayers = 8;
        this.minBet = 1000;
        this.maxBet = 50000;
        this.waitTime = 5000; // 개발용: 5초 대기
        this.botWaitTime = 5000; // 개발용: 5초 후 봇 추가
        this.botNames = [
            '철수', '영희', '민수', '수진', '동호', '지영', '태현', '미라',
            '준호', '소영', '현우', '예린', '승호', '나연', '정민', '하늘',
            '바람', '구름', '햇살', '달빛', '별빛', '천둥', '번개', '폭풍'
        ];
        this.raceLength = 100; // 레이스 거리
        this.frameCount = 50; // GIF 프레임 수 최적화 (크기와 품질 균형)
    }
    
    // 레이싱 GIF 생성
    async createRaceGIF(racers, finalResults = null) {
        console.log(`🏁 GIF 생성 시작: ${racers.length}명 레이서, 최종결과: ${finalResults}`);
        const startTime = Date.now();
        
        // 완주 후 대기 시간을 위한 변수 초기화
        this.finishStartFrame = null;
        
        try {
            // 🚀 아바타 미리 로드 (성능 개선)
            console.log('🖼️ 아바타 이미지 미리 로딩...');
            const avatarCache = new Map();
            
            for (const racer of racers) {
                try {
                    const avatarImg = await Jimp.read(racer.avatar);
                    avatarImg.resize(60, 60);
                    avatarImg.circle();
                    avatarCache.set(racer.userId, avatarImg);
                    console.log(`✅ ${racer.nickname} 아바타 로드 성공`);
                } catch (e) {
                    console.log(`⚠️ ${racer.nickname} 아바타 로드 실패 - 기본 이미지 사용`);
                    const circleColor = racer.isBot ? '#888888' : '#' + Math.floor(Math.random()*16777215).toString(16);
                    const circle = new Jimp(60, 60, circleColor);
                    circle.circle();
                    avatarCache.set(racer.userId, circle);
                }
            }

            // 🏎️ 트랙 이미지 미리 로드 (한 번만!)
            console.log('🏁 트랙 이미지 미리 로딩...');
            let trackImage = null;
            try {
                trackImage = await Jimp.read('./resource/race_track.png');
                console.log('✅ 커스텀 트랙 이미지 로드 성공!');
            } catch (e) {
                console.log('⚠️ 커스텀 트랙 없음 - 기본 트랙 사용');
            }

            // 🌋 배경 이미지 미리 로드 (한 번만!)
            console.log('🎨 배경 이미지 미리 로딩...');
            let backgroundTemplate = null;
            try {
                backgroundTemplate = await Jimp.read('./resource/lava_background.gif');
                console.log('✅ 커스텀 용암 배경 로드 성공!');
            } catch (e) {
                console.log('⚠️ 커스텀 배경 없음 - 기본 용암 배경 생성');
                
                // 기본 용암 배경 생성 (한 번만!)
                const lavaColors = {
                    dark: '#4A0E0E',
                    medium: '#8B0000',
                    bright: '#FF4500',
                    glow: '#FFD700'
                };
                
                backgroundTemplate = await new Promise((resolve, reject) => {
                    new Jimp(1000, 600, lavaColors.dark, (err, img) => {
                        if (err) reject(err);
                        else resolve(img);
                    });
                });
                
                // 용암 효과 추가
                for (let i = 0; i < 50; i++) {
                    const x = Math.random() * 1000;
                    const y = Math.random() * 600;
                    const size = Math.random() * 20 + 5;
                    const intensity = Math.random();
                    
                    let color;
                    if (intensity > 0.8) {
                        color = lavaColors.glow;
                    } else if (intensity > 0.5) {
                        color = lavaColors.bright;
                    } else {
                        color = lavaColors.medium;
                    }
                    
                    const lavaSpot = new Jimp(size, size, color);
                    lavaSpot.opacity(0.3 + intensity * 0.4);
                    lavaSpot.circle();
                    backgroundTemplate.composite(lavaSpot, x - size/2, y - size/2);
                }
            }
            
            const width = 1000;
            const height = 50 + racers.length * 90 + 50;
            const encoder = new GifEncoder(width, height);
            
            encoder.start();
            encoder.setRepeat(-1); // 한 번만 재생 (반복 없음)
            encoder.setDelay(150); // 달리는 속도는 그대로 유지
            encoder.setQuality(15); // 품질 조정 (파일 크기 최적화)
            
            // 📝 폰트 미리 로드 (한 번만!)
            console.log('🔤 폰트 미리 로딩...');
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
            const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
            const laneFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

            // 프레임 생성
            const frames = finalResults ? 1 : this.frameCount;
            console.log(`📽️ 총 ${frames}개 프레임 생성 시작...`);
            
            for (let frame = 0; frame < frames; frame++) {
                if (frame % 10 === 0 || frame < 5 || frame >= frames - 5) {
                    console.log(`📋 프레임 ${frame + 1}/${frames} 생성 중...`);
                }
                
                // 배경 복사 (매번 새로 로드하지 않고 복사!)
                let image;
                if (backgroundTemplate) {
                    backgroundTemplate.resize(width, height);
                    image = backgroundTemplate.clone();
                } else {
                    image = await new Promise((resolve, reject) => {
                        new Jimp(width, height, '#4A0E0E', (err, img) => {
                            if (err) reject(err);
                            else resolve(img);
                        });
                    });
                }
                
                image.print(font, 0, 10, {
                    text: 'KIM HUNTER RACING',
                    alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
                }, width);
                
                // 참가자 순서대로 레이서 정렬 (위에서 아래로)
                const sortedRacers = [...racers].sort((a, b) => a.lane - b.lane);
                
                for (let i = 0; i < sortedRacers.length; i++) {
                    const y = 70 + i * 90; // 크기 최적화된 간격
                    const racer = sortedRacers[i];
                    
                    // 트랙 이미지 로드 (완성된 트랙 이미지 사용)
                    const trackWidth = width - 120;
                    const trackHeight = 80;
                    
                    if (trackImage) {
                        // 커스텀 트랙 이미지 사용 (이미 로드됨!)
                        const trackImg = trackImage.clone();
                        trackImg.resize(trackWidth, trackHeight);
                        image.composite(trackImg, 60, y);
                    } else {
                        // 기본 용암 트랙 생성
                        
                        // 용암 느낌의 트랙 생성
                        const track = new Jimp(trackWidth, trackHeight, '#2A0A0A'); // 어두운 용암 색
                        
                        // 용암 트랙 그라데이션 효과
                        for (let gradY = 0; gradY < trackHeight; gradY++) {
                            const progress = gradY / trackHeight;
                            const r = Math.floor(42 + progress * 50);  // 42-92
                            const g = Math.floor(10 + progress * 20);  // 10-30  
                            const b = Math.floor(10 + progress * 10);  // 10-20
                            
                            const gradLine = new Jimp(trackWidth, 1, Jimp.rgbaToInt(r, g, b, 255));
                            track.composite(gradLine, 0, gradY);
                        }
                        
                        // 용암 느낌 중앙선 (뜨거운 마그마 같이)
                        for (let dashX = 0; dashX < trackWidth; dashX += 25) {
                            const dashLine = new Jimp(15, 3, '#FF6600'); // 주황색 중앙선
                            dashLine.opacity(0.8);
                            track.composite(dashLine, dashX, Math.floor(trackHeight/2) - 1);
                            
                            // 글로우 효과
                            const glow = new Jimp(20, 5, '#FFD700');
                            glow.opacity(0.3);
                            track.composite(glow, dashX - 2, Math.floor(trackHeight/2) - 2);
                        }
                        
                        // 용암 테두리 (뜨거운 가장자리)
                        const topBorder = new Jimp(trackWidth, 4, '#FF4500');
                        topBorder.opacity(0.9);
                        const bottomBorder = new Jimp(trackWidth, 4, '#FF4500');
                        bottomBorder.opacity(0.9);
                        track.composite(topBorder, 0, 0);
                        track.composite(bottomBorder, 0, trackHeight - 4);
                        
                        // 바깥 그림자
                        const topShadow = new Jimp(trackWidth, 2, '#000000');
                        topShadow.opacity(0.5);
                        const bottomShadow = new Jimp(trackWidth, 2, '#000000');
                        bottomShadow.opacity(0.5);
                        track.composite(topShadow, 0, 4);
                        track.composite(bottomShadow, 0, trackHeight - 6);
                        
                        // 용암 결승선 (뜨거운 체크 패턴)
                        for (let checkY = 0; checkY < trackHeight; checkY += 6) {
                            for (let checkX = trackWidth - 12; checkX < trackWidth; checkX += 6) {
                                const isHot = (Math.floor(checkY/6) + Math.floor(checkX/6)) % 2 === 0;
                                const checkColor = isHot ? '#FFD700' : '#8B0000'; // 금색/진한 빨간색
                                const checkSquare = new Jimp(6, Math.min(6, trackHeight - checkY), checkColor);
                                checkSquare.opacity(0.9);
                                track.composite(checkSquare, checkX, checkY);
                            }
                        }
                        
                        image.composite(track, 60, y);
                    }
                    
                    // 레이서 정보 (이미 위에서 정의됨)
                    let progress;
                    
                    if (finalResults) {
                        // 최종 결과 표시
                        progress = racer.finished ? 100 : (racer.position || 0);
                    } else {
                        // 애니메이션 진행 (랜덤하지만 3등까지 확실히 도착)
                        const frameProgress = frame / this.frameCount;
                        
                        // 각 레이서의 기본 속도 (약간의 차이)
                        if (!racer.fixedSpeed) {
                            racer.fixedSpeed = Math.random() * 1.2 + 0.7; // 0.7-1.9 범위
                        }
                        
                        // 랜덤성 추가 (재미를 위해!)
                        const mainRandomness = Math.sin(frame * 0.1 + i) * 0.08; // 큰 랜덤성
                        const microRandomness = (Math.random() - 0.5) * 0.05; // 미세한 랜덤성
                        const totalRandomness = mainRandomness + microRandomness;
                        
                        // 기본 진행률 계산
                        let baseProgress = frameProgress * 0.85; // 85% 기본 진행
                        const speedMultiplier = racer.fixedSpeed;
                        
                        progress = Math.min(
                            (baseProgress + totalRandomness) * speedMultiplier * 100,
                            100
                        );
                        
                        // 각 레이서 위치 업데이트
                        racer.currentProgress = progress;
                        
                        // 후반부에서 뒤처진 레이서들 부스트 (3등까지 보장하되 랜덤성 유지)
                        if (frame >= this.frameCount * 0.8) {
                            const currentRanking = [...sortedRacers]
                                .map(r => ({ ...r, currentProgress: r.currentProgress || 0 }))
                                .sort((a, b) => b.currentProgress - a.currentProgress);
                            
                            const currentPosition = currentRanking.findIndex(r => r.userId === racer.userId) + 1;
                            
                            // 4위 이하인 레이서들에게만 부스트 (상위 3명은 자연스럽게)
                            if (currentPosition > 3) {
                                const boostProgress = (frame - this.frameCount * 0.8) / (this.frameCount * 0.2);
                                const boost = boostProgress * 12; // 점진적 부스트
                                progress = Math.min(progress + boost, 100);
                                racer.currentProgress = progress;
                            }
                        }
                    }
                    
                    // 아바타 위치
                    const avatarX = 60 + (width - 180) * (progress / 100);
                    
                    // 스피드 라인 효과 (빠르게 움직일 때)
                    if (!finalResults && racer.speed > 3) {
                        for (let s = 0; s < 3; s++) {
                            const lineX = avatarX - 40 - (s * 15);
                            if (lineX > 50) {
                                const speedLine = new Jimp(12, 3, '#FFFFFF');
                                speedLine.opacity(0.3 - s * 0.1);
                                image.composite(speedLine, lineX, y + 20 + s * 5);
                            }
                        }
                    }
                    
                    // 아바타 그리기 (캐시된 이미지 사용)
                    const cachedAvatar = avatarCache.get(racer.userId);
                    if (cachedAvatar) {
                        // 우승자 효과 (골든 테두리) - 아바타와 정확히 같은 위치
                        if (finalResults && racer.finishPosition === 1) {
                            const goldBorder = new Jimp(66, 66, '#FFD700');
                            goldBorder.circle();
                            image.composite(goldBorder, avatarX - 33, y + 7); // 아바타(y+10)보다 3픽셀 위로
                        }
                        
                        // 캐시된 아바타 복사본 사용 (원본 보호)
                        const avatarCopy = cachedAvatar.clone();
                        image.composite(avatarCopy, avatarX - 30, y + 10);
                    }
                    
                    // 레이너 번호 표시 (위에서 아래 순서)
                    const laneNumberBg = new Jimp(50, 50, '#2C2F33');
                    const laneNumberBorder = new Jimp(54, 54, '#FFFFFF');
                    image.composite(laneNumberBorder, 15, y + 25);
                    image.composite(laneNumberBg, 17, y + 27);
                    
                    // 레이너 번호 텍스트 (영어 숫자로)
                    image.print(laneFont, 17, y + 27, {
                        text: `${i + 1}`,
                        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
                    }, 50, 50);
                    
                    // 베팅금 표시 (아바타와 같은 라인에)
                    const betText = `${racer.betAmount.toLocaleString()}G`;
                    image.print(smallFont, 80, y + 30, {
                        text: betText,
                        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT
                    }, 200);
                    
                    // 순위 표시 (최종 결과일 때)
                    if (finalResults && racer.finishPosition > 0) {
                        const rankText = `#${racer.finishPosition}`;
                        image.print(font, width - 100, y + 15, rankText);
                    }
                    
                    // 진행률 바
                    const barBg = new Jimp(width - 120, 8, '#1a1a1a');
                    image.composite(barBg, 60, y + 85);
                    
                    const progressWidth = Math.max(1, (width - 120) * (progress / 100));
                    const barFill = new Jimp(progressWidth, 8, racer.finished ? '#00FF00' : '#00AAFF');
                    image.composite(barFill, 60, y + 85);
                }
                
                // 하단 정보만 표시 (순위 텍스트 제거)
                if (!finalResults) {
                    const totalPot = racers.reduce((sum, r) => sum + r.betAmount, 0);
                    
                    // 상금 정보만 표시
                    image.print(font, 0, height - 50, {
                        text: `TOTAL PRIZE: ${totalPot.toLocaleString()}G`,
                        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER
                    }, width);
                }
                
                // 상위 3명이 완주했는지 확인 (3등까지 도착 대기)
                const currentRanking = [...sortedRacers]
                    .map(r => ({ ...r, currentProgress: r.currentProgress || 0 }))
                    .sort((a, b) => b.currentProgress - a.currentProgress);
                
                const topThreeFinished = currentRanking.slice(0, 3).every(r => r.currentProgress >= 99.9);
                
                // 로그로 상위 3명 진행률 확인
                if (frame % 10 === 0) {
                    const top3Progress = currentRanking.slice(0, 3).map(r => 
                        `${r.nickname}: ${r.currentProgress?.toFixed(1) || 0}%`
                    );
                    console.log(`📊 상위 3명 진행률: ${top3Progress.join(', ')}`);
                }
                
                // 상위 3명 완주 후 1초 더 대기 (결과 감상 시간)
                if (!finalResults && topThreeFinished && frame >= 10) {
                    if (!this.finishStartFrame) {
                        this.finishStartFrame = frame;
                        console.log('🏁 상위 3명 완주! 1초 더 진행 후 종료');
                    }
                    
                    // 1초 더 진행 (170ms × 6프레임 = 약 1초)
                    if (frame >= this.finishStartFrame + 6) {
                        console.log('✅ 결과 감상 시간 완료 - 애니메이션 종료');
                        console.log('최종 순위:', currentRanking.slice(0, 3).map(r => 
                            `${r.nickname} (${r.currentProgress?.toFixed(1)}%)`
                        ));
                        break;
                    }
                }
                
                // 프레임 추가
                encoder.addFrame(image.bitmap.data);
            }
            
            encoder.finish();
            
            // GIF 버퍼 반환
            const buffer = encoder.out.getData();
            const endTime = Date.now();
            const generateTime = endTime - startTime;
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            
            console.log(`✅ GIF 생성 완료! 크기: ${buffer.length} bytes (${sizeMB}MB), 소요시간: ${generateTime}ms`);
            
            // Discord 파일 크기 제한 체크 (8MB)
            const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
            if (buffer.length > MAX_FILE_SIZE) {
                console.log(`⚠️ 파일 크기가 Discord 제한(8MB)을 초과합니다. 현재: ${sizeMB}MB`);
                console.log(`📉 더 작은 GIF를 생성하기 위해 설정을 조정해주세요.`);
                
                // 크기 초과 시에도 일단 반환 (추후 압축 로직 추가 가능)
                return buffer;
            } else {
                console.log(`✅ Discord 파일 크기 제한 내 (${sizeMB}MB < 8MB)`);
                return buffer;
            }
            
        } catch (error) {
            console.error('❌ 레이싱 GIF 생성 오류:', error);
            console.error('에러 스택:', error.stack);
            return null;
        }
    }

    // 레이스 참가
    async joinRace(userId, betAmount, user, avatar, channel = null) {
        // 베팅 금액 검증
        if (betAmount < this.minBet || betAmount > this.maxBet) {
            return { 
                success: false, 
                message: `베팅 금액은 ${this.minBet.toLocaleString()}~${this.maxBet.toLocaleString()}<:currency_emoji:1377404064316522778> 범위여야 합니다!` 
            };
        }

        if (user.gold < betAmount) {
            return { success: false, message: '골드가 부족합니다!' };
        }

        // 이미 참가중인지 확인
        if (this.waitingPlayers.has(userId)) {
            return { success: false, message: '이미 레이스에 참가하셨습니다!' };
        }

        // 참가자 수 제한
        if (this.waitingPlayers.size >= this.maxPlayers) {
            return { success: false, message: `참가자가 꽉 찼습니다! (최대 ${this.maxPlayers}명)` };
        }

        // 골드 차감 및 참가 등록
        user.gold -= betAmount;
        await user.save();

        const player = {
            userId,
            nickname: user.nickname,
            avatar: avatar || `https://cdn.discordapp.com/embed/avatars/${userId % 5}.png`, // 기본 아바타
            betAmount,
            position: 0,
            speed: 0,
            lane: this.waitingPlayers.size,
            finished: false,
            finishPosition: 0
        };

        this.waitingPlayers.set(userId, player);

        // 첫 번째 참가자일 때 봇 타이머 시작
        if (this.waitingPlayers.size === 1 && !this.botTimer) {
            this.startBotTimer(channel);
        }

        // 최소 인원 충족시 레이스 카운트다운 시작
        if (this.waitingPlayers.size >= this.minPlayers && !this.raceStartTimer) {
            this.startCountdown(channel);
            // 봇 타이머가 있으면 취소
            if (this.botTimer) {
                clearTimeout(this.botTimer);
                this.botTimer = null;
            }
        }

        return { 
            success: true, 
            message: `${betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>로 레이스에 참가했습니다!`,
            currentPlayers: this.waitingPlayers.size,
            totalPot: this.getTotalPot()
        };
    }

    // 레이스 나가기
    async leaveRace(userId) {
        const player = this.waitingPlayers.get(userId);
        if (!player) {
            return { success: false, message: '레이스에 참가하지 않았습니다!' };
        }

        // 골드 환불
        const user = await getUser(userId);
        user.gold += player.betAmount;
        await user.save();

        this.waitingPlayers.delete(userId);

        // 레인 재정렬
        let lane = 0;
        for (const [playerId, playerData] of this.waitingPlayers) {
            playerData.lane = lane++;
        }

        // 최소 인원 미달시 타이머 취소
        if (this.waitingPlayers.size < this.minPlayers && this.raceStartTimer) {
            clearTimeout(this.raceStartTimer);
            this.raceStartTimer = null;
        }

        // 참가자가 없어지면 봇 타이머 시작
        if (this.waitingPlayers.size === 1 && !this.botTimer && !this.raceStartTimer) {
            this.startBotTimer(channel);
        } else if (this.waitingPlayers.size === 0) {
            // 모든 참가자가 나가면 모든 타이머 취소
            if (this.botTimer) {
                clearTimeout(this.botTimer);
                this.botTimer = null;
            }
        }

        return { 
            success: true, 
            message: `레이스에서 나갔습니다. ${player.betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>이 환불되었습니다.`,
            currentPlayers: this.waitingPlayers.size,
            totalPot: this.getTotalPot()
        };
    }

    // 총 상금 계산
    getTotalPot() {
        return Array.from(this.waitingPlayers.values()).reduce((sum, p) => sum + p.betAmount, 0);
    }

    // 카운트다운 시작
    startCountdown(channel = null) {
        this.raceStartTimer = setTimeout(async () => {
            if (this.waitingPlayers.size >= this.minPlayers) {
                await this.startRace(channel);
            }
        }, this.waitTime);
    }

    // 봇 타이머 시작
    startBotTimer(channel = null) {
        this.botTimer = setTimeout(async () => {
            if (this.waitingPlayers.size > 0 && this.waitingPlayers.size < this.minPlayers) {
                await this.addBots(channel);
            }
        }, this.botWaitTime);
    }

    // 봇 추가
    async addBots(channel = null) {
        const currentPlayerCount = this.waitingPlayers.size;
        const botsNeeded = this.minPlayers - currentPlayerCount;
        
        if (botsNeeded <= 0 || currentPlayerCount === 0) return;

        // 기존 참가자들의 평균 베팅 금액 계산
        const existingPlayers = Array.from(this.waitingPlayers.values());
        const avgBet = Math.floor(
            existingPlayers.reduce((sum, p) => sum + p.betAmount, 0) / existingPlayers.length
        );

        // 봇들 추가
        for (let i = 0; i < botsNeeded; i++) {
            const botId = `bot_${Date.now()}_${i}`;
            const botName = this.getRandomBotName();
            
            // 평균 베팅액 ±20% 범위에서 봇 베팅 설정
            const variationPercent = (Math.random() - 0.5) * 0.4; // -0.2 ~ 0.2
            const botBet = Math.max(
                this.minBet,
                Math.min(
                    this.maxBet,
                    Math.floor(avgBet * (1 + variationPercent))
                )
            );

            const botPlayer = {
                userId: botId,
                nickname: `🤖 ${botName}`,
                avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
                betAmount: botBet,
                position: 0,
                speed: 0,
                lane: this.waitingPlayers.size,
                finished: false,
                finishPosition: 0,
                isBot: true
            };

            this.waitingPlayers.set(botId, botPlayer);
        }

        // 봇 추가 알림
        if (channel) {
            const botEmbed = new EmbedBuilder()
                .setColor('#4CAF50')
                .setTitle('🤖 봇 매칭 완료!')
                .setDescription(`참가자가 부족하여 **${botsNeeded}명의 봇**이 자동으로 추가되었습니다!\n\n⏰ **1분 후 레이스가 시작됩니다!**`)
                .addFields(
                    { name: '현재 참가자', value: `총 ${this.waitingPlayers.size}명 (플레이어 ${currentPlayerCount}명 + 봇 ${botsNeeded}명)`, inline: true },
                    { name: '💰 총 상금풀', value: `${this.getTotalPot().toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                )
                .setFooter({ text: '🎲 봇도 완전 랜덤! 누구나 우승 가능합니다!' });

            await channel.send({ embeds: [botEmbed] });
        }

        // 레이스 카운트다운 시작
        this.startCountdown(channel);
        this.botTimer = null;
    }

    // 랜덤 봇 이름 선택
    getRandomBotName() {
        const usedNames = Array.from(this.waitingPlayers.values())
            .filter(p => p.isBot)
            .map(p => p.nickname.replace('🤖 ', ''));
        
        const availableNames = this.botNames.filter(name => !usedNames.includes(name));
        
        if (availableNames.length === 0) {
            return `봇${Math.floor(Math.random() * 1000)}`;
        }
        
        return availableNames[Math.floor(Math.random() * availableNames.length)];
    }

    // 완전 랜덤 레이스 시뮬레이션
    simulateRace() {
        const players = Array.from(this.waitingPlayers.values());
        const raceFrames = [];
        
        // 플레이어 초기화
        players.forEach(player => {
            player.position = 0; // 시작 위치
            player.speed = 0; // 초기 속도
            player.finished = false; // 완주 여부
            player.finishPosition = 0; // 순위
        });
        
        // 120프레임 (12초) 레이스
        for (let frame = 0; frame < 120; frame++) {
            players.forEach(player => {
                if (!player.finished) {
                    // 완전 랜덤 속도 (스탯 무관!)
                    player.speed = Math.random() * 4 + 1; // 1-5 속도
                    
                    // 특별 이벤트 (완전 운빨)
                    if (Math.random() < 0.05) {
                        player.speed *= 2; // 5% 럭키 부스터!
                    }
                    if (Math.random() < 0.03) {
                        player.speed *= 0.3; // 3% 언럭키 슬립!
                    }
                    
                    // 위치 업데이트
                    player.position = Math.min(player.position + player.speed * 0.8, 100);
                    
                    // 결승선 체크
                    if (player.position >= 100 && !player.finished) {
                        player.finished = true;
                        // 현재까지 완주한 플레이어 수 + 1 (자신 포함)
                        const finishedCount = players.filter(p => p.finished).length;
                        player.finishPosition = finishedCount;
                        console.log(`플레이어 ${player.nickname}이 ${player.finishPosition}위로 완주했습니다!`);
                    }
                }
            });
            
            // 현재 프레임 저장
            raceFrames.push({
                frame,
                players: players.map(p => ({
                    userId: p.userId,
                    nickname: p.nickname,
                    position: Math.round(p.position * 10) / 10,
                    speed: Math.round(p.speed * 10) / 10,
                    finished: p.finished,
                    lane: p.lane
                }))
            });
            
            // 모든 플레이어가 완주하면 종료
            if (players.every(p => p.finished)) break;
        }
        
        return raceFrames;
    }

    // 레이스 시작
    async startRace(channel = null) {
        if (this.isRacing) return;
        this.isRacing = true;

        try {
            const players = Array.from(this.waitingPlayers.values());
            const totalPot = this.getTotalPot();
            
            // 레이스 시작 알림
            if (channel) {
                const startEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🏁 레이스 준비중!')
                    .setDescription(`**선수들이 경기장에 입장중...**\n\n${players.length}명의 레이서가 **${totalPot.toLocaleString()}<:currency_emoji:1377404064316522778>** 상금을 놓고 경주합니다!`)
                    .addFields(
                        { name: '🏃‍♂️ 참가자', value: players.map((p, i) => `${i + 1}번 ${p.nickname}`).join('\n'), inline: true },
                        { name: '💰 베팅금', value: players.map(p => `${p.betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>`).join('\n'), inline: true }
                    )
                    .setFooter({ text: '🎲 완전 운빨! 누가 이길까요?' });
                
                const startMsg = await channel.send({ embeds: [startEmbed] });
                
            }

            const raceFrames = this.simulateRace();
            
            // 순위 결정 (완주 시간 기준, 미완주는 진행률 기준)
            players.sort((a, b) => {
                if (a.finished && b.finished) {
                    // 둘 다 완주한 경우: 완주 순서로 정렬
                    return a.finishPosition - b.finishPosition;
                } else if (a.finished && !b.finished) {
                    // a만 완주한 경우: a가 더 높은 순위
                    return -1;
                } else if (!a.finished && b.finished) {
                    // b만 완주한 경우: b가 더 높은 순위
                    return 1;
                } else {
                    // 둘 다 미완주한 경우: 진행률로 정렬 (높은 진행률이 더 높은 순위)
                    return b.position - a.position;
                }
            });
            
            console.log('최종 순위:');
            players.forEach((player, index) => {
                console.log(`${index + 1}위: ${player.nickname} (완주: ${player.finished}, 진행률: ${player.position}%, 완주순서: ${player.finishPosition})`);
            });

            const winner = players[0];
            
            // 레이싱 GIF 생성 및 표시
            if (channel) {
                try {
                    // 레이싱 애니메이션 GIF 생성
                    const raceGifBuffer = await this.createRaceGIF(players, false);
                    
                    if (raceGifBuffer) {
                        console.log('📤 GIF 전송 시작...');
                        const raceAttachment = new AttachmentBuilder(raceGifBuffer, { name: 'race_animation.gif' });
                        
                        try {
                            // 임베드 없이 직접 GIF 전송 (더 크게 보임)
                            const sentMessage = await channel.send({ 
                                content: '🏁 **레이스 진행중!** 🏁\n실시간 레이싱 진행 상황을 확인하세요!',
                                files: [raceAttachment] 
                            });
                            console.log('✅ GIF 전송 성공!');
                            
                            // 레이스 진행 시간 연장 (12초 대기 - 모든 레이서 도착 보장)
                            await new Promise(resolve => setTimeout(resolve, 12000));
                        } catch (sendError) {
                            console.error('❌ GIF 전송 실패:', sendError);
                            console.error('전송 에러 세부사항:', sendError.message);
                        }
                    } else {
                        console.log('⚠️ GIF 버퍼가 비어있음 - 전송 스킵');
                    }
                } catch (error) {
                    console.error('❌ 레이싱 GIF 생성/전송 오류:', error);
                    console.error('전체 에러 스택:', error.stack);
                    
                    // GIF 실패 시 텍스트만 전송
                    try {
                        await channel.send('❌ 레이스 애니메이션 생성에 실패했습니다. 결과만 표시합니다.');
                    } catch (e) {
                        console.error('텍스트 전송도 실패:', e);
                    }
                }
            }

            // 우승자에게 상금 지급 (봇이 이기면 2위 실제 플레이어가 상금 획득)
            const actualWinner = await this.awardPrize(winner, totalPot, players);
            
            // 결과 발표
            if (channel) {
                const isWinnerBot = winner.isBot;
                const displayWinner = actualWinner || winner;
                
                let resultDescription = '';
                if (isWinnerBot && actualWinner) {
                    resultDescription = `🤖 **${winner.nickname}**이 1위로 완주했지만,\n실제 상금은 최고 순위 플레이어인 **${actualWinner.nickname}**님이 획득했습니다!\n\n💰 상금 **${totalPot.toLocaleString()}<:currency_emoji:1377404064316522778>**을 획득했습니다!`;
                } else if (isWinnerBot) {
                    resultDescription = `🤖 **${winner.nickname}**이 우승했습니다!\n\n💸 모든 참가자가 봇이었으므로 상금은 소멸됩니다.`;
                } else {
                    resultDescription = `**${winner.nickname}**님이 우승했습니다!\n\n💰 상금 **${totalPot.toLocaleString()}<:currency_emoji:1377404064316522778>**을 획득했습니다!`;
                }

                // 최종 결과 이미지 생성
                let resultAttachment = null;
                try {
                    const resultGifBuffer = await this.createRaceGIF(players, true);
                    if (resultGifBuffer) {
                        resultAttachment = new AttachmentBuilder(resultGifBuffer, { name: 'race_result.png' });
                    }
                } catch (error) {
                    console.error('결과 이미지 생성 오류:', error);
                }
                
                const resultEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 레이스 결과!')
                    .setDescription(resultDescription)
                    .setFooter({ text: '🎲 다음 레이스에도 도전해보세요!' });
                
                if (resultAttachment) {
                    resultEmbed.setImage('attachment://race_result.png');
                }
                
                // 순위 표시
                const rankText = players.map((p, i) => 
                    `${i + 1}위: ${p.nickname} (${p.betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>)`
                ).join('\n');
                resultEmbed.addFields({ name: '📊 최종 순위', value: rankText, inline: false });
                
                const messageOptions = { embeds: [resultEmbed] };
                if (resultAttachment) {
                    messageOptions.files = [resultAttachment];
                }
                
                await channel.send(messageOptions);
            }

            // 레이싱 데이터 반환
            return {
                success: true,
                winner,
                totalPot,
                players,
                raceFrames: raceFrames.filter((_, i) => i % 4 === 0) // 30프레임으로 압축
            };

        } catch (error) {
            console.error('레이스 시뮬레이션 오류:', error);
            return { success: false, error: '레이스 처리 중 오류가 발생했습니다.' };
        } finally {
            this.isRacing = false;
            this.waitingPlayers.clear();
            this.raceStartTimer = null;
        }
    }

    // 상금 지급 및 통계 업데이트
    async awardPrize(winner, totalPot, allPlayers) {
        try {
            let actualWinner = winner;
            let prizeAwarded = false;

            // 봇이 우승한 경우 실제 플레이어 중 최고 순위자에게 상금 지급
            if (winner.isBot) {
                const realPlayers = allPlayers.filter(p => !p.isBot);
                if (realPlayers.length > 0) {
                    actualWinner = realPlayers[0]; // 실제 플레이어 중 1위
                    const winnerUser = await getUser(actualWinner.userId);
                    winnerUser.gold += totalPot;
                    await winnerUser.save();
                    prizeAwarded = true;
                }
                // 실제 플레이어가 없으면 상금 소멸
            } else {
                // 실제 플레이어가 우승한 경우
                const winnerUser = await getUser(winner.userId);
                winnerUser.gold += totalPot;
                await winnerUser.save();
                prizeAwarded = true;
            }

            // 레이싱 통계 업데이트 (실제 플레이어만)
            const realPlayers = allPlayers.filter(p => !p.isBot);
            for (const player of realPlayers) {
                const user = await getUser(player.userId);
                
                // 기본 통계 초기화
                if (!user.racingStats) {
                    user.racingStats = {
                        totalRaces: 0,
                        wins: 0,
                        totalWinnings: 0,
                        totalSpent: 0,
                        longestWinStreak: 0,
                        currentWinStreak: 0,
                        biggestWin: 0,
                        lastRaceDate: null
                    };
                }

                user.racingStats.totalRaces += 1;
                user.racingStats.totalSpent += player.betAmount;
                user.racingStats.lastRaceDate = new Date();

                if (prizeAwarded && player.userId === actualWinner.userId) {
                    // 실제 우승자 통계
                    user.racingStats.wins += 1;
                    user.racingStats.totalWinnings += totalPot;
                    user.racingStats.currentWinStreak += 1;
                    user.racingStats.longestWinStreak = Math.max(
                        user.racingStats.longestWinStreak, 
                        user.racingStats.currentWinStreak
                    );
                    user.racingStats.biggestWin = Math.max(user.racingStats.biggestWin, totalPot);
                } else {
                    // 패배시 연승 초기화
                    user.racingStats.currentWinStreak = 0;
                }

                await user.save();
            }

            // 주식 시장 이벤트 트리거
            recordPlayerAction('racing_event', { 
                potSize: totalPot, 
                participants: allPlayers.length 
            });

            // 실제 우승자 반환 (상금을 받은 플레이어)
            return prizeAwarded ? actualWinner : null;

        } catch (error) {
            console.error('상금 지급 오류:', error);
            return null;
        }
    }

    // 현재 대기 상태 정보
    getRaceStatus() {
        const players = Array.from(this.waitingPlayers.values());
        const totalPot = this.getTotalPot();
        const countdown = this.raceStartTimer ? this.waitTime : 0;

        return {
            isRacing: this.isRacing,
            playerCount: players.length,
            players,
            totalPot,
            countdown,
            canStart: players.length >= this.minPlayers,
            isFull: players.length >= this.maxPlayers
        };
    }

    // 레이스 초기화 (관리자용)
    resetRace() {
        if (this.raceStartTimer) {
            clearTimeout(this.raceStartTimer);
            this.raceStartTimer = null;
        }
        if (this.botTimer) {
            clearTimeout(this.botTimer);
            this.botTimer = null;
        }
        this.isRacing = false;
        this.waitingPlayers.clear();
    }
}

// 레이싱 시스템 인스턴스
const raceSystem = new BettingRaceSystem();

// PVP 시스템 클래스
class PVPSystem {
    constructor() {
        this.matchmakingQueue = new Map(); // userId -> {rating, timestamp, preference}
        this.activeMatches = new Map(); // matchId -> match data
        this.botUsers = new Map(); // 봇 유저 데이터 캐시
        this.tierRanges = {
            'Bronze': { min: 0, max: 1199 },
            'Silver': { min: 1200, max: 1399 },
            'Gold': { min: 1400, max: 1599 },
            'Platinum': { min: 1600, max: 1799 },
            'Master': { min: 1800, max: 1999 },
            'Grandmaster': { min: 2000, max: 2299 },
            'Challenger': { min: 2300, max: 9999 }
        };
        this.initializeBotUsers();
    }

    // 봇 유저 데이터 초기화
    async initializeBotUsers() {
        const botProfiles = [
            { name: '강화왕', rating: 1500, tier: 'Gold' },
            { name: '검성', rating: 1800, tier: 'Master' },
            { name: '마검사', rating: 1350, tier: 'Silver' },
            { name: '전설의기사', rating: 2100, tier: 'Grandmaster' },
            { name: '초보냥이', rating: 900, tier: 'Bronze' },
            { name: '사냥꾼', rating: 1600, tier: 'Platinum' },
            { name: '마법사', rating: 1400, tier: 'Gold' },
            { name: '암살자', rating: 1750, tier: 'Master' }
        ];

        for (const bot of botProfiles) {
            this.botUsers.set(bot.name, {
                nickname: bot.name,
                rating: bot.rating,
                tier: bot.tier,
                level: Math.floor(bot.rating / 50) + 1,
                stats: this.generateBotStats(bot.rating),
                equipment: this.generateBotEquipment(bot.rating)
            });
        }
    }

    // 봇 스탯 생성
    generateBotStats(rating) {
        const baseStats = Math.floor(rating / 100) + 10;
        return {
            strength: baseStats + Math.floor(Math.random() * 5),
            agility: baseStats + Math.floor(Math.random() * 5),
            intelligence: baseStats + Math.floor(Math.random() * 5),
            vitality: baseStats + Math.floor(Math.random() * 5),
            luck: baseStats + Math.floor(Math.random() * 5)
        };
    }

    // 봇 장비 생성
    generateBotEquipment(rating) {
        const level = Math.floor(rating / 100);
        return {
            weapon: {
                name: `${level}성 전설 무기`,
                enhanceLevel: Math.min(level, 30),
                stats: { attack: level * 10, defense: 0, dodge: 0, luck: 0 }
            },
            armor: {
                name: `${level}성 전설 갑옷`,
                enhanceLevel: Math.min(level, 30),
                stats: { attack: 0, defense: level * 8, dodge: 0, luck: 0 }
            }
        };
    }

    // 티켓 재생성
    async regenerateTickets(user) {
        const now = new Date();
        const lastRegen = user.pvp.lastTicketRegen || now;
        const hoursPassed = Math.floor((now - lastRegen) / (1000 * 60 * 60));
        
        if (hoursPassed > 0 && user.pvp.duelTickets < 20) {
            const newTickets = Math.min(20, user.pvp.duelTickets + hoursPassed);
            user.pvp.duelTickets = newTickets;
            user.pvp.lastTicketRegen = now;
            await user.save();
        }
        
        return user.pvp.duelTickets;
    }

    // 매치메이킹 큐 참가
    async joinQueue(userId, user, channel) {
        // 티켓 재생성
        await this.regenerateTickets(user);
        
        // 티켓 확인
        if (user.pvp.duelTickets <= 0) {
            return { 
                success: false, 
                message: '결투권이 부족합니다! 1시간마다 1장씩 재생성됩니다.' 
            };
        }

        // 이미 큐에 있는지 확인
        if (this.matchmakingQueue.has(userId)) {
            return { 
                success: false, 
                message: '이미 매치메이킹 큐에 참가중입니다!' 
            };
        }

        const playerData = {
            userId,
            user,
            rating: user.pvp.rating,
            tier: this.getTierByRating(user.pvp.rating),
            timestamp: Date.now(),
            channel
        };

        this.matchmakingQueue.set(userId, playerData);

        // 즉시 매치 시도 (초기 범위: 200)
        const opponent = this.findOpponent(playerData);
        if (opponent) {
            // 즉시 매칭 성사 알림
            const ratingDiff = Math.abs(playerData.rating - opponent.rating);
            
            if (channel) {
                try {
                    const instantMatchEmbed = new EmbedBuilder()
                        .setColor('#27ae60')
                        .setTitle('⚡ 즉시 매칭 성사!')
                        .setDescription(`**${opponent.user.nickname}** 님과 바로 매칭되었습니다!`)
                        .addFields(
                            { name: '👤 상대 플레이어', value: `${opponent.user.nickname} (${opponent.rating}점)`, inline: true },
                            { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                            { name: '⚔️ 전투 시작', value: '최고의 매칭이 성사되었습니다!', inline: true }
                        );
                    
                    await channel.send({ embeds: [instantMatchEmbed] });
                    
                    // 상대방 채널에도 알림
                    if (opponent.channel && opponent.channel !== channel) {
                        await opponent.channel.send({ embeds: [instantMatchEmbed] });
                    }
                } catch (error) {
                    console.error('즉시 매칭 성공 알림 전송 오류:', error);
                }
            }
            
            return await this.createMatch(playerData, opponent);
        }

        // 매칭 진행 상황 업데이트
        const updateMatchmakingProgress = async () => {
            if (!this.matchmakingQueue.has(userId)) return;
            
            const currentPlayer = this.matchmakingQueue.get(userId);
            const waitTime = Date.now() - currentPlayer.timestamp;
            const waitSeconds = Math.floor(waitTime / 1000);
            
            // 매칭 범위 계산 (15초마다 100씩 증가, 최대 2000)
            const baseRange = 200;
            const expandedRange = Math.min(2000, baseRange + Math.floor(waitTime / 15000) * 100);
            
            // 상대 찾기 시도
            const opponent = this.findOpponentWithRange(currentPlayer, expandedRange);
            if (opponent) {
                // 실제 플레이어 매칭 성사 알림
                const ratingDiff = Math.abs(currentPlayer.rating - opponent.rating);
                
                if (channel) {
                    try {
                        const playerMatchEmbed = new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('🔥 실제 플레이어 매칭 성사!')
                            .setDescription(`**${opponent.user.nickname}** 님과 매칭되었습니다!`)
                            .addFields(
                                { name: '👤 상대 플레이어', value: `${opponent.user.nickname} (${opponent.rating}점)`, inline: true },
                                { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                                { name: '⚔️ 전투 시작', value: '열띤 전투가 시작됩니다!', inline: true }
                            );
                        
                        await channel.send({ embeds: [playerMatchEmbed] });
                        
                        // 상대방 채널에도 알림
                        if (opponent.channel && opponent.channel !== channel) {
                            await opponent.channel.send({ embeds: [playerMatchEmbed] });
                        }
                    } catch (error) {
                        console.error('플레이어 매칭 성공 알림 전송 오류:', error);
                    }
                }
                
                this.createMatch(currentPlayer, opponent);
                return;
            }
            
            // 60초 후에도 매칭이 안되면 봇 매칭
            if (waitTime >= 60000) {
                // 봇 매칭 시작 알림
                if (channel) {
                    try {
                        const botMatchEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('🤖 봇 매칭 시작')
                            .setDescription(`60초 대기 후 적절한 실력의 봇과 매칭됩니다!`)
                            .addFields(
                                { name: '⏱️ 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 최종 매칭 범위', value: `±${expandedRange}점`, inline: true }
                            );
                        
                        await channel.send({ embeds: [botMatchEmbed] });
                    } catch (error) {
                        console.error('봇 매칭 알림 전송 오류:', error);
                    }
                }
                
                this.createBotMatch(userId);
                return;
            }
            
            // 15초마다 진행 상황 알림
            if (waitSeconds % 15 === 0 && waitSeconds > 0) {
                if (channel) {
                    try {
                        const progressEmbed = new EmbedBuilder()
                            .setColor('#3498db')
                            .setTitle('🔍 매칭 진행 중...')
                            .setDescription(`더 넓은 범위에서 상대를 찾고 있습니다!`)
                            .addFields(
                                { name: '⏱️ 대기 시간', value: `${waitSeconds}초`, inline: true },
                                { name: '🎯 현재 매칭 범위', value: `±${expandedRange}점`, inline: true },
                                { name: '⏳ 봇 매칭까지', value: `${60 - waitSeconds}초`, inline: true }
                            );
                        
                        await channel.send({ embeds: [progressEmbed] });
                    } catch (error) {
                        console.error('매칭 진행 알림 전송 오류:', error);
                    }
                }
            }
            
            // 5초 후 다시 확인
            setTimeout(updateMatchmakingProgress, 5000);
        };

        // 5초 후부터 매칭 상황 확인 시작
        setTimeout(updateMatchmakingProgress, 5000);

        return {
            success: true,
            message: '매치메이킹을 시작합니다! 15초마다 매칭 범위가 확대되며, 60초 후엔 봇과 매칭됩니다.',
            tickets: user.pvp.duelTickets
        };
    }

    // 상대 찾기 (기본 범위 200)
    findOpponent(player) {
        return this.findOpponentWithRange(player, 200);
    }

    // 지정된 범위로 상대 찾기
    findOpponentWithRange(player, maxRatingDiff) {
        let bestOpponent = null;
        let smallestDiff = Infinity;
        
        for (const [opponentId, opponent] of this.matchmakingQueue) {
            if (opponentId === player.userId) continue;
            
            const ratingDiff = Math.abs(player.rating - opponent.rating);
            if (ratingDiff <= maxRatingDiff && ratingDiff < smallestDiff) {
                bestOpponent = opponent;
                smallestDiff = ratingDiff;
            }
        }
        
        if (bestOpponent) {
            this.matchmakingQueue.delete(bestOpponent.userId);
            return bestOpponent;
        }
        
        return null;
    }

    // 봇 매치 생성
    async createBotMatch(userId) {
        const player = this.matchmakingQueue.get(userId);
        if (!player) return;

        const playerRating = player.rating;
        let botCandidates = Array.from(this.botUsers.values());
        
        // 1차: 플레이어 레이팅 ±300 범위 내 봇 찾기
        let suitableBots = botCandidates.filter(bot => 
            Math.abs(bot.rating - playerRating) <= 300
        );
        
        // 2차: 300 범위에 없으면 ±500 범위로 확대
        if (suitableBots.length === 0) {
            suitableBots = botCandidates.filter(bot => 
                Math.abs(bot.rating - playerRating) <= 500
            );
        }
        
        // 3차: 그래도 없으면 전체 봇 중에서 가장 가까운 봇 선택
        if (suitableBots.length === 0) {
            suitableBots = botCandidates.sort((a, b) => 
                Math.abs(a.rating - playerRating) - Math.abs(b.rating - playerRating)
            ).slice(0, 3); // 상위 3개 중 랜덤
        }

        // 최종적으로 봇이 없으면 시스템 오류 (이론적으로 불가능)
        if (suitableBots.length === 0) {
            this.matchmakingQueue.delete(userId);
            if (player.channel) {
                try {
                    await player.channel.send('❌ 매칭 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                } catch (error) {
                    console.error('매칭 오류 메시지 전송 실패:', error);
                }
            }
            return;
        }

        const botOpponent = suitableBots[Math.floor(Math.random() * suitableBots.length)];
        const ratingDiff = Math.abs(botOpponent.rating - playerRating);
        
        const botData = {
            userId: 'bot_' + botOpponent.nickname,
            user: botOpponent,
            rating: botOpponent.rating,
            tier: botOpponent.tier,
            isBot: true
        };

        this.matchmakingQueue.delete(userId);
        
        // 봇 매칭 알림 (레이팅 차이 정보 포함)
        if (player.channel) {
            try {
                const matchFoundEmbed = new EmbedBuilder()
                    .setColor('#27ae60')
                    .setTitle('🎯 매치 성사!')
                    .setDescription(`**${botOpponent.nickname}** 봇과 매칭되었습니다!`)
                    .addFields(
                        { name: '🤖 상대 봇', value: `${botOpponent.nickname} (${botOpponent.rating}점)`, inline: true },
                        { name: '📊 레이팅 차이', value: `±${ratingDiff}점`, inline: true },
                        { name: '⚔️ 전투 시작', value: '곧 결과가 나타납니다!', inline: true }
                    );
                
                await player.channel.send({ embeds: [matchFoundEmbed] });
            } catch (error) {
                console.error('봇 매칭 성공 알림 전송 오류:', error);
            }
        }
        
        await this.createMatch(player, botData);
    }

    // 매치 생성
    async createMatch(player1, player2) {
        const matchId = Date.now().toString();
        
        // 티켓 소모
        if (!player1.isBot) {
            player1.user.pvp.duelTickets -= 1;
            await player1.user.save();
        }
        if (!player2.isBot) {
            player2.user.pvp.duelTickets -= 1;
            await player2.user.save();
        }

        const match = {
            id: matchId,
            player1,
            player2,
            status: 'preparing',
            startTime: Date.now()
        };

        this.activeMatches.set(matchId, match);

        // 전투 시뮬레이션
        const battleResult = await this.simulateBattle(player1, player2);
        
        // 결과 처리
        await this.processMatchResult(match, battleResult);
        
        return { 
            success: true, 
            message: '매치가 성사되었습니다!',
            matchId 
        };
    }

    // 전투 시뮬레이션
    async simulateBattle(player1, player2) {
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);

        const battles = [];
        let p1Hp = p1Stats.maxHp;
        let p2Hp = p2Stats.maxHp;
        let turn = 1;

        while (p1Hp > 0 && p2Hp > 0 && turn <= 20) {
            const round = {};
            
            // 플레이어 1 공격
            if (Math.random() < p1Stats.accuracy) {
                let damage = Math.floor(p1Stats.attack * (0.8 + Math.random() * 0.4));
                const critChance = p1Stats.critRate;
                const isCrit = Math.random() < critChance;
                if (isCrit) damage *= 2;
                
                p2Hp = Math.max(0, p2Hp - Math.max(1, damage - p2Stats.defense));
                round.p1Action = {
                    damage,
                    isCrit,
                    remainingHp: p2Hp
                };
            } else {
                round.p1Action = { miss: true };
            }

            // 플레이어 2 공격 (생존시)
            if (p2Hp > 0) {
                if (Math.random() < p2Stats.accuracy) {
                    let damage = Math.floor(p2Stats.attack * (0.8 + Math.random() * 0.4));
                    const critChance = p2Stats.critRate;
                    const isCrit = Math.random() < critChance;
                    if (isCrit) damage *= 2;
                    
                    p1Hp = Math.max(0, p1Hp - Math.max(1, damage - p1Stats.defense));
                    round.p2Action = {
                        damage,
                        isCrit,
                        remainingHp: p1Hp
                    };
                } else {
                    round.p2Action = { miss: true };
                }
            }

            battles.push(round);
            turn++;
        }

        const winner = p1Hp > p2Hp ? 'player1' : 'player2';
        
        return {
            winner,
            battles,
            finalHp: { p1: p1Hp, p2: p2Hp },
            totalTurns: turn - 1
        };
    }

    // 전투력 계산
    calculateCombatStats(player) {
        const user = player.user;
        let baseStats;
        
        if (player.isBot) {
            baseStats = user.stats;
        } else {
            baseStats = user.stats;
        }

        // 장비 스탯 계산
        let equipmentBonus = { attack: 0, defense: 0, dodge: 0, luck: 0 };
        if (user.equipment && user.equipment.weapon) {
            equipmentBonus.attack += user.equipment.weapon.stats.attack || 0;
        }
        if (user.equipment && user.equipment.armor) {
            equipmentBonus.defense += user.equipment.armor.stats.defense || 0;
        }

        const totalStats = {
            strength: baseStats.strength + Math.floor(equipmentBonus.attack / 10),
            agility: baseStats.agility + Math.floor(equipmentBonus.dodge / 10),
            intelligence: baseStats.intelligence,
            vitality: baseStats.vitality + Math.floor(equipmentBonus.defense / 10),
            luck: baseStats.luck + Math.floor(equipmentBonus.luck / 10)
        };

        return {
            attack: totalStats.strength * 2 + equipmentBonus.attack,
            defense: totalStats.vitality + equipmentBonus.defense,
            maxHp: totalStats.vitality * 10 + (user.level || 1) * 50,
            accuracy: Math.min(0.95, 0.7 + (totalStats.agility / 1000)),
            critRate: Math.min(0.3, 0.05 + (totalStats.luck / 1000)),
            dodge: Math.min(0.2, totalStats.agility / 1000)
        };
    }

    // 매치 결과 처리
    async processMatchResult(match, battleResult) {
        const winner = battleResult.winner === 'player1' ? match.player1 : match.player2;
        const loser = battleResult.winner === 'player1' ? match.player2 : match.player1;

        // 레이팅 계산
        const { winnerNewRating, loserNewRating, ratingChange } = this.calculateRatingChange(
            winner.rating, 
            loser.rating, 
            battleResult.winner === 'player1'
        );

        // 결과 저장 (봇이 아닌 경우만)
        if (!winner.isBot) {
            await this.updatePlayerStats(winner.user, true, ratingChange, loser.user.nickname || loser.user.name);
        }
        if (!loser.isBot) {
            await this.updatePlayerStats(loser.user, false, -ratingChange, winner.user.nickname || winner.user.name);
        }

        // 결과 메시지 전송
        await this.sendBattleResult(match, battleResult, winner, loser, ratingChange);
        
        // 매치 정리
        this.activeMatches.delete(match.id);
    }

    // 레이팅 변화 계산
    calculateRatingChange(winnerRating, loserRating, player1Won) {
        const K = 32; // K-factor
        const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const ratingChange = Math.round(K * (1 - expectedWin));
        
        return {
            winnerNewRating: winnerRating + ratingChange,
            loserNewRating: loserRating - ratingChange,
            ratingChange
        };
    }

    // 플레이어 통계 업데이트
    async updatePlayerStats(user, isWin, ratingChange, opponentName) {
        user.pvp.rating += ratingChange;
        user.pvp.tier = this.getTierByRating(user.pvp.rating);
        user.pvp.totalDuels += 1;
        
        if (isWin) {
            user.pvp.wins += 1;
            user.pvp.winStreak += 1;
            user.pvp.maxWinStreak = Math.max(user.pvp.maxWinStreak, user.pvp.winStreak);
        } else {
            user.pvp.losses += 1;
            user.pvp.winStreak = 0;
        }

        user.pvp.highestRating = Math.max(user.pvp.highestRating, user.pvp.rating);
        user.pvp.lastMatchTime = new Date();

        // 매치 히스토리 업데이트 (최근 10경기)
        user.pvp.matchHistory.unshift({
            opponent: opponentName,
            opponentRating: user.pvp.rating - ratingChange,
            result: isWin ? 'win' : 'lose',
            ratingChange: ratingChange,
            date: new Date()
        });

        if (user.pvp.matchHistory.length > 10) {
            user.pvp.matchHistory = user.pvp.matchHistory.slice(0, 10);
        }

        await user.save();
    }

    // 레이팅으로 티어 계산
    getTierByRating(rating) {
        for (const [tier, range] of Object.entries(this.tierRanges)) {
            if (rating >= range.min && rating <= range.max) {
                return tier;
            }
        }
        return 'Bronze';
    }

    // 전투 결과 전송
    async sendBattleResult(match, battleResult, winner, loser, ratingChange) {
        const channel = match.player1.channel || match.player2.channel;
        if (!channel) return;

        const p1Name = match.player1.user.nickname || match.player1.user.name || '플레이어1';
        const p2Name = match.player2.user.nickname || match.player2.user.name || '플레이어2';
        
        const winnerName = winner === match.player1 ? p1Name : p2Name;
        const loserName = loser === match.player1 ? p1Name : p2Name;

        // 전투 과정 텍스트 생성
        let battleLog = '';
        battleResult.battles.forEach((round, index) => {
            battleLog += `**${index + 1}턴**\n`;
            
            if (round.p1Action.miss) {
                battleLog += `${p1Name}: 공격 실패!\n`;
            } else {
                const critText = round.p1Action.isCrit ? ' **크리티컬!**' : '';
                battleLog += `${p1Name}: ${round.p1Action.damage} 피해${critText}\n`;
            }
            
            if (round.p2Action) {
                if (round.p2Action.miss) {
                    battleLog += `${p2Name}: 공격 실패!\n`;
                } else {
                    const critText = round.p2Action.isCrit ? ' **크리티컬!**' : '';
                    battleLog += `${p2Name}: ${round.p2Action.damage} 피해${critText}\n`;
                }
            }
            battleLog += '\n';
        });

        const resultEmbed = new EmbedBuilder()
            .setTitle('⚔️ PVP 결투 결과')
            .setColor(winner === match.player1 ? 0x00ff00 : 0xff0000)
            .addFields(
                {
                    name: '🏆 승자',
                    value: `${winnerName}\n레이팅: ${winner.rating} (+${ratingChange})`,
                    inline: true
                },
                {
                    name: '💔 패자',
                    value: `${loserName}\n레이팅: ${loser.rating} (-${ratingChange})`,
                    inline: true
                },
                {
                    name: '⚔️ 전투 과정',
                    value: battleLog.length > 1024 ? battleLog.substring(0, 1021) + '...' : battleLog,
                    inline: false
                }
            )
            .setFooter({ text: `총 ${battleResult.totalTurns}턴 진행` })
            .setTimestamp();

        await channel.send({ embeds: [resultEmbed] });
    }

    // 큐 떠나기
    leaveQueue(userId) {
        if (this.matchmakingQueue.has(userId)) {
            this.matchmakingQueue.delete(userId);
            return { success: true, message: '매치메이킹 큐에서 나왔습니다.' };
        }
        return { success: false, message: '매치메이킹 큐에 참가하지 않았습니다.' };
    }

    // PVP 정보 조회
    async getPVPInfo(user) {
        await this.regenerateTickets(user);
        
        const tierEmoji = {
            'Bronze': '🥉',
            'Silver': '🥈', 
            'Gold': '🥇',
            'Platinum': '💎',
            'Master': '🌟',
            'Grandmaster': '👑',
            'Challenger': '🏆'
        };

        const winRate = user.pvp.totalDuels > 0 ? 
            ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : 0;

        return {
            rating: user.pvp.rating,
            tier: user.pvp.tier,
            tierEmoji: tierEmoji[user.pvp.tier] || '🥉',
            duelTickets: user.pvp.duelTickets,
            totalDuels: user.pvp.totalDuels,
            wins: user.pvp.wins,
            losses: user.pvp.losses,
            winRate,
            winStreak: user.pvp.winStreak,
            maxWinStreak: user.pvp.maxWinStreak,
            highestRating: user.pvp.highestRating,
            matchHistory: user.pvp.matchHistory || []
        };
    }
}

const pvpSystem = new PVPSystem();

// 의뢰 시스템 함수들
function getRandomQuest() {
    const allClients = [
        ...QUEST_CLIENTS.villagers,
        ...QUEST_CLIENTS.merchants,
        ...QUEST_CLIENTS.scammers,
        ...QUEST_CLIENTS.travelers
    ];
    return allClients[Math.floor(Math.random() * allClients.length)];
}

function calculateQuestReward(userLevel, questType) {
    if (questType === 'scam') {
        return null; // 사기 의뢰는 보상 없음
    }
    
    // 레벨에 비례한 보상 (100레벨을 기준으로 100~1000 골드)
    const baseReward = Math.floor(Math.random() * 900) + 100; // 100~1000 골드
    const levelMultiplier = userLevel / 100; // 레벨 배율
    const finalReward = Math.floor(baseReward * (0.5 + levelMultiplier)); // 최소 50% 보장
    
    return {
        gold: finalReward,
        exp: Math.floor(finalReward / 10) // 골드의 10% 경험치
    };
}

function addQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    global.questCooldowns.set(userId, Date.now() + (30 * 60 * 1000)); // 30분 쿨타임
}

function checkQuestCooldown(userId) {
    if (!global.questCooldowns) {
        global.questCooldowns = new Map();
    }
    const cooldownEnd = global.questCooldowns.get(userId);
    if (!cooldownEnd) return false;
    
    const timeLeft = cooldownEnd - Date.now();
    return timeLeft > 0 ? Math.ceil(timeLeft / (60 * 1000)) : false; // 남은 분 수 반환
}

// 🔮 에너지 조각 융합 시스템 상수
const ENERGY_FRAGMENT_SYSTEM = {
    MINE_COST: 500, // 채굴 비용
    MINE_COOLDOWN: 2 * 60 * 1000, // 2분 쿨타임
    DAILY_FUSION_LIMIT: 20, // 일일 융합 제한
    
    // 단계별 이름과 이모지
    TIER_NAMES: {
        '1-10': { name: '기초 에너지 조각', emoji: '🔸' },
        '11-25': { name: '마법 에너지 조각', emoji: '💠' },
        '26-50': { name: '크리스탈 에너지 조각', emoji: '💎' },
        '51-75': { name: '별빛 에너지 조각', emoji: '⭐' },
        '76-99': { name: '창조 에너지 조각', emoji: '🌌' },
        '100': { name: '궁극의 창조석', emoji: '✨' }
    },
    
    // 성공 확률
    SUCCESS_RATES: {
        '1-25': 85,
        '26-50': 80,
        '51-75': 75,
        '76-99': 70,
        '99-100': 50
    },
    
    // 실패 시 하락 범위
    FAIL_DROP: { min: 10, max: 30 },
    CRITICAL_FAIL_CHANCE: 1, // 대실패 확률 1%
    
    // 사냥터 드롭률
    HUNTING_DROP_CHANCE: 0.1, // 0.1%
    
    // 실패 스택
    FAILURE_STACK_CHANCE: 50, // 실패 시 50% 확률로 스택
    FAILURE_STACK_REQUIRED: 10, // 10스택 시 성공 확정
    
    // 주식 영향도
    STOCK_IMPACT: {
        '1-10': { company: '크리스탈 채굴공사', success: 5, fail: -3 },
        '11-25': { company: '마법 연구원', success: 8, fail: -4 },
        '26-50': { company: '수정 가공업체', success: 12, fail: -5 },
        '51-75': { company: '별빛 연구소', success: 15, fail: -6 },
        '76-99': { company: '창조 기술원', success: 20, fail: -8 },
        '100': { company: '전체시장', success: 50, fail: -25 }
    }
};

// 에너지 조각 관련 헬퍼 함수들
function getFragmentTier(level) {
    if (level >= 1 && level <= 10) return '1-10';
    if (level >= 11 && level <= 25) return '11-25';
    if (level >= 26 && level <= 50) return '26-50';
    if (level >= 51 && level <= 75) return '51-75';
    if (level >= 76 && level <= 99) return '76-99';
    if (level === 100) return '100';
    return null;
}

function getFragmentInfo(level) {
    const tier = getFragmentTier(level);
    return ENERGY_FRAGMENT_SYSTEM.TIER_NAMES[tier] || { name: '알 수 없는 조각', emoji: '❓' };
}

function getSuccessRate(level) {
    if (level >= 1 && level <= 25) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['1-25'];
    if (level >= 26 && level <= 50) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['26-50'];
    if (level >= 51 && level <= 75) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['51-75'];
    if (level >= 76 && level <= 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['76-99'];
    if (level === 99) return ENERGY_FRAGMENT_SYSTEM.SUCCESS_RATES['99-100'];
    return 70;
}

function calculateFusionCost(level) {
    return level * 1000; // 현재 단계 × 1000골드
}

function calculateCombatPowerFromFragment(level) {
    // 전투력 = (단계 ^ 1.5) × 100
    return Math.floor(Math.pow(level, 1.5) * 100);
}

// 🏪 아이템 경매장 시스템 함수들
// 시장 가격 계산 함수
function calculateItemMarketPrice(itemName, rarity, basePrice) {
    const now = Date.now();
    
    // 시장 이벤트 업데이트 (6시간마다)
    if (now - lastMarketUpdate > 6 * 60 * 60 * 1000) {
        updateMarketEvent();
        lastMarketUpdate = now;
    }
    
    // 기본 가격에 희귀도 배수 적용
    const rarityMultipliers = {
        '일반': 1.0,
        '고급': 1.5,
        '레어': 2.5,
        '에픽': 4.0,
        '레전드리': 8.0,
        '신화': 15.0
    };
    
    let marketPrice = basePrice * (rarityMultipliers[rarity] || 1.0);
    
    // 시장 이벤트 영향 적용
    if (currentMarketEvent) {
        const { effect } = currentMarketEvent;
        const itemType = getItemType(itemName);
        
        if (effect.items.includes('all') || effect.items.includes(itemType)) {
            switch (effect.type) {
                case 'supply_increase':
                    marketPrice *= (1 / effect.value); // 공급 증가 -> 가격 하락
                    break;
                case 'demand_increase':
                    marketPrice *= effect.value; // 수요 증가 -> 가격 상승
                    break;
                case 'price_spike':
                    marketPrice *= effect.value; // 가격 급등
                    break;
                case 'market_crash':
                    marketPrice *= effect.value; // 시장 폭락
                    break;
                case 'price_boost':
                    marketPrice *= effect.value; // 가격 부스트
                    break;
            }
        }
    }
    
    // 랜덤 변동성 적용 (±15%)
    const volatility = 0.15;
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * volatility;
    marketPrice *= randomFactor;
    
    return Math.floor(marketPrice);
}

// 시장 이벤트 업데이트
function updateMarketEvent() {
    if (Math.random() < 0.3) { // 30% 확률로 이벤트 발생
        const randomEvent = ITEM_MARKET.dailyEvents[Math.floor(Math.random() * ITEM_MARKET.dailyEvents.length)];
        currentMarketEvent = {
            ...randomEvent,
            startTime: Date.now(),
            duration: 6 * 60 * 60 * 1000 // 6시간 지속
        };
        
        // 이벤트 알림 (서버 전체에 공지)
        AUCTION_HOUSE.events.push({
            type: 'market_event',
            message: `🌟 **${currentMarketEvent.name}** 이벤트가 시작되었습니다!`,
            timestamp: Date.now()
        });
    } else {
        currentMarketEvent = null;
    }
}

// 아이템 타입 분류
function getItemType(itemName) {
    if (itemName.includes('주문서')) return 'scrolls';
    if (itemName.includes('포션') || itemName.includes('물약') || itemName.includes('가루') || itemName.includes('엘릭서')) return 'consumables';
    if (itemName.includes('조각') || itemName.includes('코어') || itemName.includes('수액') || itemName.includes('원석')) return 'currency';
    return 'rare';
}

// 경매장 아이템 등록
function addAuctionListing(seller, item, startPrice, buyNowPrice, duration = 24) {
    const listingId = `auction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const listing = {
        id: listingId,
        sellerId: seller.discordId,
        sellerName: seller.nickname,
        item: item,
        startPrice: startPrice,
        currentPrice: startPrice,
        buyNowPrice: buyNowPrice,
        highestBidder: null,
        highestBidderName: null,
        bids: [],
        startTime: Date.now(),
        endTime: Date.now() + (duration * 60 * 60 * 1000),
        status: 'active'
    };
    
    AUCTION_HOUSE.listings.set(listingId, listing);
    saveGameData(); // 데이터 자동 저장
    return listingId;
}

// 입찰 처리
function placeBid(bidder, listingId, bidAmount) {
    const listing = AUCTION_HOUSE.listings.get(listingId);
    if (!listing || listing.status !== 'active') {
        return { success: false, message: '경매가 존재하지 않거나 종료되었습니다.' };
    }
    
    if (Date.now() > listing.endTime) {
        return { success: false, message: '경매가 이미 종료되었습니다.' };
    }
    
    if (bidAmount <= listing.currentPrice) {
        return { success: false, message: `현재 입찰가(${listing.currentPrice.toLocaleString()}G)보다 높게 입찰해주세요.` };
    }
    
    if (bidder.discordId === listing.sellerId) {
        return { success: false, message: '자신이 등록한 경매에는 입찰할 수 없습니다.' };
    }
    
    if (bidder.gold < bidAmount) {
        return { success: false, message: '골드가 부족합니다.' };
    }
    
    // 이전 최고 입찰자에게 골드 반환
    if (listing.highestBidder) {
        // 실제 구현시에는 User.findOne으로 이전 입찰자 찾아서 골드 반환
    }
    
    // 새로운 입찰 정보 업데이트
    listing.currentPrice = bidAmount;
    listing.highestBidder = bidder.discordId;
    listing.highestBidderName = bidder.nickname;
    listing.bids.push({
        bidderId: bidder.discordId,
        bidderName: bidder.nickname,
        amount: bidAmount,
        timestamp: Date.now()
    });
    
    // 입찰자 골드 차감 (임시 보관)
    bidder.gold -= bidAmount;
    
    saveGameData(); // 데이터 자동 저장
    return { success: true, message: '입찰이 완료되었습니다!' };
}

// 시세 조회 함수 (주식 차트와 유사)
function getItemPriceChart(itemName) {
    const history = AUCTION_HOUSE.priceHistory.get(itemName) || [];
    if (history.length === 0) {
        return { message: '해당 아이템의 거래 기록이 없습니다.' };
    }
    
    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : latest;
    const change = ((latest.price - previous.price) / previous.price * 100);
    
    return {
        itemName,
        currentPrice: latest.price,
        change: change,
        volume: latest.volume || 0,
        history: history.slice(-30) // 최근 30개 기록
    };
}

// 🎲 랜덤 이벤트 시스템 함수들
// 날씨 시스템 업데이트 (6시간마다)
function updateWeather() {
    const weatherList = RANDOM_EVENTS.weatherEffects;
    currentWeather = weatherList[Math.floor(Math.random() * weatherList.length)];
    saveGameData(); // 데이터 자동 저장
    return currentWeather;
}

// 일일 운세 업데이트 (24시간마다)
function updateDailyFortune() {
    const fortunes = RANDOM_EVENTS.dailyFortune;
    dailyFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    return dailyFortune;
}

// 랜덤 인카운터 체크
function checkRandomEncounter() {
    for (const encounter of RANDOM_EVENTS.randomEncounters) {
        if (Math.random() * 100 < encounter.rarity) {
            return encounter;
        }
    }
    return null;
}

// 신비한 상자 열기
function openMysteryBox(boxType, user) {
    const box = RANDOM_EVENTS.mysteryBoxes.find(b => b.name === boxType);
    if (!box) return { success: false, message: '존재하지 않는 상자입니다.' };
    
    if (user.gold < box.price) {
        return { success: false, message: '골드가 부족합니다.' };
    }
    
    // 가중치 기반 랜덤 선택
    const totalWeight = box.rewards.reduce((sum, reward) => sum + reward.weight, 0);
    const random = Math.random() * totalWeight;
    let currentWeight = 0;
    
    for (const reward of box.rewards) {
        currentWeight += reward.weight;
        if (random <= currentWeight) {
            // 골드 차감
            user.gold -= box.price;
            
            // 보상 지급
            let rewardText = '';
            if (reward.item === '골드' || reward.item === '대량 골드') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.gold += amount;
                rewardText = `${amount.toLocaleString()}G`;
            } else if (reward.item === '경험치') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.exp += amount;
                rewardText = `${amount.toLocaleString()} EXP`;
            } else if (reward.item === '스탯 포인트') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.statPoints += amount;
                rewardText = `스탯 포인트 ${amount}개`;
            } else if (reward.item === '보호권') {
                const amount = Array.isArray(reward.amount) ? 
                    Math.floor(Math.random() * (reward.amount[1] - reward.amount[0] + 1)) + reward.amount[0] :
                    reward.amount;
                user.protectionScrolls += amount;
                rewardText = `보호권 ${amount}개`;
            } else {
                rewardText = reward.item;
            }
            
            return { 
                success: true, 
                reward: reward.item,
                rewardText: rewardText,
                message: `🎁 **${rewardText}**를 획득했습니다!`
            };
        }
    }
    
    return { success: false, message: '상자 열기에 실패했습니다.' };
}

// 현재 활성 효과들 적용
function getActiveEffects() {
    let effects = {};
    
    // 날씨 효과
    if (currentWeather) {
        Object.assign(effects, currentWeather.effect);
    }
    
    // 일일 운세 효과
    if (dailyFortune) {
        Object.assign(effects, dailyFortune.effect);
    }
    
    return effects;
}

// 📦 새로운 인벤토리 시스템 함수들
function getAvailableInventorySlot(user) {
    const usedSlots = user.inventory.map(item => item.inventorySlot);
    for (let i = 0; i < user.maxInventorySlots; i++) {
        if (!usedSlots.includes(i)) {
            return i;
        }
    }
    return -1; // 슬롯 부족
}

function addItemToInventory(user, itemData) {
    const slot = getAvailableInventorySlot(user);
    if (slot === -1) {
        return { success: false, message: '인벤토리가 가득 찼습니다!' };
    }
    
    const newItem = {
        ...itemData,
        inventorySlot: slot,
        equipped: false
    };
    
    user.inventory.push(newItem);
    return { success: true, slot: slot };
}

function getEquippedItem(user, equipmentType) {
    const slotIndex = user.equipment[equipmentType];
    if (slotIndex === -1) return null;
    
    return user.inventory.find(item => item.inventorySlot === slotIndex);
}

function equipItem(user, inventorySlot, equipmentType) {
    const item = user.inventory.find(item => item.inventorySlot === inventorySlot);
    if (!item) return { success: false, message: '아이템을 찾을 수 없습니다!' };
    
    // 레벨 체크
    if (user.level < item.level) {
        return { success: false, message: `레벨이 부족합니다! (필요: Lv.${item.level})` };
    }
    
    // 이전 장비 해제
    const previousSlot = user.equipment[equipmentType];
    if (previousSlot !== -1) {
        const previousItem = user.inventory.find(item => item.inventorySlot === previousSlot);
        if (previousItem) {
            previousItem.equipped = false;
        }
    }
    
    // 새 장비 장착
    user.equipment[equipmentType] = inventorySlot;
    item.equipped = true;
    
    return { success: true, message: '장비를 착용했습니다!' };
}

function unequipItem(user, equipmentType) {
    const slotIndex = user.equipment[equipmentType];
    if (slotIndex === -1) return { success: false, message: '착용된 장비가 없습니다!' };
    
    const item = user.inventory.find(item => item.inventorySlot === slotIndex);
    if (item) {
        item.equipped = false;
    }
    
    user.equipment[equipmentType] = -1;
    return { success: true, message: '장비를 해제했습니다!' };
}

function sellEquippedItem(user, equipmentType) {
    const item = getEquippedItem(user, equipmentType);
    if (!item) return { success: false, message: '착용된 장비가 없습니다!' };
    
    // 판매가격 계산: 기본가격 70% × 강화레벨
    const basePrice = Math.floor(item.price * 0.7);
    const enhanceMultiplier = item.enhanceLevel > 0 ? (1 + item.enhanceLevel * 0.1) : 1;
    const sellPrice = Math.floor(basePrice * enhanceMultiplier);
    
    // 장비 해제 및 인벤토리에서 제거
    user.equipment[equipmentType] = -1;
    user.inventory = user.inventory.filter(invItem => invItem.inventorySlot !== item.inventorySlot);
    user.gold += sellPrice;
    
    return { success: true, sellPrice: sellPrice, itemName: item.name };
}

// 엠블럼 시스템 데이터
const EMBLEMS = {
    warrior: {
        name: '전사',
        emoji: '⚔️',
        emblems: [
            { name: '초보전사', price: 10000, level: 20, roleName: '초보전사' },
            { name: '튼튼한 기사', price: 50000, level: 35, roleName: '튼튼한 기사' },
            { name: '용맹한 검사', price: 150000, level: 50, roleName: '용맹한 검사' },
            { name: '맹령한 전사', price: 400000, level: 65, roleName: '맹령한 전사' },
            { name: '전설의 기사', price: 1000000, level: 80, roleName: '전설의 기사' }
        ]
    },
    archer: {
        name: '궁수',
        emoji: '🏹',
        emblems: [
            { name: '마을사냥꾼', price: 10000, level: 20, roleName: '마을사냥꾼' },
            { name: '숲의 궁수', price: 50000, level: 35, roleName: '숲의 궁수' },
            { name: '바람 사수', price: 150000, level: 50, roleName: '바람 사수' },
            { name: '정확한 사격수', price: 400000, level: 65, roleName: '정확한 사격수' },
            { name: '전설의 명궁', price: 1000000, level: 80, roleName: '전설의 명궁' }
        ]
    },
    spellsword: {
        name: '마검사',
        emoji: '🔮',
        emblems: [
            { name: '마법 학도', price: 10000, level: 20, roleName: '마법 학도' },
            { name: '마법 검사', price: 50000, level: 35, roleName: '마법 검사' },
            { name: '현명한 기사', price: 150000, level: 50, roleName: '현명한 기사' },
            { name: '마도 검사', price: 400000, level: 65, roleName: '마도 검사' },
            { name: '전설의 마검사', price: 1000000, level: 80, roleName: '전설의 마검사' }
        ]
    },
    rogue: {
        name: '도적',
        emoji: '🗡️',
        emblems: [
            { name: '떠돌이 도적', price: 10000, level: 20, roleName: '떠돌이 도적' },
            { name: '운 좋은 도둑', price: 50000, level: 35, roleName: '운 좋은 도둑' },
            { name: '행운의 닌자', price: 150000, level: 50, roleName: '행운의 닌자' },
            { name: '복 많은 도적', price: 400000, level: 65, roleName: '복 많은 도적' },
            { name: '전설의 행운아', price: 1000000, level: 80, roleName: '전설의 행운아' }
        ]
    }
};

// 엠블럼 채널 ID
const EMBLEM_CHANNEL_ID = '1381614153399140412';

// 유저 칭호 가져오기 함수
function getUserTitle(user) {
    if (user.emblem) {
        return user.emblem; // 엠블럼이 있으면 엠블럼을 칭호로 사용
    }
    return '모험가'; // 엠블럼이 없으면 기본 칭호
}

// 장비 카테고리 이름 가져오기 함수
function getCategoryName(category) {
    const names = {
        weapon: '무기',
        armor: '갑옷',
        helmet: '헬멧',
        gloves: '장갑',
        boots: '부츠',
        accessory: '액세서리'
    };
    return names[category] || category;
}

// 장비 카테고리 이모지 가져오기 함수
function getCategoryEmoji(category) {
    const emojis = {
        weapon: '⚔️',
        armor: '🛡️',
        helmet: '⛑️',
        gloves: '🧤',
        boots: '👢',
        accessory: '💎'
    };
    return emojis[category] || '⚙️';
}

// 봇 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// 봇 토큰 (환경변수에서 가져오거나 직접 입력)
const TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const DEV_CHANNEL_IDS = ['1380684353998426122', '1371885860143890564', '1381614153399140412'];
const GAME_CHANNEL_ID = process.env.GAME_CHANNEL_ID;
const DEV_MODE = process.env.DEV_MODE === 'true';
const DEVELOPER_ID = process.env.DEVELOPER_ID;
const POPULAR_KING_ROLE_NAME = '👑 인기왕';

// 개발자 체크 함수
function isDeveloper(userId) {
    return DEVELOPER_ID && userId === DEVELOPER_ID;
}

// 경험치 바 생성 함수
function generateExpBar(currentExp, maxExp, barLength = 20) {
    const percentage = Math.min(currentExp / maxExp, 1);
    const filledLength = Math.floor(percentage * barLength);
    const emptyLength = barLength - filledLength;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const percentText = (percentage * 100).toFixed(1);
    
    return `└ \`${bar}\` ${percentText}%`;
}

// 랜덤 아이템 능력치 생성 함수
function generateRandomStats(statRanges) {
    const randomStats = {};
    for (const [statName, range] of Object.entries(statRanges)) {
        if (range[0] === range[1]) {
            // 고정값인 경우
            randomStats[statName] = range[0];
        } else {
            // 범위에서 랜덤 생성
            randomStats[statName] = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        }
    }
    return randomStats;
}

// 메이플스토리 정확한 스타포스 강화 확률표 (0-30성)
const STARFORCE_RATES = {
    0: { success: 95, fail: 5, destroy: 0 },
    1: { success: 90, fail: 10, destroy: 0 },
    2: { success: 85, fail: 15, destroy: 0 },
    3: { success: 85, fail: 15, destroy: 0 },
    4: { success: 80, fail: 20, destroy: 0 },
    5: { success: 75, fail: 25, destroy: 0 },
    6: { success: 70, fail: 30, destroy: 0 },
    7: { success: 65, fail: 35, destroy: 0 },
    8: { success: 60, fail: 40, destroy: 0 },
    9: { success: 55, fail: 45, destroy: 0 },
    10: { success: 50, fail: 50, destroy: 0 },
    11: { success: 45, fail: 55, destroy: 0 },
    12: { success: 40, fail: 60, destroy: 0 },
    13: { success: 35, fail: 65, destroy: 0 },
    14: { success: 30, fail: 70, destroy: 0 },
    15: { success: 30, fail: 67.9, destroy: 2.1 },
    16: { success: 30, fail: 67.9, destroy: 2.1 },
    17: { success: 15, fail: 78.2, destroy: 6.8 },
    18: { success: 15, fail: 78.2, destroy: 6.8 },
    19: { success: 15, fail: 76.5, destroy: 8.5 },
    20: { success: 30, fail: 59.5, destroy: 10.5 },
    21: { success: 15, fail: 72.25, destroy: 12.75 },
    22: { success: 15, fail: 68, destroy: 17 },
    23: { success: 10, fail: 72, destroy: 18 },
    24: { success: 10, fail: 72, destroy: 18 },
    25: { success: 10, fail: 72, destroy: 18 },
    26: { success: 7, fail: 74.4, destroy: 18.6 },
    27: { success: 5, fail: 76, destroy: 19 },
    28: { success: 3, fail: 77.6, destroy: 19.4 },
    29: { success: 1, fail: 79.2, destroy: 19.8 },
    30: { success: 0, fail: 0, destroy: 0 } // 30성은 최대
};

// 메이플스토리 정확한 강화 비용 계수표
const COST_COEFFICIENTS = {
    0: 36, 1: 36, 2: 36, 3: 36, 4: 36, 5: 36, 6: 36, 7: 36, 8: 36, 9: 36, 10: 36,
    11: 571, 12: 314, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45,
    20: 200, 21: 125, 22: 200, 23: 200, 24: 200, 25: 200, 26: 200, 27: 200, 28: 200, 29: 200
};

// 아이템 레벨별 설정 (모든 상점 아이템 포함)
const ITEM_LEVELS = {
    '기본 검': 1,
    '기본 갑옷': 1,
    '체력 포션': 1,
    '마나 포션': 1,
    '강철 검': 10,
    '꽃잎 세트': 1,
    '별빛 세트': 20,
    '드래곤 세트': 40,
    '시공 세트': 60,
    '강화왕 세트': 80
};

// 강화 비용 계산 함수 (Discord 봇에 맞게 조정된 골드 경제)
function calculateEnhanceCost(itemLevel, currentStar) {
    if (currentStar >= 30) return 0; // 30성은 최대
    
    const L = itemLevel;
    const S = currentStar;
    const coefficient = COST_COEFFICIENTS[S] || 200;
    
    // 기본 공식: 100 + L × 3^(S+1) × 계수
    // Discord 봇 경제에 맞게 1/10000 스케일로 조정
    const baseCost = 100 + L * Math.pow(3, S + 1) * coefficient;
    const adjustedCost = Math.floor(baseCost / 10000);
    
    // 최소 비용 보장 및 십의 자리 반올림
    const finalCost = Math.max(100, adjustedCost);
    return Math.round(finalCost / 10) * 10;
}

// 스타포스 스탯 보너스 계산 함수
function calculateStarforceBonus(itemLevel, starLevel) {
    if (starLevel <= 0) return { attack: 0, defense: 0 };
    
    // 메이플스토리 공식: 레벨/20 + 스타당 고정 보너스
    const baseBonus = Math.floor(itemLevel / 20) + 1;
    
    let attack = 0;
    let defense = 0;
    
    // 1-5성: 기본 보너스
    for (let i = 1; i <= Math.min(starLevel, 5); i++) {
        attack += baseBonus;
        defense += baseBonus;
    }
    
    // 6-10성: 보너스 증가
    for (let i = 6; i <= Math.min(starLevel, 10); i++) {
        attack += baseBonus + 1;
        defense += baseBonus + 1;
    }
    
    // 11-15성: 더 큰 보너스
    for (let i = 11; i <= Math.min(starLevel, 15); i++) {
        attack += baseBonus + 2;
        defense += baseBonus + 2;
    }
    
    // 16-25성: 최고 보너스
    for (let i = 16; i <= Math.min(starLevel, 25); i++) {
        attack += baseBonus + 3;
        defense += baseBonus + 3;
    }
    
    // 26-30성: 극한 보너스
    for (let i = 26; i <= Math.min(starLevel, 30); i++) {
        attack += baseBonus + 5;
        defense += baseBonus + 5;
    }
    
    return { attack, defense };
}

// 스타캐치 확률 조정 함수
function applyStarCatch(rates) {
    const newSuccess = Math.min(100, rates.success * 1.05);
    const remaining = 100 - newSuccess;
    const failRatio = rates.fail / (rates.fail + rates.destroy);
    
    return {
        success: newSuccess,
        fail: remaining * failRatio,
        destroy: remaining * (1 - failRatio)
    };
}

// 축복받은날 확률 조정 함수 (15~22성만)
function applySundayMaple(rates, starLevel) {
    if (starLevel < 15 || starLevel > 22) return rates;
    
    const newDestroy = rates.destroy * 0.7;
    const newFail = rates.fail + (rates.destroy - newDestroy);
    
    return {
        success: rates.success,
        fail: newFail,
        destroy: newDestroy
    };
}

// 강화 시도 함수
function attemptEnhance(rates, isStarCatch = false, isSunday = false, starLevel = 0) {
    let finalRates = { ...rates };
    
    if (isStarCatch) {
        finalRates = applyStarCatch(finalRates);
    }
    
    if (isSunday) {
        finalRates = applySundayMaple(finalRates, starLevel);
    }
    
    const random = Math.random() * 100;
    
    if (random <= finalRates.success) {
        return 'success';
    } else if (random <= finalRates.success + finalRates.fail) {
        return 'fail';
    } else {
        return 'destroy';
    }
}

// 보호권을 사용한 강화 시도 함수
function attemptEnhanceWithProtection(rates, isStarCatch = false, isSunday = false, starLevel = 0, useProtection = false) {
    const baseResult = attemptEnhance(rates, isStarCatch, isSunday, starLevel);
    
    // 보호권 사용 시 파괴 결과를 실패로 변경
    if (useProtection && baseResult === 'destroy') {
        return 'fail';
    }
    
    return baseResult;
}

// 최고 강화 장비 찾기 함수
async function getTopEnhancedUser() {
    try {
        const users = await User.find({ registered: true });
        let topUser = null;
        let maxEnhance = -1;
        let topItem = null;

        for (const user of users) {
            // 착용 장비 확인
            for (const [slot, equipment] of Object.entries(user.equipment)) {
                if (equipment && equipment.enhanceLevel > maxEnhance) {
                    maxEnhance = equipment.enhanceLevel;
                    topUser = user;
                    topItem = equipment;
                }
            }
        }

        return { user: topUser, item: topItem, enhanceLevel: maxEnhance };
    } catch (error) {
        console.error('최고 강화 유저 조회 오류:', error);
        return null;
    }
}

// 강화왕 역할 업데이트 함수
async function updateEnhanceKingRole(guild) {
    try {
        const ENHANCE_KING_ROLE_NAME = '강화왕';
        
        // 강화왕 역할 찾기 또는 생성
        let enhanceKingRole = guild.roles.cache.find(role => role.name === ENHANCE_KING_ROLE_NAME);
        
        if (!enhanceKingRole) {
            enhanceKingRole = await guild.roles.create({
                name: ENHANCE_KING_ROLE_NAME,
                color: '#FF6B00', // 주황색
                hoist: true,
                reason: '강화왕 시스템 자동 생성'
            });
        }
        
        // 현재 강화왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(enhanceKingRole.id)
        );
        
        // 최고 강화 유저 찾기
        const topData = await getTopEnhancedUser();
        
        if (!topData || !topData.user) return;
        
        const newKing = guild.members.cache.get(topData.user.discordId);
        
        if (!newKing) return;
        
        // 현재 왕이 새로운 왕과 다르면 역할 변경
        if (!currentKing || currentKing.id !== newKing.id) {
            // 기존 왕에서 역할 제거
            if (currentKing) {
                await currentKing.roles.remove(enhanceKingRole);
            }
            
            // 새로운 왕에게 역할 부여
            await newKing.roles.add(enhanceKingRole);
        }
        
    } catch (error) {
        console.error('강화왕 역할 업데이트 오류:', error);
    }
}

// 전투력 계산 함수
function calculateCombatPower(user) {
    let basePower = 0;
    
    // 엠블럼에 따른 스탯 계산
    if (user.emblem) {
        // 엠블럼 단계 확인
        const emblemLevel = getEmblemLevel(user.emblem);
        const emblemMultiplier = 1 + (emblemLevel * 0.25); // 1단계: 1.25, 2단계: 1.5, ...
        
        // 엠블럼 계열에 따른 주스탯만 적용
        const emblemType = getEmblemType(user.emblem);
        
        switch(emblemType) {
            case 'warrior':
                basePower = user.stats.strength * emblemMultiplier * 3; // 전사는 힘만, 높은 배율
                break;
            case 'archer':
                basePower = user.stats.agility * emblemMultiplier * 3; // 궁수는 민첩만
                break;
            case 'spellsword':
                basePower = user.stats.intelligence * emblemMultiplier * 3; // 마검사는 지능만
                break;
            case 'rogue':
                basePower = user.stats.luck * emblemMultiplier * 3; // 도적은 행운만
                break;
        }
        
        // 체력은 생존력으로 모든 직업에 적용 (낮은 배율)
        basePower += user.stats.vitality * 0.5;
    } else {
        // 엠블럼이 없으면 기존 방식 (모든 스탯 반영)
        basePower = user.stats.strength * 2 + user.stats.agility + user.stats.intelligence * 0.5 + user.stats.vitality * 1.5 + user.stats.luck;
    }
    
    // 장비 보너스 및 스타포스 보너스
    let equipmentBonus = 0;
    let starforceBonus = 0;
    
    // 각 장비슬롯별 계산
    Object.entries(user.equipment).forEach(([slot, equipment]) => {
        if (equipment) {
            // 기본 장비 스탯
            const attack = equipment.stats.attack || 0;
            const defense = equipment.stats.defense || 0;
            equipmentBonus += attack + defense;
            
            // 스타포스 보너스 계산
            if (equipment.enhanceLevel > 0) {
                const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || equipment.level || 1;
                const bonus = calculateStarforceBonus(itemLevel, equipment.enhanceLevel);
                starforceBonus += bonus.attack + bonus.defense;
            }
        }
    });
    
    // 레벨 보너스
    let levelBonus = user.level * 5;
    
    return Math.floor(basePower + equipmentBonus + starforceBonus + levelBonus);
}

// 엠블럼 단계 확인 함수
function getEmblemLevel(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const emblemIndex = categoryData.emblems.findIndex(emblem => emblem.name === emblemName);
        if (emblemIndex !== -1) {
            return emblemIndex + 1; // 1단계부터 시작
        }
    }
    return 1; // 기본값
}

// 엠블럼 계열 확인 함수
function getEmblemType(emblemName) {
    for (const [categoryKey, categoryData] of Object.entries(EMBLEMS)) {
        const hasEmblem = categoryData.emblems.some(emblem => emblem.name === emblemName);
        if (hasEmblem) {
            return categoryKey;
        }
    }
    return null;
}

// 몬스터 전투력 계산 함수
function calculateMonsterPower(monster, level) {
    return Math.floor(monster.stats.atk + monster.stats.def + (level * 3));
}

// 유저 초기화/조회 함수
async function getUser(discordId) {
    try {
        let user = await User.findOne({ discordId });
        if (!user) {
            user = new User({ discordId });
            await user.save();
            console.log(`새 유저 생성: ${discordId}`);
        }
        return user;
    } catch (error) {
        console.error('유저 조회/생성 오류:', error);
        return null;
    }
}

// 레벨업 처리 함수
function processLevelUp(user) {
    let leveledUp = false;
    let levelsGained = 0;
    const oldLevel = user.level;
    
    while (user.exp >= user.level * 100) {
        user.exp -= user.level * 100;
        user.level += 1;
        levelsGained += 1;
        leveledUp = true;
        
        // 레벨업 시 스탯포인트 지급 (레벨당 5포인트)
        user.statPoints += 5;

        // 새로운 사냥터 해금 체크
        const newUnlockArea = huntingAreas.find(area => 
            area.unlockLevel === user.level && !user.unlockedAreas.includes(area.id)
        );
        if (newUnlockArea) {
            user.unlockedAreas.push(newUnlockArea.id);
        }
    }
    
    return { leveledUp, levelsGained, oldLevel };
}

// 인기도 업데이트 함수
async function updatePopularity(messageAuthorId, emoji, value, messageId, guild) {
    try {
        const user = await getUser(messageAuthorId);
        if (!user || !user.registered) return { success: false, message: '등록되지 않은 사용자입니다.' };
        
        // 같은 메시지에 대한 이전 반응 확인
        const existingReaction = user.popularityHistory.find(h => h.messageId === messageId && h.emoji === emoji);
        if (existingReaction) {
            return { success: false, message: '이미 반응한 메시지입니다.' };
        }
        
        // 일일 제한 리셋 확인
        const today = new Date().toDateString();
        if (user.lastPopularityReset !== today) {
            user.dailyPopularityGain = 0;
            user.dailyPopularityLoss = 0;
            user.lastPopularityReset = today;
        }
        
        // 일일 제한 확인
        if (value > 0 && user.dailyPopularityGain >= 10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 상승치를 모두 받았습니다. (+10)' };
        }
        if (value < 0 && user.dailyPopularityLoss <= -10) {
            return { success: false, message: '오늘 받을 수 있는 인기도 하락치를 모두 받았습니다. (-10)' };
        }
        
        // 실제로 적용할 값 계산
        let actualChange = value;
        if (value > 0) {
            actualChange = Math.min(value, 10 - user.dailyPopularityGain);
            user.dailyPopularityGain += actualChange;
        } else {
            actualChange = Math.max(value, -10 - user.dailyPopularityLoss);
            user.dailyPopularityLoss += actualChange;
        }
        
        if (actualChange === 0) {
            return { success: false, message: `오늘의 인기도 ${value > 0 ? '상승' : '하락'} 한도에 도달했습니다.` };
        }
        
        // 인기도 업데이트
        user.popularity += actualChange;
        user.lastPopularityUpdate = new Date();
        user.popularityHistory.push({
            messageId,
            emoji,
            value: actualChange,
            date: new Date()
        });
        
        await user.save();
        
        // 인기왕 역할 업데이트
        await updatePopularKingRole(guild);
        
        const dailyStatus = value > 0 
            ? `(오늘 +${user.dailyPopularityGain}/10)`
            : `(오늘 ${user.dailyPopularityLoss}/10)`;
        
        return { 
            success: true, 
            newPopularity: user.popularity,
            change: actualChange,
            message: `인기도가 ${actualChange > 0 ? '+' : ''}${actualChange}되어 ${user.popularity}가 되었습니다. ${dailyStatus}`
        };
    } catch (error) {
        console.error('인기도 업데이트 오류:', error);
        return { success: false, message: '인기도 업데이트 중 오류가 발생했습니다.' };
    }
}

// 인기왕 역할 업데이트 함수
async function updatePopularKingRole(guild) {
    try {
        // 인기왕 역할 찾기 또는 생성
        let popularKingRole = guild.roles.cache.find(role => role.name === POPULAR_KING_ROLE_NAME);
        
        if (!popularKingRole) {
            popularKingRole = await guild.roles.create({
                name: POPULAR_KING_ROLE_NAME,
                color: '#FFD700',
                hoist: true,
                reason: '인기왕 시스템 자동 생성'
            });
        }
        
        // 현재 인기왕 찾기
        const currentKing = guild.members.cache.find(member => 
            member.roles.cache.has(popularKingRole.id)
        );
        
        // 가장 높은 인기도를 가진 유저 찾기
        const topUser = await User.findOne({ registered: true })
            .sort({ popularity: -1 })
            .limit(1);
        
        if (!topUser || topUser.popularity <= 0) {
            // 인기도가 양수인 사람이 없으면 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }
            return;
        }
        
        // 새로운 인기왕이 필요한 경우
        if (!currentKing || currentKing.id !== topUser.discordId) {
            // 기존 인기왕 역할 회수
            if (currentKing) {
                await currentKing.roles.remove(popularKingRole);
            }
            
            // 새로운 인기왕에게 역할 부여
            const newKing = await guild.members.fetch(topUser.discordId);
            if (newKing) {
                await newKing.roles.add(popularKingRole);
                
                // 채널에 알림 (선택사항)
                const channel = guild.channels.cache.get(GAME_CHANNEL_ID);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('👑 새로운 인기왕 탄생!')
                        .setDescription(`**${topUser.nickname}**님이 인기도 ${topUser.popularity}점으로 새로운 인기왕이 되었습니다!`)
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        }
    } catch (error) {
        console.error('인기왕 역할 업데이트 오류:', error);
    }
}

// 슬래시 명령어 정의
const commands = [
    new SlashCommandBuilder()
        .setName('게임')
        .setDescription('강화왕 김헌터 게임 메뉴'),
    
    new SlashCommandBuilder()
        .setName('핑')
        .setDescription('봇의 응답 속도를 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('회원가입')
        .setDescription('강화왕 김헌터 회원가입'),
    
    new SlashCommandBuilder()
        .setName('db테스트')
        .setDescription('데이터베이스 연결 테스트'),
    
    new SlashCommandBuilder()
        .setName('이메일테스트')
        .setDescription('이메일 전송 테스트'),
    
    new SlashCommandBuilder()
        .setName('회원가입채널설정')
        .setDescription('회원가입 채널에 안내 메시지를 게시합니다'),
    
    new SlashCommandBuilder()
        .setName('인기도테스트')
        .setDescription('테스트용 인기도 조작 명령어')
        .addStringOption(option =>
            option.setName('행동')
                .setDescription('수행할 행동')
                .setRequired(true)
                .addChoices(
                    { name: '인기도 증가 (+5)', value: 'add' },
                    { name: '인기도 감소 (-5)', value: 'subtract' },
                    { name: '일일 한도 리셋', value: 'reset' },
                    { name: '인기도 확인', value: 'check' }
                )),
    
    new SlashCommandBuilder()
        .setName('전투력수정')
        .setDescription('관리자 전용: 전투력 수정 명령어')
        .addStringOption(option =>
            option.setName('타입')
                .setDescription('수정할 능력치')
                .setRequired(true)
                .addChoices(
                    { name: '힘 (+10)', value: 'strength' },
                    { name: '민첩 (+10)', value: 'agility' },
                    { name: '지능 (+10)', value: 'intelligence' },
                    { name: '체력 (+10)', value: 'vitality' },
                    { name: '행운 (+10)', value: 'luck' },
                    { name: '전투력 확인', value: 'check' }
                )),

    new SlashCommandBuilder()
        .setName('강화')
        .setDescription('장비를 강화합니다 (스타포스 0-30성)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('결투')
        .setDescription('PVP 결투를 시작합니다'),

    new SlashCommandBuilder()
        .setName('결투정보')
        .setDescription('PVP 통계 및 정보를 확인합니다'),

    new SlashCommandBuilder()
        .setName('랭킹')
        .setDescription('PVP 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('집중력')
        .setDescription('김헌터의 집중력 축복으로 장비를 강화합니다 (성공률 5% 증가)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('축복받은날')
        .setDescription('김헌터의 축복받은 날로 강화합니다 (15-22성 파괴율 30% 감소)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기 (weapon)', value: 'weapon' },
                    { name: '갑옷 (armor)', value: 'armor' },
                    { name: '투구 (helmet)', value: 'helmet' },
                    { name: '장갑 (gloves)', value: 'gloves' },
                    { name: '신발 (boots)', value: 'boots' },
                    { name: '액세서리 (accessory)', value: 'accessory' }
                )),

    new SlashCommandBuilder()
        .setName('강화랭킹')
        .setDescription('강화 랭킹을 확인합니다'),

    new SlashCommandBuilder()
        .setName('강화통계')
        .setDescription('나의 강화 통계를 확인합니다'),

    new SlashCommandBuilder()
        .setName('의뢰')
        .setDescription('마을 의뢰를 수행합니다'),

    new SlashCommandBuilder()
        .setName('주식')
        .setDescription('혁신적인 주식 시장에 참여합니다'),
    
    // 🔮 에너지 조각 시스템 명령어
    new SlashCommandBuilder()
        .setName('에너지채굴')
        .setDescription('⛏️ 1단계 에너지 조각을 채굴합니다 (500골드, 쿨타임 2분)'),
    
    new SlashCommandBuilder()
        .setName('조각융합')
        .setDescription('🔄 보유한 같은 단계 조각들을 자동으로 융합합니다 (일일 20회 제한)'),
    
    new SlashCommandBuilder()
        .setName('내조각')
        .setDescription('💎 현재 보유한 에너지 조각을 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('융합랭킹')
        .setDescription('🏆 이번 주 에너지 조각 융합 랭킹을 확인합니다'),
    
    new SlashCommandBuilder()
        .setName('내전투력')
        .setDescription('⚔️ 현재 전투력과 에너지 조각 정보를 확인합니다'),
    
    // 관리자 전용 명령어
    new SlashCommandBuilder()
        .setName('게임데이터초기화')
        .setDescription('🔧 [관리자 전용] 모든 게임 데이터를 초기화합니다'),
    
    new SlashCommandBuilder()
        .setName('융합수동')
        .setDescription('🎯 특정 단계의 조각을 선택하여 수동으로 융합합니다')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    console.log(`${client.user.tag} 봇이 온라인 상태입니다! - 자동 재시작 테스트`);
    console.log(`개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0) {
        console.log(`개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
    }
    
    // MongoDB 연결
    await connectDB();
    
    // 게임 데이터 로드
    loadGameData();
    
    // 슬래시 명령어 등록
    try {
        const rest = new REST().setToken(TOKEN);
        console.log('슬래시 명령어 등록 중...');
        
        // 개발 모드에서는 길드(서버) 명령어 사용 (즉시 적용)
        const guildId = DEV_MODE ? '1371885859649097849' : null; // 개발 서버 ID
        
        const data = await rest.put(
            guildId ? Routes.applicationGuildCommands(CLIENT_ID, guildId) : Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log(`슬래시 명령어 ${data.length}개가 등록되었습니다!`);
        console.log('등록된 명령어:', data.map(cmd => cmd.name).join(', '));
    } catch (error) {
        console.error('명령어 등록 실패:', error);
    }
    
    // 엠블럼 시스템 초기화
    await initializeEmblemSystem();
});

// 엠블럼 시스템 초기화 함수
async function initializeEmblemSystem() {
    try {
        const channel = await client.channels.fetch(EMBLEM_CHANNEL_ID);
        if (!channel) {
            console.log('엠블럼 채널을 찾을 수 없습니다.');
            return;
        }

        // 엠블럼 상점 임베드 생성
        const emblemEmbed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('🏆 엠블럼 상점')
            .setDescription('**레벨 20 이상**부터 엠블럼을 구매할 수 있습니다!\n\n엠블럼을 구매하면 특별한 칭호 역할을 받게 됩니다.\n**⚠️ 엠블럼은 한 번 구매하면 변경할 수 없습니다!**')
            .addFields(
                { name: '⚔️ 전사 계열', value: '초보전사 → 튼튼한 기사 → 용맹한 검사 → 맹령한 전사 → 전설의 기사', inline: false },
                { name: '🏹 궁수 계열', value: '마을사냥꾼 → 숲의 궁수 → 바람 사수 → 정확한 사격수 → 전설의 명궁', inline: false },
                { name: '🔮 마검사 계열', value: '마법 학도 → 마법 검사 → 현명한 기사 → 마도 검사 → 전설의 마검사', inline: false },
                { name: '🗡️ 도적 계열', value: '떠돌이 도적 → 운 좋은 도둑 → 행운의 닌자 → 복 많은 도적 → 전설의 행운아', inline: false }
            )
            .setFooter({ text: '원하는 계열을 선택하여 엠블럼을 구매하세요!' });

        // 엠블럼 계열 선택 드롭다운
        const emblemSelect = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('emblem_category')
                    .setPlaceholder('엠블럼 계열을 선택하세요')
                    .addOptions([
                        {
                            label: '전사 계열',
                            description: '초보전사부터 전설의 기사까지',
                            value: 'warrior',
                            emoji: '⚔️'
                        },
                        {
                            label: '궁수 계열',
                            description: '마을사냥꾼부터 전설의 명궁까지',
                            value: 'archer',
                            emoji: '🏹'
                        },
                        {
                            label: '마검사 계열',
                            description: '마법 학도부터 전설의 마검사까지',
                            value: 'spellsword',
                            emoji: '🔮'
                        },
                        {
                            label: '도적 계열',
                            description: '떠돌이 도적부터 전설의 행운아까지',
                            value: 'rogue',
                            emoji: '🗡️'
                        }
                    ])
            );

        // 기존 메시지 삭제 후 새로 전송
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (botMessages.size > 0) {
            await channel.bulkDelete(botMessages);
        }

        await channel.send({
            embeds: [emblemEmbed],
            components: [emblemSelect]
        });

        console.log('엠블럼 시스템이 초기화되었습니다.');
    } catch (error) {
        console.error('엠블럼 시스템 초기화 오류:', error);
    }
}

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`명령어 실행 - 채널: ${interaction.channelId}, 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}, 개발 모드: ${DEV_MODE}`);
    
    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0 && !DEV_CHANNEL_IDS.includes(interaction.channelId)) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 허용된 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', flags: 64 });
        return;
    }

    const { commandName } = interaction;

    try {
        if (commandName === '핑') {
            const ping = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`퐁! 지연시간: ${ping}ms`);
        }
        
        else if (commandName === '게임') {
            // 먼저 defer로 응답을 지연시킴 (3초 제한 해결)
            await interaction.deferReply({ flags: 64 });
            
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.editReply({ content: '유저 데이터를 불러올 수 없습니다!' });
                return;
            }
            
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                // 아침 시간대 (6:00 - 11:59)
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b'; // 노란색
            } else if (hour >= 12 && hour < 18) {
                // 점심 시간대 (12:00 - 17:59)
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800'; // 주황색
            } else {
                // 저녁/밤 시간대 (18:00 - 5:59)
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5'; // 남색
            }

            // 상태창 (RPG 스타일)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // 경험치 계산 수정 (레벨업 시 필요 경험치 = 레벨 * 100)
            const maxExp = user.level * 100;
            
            // 출석 현황 계산 (오늘 출석체크 여부)
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '게임 메뉴에 오신 것을 환영합니다!' });

            // 페이지별 버튼 정의
            const pages = [
                // 페이지 1: 일일 활동
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 2: 전투
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('racing')
                            .setLabel('🏁 레이싱')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp_menu')
                            .setLabel('⚔️ PvP')
                            .setStyle(ButtonStyle.Danger)
                    ]
                },
                // 페이지 3: 능력치/스킬
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                // 페이지 4: 상점/인벤토리
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                // 페이지 5: 장비/강화
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10), // 레벨 10 이상만 사용 가능
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];

            // 페이지 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true), // 첫 페이지에서는 비활성화
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/5')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 첫 페이지 버튼 row
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);

            // 시간대별 이미지 첨부파일
            const timeAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
            
            await interaction.editReply({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [timeAttachment]
            });
        }
        
        else if (commandName === '회원가입') {
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('강화왕 김헌터 회원가입')
                .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.')
                .setImage('attachment://kim_join.png')
                .addFields(
                    { name: '이메일 문의', value: 'support@kimhunter.com', inline: true },
                    { name: '디스코드 문의', value: '김헌터#0001', inline: true },
                    { name: '기타 문의', value: '티켓 시스템 이용', inline: true }
                )
                .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('register')
                        .setLabel('회원가입')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row], files: [attachment] });
        }
        
        else if (commandName === 'db테스트') {
            try {
                const user = await getUser(interaction.user.id);
                const totalUsers = await User.countDocuments();
                
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('데이터베이스 테스트')
                    .setDescription('MongoDB 연결 상태를 확인합니다.')
                    .addFields(
                        { name: '연결 상태', value: 'MongoDB 연결 성공', inline: true },
                        { name: '총 유저 수', value: `${totalUsers}명`, inline: true },
                        { name: '내 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '내 레벨', value: `Lv.${user.level}`, inline: true },
                        { name: 'Discord ID', value: user.discordId, inline: true },
                        { name: '가입일', value: user.createdAt.toLocaleDateString('ko-KR'), inline: true }
                    );
                
                await interaction.reply({ embeds: [embed], flags: 64 });
            } catch (error) {
                console.error('DB 테스트 오류:', error);
                await interaction.reply({ content: '데이터베이스 연결 실패!', flags: 64 });
            }
        }
        
        else if (commandName === '인기도테스트') {
            const action = interaction.options.getString('행동');
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            let message = '';
            
            switch(action) {
                case 'add':
                    user.popularity += 5;
                    await user.save();
                    await updatePopularKingRole(interaction.guild);
                    message = `인기도가 5 증가하여 ${user.popularity}점이 되었습니다.`;
                    break;
                    
                case 'subtract':
                    user.popularity -= 5;
                    await user.save();
                    await updatePopularKingRole(interaction.guild);
                    message = `인기도가 5 감소하여 ${user.popularity}점이 되었습니다.`;
                    break;
                    
                case 'reset':
                    user.dailyPopularityGain = 0;
                    user.dailyPopularityLoss = 0;
                    user.lastPopularityReset = new Date().toDateString();
                    await user.save();
                    message = '일일 인기도 한도가 리셋되었습니다.';
                    break;
                    
                case 'check':
                    const today = new Date().toDateString();
                    const isToday = user.lastPopularityReset === today;
                    message = `현재 인기도: ${user.popularity}점\n` +
                             `오늘 받은 인기도: +${isToday ? user.dailyPopularityGain : 0}/10\n` +
                             `오늘 잃은 인기도: ${isToday ? user.dailyPopularityLoss : 0}/10`;
                    break;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('인기도 테스트')
                .setDescription(message)
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (commandName === '전투력수정') {
            if (!isDeveloper(interaction.user.id)) {
                await interaction.reply({ content: '관리자만 사용할 수 있는 명령어입니다!', flags: 64 });
                return;
            }
            
            const user = await getUser(interaction.user.id);
            const statType = interaction.options.getString('타입');
            
            if (statType === 'check') {
                const combatPower = calculateCombatPower(user);
                const embed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('⚔️ 전투력 정보')
                    .setDescription(`**${user.nickname}**님의 전투력 정보`)
                    .addFields(
                        { name: '총 전투력', value: `${combatPower}`, inline: true },
                        { name: '💪 힘', value: `${user.stats.strength}`, inline: true },
                        { name: '🏃 민첩', value: `${user.stats.agility}`, inline: true },
                        { name: '🧠 지능', value: `${user.stats.intelligence}`, inline: true },
                        { name: '❤️ 체력', value: `${user.stats.vitality}`, inline: true },
                        { name: '🍀 행운', value: `${user.stats.luck}`, inline: true }
                    );
                await interaction.reply({ embeds: [embed], flags: 64 });
            } else {
                user.stats[statType] += 10;
                await user.save();
                
                const statNames = {
                    strength: '💪 힘',
                    agility: '🏃 민첩',
                    intelligence: '🧠 지능',
                    vitality: '❤️ 체력',
                    luck: '🍀 행운'
                };
                
                const newCombatPower = calculateCombatPower(user);
                await interaction.reply({ 
                    content: `${statNames[statType]}이 10 증가했습니다! 전투력: ${newCombatPower}`, 
                    flags: 64 
                });
            }
        }
        
        else if (commandName === '이메일테스트') {
            try {
                // 먼저 응답을 지연시켜 시간 제한 문제 해결
                await interaction.deferReply({ flags: 64 });
                
                const testCode = generateVerificationCode();
                const emailSent = await sendVerificationEmail('sup.kimhunter@gmail.com', testCode);
                
                if (emailSent) {
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('이메일 테스트 성공!')
                        .setDescription('테스트 이메일이 성공적으로 전송되었습니다.')
                        .addFields(
                            { name: '수신 이메일', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '테스트 코드', value: testCode, inline: true },
                            { name: '전송 시간', value: new Date().toLocaleString('ko-KR'), inline: true }
                        );
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply({ content: '이메일 전송에 실패했습니다!' });
                }
            } catch (error) {
                console.error('이메일 테스트 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '이메일 테스트 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '이메일 테스트 중 오류가 발생했습니다!', flags: 64 });
                }
            }
        }
        
        else if (commandName === '회원가입채널설정') {
            try {
                await interaction.deferReply({ flags: 64 });
                
                const SIGNUP_CHANNEL_ID = '1380684353998426122';
                const signupChannel = await client.channels.fetch(SIGNUP_CHANNEL_ID);
                
                if (signupChannel) {
                    const signupAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_join.png'), { name: 'kim_join.png' });
                    
                    const signupEmbed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('강화왕 김헌터 회원가입')
                        .setDescription('환영합니다! 강화왕 김헌터의 세계로 오신 것을 환영합니다.\n\n게임을 시작하기 위해 회원가입을 진행해주세요.\n\n**회원가입 혜택:**\n• 가입 즉시 1,000G 지급\n• 경험치 부스터 및 초보자 무기 제공\n• 일일보상 및 다양한 게임 컨텐츠 이용 가능')
                        .setImage('attachment://kim_join.png')
                        .addFields(
                            { name: '📧 이메일 문의', value: 'sup.kimhunter@gmail.com', inline: true },
                            { name: '💬 디스코드 문의', value: 'JRY_10004', inline: true },
                            { name: '🎫 티켓 문의', value: '추후 버튼링크 생성 예정', inline: true }
                        )
                        .setFooter({ text: '아래 버튼을 눌러 회원가입을 진행하세요!' });

                    const signupRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('register')
                                .setLabel('회원가입')
                                .setStyle(ButtonStyle.Primary)
                        );

                    await signupChannel.send({ embeds: [signupEmbed], components: [signupRow], files: [signupAttachment] });
                    
                    await interaction.editReply({ content: '회원가입 채널에 안내 메시지를 성공적으로 게시했습니다!' });
                } else {
                    await interaction.editReply({ content: '회원가입 채널을 찾을 수 없습니다!' });
                }
            } catch (error) {
                console.error('회원가입 채널 설정 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '회원가입 채널 설정 중 오류가 발생했습니다!', flags: 64 });
                }
            }
        }
        
        // 강화 명령어 처리
        else if (commandName === '강화' || commandName === '집중력' || commandName === '축복받은날') {
            const slotName = interaction.options.getString('장비슬롯');
            const useProtection = interaction.options.getBoolean('보호권사용') || false;
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 새로운 인벤토리 시스템으로 장착 아이템 확인
            const equipment = getEquippedItem(user, slotName);
            if (!equipment) {
                await interaction.reply({ content: `${slotName} 슬롯에 장착된 장비가 없습니다!`, flags: 64 });
                return;
            }
            
            if (equipment.enhanceLevel >= 30) {
                await interaction.reply({ content: '이미 최대 강화 단계(30성)입니다!', flags: 64 });
                return;
            }
            
            // 보호권 사용 조건 체크 (20강 이상)
            if (useProtection) {
                if (equipment.enhanceLevel < 20) {
                    await interaction.reply({ content: '보호권은 20성 이상부터 사용할 수 있습니다!', flags: 64 });
                    return;
                }
                if (user.protectionScrolls < 1) {
                    await interaction.reply({ content: '보유한 보호권이 없습니다!', flags: 64 });
                    return;
                }
            }
            
            // 아이템 레벨 가져오기
            const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || 1;
            const currentStar = equipment.enhanceLevel || 0;
            const cost = calculateEnhanceCost(itemLevel, currentStar);
            
            if (user.gold < cost) {
                await interaction.reply({ 
                    content: `골드가 부족합니다! 필요: ${cost}G, 보유: ${user.gold}G`, 
                    flags: 64 
                });
                return;
            }
            
            // 강화 시도
            const rates = STARFORCE_RATES[currentStar];
            const isStarCatch = commandName === '집중력';
            const isSunday = commandName === '축복받은날';
            
            const result = attemptEnhanceWithProtection(rates, isStarCatch, isSunday, currentStar, useProtection);
            user.gold -= cost;
            
            // 보호권 사용시 차감
            if (useProtection && (result === 'destroy' || result === 'fail')) {
                user.protectionScrolls -= 1;
            }
            
            // 강화 통계 업데이트
            user.enhanceStats.totalAttempts += 1;
            user.enhanceStats.totalCost += cost;
            
            let resultEmbed;
            
            if (result === 'success') {
                equipment.enhanceLevel += 1;
                user.enhanceStats.successCount += 1;
                user.enhanceStats.maxEnhanceLevel = Math.max(user.enhanceStats.maxEnhanceLevel, equipment.enhanceLevel);
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 강화 성공!')
                    .setDescription(`**${equipment.name}**이(가) 강화되었습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} → **+${equipment.enhanceLevel}**⭐`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
                    
                // 강화왕 업데이트 (10성 이상일 때)
                if (equipment.enhanceLevel >= 10) {
                    await updateEnhanceKingRole(interaction.guild);
                }
                
                // 주식 시장 이벤트 트리거
                triggerEnhancementEvent(equipment.enhanceLevel, true);
                
            } else if (result === 'fail') {
                resultEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('💫 강화 실패')
                    .setDescription(`**${equipment.name}** 강화에 실패했습니다.`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} (변화없음)`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
                
                // 주식 시장 이벤트 트리거 (실패)
                triggerEnhancementEvent(equipment.enhanceLevel, false);
                    
            } else { // destroy
                const oldLevel = equipment.enhanceLevel;
                equipment.enhanceLevel = Math.max(0, equipment.enhanceLevel - 1);
                user.enhanceStats.destroyCount += 1;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('💥 강화 파괴!')
                    .setDescription(`**${equipment.name}**이(가) 파괴되어 강화 단계가 감소했습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${oldLevel} → **+${equipment.enhanceLevel}**💀`, inline: true },
                        { name: '사용 골드', value: `${cost}G`, inline: true },
                        { name: '잔여 골드', value: `${user.gold}G`, inline: true }
                    );
                
                // 주식 시장 이벤트 트리거 (파괴)
                triggerEnhancementEvent(oldLevel, false);
            }
            
            // 이벤트 효과 표시
            if (isStarCatch) {
                resultEmbed.setFooter({ text: '🌟 집중력 이벤트 적용 (성공률 +5%)' });
            } else if (isSunday && currentStar >= 15 && currentStar <= 22) {
                resultEmbed.setFooter({ text: '🍁 축복받은날 이벤트 적용 (파괴율 -30%)' });
            }
            
            await user.save();
            await interaction.reply({ embeds: [resultEmbed] });
        }
        
        else if (commandName === '강화랭킹') {
            await interaction.deferReply();
            
            try {
                const users = await User.find({ registered: true });
                const rankingData = [];
                
                for (const user of users) {
                    let maxEnhance = 0;
                    let topItem = null;
                    
                    // 착용 장비에서 최고 강화 찾기
                    for (const [slot, equipment] of Object.entries(user.equipment)) {
                        if (equipment && equipment.enhanceLevel > maxEnhance) {
                            maxEnhance = equipment.enhanceLevel;
                            topItem = equipment;
                        }
                    }
                    
                    if (maxEnhance > 0) {
                        rankingData.push({
                            nickname: user.nickname,
                            enhanceLevel: maxEnhance,
                            itemName: topItem.name,
                            totalAttempts: user.enhanceStats.totalAttempts || 0
                        });
                    }
                }
                
                // 강화 레벨순으로 정렬
                rankingData.sort((a, b) => b.enhanceLevel - a.enhanceLevel);
                
                const embed = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('⚔️ 강화 랭킹 TOP 10')
                    .setDescription('최고 강화 장비 기준 랭킹');
                
                let rankText = '';
                for (let i = 0; i < Math.min(10, rankingData.length); i++) {
                    const data = rankingData[i];
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}위`;
                    rankText += `${medal} **${data.nickname}** - ${data.itemName} +${data.enhanceLevel}⭐\n`;
                }
                
                if (rankText === '') {
                    rankText = '아직 강화한 사용자가 없습니다.';
                }
                
                embed.addFields({ name: '랭킹', value: rankText, inline: false });
                
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('강화랭킹 조회 오류:', error);
                await interaction.editReply({ content: '랭킹 조회 중 오류가 발생했습니다!' });
            }
        }
        
        else if (commandName === '의뢰') {
            // 쿨타임 체크
            const cooldownMinutes = checkQuestCooldown(interaction.user.id);
            if (cooldownMinutes) {
                await interaction.reply({ 
                    content: `⏰ 의뢰 쿨타임이 **${cooldownMinutes}분** 남았습니다!`, 
                    flags: 64 
                });
                return;
            }

            // 랜덤 의뢰 선택
            const quest = getRandomQuest();
            
            const questEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(`${quest.emoji} ${quest.title}`)
                .setDescription(`**${quest.name}**\n\n"${quest.description}"`)
                .setFooter({ text: '의뢰를 수락하시겠습니까?' });

            if (quest.type === 'scam') {
                questEmbed.setColor('#e74c3c');
            }

            const questButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_quest_${quest.id}`)
                        .setLabel('✅ 수락')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('decline_quest')
                        .setLabel('❌ 거절')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.reply({ 
                embeds: [questEmbed], 
                components: [questButtons], 
                flags: 64 
            });
        }
        
        else if (commandName === '주식') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 레벨 20 이상 제한
            if (user.level < 20) {
                await interaction.reply({ 
                    content: `주식 시장은 **레벨 20 이상**부터 이용할 수 있습니다! (현재 레벨: ${user.level})`, 
                    flags: 64 
                });
                return;
            }
            
            // 플레이어 포트폴리오 가져오기
            const portfolio = getPlayerPortfolio(interaction.user.id);
            
            // 상위 5개 기업 정보 수집
            const allCompanies = [];
            
            // 지역 기업들 추가
            for (const region of Object.values(STOCK_MARKET.regions)) {
                region.companies.forEach(company => {
                    allCompanies.push({
                        ...company,
                        region: region.name
                    });
                });
            }
            
            // 체인 기업들 추가
            STOCK_MARKET.chains.forEach(company => {
                allCompanies.push({
                    ...company,
                    region: '🌐 전지역'
                });
            });
            
            // 가격 순으로 정렬
            allCompanies.sort((a, b) => b.price - a.price);
            const topCompanies = allCompanies.slice(0, 10);
            
            // 포트폴리오 총 가치 계산
            let totalPortfolioValue = portfolio.cash;
            let portfolioText = `💰 현금: ${portfolio.cash.toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
            
            if (portfolio.stocks.size > 0) {
                portfolioText += '📈 **보유 주식:**\n';
                for (const [companyId, holding] of portfolio.stocks) {
                    const company = findCompany(companyId);
                    if (company) {
                        const currentValue = company.price * holding.shares;
                        const profit = currentValue - (holding.avgPrice * holding.shares);
                        const profitPercent = ((profit / (holding.avgPrice * holding.shares)) * 100).toFixed(1);
                        
                        portfolioText += `• ${company.name}: ${holding.shares}주 `;
                        portfolioText += `(${profitPercent >= 0 ? '+' : ''}${profitPercent}%)\n`;
                        
                        totalPortfolioValue += currentValue;
                    }
                }
            } else {
                portfolioText += '📊 보유 주식이 없습니다.\n';
            }
            
            portfolioText += `\n💎 **총 자산**: ${totalPortfolioValue.toLocaleString()}<:currency_emoji:1377404064316522778>`;
            
            // 상위 기업 목록 생성
            let marketText = '';
            topCompanies.forEach((company, index) => {
                const changeIcon = company.change > 0 ? '📈' : company.change < 0 ? '📉' : '➡️';
                const changeColor = company.change > 0 ? '+' : '';
                marketText += `${index + 1}. **${company.name}**\n`;
                marketText += `   ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${changeIcon} ${changeColor}${company.change.toFixed(1)}%\n`;
                marketText += `   ${company.region} | 거래량: ${company.volume.toLocaleString()}\n\n`;
            });
            
            const stockEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('📊 김헌터 주식 시장')
                .setDescription(`**${user.nickname}**님의 투자 현황\n\n${portfolioText}`)
                .addFields(
                    { 
                        name: '🏆 상위 기업 순위', 
                        value: marketText || '데이터를 불러오는 중...', 
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: '실시간 주가는 NPC 감정, 플레이어 행동, 시간대별 이벤트에 영향을 받습니다!' 
                });
            
            // 주식 관련 버튼들 (2줄로 배치)
            const stockButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_regions')
                        .setLabel('🌍 지역별 기업')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stock_chains')
                        .setLabel('🏢 체인 기업')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stock_portfolio')
                        .setLabel('💼 내 포트폴리오')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const stockButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_news')
                        .setLabel('📰 시장 뉴스')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stock_chart')
                        .setLabel('📊 실시간 차트')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('stock_analysis')
                        .setLabel('🔍 시장 분석')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.reply({ 
                embeds: [stockEmbed], 
                components: [stockButtons1, stockButtons2], 
                flags: 64 
            });
        }
        
        else if (commandName === '강화통계') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const stats = user.enhanceStats;
            const successRate = stats.totalAttempts > 0 ? ((stats.successCount / stats.totalAttempts) * 100).toFixed(1) : 0;
            const destroyRate = stats.totalAttempts > 0 ? ((stats.destroyCount / stats.totalAttempts) * 100).toFixed(1) : 0;
            
            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`📊 ${user.nickname}님의 강화 통계`)
                .addFields(
                    { name: '🎯 총 시도 횟수', value: `${stats.totalAttempts}회`, inline: true },
                    { name: '✅ 성공 횟수', value: `${stats.successCount}회`, inline: true },
                    { name: '💥 파괴 횟수', value: `${stats.destroyCount}회`, inline: true },
                    { name: '📈 성공률', value: `${successRate}%`, inline: true },
                    { name: '💀 파괴율', value: `${destroyRate}%`, inline: true },
                    { name: '⭐ 최고 강화', value: `+${stats.maxEnhanceLevel}성`, inline: true },
                    { name: '💰 총 사용 골드', value: `${stats.totalCost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: false }
                );
            
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        // 🏪 아이템 경매장 명령어
        else if (commandName === '경매장') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 레벨 제한 (레벨 10 이상)
            if (user.level < 10) {
                await interaction.reply({ 
                    content: `경매장은 **레벨 10 이상**부터 이용할 수 있습니다! (현재 레벨: ${user.level})`, 
                    flags: 64 
                });
                return;
            }
            
            // 현재 활성 경매 수 계산
            const activeListings = Array.from(AUCTION_HOUSE.listings.values())
                .filter(listing => listing.status === 'active' && Date.now() < listing.endTime);
            
            // 현재 시장 이벤트 정보
            let eventText = '';
            if (currentMarketEvent) {
                const remainingHours = Math.ceil((currentMarketEvent.startTime + currentMarketEvent.duration - Date.now()) / (60 * 60 * 1000));
                eventText = `\n\n🌟 **시장 이벤트**: ${currentMarketEvent.name} (${remainingHours}시간 남음)`;
            }
            
            const auctionEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('🏪 아이템 경매장')
                .setDescription(`**강화왕 김헌터 경매장**에 오신 것을 환영합니다!\n\n플레이어들 간의 아이템 거래를 통해 시장 경제를 즐겨보세요!${eventText}`)
                .addFields(
                    { name: '📊 시장 현황', value: `활성 경매: ${activeListings.length}개`, inline: true },
                    { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '🎒 인벤토리', value: `${user.inventory.length}/${user.maxInventorySlots}`, inline: true }
                );

            const auctionButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('auction_browse')
                        .setLabel('🔍 경매 둘러보기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('auction_sell')
                        .setLabel('💰 아이템 판매')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('auction_my_listings')
                        .setLabel('📋 내 경매')
                        .setStyle(ButtonStyle.Secondary)
                );

            const auctionButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('auction_market_price')
                        .setLabel('📈 시세 조회')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('auction_hot_items')
                        .setLabel('🔥 인기 아이템')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('auction_trade_history')
                        .setLabel('📊 거래 내역')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ 
                embeds: [auctionEmbed], 
                components: [auctionButtons1, auctionButtons2], 
                flags: 64 
            });
        }
        
        // 🎲 신비한 상자 명령어 (미출시)
        else if (commandName === '신비한상자') {
            await interaction.reply({ 
                content: '🚧 **신비한 상자 시스템**은 아직 준비중입니다!\n\n곧 멋진 기능으로 업데이트 예정이니 조금만 기다려주세요! ✨', 
                flags: 64 
            });
        }
        
        // 🔧 관리자 전용 명령어들
        else if (commandName === '게임데이터초기화') {
            // 관리자 권한 체크
            const ADMIN_IDS = ['302737668842086401']; // 관리자 디스코드 ID 추가
            
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                await interaction.reply({ content: '❌ 관리자만 사용할 수 있는 명령어입니다!', flags: 64 });
                return;
            }
            
            try {
                // 모든 게임 데이터 초기화
                AUCTION_HOUSE.listings.clear();
                AUCTION_HOUSE.priceHistory.clear();
                AUCTION_HOUSE.marketVolume.clear();
                AUCTION_HOUSE.topItems = [];
                AUCTION_HOUSE.events = [];
                
                currentWeather = null;
                dailyFortune = null;
                activeMissions.clear();
                lastMarketUpdate = 0;
                currentMarketEvent = null;
                
                // 파일에도 저장
                saveGameData();
                
                await interaction.reply({ 
                    content: '✅ **게임 데이터가 완전히 초기화되었습니다!**\n\n다음 데이터가 초기화됨:\n• 경매장 데이터\n• 날씨 정보\n• 랜덤 이벤트\n• 시장 이벤트', 
                    flags: 64 
                });
                
                console.log(`게임 데이터 초기화 실행됨 - 관리자: ${interaction.user.tag}`);
                
            } catch (error) {
                console.error('게임 데이터 초기화 실패:', error);
                await interaction.reply({ content: '❌ 초기화 중 오류가 발생했습니다!', flags: 64 });
            }
        }
        
        // 🔮 에너지 조각 시스템 명령어들
        else if (commandName === '에너지채굴') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 쿨타임 체크
            const now = Date.now();
            if (user.energyFragments.lastMine) {
                const timeSinceLastMine = now - new Date(user.energyFragments.lastMine).getTime();
                const cooldownRemaining = ENERGY_FRAGMENT_SYSTEM.MINE_COOLDOWN - timeSinceLastMine;
                
                if (cooldownRemaining > 0) {
                    const remainingSeconds = Math.ceil(cooldownRemaining / 1000);
                    const minutes = Math.floor(remainingSeconds / 60);
                    const seconds = remainingSeconds % 60;
                    
                    await interaction.reply({ 
                        content: `⏰ 채굴 쿨타임이 **${minutes}분 ${seconds}초** 남았습니다!`, 
                        flags: 64 
                    });
                    return;
                }
            }
            
            // 골드 체크
            if (user.gold < ENERGY_FRAGMENT_SYSTEM.MINE_COST) {
                await interaction.reply({ 
                    content: `💸 골드가 부족합니다! 필요: ${ENERGY_FRAGMENT_SYSTEM.MINE_COST}G, 보유: ${user.gold}G`, 
                    flags: 64 
                });
                return;
            }
            
            // 채굴 실행
            user.gold -= ENERGY_FRAGMENT_SYSTEM.MINE_COST;
            user.energyFragments.lastMine = new Date();
            
            // 조각 획득 (Map 처리)
            const fragments = new Map(user.energyFragments.fragments);
            const currentLevel1 = fragments.get('1') || 0;
            fragments.set('1', currentLevel1 + 1);
            user.energyFragments.fragments = fragments;
            
            // 최고 레벨 업데이트
            if (user.energyFragments.highestLevel === 0) {
                user.energyFragments.highestLevel = 1;
            }
            
            await user.save();
            
            const fragmentInfo = getFragmentInfo(1);
            // 융합 가능한 조각 확인
            const allFragments = new Map(user.energyFragments.fragments);
            let fusibleFragments = [];
            
            for (const [level, count] of allFragments.entries()) {
                if (count >= 2) {
                    const levelNum = parseInt(level);
                    const info = getFragmentInfo(levelNum);
                    fusibleFragments.push(`${info.emoji} ${levelNum}단계 (${count}개)`);
                }
            }
            
            // 현재 최고 레벨 조각 표시
            let highestLevelText = `🔸 Lv.1 (${currentLevel1 + 1}개)`;
            if (allFragments.size > 0) {
                const sortedLevels = Array.from(allFragments.keys())
                    .map(k => parseInt(k))
                    .sort((a, b) => b - a);
                const highest = sortedLevels[0];
                const highestInfo = getFragmentInfo(highest);
                const highestCount = allFragments.get(highest.toString());
                highestLevelText = `${highestInfo.emoji} Lv.${highest} (${highestCount}개)`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('⛏️ 에너지 채굴 성공!')
                .setDescription(`${fragmentInfo.emoji} **${fragmentInfo.name}** 1개를 획득했습니다!`)
                .addFields(
                    { name: '💰 사용 골드', value: `${ENERGY_FRAGMENT_SYSTEM.MINE_COST}G`, inline: true },
                    { name: '💵 남은 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '⏰ 쿨타임', value: '2분', inline: true },
                    { name: '🔄 융합 가능 조각', value: fusibleFragments.length > 0 ? fusibleFragments.join('\n') : '없음', inline: false },
                    { name: '⭐ 최고 보유 조각', value: highestLevelText, inline: false }
                )
                .setFooter({ text: '💡 /조각융합으로 더 높은 단계로 융합하세요!' });
                
            await interaction.reply({ embeds: [embed] });
        }
        
        else if (commandName === '내조각') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const fragments = new Map(user.energyFragments.fragments);
            
            // 보유 조각이 없는 경우
            if (fragments.size === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('💎 에너지 조각 보관함')
                    .setDescription('보유한 에너지 조각이 없습니다!')
                    .setFooter({ text: '💡 /에너지채굴로 조각을 획득하세요!' });
                    
                await interaction.reply({ embeds: [embed], flags: 64 });
                return;
            }
            
            // 조각 정렬 및 표시
            const sortedFragments = Array.from(fragments.entries())
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
            
            let fragmentText = '';
            let totalFragments = 0;
            let totalCombatPower = 0;
            
            for (const [level, count] of sortedFragments) {
                const levelNum = parseInt(level);
                const info = getFragmentInfo(levelNum);
                const combatPower = calculateCombatPowerFromFragment(levelNum) * count;
                totalCombatPower += combatPower;
                totalFragments += count;
                
                fragmentText += `${info.emoji} **${levelNum}단계** - ${info.name}\n`;
                fragmentText += `   보유: ${count}개 | 전투력: ${combatPower.toLocaleString()}\n\n`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('💎 에너지 조각 보관함')
                .setDescription(`**${user.nickname}**님의 에너지 조각 현황`)
                .addFields(
                    { name: '📦 보유 조각', value: fragmentText || '없음', inline: false },
                    { name: '📊 통계', value: `총 조각: ${totalFragments}개\n전투력 합계: ${totalCombatPower.toLocaleString()}\n최고 레벨: ${user.energyFragments.highestLevel}단계`, inline: true },
                    { name: '🔧 융합 정보', value: `오늘 융합: ${user.energyFragments.dailyFusions}/20회\n실패 스택: ${user.energyFragments.failureStack}/10\n연속 성공: ${user.energyFragments.consecutiveSuccess}회`, inline: true }
                )
                .setFooter({ text: '💡 같은 단계 조각 2개를 모아서 /조각융합으로 상위 단계로 업그레이드하세요!' });
                
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (commandName === '조각융합') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 일일 융합 제한 체크
            const today = new Date().toDateString();
            if (user.energyFragments.dailyFusionDate !== today) {
                user.energyFragments.dailyFusions = 0;
                user.energyFragments.dailyFusionDate = today;
            }
            
            // 무제한 융합권 사용 가능 체크
            const hasTicket = user.energyFragments.fusionTickets > 0;
            
            if (!hasTicket && user.energyFragments.dailyFusions >= ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT) {
                await interaction.reply({ 
                    content: `🚫 오늘의 융합 횟수를 모두 사용했습니다! (${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT}/20회)\n💡 내일 다시 시도하거나 융합권을 사용하세요!`, 
                    flags: 64 
                });
                return;
            }
            
            await interaction.deferReply();
            
            const fragments = new Map(user.energyFragments.fragments);
            let fusionResults = [];
            let totalCost = 0;
            let fusionsPerformed = 0;
            
            // 융합 가능한 조각 찾기 (낮은 레벨부터)
            const sortedLevels = Array.from(fragments.keys())
                .map(k => parseInt(k))
                .sort((a, b) => a - b);
            
            for (const level of sortedLevels) {
                while (fragments.get(level.toString()) >= 2) {
                    // 일일 제한 체크
                    if (!hasTicket && user.energyFragments.dailyFusions + fusionsPerformed >= ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT) {
                        break;
                    }
                    
                    const count = fragments.get(level.toString());
                    const cost = calculateFusionCost(level);
                    
                    // 골드 체크
                    if (user.gold < cost) {
                        fusionResults.push({
                            level,
                            result: 'no_gold',
                            cost
                        });
                        break;
                    }
                    
                    // 융합 시도
                    user.gold -= cost;
                    totalCost += cost;
                    fragments.set(level.toString(), count - 2);
                    
                    // 성공 확률 계산
                    let successRate = getSuccessRate(level);
                    
                    // 강화 장비 보너스
                    let enhanceBonus = 0;
                    for (const equipment of Object.values(user.equipment)) {
                        if (equipment && equipment.enhanceLevel >= 20) {
                            if (equipment.enhanceLevel >= 30) enhanceBonus = 15;
                            else if (equipment.enhanceLevel >= 25) enhanceBonus = 10;
                            else enhanceBonus = 5;
                            break;
                        }
                    }
                    successRate += enhanceBonus;
                    
                    // 랭킹 보너스
                    successRate += user.energyFragments.permanentSuccessBonus;
                    successRate += user.energyFragments.weeklyRankingBonus;
                    
                    // 실패 스택 체크
                    const guaranteedSuccess = user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED;
                    
                    const roll = Math.random() * 100;
                    const success = guaranteedSuccess || roll < successRate;
                    
                    if (success) {
                        // 성공
                        const newLevel = level + 1;
                        const currentCount = fragments.get(newLevel.toString()) || 0;
                        fragments.set(newLevel.toString(), currentCount + 1);
                        
                        user.energyFragments.successfulFusions++;
                        user.energyFragments.consecutiveSuccess++;
                        user.energyFragments.failureStack = 0;
                        
                        // 최고 레벨 업데이트
                        if (newLevel > user.energyFragments.highestLevel) {
                            user.energyFragments.highestLevel = newLevel;
                        }
                        
                        // 골드 보상
                        const reward = newLevel * 500;
                        user.gold += reward;
                        
                        fusionResults.push({
                            level,
                            newLevel,
                            result: 'success',
                            cost,
                            reward,
                            guaranteedSuccess
                        });
                        
                        // 100단계 달성!
                        if (newLevel === 100) {
                            // TODO: 100단계 특별 처리
                        }
                    } else {
                        // 실패
                        const criticalFail = Math.random() * 100 < ENERGY_FRAGMENT_SYSTEM.CRITICAL_FAIL_CHANCE;
                        
                        if (criticalFail) {
                            // 대실패 - 1단계로
                            const currentLevel1 = fragments.get('1') || 0;
                            fragments.set('1', currentLevel1 + 1);
                            fusionResults.push({
                                level,
                                result: 'critical_fail',
                                cost
                            });
                        } else {
                            // 일반 실패
                            const dropAmount = Math.floor(Math.random() * 
                                (ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.max - ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.min + 1)) + 
                                ENERGY_FRAGMENT_SYSTEM.FAIL_DROP.min;
                            const newLevel = Math.max(1, level - dropAmount);
                            const currentCount = fragments.get(newLevel.toString()) || 0;
                            fragments.set(newLevel.toString(), currentCount + 1);
                            
                            fusionResults.push({
                                level,
                                newLevel,
                                result: 'fail',
                                cost,
                                dropAmount
                            });
                        }
                        
                        // 실패 스택
                        if (Math.random() * 100 < ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_CHANCE) {
                            user.energyFragments.failureStack++;
                        }
                        
                        user.energyFragments.consecutiveSuccess = 0;
                    }
                    
                    user.energyFragments.totalFusions++;
                    fusionsPerformed++;
                    
                    if (!hasTicket) {
                        user.energyFragments.dailyFusions++;
                    }
                }
            }
            
            // 빈 조각 제거
            for (const [key, value] of fragments.entries()) {
                if (value === 0) {
                    fragments.delete(key);
                }
            }
            
            user.energyFragments.fragments = fragments;
            user.energyFragments.totalInvested += totalCost;
            
            // 융합권 사용
            if (hasTicket && fusionsPerformed > 0) {
                user.energyFragments.fusionTickets--;
            }
            
            await user.save();
            
            // 결과 표시
            if (fusionResults.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('🔄 융합 불가')
                    .setDescription('융합 가능한 조각이 없습니다!\n같은 단계 조각을 2개 이상 모아주세요.')
                    .setFooter({ text: '💡 /에너지채굴로 더 많은 조각을 획득하세요!' });
                    
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            
            // 결과 임베드 생성
            let resultText = '';
            let totalReward = 0;
            let successCount = 0;
            
            for (const result of fusionResults) {
                const info = getFragmentInfo(result.level);
                
                if (result.result === 'success') {
                    const newInfo = getFragmentInfo(result.newLevel);
                    resultText += `✅ ${info.emoji} ${result.level}단계 → ${newInfo.emoji} **${result.newLevel}단계** 성공!\n`;
                    resultText += `   💰 비용: ${result.cost}G | 보상: ${result.reward}G\n`;
                    if (result.guaranteedSuccess) {
                        resultText += `   🎯 실패 스택 10개로 성공 확정!\n`;
                    }
                    totalReward += result.reward;
                    successCount++;
                } else if (result.result === 'fail') {
                    const newInfo = getFragmentInfo(result.newLevel);
                    resultText += `❌ ${info.emoji} ${result.level}단계 → ${newInfo.emoji} ${result.newLevel}단계 실패 (-${result.dropAmount})\n`;
                    resultText += `   💸 비용: ${result.cost}G\n`;
                } else if (result.result === 'critical_fail') {
                    resultText += `💥 ${info.emoji} ${result.level}단계 → 🔸 1단계 대실패!\n`;
                    resultText += `   💸 비용: ${result.cost}G\n`;
                } else if (result.result === 'no_gold') {
                    resultText += `💸 ${info.emoji} ${result.level}단계 융합 불가 - 골드 부족 (필요: ${result.cost}G)\n`;
                }
                resultText += '\n';
            }
            
            const embed = new EmbedBuilder()
                .setColor(successCount > 0 ? '#00ff00' : '#ff6b6b')
                .setTitle('🔄 자동 융합 결과')
                .setDescription(`**${fusionResults.length}회** 융합 시도`)
                .addFields(
                    { name: '📊 융합 내역', value: resultText || '없음', inline: false },
                    { name: '💰 비용/수익', value: `사용: ${totalCost.toLocaleString()}G\n획득: ${totalReward.toLocaleString()}G\n순익: ${(totalReward - totalCost).toLocaleString()}G`, inline: true },
                    { name: '📈 통계', value: `성공: ${successCount}/${fusionResults.length}회\n실패 스택: ${user.energyFragments.failureStack}/10\n남은 융합: ${hasTicket ? '무제한' : `${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT - user.energyFragments.dailyFusions}/20회`}`, inline: true }
                )
                .setFooter({ text: '💡 실패 스택 10개 모으면 다음 융합이 성공 확정!' });
                
            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === '결투') {
            await interaction.deferReply({ flags: 64 });
            
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                return;
            }

            const result = await pvpSystem.joinQueue(interaction.user.id, user, interaction.channel);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('⚔️ PVP 매치메이킹')
                    .setDescription(result.message)
                    .addFields(
                        { name: '💳 보유 결투권', value: `${result.tickets || user.pvp.duelTickets}/20`, inline: true },
                        { name: '🏆 현재 레이팅', value: `${user.pvp.rating} (${user.pvp.tier})`, inline: true }
                    )
                    .setFooter({ text: '매치가 성사되면 자동으로 전투가 시작됩니다!' });

                const cancelButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('cancel_pvp_queue')
                            .setLabel('❌ 매치메이킹 취소')
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.editReply({ 
                    embeds: [embed], 
                    components: [cancelButton]
                });
            } else {
                await interaction.editReply({ content: `❌ ${result.message}` });
            }
        }
        
        else if (commandName === '결투정보') {
            await interaction.deferReply({ flags: 64 });
            
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                return;
            }

            const pvpInfo = await pvpSystem.getPVPInfo(user);
            
            let matchHistoryText = '';
            if (pvpInfo.matchHistory.length > 0) {
                pvpInfo.matchHistory.slice(0, 5).forEach((match, index) => {
                    const resultEmoji = match.result === 'win' ? '🏆' : '💔';
                    const ratingText = match.ratingChange > 0 ? `+${match.ratingChange}` : `${match.ratingChange}`;
                    matchHistoryText += `${resultEmoji} vs ${match.opponent} (${ratingText})\n`;
                });
            } else {
                matchHistoryText = '아직 결투 기록이 없습니다.';
            }

            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`⚔️ ${user.nickname}님의 PVP 정보`)
                .addFields(
                    { name: `${pvpInfo.tierEmoji} 티어`, value: `${pvpInfo.tier}`, inline: true },
                    { name: '🏆 레이팅', value: `${pvpInfo.rating}`, inline: true },
                    { name: '💳 결투권', value: `${pvpInfo.duelTickets}/20`, inline: true },
                    { name: '📊 전적', value: `${pvpInfo.wins}승 ${pvpInfo.losses}패 (${pvpInfo.winRate}%)`, inline: true },
                    { name: '🔥 연승', value: `${pvpInfo.winStreak}연승 (최고: ${pvpInfo.maxWinStreak})`, inline: true },
                    { name: '🌟 최고 레이팅', value: `${pvpInfo.highestRating}`, inline: true },
                    { name: '📜 최근 경기', value: matchHistoryText, inline: false }
                )
                .setFooter({ text: '결투권은 1시간마다 1장씩 재생성됩니다!' });

            await interaction.editReply({ embeds: [embed] });
        }
        
        else if (commandName === '랭킹') {
            try {
                await interaction.deferReply({ flags: 64 });
                
                const topUsers = await User.find({ registered: true })
                    .sort({ 'pvp.rating': -1 })
                    .limit(10);

                const tierEmoji = {
                    'Bronze': '🥉',
                    'Silver': '🥈', 
                    'Gold': '🥇',
                    'Platinum': '💎',
                    'Master': '🌟',
                    'Grandmaster': '👑',
                    'Challenger': '🏆'
                };

                let rankingText = '';
                topUsers.forEach((user, index) => {
                    const tier = pvpSystem.getTierByRating(user.pvp.rating);
                    const emoji = tierEmoji[tier] || '🥉';
                    const winRate = user.pvp.totalDuels > 0 ? 
                        ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : 0;
                    
                    rankingText += `**${index + 1}.** ${emoji} ${user.nickname}\n`;
                    rankingText += `　　레이팅: ${user.pvp.rating} | 승률: ${winRate}% (${user.pvp.wins}승 ${user.pvp.losses}패)\n\n`;
                });

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 PVP 랭킹')
                    .setDescription(rankingText || '아직 PVP 기록이 없습니다.')
                    .setFooter({ text: '레이팅은 ELO 시스템을 기반으로 계산됩니다!' });

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error('랭킹 조회 오류:', error);
                if (interaction.deferred) {
                    await interaction.editReply({ content: '랭킹 조회 중 오류가 발생했습니다!' });
                } else {
                    await interaction.reply({ content: '랭킹 조회 중 오류가 발생했습니다!', flags: 64 });
                }
            }
        }
        
        else if (commandName === '내전투력') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 기본 전투력 계산
            const baseCombatPower = calculateCombatPower(user);
            
            // 에너지 조각 전투력
            const fragments = new Map(user.energyFragments.fragments);
            let fragmentCombatPower = 0;
            let highestFragment = 0;
            
            for (const [level, count] of fragments.entries()) {
                const levelNum = parseInt(level);
                fragmentCombatPower += calculateCombatPowerFromFragment(levelNum) * count;
                if (levelNum > highestFragment) {
                    highestFragment = levelNum;
                }
            }
            
            const totalCombatPower = baseCombatPower + fragmentCombatPower;
            
            // 모험가 등급 결정
            let adventurerRank = '견습 모험가';
            let rankEmoji = '🔸';
            
            if (highestFragment >= 76) {
                adventurerRank = '그랜드마스터';
                rankEmoji = '🌌';
            } else if (highestFragment >= 51) {
                adventurerRank = '마스터 모험가';
                rankEmoji = '⭐';
            } else if (highestFragment >= 26) {
                adventurerRank = '엘리트 모험가';
                rankEmoji = '💎';
            } else if (highestFragment >= 11) {
                adventurerRank = '숙련 모험가';
                rankEmoji = '💠';
            }
            
            if (highestFragment === 100) {
                adventurerRank = '🔥 강화의 신 🔥';
                rankEmoji = '✨';
            }
            
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('⚔️ 전투력 정보')
                .setDescription(`**${user.nickname}**님의 전투력 상세 정보`)
                .addFields(
                    { name: '📊 기본 전투력', value: `${baseCombatPower.toLocaleString()}`, inline: true },
                    { name: '💎 조각 전투력', value: `${fragmentCombatPower.toLocaleString()}`, inline: true },
                    { name: '⚔️ 총 전투력', value: `**${totalCombatPower.toLocaleString()}**`, inline: true },
                    { name: `${rankEmoji} 모험가 등급`, value: adventurerRank, inline: true },
                    { name: '🏆 최고 조각', value: `${highestFragment}단계`, inline: true },
                    { name: '📈 성공률 보너스', value: `+${user.energyFragments.permanentSuccessBonus + user.energyFragments.weeklyRankingBonus}%`, inline: true }
                );
                
            // 칭호 정보
            if (highestFragment === 10) embed.addFields({ name: '🎭 획득 칭호', value: '에너지 수집가', inline: false });
            else if (highestFragment === 25) embed.addFields({ name: '🎭 획득 칭호', value: '마법 융합사', inline: false });
            else if (highestFragment === 50) embed.addFields({ name: '🎭 획득 칭호', value: '크리스탈 마스터', inline: false });
            else if (highestFragment === 75) embed.addFields({ name: '🎭 획득 칭호', value: '별빛의 현자', inline: false });
            else if (highestFragment === 99) embed.addFields({ name: '🎭 획득 칭호', value: '창조의 사도', inline: false });
            else if (highestFragment === 100) embed.addFields({ name: '🎭 획득 칭호', value: '✨ 궁극의 강화왕 ✨', inline: false });
            
            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (commandName === '융합랭킹') {
            await interaction.deferReply();
            
            try {
                const users = await User.find({ 
                    registered: true,
                    'energyFragments.highestLevel': { $gt: 0 }
                }).sort({ 'energyFragments.highestLevel': -1, 'energyFragments.totalFusions': -1 }).limit(50);
                
                if (users.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('🏆 융합 랭킹')
                        .setDescription('아직 에너지 조각을 보유한 사용자가 없습니다!');
                        
                    await interaction.editReply({ embeds: [embed] });
                    return;
                }
                
                // 랭킹 데이터 생성
                let rankingText = '';
                let userRank = null;
                
                for (let i = 0; i < Math.min(10, users.length); i++) {
                    const rankedUser = users[i];
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}위`;
                    const fragmentInfo = getFragmentInfo(rankedUser.energyFragments.highestLevel);
                    
                    rankingText += `${medal} **${rankedUser.nickname}**\n`;
                    rankingText += `   ${fragmentInfo.emoji} ${rankedUser.energyFragments.highestLevel}단계 | 융합 ${rankedUser.energyFragments.totalFusions}회\n\n`;
                    
                    if (rankedUser.discordId === interaction.user.id) {
                        userRank = i + 1;
                    }
                }
                
                // 내 순위 찾기
                if (!userRank) {
                    const myIndex = users.findIndex(u => u.discordId === interaction.user.id);
                    if (myIndex !== -1) {
                        userRank = myIndex + 1;
                    }
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 이번 주 융합 랭킹')
                    .setDescription('최고 단계 기준 TOP 10')
                    .addFields(
                        { name: '📊 순위', value: rankingText || '데이터 없음', inline: false }
                    );
                    
                if (userRank) {
                    embed.addFields({ name: '🎯 내 순위', value: `${userRank}위`, inline: true });
                }
                
                embed.setFooter({ text: '🎁 매주 일요일 자정에 랭킹 보상이 지급됩니다!' });
                
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('융합랭킹 조회 오류:', error);
                await interaction.editReply({ content: '랭킹 조회 중 오류가 발생했습니다!' });
            }
        }
        
        else if (commandName === '융합수동') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 일일 융합 제한 체크
            const today = new Date().toDateString();
            if (user.energyFragments.dailyFusionDate !== today) {
                user.energyFragments.dailyFusions = 0;
                user.energyFragments.dailyFusionDate = today;
            }
            
            // 무제한 융합권 사용 가능 체크
            const hasTicket = user.energyFragments.fusionTickets > 0;
            
            if (!hasTicket && user.energyFragments.dailyFusions >= ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT) {
                await interaction.reply({ 
                    content: `🚫 오늘의 융합 횟수를 모두 사용했습니다! (${ENERGY_FRAGMENT_SYSTEM.DAILY_FUSION_LIMIT}/20회)\n💡 내일 다시 시도하거나 융합권을 사용하세요!`, 
                    flags: 64 
                });
                return;
            }
            
            const fragments = new Map(user.energyFragments.fragments);
            
            // 융합 가능한 조각 찾기
            const fusibleFragments = [];
            for (const [level, count] of fragments.entries()) {
                if (count >= 2) {
                    const levelNum = parseInt(level);
                    const info = getFragmentInfo(levelNum);
                    const cost = calculateFusionCost(levelNum);
                    const successRate = getSuccessRate(levelNum);
                    
                    // 강화 보너스 계산
                    let enhanceBonus = 0;
                    for (const equipment of Object.values(user.equipment)) {
                        if (equipment && equipment.enhanceLevel >= 20) {
                            if (equipment.enhanceLevel >= 30) enhanceBonus = 15;
                            else if (equipment.enhanceLevel >= 25) enhanceBonus = 10;
                            else enhanceBonus = 5;
                            break;
                        }
                    }
                    
                    const finalSuccessRate = Math.min(100, successRate + enhanceBonus + user.energyFragments.permanentSuccessBonus + user.energyFragments.weeklyRankingBonus);
                    
                    fusibleFragments.push({
                        level: levelNum,
                        count,
                        info,
                        cost,
                        successRate: finalSuccessRate
                    });
                }
            }
            
            if (fusibleFragments.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('🎯 수동 융합')
                    .setDescription('융합 가능한 조각이 없습니다!\n같은 단계 조각을 2개 이상 모아주세요.')
                    .setFooter({ text: '💡 /에너지채굴로 더 많은 조각을 획득하세요!' });
                    
                await interaction.reply({ embeds: [embed], flags: 64 });
                return;
            }
            
            // 선택 메뉴 생성 (최대 25개)
            const selectOptions = fusibleFragments.slice(0, 25).map(frag => ({
                label: `${frag.info.name} (Lv.${frag.level})`,
                description: `보유: ${frag.count}개 | 비용: ${frag.cost.toLocaleString()}G | 성공률: ${frag.successRate}%`,
                value: `manual_fusion_${frag.level}`,
                emoji: frag.info.emoji
            }));
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('manual_fusion_select')
                .setPlaceholder('융합할 조각을 선택하세요')
                .addOptions(selectOptions);
            
            const row = new ActionRowBuilder().addComponents(selectMenu);
            
            // 실패 스택 정보
            const stackInfo = user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED ? 
                '🎯 **다음 융합 성공 확정!**' : 
                `실패 스택: ${user.energyFragments.failureStack}/10`;
            
            const embed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('🎯 수동 융합')
                .setDescription(`**${user.nickname}**님, 융합할 조각을 선택하세요!`)
                .addFields(
                    { name: '📊 융합 상태', value: `오늘 융합: ${user.energyFragments.dailyFusions}/20회\n${stackInfo}\n연속 성공: ${user.energyFragments.consecutiveSuccess}회`, inline: true },
                    { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                    { name: '🎫 융합권', value: `${user.energyFragments.fusionTickets}개`, inline: true }
                )
                .setFooter({ text: '💡 높은 단계일수록 성공률이 낮아집니다!' });
                
            await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
        }
        
    } catch (error) {
        console.error('명령어 처리 오류:', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '오류가 발생했습니다!', flags: 64 });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '오류가 발생했습니다!' });
            }
        } catch (replyError) {
            console.error('오류 응답 실패:', replyError);
        }
    }
});

// 버튼 클릭 및 선택 메뉴 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // 개발 모드에서 채널 제한
    if (DEV_MODE && DEV_CHANNEL_IDS.length > 0 && !DEV_CHANNEL_IDS.includes(interaction.channelId)) {
        console.log(`채널 불일치 - 현재: ${interaction.channelId}, 허용된 개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        await interaction.reply({ content: '개발 모드에서는 지정된 채널에서만 사용 가능합니다!', flags: 64 });
        return;
    }

    const user = await getUser(interaction.user.id);
    if (!user) {
        await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', flags: 64 });
        return;
    }
    const now = Date.now();

    try {
        // 메인화면의 게임하기 버튼 처리
        if (interaction.customId === 'game_start') {
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.reply({ content: '유저 데이터를 불러올 수 없습니다!', flags: 64 });
                return;
            }
            
            // 게임 채널 안내 메시지
            const gameGuideEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('게임 시작!')
                .setDescription(`**${user.nickname || interaction.user.username}**님, 게임을 시작합니다!\n\n게임 채널에서 \`/게임\` 명령어를 사용하여 게임을 플레이하세요.\n\n**게임 채널로 이동하여 본격적인 모험을 시작해보세요!**`)
                .addFields(
                    { name: '명령어 안내', value: '`/게임` - 게임 메뉴 열기', inline: true },
                    { name: '현재 상태', value: `골드: ${user.gold.toLocaleString()}${goldEmoji}\n레벨: Lv.${user.level}`, inline: true }
                )
                .setFooter({ text: '게임 채널에서 더 많은 기능을 이용할 수 있습니다!' });

            await interaction.reply({ embeds: [gameGuideEmbed], flags: 64 });
        }
        
        else if (interaction.customId === 'support_info') {
            // 후원 안내 (추후 구현)
            const supportEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('후원 안내')
                .setDescription('후원 기능은 준비 중입니다.\n\n개발자를 응원해주시는 마음에 감사드립니다!')
                .setFooter({ text: '곧 후원 시스템이 추가될 예정입니다.' });
                
            await interaction.reply({ embeds: [supportEmbed], flags: 64 });
        }
        
        else if (interaction.customId === 'hunting') {
            // 개발자는 모든 사냥터 접근 가능, 일반 유저는 언락된 사냥터만
            const availableAreas = isDeveloper(interaction.user.id) ? 
                huntingAreas : 
                huntingAreas.filter(area => user.unlockedAreas.includes(area.id));

            if (availableAreas.length === 0) {
                await interaction.reply({ content: '사용 가능한 사냥터가 없습니다!', flags: 64 });
                return;
            }

            // 사냥터 페이지네이션 (한 페이지에 3개씩)
            const areasPerPage = 3;
            const totalPages = Math.ceil(availableAreas.length / areasPerPage);
            const currentPage = 0; // 첫 페이지부터 시작

            const startIndex = currentPage * areasPerPage;
            const endIndex = startIndex + areasPerPage;
            const currentAreas = availableAreas.slice(startIndex, endIndex);

            // 사냥터 선택 임베드
            const huntingEmbed = new EmbedBuilder()
                .setColor('#8b0000')
                .setTitle('⚔️ 사냥터 선택')
                .setDescription(`**${user.nickname}**님의 사냥터 목록\n\n현재 레벨: **Lv.${user.level}**`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 사냥터를 선택하세요!` });

            // 사냥터별 필드 추가
            currentAreas.forEach(area => {
                const monsterNames = area.monsters.map(m => m.name).join(', ');
                huntingEmbed.addFields({
                    name: `${area.name} ${area.levelRange}`,
                    value: `출현몬스터: ${monsterNames}`,
                    inline: true
                });
            });

            // 사냥터 버튼들
            const huntingButtons = new ActionRowBuilder();
            currentAreas.forEach(area => {
                huntingButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${area.id}`)
                        .setLabel(area.name)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            // 네비게이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('hunt_prev_page')
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('hunt_page_info')
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('hunt_next_page')
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            const components = [huntingButtons];
            if (totalPages > 1) components.push(navButtons);
            else {
                // 페이지가 1개면 게임 메뉴 버튼만 추가
                const backOnly = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('back_to_game_menu')
                            .setLabel('🎮 게임 메뉴로 돌아가기')
                            .setStyle(ButtonStyle.Success)
                    );
                components.push(backOnly);
            }

            await interaction.reply({ embeds: [huntingEmbed], components, flags: 64 });
        }
        
        else if (interaction.customId === 'ranking') {
            try {
                // 각 랭킹별 데이터 가져오기
                const [levelRanking, goldRanking, popularityRanking] = await Promise.all([
                    User.find({ registered: true }).sort({ level: -1, exp: -1 }).limit(5),
                    User.find({ registered: true }).sort({ gold: -1 }).limit(5),
                    User.find({ registered: true, popularity: { $gt: 0 } }).sort({ popularity: -1 }).limit(5)
                ]);
                
                // 레벨 랭킹 포맷
                let levelText = '';
                levelRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    levelText += `${medal} **${user.nickname}** - Lv.${user.level} (${user.exp}/${user.level * 100})\n`;
                });
                
                // 골드 랭킹 포맷
                let goldText = '';
                goldRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    goldText += `${medal} **${user.nickname}** - ${user.gold.toLocaleString()}${goldEmoji}\n`;
                });
                
                // 인기도 랭킹 포맷
                let popularityText = '';
                if (popularityRanking.length === 0) {
                    popularityText = '아직 인기도를 가진 사용자가 없습니다.';
                } else {
                    popularityRanking.forEach((user, index) => {
                        const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                        const crown = index === 0 ? ' (인기왕)' : '';
                        popularityText += `${medal} **${user.nickname}** - 인기도 ${user.popularity}${crown}\n`;
                    });
                }
                
                const rankingEmbed = new EmbedBuilder()
                    .setColor('#daa520')
                    .setTitle('🏆 전체 랭킹')
                    .setDescription('각 분야의 최강자들을 확인해보세요!')
                    .addFields(
                        { name: '⭐ 레벨 랭킹 TOP 5', value: levelText || '등록된 사용자가 없습니다.', inline: false },
                        { name: '💰 골드 랭킹 TOP 5', value: goldText || '등록된 사용자가 없습니다.', inline: false },
                        { name: '❤️ 인기도 랭킹 TOP 5', value: popularityText, inline: false }
                    )
                    .setFooter({ text: '랭킹은 실시간으로 업데이트됩니다!' })
                    .setTimestamp();
                    
                await interaction.reply({ embeds: [rankingEmbed], flags: 64 });
            } catch (error) {
                console.error('랭킹 조회 오류:', error);
                await interaction.reply({ content: '랭킹을 불러오는 중 오류가 발생했습니다.', flags: 64 });
            }
        }
        
        else if (interaction.customId === 'racing') {
            // 레이싱 메뉴 표시
            const raceStatus = raceSystem.getRaceStatus();
            
            let statusText = `**🏁 완전 운빨 레이싱! 🎲**\n\n`;
            statusText += `💰 **현재 상금풀**: ${raceStatus.totalPot.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
            statusText += `👥 **참가자**: ${raceStatus.playerCount}/${raceSystem.maxPlayers}명\n\n`;
            
            if (raceStatus.isRacing) {
                statusText += `🏃‍♂️ **레이스 진행 중입니다!**\n잠시 후 다시 시도해주세요.`;
            } else if (raceStatus.playerCount === 0) {
                statusText += `🎯 **대기 중인 참가자가 없습니다.**\n첫 번째 참가자가 되어보세요!`;
            } else {
                statusText += `⏰ **${raceStatus.playerCount >= raceSystem.minPlayers ? '곧 시작됩니다!' : `최소 ${raceSystem.minPlayers}명 필요`}**\n`;
                
                // 현재 참가자 목록
                if (raceStatus.players.length > 0) {
                    const realPlayers = raceStatus.players.filter(p => !p.isBot);
                    const botPlayers = raceStatus.players.filter(p => p.isBot);
                    
                    statusText += `\n**현재 참가자 (${realPlayers.length}명):**\n`;
                    realPlayers.forEach((p, i) => {
                        statusText += `${i + 1}. ${p.nickname} - ${p.betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                    });
                    
                    if (botPlayers.length > 0) {
                        statusText += `\n**🤖 봇 참가자 (${botPlayers.length}명):**\n`;
                        botPlayers.forEach((p, i) => {
                            statusText += `${i + 1}. ${p.nickname} - ${p.betAmount.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                        });
                    }
                }
            }
            
            const racingEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏁 김헌터 레이싱 센터')
                .setDescription(statusText)
                .addFields(
                    { name: '💡 규칙', value: '• 베팅금으로 참가\n• 우승자가 전체 상금 독식\n• 완전 랜덤! 스탯/레벨 무관!\n• 🤖 봇 우승시 실제 플레이어가 상금 획득', inline: true },
                    { name: '💰 베팅 범위', value: `${raceSystem.minBet.toLocaleString()}~${raceSystem.maxBet.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '⏰ 매칭 시스템', value: `• 최소 ${raceSystem.minPlayers}명 시 1분 후 시작\n• 1분간 참가자 부족시 봇 자동 추가`, inline: true }
                )
                .setFooter({ text: '🎲 완전 운빨! 누구나 우승 가능!' });
            
            // 참가 여부 확인
            const isParticipating = raceStatus.players.some(p => p.userId === interaction.user.id);
            
            const racingButtons = new ActionRowBuilder();
            
            if (!raceStatus.isRacing) {
                if (!isParticipating && !raceStatus.isFull) {
                    // 참가 버튼들
                    racingButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('join_race_1000')
                            .setLabel('🎯 1,000골드')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.gold < 1000),
                        new ButtonBuilder()
                            .setCustomId('join_race_5000')
                            .setLabel('💎 5,000골드')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(user.gold < 5000),
                        new ButtonBuilder()
                            .setCustomId('join_race_custom')
                            .setLabel('💰 직접 입력')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(user.gold < raceSystem.minBet)
                    );
                } else if (isParticipating) {
                    // 나가기 버튼
                    racingButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId('leave_race')
                            .setLabel('❌ 레이스 나가기')
                            .setStyle(ButtonStyle.Danger)
                    );
                }
            }
            
            // 통계 버튼은 항상 표시
            const statsButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('racing_stats')
                        .setLabel('📊 내 레이싱 통계')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('racing_ranking')
                        .setLabel('🏆 레이싱 랭킹')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const components = [];
            if (racingButtons.components.length > 0) components.push(racingButtons);
            components.push(statsButton);
            
            await interaction.reply({ 
                embeds: [racingEmbed], 
                components,
                flags: 64 
            });
        }
        
        else if (interaction.customId === 'daily') {
            const today = new Date().toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            // 테스트용: 쿨타임 제거
            // if (user.lastDaily === today) {
            //     await interaction.reply({ content: '오늘은 이미 출석체크를 했습니다!', flags: 64 });
            //     return;
            // }

            // 연속 출석 체크
            if (user.lastDaily === yesterday) {
                user.attendanceStreak += 1;
            } else {
                user.attendanceStreak = 1;
            }

            // 주간 출석 체크 (주 시작 체크)
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay()); // 일요일 시작
            weekStart.setHours(0, 0, 0, 0);
            
            if (!user.weekStart || user.weekStart < weekStart) {
                user.weeklyAttendance = [false, false, false, false, false, false, false];
                user.weekStart = weekStart;
            }
            
            user.weeklyAttendance[now.getDay()] = true;

            // 이미지 첨부
            const dailyAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_daily.gif'), { name: 'kim_daily.gif' });

            // 보상 옵션들
            const rewards = [
                { name: '💰 500G', gold: 500, exp: 0, item: null },
                { name: '💰 1000G', gold: 1000, exp: 0, item: null },
                { name: '💰 2000G', gold: 2000, exp: 0, item: null },
                { name: '✨ 경험치 부스터', gold: 0, exp: 500, item: null },
                { name: '🎁 미스터리 박스', gold: 1500, exp: 100, item: 'mystery_box' }
            ];

            // 초기 룰렛 표시
            const rouletteEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 출석 체크 보상 돌려돌려 돌림판!')
                .setDescription(`**${user.nickname || interaction.user.username}**님의 출석 체크!\\n\\n연속 출석: **${user.attendanceStreak}일** 🔥`)
                .addFields(
                    { name: '주간 출석 현황', value: `${user.weeklyAttendance.map((attended, i) => {
                        const days = ['일', '월', '화', '수', '목', '금', '토'];
                        return attended ? `${days[i]}✅` : `${days[i]}❌`;
                    }).join(' ')} (${user.weeklyAttendance.filter(x => x).length}/7)`, inline: false },
                )
                .setImage('attachment://kim_daily.gif')
                .setFooter({ text: '아래 버튼을 눌러 돌림판을 돌리세요!' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('spin_roulette')
                        .setLabel('🎡 돌림판 돌리기!')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [rouletteEmbed], components: [row], files: [dailyAttachment], flags: 64 });
        }
        
        else if (interaction.customId === 'spin_roulette') {
            // 먼저 응답 지연 처리
            await interaction.deferUpdate();
            
            // 돌림판 애니메이션
            const rewards = [
                { name: '💰 500G + ✨ 100EXP', gold: 500, exp: 100 },
                { name: '💰 1000G + ✨ 200EXP', gold: 1000, exp: 200 },
                { name: '💰 1500G + ✨ 300EXP', gold: 1500, exp: 300 },
                { name: '💰 2000G + ✨ 400EXP', gold: 2000, exp: 400 },
                { name: '💰 2500G + ✨ 500EXP', gold: 2500, exp: 500 }
            ];

            const selectedReward = rewards[Math.floor(Math.random() * rewards.length)];
            const rewardIndex = rewards.indexOf(selectedReward);

            // 애니메이션 프레임들
            const frames = [
                '❓ 🎁 ❓ ❓ ❓',
                '❓ ❓ 🎁 ❓ ❓',
                '❓ ❓ ❓ 🎁 ❓',
                '❓ ❓ ❓ ❓ 🎁',
                '🎁 ❓ ❓ ❓ ❓'
            ];

            // 최종 결과 프레임
            const finalFrame = rewards.map((r, i) => i === rewardIndex ? '🎉' : '❌').join(' ');

            // 1단계: 돌리는 중 GIF
            const turntableAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable.gif'), { name: 'kim_turntable.gif' });

            // GIF와 함께 돌림판 시작 표시
            const gifEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎡 돌림판 돌리는 중...')
                .setDescription(`연속 출석: **${user.attendanceStreak}일** 🔥`)
                .setImage('attachment://kim_turntable.gif');

            await interaction.editReply({ embeds: [gifEmbed], components: [], files: [turntableAttachment] });
            
            // GIF 재생 시간 (4초)
            await new Promise(resolve => setTimeout(resolve, 4000));

            // 최종 결과 표시
            user.gold += selectedReward.gold;
            user.exp += selectedReward.exp;
            user.lastDaily = new Date().toDateString();
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            // 연속 출석 보너스
            let streakBonus = '';
            if (user.attendanceStreak >= 7) {
                const bonusGold = 1000;
                user.gold += bonusGold;
                streakBonus = `\\n🔥 **7일 연속 출석 보너스**: +${bonusGold}G`;
            }
            
            // 주간 미션 완료 체크
            let weeklyBonus = '';
            if (user.weeklyAttendance.filter(x => x).length === 7) {
                const weeklyGold = 5000;
                user.gold += weeklyGold;
                weeklyBonus = `\\n🏆 **주간 미션 완료**: +${weeklyGold}G`;
            }
            
            await user.save();

            // 3단계: 보상 강도에 따른 감정 멘트와 결과 표시
            const resultAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_turntable2.gif'), { name: 'kim_turntable2.gif' });
            
            // 보상 강도별 감정 멘트 설정
            let emotionTitle = '';
            let emotionDescription = '';
            let embedColor = '';
            
            // 레벨업 메시지 추가
            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';
            
            if (selectedReward.gold >= 2000) {
                // 최고 보상
                emotionTitle = '🚀 대박!! 최고의 운이군요!';
                emotionDescription = `와! **${selectedReward.name}**을 당첨시키다니! 정말 대단해요! 오늘은 분명 좋은 일이 가득할 거예요! ✨${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ffd700'; // 금색
            } else if (selectedReward.gold >= 1500) {
                // 높은 보상
                emotionTitle = '🎉 훌륭해요! 좋은 보상이네요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 오늘 운이 좋으시네요! 계속 이런 행운이 이어지길 바라요! 😊${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#ff6b6b'; // 빨간색
            } else if (selectedReward.gold >= 1000) {
                // 중간 보상
                emotionTitle = '⭐ 좋은 결과예요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준한 성장과 골드 획득이네요! 💪${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#9b59b6'; // 보라색
            } else {
                // 일반 보상
                emotionTitle = '😊 좋은 시작이에요!';
                emotionDescription = `**${selectedReward.name}** 당첨! 꾸준히 모으면 큰 힘이 될 거예요! 매일매일 출석해서 더 큰 보상을 노려봐요! 🎯${levelUpMessage}${streakBonus}${weeklyBonus}`;
                embedColor = '#3498db'; // 파란색
            }
            
            const resultEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(emotionTitle)
                .setDescription(emotionDescription)
                .addFields(
                    { name: '💰 획득 내역', value: `골드: +${selectedReward.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\n경험치: +${selectedReward.exp} EXP`, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '🔥 연속 출석', value: `${user.attendanceStreak}일`, inline: true }
                )
                .setImage('attachment://kim_turntable2.gif')
                .setFooter({ text: '내일도 잊지 말고 출석체크 해주세요!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({ embeds: [resultEmbed], components: [backButton], files: [resultAttachment] });
        }
        
        // 사냥터 선택 처리
        else if (interaction.customId.startsWith('hunt_area_')) {
            const areaId = parseInt(interaction.customId.split('_')[2]);
            const selectedArea = huntingAreas.find(area => area.id === areaId);
            
            if (!selectedArea) {
                await interaction.reply({ content: '존재하지 않는 사냥터입니다!', flags: 64 });
                return;
            }
            
            // 사냥 시작 - 3단계 프로세스
            // 사냥터별 GIF 설정
            const huntingGifName = selectedArea.huntingGif || 'kim_hunting.gif'; // 기본값 설정
            const huntGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', huntingGifName), { name: huntingGifName });

            // 1단계: 사냥중 GIF (2초)
            const huntingMessages = [
                `**${selectedArea.name}**에서 열심히 사냥중입니다...`,
                `**${selectedArea.name}**에서 힘겹게 전투중입니다...`,
                `**${selectedArea.name}**의 몬스터들과 격투중입니다...`,
                `**${selectedArea.name}**를 탐험하며 사냥중입니다...`,
                `**${selectedArea.name}**에서 치열한 전투를 벌이고 있습니다...`
            ];
            
            const randomMessage = huntingMessages[Math.floor(Math.random() * huntingMessages.length)];
            
            const huntGifEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ 사냥중...')
                .setDescription(`${randomMessage}\n\n현재 레벨: **Lv.${user.level}**`)
                .setImage(`attachment://${huntingGifName}`);
            
            await interaction.update({ embeds: [huntGifEmbed], components: [], files: [huntGifAttachment] });
            
            // 주식 시장 이벤트 트리거 (사냥 시작)
            recordPlayerAction('hunt_start');
            
            // 2초 대기 후 바로 결과로
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 랜덤 몬스터 선택 (사냥터에 접근할 수 있다면 모든 몬스터 사냥 가능)
            const availableMonsters = selectedArea.monsters;

            const selectedMonster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
            const monsterLevel = Math.floor(Math.random() * (selectedMonster.level[1] - selectedMonster.level[0] + 1)) + selectedMonster.level[0];

            // 전투력 계산
            const userPower = calculateCombatPower(user);
            const monsterPower = calculateMonsterPower(selectedMonster, monsterLevel);
            
            // 승리 확률 계산 (전투력 차이에 따라)
            const powerDiff = userPower - monsterPower;
            let winRate = 50; // 기본 50%
            
            if (powerDiff > 0) {
                winRate = Math.min(95, 50 + (powerDiff / 10)); // 최대 95%
            } else {
                winRate = Math.max(5, 50 + (powerDiff / 15)); // 최소 5%
            }
            
            const battleResult = Math.random() * 100 <= winRate;

            // 전투 결과 계산
            const baseExp = Math.floor(Math.random() * (selectedMonster.exp[1] - selectedMonster.exp[0] + 1)) + selectedMonster.exp[0];
            const baseGold = Math.floor(Math.random() * (selectedMonster.gold[1] - selectedMonster.gold[0] + 1)) + selectedMonster.gold[0];
            
            // 레벨 차이에 따른 보상 조정
            const levelDiff = user.level - monsterLevel;
            let expMultiplier = 1;
            let goldMultiplier = 1;
            
            if (levelDiff > 5) {
                expMultiplier = 0.5; // 너무 쉬운 몬스터
                goldMultiplier = 0.7;
            } else if (levelDiff < -5) {
                expMultiplier = 1.5; // 어려운 몬스터
                goldMultiplier = 1.3;
            }

            const finalExp = Math.floor(baseExp * expMultiplier);
            const finalGold = Math.floor(baseGold * goldMultiplier);

            // 레어도에 따른 보너스
            let rarityBonus = 1;
            let rarityEmoji = '';
            switch (selectedMonster.rarity) {
                case '레어':
                    rarityBonus = 1.2;
                    rarityEmoji = '✨';
                    break;
                case '에픽':
                    rarityBonus = 1.5;
                    rarityEmoji = '🌟';
                    break;
                case '유니크':
                    rarityBonus = 2.0;
                    rarityEmoji = '💎';
                    break;
                case '레전드':
                    rarityBonus = 3.0;
                    rarityEmoji = '👑';
                    break;
                default:
                    rarityEmoji = '⚔️';
            }

            user.lastHunt = Date.now();
            
            // GIF 파일 준비
            const winGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_hunting_win.gif'), { name: 'kim_hunting_win.gif' });
            const loseGifAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_hunting_lose.gif'), { name: 'kim_hunting_lose.gif' });
            
            let resultEmbed;
            
            if (battleResult) {
                // 승리 시
                const bonusExp = Math.floor(finalExp * (rarityBonus - 1));
                const bonusGold = Math.floor(finalGold * (rarityBonus - 1));

                // 레벨별 골드 페널티 적용 (인플레이션 방지)
                let goldPenalty = 1.0;
                if (user.level >= 61) goldPenalty = 0.6;        // -40%
                else if (user.level >= 41) goldPenalty = 0.7;   // -30%  
                else if (user.level >= 21) goldPenalty = 0.8;   // -20%
                
                const adjustedGold = Math.floor(finalGold * goldPenalty);
                const adjustedBonusGold = Math.floor(bonusGold * goldPenalty);

                // 유저 데이터 업데이트
                user.exp += finalExp + bonusExp;
                user.gold += adjustedGold + adjustedBonusGold;

                // 에너지 조각 드랍 체크 (0.1% 확률)
                let energyFragmentDrop = null;
                if (Math.random() < 0.001) { // 0.1% 확률
                    // 몬스터 레벨에 따른 조각 단계 결정
                    let fragmentTier = 1;
                    if (monsterLevel >= 50) fragmentTier = 5;
                    else if (monsterLevel >= 40) fragmentTier = 4;
                    else if (monsterLevel >= 30) fragmentTier = 3;
                    else if (monsterLevel >= 20) fragmentTier = 2;
                    
                    // 조각 개수 (1~3개)
                    const fragmentCount = Math.floor(Math.random() * 3) + 1;
                    
                    // 기존 보유량에 추가
                    const currentCount = user.energyFragments.fragments.get(fragmentTier.toString()) || 0;
                    user.energyFragments.fragments.set(fragmentTier.toString(), currentCount + fragmentCount);
                    
                    energyFragmentDrop = { tier: fragmentTier, count: fragmentCount };
                }

                // 아이템 드롭 체크
                let droppedItems = [];
                const monsterDrops = DROP_ITEMS[selectedMonster.name] || [];
                
                // 행운 스탯에 따른 드롭률 보너스 (행운 1당 +0.05%)
                const luckBonus = (user.stats.luck - 10) * 0.05;
                
                // 몬스터별 드롭 확인
                for (const dropData of monsterDrops) {
                    const finalDropRate = dropData.dropRate + luckBonus;
                    if (Math.random() * 100 < finalDropRate) {
                        // 아이템 생성
                        const itemPrice = Math.floor(Math.random() * (dropData.price[1] - dropData.price[0] + 1)) + dropData.price[0];
                        const uniqueItemId = `drop_${selectedMonster.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        const newItem = {
                            id: uniqueItemId,
                            name: dropData.name,
                            type: dropData.type,
                            rarity: dropData.rarity,
                            setName: `${selectedMonster.name} 드롭`,
                            level: 1,
                            quantity: 1,
                            enhanceLevel: 0,
                            stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
                            price: itemPrice,
                            description: dropData.effect || '사냥에서 얻은 귀중한 아이템입니다.'
                        };
                        
                        // 인벤토리에 추가
                        const inventoryResult = addItemToInventory(user, newItem);
                        if (inventoryResult.success) {
                            droppedItems.push(dropData);
                        }
                    }
                }
                
                // 지역 공통 드롭 확인
                const areaDrops = DROP_ITEMS.ALL_AREAS.filter(item => item.area === selectedArea.id);
                for (const areaDropData of areaDrops) {
                    const finalDropRate = areaDropData.dropRate + luckBonus;
                    if (Math.random() * 100 < finalDropRate) {
                        const itemPrice = Math.floor(Math.random() * (areaDropData.price[1] - areaDropData.price[0] + 1)) + areaDropData.price[0];
                        const uniqueItemId = `area_drop_${selectedArea.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        const newItem = {
                            id: uniqueItemId,
                            name: areaDropData.name,
                            type: areaDropData.type,
                            rarity: areaDropData.rarity,
                            setName: `${selectedArea.name} 특산품`,
                            level: 1,
                            quantity: 1,
                            enhanceLevel: 0,
                            stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
                            price: itemPrice,
                            description: `${selectedArea.name}에서만 구할 수 있는 특별한 아이템입니다.`
                        };
                        
                        const inventoryResult = addItemToInventory(user, newItem);
                        if (inventoryResult.success) {
                            droppedItems.push(areaDropData);
                        }
                    }
                }

                // 랜덤 인카운터 체크 (5% 확률)
                let randomEncounter = null;
                if (Math.random() < 0.05) {
                    randomEncounter = checkRandomEncounter();
                }

                // 레벨업 체크
                const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);

                await user.save();

                // 결과 임베드 (승리 GIF와 함께)
                const expBar = generateExpBar(user.exp, user.level * 100, 20);
                const powerDiffText = userPower > monsterPower ? 
                    `🔥 **우세** (+${userPower - monsterPower})` : 
                    userPower < monsterPower ? 
                        `⚠️ **열세** (-${monsterPower - userPower})` : 
                        `⚖️ **동등**`;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00d4aa')
                    .setTitle(`${rarityEmoji} ⚔️ 전투 승리! ⚔️`)
                    .setDescription(`🎯 **${selectedMonster.name}** Lv.${monsterLevel} 처치 완료!${leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level} 🎉` : ''}`)
                    .addFields(
                        { 
                            name: '⚔️ 전투 결과', 
                            value: `🛡️ 나의 전투력: **${userPower.toLocaleString()}** | ⚔️ 적의 전투력: **${monsterPower.toLocaleString()}** | 📊 승리 확률: **${winRate.toFixed(1)}%**\n\n${powerDiffText}`, 
                            inline: false 
                        },
                        { 
                            name: '💎 보상', 
                            value: `✨ 경험치: \`+${finalExp.toLocaleString()} EXP\`${bonusExp > 0 ? ` \`보너스 +${bonusExp.toLocaleString()}\`` : ''} | 💰 골드: \`+${adjustedGold.toLocaleString()}<:currency_emoji:1377404064316522778>\`${adjustedBonusGold > 0 ? ` \`보너스 +${adjustedBonusGold.toLocaleString()}<:currency_emoji:1377404064316522778>\`` : ''}${goldPenalty < 1.0 ? `\n📉 **고레벨 페널티**: ${Math.round((1-goldPenalty)*100)}% 골드 감소` : ''}${energyFragmentDrop ? `\n🔮 **에너지 조각 획득!** \`${energyFragmentDrop.tier}단계 조각 x${energyFragmentDrop.count}\` ✨` : ''}${droppedItems.length > 0 ? `\n\n🎁 **아이템 드롭!**\n${droppedItems.map(item => {
                                const rarityEmojis = {
                                    '일반': '⚪',
                                    '고급': '🟢', 
                                    '레어': '🔵',
                                    '에픽': '🟣',
                                    '레전드리': '🟡',
                                    '신화': '🔴'
                                };
                                return `${rarityEmojis[item.rarity] || '⚪'} **${item.name}** (${item.rarity})`;
                            }).join('\n')}` : ''}`, 
                            inline: false 
                        },
                        { 
                            name: '📊 현재 상태', 
                            value: `🏆 레벨: \`Lv.${user.level}\` | ✨ 경험치: \`${user.exp}/${user.level * 100} EXP\` | 💰 골드: \`${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\``, 
                            inline: false 
                        }
                    );
                
                // 랜덤 인카운터 정보 추가
                if (randomEncounter) {
                    resultEmbed.addFields({
                        name: `🎲 특별 만남: ${randomEncounter.name}`,
                        value: randomEncounter.description,
                        inline: false
                    });
                }
                
                resultEmbed.setImage('attachment://kim_hunting_win.gif')
            } else {
                // 패배 시
                const defeatMessages = [
                    "아이템을 강화해서 이기자!",
                    "더 강해져서 다시 도전하자!",
                    "장비를 업그레이드하고 복수하자!",
                    "레벨업을 하고 다시 싸우자!",
                    "능력치를 올리고 재도전하자!",
                    "더 좋은 무기가 필요해 보인다!",
                    "방어구를 강화하고 다시 오자!",
                    "전투력을 키워서 복수하자!",
                    "스킬을 배워서 다시 도전하자!",
                    "더 많은 경험이 필요해 보인다!"
                ];
                
                const randomDefeatMessage = defeatMessages[Math.floor(Math.random() * defeatMessages.length)];
                
                // 벌금 계산 (몬스터 드랍 골드의 1~10배)
                const penalty = Math.floor(Math.random() * 10 + 1) * baseGold;
                const actualPenalty = Math.min(penalty, user.gold); // 보유 골드를 초과할 수 없음
                
                user.gold = Math.max(0, user.gold - actualPenalty);
                await user.save();

                // 결과 임베드 (패배 GIF와 함께)
                const expBarDefeat = generateExpBar(user.exp, user.level * 100, 20);
                const powerDiffTextDefeat = userPower > monsterPower ? 
                    `🔥 **우세였지만** (+${userPower - monsterPower})` : 
                    userPower < monsterPower ? 
                        `⚠️ **열세** (-${monsterPower - userPower})` : 
                        `⚖️ **동등했지만**`;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle(`💥 ⚔️ 전투 패배... ⚔️`)
                    .setDescription(`😞 **${selectedMonster.name}** Lv.${monsterLevel} 에게 패배...\n\n💭 **"${randomDefeatMessage}"**`)
                    .addFields(
                        { 
                            name: '⚔️ 전투 결과', 
                            value: `🛡️ 나의 전투력: **${userPower.toLocaleString()}** | ⚔️ 적의 전투력: **${monsterPower.toLocaleString()}** | 📊 승리 확률: **${winRate.toFixed(1)}%**\n\n${powerDiffTextDefeat}`, 
                            inline: false 
                        },
                        { 
                            name: '💸 손실', 
                            value: `💰 벌금: \`-${actualPenalty.toLocaleString()}<:currency_emoji:1377404064316522778>\` | ❌ 몬스터 드랍 골드의 **${Math.floor(actualPenalty/baseGold)}배** 손실`, 
                            inline: false 
                        },
                        { 
                            name: '📊 현재 상태', 
                            value: `🏆 레벨: \`Lv.${user.level}\` | ✨ 경험치: \`${user.exp}/${user.level * 100} EXP\` | 💰 골드: \`${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>\``, 
                            inline: false 
                        },
                        { 
                            name: '💡 다음 도전을 위한 조언', 
                            value: `🎯 ${randomDefeatMessage}\n\n🔧 **추천 강화 방법**\n📈 능력치 포인트 투자\n⚔️ 장비 강화 및 교체\n🆙 레벨업으로 기본 능력치 증가`, 
                            inline: false 
                        }
                    )
                    .setImage('attachment://kim_hunting_lose.gif')
            }

            const continueButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hunt_area_${areaId}`)
                        .setLabel('🔄 계속 사냥')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('hunting')
                        .setLabel('🗺️ 사냥터 변경')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.editReply({ 
                embeds: [resultEmbed], 
                components: [continueButtons], 
                files: battleResult ? [winGifAttachment] : [loseGifAttachment]
            });
        }
        
        else if (interaction.customId === 'work') {
            const cooldown = 45 * 60 * 1000; // 45분 쿨타임 (골드 인플레이션 방지)
            
            if (now - user.lastWork < cooldown) {
                const remaining = Math.ceil((cooldown - (now - user.lastWork)) / 60000);
                await interaction.reply({ content: `쿨타임 ${remaining}분 남았습니다!`, flags: 64 });
                return;
            }

            const goldReward = Math.floor(Math.random() * 200) + 150; // 150-350골드 (인플레이션 방지)
            const expReward = Math.floor(Math.random() * 50) + 25; // 25-75경험치
            
            user.gold += goldReward;
            user.exp += expReward;
            user.lastWork = now;
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            
            await user.save();

            const levelUpMessage = leveledUp ? `\n\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('일하기 완료!')
                .setDescription(`열심히 일해서 골드와 경험치를 얻었습니다!${levelUpMessage}`)
                .addFields(
                    { name: '획득 골드', value: `+${goldReward.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '획득 경험치', value: `+${expReward} EXP`, inline: true },
                    { name: '현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                );

            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (interaction.customId === 'info') {
            const maxExp = user.level * 100;
            const embed = new EmbedBuilder()
                .setColor('#9932cc')
                .setTitle('내 정보')
                .setDescription(`**${user.nickname}**님의 게임 정보`)
                .addFields(
                    { name: '레벨', value: `Lv.${user.level}`, inline: true },
                    { name: '경험치', value: `${user.exp}/${maxExp} EXP`, inline: true },
                    { name: '골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '인기도', value: `${user.popularity} ${user.popularity > 0 ? '❤️' : user.popularity < 0 ? '💔' : ''}`, inline: true },
                    { name: '출석체크', value: user.lastDaily === new Date().toDateString() ? '완료' : '미완료', inline: true },
                    { name: '일하기', value: now - user.lastWork < 30 * 60 * 1000 ? '쿨타임' : '가능', inline: true },
                    { name: '연속 출석', value: `${user.attendanceStreak || 0}일 🔥`, inline: true },
                    { name: '주간 출석', value: `${user.weeklyAttendance ? user.weeklyAttendance.filter(x => x).length : 0}/7일`, inline: true }
                );

            await interaction.reply({ embeds: [embed], flags: 64 });
        }
        
        else if (interaction.customId === 'stats') {
            const totalStats = user.stats.strength + user.stats.agility + user.stats.intelligence + user.stats.vitality + user.stats.luck;
            
            const statsEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('💪 능력치')
                .setDescription(`**${user.nickname}**님의 능력치 정보`)
                .addFields(
                    { name: '💪 힘', value: `${user.stats.strength}`, inline: true },
                    { name: '🏃 민첩', value: `${user.stats.agility}`, inline: true },
                    { name: '🧠 지능', value: `${user.stats.intelligence}`, inline: true },
                    { name: '❤️ 체력', value: `${user.stats.vitality}`, inline: true },
                    { name: '🍀 행운', value: `${user.stats.luck}`, inline: true },
                    { name: '📊 총합', value: `${totalStats}`, inline: true },
                    { name: '⭐ 보유 스탯포인트', value: `${user.statPoints}점`, inline: false }
                )
                .setFooter({ text: '레벨업 시 스탯포인트가 지급됩니다!' });

            const statButtons = new ActionRowBuilder();
            
            if (user.statPoints > 0) {
                statButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('add_strength')
                        .setLabel('💪 힘 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_agility')
                        .setLabel('🏃 민첩 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_intelligence')
                        .setLabel('🧠 지능 +1')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('add_vitality')
                        .setLabel('❤️ 체력 +1')
                        .setStyle(ButtonStyle.Primary)
                );
            } else {
                statButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('stats_info')
                        .setLabel('스탯포인트가 없습니다')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            }

            await interaction.reply({ 
                embeds: [statsEmbed], 
                components: user.statPoints > 0 ? [statButtons] : [statButtons],
                flags: 64 
            });
        }
        
        else if (interaction.customId === 'skills') {
            const skillsEmbed = new EmbedBuilder()
                .setColor('#4ecdc4')
                .setTitle('🔮 스킬')
                .setDescription(`**${user.nickname}**님의 스킬 정보`)
                .addFields(
                    { name: '📚 보유 스킬', value: user.skills.length > 0 ? user.skills.map(skill => `**${skill.name}** Lv.${skill.level}`).join('\n') : '보유한 스킬이 없습니다.', inline: false },
                    { name: '💡 스킬 획득', value: '특정 조건을 만족하면 새로운 스킬을 습득할 수 있습니다!', inline: false }
                )
                .setFooter({ text: '스킬은 전투와 활동에서 도움을 줍니다!' });

            await interaction.reply({ embeds: [skillsEmbed], flags: 64 });
        }
        
        else if (interaction.customId.startsWith('add_')) {
            const statType = interaction.customId.replace('add_', '');
            
            if (user.statPoints <= 0) {
                await interaction.reply({ content: '스탯포인트가 부족합니다!', flags: 64 });
                return;
            }
            
            user.stats[statType] += 1;
            user.statPoints -= 1;
            await user.save();
            
            const statNames = {
                strength: '💪 힘',
                agility: '🏃 민첩', 
                intelligence: '🧠 지능',
                vitality: '❤️ 체력',
                luck: '🍀 행운'
            };
            
            await interaction.reply({ 
                content: `${statNames[statType]}이 1 증가했습니다! (${user.stats[statType]-1} → ${user.stats[statType]})`, 
                flags: 64 
            });
        }
        
        else if (interaction.customId === 'shop') {
            const shopMainAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_shop_main.gif'), { name: 'kim_shop_main.gif' });
            
            const shopEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🛒 김헌터 상점')
                .setDescription(`**${user.nickname}** 모험가님, 총 보유금액은 **${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>**입니다.\n\n원하는 카테고리를 선택하여 아이템을 구매하세요!`)
                .setImage('attachment://kim_shop_main.gif');

            const categorySelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('shop_category')
                        .setPlaceholder('카테고리를 선택하세요')
                        .addOptions([
                            {
                                label: '무기',
                                description: '검, 도끼, 활, 지팡이 등',
                                value: 'weapon',
                                emoji: '⚔️'
                            },
                            {
                                label: '헬멧',
                                description: '투구, 모자, 머리띠 등',
                                value: 'helmet',
                                emoji: '⛑️'
                            },
                            {
                                label: '갑옷',
                                description: '갑옷, 로브, 의복 등',
                                value: 'armor',
                                emoji: '🛡️'
                            },
                            {
                                label: '장갑',
                                description: '장갑, 팔찌, 손목보호대 등',
                                value: 'gloves',
                                emoji: '🧤'
                            },
                            {
                                label: '신발',
                                description: '부츠, 신발, 발목보호대 등',
                                value: 'boots',
                                emoji: '👢'
                            },
                            {
                                label: '소비',
                                description: '포션, 스크롤, 버프아이템 등',
                                value: 'consumable',
                                emoji: '💊'
                            },
                            {
                                label: '주문서',
                                description: '강화석, 강화 재료 등',
                                value: 'enhancement',
                                emoji: '⚒️'
                            },
                            {
                                label: '코인',
                                description: '특별한 코인과 재화',
                                value: 'coin',
                                emoji: '🪙'
                            }
                        ])
                );

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.reply({ 
                embeds: [shopEmbed], 
                components: [categorySelect, backButton], 
                files: [shopMainAttachment],
                flags: [64] // InteractionResponseFlags.Ephemeral
            });
        }
        
        else if (interaction.customId === 'manual_fusion_select') {
            const selectedValue = interaction.values[0];
            const level = parseInt(selectedValue.replace('manual_fusion_', ''));
            
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.update({ content: '유저 데이터를 불러올 수 없습니다!', embeds: [], components: [] });
                return;
            }
            
            const fragments = new Map(user.energyFragments.fragments);
            const fragmentCount = fragments.get(level.toString()) || 0;
            
            if (fragmentCount < 2) {
                await interaction.update({ 
                    content: '해당 조각이 부족합니다! 최소 2개가 필요합니다.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            const cost = calculateFusionCost(level);
            if (user.gold < cost) {
                await interaction.update({ 
                    content: `골드가 부족합니다! 필요: ${cost.toLocaleString()}G, 보유: ${user.gold.toLocaleString()}G`, 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            // 융합 확인 버튼
            const fragmentInfo = getFragmentInfo(level);
            const nextInfo = getFragmentInfo(level + 1);
            
            let successRate = getSuccessRate(level);
            
            // 강화 보너스 계산
            let enhanceBonus = 0;
            for (const equipment of Object.values(user.equipment)) {
                if (equipment && equipment.enhanceLevel >= 20) {
                    if (equipment.enhanceLevel >= 30) enhanceBonus = 15;
                    else if (equipment.enhanceLevel >= 25) enhanceBonus = 10;
                    else enhanceBonus = 5;
                    break;
                }
            }
            successRate += enhanceBonus;
            successRate += user.energyFragments.permanentSuccessBonus;
            successRate += user.energyFragments.weeklyRankingBonus;
            
            const guaranteedSuccess = user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED;
            const finalSuccessRate = guaranteedSuccess ? 100 : Math.min(100, successRate);
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🎯 융합 확인')
                .setDescription(`**${fragmentInfo.name}** 융합을 시도하시겠습니까?`)
                .addFields(
                    { name: '📊 융합 정보', value: `${fragmentInfo.emoji} Lv.${level} (2개) → ${nextInfo.emoji} Lv.${level + 1} (1개)`, inline: false },
                    { name: '💰 비용', value: `${cost.toLocaleString()}G`, inline: true },
                    { name: '🎯 성공률', value: guaranteedSuccess ? '**100% (스택 보장)**' : `${finalSuccessRate}%`, inline: true },
                    { name: '💎 보상', value: `${(level + 1) * 500}G`, inline: true }
                );
            
            if (enhanceBonus > 0) {
                confirmEmbed.addFields({ name: '🔨 장비 보너스', value: `+${enhanceBonus}%`, inline: true });
            }
            
            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_manual_fusion_${level}`)
                        .setLabel('✅ 융합 시도')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_manual_fusion')
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Danger)
                );
                
            await interaction.update({ embeds: [confirmEmbed], components: [confirmButtons] });
        }
        
        else if (interaction.customId.startsWith('confirm_manual_fusion_')) {
            const level = parseInt(interaction.customId.split('_')[3]);
            
            const user = await getUser(interaction.user.id);
            if (!user) {
                await interaction.update({ content: '유저 데이터를 불러올 수 없습니다!', embeds: [], components: [] });
                return;
            }
            
            const fragments = new Map(user.energyFragments.fragments);
            const fragmentCount = fragments.get(level.toString()) || 0;
            
            if (fragmentCount < 2) {
                await interaction.update({ 
                    content: '해당 조각이 부족합니다! 최소 2개가 필요합니다.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            const cost = calculateFusionCost(level);
            if (user.gold < cost) {
                await interaction.update({ 
                    content: `골드가 부족합니다! 필요: ${cost.toLocaleString()}G, 보유: ${user.gold.toLocaleString()}G`, 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            // 융합 시도 로직 실행
            const fragmentInfo = getFragmentInfo(level);
            const nextInfo = getFragmentInfo(level + 1);
            
            let successRate = getSuccessRate(level);
            
            // 강화 보너스 계산
            let enhanceBonus = 0;
            for (const equipment of Object.values(user.equipment)) {
                if (equipment && equipment.enhanceLevel >= 20) {
                    if (equipment.enhanceLevel >= 30) enhanceBonus = 15;
                    else if (equipment.enhanceLevel >= 25) enhanceBonus = 10;
                    else enhanceBonus = 5;
                    break;
                }
            }
            successRate += enhanceBonus;
            successRate += user.energyFragments.permanentSuccessBonus;
            successRate += user.energyFragments.weeklyRankingBonus;
            
            const guaranteedSuccess = user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED;
            const finalSuccessRate = guaranteedSuccess ? 100 : Math.min(100, successRate);
            
            const isSuccess = guaranteedSuccess || Math.random() * 100 < finalSuccessRate;
            
            // 비용 차감
            user.gold -= cost;
            
            // 조각 차감
            fragments.set(level.toString(), fragmentCount - 2);
            
            let resultEmbed;
            
            if (isSuccess) {
                // 성공 시 상위 조각 추가
                const nextFragmentCount = fragments.get((level + 1).toString()) || 0;
                fragments.set((level + 1).toString(), nextFragmentCount + 1);
                
                // 실패 스택 초기화
                user.energyFragments.failureStack = 0;
                
                // 보상 골드 추가
                const rewardGold = (level + 1) * 500;
                user.gold += rewardGold;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ 융합 성공!')
                    .setDescription(`**${fragmentInfo.name}** 융합에 성공했습니다!`)
                    .addFields(
                        { name: '🎯 결과', value: `${fragmentInfo.emoji} Lv.${level} (2개) → ${nextInfo.emoji} Lv.${level + 1} (1개)`, inline: false },
                        { name: '🎉 보상', value: `${rewardGold.toLocaleString()}G`, inline: true },
                        { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                    );
            } else {
                // 실패 시 실패 스택 증가
                user.energyFragments.failureStack++;
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ 융합 실패!')
                    .setDescription(`**${fragmentInfo.name}** 융합에 실패했습니다...`)
                    .addFields(
                        { name: '💔 결과', value: `${fragmentInfo.emoji} Lv.${level} (2개) → 소실`, inline: false },
                        { name: '📈 실패 스택', value: `${user.energyFragments.failureStack}/${ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED}`, inline: true },
                        { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                    );
                
                if (user.energyFragments.failureStack >= ENERGY_FRAGMENT_SYSTEM.FAILURE_STACK_REQUIRED) {
                    resultEmbed.addFields({ name: '🎯 다음 융합', value: '**100% 성공 보장!**', inline: false });
                }
            }
            
            // 조각 데이터 업데이트
            user.energyFragments.fragments = Array.from(fragments.entries());
            
            // 데이터베이스 저장
            await user.save();
            
            await interaction.update({ embeds: [resultEmbed], components: [] });
        }
        
        else if (interaction.customId === 'cancel_manual_fusion') {
            await interaction.update({ 
                content: '융합이 취소되었습니다.', 
                embeds: [], 
                components: [] 
            });
        }
        
        else if (interaction.customId === 'shop_category') {
            const selectedCategory = interaction.values[0];
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[selectedCategory];
            if (!categoryData) {
                await interaction.update({ content: '해당 카테고리는 아직 준비 중입니다!', embeds: [], components: [] });
                return;
            }
            
            // 카테고리 이미지 첨부파일 생성
            const categoryAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', categoryData.gif), { name: categoryData.gif });
            
            // 등급별 커스텀 이모지
            const rarityEmojis = {
                '일반': '<:common_emoji:1381597953072037909>',
                '고급': '<:uncomon_emoji:1381598058327838752>',
                '레어': '<:rare_emoji:1381598053974278154>',
                '에픽': '<:epic_emoji:1381598051046658048>',
                '레전드리': '<:legendary_emoji:1381598048446189589>'
            };
            
            // 골드 커스텀 이모지
            const goldEmoji = '<:currency_emoji:1377404064316522778>';
            
            // Use the global category data
            const category = categoryData;
            if (!category) {
                await interaction.update({ content: '해당 카테고리는 아직 준비 중입니다!', embeds: [], components: [] });
                return;
            }
            
            // 페이지별 등급 정의
            const pageRarities = {
                0: ['일반', '고급', '레어'],        // 1페이지
                1: ['에픽', '레전드리']           // 2페이지
            };
            
            const totalPages = 2; // 고정 2페이지
            const currentPage = 0; // 첫 페이지부터 시작

            // 현재 페이지에 해당하는 등급들의 아이템만 필터링
            const currentPageRarities = pageRarities[currentPage];
            const currentItems = category.items.filter(item => 
                currentPageRarities.includes(item.rarity)
            );

            // 등급별로 아이템 그룹화
            const itemsByRarity = {};
            currentItems.forEach(item => {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            });

            // 등급 순서 정의
            const rarityOrder = ['노멀', '레어', '에픽', '레전드리', '유니크'];
            
            // 현재 페이지의 등급들만 표시
            let itemList = '';
            currentPageRarities.forEach(rarity => {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    itemList += `${rarityEmojis[rarity]} **${rarity}**\n`;
                    itemsByRarity[rarity].forEach(item => {
                        itemList += `\`${item.name}\` - ${item.price.toLocaleString()}${goldEmoji}\n`;
                    });
                    itemList += '\n'; // 등급 간 구분을 위한 빈 줄
                }
            });
            
            const categoryEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${category.emoji} ${category.name} 상점`)
                .setDescription(`${category.name} 카테고리의 아이템들입니다.\n\n${itemList}`)
                .setThumbnail(`attachment://${categoryData.gif}`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 아이템을 클릭하여 구매하세요!` });
            
            // 등급별 버튼 스타일 설정
            const getRarityButtonStyle = (rarity) => {
                switch(rarity) {
                    case '일반': return ButtonStyle.Secondary; // 회색
                    case '고급': return ButtonStyle.Primary;   // 파란색
                    case '레어': return ButtonStyle.Danger;    // 빨간색
                    case '에픽': return ButtonStyle.Success; // 초록색
                    case '레전드리': return ButtonStyle.Danger; // 빨간색
                    default: return ButtonStyle.Secondary;
                }
            };

            // 아이템 구매 버튼들 (3개씩 3줄)
            const itemButtons = [];
            for (let i = 0; i < currentItems.length; i += 3) {
                const row = new ActionRowBuilder();
                const rowItems = currentItems.slice(i, i + 3);
                
                rowItems.forEach((item, index) => {
                    // 전체 아이템 배열에서의 실제 인덱스 찾기
                    const actualIndex = category.items.findIndex(categoryItem => 
                        categoryItem.name === item.name && categoryItem.rarity === item.rarity
                    );
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${selectedCategory}_${actualIndex}`)
                            .setLabel(`${item.name}`)
                            .setStyle(getRarityButtonStyle(item.rarity))
                            .setDisabled(user.gold < item.price)
                    );
                });
                
                itemButtons.push(row);
            }

            // 네비게이션 버튼 (사냥터와 동일한 방식)
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_prev_page`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_page_info`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`shop_${selectedCategory}_next_page`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🔙 상점 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            // 모든 버튼 합치기
            const allComponents = [...itemButtons, navButtons];

            await interaction.update({
                embeds: [categoryEmbed],
                components: allComponents,
                files: [categoryAttachment]
            });
        }
        
        else if (interaction.customId.includes('_prev_page') || interaction.customId.includes('_next_page')) {
            // 상점 페이지네이션 처리
            const parts = interaction.customId.split('_');
            const category = parts[1];
            const direction = parts[2]; // 'prev' 또는 'next'
            
            // 현재 페이지 정보 추출 (임베드의 footer에서)
            const currentEmbed = interaction.message.embeds[0];
            const footerText = currentEmbed.footer?.text || '';
            const pageMatch = footerText.match(/페이지 (\d+)\/(\d+)/);
            
            if (!pageMatch) {
                await interaction.reply({ content: '페이지 정보를 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            const currentPage = parseInt(pageMatch[1]) - 1; // 0-based index
            const totalPages = parseInt(pageMatch[2]);
            
            let newPage = currentPage;
            if (direction === 'prev' && currentPage > 0) {
                newPage = currentPage - 1;
            } else if (direction === 'next' && currentPage < totalPages - 1) {
                newPage = currentPage + 1;
            }
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[category];
            if (!categoryData) {
                await interaction.reply({ content: '카테고리를 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            // 카테고리 이미지 첨부파일 생성
            const categoryAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', categoryData.gif), { name: categoryData.gif });
            
            // 페이지 재구성 - 등급별 필터링 사용
            const rarityEmojis = {
                '일반': '<:common_emoji:1381597953072037909>',
                '고급': '<:uncomon_emoji:1381598058327838752>',
                '레어': '<:rare_emoji:1381598053974278154>',
                '에픽': '<:epic_emoji:1381598051046658048>',
                '레전드리': '<:legendary_emoji:1381598048446189589>'
            };
            
            // 골드 커스텀 이모지
            const goldEmoji = '<:currency_emoji:1377404064316522778>';
            
            // 페이지별 등급 정의 (카테고리 표시와 동일한 로직)
            const pageRarities = {
                0: ['일반', '고급', '레어'],        // 1페이지
                1: ['에픽', '레전드리']           // 2페이지
            };
            
            // 현재 페이지에 해당하는 등급들의 아이템만 필터링
            const currentPageRarities = pageRarities[newPage];
            const currentItems = categoryData.items.filter(item => 
                currentPageRarities.includes(item.rarity)
            );
            
            // 등급별로 아이템 그룹화
            const itemsByRarity = {};
            currentItems.forEach(item => {
                if (!itemsByRarity[item.rarity]) {
                    itemsByRarity[item.rarity] = [];
                }
                itemsByRarity[item.rarity].push(item);
            });
            
            // 현재 페이지의 등급들만 표시
            let itemList = '';
            currentPageRarities.forEach(rarity => {
                if (itemsByRarity[rarity] && itemsByRarity[rarity].length > 0) {
                    itemList += `${rarityEmojis[rarity]} **${rarity}**\n`;
                    itemsByRarity[rarity].forEach(item => {
                        itemList += `\`${item.name}\` - ${item.price.toLocaleString()}${goldEmoji}\n`;
                    });
                    itemList += '\n'; // 등급 간 구분을 위한 빈 줄
                }
            });
            
            const updatedEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${categoryData.emoji} ${categoryData.name} 상점`)
                .setDescription(`${categoryData.name} 카테고리의 아이템들입니다.\n\n${itemList}`)
                .setThumbnail(`attachment://${categoryData.gif}`)
                .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 아이템을 클릭하여 구매하세요!` });
            
            // 버튼 재구성
            const getRarityButtonStyle = (rarity) => {
                switch(rarity) {
                    case '노멀': return ButtonStyle.Secondary;
                    case '레어': return ButtonStyle.Primary;
                    case '에픽': return ButtonStyle.Danger;
                    case '유니크': return ButtonStyle.Success;
                    case '레전드리': return ButtonStyle.Danger;
                    default: return ButtonStyle.Secondary;
                }
            };
            
            const itemButtons = [];
            for (let i = 0; i < currentItems.length; i += 3) {
                const row = new ActionRowBuilder();
                const rowItems = currentItems.slice(i, i + 3);
                
                rowItems.forEach((item, index) => {
                    // 전체 아이템 배열에서의 실제 인덱스 찾기
                    const actualIndex = categoryData.items.findIndex(categoryItem => 
                        categoryItem.name === item.name && categoryItem.rarity === item.rarity
                    );
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${category}_${actualIndex}`)
                            .setLabel(`${item.name}`)
                            .setStyle(getRarityButtonStyle(item.rarity))
                            .setDisabled(user.gold < item.price)
                    );
                });
                
                itemButtons.push(row);
            }
            
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_prev_page`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_page_info`)
                        .setLabel(`${newPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_next_page`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('shop')
                        .setLabel('🔙 상점 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const allComponents = [...itemButtons, navButtons];

            await interaction.update({
                embeds: [updatedEmbed],
                components: allComponents,
                files: [categoryAttachment]
            });
        }
        
        else if (interaction.customId.startsWith('buy_')) {
            const parts = interaction.customId.split('_');
            if (parts.length < 3) {
                await interaction.reply({ content: '잘못된 아이템 선택입니다!', flags: 64 });
                return;
            }
            
            const category = parts[1];
            const itemIndex = parseInt(parts[2]);
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[category];
            if (!categoryData || !categoryData.items[itemIndex]) {
                await interaction.reply({ content: '존재하지 않는 아이템입니다!', flags: 64 });
                return;
            }
            
            const item = categoryData.items[itemIndex];
            
            if (user.gold < item.price) {
                await interaction.reply({ content: '골드가 부족합니다!', flags: 64 });
                return;
            }
            
            // 랜덤 능력치 생성
            const randomStats = generateRandomStats(item.stats);
            
            // 능력치 퀄리티 계산 (1~100%)
            let totalQuality = 0;
            let statCount = 0;
            
            for (const [statName, value] of Object.entries(randomStats)) {
                const [min, max] = item.stats[statName];
                if (min !== max) {
                    const quality = ((value - min) / (max - min)) * 100;
                    totalQuality += quality;
                    statCount++;
                }
            }
            
            const averageQuality = statCount > 0 ? totalQuality / statCount : 100;
            
            // 퀄리티에 따른 GIF 및 메시지 선택
            let purchaseGif;
            let qualityMessage;
            let embedColor;
            
            if (averageQuality <= 80) {
                // 하위 80% - 2 버전 GIF
                switch(item.type) {
                    case 'weapon':
                        purchaseGif = 'kim_shop_buy_waepon2.gif';
                        break;
                    case 'armor':
                        purchaseGif = 'kim_shop_buy_robe2.gif';
                        break;
                    case 'helmet':
                        purchaseGif = 'kim_shop_buy_hood2.gif';
                        break;
                    case 'gloves':
                        purchaseGif = 'kim_shop_buy_gloves2.gif';
                        break;
                    case 'boots':
                        purchaseGif = 'kim_shop_buy_boots2.gif';
                        break;
                    default:
                        purchaseGif = null;
                }
                
                if (averageQuality <= 20) {
                    qualityMessage = '😢 최하급 옵션';
                    embedColor = '#7f8c8d'; // 회색
                } else if (averageQuality <= 40) {
                    qualityMessage = '😐 하급 옵션';
                    embedColor = '#95a5a6'; // 연한 회색
                } else if (averageQuality <= 60) {
                    qualityMessage = '🙂 평균 옵션';
                    embedColor = '#3498db'; // 파란색
                } else {
                    qualityMessage = '😊 준수한 옵션';
                    embedColor = '#2ecc71'; // 초록색
                }
            } else {
                // 상위 20% - 기본 GIF
                switch(item.type) {
                    case 'weapon':
                        purchaseGif = 'kim_shop_buy_waepon.gif';
                        break;
                    case 'armor':
                        purchaseGif = 'kim_shop_buy_robe.gif';
                        break;
                    case 'helmet':
                        purchaseGif = 'kim_shop_buy_hood.gif';
                        break;
                    case 'gloves':
                        purchaseGif = 'kim_shop_buy_gloves.gif';
                        break;
                    case 'boots':
                        purchaseGif = 'kim_shop_buy_boots.gif';
                        break;
                    default:
                        purchaseGif = null;
                }
                
                if (averageQuality <= 90) {
                    qualityMessage = '😍 상급 옵션!';
                    embedColor = '#e74c3c'; // 빨간색
                } else if (averageQuality <= 95) {
                    qualityMessage = '🤩 최상급 옵션!!';
                    embedColor = '#e67e22'; // 주황색
                } else {
                    qualityMessage = '🔥 완벽한 옵션!!!';
                    embedColor = '#f1c40f'; // 황금색
                }
            }
            
            // GIF 첨부파일 생성 (파일이 존재하는 경우에만)
            let purchaseAttachment = null;
            const gifPath = path.join(__dirname, 'resource', purchaseGif);
            try {
                const fs = require('fs');
                if (fs.existsSync(gifPath)) {
                    purchaseAttachment = new AttachmentBuilder(gifPath, { name: purchaseGif });
                }
            } catch (error) {
                console.log(`GIF 파일을 찾을 수 없습니다: ${purchaseGif}`);
            }
            
            // 인벤토리 공간 확인
            const uniqueItemId = `${category}_${itemIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const itemData = {
                id: uniqueItemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                setName: item.setName,
                level: item.level || 1,
                quantity: 1,
                enhanceLevel: 0,
                stats: randomStats,
                price: item.price,
                description: item.description || ''
            };
            
            const inventoryResult = addItemToInventory(user, itemData);
            if (!inventoryResult.success) {
                await interaction.editReply({ content: inventoryResult.message });
                return;
            }
            
            // 골드 차감
            user.gold -= item.price;
            
            await user.save();
            
            // 주식 시장 이벤트 트리거 (상점 구매)
            recordPlayerAction('shop_purchase');
            
            // 능력치 표시 텍스트 생성
            let statsText = '';
            for (const [statName, value] of Object.entries(randomStats)) {
                if (value !== 0) {
                    const statDisplay = statName === 'attack' ? '공격력' : 
                                      statName === 'defense' ? '방어력' : 
                                      statName === 'dodge' ? '회피력' : 
                                      statName === 'luck' ? '행운' : statName;
                    
                    // 최대값인 경우 강조
                    const [min, max] = item.stats[statName];
                    const isMax = value === max;
                    statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value}${isMax ? ' 📈' : ''}\n`;
                }
            }
            
            // 가챠 연출용 R 버전 GIF 선택
            let gachaGif;
            switch(item.type) {
                case 'weapon':
                    gachaGif = 'kim_shop_buy_waeponR.gif';
                    break;
                case 'armor':
                case 'helmet':
                    gachaGif = 'kim_shop_buy_robeR.gif';
                    break;
                case 'gloves':
                    gachaGif = 'kim_shop_buy_glovesR.gif';
                    break;
                case 'boots':
                    gachaGif = 'kim_shop_buy_bootsR.gif';
                    break;
                default:
                    gachaGif = null;
            }
            
            // 가챠 연출용 첨부파일 생성
            let gachaAttachment = null;
            if (gachaGif) {
                const gachaPath = path.join(__dirname, 'resource', gachaGif);
                try {
                    const fs = require('fs');
                    if (fs.existsSync(gachaPath)) {
                        gachaAttachment = new AttachmentBuilder(gachaPath, { name: gachaGif });
                    }
                } catch (error) {
                    console.log(`가챠 GIF 파일을 찾을 수 없습니다: ${gachaGif}`);
                }
            }
            
            // 먼저 가챠 연출 GIF 표시
            const gachaEmbed = new EmbedBuilder()
                .setColor('#ffffff')
                .setTitle('🎲 아이템 획득 중...')
                .setDescription('어떤 옵션이 나올까요?');
            
            if (gachaAttachment) {
                gachaEmbed.setImage(`attachment://${gachaGif}`);
            }
            
            const gachaOptions = { 
                embeds: [gachaEmbed], 
                components: [],
                flags: 64 
            };
            
            if (gachaAttachment) {
                gachaOptions.files = [gachaAttachment];
            }
            
            await interaction.reply(gachaOptions);
            
            // 0.5초 후 실제 구매 정보로 업데이트
            setTimeout(async () => {
                const purchaseEmbed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle('🛍️ 구매 성공!')
                    .setDescription(`**${item.name}**을(를) 성공적으로 구매했습니다!`)
                    .addFields(
                        { name: '💎 아이템 정보', value: `${item.setName}\n${item.rarity} 등급`, inline: true },
                        { name: '📊 옵션 평가', value: `${qualityMessage}\n(상위 ${Math.round(100 - averageQuality)}%)`, inline: true },
                        { name: '📈 랜덤 능력치', value: statsText.trim() || '없음', inline: false },
                        { name: '💰 결제 정보', value: `구매가: ${item.price.toLocaleString()}<:currency_emoji:1377404064316522778>\n잔액: ${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    )
                    .setFooter({ text: '인벤토리에서 장착할 수 있습니다!' });

                if (purchaseAttachment) {
                    purchaseEmbed.setImage(`attachment://${purchaseGif}`);
                }
                
                // 재구매 및 상점메인 버튼 추가
                const actionButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${category}_${itemIndex}`)
                            .setLabel('🔄 재구매')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(user.gold < item.price),
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점 메인')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                const updateOptions = { 
                    embeds: [purchaseEmbed], 
                    components: [actionButtons],
                    files: purchaseAttachment ? [purchaseAttachment] : []
                };

                await interaction.editReply(updateOptions);
            }, 500);
        }
        
        else if (interaction.customId === 'inventory') {
            if (user.inventory.length === 0) {
                const emptyInventoryEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('🎒 인벤토리')
                    .setDescription('인벤토리가 비어있습니다!')
                    .addFields(
                        { name: '💡 팁', value: '상점에서 아이템을 구매하거나 사냥을 통해 아이템을 얻을 수 있습니다!', inline: false }
                    );
                
                await interaction.reply({ embeds: [emptyInventoryEmbed], flags: 64 });
                return;
            }
            
            // 인벤토리 메인 화면 (카테고리 선택)
            const inventoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🎒 인벤토리')
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 보유 아이템\n\n카테고리를 선택하여 아이템을 확인하세요!`)
                .addFields(
                    { name: '📊 아이템 개수', value: `총 ${user.inventory.length}개`, inline: true },
                    { name: '⚔️ 장비 아이템', value: `${user.inventory.filter(item => ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)).length}개`, inline: true },
                    { name: '📜 기타 아이템', value: `${user.inventory.filter(item => !['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)).length}개`, inline: true }
                );

            // 카테고리 버튼들 (3개씩 2줄)
            const categoryButtons1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_category_weapons')
                        .setLabel('⚔️ 무기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_armor')
                        .setLabel('🛡️ 갑옷')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_helmet_gloves')
                        .setLabel('⛑️ 헬멧/장갑')
                        .setStyle(ButtonStyle.Primary)
                );

            const categoryButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_category_boots')
                        .setLabel('👢 부츠')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_accessory')
                        .setLabel('💎 액세서리')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_scrolls')
                        .setLabel('📜 주문서')
                        .setStyle(ButtonStyle.Secondary)
                );

            const categoryButtons3 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('inv_category_consumables')
                        .setLabel('🧪 소비')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('inv_category_coins')
                        .setLabel('🪙 코인')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.reply({ 
                embeds: [inventoryEmbed], 
                components: [categoryButtons1, categoryButtons2, categoryButtons3],
                flags: 64 
            });
        }
        
        // 인벤토리 카테고리별 필터링
        else if (interaction.customId.startsWith('inv_category_')) {
            const category = interaction.customId.replace('inv_category_', '');
            
            let categoryItems = [];
            let categoryName = '';
            let categoryEmoji = '';
            let categoryGif = null;
            
            switch(category) {
                case 'weapons':
                    categoryItems = user.inventory.filter(item => item.type === 'weapon');
                    categoryName = '무기';
                    categoryEmoji = '⚔️';
                    categoryGif = 'kim_equipment_waepon.gif';
                    break;
                case 'armor':
                    categoryItems = user.inventory.filter(item => item.type === 'armor');
                    categoryName = '갑옷';
                    categoryEmoji = '🛡️';
                    categoryGif = 'kim_equipment_robe.gif';
                    break;
                case 'helmet_gloves':
                    categoryItems = user.inventory.filter(item => item.type === 'helmet' || item.type === 'gloves');
                    categoryName = '헬멧/장갑';
                    categoryEmoji = '⛑️';
                    categoryGif = 'kim_equipment_hood.gif';
                    break;
                case 'boots':
                    categoryItems = user.inventory.filter(item => item.type === 'boots');
                    categoryName = '부츠';
                    categoryEmoji = '👢';
                    categoryGif = 'kim_equipment_boots.gif';
                    break;
                case 'accessory':
                    categoryItems = user.inventory.filter(item => item.type === 'accessory');
                    categoryName = '액세서리';
                    categoryEmoji = '💎';
                    categoryGif = 'kim_equipment_acce.gif';
                    break;
                case 'scrolls':
                    categoryItems = user.inventory.filter(item => item.type === 'scroll' || item.type === 'enhancement');
                    categoryName = '주문서';
                    categoryEmoji = '📜';
                    categoryGif = 'kim_equipment_con.gif';
                    break;
                case 'consumables':
                    categoryItems = user.inventory.filter(item => item.type === 'consumable' || item.type === 'potion');
                    categoryName = '소비';
                    categoryEmoji = '🧪';
                    categoryGif = 'kim_equipment_examples.gif';
                    break;
                case 'coins':
                    categoryItems = user.inventory.filter(item => item.type === 'currency' || item.type === 'coin');
                    categoryName = '코인';
                    categoryEmoji = '🪙';
                    categoryGif = 'kim_equipment_coin.gif';
                    break;
            }
            
            if (categoryItems.length === 0) {
                await interaction.reply({ 
                    content: `${categoryName} 아이템이 없습니다!`, 
                    flags: 64 
                });
                return;
            }

            // 페이지네이션 설정
            const itemsPerPage = 3;
            const currentPage = 0;
            const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
            const startIndex = currentPage * itemsPerPage;
            const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

            // GIF 첨부 파일 준비
            let categoryAttachment = null;
            if (categoryGif) {
                const gifPath = path.join(__dirname, 'resource', categoryGif);
                try {
                    if (fs.existsSync(gifPath)) {
                        categoryAttachment = new AttachmentBuilder(gifPath, { name: categoryGif });
                    }
                } catch (error) {
                    console.log(`GIF 파일을 찾을 수 없습니다: ${categoryGif}`);
                }
            }

            // 카테고리 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${categoryEmoji} ${categoryName} 인벤토리`)
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${categoryName} 목록`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 아이템을 선택하여 사용하거나 장착하세요!` });
            
            if (categoryAttachment) {
                categoryEmbed.setImage(`attachment://${categoryGif}`);
            }

            // 아이템 목록 텍스트 생성
            let itemList = '';
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                itemList += `등급: ${item.rarity} | 수량: x${item.quantity}\n`;
                
                // 장비 아이템인 경우 스탯 표시
                if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                    let statsText = '';
                    for (const [statName, value] of Object.entries(item.stats)) {
                        if (value !== 0) {
                            const statDisplay = statName === 'attack' ? '공격력' : 
                                              statName === 'defense' ? '방어력' : 
                                              statName === 'dodge' ? '회피력' : 
                                              statName === 'luck' ? '행운' : statName;
                            statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                        }
                    }
                    itemList += `${statsText}\n`;
                }
                
                itemList += `💰 판매가: ${Math.floor(item.price * 0.7).toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
            });

            categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

            // 아이템 사용/장착 버튼들 (3개씩)
            const itemButtons = new ActionRowBuilder();
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                const isEquipment = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type);
                
                itemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`inv_use_${item.id}_${category}_${currentPage}`)
                        .setLabel(`${globalIndex + 1}. ${isEquipment ? '장착' : '사용'}`)
                        .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isEquipped)
                );
            });

            // 페이지네이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_prev_${currentPage}`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_page_${currentPage}`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`inv_${category}_next_${currentPage}`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('inventory')
                        .setLabel('🔙 인벤토리 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const components = [itemButtons];
            if (totalPages > 1) {
                components.push(navButtons);
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('inventory')
                        .setLabel('🔙 인벤토리 메인')
                        .setStyle(ButtonStyle.Primary)
                ));
            }

            const replyOptions = {
                embeds: [categoryEmbed],
                components: components,
                flags: 64
            };
            
            if (categoryAttachment) {
                replyOptions.files = [categoryAttachment];
            }
            
            await interaction.reply(replyOptions);
        }
        
        // 인벤토리 아이템 사용/장착 처리
        else if (interaction.customId.startsWith('inv_use_')) {
            const parts = interaction.customId.split('_');
            const itemId = parts[2];
            const category = parts[3];
            const currentPage = parseInt(parts[4]);
            
            const inventoryItem = user.inventory.find(inv => inv.id === itemId);
            
            if (!inventoryItem) {
                await interaction.reply({ content: '해당 아이템을 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            // 장비 아이템인 경우 장착 처리
            if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(inventoryItem.type)) {
                // 이미 착용 중인지 확인
                if (user.equipment[inventoryItem.type] && user.equipment[inventoryItem.type].id === itemId) {
                    await interaction.reply({ content: '이미 착용 중인 아이템입니다!', flags: 64 });
                    return;
                }

                // 레벨 확인
                if (user.level < inventoryItem.level) {
                    await interaction.reply({ 
                        content: `레벨이 부족합니다! (필요: Lv.${inventoryItem.level}, 현재: Lv.${user.level})`, 
                        flags: 64 
                    });
                    return;
                }

                // 장착 처리
                user.equipment[inventoryItem.type] = inventoryItem;
                await user.save();

                const equipEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('⚔️ 장비 착용 완료!')
                    .setDescription(`**${inventoryItem.name}**을(를) 성공적으로 착용했습니다!`)
                    .addFields(
                        { name: '착용한 아이템', value: `${inventoryItem.name}${inventoryItem.enhanceLevel > 0 ? ` (+${inventoryItem.enhanceLevel}성)` : ''}`, inline: true },
                        { name: '아이템 등급', value: inventoryItem.rarity, inline: true },
                        { name: '새로운 전투력', value: calculateCombatPower(user).toLocaleString(), inline: true }
                    );

                await interaction.reply({
                    embeds: [equipEmbed],
                    flags: 64
                });
            } else {
                // 소비 아이템 사용
                inventoryItem.quantity -= 1;
                if (inventoryItem.quantity <= 0) {
                    user.inventory = user.inventory.filter(inv => inv.id !== itemId);
                }
                
                await user.save();
                await interaction.reply({ 
                    content: `**${inventoryItem.name}**을(를) 사용했습니다!`, 
                    flags: 64 
                });
            }
        }
        
        // 인벤토리 카테고리 페이지네이션 처리
        else if (interaction.customId.includes('inv_') && (interaction.customId.includes('_prev_') || interaction.customId.includes('_next_'))) {
            const parts = interaction.customId.split('_');
            
            if (parts[0] === 'inv' && (parts[2] === 'prev' || parts[2] === 'next')) {
                const category = parts[1];
                const direction = parts[2];
                const currentPage = parseInt(parts[3]);
                
                let newPage = currentPage;
                if (direction === 'prev' && currentPage > 0) {
                    newPage = currentPage - 1;
                } else if (direction === 'next') {
                    newPage = currentPage + 1;
                }

                // 카테고리별 아이템 필터링
                let categoryItems = [];
                let categoryName = '';
                let categoryEmoji = '';
                
                switch(category) {
                    case 'weapons':
                        categoryItems = user.inventory.filter(item => item.type === 'weapon');
                        categoryName = '무기';
                        categoryEmoji = '⚔️';
                        break;
                    case 'armor':
                        categoryItems = user.inventory.filter(item => item.type === 'armor');
                        categoryName = '갑옷';
                        categoryEmoji = '🛡️';
                        break;
                    case 'helmet_gloves':
                        categoryItems = user.inventory.filter(item => item.type === 'helmet' || item.type === 'gloves');
                        categoryName = '헬멧/장갑';
                        categoryEmoji = '⛑️';
                        break;
                    case 'boots':
                        categoryItems = user.inventory.filter(item => item.type === 'boots');
                        categoryName = '부츠';
                        categoryEmoji = '👢';
                        break;
                    case 'accessory':
                        categoryItems = user.inventory.filter(item => item.type === 'accessory');
                        categoryName = '액세서리';
                        categoryEmoji = '💎';
                        break;
                    case 'consumables':
                        categoryItems = user.inventory.filter(item => !['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type));
                        categoryName = '주문서/소비/코인';
                        categoryEmoji = '📜';
                        break;
                }

                const itemsPerPage = 3;
                const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
                
                if (newPage >= totalPages || newPage < 0) {
                    await interaction.reply({ content: '잘못된 페이지입니다!', flags: 64 });
                    return;
                }

                const startIndex = newPage * itemsPerPage;
                const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

                // 카테고리 임베드 업데이트
                const categoryEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${categoryEmoji} ${categoryName} 인벤토리`)
                    .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${categoryName} 목록`)
                    .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 아이템을 선택하여 사용하거나 장착하세요!` });

                // 아이템 목록 텍스트 생성
                let itemList = '';
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                    itemList += `등급: ${item.rarity} | 수량: x${item.quantity}\n`;
                    
                    // 장비 아이템인 경우 스탯 표시
                    if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type)) {
                        let statsText = '';
                        for (const [statName, value] of Object.entries(item.stats)) {
                            if (value !== 0) {
                                const statDisplay = statName === 'attack' ? '공격력' : 
                                                  statName === 'defense' ? '방어력' : 
                                                  statName === 'dodge' ? '회피력' : 
                                                  statName === 'luck' ? '행운' : statName;
                                statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                            }
                        }
                        itemList += `${statsText}\n`;
                    }
                    
                    itemList += `💰 판매가: ${Math.floor(item.price * 0.7).toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
                });

                categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

                // 아이템 사용/장착 버튼들 업데이트
                const itemButtons = new ActionRowBuilder();
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[item.type] && user.equipment[item.type].id === item.id;
                    const isEquipment = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type);
                    
                    itemButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`inv_use_${item.id}_${category}_${newPage}`)
                            .setLabel(`${globalIndex + 1}. ${isEquipment ? '장착' : '사용'}`)
                            .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(isEquipped)
                    );
                });

                // 페이지네이션 버튼 업데이트
                const navButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_prev_${newPage}`)
                            .setLabel('◀ 이전')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 0),
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_page_${newPage}`)
                            .setLabel(`${newPage + 1}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`inv_${category}_next_${newPage}`)
                            .setLabel('다음 ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage >= totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🔙 인벤토리 메인')
                            .setStyle(ButtonStyle.Primary)
                    );

                const components = [itemButtons];
                if (totalPages > 1) {
                    components.push(navButtons);
                } else {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🔙 인벤토리 메인')
                            .setStyle(ButtonStyle.Primary)
                    ));
                }

                await interaction.update({
                    embeds: [categoryEmbed],
                    components: components
                });
            }
        }
        
        else if (interaction.customId.startsWith('use_')) {
            const itemId = interaction.customId.replace('use_', '');
            const inventoryItem = user.inventory.find(inv => inv.id === itemId);
            
            if (!inventoryItem) {
                await interaction.reply({ content: '해당 아이템을 보유하고 있지 않습니다!', flags: 64 });
                return;
            }
            
            if (inventoryItem.type === 'consumable') {
                // 소비 아이템 사용
                inventoryItem.quantity -= 1;
                if (inventoryItem.quantity <= 0) {
                    user.inventory = user.inventory.filter(inv => inv.id !== itemId);
                }
                
                await user.save();
                await interaction.reply({ 
                    content: `**${inventoryItem.name}**을(를) 사용했습니다!`, 
                    flags: 64 
                });
            } else {
                // 장비 아이템 장착
                await interaction.reply({ 
                    content: `장비 시스템은 5페이지에서 이용할 수 있습니다!`, 
                    flags: 64 
                });
            }
        }
        
        else if (interaction.customId === 'equipment') {
            // 장비 메인 이미지 첨부파일 생성
            const equipmentAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', 'kim_equipment.gif'), { name: 'kim_equipment.gif' });
            
            // 전투력 계산
            const combatPower = calculateCombatPower(user);
            
            const equipmentEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('⚔️ 장비 관리')
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 현재 장비 상태\n\n🔥 **총 전투력**: ${combatPower.toLocaleString()}`)
                .setImage('attachment://kim_equipment.gif')
                .addFields(
                    { name: '⚔️ 무기', value: user.equipment.weapon ? `${user.equipment.weapon.name}${user.equipment.weapon.enhanceLevel > 0 ? ` (+${user.equipment.weapon.enhanceLevel}성)` : ''}\n공격력: +${user.equipment.weapon.stats.attack}` : '없음', inline: true },
                    { name: '🛡️ 갑옷', value: user.equipment.armor ? `${user.equipment.armor.name}${user.equipment.armor.enhanceLevel > 0 ? ` (+${user.equipment.armor.enhanceLevel}성)` : ''}\n방어력: +${user.equipment.armor.stats.defense}` : '없음', inline: true },
                    { name: '⛑️ 헬멧', value: user.equipment.helmet ? `${user.equipment.helmet.name}${user.equipment.helmet.enhanceLevel > 0 ? ` (+${user.equipment.helmet.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '🧤 장갑', value: user.equipment.gloves ? `${user.equipment.gloves.name}${user.equipment.gloves.enhanceLevel > 0 ? ` (+${user.equipment.gloves.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '👢 부츠', value: user.equipment.boots ? `${user.equipment.boots.name}${user.equipment.boots.enhanceLevel > 0 ? ` (+${user.equipment.boots.enhanceLevel}성)` : ''}` : '없음', inline: true },
                    { name: '💎 액세서리', value: user.equipment.accessory ? `${user.equipment.accessory.name}${user.equipment.accessory.enhanceLevel > 0 ? ` (+${user.equipment.accessory.enhanceLevel}성)` : ''}` : '없음', inline: true }
                );

            // 카테고리별 장비 교체 버튼
            const categoryButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('equip_category_weapon')
                        .setLabel('⚔️ 무기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_armor')
                        .setLabel('🛡️ 갑옷')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_helmet')
                        .setLabel('⛑️ 헬멧')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_gloves')
                        .setLabel('🧤 장갑')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('equip_category_boots')
                        .setLabel('👢 부츠')
                        .setStyle(ButtonStyle.Primary)
                );

            const categoryButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('equip_category_accessory')
                        .setLabel('💎 액세서리')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ 
                embeds: [equipmentEmbed], 
                components: [categoryButtons, categoryButtons2],
                files: [equipmentAttachment],
                flags: 64 
            });
        }
        
        // 장비 카테고리별 필터링
        else if (interaction.customId.startsWith('equip_category_')) {
            const category = interaction.customId.replace('equip_category_', '');
            
            // 해당 카테고리의 아이템만 필터링
            const categoryItems = user.inventory.filter(item => item.type === category);
            
            if (categoryItems.length === 0) {
                await interaction.reply({ 
                    content: `인벤토리에 ${getCategoryName(category)} 아이템이 없습니다!`, 
                    flags: 64 
                });
                return;
            }

            // 페이지네이션 설정
            const itemsPerPage = 3;
            const currentPage = 0;
            const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
            const startIndex = currentPage * itemsPerPage;
            const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

            // 카테고리 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)} 교체`)
                .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${getCategoryName(category)} 목록`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages} | 원하는 아이템을 선택하여 장착하세요!` });

            // 아이템 목록 텍스트 생성
            let itemList = '';
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                itemList += `등급: ${item.rarity} | 레벨: ${item.level}\n`;
                
                // 스탯 표시
                let statsText = '';
                for (const [statName, value] of Object.entries(item.stats)) {
                    if (value !== 0) {
                        const statDisplay = statName === 'attack' ? '공격력' : 
                                          statName === 'defense' ? '방어력' : 
                                          statName === 'dodge' ? '회피력' : 
                                          statName === 'luck' ? '행운' : statName;
                        statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                    }
                }
                itemList += `${statsText}\n\n`;
            });

            categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

            // 아이템 선택 버튼들 (3개씩)
            const itemButtons = new ActionRowBuilder();
            currentItems.forEach((item, index) => {
                const globalIndex = startIndex + index;
                const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                
                itemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_item_${item.id}_${category}_${currentPage}`)
                        .setLabel(`${globalIndex + 1}. ${item.name} 장착`)
                        .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                        .setDisabled(isEquipped)
                );
            });

            // 페이지네이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_prev_${currentPage}`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_page_${currentPage}`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`equip_${category}_next_${currentPage}`)
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('🔙 장비 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            const components = [itemButtons];
            if (totalPages > 1) {
                components.push(navButtons);
            } else {
                components.push(new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('🔙 장비 메인')
                        .setStyle(ButtonStyle.Primary)
                ));
            }

            await interaction.reply({
                embeds: [categoryEmbed],
                components: components,
                flags: 64
            });
        }
        
        // 장비 아이템 착용 처리
        else if (interaction.customId.startsWith('equip_item_')) {
            const parts = interaction.customId.split('_');
            const itemId = parts[2];
            const category = parts[3];
            const currentPage = parseInt(parts[4]);
            
            const item = user.inventory.find(inv => inv.id === itemId);
            if (!item) {
                await interaction.reply({ content: '해당 아이템을 찾을 수 없습니다!', flags: 64 });
                return;
            }

            // 이미 착용 중인지 확인
            if (user.equipment[category] && user.equipment[category].id === itemId) {
                await interaction.reply({ content: '이미 착용 중인 아이템입니다!', flags: 64 });
                return;
            }

            // 레벨 확인
            if (user.level < item.level) {
                await interaction.reply({ 
                    content: `레벨이 부족합니다! (필요: Lv.${item.level}, 현재: Lv.${user.level})`, 
                    flags: 64 
                });
                return;
            }

            // 장착 처리
            user.equipment[category] = item;
            await user.save();

            const equipEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⚔️ 장비 착용 완료!')
                .setDescription(`**${item.name}**을(를) 성공적으로 착용했습니다!`)
                .addFields(
                    { name: '착용한 아이템', value: `${item.name}${item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : ''}`, inline: true },
                    { name: '아이템 등급', value: item.rarity, inline: true },
                    { name: '새로운 전투력', value: calculateCombatPower(user).toLocaleString(), inline: true }
                );

            await interaction.reply({
                embeds: [equipEmbed],
                flags: 64
            });
        }
        
        // 장비 카테고리 페이지네이션 처리
        else if (interaction.customId.includes('_prev_') || interaction.customId.includes('_next_')) {
            const parts = interaction.customId.split('_');
            
            if (parts[0] === 'equip' && (parts[2] === 'prev' || parts[2] === 'next')) {
                const category = parts[1];
                const direction = parts[2];
                const currentPage = parseInt(parts[3]);
                
                let newPage = currentPage;
                if (direction === 'prev' && currentPage > 0) {
                    newPage = currentPage - 1;
                } else if (direction === 'next') {
                    newPage = currentPage + 1;
                }

                // 해당 카테고리의 아이템만 필터링
                const categoryItems = user.inventory.filter(item => item.type === category);
                const itemsPerPage = 3;
                const totalPages = Math.ceil(categoryItems.length / itemsPerPage);
                
                if (newPage >= totalPages || newPage < 0) {
                    await interaction.reply({ content: '잘못된 페이지입니다!', flags: 64 });
                    return;
                }

                const startIndex = newPage * itemsPerPage;
                const currentItems = categoryItems.slice(startIndex, startIndex + itemsPerPage);

                // 카테고리 임베드 업데이트
                const categoryEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`${getCategoryEmoji(category)} ${getCategoryName(category)} 교체`)
                    .setDescription(`**${getUserTitle(user)} ${user.nickname}**님의 ${getCategoryName(category)} 목록`)
                    .setFooter({ text: `페이지 ${newPage + 1}/${totalPages} | 원하는 아이템을 선택하여 장착하세요!` });

                // 아이템 목록 텍스트 생성
                let itemList = '';
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}성)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? '🔴' : ''}\n`;
                    itemList += `등급: ${item.rarity} | 레벨: ${item.level}\n`;
                    
                    // 스탯 표시
                    let statsText = '';
                    for (const [statName, value] of Object.entries(item.stats)) {
                        if (value !== 0) {
                            const statDisplay = statName === 'attack' ? '공격력' : 
                                              statName === 'defense' ? '방어력' : 
                                              statName === 'dodge' ? '회피력' : 
                                              statName === 'luck' ? '행운' : statName;
                            statsText += `${statDisplay}: ${value > 0 ? '+' : ''}${value} `;
                        }
                    }
                    itemList += `${statsText}\n\n`;
                });

                categoryEmbed.addFields({ name: '보유 아이템', value: itemList, inline: false });

                // 아이템 선택 버튼들 업데이트
                const itemButtons = new ActionRowBuilder();
                currentItems.forEach((item, index) => {
                    const globalIndex = startIndex + index;
                    const isEquipped = user.equipment[category] && user.equipment[category].id === item.id;
                    
                    itemButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`equip_item_${item.id}_${category}_${newPage}`)
                            .setLabel(`${globalIndex + 1}. ${item.name} 장착`)
                            .setStyle(isEquipped ? ButtonStyle.Success : ButtonStyle.Primary)
                            .setDisabled(isEquipped)
                    );
                });

                // 페이지네이션 버튼 업데이트
                const navButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_prev_${newPage}`)
                            .setLabel('◀ 이전')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 0),
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_page_${newPage}`)
                            .setLabel(`${newPage + 1}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(`equip_${category}_next_${newPage}`)
                            .setLabel('다음 ▶')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage >= totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('🔙 장비 메인')
                            .setStyle(ButtonStyle.Primary)
                    );

                const components = [itemButtons];
                if (totalPages > 1) {
                    components.push(navButtons);
                } else {
                    components.push(new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('🔙 장비 메인')
                            .setStyle(ButtonStyle.Primary)
                    ));
                }

                await interaction.update({
                    embeds: [categoryEmbed],
                    components: components
                });
            }
        }
        
        else if (interaction.customId === 'prev_page' || interaction.customId === 'next_page') {
            // 게임 메뉴 페이지네이션 처리
            const currentEmbed = interaction.message.embeds[0];
            const footerText = currentEmbed.footer?.text || '';
            const pageMatch = footerText.match(/(\d+)\/(\d+)\s*페이지/);
            
            let newPage;
            
            // 초기 게임 메뉴에서 페이지네이션 시작하는 경우 처리
            if (!pageMatch && footerText.includes('게임 메뉴에 오신 것을 환영합니다')) {
                // 첫 페이지로 간주
                if (interaction.customId === 'prev_page') {
                    await interaction.reply({ content: '이미 첫 페이지입니다!', flags: 64 });
                    return;
                } else if (interaction.customId === 'next_page') {
                    newPage = 2; // 다음 페이지는 2페이지
                }
            } else if (pageMatch) {
                // 기존 페이지네이션 로직
                const currentPage = parseInt(pageMatch[1]);
                const totalPages = parseInt(pageMatch[2]);
                
                newPage = currentPage;
                if (interaction.customId === 'prev_page' && currentPage > 1) {
                    newPage = currentPage - 1;
                } else if (interaction.customId === 'next_page' && currentPage < totalPages) {
                    newPage = currentPage + 1;
                }
                
                if (newPage === currentPage) {
                    await interaction.reply({ content: '더 이상 이동할 페이지가 없습니다!', flags: 64 });
                    return;
                }
            } else {
                await interaction.reply({ content: '페이지 정보를 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            // 기존 페이지 구조와 동일하게 생성
            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('racing')
                            .setLabel('🏁 레이싱')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp_menu')
                            .setLabel('⚔️ PvP')
                            .setStyle(ButtonStyle.Danger)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];
            
            // 시간대별 이미지 및 색상 (원본과 동일)
            const currentTime = new Date();
            const hour = currentTime.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b';
            } else if (hour >= 12 && hour < 18) {
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800';
            } else {
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5';
            }
            
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            const maxExp = user.level * 100;
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';
            
            // 현재 페이지에 해당하는 버튼들 가져오기
            const currentPageIndex = newPage - 1; // 0-based index
            const currentPageButtons = pages[currentPageIndex];
            
            if (!currentPageButtons) {
                await interaction.reply({ content: '존재하지 않는 페이지입니다!', flags: 64 });
                return;
            }
            
            // 임베드 생성 (원본과 동일한 스타일)
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: `${newPage}/5 페이지` });
                
            // 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 1),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel(`${newPage}/5`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(newPage === 5)
                );
                
            // 콘텐츠 버튼 (현재 페이지의 버튼들)
            const contentRow = new ActionRowBuilder()
                .addComponents(currentPageButtons.buttons);
            
            // 이미지 파일 첨부
            const imageAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
                
            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow],
                files: [imageAttachment]
            });
        }
        
        else if (interaction.customId.startsWith('accept_quest_')) {
            const questId = parseInt(interaction.customId.split('_')[2]);
            
            // 의뢰 찾기
            const allClients = [
                ...QUEST_CLIENTS.villagers,
                ...QUEST_CLIENTS.merchants,
                ...QUEST_CLIENTS.scammers,
                ...QUEST_CLIENTS.travelers
            ];
            const quest = allClients.find(q => q.id === questId);
            
            if (!quest) {
                await interaction.update({ content: '의뢰를 찾을 수 없습니다!', embeds: [], components: [] });
                return;
            }

            // 쿨타임 추가
            addQuestCooldown(interaction.user.id);
            
            let resultEmbed;
            let embedColor;
            let resultTitle;
            let resultDescription;
            
            if (quest.type === 'scam') {
                // 사기 의뢰 - 골드 차감
                if (user.gold < quest.scamAmount) {
                    resultEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('💸 골드 부족')
                        .setDescription(`**${quest.name}**\n\n"아... 골드가 부족하시군요. 그럼 다음에 다시 오세요!"`)
                        .addFields(
                            { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '💸 필요 골드', value: `${quest.scamAmount.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                        )
                        .setFooter({ text: '다행히 사기를 당하지 않았습니다!' });
                } else {
                    user.gold -= quest.scamAmount;
                    await user.save();
                    
                    resultEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('💸 사기당했습니다!')
                        .setDescription(`**${quest.name}**\n\n"하하하! 고마워요! 그럼 전 이만..." *달아난다*`)
                        .addFields(
                            { name: '💸 잃은 골드', value: `${quest.scamAmount.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '💰 남은 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                        )
                        .setFooter({ text: '다음엔 조심하세요...' });
                }
            } else {
                // 정상 의뢰 - 보상 지급
                const reward = calculateQuestReward(user.level, quest.type);
                
                user.gold += reward.gold;
                user.exp += reward.exp;
                
                // 레벨업 체크
                let levelUpMessage = '';
                const maxExp = user.level * 100;
                if (user.exp >= maxExp) {
                    const levelsGained = Math.floor(user.exp / maxExp);
                    user.level += levelsGained;
                    user.exp = user.exp % maxExp;
                    levelUpMessage = `\n🎉 **레벨업!** Lv.${user.level - levelsGained} → Lv.${user.level}`;
                }
                
                await user.save();
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ 의뢰 완료!')
                    .setDescription(`**${quest.name}**\n\n"정말 고마워요! 약속한 보상을 드릴게요!"${levelUpMessage}`)
                    .addFields(
                        { name: '💰 획득 골드', value: `+${reward.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '✨ 획득 경험치', value: `+${reward.exp} EXP`, inline: true },
                        { name: '💎 현재 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    )
                    .setFooter({ text: '의뢰 완료! 30분 후에 다시 이용할 수 있습니다.' });
            }
            
            const newQuestButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('quest')
                        .setLabel('📜 새 의뢰 찾기')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true) // 쿨타임 때문에 비활성화
                );

            await interaction.update({ 
                embeds: [resultEmbed], 
                components: [newQuestButton]
            });
        }
        
        else if (interaction.customId === 'decline_quest') {
            const declineEmbed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setTitle('❌ 의뢰 거절')
                .setDescription('의뢰를 거절했습니다. 언제든지 다시 의뢰를 받을 수 있습니다.')
                .setFooter({ text: '다른 의뢰를 찾아보세요!' });

            const newQuestButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('quest')
                        .setLabel('📜 새 의뢰 찾기')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({ 
                embeds: [declineEmbed], 
                components: [newQuestButton]
            });
        }
        
        else if (interaction.customId === 'quest') {
            // 쿨타임 체크
            const cooldownMinutes = checkQuestCooldown(interaction.user.id);
            if (cooldownMinutes) {
                await interaction.reply({ 
                    content: `⏰ 의뢰 쿨타임이 **${cooldownMinutes}분** 남았습니다!`, 
                    flags: 64 
                });
                return;
            }

            // 랜덤 의뢰 선택
            const quest = getRandomQuest();
            
            const questEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(`${quest.emoji} ${quest.title}`)
                .setDescription(`**${quest.name}**\n\n"${quest.description}"`)
                .setFooter({ text: '의뢰를 수락하시겠습니까?' });

            if (quest.type === 'scam') {
                questEmbed.setColor('#e74c3c');
            }

            const questButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_quest_${quest.id}`)
                        .setLabel('✅ 수락')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('decline_quest')
                        .setLabel('❌ 거절')
                        .setStyle(ButtonStyle.Danger)
                );

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ 
                    embeds: [questEmbed], 
                    components: [questButtons]
                });
            } else {
                await interaction.reply({ 
                    embeds: [questEmbed], 
                    components: [questButtons], 
                    flags: 64 
                });
            }
        }
        
        // 주식 시장 버튼 핸들러들
        else if (interaction.customId === 'stock_regions') {
            const regionSelect = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_region')
                        .setPlaceholder('지역을 선택하세요')
                        .addOptions(
                            Object.entries(STOCK_MARKET.regions).map(([key, region]) => ({
                                label: region.name,
                                description: `${region.companies.length}개 기업`,
                                value: key
                            }))
                        )
                );

            const regionEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🌍 지역별 기업 현황')
                .setDescription('투자하고 싶은 지역을 선택하세요!\n\n각 지역마다 고유한 특성과 산업을 가지고 있습니다.')
                .setFooter({ text: '지역을 선택하면 해당 지역의 기업들을 확인할 수 있습니다.' });

            await interaction.update({
                embeds: [regionEmbed],
                components: [regionSelect]
            });
        }
        
        else if (interaction.customId === 'stock_chains') {
            const chainCompanies = STOCK_MARKET.chains;
            
            let chainText = '';
            chainCompanies.forEach((company, index) => {
                const changeIcon = company.change > 0 ? '📈' : company.change < 0 ? '📉' : '➡️';
                const changeColor = company.change > 0 ? '+' : '';
                chainText += `${index + 1}. **${company.name}**\n`;
                chainText += `   ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${changeIcon} ${changeColor}${company.change.toFixed(1)}%\n`;
                chainText += `   거래량: ${company.volume.toLocaleString()}\n\n`;
            });

            const chainEmbed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('🏢 체인 기업 현황')
                .setDescription('전 지역에서 서비스하는 대형 체인 기업들입니다.\n\n' + chainText)
                .setFooter({ text: '체인 기업을 클릭하여 매수/매도하세요!' });

            // 체인 기업 매수/매도 버튼들
            const chainButtons = new ActionRowBuilder();
            chainCompanies.slice(0, 5).forEach(company => {
                chainButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`trade_${company.id}`)
                        .setLabel(company.name)
                        .setStyle(ButtonStyle.Secondary)
                );
            });

            await interaction.update({
                embeds: [chainEmbed],
                components: [chainButtons]
            });
        }
        
        else if (interaction.customId === 'stock_portfolio') {
            const portfolio = getPlayerPortfolio(interaction.user.id);
            
            let portfolioText = `💰 **현금**: ${portfolio.cash.toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
            let totalValue = portfolio.cash;
            
            if (portfolio.stocks.size > 0) {
                portfolioText += '📈 **보유 주식 상세:**\n';
                for (const [companyId, holding] of portfolio.stocks) {
                    const company = findCompany(companyId);
                    if (company) {
                        const currentValue = company.price * holding.shares;
                        const totalCost = holding.avgPrice * holding.shares;
                        const profit = currentValue - totalCost;
                        const profitPercent = ((profit / totalCost) * 100).toFixed(1);
                        
                        portfolioText += `\n**${company.name}**\n`;
                        portfolioText += `• 보유수량: ${holding.shares}주\n`;
                        portfolioText += `• 평균단가: ${holding.avgPrice.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                        portfolioText += `• 현재가격: ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                        portfolioText += `• 평가손익: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}<:currency_emoji:1377404064316522778> (${profitPercent >= 0 ? '+' : ''}${profitPercent}%)\n`;
                        
                        totalValue += currentValue;
                    }
                }
            } else {
                portfolioText += '📊 보유 주식이 없습니다.\n\n';
            }
            
            portfolioText += `\n💎 **총 자산**: ${totalValue.toLocaleString()}<:currency_emoji:1377404064316522778>`;
            portfolioText += `\n📊 **수익률**: ${((totalValue - 10000) / 10000 * 100).toFixed(1)}%`;

            const portfolioEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('💼 내 포트폴리오')
                .setDescription(portfolioText)
                .setFooter({ text: '포트폴리오는 실시간으로 업데이트됩니다!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_main')
                        .setLabel('🔙 주식 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [portfolioEmbed],
                components: [backButton]
            });
        }
        
        else if (interaction.customId === 'stock_news') {
            // 최근 시장 이벤트와 NPC 감정 상태 표시
            const emotions = STOCK_MARKET.npc_emotions;
            const marketState = STOCK_MARKET.market_state;
            
            let newsText = '📊 **시장 현황**\n';
            newsText += `• 전체 트렌드: ${marketState.overall_trend > 0 ? '📈 상승' : marketState.overall_trend < 0 ? '📉 하락' : '➡️ 보합'}\n`;
            newsText += `• 변동성: ${marketState.volatility}%\n\n`;
            
            newsText += '😊 **NPC 감정 현황**\n';
            newsText += `• 마을주민 행복도: ${emotions.villagers.happiness.toFixed(0)}%\n`;
            newsText += `• 상인 만족도: ${emotions.merchants.satisfaction.toFixed(0)}%\n`;
            newsText += `• 여행자 호기심: ${emotions.travelers.curiosity.toFixed(0)}%\n\n`;
            
            newsText += '🎯 **플레이어 활동 통계**\n';
            newsText += `• 총 강화 시도: ${marketState.player_actions.total_enhancement_attempts}회\n`;
            newsText += `• 강화 성공: ${marketState.player_actions.successful_enhancements}회\n`;
            newsText += `• 상점 구매: ${marketState.player_actions.shop_purchases}회\n`;
            
            const newsEmbed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('📰 김헌터 시장 뉴스')
                .setDescription(newsText)
                .setFooter({ text: '시장은 여러분의 모든 행동에 반응합니다!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_main')
                        .setLabel('🔙 주식 메인')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [newsEmbed],
                components: [backButton]
            });
        }
        
        else if (interaction.customId === 'stock_chart') {
            await interaction.deferUpdate();
            
            try {
                const chartHistory = STOCK_MARKET.chart_history;
                
                if (chartHistory.timestamps.length === 0) {
                    await interaction.editReply({
                        content: '📊 차트 데이터가 아직 수집되지 않았습니다! 잠시 후 다시 시도해주세요.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                // QuickChart로 실제 차트 URL 생성
                const chartUrl = await generateMarketOverviewChart();
                
                if (!chartUrl) {
                    await interaction.editReply({
                        content: '❌ 차트 생성 중 오류가 발생했습니다.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                // 시장 상태 정보
                const marketTrend = STOCK_MARKET.market_state.overall_trend;
                const trendIcon = marketTrend > 5 ? '📈' : marketTrend < -5 ? '📉' : '➡️';
                const trendText = marketTrend > 5 ? '상승세' : marketTrend < -5 ? '하락세' : '보합세';
                
                // 상위 기업 정보
                const allCompanies = [];
                for (const region of Object.values(STOCK_MARKET.regions)) {
                    allCompanies.push(...region.companies);
                }
                allCompanies.push(...STOCK_MARKET.chains);
                
                const top3Companies = allCompanies
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 3);
                
                let topCompanyInfo = '';
                for (const company of top3Companies) {
                    if (chartHistory.top_companies[company.id] && chartHistory.top_companies[company.id].length > 1) {
                        const prices = chartHistory.top_companies[company.id];
                        const firstPrice = prices[0];
                        const lastPrice = prices[prices.length - 1];
                        const change = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1);
                        const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
                        
                        topCompanyInfo += `${changeIcon} **${company.name}** ${company.price.toLocaleString()}G (${change > 0 ? '+' : ''}${change}%)\n`;
                    }
                }
                
                const chartEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('📊 김헌터 실시간 주식 차트')
                    .setDescription(`**실시간 주식 시장 동향**\n마지막 업데이트: ${chartHistory.timestamps[chartHistory.timestamps.length - 1]}`)
                    .setImage(chartUrl)
                    .addFields(
                        { name: '📊 시장 현황', value: `${trendIcon} ${trendText} (${marketTrend > 0 ? '+' : ''}${marketTrend.toFixed(1)}%)\n📊 변동성: ${STOCK_MARKET.market_state.volatility}%\n🕐 다음 업데이트: 5분마다`, inline: true },
                        { name: '🏆 상위 기업', value: topCompanyInfo || '데이터 없음', inline: true }
                    )
                    .setFooter({ text: '실시간으로 업데이트되는 전문 차트입니다! Powered by QuickChart' });
                
                const chartButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('refresh_chart')
                            .setLabel('🔄 새로고침')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('company_charts')
                            .setLabel('📈 기업별 차트')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stock_main')
                            .setLabel('🔙 주식 메인')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                await interaction.editReply({
                    embeds: [chartEmbed],
                    components: [chartButtons]
                });
                
            } catch (error) {
                console.error('주식 차트 생성 오류:', error);
                await interaction.editReply({
                    content: '❌ 차트 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        else if (interaction.customId === 'refresh_chart') {
            // 차트 새로고침
            await interaction.deferUpdate();
            
            // 즉시 차트 데이터 업데이트
            updateStockPrices();
            updateChartData();
            
            // 새로운 차트 생성 및 전송
            try {
                const refreshChartUrl = await generateMarketOverviewChart();
                
                if (!refreshChartUrl) {
                    await interaction.editReply({
                        content: '❌ 차트 새로고침 중 오류가 발생했습니다.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                const chartHistory = STOCK_MARKET.chart_history;
                
                // 시장 상태 정보
                const marketTrend = STOCK_MARKET.market_state.overall_trend;
                const trendIcon = marketTrend > 5 ? '📈' : marketTrend < -5 ? '📉' : '➡️';
                const trendText = marketTrend > 5 ? '상승세' : marketTrend < -5 ? '하락세' : '보합세';
                
                // 상위 기업 정보
                const allCompanies = [];
                for (const region of Object.values(STOCK_MARKET.regions)) {
                    allCompanies.push(...region.companies);
                }
                allCompanies.push(...STOCK_MARKET.chains);
                
                const top3Companies = allCompanies
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 3);
                
                let topCompanyInfo = '';
                for (const company of top3Companies) {
                    if (chartHistory.top_companies[company.id] && chartHistory.top_companies[company.id].length > 1) {
                        const prices = chartHistory.top_companies[company.id];
                        const firstPrice = prices[0];
                        const lastPrice = prices[prices.length - 1];
                        const change = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1);
                        const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
                        
                        topCompanyInfo += `${changeIcon} **${company.name}** ${company.price.toLocaleString()}G (${change > 0 ? '+' : ''}${change}%)\n`;
                    }
                }
                
                const refreshEmbed = new EmbedBuilder()
                    .setColor('#27ae60')
                    .setTitle('🔄 김헌터 실시간 주식 차트 (새로고침)')
                    .setDescription(`**실시간 주식 시장 동향**\n마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')}`)
                    .setImage(refreshChartUrl)
                    .addFields(
                        { name: '📊 시장 현황', value: `${trendIcon} ${trendText} (${marketTrend > 0 ? '+' : ''}${marketTrend.toFixed(1)}%)\n📊 변동성: ${STOCK_MARKET.market_state.volatility}%\n🕐 다음 업데이트: 5분마다`, inline: true },
                        { name: '🏆 상위 기업', value: topCompanyInfo || '데이터 없음', inline: true }
                    )
                    .setFooter({ text: '🔄 차트가 새로고침되었습니다! Powered by QuickChart' });
                
                const chartButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('refresh_chart')
                            .setLabel('🔄 새로고침')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('company_charts')
                            .setLabel('📈 기업별 차트')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stock_main')
                            .setLabel('🔙 주식 메인')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                await interaction.editReply({
                    embeds: [refreshEmbed],
                    components: [chartButtons]
                });
                
            } catch (error) {
                console.error('차트 새로고침 오류:', error);
                await interaction.editReply({
                    content: '❌ 차트 새로고침 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        else if (interaction.customId === 'company_charts') {
            await interaction.deferUpdate();
            
            try {
                // 개별 기업 차트 선택 메뉴 생성
                const allCompanies = [];
                for (const region of Object.values(STOCK_MARKET.regions)) {
                    allCompanies.push(...region.companies);
                }
                allCompanies.push(...STOCK_MARKET.chains);
                
                const top5Companies = allCompanies
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 5);
                
                const companyOptions = top5Companies.map((company, index) => {
                    const chartHistory = STOCK_MARKET.chart_history;
                    let changeText = '';
                    
                    if (chartHistory.top_companies[company.id] && chartHistory.top_companies[company.id].length > 1) {
                        const prices = chartHistory.top_companies[company.id];
                        const change = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1);
                        changeText = ` (${change > 0 ? '+' : ''}${change}%)`;
                    }
                    
                    return {
                        label: company.name + changeText,
                        description: `현재 주가: ${company.price.toLocaleString()}G`,
                        value: `company_chart_${company.id}`,
                        emoji: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📈'
                    };
                });
                
                const companySelect = new StringSelectMenuBuilder()
                    .setCustomId('select_company_chart')
                    .setPlaceholder('기업을 선택하여 개별 차트 보기')
                    .addOptions(companyOptions);
                
                const selectRow = new ActionRowBuilder().addComponents(companySelect);
                
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('stock_chart')
                            .setLabel('🔙 전체 차트')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📈 기업별 개별 차트')
                    .setDescription('아래 메뉴에서 기업을 선택하면 해당 기업의 상세 차트를 확인할 수 있습니다.')
                    .addFields(
                        { name: '🏆 상위 기업 목록', value: top5Companies.map((c, i) => `${i+1}. **${c.name}** - ${c.price.toLocaleString()}G`).join('\n'), inline: false }
                    );
                
                await interaction.editReply({
                    embeds: [embed],
                    components: [selectRow, backButton],
                    files: []
                });
                
            } catch (error) {
                console.error('기업 차트 메뉴 오류:', error);
                await interaction.editReply({
                    content: '❌ 기업 차트 메뉴 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        else if (interaction.customId === 'stock_analysis') {
            // 상세 시장 분석
            const analysis = [];
            
            // 시장 동향 분석
            const marketTrend = STOCK_MARKET.market_state.overall_trend;
            if (marketTrend > 10) {
                analysis.push('🔥 **강력한 상승장**: 시장이 매우 활발합니다!');
            } else if (marketTrend > 5) {
                analysis.push('📈 **온건한 상승**: 시장이 안정적으로 성장하고 있습니다.');
            } else if (marketTrend < -10) {
                analysis.push('❄️ **강력한 하락장**: 시장이 큰 충격을 받고 있습니다.');
            } else if (marketTrend < -5) {
                analysis.push('📉 **약한 하락**: 시장이 조정을 받고 있습니다.');
            } else {
                analysis.push('➡️ **보합세**: 시장이 방향성을 찾고 있습니다.');
            }
            
            // 변동성 분석
            const volatility = STOCK_MARKET.market_state.volatility;
            if (volatility > 50) {
                analysis.push('⚡ **고변동성**: 급격한 가격 변동이 예상됩니다.');
            } else if (volatility > 30) {
                analysis.push('🌊 **중간 변동성**: 적당한 가격 변동이 있습니다.');
            } else {
                analysis.push('🏞️ **저변동성**: 안정적인 시장 상황입니다.');
            }
            
            // NPC 감정 분석
            const emotions = STOCK_MARKET.npc_emotions;
            if (emotions.villagers.happiness > 70) {
                analysis.push('😊 **마을 분위기 좋음**: 생활용품 관련 주식 상승 요인');
            }
            if (emotions.merchants.greed > 80) {
                analysis.push('💰 **상인들 탐욕 증가**: 무역/상업 관련 주식 과열 주의');
            }
            if (emotions.travelers.curiosity > 85) {
                analysis.push('🧭 **여행자 활동 증가**: 여행/모험 관련 주식 호재');
            }
            
            // 플레이어 활동 분석
            const actions = STOCK_MARKET.market_state.player_actions;
            if (actions.successful_enhancements > actions.total_enhancement_attempts * 0.7) {
                analysis.push('🔨 **강화 성공률 높음**: 장비/제작 관련 주식 상승세');
            }
            if (actions.shop_purchases > 100) {
                analysis.push('🛒 **활발한 소비**: 소매업 관련 주식 호재');
            }
            
            const analysisEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('🔍 김헌터 시장 심층 분석')
                .setDescription('AI 기반 시장 분석 리포트')
                .addFields(
                    { name: '📊 종합 분석', value: analysis.join('\n\n'), inline: false },
                    { name: '📈 투자 권장도', value: marketTrend > 0 ? '🟢 **매수 우위**' : marketTrend < -5 ? '🔴 **매도 우위**' : '🟡 **관망**', inline: true },
                    { name: '⚠️ 리스크 레벨', value: volatility > 50 ? '🔴 높음' : volatility > 30 ? '🟡 보통' : '🟢 낮음', inline: true }
                )
                .setFooter({ text: '⚠️ 투자 판단은 신중하게 하시기 바랍니다!' });
                
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_chart')
                        .setLabel('🔙 차트로 돌아가기')
                        .setStyle(ButtonStyle.Primary)
                );
                
            await interaction.update({
                embeds: [analysisEmbed],
                components: [backButton]
            });
        }
        
        else if (interaction.customId === 'stock_main') {
            // 주식 메인 화면으로 돌아가기 - /주식 명령어와 동일한 내용
            const portfolio = getPlayerPortfolio(interaction.user.id);
            
            const allCompanies = [];
            
            for (const region of Object.values(STOCK_MARKET.regions)) {
                region.companies.forEach(company => {
                    allCompanies.push({
                        ...company,
                        region: region.name
                    });
                });
            }
            
            STOCK_MARKET.chains.forEach(company => {
                allCompanies.push({
                    ...company,
                    region: '🌐 전지역'
                });
            });
            
            allCompanies.sort((a, b) => b.price - a.price);
            const topCompanies = allCompanies.slice(0, 10);
            
            let totalPortfolioValue = portfolio.cash;
            let portfolioText = `💰 현금: ${portfolio.cash.toLocaleString()}<:currency_emoji:1377404064316522778>\n\n`;
            
            if (portfolio.stocks.size > 0) {
                portfolioText += '📈 **보유 주식:**\n';
                for (const [companyId, holding] of portfolio.stocks) {
                    const company = findCompany(companyId);
                    if (company) {
                        const currentValue = company.price * holding.shares;
                        const profit = currentValue - (holding.avgPrice * holding.shares);
                        const profitPercent = ((profit / (holding.avgPrice * holding.shares)) * 100).toFixed(1);
                        
                        portfolioText += `• ${company.name}: ${holding.shares}주 `;
                        portfolioText += `(${profitPercent >= 0 ? '+' : ''}${profitPercent}%)\n`;
                        
                        totalPortfolioValue += currentValue;
                    }
                }
            } else {
                portfolioText += '📊 보유 주식이 없습니다.\n';
            }
            
            portfolioText += `\n💎 **총 자산**: ${totalPortfolioValue.toLocaleString()}<:currency_emoji:1377404064316522778>`;
            
            let marketText = '';
            topCompanies.forEach((company, index) => {
                const changeIcon = company.change > 0 ? '📈' : company.change < 0 ? '📉' : '➡️';
                const changeColor = company.change > 0 ? '+' : '';
                marketText += `${index + 1}. **${company.name}**\n`;
                marketText += `   ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${changeIcon} ${changeColor}${company.change.toFixed(1)}%\n`;
                marketText += `   ${company.region} | 거래량: ${company.volume.toLocaleString()}\n\n`;
            });
            
            const stockEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('📊 김헌터 주식 시장')
                .setDescription(`**${user.nickname}**님의 투자 현황\n\n${portfolioText}`)
                .addFields(
                    { 
                        name: '🏆 상위 기업 순위', 
                        value: marketText || '데이터를 불러오는 중...', 
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: '실시간 주가는 NPC 감정, 플레이어 행동, 시간대별 이벤트에 영향을 받습니다!' 
                });
            
            const stockButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_regions')
                        .setLabel('🌍 지역별 기업')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stock_chains')
                        .setLabel('🏢 체인 기업')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('stock_portfolio')
                        .setLabel('💼 내 포트폴리오')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stock_news')
                        .setLabel('📰 시장 뉴스')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [stockEmbed],
                components: [stockButtons]
            });
        }
        
        // 레이싱 버튼 핸들러들
        else if (interaction.customId === 'join_race_1000') {
            const result = await raceSystem.joinRace(
                interaction.user.id, 
                1000, 
                user, 
                interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
                interaction.channel
            );
            
            if (result.success) {
                await interaction.reply({ 
                    content: `✅ ${result.message}\n💰 상금풀: ${result.totalPot.toLocaleString()}<:currency_emoji:1377404064316522778> | 👥 참가자: ${result.currentPlayers}명`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
            }
        }
        
        else if (interaction.customId === 'join_race_5000') {
            const result = await raceSystem.joinRace(
                interaction.user.id, 
                5000, 
                user, 
                interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
                interaction.channel
            );
            
            if (result.success) {
                await interaction.reply({ 
                    content: `✅ ${result.message}\n💰 상금풀: ${result.totalPot.toLocaleString()}<:currency_emoji:1377404064316522778> | 👥 참가자: ${result.currentPlayers}명`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
            }
        }
        
        else if (interaction.customId === 'join_race_custom') {
            // 커스텀 베팅 금액 모달 표시
            const customBetModal = new ModalBuilder()
                .setCustomId('custom_bet_modal')
                .setTitle('🏁 레이싱 참가');
            
            const betInput = new TextInputBuilder()
                .setCustomId('bet_amount')
                .setLabel('베팅 금액')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`${raceSystem.minBet.toLocaleString()} ~ ${raceSystem.maxBet.toLocaleString()}`)
                .setRequired(true)
                .setMaxLength(10);
            
            const firstActionRow = new ActionRowBuilder().addComponents(betInput);
            customBetModal.addComponents(firstActionRow);
            
            await interaction.showModal(customBetModal);
        }
        
        else if (interaction.customId === 'leave_race') {
            const result = await raceSystem.leaveRace(interaction.user.id);
            
            if (result.success) {
                await interaction.reply({ 
                    content: `✅ ${result.message}\n💰 상금풀: ${result.totalPot.toLocaleString()}<:currency_emoji:1377404064316522778> | 👥 참가자: ${result.currentPlayers}명`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
            }
        }
        
        else if (interaction.customId === 'racing_stats') {
            // 개인 레이싱 통계 표시
            const stats = user.racingStats || {
                totalRaces: 0, wins: 0, totalWinnings: 0, totalSpent: 0,
                longestWinStreak: 0, currentWinStreak: 0, biggestWin: 0
            };
            
            const winRate = stats.totalRaces > 0 ? ((stats.wins / stats.totalRaces) * 100).toFixed(1) : '0.0';
            const profitLoss = stats.totalWinnings - stats.totalSpent;
            const profitRate = stats.totalSpent > 0 ? ((profitLoss / stats.totalSpent) * 100).toFixed(1) : '0.0';
            
            const statsEmbed = new EmbedBuilder()
                .setColor('#9B59B6')
                .setTitle(`🏁 ${user.nickname}님의 레이싱 통계`)
                .addFields(
                    { name: '🏆 총 경기', value: `${stats.totalRaces}회`, inline: true },
                    { name: '🥇 우승', value: `${stats.wins}회`, inline: true },
                    { name: '📊 승률', value: `${winRate}%`, inline: true },
                    { name: '💰 총 획득', value: `${stats.totalWinnings.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '💸 총 베팅', value: `${stats.totalSpent.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '📈 손익', value: `${profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString()}<:currency_emoji:1377404064316522778> (${profitRate >= 0 ? '+' : ''}${profitRate}%)`, inline: true },
                    { name: '🔥 최장 연승', value: `${stats.longestWinStreak}연승`, inline: true },
                    { name: '⚡ 현재 연승', value: `${stats.currentWinStreak}연승`, inline: true },
                    { name: '💎 최대 상금', value: `${stats.biggestWin.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                )
                .setFooter({ text: '🎲 운이 좋을 때를 노려보세요!' });
            
            await interaction.reply({ embeds: [statsEmbed], flags: 64 });
        }
        
        else if (interaction.customId === 'pvp_menu') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }

            const pvpInfo = await pvpSystem.getPVPInfo(user);
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ PVP 아레나')
                .setDescription('플레이어들과 치열한 전투를 벌여보세요!')
                .addFields(
                    { name: `${pvpInfo.tierEmoji} 티어`, value: `${pvpInfo.tier}`, inline: true },
                    { name: '🏆 레이팅', value: `${pvpInfo.rating}`, inline: true },
                    { name: '💳 결투권', value: `${pvpInfo.duelTickets}/20`, inline: true },
                    { name: '📊 전적', value: `${pvpInfo.wins}승 ${pvpInfo.losses}패 (${pvpInfo.winRate}%)`, inline: true },
                    { name: '🔥 연승', value: `${pvpInfo.winStreak}연승`, inline: true },
                    { name: '🌟 최고 레이팅', value: `${pvpInfo.highestRating}`, inline: true }
                )
                .setFooter({ text: '결투권은 1시간마다 1장씩 재생성됩니다!' });

            const pvpButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('start_pvp_duel')
                        .setLabel('⚔️ 결투 시작')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(pvpInfo.duelTickets <= 0),
                    new ButtonBuilder()
                        .setCustomId('pvp_ranking')
                        .setLabel('🏆 PVP 랭킹')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('pvp_info')
                        .setLabel('📊 내 PVP 정보')
                        .setStyle(ButtonStyle.Secondary)
                );

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Success)
                );

            await interaction.reply({ 
                embeds: [embed], 
                components: [pvpButtons, backButton], 
                flags: 64 
            });
        }
        
        else if (interaction.customId === 'start_pvp_duel') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }

            const result = await pvpSystem.joinQueue(interaction.user.id, user, interaction.channel);
            
            if (result.success) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('⚔️ PVP 매치메이킹')
                    .setDescription(result.message)
                    .addFields(
                        { name: '💳 보유 결투권', value: `${result.tickets || user.pvp.duelTickets}/20`, inline: true },
                        { name: '🏆 현재 레이팅', value: `${user.pvp.rating} (${user.pvp.tier})`, inline: true }
                    )
                    .setFooter({ text: '매치가 성사되면 자동으로 전투가 시작됩니다!' });

                const cancelButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('cancel_pvp_queue')
                            .setLabel('❌ 매치메이킹 취소')
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.update({ 
                    embeds: [embed], 
                    components: [cancelButton]
                });
            } else {
                await interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
            }
        }
        
        else if (interaction.customId === 'pvp_ranking') {
            try {
                await interaction.deferUpdate();
                
                const topUsers = await User.find({ registered: true })
                    .sort({ 'pvp.rating': -1 })
                    .limit(10);

                const tierEmoji = {
                    'Bronze': '🥉',
                    'Silver': '🥈', 
                    'Gold': '🥇',
                    'Platinum': '💎',
                    'Master': '🌟',
                    'Grandmaster': '👑',
                    'Challenger': '🏆'
                };

                let rankingText = '';
                topUsers.forEach((user, index) => {
                    const tier = pvpSystem.getTierByRating(user.pvp.rating);
                    const emoji = tierEmoji[tier] || '🥉';
                    const winRate = user.pvp.totalDuels > 0 ? 
                        ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : 0;
                    
                    rankingText += `**${index + 1}.** ${emoji} ${user.nickname}\n`;
                    rankingText += `　　레이팅: ${user.pvp.rating} | 승률: ${winRate}% (${user.pvp.wins}승 ${user.pvp.losses}패)\n\n`;
                });

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏆 PVP 랭킹')
                    .setDescription(rankingText || '아직 PVP 기록이 없습니다.')
                    .setFooter({ text: '레이팅은 ELO 시스템을 기반으로 계산됩니다!' });

                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('pvp_menu')
                            .setLabel('🔙 PVP 메뉴')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.editReply({ embeds: [embed], components: [backButton] });
            } catch (error) {
                console.error('PVP 랭킹 조회 오류:', error);
                await interaction.followUp({ content: 'PVP 랭킹 조회 중 오류가 발생했습니다!', flags: 64 });
            }
        }
        
        else if (interaction.customId === 'pvp_info') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }

            const pvpInfo = await pvpSystem.getPVPInfo(user);
            
            let matchHistoryText = '';
            if (pvpInfo.matchHistory.length > 0) {
                pvpInfo.matchHistory.slice(0, 5).forEach((match, index) => {
                    const resultEmoji = match.result === 'win' ? '🏆' : '💔';
                    const ratingText = match.ratingChange > 0 ? `+${match.ratingChange}` : `${match.ratingChange}`;
                    matchHistoryText += `${resultEmoji} vs ${match.opponent} (${ratingText})\n`;
                });
            } else {
                matchHistoryText = '아직 결투 기록이 없습니다.';
            }

            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`⚔️ ${user.nickname}님의 PVP 정보`)
                .addFields(
                    { name: `${pvpInfo.tierEmoji} 티어`, value: `${pvpInfo.tier}`, inline: true },
                    { name: '🏆 레이팅', value: `${pvpInfo.rating}`, inline: true },
                    { name: '💳 결투권', value: `${pvpInfo.duelTickets}/20`, inline: true },
                    { name: '📊 전적', value: `${pvpInfo.wins}승 ${pvpInfo.losses}패 (${pvpInfo.winRate}%)`, inline: true },
                    { name: '🔥 연승', value: `${pvpInfo.winStreak}연승 (최고: ${pvpInfo.maxWinStreak})`, inline: true },
                    { name: '🌟 최고 레이팅', value: `${pvpInfo.highestRating}`, inline: true },
                    { name: '📜 최근 경기', value: matchHistoryText, inline: false }
                )
                .setFooter({ text: '결투권은 1시간마다 1장씩 재생성됩니다!' });

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('pvp_menu')
                        .setLabel('🔙 PVP 메뉴')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({ embeds: [embed], components: [backButton] });
        }
        
        else if (interaction.customId === 'cancel_pvp_queue') {
            const result = pvpSystem.leaveQueue(interaction.user.id);
            
            if (result.success) {
                await interaction.update({ 
                    content: `✅ ${result.message}`, 
                    embeds: [], 
                    components: [] 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.message}`, 
                    flags: 64 
                });
            }
        }
        
        else if (interaction.customId === 'racing_ranking') {
            // 레이싱 랭킹 표시
            try {
                const [winRanking, earningsRanking, streakRanking] = await Promise.all([
                    User.find({ 'racingStats.wins': { $gt: 0 } }).sort({ 'racingStats.wins': -1 }).limit(5),
                    User.find({ 'racingStats.totalWinnings': { $gt: 0 } }).sort({ 'racingStats.totalWinnings': -1 }).limit(5),
                    User.find({ 'racingStats.longestWinStreak': { $gt: 0 } }).sort({ 'racingStats.longestWinStreak': -1 }).limit(5)
                ]);
                
                let winText = '';
                winRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    winText += `${medal} **${user.nickname}** - ${user.racingStats.wins}승\n`;
                });
                
                let earningsText = '';
                earningsRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    earningsText += `${medal} **${user.nickname}** - ${user.racingStats.totalWinnings.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                });
                
                let streakText = '';
                streakRanking.forEach((user, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    streakText += `${medal} **${user.nickname}** - ${user.racingStats.longestWinStreak}연승\n`;
                });
                
                const rankingEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🏁 레이싱 명예의 전당')
                    .setDescription('최고의 레이서들을 확인해보세요!')
                    .addFields(
                        { name: '🏆 최다승 TOP 5', value: winText || '아직 우승자가 없습니다.', inline: false },
                        { name: '💰 최다수익 TOP 5', value: earningsText || '아직 수익자가 없습니다.', inline: false },
                        { name: '🔥 최장연승 TOP 5', value: streakText || '아직 연승자가 없습니다.', inline: false }
                    )
                    .setFooter({ text: '🎲 다음 레전드는 당신일지도?' });
                
                await interaction.reply({ embeds: [rankingEmbed], flags: 64 });
            } catch (error) {
                console.error('레이싱 랭킹 조회 오류:', error);
                await interaction.reply({ content: '랭킹을 불러오는 중 오류가 발생했습니다.', flags: 64 });
            }
        }
        
        else if (interaction.customId === 'back_to_game_menu') {
            // /게임 명령어와 완전히 동일한 메뉴로 돌아가기
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
            let timeImage = '';
            let timeColor = '';
            
            if (hour >= 6 && hour < 12) {
                // 아침 시간대 (6:00 - 11:59)
                timeImage = 'kim_main_morning.png';
                timeColor = '#ffeb3b'; // 노란색
            } else if (hour >= 12 && hour < 18) {
                // 점심 시간대 (12:00 - 17:59)
                timeImage = 'kim_main_lunch.png';
                timeColor = '#ff9800'; // 주황색
            } else {
                // 저녁/밤 시간대 (18:00 - 5:59)
                timeImage = 'kim_main_night.png';
                timeColor = '#3f51b5'; // 남색
            }

            // 상태창 (RPG 스타일)
            const greetings = [
                '오늘도 힘차게 모험을 떠나볼까요?',
                '새로운 하루가 시작되었네요!',
                '모험가님, 준비는 되셨나요?',
                '오늘은 어떤 재미있는 일이 있을까요?',
                '강화왕의 세계에 오신 것을 환영합니다!',
                '레벨업을 향해 달려가볼까요?',
                '오늘도 좋은 하루 되세요!',
                '모험이 여러분을 기다리고 있어요!',
                '행운이 함께하길 바랍니다!',
                '새로운 도전이 시작됩니다!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // 경험치 계산 수정 (레벨업 시 필요 경험치 = 레벨 * 100)
            const maxExp = user.level * 100;
            
            // 출석 현황 계산 (오늘 출석체크 여부)
            const today = new Date().toDateString();
            const attendanceStatus = user.lastDaily === today ? '출석' : '결석';

            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle(`${getUserTitle(user)} ${user.nickname}님, ${randomGreeting}`)
                .addFields(
                    { name: '⭐ 레벨', value: `\`\`\`Lv.${user.level}\`\`\``, inline: true },
                    { name: '✨ 경험치', value: `\`\`\`${user.exp}/${maxExp}\`\`\``, inline: true },
                    { name: '<:currency_emoji:1377404064316522778> 골드', value: `\`\`\`${user.gold.toLocaleString()}\`\`\``, inline: true },
                    { name: '📅 출석현황', value: `\`\`\`${attendanceStatus}\`\`\``, inline: true },
                    { name: '🏆 종합순위', value: `\`\`\`준비중\`\`\``, inline: true },
                    { name: '💖 인기도', value: `\`\`\`${user.popularity}\`\`\``, inline: true }
                )
                .setImage(`attachment://${timeImage}`)
                .setFooter({ text: '게임 메뉴에 오신 것을 환영합니다!' });

            // 페이지별 버튼 정의 (/게임과 동일)
            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('🎁 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('⚒️ 일하기')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('quest')
                            .setLabel('📜 의뢰')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('⚔️ 사냥하기')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('racing')
                            .setLabel('🏁 레이싱')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('pvp_menu')
                            .setLabel('⚔️ PvP')
                            .setStyle(ButtonStyle.Danger)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('stats')
                            .setLabel('💪 능력치')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('skills')
                            .setLabel('🔮 스킬')
                            .setStyle(ButtonStyle.Primary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('shop')
                            .setLabel('🛒 상점')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🎒 인벤토리')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('enhancement')
                            .setLabel('⚡ 강화')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(user.level < 10),
                        new ButtonBuilder()
                            .setCustomId('ranking')
                            .setLabel('🏆 랭킹')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('info')
                            .setLabel('👤 내정보')
                            .setStyle(ButtonStyle.Secondary)
                    ]
                }
            ];

            // 페이지 네비게이션 버튼
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('page_info')
                        .setLabel('1/5')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('▶')
                        .setStyle(ButtonStyle.Secondary)
                );

            // 첫 페이지 버튼 row
            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);
                
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });

            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [attachment] 
            });
        }
    } catch (error) {
        console.error('인터렉션 처리 오류:', error);
    }
});

// Modal 제출 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    if (interaction.customId === 'registerModal') {
        const nickname = interaction.fields.getTextInputValue('nickname');
        const email = interaction.fields.getTextInputValue('email');
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            if (!user) {
                await interaction.reply({ content: '등록되지 않은 사용자입니다. 먼저 /가입 명령어를 사용해 가입해주세요!', flags: 64 });
                return;
            }

            // 이미 회원가입 했는지 확인
            if (user.registered) {
                await interaction.editReply({ content: '이미 회원가입을 완료하셨습니다!' });
                return;
            }

            // 닉네임 중복 체크
            const existingUser = await User.findOne({ nickname });
            if (existingUser) {
                await interaction.editReply({ content: '이미 사용 중인 닉네임입니다!' });
                return;
            }

            // 이메일 형식 검증
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await interaction.editReply({ content: '올바른 이메일 형식이 아닙니다!' });
                return;
            }

            // 인증코드 생성 및 저장
            const verificationCode = generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후 만료

            user.nickname = nickname;
            user.email = email;
            user.emailVerificationCode = verificationCode;
            user.emailVerificationExpires = expiresAt;
            
            await user.save();

            // 이메일 전송
            try {
                await sendVerificationEmail(email, verificationCode);
                await interaction.editReply({ 
                    content: `회원가입 정보가 저장되었습니다! \n**${email}**로 인증코드를 발송했습니다.\n\`/인증 [코드]\` 명령어로 이메일 인증을 완료해주세요.`
                });
            } catch (emailError) {
                console.error('이메일 전송 오류:', emailError);
                await interaction.editReply({ 
                    content: '회원가입 정보는 저장되었지만 이메일 전송에 실패했습니다. 관리자에게 문의해주세요.'
                });
            }
        } catch (error) {
            console.error('회원가입 처리 오류:', error);
            await interaction.editReply({ content: '회원가입 처리 중 오류가 발생했습니다!' });
        }
    }
    
    // 주식 매수 모달 처리
    else if (interaction.customId.startsWith('buy_modal_')) {
        const companyId = interaction.customId.replace('buy_modal_', '');
        const sharesText = interaction.fields.getTextInputValue('shares');
        const shares = parseInt(sharesText);
        
        if (isNaN(shares) || shares <= 0) {
            await interaction.reply({ content: '올바른 수량을 입력해주세요!', flags: 64 });
            return;
        }
        
        const result = buyStock(interaction.user.id, companyId, shares);
        
        if (result.success) {
            // 주식 거래 기록
            recordPlayerAction('stock_trade');
            
            await interaction.reply({ 
                content: `✅ ${result.message}`, 
                flags: 64 
            });
        } else {
            await interaction.reply({ 
                content: `❌ ${result.message}`, 
                flags: 64 
            });
        }
    }
    
    // 주식 매도 모달 처리  
    else if (interaction.customId.startsWith('sell_modal_')) {
        const companyId = interaction.customId.replace('sell_modal_', '');
        const sharesText = interaction.fields.getTextInputValue('shares');
        const shares = parseInt(sharesText);
        
        if (isNaN(shares) || shares <= 0) {
            await interaction.reply({ content: '올바른 수량을 입력해주세요!', flags: 64 });
            return;
        }
        
        const result = sellStock(interaction.user.id, companyId, shares);
        
        if (result.success) {
            // 주식 거래 기록
            recordPlayerAction('stock_trade');
            
            await interaction.reply({ 
                content: `✅ ${result.message}`, 
                flags: 64 
            });
        } else {
            await interaction.reply({ 
                content: `❌ ${result.message}`, 
                flags: 64 
            });
        }
    }
    
    // 커스텀 베팅 모달 처리
    else if (interaction.customId === 'custom_bet_modal') {
        const betAmountText = interaction.fields.getTextInputValue('bet_amount');
        const betAmount = parseInt(betAmountText.replace(/[^\d]/g, '')); // 숫자만 추출
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await interaction.reply({ content: '올바른 베팅 금액을 입력해주세요!', flags: 64 });
            return;
        }
        
        const user = await getUser(interaction.user.id);
        const result = await raceSystem.joinRace(
            interaction.user.id, 
            betAmount, 
            user, 
            interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
            interaction.channel
        );
        
        if (result.success) {
            await interaction.reply({ 
                content: `✅ ${result.message}\n💰 상금풀: ${result.totalPot.toLocaleString()}<:currency_emoji:1377404064316522778> | 👥 참가자: ${result.currentPlayers}명`, 
                flags: 64 
            });
        } else {
            await interaction.reply({ content: `❌ ${result.message}`, flags: 64 });
        }
    }
});

// 이모지 반응 추가 이벤트
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 인기도 관련 이모지 확인
        const popularityEmojis = {
            '❤️': 1,    // 하트: +1
            '👍': 1,    // 따봉: +1
            '😢': -1,   // 슬픔: -1
            '😭': -1    // 대성통곡: -1 (추가)
        };
        
        const emojiName = reaction.emoji.name;
        if (!popularityEmojis.hasOwnProperty(emojiName)) return;
        
        const value = popularityEmojis[emojiName];
        const result = await updatePopularity(
            reaction.message.author.id,
            emojiName,
            value,
            reaction.message.id,
            reaction.message.guild
        );
        
        // 결과 로그
        if (result.success) {
            console.log(`인기도 업데이트: ${reaction.message.author.tag} ${result.message}`);
        }
    } catch (error) {
        console.error('메시지 반응 처리 오류:', error);
    }
});

// 이모지 반응 제거 이벤트 (선택사항)
client.on('messageReactionRemove', async (reaction, user) => {
    try {
        // 봇의 반응은 무시
        if (user.bot) return;
        
        // 부분적인 메시지인 경우 전체 메시지 가져오기
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('반응 fetch 오류:', error);
                return;
            }
        }
        
        // 메시지 작성자가 봇인 경우 무시
        if (reaction.message.author.bot) return;
        
        // 자기 자신의 메시지에 대한 반응 무시
        if (reaction.message.author.id === user.id) return;
        
        // 반응 제거 시 인기도 원복 (선택사항)
        // 필요한 경우 구현 가능
    } catch (error) {
        console.error('메시지 반응 제거 처리 오류:', error);
    }
});

// 엠블럼 시스템 상호작용 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;
    
    try {
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            await interaction.reply({ content: '등록되지 않은 사용자입니다. 먼저 /가입을 완료해주세요!', flags: 64 });
            return;
        }

        // 주식 지역 선택
        if (interaction.customId === 'select_region') {
            const regionKey = interaction.values[0];
            const region = STOCK_MARKET.regions[regionKey];
            
            if (!region) {
                await interaction.reply({ content: '존재하지 않는 지역입니다!', flags: 64 });
                return;
            }
            
            let regionText = '';
            region.companies.forEach((company, index) => {
                const changeIcon = company.change > 0 ? '📈' : company.change < 0 ? '📉' : '➡️';
                const changeColor = company.change > 0 ? '+' : '';
                regionText += `${index + 1}. **${company.name}**\n`;
                regionText += `   ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${changeIcon} ${changeColor}${company.change.toFixed(1)}%\n`;
                regionText += `   거래량: ${company.volume.toLocaleString()}\n\n`;
            });
            
            const regionEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${region.name} 기업 현황`)
                .setDescription(regionText)
                .setFooter({ text: '기업을 클릭하여 매수/매도하세요!' });
                
            // 지역 기업 매수/매도 버튼들
            const regionButtons = new ActionRowBuilder();
            region.companies.forEach(company => {
                regionButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`trade_${company.id}`)
                        .setLabel(company.name)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_regions')
                        .setLabel('🔙 지역 목록')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await interaction.update({
                embeds: [regionEmbed],
                components: [regionButtons, backButton]
            });
        }
        
        // 개별 기업 차트 선택
        else if (interaction.customId === 'select_company_chart') {
            await interaction.deferUpdate();
            
            try {
                const companyId = interaction.values[0].replace('company_chart_', '');
                console.log('선택된 기업 ID:', companyId);
                
                // 선택된 기업 찾기
                let selectedCompany = null;
                for (const region of Object.values(STOCK_MARKET.regions)) {
                    selectedCompany = region.companies.find(c => c.id === companyId);
                    if (selectedCompany) break;
                }
                if (!selectedCompany) {
                    selectedCompany = STOCK_MARKET.chains.find(c => c.id === companyId);
                }
                
                if (!selectedCompany) {
                    await interaction.editReply({
                        content: `❌ 선택된 기업을 찾을 수 없습니다. (ID: ${companyId})`,
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                console.log('찾은 기업:', selectedCompany.name);
                
                // 기업 상세 정보
                const chartHistory = STOCK_MARKET.chart_history;
                
                // 차트 데이터 확인
                const chartData = chartHistory.top_companies[selectedCompany.id] || [];
                console.log(`${selectedCompany.name} 차트 데이터 길이:`, chartData.length);
                
                if (chartData.length < 2) {
                    await interaction.editReply({
                        content: `❌ ${selectedCompany.name}의 차트 데이터가 부족합니다. 잠시 후 다시 시도해주세요.`,
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                // 기업 개별 차트 생성
                const companyChartUrl = await generateRealChart(
                    chartData,
                    `${selectedCompany.name} 주가 차트`
                );
                
                console.log('생성된 차트 URL:', companyChartUrl ? '성공' : '실패');
                
                if (!companyChartUrl) {
                    await interaction.editReply({
                        content: '❌ 기업 차트 URL 생성에 실패했습니다.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                let changeInfo = '';
                if (chartHistory.top_companies[selectedCompany.id] && chartHistory.top_companies[selectedCompany.id].length > 1) {
                    const prices = chartHistory.top_companies[selectedCompany.id];
                    const firstPrice = prices[0];
                    const lastPrice = prices[prices.length - 1];
                    const change = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
                    const changeIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
                    changeInfo = `${changeIcon} ${change > 0 ? '+' : ''}${change}% (${firstPrice.toLocaleString()}G → ${lastPrice.toLocaleString()}G)`;
                } else {
                    changeInfo = '📊 데이터 수집 중...';
                }
                
                const companyEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle(`📈 ${selectedCompany.name} 개별 차트`)
                    .setDescription(`**${selectedCompany.name}**의 상세 주가 차트입니다.`)
                    .setImage(companyChartUrl)
                    .addFields(
                        { name: '💰 현재 주가', value: `${selectedCompany.price.toLocaleString()}G`, inline: true },
                        { name: '📊 변동률', value: `${selectedCompany.change > 0 ? '+' : ''}${selectedCompany.change.toFixed(1)}%`, inline: true },
                        { name: '📈 차트 기간 변동', value: changeInfo, inline: false }
                    )
                    .setFooter({ text: `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')} | Powered by QuickChart` });
                
                const companyButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`trade_${selectedCompany.id}`)
                            .setLabel(`💰 ${selectedCompany.name} 거래`)
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('company_charts')
                            .setLabel('🔙 기업 목록')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stock_chart')
                            .setLabel('📊 전체 차트')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                await interaction.editReply({
                    embeds: [companyEmbed],
                    components: [companyButtons]
                });
                
            } catch (error) {
                console.error('개별 기업 차트 선택 오류:', error);
                await interaction.editReply({
                    content: '❌ 차트 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        // 엠블럼 계열 선택
        else if (interaction.customId === 'emblem_category') {
            // 인터랙션 즉시 defer
            await interaction.deferReply({ flags: 64 });
            
            const category = interaction.values[0];
            const emblemData = EMBLEMS[category];
            
            if (!emblemData) {
                await interaction.editReply({ content: '존재하지 않는 계열입니다!' });
                return;
            }

            // 이미 엠블럼 보유 확인
            if (user.emblem) {
                await interaction.editReply({ 
                    content: `이미 **${user.emblem}** 엠블럼을 보유하고 있습니다! 엠블럼은 변경할 수 없습니다.` 
                });
                return;
            }

            // 레벨 20 이상 확인
            if (user.level < 20) {
                await interaction.editReply({ 
                    content: `엠블럼을 구매하려면 **레벨 20 이상**이어야 합니다! (현재 레벨: ${user.level})` 
                });
                return;
            }

            // 구매 가능한 엠블럼 목록 생성
            const availableEmblems = emblemData.emblems.filter(emblem => user.level >= emblem.level);
            
            if (availableEmblems.length === 0) {
                await interaction.editReply({ 
                    content: `이 계열의 엠블럼을 구매하려면 더 높은 레벨이 필요합니다!` 
                });
                return;
            }

            // 엠블럼 선택 임베드 생성
            const categoryEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`${emblemData.emoji} ${emblemData.name} 계열 엠블럼`)
                .setDescription(`**${user.nickname}**님이 구매 가능한 엠블럼 목록입니다.\n\n**⚠️ 한 번 구매하면 변경할 수 없습니다!**`)
                .setFooter({ text: '원하는 엠블럼을 선택하여 구매하세요!' });

            // 엠블럼 목록 텍스트 생성
            let emblemList = '';
            availableEmblems.forEach((emblem, index) => {
                const canAfford = user.gold >= emblem.price;
                emblemList += `**${emblem.name}**\n`;
                emblemList += `💰 가격: ${emblem.price.toLocaleString()}<:currency_emoji:1377404064316522778> ${canAfford ? '✅' : '❌'}\n`;
                emblemList += `📊 필요 레벨: Lv.${emblem.level}\n\n`;
            });

            categoryEmbed.addFields({ name: '구매 가능한 엠블럼', value: emblemList, inline: false });

            // 엠블럼 구매 버튼들
            const emblemButtons = new ActionRowBuilder();
            availableEmblems.slice(0, 5).forEach((emblem, index) => {
                emblemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_emblem_${category}_${index}`)
                        .setLabel(`${emblem.name} 구매`)
                        .setStyle(user.gold >= emblem.price ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(user.gold < emblem.price)
                );
            });

            await interaction.editReply({
                embeds: [categoryEmbed],
                components: [emblemButtons]
            });
        }

        // 주식 거래
        else if (interaction.customId.startsWith('trade_')) {
            const companyId = interaction.customId.replace('trade_', '');
            const company = findCompany(companyId);
            
            if (!company) {
                await interaction.reply({ content: '존재하지 않는 기업입니다!', flags: 64 });
                return;
            }
            
            const portfolio = getPlayerPortfolio(interaction.user.id);
            const holding = portfolio.stocks.get(companyId);
            
            let tradeText = `**${company.name}**\n`;
            tradeText += `💰 현재가: ${company.price.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
            tradeText += `📊 변동률: ${company.change >= 0 ? '+' : ''}${company.change.toFixed(1)}%\n`;
            tradeText += `📈 거래량: ${company.volume.toLocaleString()}\n\n`;
            
            if (holding) {
                const currentValue = company.price * holding.shares;
                const profit = currentValue - (holding.avgPrice * holding.shares);
                const profitPercent = ((profit / (holding.avgPrice * holding.shares)) * 100).toFixed(1);
                
                tradeText += `💼 **보유 현황**\n`;
                tradeText += `• 보유수량: ${holding.shares}주\n`;
                tradeText += `• 평균단가: ${holding.avgPrice.toLocaleString()}<:currency_emoji:1377404064316522778>\n`;
                tradeText += `• 평가손익: ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}<:currency_emoji:1377404064316522778> (${profitPercent >= 0 ? '+' : ''}${profitPercent}%)\n\n`;
            }
            
            tradeText += `💰 보유 현금: ${portfolio.cash.toLocaleString()}<:currency_emoji:1377404064316522778>`;
            
            const tradeEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('📊 주식 거래')
                .setDescription(tradeText)
                .setFooter({ text: '거래할 주식 수량을 입력하세요!' });
            
            // 거래 버튼들
            const tradeButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_stock_${companyId}`)
                        .setLabel('💰 매수')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(portfolio.cash < company.price),
                    new ButtonBuilder()
                        .setCustomId(`sell_stock_${companyId}`)
                        .setLabel('💸 매도')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(!holding || holding.shares === 0)
                );
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_main')
                        .setLabel('🔙 주식 메인')
                        .setStyle(ButtonStyle.Primary)
                );
            
            await interaction.update({
                embeds: [tradeEmbed],
                components: [tradeButtons, backButton]
            });
        }
        
        // 주식 매수
        else if (interaction.customId.startsWith('buy_stock_')) {
            const companyId = interaction.customId.replace('buy_stock_', '');
            const company = findCompany(companyId);
            
            if (!company) {
                await interaction.reply({ content: '존재하지 않는 기업입니다!', flags: 64 });
                return;
            }
            
            const portfolio = getPlayerPortfolio(interaction.user.id);
            const maxShares = Math.floor(portfolio.cash / company.price);
            
            if (maxShares === 0) {
                await interaction.reply({ content: '자금이 부족합니다!', flags: 64 });
                return;
            }
            
            // 매수 모달 생성
            const buyModal = new ModalBuilder()
                .setCustomId(`buy_modal_${companyId}`)
                .setTitle(`${company.name} 매수`);
            
            const sharesInput = new TextInputBuilder()
                .setCustomId('shares')
                .setLabel('매수할 주식 수량')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`1 ~ ${maxShares}주`)
                .setRequired(true)
                .setMaxLength(10);
            
            const firstActionRow = new ActionRowBuilder().addComponents(sharesInput);
            buyModal.addComponents(firstActionRow);
            
            await interaction.showModal(buyModal);
        }
        
        // 주식 매도
        else if (interaction.customId.startsWith('sell_stock_')) {
            const companyId = interaction.customId.replace('sell_stock_', '');
            const company = findCompany(companyId);
            
            if (!company) {
                await interaction.reply({ content: '존재하지 않는 기업입니다!', flags: 64 });
                return;
            }
            
            const portfolio = getPlayerPortfolio(interaction.user.id);
            const holding = portfolio.stocks.get(companyId);
            
            if (!holding || holding.shares === 0) {
                await interaction.reply({ content: '보유한 주식이 없습니다!', flags: 64 });
                return;
            }
            
            // 매도 모달 생성
            const sellModal = new ModalBuilder()
                .setCustomId(`sell_modal_${companyId}`)
                .setTitle(`${company.name} 매도`);
            
            const sharesInput = new TextInputBuilder()
                .setCustomId('shares')
                .setLabel('매도할 주식 수량')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`1 ~ ${holding.shares}주`)
                .setRequired(true)
                .setMaxLength(10);
            
            const firstActionRow = new ActionRowBuilder().addComponents(sharesInput);
            sellModal.addComponents(firstActionRow);
            
            await interaction.showModal(sellModal);
        }
        
        // 엠블럼 구매
        else if (interaction.customId.startsWith('buy_emblem_')) {
            // 인터랙션을 즉시 defer하여 토큰 만료 방지
            await interaction.deferReply({ flags: 64 });
            
            const parts = interaction.customId.split('_');
            const category = parts[2];
            const emblemIndex = parseInt(parts[3]);

            const emblemData = EMBLEMS[category];
            if (!emblemData || !emblemData.emblems[emblemIndex]) {
                await interaction.editReply({ content: '존재하지 않는 엠블럼입니다!' });
                return;
            }

            const emblem = emblemData.emblems[emblemIndex];

            // 재확인
            if (user.emblem) {
                await interaction.editReply({ content: '이미 엠블럼을 보유하고 있습니다!' });
                return;
            }

            if (user.level < emblem.level) {
                await interaction.editReply({ content: `레벨이 부족합니다! (필요: Lv.${emblem.level}, 현재: Lv.${user.level})` });
                return;
            }

            if (user.gold < emblem.price) {
                await interaction.editReply({ content: '골드가 부족합니다!' });
                return;
            }

            // 구매 처리
            user.gold -= emblem.price;
            user.emblem = emblem.name;
            await user.save();

            // Discord 역할 부여
            try {
                const guild = interaction.guild;
                let role = guild.roles.cache.find(r => r.name === emblem.roleName);
                
                if (!role) {
                    role = await guild.roles.create({
                        name: emblem.roleName,
                        color: '#FF6B00',
                        reason: '엠블럼 시스템 자동 생성'
                    });
                }

                const member = await guild.members.fetch(interaction.user.id);
                await member.roles.add(role);
            } catch (error) {
                console.error('역할 부여 오류:', error);
            }

            const purchaseEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🏆 엠블럼 구매 성공!')
                .setDescription(`**${emblem.name}** 엠블럼을 성공적으로 구매했습니다!`)
                .addFields(
                    { name: '💎 획득한 칭호', value: emblem.name, inline: true },
                    { name: '💰 결제 금액', value: `${emblem.price.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '💰 잔여 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                )
                .setFooter({ text: '이제 게임에서 새로운 칭호로 표시됩니다!' });

            await interaction.editReply({
                embeds: [purchaseEmbed]
            });
        }

    } catch (error) {
        console.error('엠블럼 시스템 오류:', error);
        
        // 인터랙션 응답 처리
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '오류가 발생했습니다. 다시 시도해주세요!', flags: 64 });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '오류가 발생했습니다. 다시 시도해주세요!' });
            }
        } catch (e) {
            console.error('오류 응답 실패:', e);
        }
    }
});

// 봇 로그인
client.login(TOKEN); 
