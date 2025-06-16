require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
const connectDB = require('./database/connection');
const User = require('./models/User');
const { generateVerificationCode, sendVerificationEmail } = require('./services/emailService');
const { huntingAreas, DROP_ITEMS } = require('./data/huntingAreas');
const STOCK_MARKET = require('./data/stockMarket');
const RANDOM_EVENTS = require('./data/randomEvents');
const shopItems = require('./data/shopItems');
const MONSTER_BATTLE = require('./data/oddEvenGame');
const MUSHROOM_GAME = require('./data/mushroomGame');
const ARTIFACT_SYSTEM = require('./data/artifactSystem');
const EXERCISE_SYSTEM = require('./data/exerciseSystem');

// 아이템 경매장 시스템
const AUCTION_HOUSE = {
    listings: new Map(),
    priceHistory: new Map(),
    marketVolume: new Map(),
    topItems: [],
    events: []
};

// 현재 시장 상황 저장소
let currentMarketEvent = null;
let lastMarketUpdate = 0;


// 현재 활성 이벤트들
let dailyFortune = null;
let currentWeather = null;
let activeMissions = new Map();

// 독버섯 게임 세션 관리
const mushroomGameSessions = new Map();
const mushroomMatchmakingQueue = new Map(); // userId -> {timestamp, difficulty}

// 메뉴 시스템 정의
const MENU_DEFINITIONS = {
    // 일일 활동
    daily: {
        label: '🎁 일일보상',
        description: '매일 받을 수 있는 보상',
        emoji: '🎁',
        category: 'daily'
    },
    work: {
        label: '🏃 운동하기',
        description: '운동으로 스탯과 골드 획득',
        emoji: '🏃',
        category: 'daily'
    },
    quest: {
        label: '📜 의뢰',
        description: '다양한 퀘스트 수행',
        emoji: '📜',
        category: 'daily'
    },
    ranking: {
        label: '🏆 랭킹',
        description: '전체 게임 랭킹 확인',
        emoji: '🏆',
        category: 'daily'
    },
    // 게임 콘텐츠
    hunting: {
        label: '🎯 사냥하기',
        description: '몬스터를 사냥하여 경험치와 골드 획득',
        emoji: '🎯',
        category: 'game'
    },
    racing: {
        label: '🏁 레이싱',
        description: '경마 베팅 게임',
        emoji: '🏁',
        category: 'game'
    },
    pvp: {
        label: '⚔️ PVP',
        description: '다른 플레이어와 결투',
        emoji: '⚔️',
        category: 'game'
    },
    mushroom: {
        label: '🍄 독버섯게임',
        description: '독버섯을 피하는 게임',
        emoji: '🍄',
        category: 'game'
    },
    oddeven: {
        label: '🎲 홀짝게임',
        description: '몬스터와 홀짝 대결',
        emoji: '🎲',
        category: 'game'
    },
    // 캐릭터 관리
    stats: {
        label: '💪 능력치',
        description: '능력치 확인 및 분배',
        emoji: '💪',
        category: 'character'
    },
    skills: {
        label: '🔮 스킬',
        description: '스킬 확인 및 업그레이드',
        emoji: '🔮',
        category: 'character'
    },
    equipment: {
        label: '⚔️ 장비관리',
        description: '장비 착용 및 관리',
        emoji: '⚔️',
        category: 'character'
    },
    enhancement: {
        label: '💎 장비강화',
        description: '에너지 조각으로 장비 강화',
        emoji: '💎',
        category: 'character'
    },
    // 경제 시스템
    shop: {
        label: '🛒 상점',
        description: '아이템 구매 및 판매',
        emoji: '🛒',
        category: 'economy'
    },
    inventory: {
        label: '🎒 인벤토리',
        description: '보유 아이템 확인',
        emoji: '🎒',
        category: 'economy'
    },
    stocks: {
        label: '📈 주식거래소',
        description: '환상 지역 기업 주식 거래',
        emoji: '📈',
        category: 'economy'
    },
    artifacts: {
        label: '🏺 유물탐사',
        description: '고대 유물 발견 및 거래',
        emoji: '🏺',
        category: 'economy'
    },
    auction: {
        label: '🏛️ 경매장',
        description: '아이템 경매 거래',
        emoji: '🏛️',
        category: 'economy'
    },
    // 기타
    ranking: {
        label: '🏆 랭킹',
        description: '각종 순위 확인',
        emoji: '🏆',
        category: 'utility'
    },
    profile: {
        label: '👤 프로필',
        description: '내 정보 및 통계 확인',
        emoji: '👤',
        category: 'utility'
    },
    settings: {
        label: '⚙️ 설정',
        description: '메뉴 커스터마이징 및 설정',
        emoji: '⚙️',
        category: 'utility'
    }
};

// 관리자 전용 메뉴
const ADMIN_MENUS = {
    admin_panel: {
        label: '🛠️ 관리자 패널',
        description: '서버 관리 및 시스템 제어',
        emoji: '🛠️',
        category: 'admin'
    }
};

// 관리자 ID 목록 (환경변수에서 읽어오거나 하드코딩)
const ADMIN_IDS = [
    process.env.ADMIN_ID || '1036681976354160670' // 기본 관리자 ID
];

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
            lastWeatherUpdate: lastWeatherUpdate || 0,
            lastFortuneUpdate: lastFortuneUpdate || 0,
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

// 인터벌 관리를 위한 배열
const intervals = [];

// 주기적 데이터 저장 (5분마다)
intervals.push(setInterval(saveGameData, 5 * 60 * 1000));

// 봇 종료 시 데이터 저장 및 리소스 정리
process.on('SIGINT', () => {
    console.log('봇 종료 중... 데이터 저장 및 리소스 정리');
    intervals.forEach(interval => clearInterval(interval));
    saveGameData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('봇 종료 중... 데이터 저장 및 리소스 정리');
    intervals.forEach(interval => clearInterval(interval));
    saveGameData();
    process.exit(0);
});

// 슬롯 이름 한글 변환 함수
function getSlotDisplayName(slot) {
    const slotNames = {
        'weapon': '무기',
        'armor': '갑옷', 
        'helmet': '헬멧',
        'gloves': '장갑',
        'boots': '부츠',
        'accessory': '액세서리'
    };
    return slotNames[slot] || slot;
}

// 관리자 권한 확인 함수
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// 사용자별 커스터마이징된 메뉴 생성
async function createCustomizedMenu(userId) {
    try {
        const user = await User.findOne({ discordId: userId });
        const isUserAdmin = isAdmin(userId);
        
        // 기본 메뉴 순서 또는 사용자 설정
        let menuOrder = user?.menuSettings?.menuOrder || [
            'daily', 'work', 'quest', 
            'hunting', 'racing', 'pvp', 'mushroom', 'oddeven',
            'stats', 'skills', 'equipment', 'enhancement',
            'shop', 'inventory', 'stocks', 'artifacts', 'auction',
            'ranking', 'profile'
        ];
        const hiddenMenus = user?.menuSettings?.hiddenMenus || [];
        const favoriteMenus = user?.menuSettings?.favoriteMenus || [];
        
        // 숨겨진 메뉴 제외
        menuOrder = menuOrder.filter(menuId => !hiddenMenus.includes(menuId));
        
        // 즐겨찾기 메뉴를 맨 앞으로
        const nonFavorites = menuOrder.filter(menuId => !favoriteMenus.includes(menuId));
        const orderedFavorites = favoriteMenus.filter(menuId => menuOrder.includes(menuId));
        menuOrder = [...orderedFavorites, ...nonFavorites];
        
        // 메뉴 옵션 생성
        const menuOptions = [];
        
        for (const menuId of menuOrder) {
            const menuDef = MENU_DEFINITIONS[menuId];
            if (menuDef) {
                const isFavorite = favoriteMenus.includes(menuId);
                menuOptions.push({
                    label: `${isFavorite ? '⭐ ' : ''}${menuDef.label}`,
                    description: menuDef.description,
                    value: menuId,
                    emoji: menuDef.emoji
                });
            }
        }
        
        // 관리자라면 관리자 메뉴 추가
        if (isUserAdmin) {
            menuOptions.push({
                label: '🛠️ 관리자 패널',
                description: '서버 관리 및 시스템 제어',
                value: 'admin_panel',
                emoji: '🛠️'
            });
        }
        
        // 설정 메뉴는 항상 마지막에
        if (!hiddenMenus.includes('settings')) {
            menuOptions.push({
                label: '⚙️ 설정',
                description: '메뉴 커스터마이징 및 설정',
                value: 'settings',
                emoji: '⚙️'
            });
        }
        
        return new StringSelectMenuBuilder()
            .setCustomId('main_menu')
            .setPlaceholder('✨ 김헌터 월드에 오신 것을 환영합니다!')
            .addOptions(menuOptions.slice(0, 25)); // Discord 제한: 최대 25개
            
    } catch (error) {
        console.error('메뉴 생성 오류:', error);
        // 기본 메뉴 반환
        return createDefaultMenu();
    }
}

// 기본 메뉴 생성
function createDefaultMenu() {
    const defaultOptions = [
        {
            label: '🎯 사냥하기',
            description: '몬스터를 사냥하여 경험치와 골드 획득',
            value: 'hunting',
            emoji: '🎯'
        },
        {
            label: '⚔️ 장비관리',
            description: '장비 착용, 강화 및 관리',
            value: 'equipment',
            emoji: '⚔️'
        },
        {
            label: '🛒 상점',
            description: '아이템 구매 및 판매',
            value: 'shop',
            emoji: '🛒'
        },
        {
            label: '📈 주식거래소',
            description: '환상 지역 기업 주식 거래',
            value: 'stocks',
            emoji: '📈'
        }
    ];
    
    return new StringSelectMenuBuilder()
        .setCustomId('main_menu')
        .setPlaceholder('✨ 김헌터 월드에 오신 것을 환영합니다!')
        .addOptions(defaultOptions);
}

// 메뉴 커스터마이징 드롭다운 생성
function createMenuCustomizer() {
    return new StringSelectMenuBuilder()
        .setCustomId('customize_menu')
        .setPlaceholder('⚙️ 메뉴 커스터마이징')
        .addOptions([
            {
                label: '📋 메뉴 순서 변경',
                description: '자주 사용하는 메뉴를 위로 배치하세요',
                value: 'reorder_menu',
                emoji: '📋'
            },
            {
                label: '⭐ 즐겨찾기 설정',
                description: '자주 사용하는 메뉴를 즐겨찾기에 추가',
                value: 'favorite_menu',
                emoji: '⭐'
            },
            {
                label: '👁️ 메뉴 숨기기/보이기',
                description: '사용하지 않는 메뉴를 숨기세요',
                value: 'toggle_menu',
                emoji: '👁️'
            },
            {
                label: '🎨 메뉴 스타일 변경',
                description: '메뉴 표시 방식을 변경하세요',
                value: 'menu_style',
                emoji: '🎨'
            },
            {
                label: '🔄 기본값으로 초기화',
                description: '모든 설정을 초기 상태로 되돌립니다',
                value: 'reset_menu',
                emoji: '🔄'
            }
        ]);
}

// 관리자 패널 메뉴 생성
function createAdminPanel() {
    return new StringSelectMenuBuilder()
        .setCustomId('admin_panel')
        .setPlaceholder('🛠️ 관리자 패널 - 신중하게 사용하세요')
        .addOptions([
            {
                label: '👥 사용자 관리',
                description: '사용자 정보 조회 및 수정',
                value: 'admin_users',
                emoji: '👥'
            },
            {
                label: '💰 경제 관리',
                description: '골드, 아이템 지급 및 시장 조작',
                value: 'admin_economy',
                emoji: '💰'
            },
            {
                label: '📊 서버 통계',
                description: '서버 사용 통계 및 성능 모니터링',
                value: 'admin_stats',
                emoji: '📊'
            },
            {
                label: '🎮 게임 시스템',
                description: '게임 밸런스 및 이벤트 관리',
                value: 'admin_game',
                emoji: '🎮'
            },
            {
                label: '📈 주식 시장 관리',
                description: '주식 가격 조작 및 시장 이벤트',
                value: 'admin_stocks',
                emoji: '📈'
            },
            {
                label: '🗄️ 데이터베이스',
                description: '데이터베이스 백업 및 정리',
                value: 'admin_database',
                emoji: '🗄️'
            },
            {
                label: '🔧 시스템 제어',
                description: '봇 재시작, 공지사항 등',
                value: 'admin_system',
                emoji: '🔧'
            },
            {
                label: '🚨 긴급 상황',
                description: '긴급 상황 대응 도구',
                value: 'admin_emergency',
                emoji: '🚨'
            }
        ]);
}

// 사용자 관리 메뉴
function createUserManagementMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId('admin_user_management')
        .setPlaceholder('👥 사용자 관리')
        .addOptions([
            {
                label: '🔍 사용자 검색',
                description: '특정 사용자 정보 조회',
                value: 'search_user',
                emoji: '🔍'
            },
            {
                label: '💎 골드 지급/차감',
                description: '사용자에게 골드 지급 또는 차감',
                value: 'modify_gold',
                emoji: '💎'
            },
            {
                label: '🎒 아이템 지급',
                description: '사용자에게 아이템 지급',
                value: 'give_item',
                emoji: '🎒'
            },
            {
                label: '📊 레벨/경험치 수정',
                description: '사용자 레벨 및 경험치 조정',
                value: 'modify_level',
                emoji: '📊'
            },
            {
                label: '🔒 계정 관리',
                description: '계정 차단/해제 등',
                value: 'account_management',
                emoji: '🔒'
            },
            {
                label: '📈 사용자 통계',
                description: '전체 사용자 통계 조회',
                value: 'user_statistics',
                emoji: '📈'
            }
        ]);
}

// 경제 관리 메뉴
function createEconomyManagementMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId('admin_economy_management')
        .setPlaceholder('💰 경제 관리')
        .addOptions([
            {
                label: '📈 주식 가격 조작',
                description: '특정 주식의 가격 직접 조정',
                value: 'manipulate_stocks',
                emoji: '📈'
            },
            {
                label: '🏺 유물 시장 조작',
                description: '유물 시장 가치 조정',
                value: 'manipulate_artifacts',
                emoji: '🏺'
            },
            {
                label: '🛒 상점 관리',
                description: '상점 아이템 및 가격 관리',
                value: 'manage_shop',
                emoji: '🛒'
            },
            {
                label: '🎁 전체 골드 지급',
                description: '모든 사용자에게 골드 지급',
                value: 'global_gold_distribution',
                emoji: '🎁'
            },
            {
                label: '📊 경제 통계',
                description: '전체 경제 상황 분석',
                value: 'economy_statistics',
                emoji: '📊'
            },
            {
                label: '⚖️ 인플레이션 제어',
                description: '경제 밸런스 조정 도구',
                value: 'inflation_control',
                emoji: '⚖️'
            }
        ]);
}

// 시스템 제어 메뉴
function createSystemControlMenu() {
    return new StringSelectMenuBuilder()
        .setCustomId('admin_system_control')
        .setPlaceholder('🔧 시스템 제어')
        .addOptions([
            {
                label: '📢 공지사항 발송',
                description: '전체 서버에 공지사항 발송',
                value: 'send_announcement',
                emoji: '📢'
            },
            {
                label: '🔄 봇 재시작',
                description: '봇을 안전하게 재시작',
                value: 'restart_bot',
                emoji: '🔄'
            },
            {
                label: '💾 데이터 저장',
                description: '현재 게임 데이터 강제 저장',
                value: 'force_save',
                emoji: '💾'
            },
            {
                label: '🧹 캐시 정리',
                description: '메모리 캐시 정리',
                value: 'clear_cache',
                emoji: '🧹'
            },
            {
                label: '📊 시스템 상태',
                description: '서버 및 봇 상태 확인',
                value: 'system_status',
                emoji: '📊'
            },
            {
                label: '🎪 이벤트 생성',
                description: '특별 이벤트 생성 및 관리',
                value: 'create_event',
                emoji: '🎪'
            }
        ]);
}

const Jimp = require('jimp');
const GifEncoder = require('gif-encoder-2');


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
// global.playerPortfolios = new Map(); // 더 이상 사용하지 않음 - 데이터베이스 사용

// 🚀 혁신적인 주식 시스템 핵심 함수들

// 모든 회사 주식 가격 업데이트 함수
function updateStockPrices() {
    try {
        // 시간대별 효과 적용
        const hour = new Date().getHours();
        applyTimeBasedEffects(hour);
        
        // NPC 감정 변화 적용
        updateNPCEmotions();
        
        // 랜덤 이벤트 발생 확인
        checkRandomEvents();
        
        // 기본 시장 변동성 적용
        applyBaseVolatility();
    } catch (error) {
        console.error('주식 가격 업데이트 오류:', error);
    }
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
        adjustStockPrice('traveler_inn', 0.25);
        adjustStockPrice('cotton_candy', 0.15);
    }
    
    if (emotions.merchants.greed > 80) {
        adjustStockPrice('weapon_store', 0.4);
        adjustStockPrice('potion_shop', 0.3);
    }
}

// 시간대별 효과 적용
function applyTimeBasedEffects(hour) {
    if (hour >= 2 && hour <= 6) {
        // 새벽 시간 - 야행성 서비스 상승
        adjustStockPrice('potion_shop', 0.15);
        adjustStockPrice('angel_medical', 0.1);
    } else if (hour >= 12 && hour <= 14) {
        // 점심 시간 - 음식 관련 상승
        adjustStockPrice('cotton_candy', 0.2);
        adjustStockPrice('traveler_inn', 0.15);
    } else if (hour >= 18 && hour <= 22) {
        // 저녁 시간 - 엔터테인먼트 상승
        adjustStockPrice('fantasy_entertainment', 0.25);
        adjustStockPrice('dream_healing', 0.15);
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
        adjustStockPrice('dream_healing', 0.4);
        adjustStockPrice('angel_medical', 0.25);
    }
    
    STOCK_MARKET.market_state.player_actions.total_enhancement_attempts++;
}

// 플레이어 행동 기록 함수
function recordPlayerAction(actionType, details = {}) {
    const actions = STOCK_MARKET.market_state.player_actions;
    
    switch(actionType) {
        case 'shop_purchase':
            actions.shop_purchases++;
            adjustStockPrice('general_store', 0.05);
            break;
        case 'hunt_start':
            actions.hunt_sessions++;
            adjustStockPrice('weapon_store', 0.1);
            adjustStockPrice('potion_shop', 0.1);
            break;
        case 'legendary_craft':
            actions.legendary_crafts++;
            adjustStockPrice('creation_tech', 1);
            break;
        case 'racing_event':
            // 레이싱 이벤트가 주식 시장에 미치는 영향
            if (details.potSize > 30000) {
                adjustStockPrice('fantasy_entertainment', 0.75); // 엔터테인먼트
                adjustStockPrice('traveler_inn', 0.5);           // 여관업
            }
            if (details.participants >= 6) {
                adjustStockPrice('aurora_tourism', 0.4); // 관광업
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

// 기본 시장 변동성 적용 (밸런스 조정)
function applyBaseVolatility() {
    const volatility = STOCK_MARKET.market_state.volatility;
    
    // 모든 주식에 기본 랜덤 변동 적용 (변동폭 대폭 축소)
    for (const region of Object.values(STOCK_MARKET.regions)) {
        region.companies.forEach(company => {
            // 기존 volatility / 10에서 volatility / 200으로 변경 (20배 감소)
            const randomChange = (Math.random() - 0.5) * (volatility / 200);
            adjustStockPrice(company.id, randomChange);
        });
    }
    
    STOCK_MARKET.chains.forEach(company => {
        // 기존 volatility / 10에서 volatility / 200으로 변경 (20배 감소)
        const randomChange = (Math.random() - 0.5) * (volatility / 200);
        adjustStockPrice(company.id, randomChange);
    });
}

// 포트폴리오 관리 함수들
async function getPlayerPortfolio(userId) {
    try {
        // 실제 유저 데이터에서 골드와 주식 포트폴리오를 가져오기
        const user = await User.findOne({ discordId: userId }).select('gold stockPortfolio');
        const userGold = user ? user.gold : 0;
        
        // 데이터베이스에서 주식 포트폴리오 로드
        const portfolio = {
            cash: userGold,
            stocks: new Map(),
            totalValue: userGold
        };
        
        if (user && user.stockPortfolio && user.stockPortfolio.stocks) {
            // Map 데이터를 복원
            for (const [companyId, stockData] of user.stockPortfolio.stocks) {
                portfolio.stocks.set(companyId, {
                    shares: stockData.shares,
                    avgPrice: stockData.avgPrice
                });
            }
        }
        
        return portfolio;
    } catch (error) {
        console.error('포트폴리오 로드 오류:', error);
        // 기본 포트폴리오 반환
        return {
            cash: 0,
            stocks: new Map(),
            totalValue: 0
        };
    }
}

async function buyStock(userId, companyId, shares) {
    const portfolio = await getPlayerPortfolio(userId);
    const company = findCompany(companyId);
    
    if (!company) return { success: false, message: '존재하지 않는 기업입니다!' };
    
    const totalCost = company.price * shares;
    if (portfolio.cash < totalCost) {
        return { success: false, message: '자금이 부족합니다!' };
    }
    
    // 실제 유저 골드 차감 및 포트폴리오 업데이트 (원자적 업데이트)
    const updateResult = await User.updateOne(
        { 
            discordId: userId, 
            gold: { $gte: totalCost } // 충분한 골드가 있는 경우만 업데이트
        },
        {
            $inc: { 
                gold: -totalCost,
                'stockPortfolio.totalInvested': totalCost
            },
            $set: { 'stockPortfolio.lastUpdate': new Date() }
        }
    );
    
    if (updateResult.matchedCount === 0) {
        return { success: false, message: '자금이 부족합니다!' };
    }
    
    // 주식 보유량 업데이트
    const user = await User.findOne({ discordId: userId });
    if (!user.stockPortfolio) {
        user.stockPortfolio = { stocks: new Map(), totalInvested: 0, lastUpdate: new Date() };
    }
    
    const currentStock = user.stockPortfolio.stocks.get(companyId);
    if (currentStock) {
        // 기존 주식이 있으면 평균가 계산
        const newAvgPrice = (currentStock.avgPrice * currentStock.shares + totalCost) / (currentStock.shares + shares);
        user.stockPortfolio.stocks.set(companyId, {
            shares: currentStock.shares + shares,
            avgPrice: newAvgPrice
        });
    } else {
        // 새로운 주식
        user.stockPortfolio.stocks.set(companyId, {
            shares: shares,
            avgPrice: company.price
        });
    }
    
    await user.save();
    
    // 거래량 증가
    company.volume += shares;
    
    return { success: true, message: `${company.name} ${shares}주를 ${totalCost.toLocaleString()}골드에 매수했습니다!` };
}

async function sellStock(userId, companyId, shares) {
    const portfolio = await getPlayerPortfolio(userId);
    const company = findCompany(companyId);
    
    if (!company) return { success: false, message: '존재하지 않는 기업입니다!' };
    if (!portfolio.stocks.has(companyId)) return { success: false, message: '보유하지 않은 주식입니다!' };
    
    const holding = portfolio.stocks.get(companyId);
    if (holding.shares < shares) return { success: false, message: '보유 수량이 부족합니다!' };
    
    // 매도 실행
    const totalValue = company.price * shares;
    
    // 실제 유저 골드 증가 (원자적 업데이트)
    await User.updateOne(
        { discordId: userId },
        { $inc: { gold: totalValue } }
    );
    
    // 데이터베이스에서 주식 보유량 업데이트
    const user = await User.findOne({ discordId: userId });
    const currentStock = user.stockPortfolio.stocks.get(companyId);
    
    if (currentStock.shares <= shares) {
        // 모든 주식을 매도하는 경우
        user.stockPortfolio.stocks.delete(companyId);
    } else {
        // 일부만 매도하는 경우
        user.stockPortfolio.stocks.set(companyId, {
            shares: currentStock.shares - shares,
            avgPrice: currentStock.avgPrice // 평균가는 그대로 유지
        });
    }
    
    user.stockPortfolio.lastUpdate = new Date();
    await user.save();
    
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
    const chainCompany = STOCK_MARKET.chains.find(c => c.id === companyId);
    if (chainCompany) return chainCompany;
    
    // 유물탐사회사들 검색
    return STOCK_MARKET.exploration_companies.find(c => c.id === companyId);
}

// 🏺 유물탐사 시스템 함수들

// 유물탐사 메인 메뉴 표시
async function showArtifactExplorationMenu(interaction, user) {
    try {
        const stats = user.explorationStats || {
            totalExplorations: 0,
            totalInvested: 0,
            totalEarned: 0,
            successfulFinds: 0,
            rareFinds: 0
        };
        
        const profitLoss = stats.totalEarned - stats.totalInvested;
        const successRate = stats.totalExplorations > 0 ? 
            ((stats.successfulFinds / stats.totalExplorations) * 100).toFixed(1) : 0;
            
        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🏺 김헌터 유물탐사 센터')
            .setDescription(`**신비한 고대 유물을 찾아 떠나는 모험!**\n\n고대 문명의 보물이 당신을 기다리고 있습니다.\n각 지역의 전문 탐사회사와 함께 위험하지만 수익성 높은 모험을 시작하세요!`)
            .addFields(
                { name: '📊 탐사 통계', value: `총 탐사: ${stats.totalExplorations}회\n성공률: ${successRate}%\n희귀 발견: ${stats.rareFinds}개`, inline: true },
                { name: '💰 수익 현황', value: `투자: ${stats.totalInvested.toLocaleString()}G\n수익: ${stats.totalEarned.toLocaleString()}G\n순익: ${profitLoss >= 0 ? '+' : ''}${profitLoss.toLocaleString()}G`, inline: true },
                { name: '🎒 현재 상태', value: `보유 골드: ${user.gold.toLocaleString()}G\n유물 보관: ${user.artifacts ? user.artifacts.length : 0}개\n레벨: ${user.level}`, inline: true }
            )
            .setFooter({ text: '⚠️ 유물탐사는 고위험 고수익 투자입니다! 신중하게 선택하세요.' });

        const menuButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artifact_direct_explore')
                    .setLabel('⛏️ 직접 탐사')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('artifact_companies')
                    .setLabel('🏢 탐사회사 투자')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('artifact_inventory')
                    .setLabel('🎒 유물 보관함')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('artifact_shop')
                    .setLabel('🏪 유물 상점')
                    .setStyle(ButtonStyle.Success)
            );

        const extraButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artifact_rankings')
                    .setLabel('🏆 탐사가 랭킹')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('artifact_guide')
                    .setLabel('📖 탐사 가이드')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [menuButtons, extraButtons],
            flags: 64
        });
        
    } catch (error) {
        console.error('유물탐사 메뉴 표시 오류:', error);
        await interaction.reply({ content: '❌ 메뉴 로드 중 오류가 발생했습니다!', flags: 64 });
    }
}

// 직접 탐사 메뉴
async function showDirectExplorationMenu(interaction, user) {
    try {
        const companies = ARTIFACT_SYSTEM.companies;
        
        let companyList = '';
        for (const [id, company] of Object.entries(companies)) {
            const costs = ARTIFACT_SYSTEM.explorationCosts[company.specialty];
            companyList += `${company.emoji} **${company.name}**\n`;
            companyList += `   지역: ${company.region}\n`;
            companyList += `   성공률: ${(company.successRate * 100).toFixed(1)}%\n`;
            companyList += `   비용: ${costs.min.toLocaleString()} ~ ${costs.max.toLocaleString()}G\n\n`;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('⛏️ 직접 유물 탐사')
            .setDescription('탐사회사를 선택하여 직접 유물을 찾아보세요!\n각 지역마다 특별한 유물과 위험이 기다리고 있습니다.')
            .addFields(
                { name: '🗺️ 탐사 지역 & 회사', value: companyList, inline: false },
                { name: '💡 탐사 팁', value: '• 성공률이 높을수록 안전하지만 수익률은 낮습니다\n• 위험한 지역일수록 레어 유물 확률이 높습니다\n• 투자 금액이 클수록 더 좋은 유물을 찾을 수 있습니다', inline: false }
            );

        const companyButtons = new ActionRowBuilder();
        let buttonCount = 0;
        for (const [id, company] of Object.entries(companies)) {
            if (buttonCount < 5) {
                companyButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`explore_${id}`)
                        .setLabel(`${company.emoji} ${company.name}`)
                        .setStyle(ButtonStyle.Primary)
                );
                buttonCount++;
            }
        }

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artifact_main_menu')
                    .setLabel('🔙 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [companyButtons, backButton]
        });
        
    } catch (error) {
        console.error('직접 탐사 메뉴 오류:', error);
        await interaction.followUp({ content: '❌ 탐사 메뉴 로드 중 오류가 발생했습니다!', flags: 64 });
    }
}

// 유물 발굴 실행
async function executeExploration(interaction, user, companyId, investmentAmount) {
    try {
        const company = ARTIFACT_SYSTEM.companies[companyId];
        if (!company) {
            await interaction.editReply({ content: '❌ 존재하지 않는 탐사회사입니다!' });
            return;
        }
        
        // 골드 확인
        if (user.gold < investmentAmount) {
            await interaction.editReply({ content: '❌ 골드가 부족합니다!' });
            return;
        }
        
        // 골드 차감
        await User.updateOne(
            { discordId: interaction.user.id },
            { 
                $inc: { 
                    gold: -investmentAmount,
                    'explorationStats.totalExplorations': 1,
                    'explorationStats.totalInvested': investmentAmount
                },
                $set: { 'explorationStats.lastExploration': new Date() }
            }
        );
        
        // 탐사 결과 계산
        const result = calculateExplorationResult(company, investmentAmount);
        
        // 결과에 따른 처리
        let embed;
        
        if (result.success) {
            // 성공 - 유물 발견
            const artifact = result.artifact;
            
            // 유물을 인벤토리에 추가
            await User.updateOne(
                { discordId: interaction.user.id },
                { 
                    $push: { 
                        artifacts: {
                            name: artifact.name,
                            emoji: artifact.emoji,
                            rarity: result.rarity,
                            value: artifact.value,
                            description: artifact.description,
                            foundDate: new Date(),
                            company: company.name,
                            region: company.region
                        }
                    },
                    $inc: { 
                        'explorationStats.successfulFinds': 1,
                        'explorationStats.biggestFind': artifact.value > (user.explorationStats?.biggestFind || 0) ? artifact.value - (user.explorationStats?.biggestFind || 0) : 0
                    }
                }
            );
            
            if (result.rarity !== 'common') {
                await User.updateOne(
                    { discordId: interaction.user.id },
                    { $inc: { 'explorationStats.rareFinds': 1 } }
                );
            }
            
            // 주식 가격에 영향
            updateExplorationCompanyStock(companyId, true, result.rarity);
            
            embed = new EmbedBuilder()
                .setColor(getRarityColor(result.rarity))
                .setTitle('🎉 유물 발견 성공!')
                .setDescription(result.story)
                .addFields(
                    { name: `${artifact.emoji} 발견한 유물`, value: `**${artifact.name}**\n${artifact.description}`, inline: false },
                    { name: '💎 등급', value: getRarityText(result.rarity), inline: true },
                    { name: '💰 추정 가치', value: `${artifact.value.toLocaleString()}G`, inline: true },
                    { name: '📍 발견 지역', value: `${company.emoji} ${company.region}`, inline: true }
                )
                .setFooter({ text: '유물을 상점에 판매하거나 보관할 수 있습니다!' });
                
        } else {
            // 실패
            updateExplorationCompanyStock(companyId, false);
            
            embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('💸 탐사 실패...')
                .setDescription(result.story)
                .addFields(
                    { name: '💔 결과', value: `${result.failure.emoji} ${result.failure.name}\n${result.failure.description}`, inline: false },
                    { name: '📉 손실', value: `${investmentAmount.toLocaleString()}G`, inline: true },
                    { name: '📍 탐사 지역', value: `${company.emoji} ${company.region}`, inline: true }
                )
                .setFooter({ text: '다음 탐사에서는 더 좋은 결과가 있기를!' });
        }
        
        const retryButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artifact_direct_explore')
                    .setLabel('🔄 다시 탐사')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('artifact_inventory')
                    .setLabel('🎒 유물 보관함')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('artifact_main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        await interaction.editReply({
            embeds: [embed],
            components: [retryButton]
        });
        
    } catch (error) {
        console.error('유물 탐사 실행 오류:', error);
        await interaction.editReply({ content: '❌ 탐사 실행 중 오류가 발생했습니다!' });
    }
}

// 탐사 결과 계산
function calculateExplorationResult(company, investment) {
    const baseSuccessRate = company.successRate;
    
    // 투자 금액에 따른 성공률 보너스 (최대 +20%)
    const costs = ARTIFACT_SYSTEM.explorationCosts[company.specialty];
    const investmentRatio = (investment - costs.min) / (costs.max - costs.min);
    const investmentBonus = Math.min(0.2, investmentRatio * 0.2);
    
    const finalSuccessRate = baseSuccessRate + investmentBonus;
    const random = Math.random();
    
    if (random <= finalSuccessRate) {
        // 성공 - 유물 발견
        const rarityRoll = Math.random();
        let rarity, artifacts;
        
        if (rarityRoll <= 0.02) { // 2% 레전드리
            rarity = 'legendary';
            artifacts = ARTIFACT_SYSTEM.artifacts.legendary;
        } else if (rarityRoll <= 0.10) { // 8% 에픽
            rarity = 'epic';
            artifacts = ARTIFACT_SYSTEM.artifacts.epic;
        } else if (rarityRoll <= 0.30) { // 20% 레어
            rarity = 'rare';
            artifacts = ARTIFACT_SYSTEM.artifacts.rare;
        } else { // 70% 커먼
            rarity = 'common';
            artifacts = ARTIFACT_SYSTEM.artifacts.common;
        }
        
        // 특화 유물 확인
        const specialArtifacts = ARTIFACT_SYSTEM.specialArtifacts[company.specialty];
        if (specialArtifacts && Math.random() <= 0.05) { // 5% 확률로 특화 유물
            const specialArtifact = specialArtifacts[Math.floor(Math.random() * specialArtifacts.length)];
            artifacts = [specialArtifact];
            rarity = specialArtifact.rarity;
        }
        
        const artifact = artifacts[Math.floor(Math.random() * artifacts.length)];
        const value = Array.isArray(artifact.value) ? 
            Math.floor(Math.random() * (artifact.value[1] - artifact.value[0] + 1)) + artifact.value[0] :
            artifact.value;
            
        // 투자 금액에 따른 가치 보너스
        const valueMultiplier = 1 + (investmentRatio * 0.5); // 최대 50% 보너스
        const finalValue = Math.floor(value * valueMultiplier);
        
        const story = ARTIFACT_SYSTEM.stories.success[rarity][
            Math.floor(Math.random() * ARTIFACT_SYSTEM.stories.success[rarity].length)
        ];
        
        return {
            success: true,
            rarity: rarity,
            artifact: {
                ...artifact,
                value: finalValue
            },
            story: story
        };
    } else {
        // 실패
        const failure = ARTIFACT_SYSTEM.failures[Math.floor(Math.random() * ARTIFACT_SYSTEM.failures.length)];
        const story = ARTIFACT_SYSTEM.stories.failure[Math.floor(Math.random() * ARTIFACT_SYSTEM.stories.failure.length)];
        
        return {
            success: false,
            failure: failure,
            story: story
        };
    }
}

// 등급별 색상
function getRarityColor(rarity) {
    switch (rarity) {
        case 'common': return '#95a5a6';
        case 'rare': return '#3498db';
        case 'epic': return '#9b59b6';
        case 'legendary': return '#f1c40f';
        default: return '#95a5a6';
    }
}

// 등급별 텍스트
function getRarityText(rarity) {
    switch (rarity) {
        case 'common': return '🤍 일반';
        case 'rare': return '💙 희귀';
        case 'epic': return '💜 에픽';
        case 'legendary': return '💛 전설';
        default: return '🤍 일반';
    }
}

// 탐사회사 주식 가격 업데이트
function updateExplorationCompanyStock(companyId, success, rarity = 'common') {
    const companies = STOCK_MARKET.exploration_companies;
    const company = companies.find(c => c.id === companyId);
    
    if (company) {
        let priceChange = 0;
        
        if (success) {
            switch (rarity) {
                case 'common': priceChange = 0.05; break;
                case 'rare': priceChange = 0.15; break;
                case 'epic': priceChange = 0.4; break;
                case 'legendary': priceChange = 0.75; break;
            }
        } else {
            priceChange = -0.1; // 실패 시 주가 하락
        }
        
        adjustStockPrice(companyId, priceChange);
    }
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
intervals.push(setInterval(() => {
    updateStockPrices();
    updateChartData();
}, 5 * 60 * 1000));

// 초기 차트 데이터 생성
updateChartData();

// 임시: 차트 데이터 빠르게 채우기 (개발용) - 메모리 최적화
function fillChartDataForDevelopment() {
    console.log('차트 데이터 초기화 중...');
    // 최근 60분 데이터를 시뮬레이션 (5분 간격으로 12개)
    for (let i = 0; i < 12; i++) {
        updateStockPrices();
        updateChartData();
    }
    console.log('차트 데이터 초기화 완료!');
    console.log('타임스탬프:', STOCK_MARKET.chart_history.timestamps.length);
    console.log('시장 지수:', STOCK_MARKET.chart_history.market_index.length);
}

// 봇 시작시 차트 데이터 채우기
setTimeout(() => {
    fillChartDataForDevelopment();
}, 2000);

// 유물 시세 시스템
const artifactMarket = {
    priceHistory: new Map(), // 유물별 가격 기록
    currentEvent: null,
    lastUpdate: Date.now()
};

// 유물 시세 업데이트 함수
function updateArtifactPrices() {
    const now = Date.now();
    const hour = new Date().getHours();
    
    // 시간대별 보정값 적용
    let timeMultiplier = 1.0;
    if (hour >= 6 && hour < 12) {
        timeMultiplier = ARTIFACT_SYSTEM.marketSystem.timeMultiplier.morning;
    } else if (hour >= 12 && hour < 18) {
        timeMultiplier = ARTIFACT_SYSTEM.marketSystem.timeMultiplier.afternoon;
    } else if (hour >= 18 && hour < 24) {
        timeMultiplier = ARTIFACT_SYSTEM.marketSystem.timeMultiplier.evening;
    } else {
        timeMultiplier = ARTIFACT_SYSTEM.marketSystem.timeMultiplier.night;
    }
    
    // 시장 이벤트 확인
    if (!artifactMarket.currentEvent || now - artifactMarket.currentEvent.startTime > artifactMarket.currentEvent.duration) {
        // 새로운 이벤트 발생 (10% 확률)
        if (Math.random() < 0.1) {
            const events = ARTIFACT_SYSTEM.marketSystem.marketFactors;
            artifactMarket.currentEvent = {
                ...events[Math.floor(Math.random() * events.length)],
                startTime: now
            };
            console.log(`유물 시장 이벤트 발생: ${artifactMarket.currentEvent.name}`);
        } else {
            artifactMarket.currentEvent = null;
        }
    }
    
    // 모든 유물 종류에 대해 시세 업데이트
    const allArtifacts = [
        ...ARTIFACT_SYSTEM.artifacts.common,
        ...ARTIFACT_SYSTEM.artifacts.rare,
        ...ARTIFACT_SYSTEM.artifacts.epic,
        ...ARTIFACT_SYSTEM.artifacts.legendary
    ];
    
    allArtifacts.forEach(artifact => {
        if (!artifactMarket.priceHistory.has(artifact.name)) {
            artifactMarket.priceHistory.set(artifact.name, {
                prices: [],
                currentPrice: (artifact.value[0] + artifact.value[1]) / 2
            });
        }
        
        const history = artifactMarket.priceHistory.get(artifact.name);
        const rarity = getRarityByArtifact(artifact.name);
        const volatility = ARTIFACT_SYSTEM.marketSystem.volatility[rarity] || 0.15;
        
        // 가격 변동 계산
        let priceChange = (Math.random() - 0.5) * 2 * volatility;
        priceChange *= timeMultiplier;
        
        // 이벤트 적용
        if (artifactMarket.currentEvent) {
            priceChange *= artifactMarket.currentEvent.effect;
        }
        
        // 새 가격 계산 (최소/최대값 제한)
        let newPrice = history.currentPrice * (1 + priceChange);
        newPrice = Math.max(artifact.value[0] * 0.5, Math.min(artifact.value[1] * 2, newPrice));
        
        history.currentPrice = Math.round(newPrice);
        history.prices.push({
            price: history.currentPrice,
            timestamp: now
        });
        
        // 최대 50개 기록 유지
        if (history.prices.length > 50) {
            history.prices = history.prices.slice(-50);
        }
    });
    
    artifactMarket.lastUpdate = now;
}

// 유물 등급 확인 함수
function getRarityByArtifact(artifactName) {
    if (ARTIFACT_SYSTEM.artifacts.common.some(a => a.name === artifactName)) return 'common';
    if (ARTIFACT_SYSTEM.artifacts.rare.some(a => a.name === artifactName)) return 'rare';
    if (ARTIFACT_SYSTEM.artifacts.epic.some(a => a.name === artifactName)) return 'epic';
    if (ARTIFACT_SYSTEM.artifacts.legendary.some(a => a.name === artifactName)) return 'legendary';
    return 'common';
}


// 유물 시세 정기 업데이트 (10분마다)
intervals.push(setInterval(() => {
    updateArtifactPrices();
}, 10 * 60 * 1000));

// 초기 유물 시세 설정
updateArtifactPrices();

// 운동하기 시스템 함수들
async function showExerciseMenu(interaction, user) {
    // 피로도 회복 계산
    const now = Date.now();
    const timeSinceRecovery = now - (user.fitness.lastRecovery || now);
    const hoursElapsed = timeSinceRecovery / (1000 * 60 * 60);
    const recoveryAmount = Math.floor(hoursElapsed * EXERCISE_SYSTEM.fatigue.recoveryRate);
    
    if (recoveryAmount > 0) {
        user.fitness.fatigue = Math.max(0, user.fitness.fatigue - recoveryAmount);
        user.fitness.lastRecovery = now;
        await user.save();
    }
    
    // 현재 운동 상태 확인
    let currentExerciseInfo = '';
    if (user.fitness.currentExercise.type) {
        const exercise = EXERCISE_SYSTEM.exercises[user.fitness.currentExercise.type];
        const elapsed = now - user.fitness.currentExercise.startTime;
        const remaining = user.fitness.currentExercise.duration - elapsed;
        
        if (remaining > 0) {
            const remainingMinutes = Math.ceil(remaining / 60000);
            currentExerciseInfo = `\n🏃 **진행중**: ${exercise.emoji} ${exercise.name} (${remainingMinutes}분 남음)`;
        } else {
            // 운동 완료 처리
            await completeExercise(user);
            currentExerciseInfo = '\n✅ 운동이 완료되었습니다! 보상을 확인하세요.';
        }
    }
    
    // 피트니스 레벨 확인
    const fitnessLevel = getFitnessLevel(user.fitness.level);
    
    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('🏃 운동하기')
        .setDescription(`**${user.nickname}**님의 피트니스 센터${currentExerciseInfo}`)
        .addFields(
            { 
                name: '💪 피트니스 레벨', 
                value: `${fitnessLevel.emoji} ${fitnessLevel.name} Lv.${user.fitness.level}`, 
                inline: true 
            },
            { 
                name: '💦 피로도', 
                value: `${user.fitness.fatigue}/100 ${getFatigueBar(user.fitness.fatigue)}`, 
                inline: true 
            },
            { 
                name: '🔥 연속 운동', 
                value: `${user.fitness.streak}일`, 
                inline: true 
            },
            {
                name: '📊 피트니스 스탯',
                value: `💪 근력: ${user.fitness.stats.strength} | 🏃 체력: ${user.fitness.stats.stamina}\n` +
                       `🤸 유연성: ${user.fitness.stats.flexibility} | ⚡ 민첩: ${user.fitness.stats.agility}\n` +
                       `🧠 정신력: ${user.fitness.stats.mental}`,
                inline: false
            }
        );
    
    // 운동 선택 버튼들
    const exerciseButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_select')
                .setLabel('🏃 운동 시작')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.fitness.fatigue >= EXERCISE_SYSTEM.fatigue.exerciseLimit || user.fitness.currentExercise.type !== null),
            new ButtonBuilder()
                .setCustomId('exercise_equipment')
                .setLabel('🎽 운동 장비')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_supplements')
                .setLabel('🥤 보충제')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_goals')
                .setLabel('🎯 목표')
                .setStyle(ButtonStyle.Success)
        );
    
    const extraButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_stats')
                .setLabel('📊 통계')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_ranking')
                .setLabel('🏆 랭킹')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_membership')
                .setLabel('💳 이용권')
                .setStyle(ButtonStyle.Success)
        );
    
    await interaction.update({
        embeds: [embed],
        components: [exerciseButtons, extraButtons]
    });
}

// 피트니스 레벨 확인
function getFitnessLevel(level) {
    let result = { name: '운동 초보자', emoji: '🌱' };
    
    for (const [minLevel, data] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
        if (level >= parseInt(minLevel)) {
            result = data;
        }
    }
    
    return result;
}

// 피로도 바 생성
function getFatigueBar(fatigue) {
    const barLength = 10;
    const filledLength = Math.round((fatigue / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    let bar = '';
    if (fatigue >= EXERCISE_SYSTEM.fatigue.exerciseLimit) {
        bar = '🔴'.repeat(filledLength);
    } else if (fatigue >= EXERCISE_SYSTEM.fatigue.warningLevel) {
        bar = '🟡'.repeat(filledLength);
    } else {
        bar = '🟢'.repeat(filledLength);
    }
    bar += '⚪'.repeat(emptyLength);
    
    return bar;
}

// 운동 완료 처리
async function completeExercise(user) {
    const exerciseType = user.fitness.currentExercise.type;
    if (!exerciseType) return;
    
    const exercise = EXERCISE_SYSTEM.exercises[exerciseType];
    const duration = Date.now() - user.fitness.currentExercise.startTime;
    const minutes = Math.floor(duration / 60000);
    
    // 장비 보너스 계산
    const clothesBonus = EXERCISE_SYSTEM.equipment.clothes[user.fitness.equipment.clothes].efficiency;
    const shoesBonus = EXERCISE_SYSTEM.equipment.shoes[user.fitness.equipment.shoes].speed;
    
    // 보충제 효과 확인
    let supplementBonus = 1.0;
    let fatigueReduction = 1.0;
    const now = Date.now();
    
    if (user.fitness.equipment.activeBooster.type && user.fitness.equipment.activeBooster.expiresAt > now) {
        const supplement = EXERCISE_SYSTEM.supplements[user.fitness.equipment.activeBooster.type];
        
        if (supplement.effect.strength && exercise.efficiency.strength > 0) {
            supplementBonus = supplement.effect.strength;
        } else if (supplement.effect.fatigueReduction) {
            fatigueReduction = supplement.effect.fatigueReduction;
        } else if (supplement.effect.allStats) {
            supplementBonus = supplement.effect.allStats;
        }
    }
    
    // 연속 운동 보너스
    let streakBonus = 1.0;
    for (const bonus of EXERCISE_SYSTEM.streakBonus) {
        if (user.fitness.streak >= bonus.days) {
            streakBonus = 1 + bonus.bonus;
        }
    }
    
    // 보상 계산 (보충제 보너스 적용)
    const goldReward = Math.floor(exercise.rewards.goldPerMinute * minutes * clothesBonus * streakBonus * supplementBonus);
    const expReward = Math.floor(exercise.rewards.expPerMinute * minutes * clothesBonus * streakBonus * supplementBonus);
    const fitnessExpReward = Math.floor(exercise.rewards.fitnessExpPerMinute * minutes * clothesBonus * shoesBonus * streakBonus * supplementBonus);
    
    // 스탯 증가 계산 (보충제 보너스 적용)
    const statGains = {};
    for (const [stat, efficiency] of Object.entries(exercise.efficiency)) {
        statGains[stat] = Math.floor(efficiency * minutes * 0.01 * clothesBonus * streakBonus * supplementBonus);
    }
    
    // 보상 적용
    user.gold += goldReward;
    user.exp += expReward;
    user.fitness.exp += fitnessExpReward;
    
    // 스탯 적용
    for (const [stat, gain] of Object.entries(statGains)) {
        if (gain > 0) {
            user.fitness.stats[stat] += gain;
        }
    }
    
    // 피트니스 레벨업 체크
    const requiredExp = getFitnessLevelRequirement(user.fitness.level + 1);
    if (user.fitness.exp >= requiredExp) {
        user.fitness.level += 1;
        user.fitness.exp = 0;
    }
    
    // 운동 기록 저장
    user.fitness.exerciseHistory.push({
        type: exerciseType,
        duration: duration,
        rewards: {
            gold: goldReward,
            exp: expReward,
            fitnessExp: fitnessExpReward
        },
        date: new Date()
    });
    
    // 운동 시간 누적
    user.fitness.totalExerciseTime += duration;
    
    // 일일 목표 체크
    const today = new Date().toDateString();
    if (user.fitness.goals.daily.lastReset !== today) {
        user.fitness.goals.daily.minutes30 = false;
        user.fitness.goals.daily.minutes60 = false;
        user.fitness.goals.daily.minutes180 = false;
        user.fitness.goals.daily.lastReset = today;
    }
    
    if (minutes >= 30) user.fitness.goals.daily.minutes30 = true;
    if (minutes >= 60) user.fitness.goals.daily.minutes60 = true;
    if (minutes >= 180) user.fitness.goals.daily.minutes180 = true;
    
    // 현재 운동 초기화
    user.fitness.currentExercise = {
        type: null,
        startTime: null,
        duration: 0,
        accumulated: 0
    };
    
    // 피로도 증가 (운동 완료시 나머지 피로도 적용)
    const remainingFatigue = Math.floor(exercise.fatigueRate * minutes * 0.5 * fatigueReduction);
    user.fitness.fatigue = Math.min(100, user.fitness.fatigue + remainingFatigue);
    
    await user.save();
}

// 피트니스 레벨 요구 경험치
function getFitnessLevelRequirement(level) {
    return level * level * 50; // 레벨^2 * 50
}

// 오늘 운동 시간 계산
function getTodayExerciseTime(user) {
    const today = new Date().toDateString();
    const todayStart = new Date(today).getTime();
    
    let totalTime = 0;
    user.fitness.exerciseHistory.forEach(record => {
        if (new Date(record.date).getTime() >= todayStart) {
            totalTime += record.duration;
        }
    });
    
    // 현재 진행 중인 운동도 포함
    if (user.fitness.currentExercise.type) {
        const elapsed = Date.now() - user.fitness.currentExercise.startTime;
        totalTime += Math.min(elapsed, user.fitness.currentExercise.duration);
    }
    
    return totalTime;
}

// 통합 랭킹 메뉴
async function showRankingMenu(interaction, page = 0) {
    const rankingCategories = [
        {
            id: 'level',
            name: '📈 레벨 랭킹',
            description: '최고 레벨 달성자'
        },
        {
            id: 'gold',
            name: '💰 부자 랭킹',
            description: '골드 보유량 TOP'
        },
        {
            id: 'hunting',
            name: '🎯 사냥 랭킹',
            description: '사냥 실력자들'
        },
        {
            id: 'enhancement',
            name: '⚔️ 강화 랭킹',
            description: '최고 강화 달성자'
        },
        {
            id: 'pvp',
            name: '🏆 PVP 랭킹',
            description: '최강의 결투가'
        },
        {
            id: 'racing',
            name: '🏁 레이싱 랭킹',
            description: '베팅의 달인'
        },
        {
            id: 'energy',
            name: '⚡ 에너지 랭킹',
            description: '에너지 조각 수집가'
        },
        {
            id: 'oddeven',
            name: '🎲 홀짝 랭킹',
            description: '홀짝게임 마스터'
        },
        {
            id: 'artifact',
            name: '🏺 유물 랭킹',
            description: '유물 탐사 전문가'
        },
        {
            id: 'fitness',
            name: '💪 운동 랭킹',
            description: '피트니스 마스터'
        },
        {
            id: 'popularity',
            name: '❤️ 인기 랭킹',
            description: '가장 인기있는 유저'
        },
        {
            id: 'attendance',
            name: '🔥 출석 랭킹',
            description: '꾸준한 출석왕'
        }
    ];
    
    const currentCategory = rankingCategories[page];
    if (!currentCategory) return;
    
    let rankingData = [];
    let fields = [];
    
    try {
        switch (currentCategory.id) {
            case 'level':
                rankingData = await User.find({ registered: true })
                    .sort({ level: -1, exp: -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　Lv.${user.level} (${user.exp.toLocaleString()} EXP)`;
                });
                break;
                
            case 'gold':
                rankingData = await User.find({ registered: true })
                    .sort({ gold: -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`;
                });
                break;
                
            case 'hunting':
                // 사냥 횟수 기준 (lastHunt 필드로 추정)
                rankingData = await User.find({ registered: true, level: { $gt: 1 } })
                    .sort({ level: -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　Lv.${user.level} 사냥꾼`;
                });
                break;
                
            case 'enhancement':
                rankingData = await User.find({ registered: true, 'enhanceStats.maxEnhanceLevel': { $gt: 0 } })
                    .sort({ 'enhanceStats.maxEnhanceLevel': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　최고 +${user.enhanceStats.maxEnhanceLevel}강`;
                });
                break;
                
            case 'pvp':
                rankingData = await User.find({ registered: true })
                    .sort({ 'pvp.rating': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    const winRate = user.pvp.totalDuels > 0 ? 
                        ((user.pvp.wins / user.pvp.totalDuels) * 100).toFixed(1) : 0;
                    return `${medal} **${user.nickname}**\n　　${user.pvp.rating}점 (승률 ${winRate}%)`;
                });
                break;
                
            case 'racing':
                rankingData = await User.find({ 'racingStats.wins': { $gt: 0 } })
                    .sort({ 'racingStats.wins': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　${user.racingStats.wins}회 우승`;
                });
                break;
                
            case 'energy':
                rankingData = await User.find({ 'energyFragments.highestLevel': { $gt: 0 } })
                    .sort({ 'energyFragments.highestLevel': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　최고 Lv.${user.energyFragments.highestLevel} 달성`;
                });
                break;
                
            case 'oddeven':
                rankingData = await User.find({ 'oddEvenStats.totalWinnings': { $gt: 0 } })
                    .sort({ 'oddEvenStats.totalWinnings': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    const winRate = user.oddEvenStats.totalGames > 0 ?
                        ((user.oddEvenStats.wins / user.oddEvenStats.totalGames) * 100).toFixed(1) : 0;
                    return `${medal} **${user.nickname}**\n　　총 ${user.oddEvenStats.totalWinnings.toLocaleString()}G 획득 (승률 ${winRate}%)`;
                });
                break;
                
            case 'artifact':
                rankingData = await User.find({ registered: true, 'explorationStats.totalEarned': { $gt: 0 } })
                    .sort({ 'explorationStats.totalEarned': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    const successRate = user.explorationStats.totalExplorations > 0 ? 
                        ((user.explorationStats.successfulFinds / user.explorationStats.totalExplorations) * 100).toFixed(1) : 0;
                    return `${medal} **${user.nickname}**\n　　${user.explorationStats.totalEarned.toLocaleString()}G 수익 (성공률 ${successRate}%)`;
                });
                break;
                
            case 'fitness':
                rankingData = await User.find({ 'fitness.level': { $gt: 1 } })
                    .sort({ 'fitness.level': -1, 'fitness.exp': -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    const hours = Math.floor(user.fitness.totalExerciseTime / 3600000);
                    return `${medal} **${user.nickname}**\n　　Lv.${user.fitness.level} (${hours}시간 운동)`;
                });
                break;
                
            case 'popularity':
                rankingData = await User.find({ registered: true })
                    .sort({ popularity: -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　인기도 ${user.popularity} ❤️`;
                });
                break;
                
            case 'attendance':
                rankingData = await User.find({ attendanceStreak: { $gt: 0 } })
                    .sort({ attendanceStreak: -1 })
                    .limit(10);
                    
                fields = rankingData.map((user, index) => {
                    const medal = getMedalEmoji(index);
                    return `${medal} **${user.nickname}**\n　　${user.attendanceStreak}일 연속 🔥`;
                });
                break;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 ${currentCategory.name}`)
            .setDescription(currentCategory.description)
            .addFields({
                name: `📊 TOP 10`,
                value: fields.length > 0 ? fields.join('\n\n') : '아직 랭킹 데이터가 없습니다.',
                inline: false
            })
            .setFooter({ 
                text: `페이지 ${page + 1}/${rankingCategories.length} • 매 시간 업데이트`,
                iconURL: interaction.client.user.displayAvatarURL()
            });
        
        const navButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`ranking_prev_${page}`)
                    .setEmoji('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`ranking_next_${page}`)
                    .setEmoji('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= rankingCategories.length - 1),
                new ButtonBuilder()
                    .setCustomId('ranking_select')
                    .setLabel('📋 카테고리 선택')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('back_to_game_menu')
                    .setLabel('🎮 게임 메뉴')
                    .setStyle(ButtonStyle.Success)
            );
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [navButtons] });
        } else {
            await interaction.update({ embeds: [embed], components: [navButtons] });
        }
        
    } catch (error) {
        console.error('랭킹 조회 오류:', error);
        await interaction.reply({ 
            content: '랭킹을 불러오는 중 오류가 발생했습니다.', 
            flags: 64 
        });
    }
}

// 메달 이모지 반환
function getMedalEmoji(index) {
    switch(index) {
        case 0: return '🥇';
        case 1: return '🥈';
        case 2: return '🥉';
        default: return `**${index + 1}.**`;
    }
}

// QuickChart API를 사용한 실제 차트 생성
async function generateRealChart(chartData, title, type = 'line') {
    try {
        if (!chartData || chartData.length < 2) {
            console.log('차트 데이터가 부족합니다:', chartData?.length || 0);
            return null;
        }
        
        // 데이터를 최대 25개로 제한 (더 자세한 차트)
        const limitedData = chartData.slice(-25);
        
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
                    },
                    legend: {
                        display: true
                    }
                },
                layout: {
                    padding: 20
                }
            }
        };
        
        // QuickChart URL 생성 (워터마크 제거)
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1000&height=500&format=png`;
        
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
        
        // 최근 20개 데이터 사용 (더 자세한 차트)
        const dataPoints = Math.min(20, chartHistory.timestamps.length);
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
                    },
                    legend: {
                        display: true
                    }
                },
                layout: {
                    padding: 20
                }
            }
        };
        
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1000&height=500&bkg=rgb(47,49,54)&format=png`;
        
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
            
            return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(simpleConfig))}&width=1000&height=500&format=png`;
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
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1000&height=500&backgroundColor=rgb(47,49,54)&format=png`;
    
    return chartUrl;
}

// 🏺 유물 시장 시스템
// 유물 시장 가치 업데이트 함수
function updateArtifactMarket() {
    try {
        const artifactMarket = STOCK_MARKET.artifact_market;
        const now = Date.now();
        
        // 5분마다 업데이트
        if (now - artifactMarket.last_update < 5 * 60 * 1000) return;
        
        // 시장 이벤트 체크
        checkArtifactMarketEvents();
        
        // 각 유물 가치 배율 업데이트
        for (const [artifactName, currentMultiplier] of Object.entries(artifactMarket.value_multipliers)) {
            // 기본 변동률 (-2% ~ +2%)
            const baseVariation = (Math.random() - 0.5) * 0.04;
            
            // 변동성에 따른 추가 변동
            const volatilityMultiplier = artifactMarket.volatility / 100;
            const volatilityVariation = (Math.random() - 0.5) * 0.02 * volatilityMultiplier;
            
            // 총 변동률
            const totalVariation = baseVariation + volatilityVariation;
            
            // 새 배율 계산 (0.5 ~ 2.0 범위로 제한)
            let newMultiplier = currentMultiplier * (1 + totalVariation);
            newMultiplier = Math.max(0.5, Math.min(2.0, newMultiplier));
            
            // 이벤트 효과 적용
            newMultiplier = applyArtifactEvents(artifactName, newMultiplier);
            
            artifactMarket.value_multipliers[artifactName] = newMultiplier;
        }
        
        // 차트 데이터 업데이트
        updateArtifactChartData();
        
        artifactMarket.last_update = now;
        console.log('🏺 유물 시장 업데이트 완료');
        
    } catch (error) {
        console.error('유물 시장 업데이트 오류:', error);
    }
}

// 유물 시장 이벤트 체크
function checkArtifactMarketEvents() {
    const artifactMarket = STOCK_MARKET.artifact_market;
    const now = Date.now();
    
    // 만료된 이벤트 제거
    artifactMarket.active_events = artifactMarket.active_events.filter(event => {
        return now < event.start_time + event.duration;
    });
    
    // 새 이벤트 생성 체크
    for (const eventTemplate of artifactMarket.market_events) {
        if (Math.random() < eventTemplate.probability) {
            const newEvent = {
                ...eventTemplate,
                start_time: now,
                id: `${eventTemplate.name}_${now}`
            };
            
            // 동일한 이벤트가 이미 활성화되어 있지 않다면 추가
            if (!artifactMarket.active_events.some(e => e.name === eventTemplate.name)) {
                artifactMarket.active_events.push(newEvent);
                console.log(`🎉 유물 시장 이벤트 시작: ${eventTemplate.name}`);
            }
        }
    }
}

// 유물에 이벤트 효과 적용
function applyArtifactEvents(artifactName, baseMultiplier) {
    const artifactMarket = STOCK_MARKET.artifact_market;
    let finalMultiplier = baseMultiplier;
    
    // 유물 등급 확인 (간단한 매핑)
    const artifactRarity = getArtifactRarity(artifactName);
    
    for (const event of artifactMarket.active_events) {
        if (event.effect.rarity === artifactRarity) {
            finalMultiplier *= event.effect.multiplier;
        }
    }
    
    return finalMultiplier;
}

// 유물 등급 확인
function getArtifactRarity(artifactName) {
    // 레전드리 유물들
    const legendaryArtifacts = ['창조의 서판', '무한의 보석', '시공간 열쇠', '생명의 나무 가지', '별의 눈물', 
                               '파라오의 황금 마스크', '해적왕의 보물상자', '설인의 발자국 화석', 
                               '잃어버린 도시의 열쇠', '외계 문명의 데이터 코어'];
    
    // 에픽 유물들
    const epicArtifacts = ['왕관의 조각', '용의 비늘', '신의 성물', '시간의 모래시계', '불멸의 약초',
                          '미라의 붕대', '인어의 진주', '얼음 수정', '아즈텍 황금 조각상', '운석 조각'];
    
    // 희귀 유물들
    const rareArtifacts = ['황금 목걸이', '보석 단검', '고대 두루마리', '수정 구슬', '은 잔'];
    
    if (legendaryArtifacts.includes(artifactName)) return 'legendary';
    if (epicArtifacts.includes(artifactName)) return 'epic';
    if (rareArtifacts.includes(artifactName)) return 'rare';
    return 'common';
}

// 유물 차트 데이터 업데이트
function updateArtifactChartData() {
    const artifactMarket = STOCK_MARKET.artifact_market;
    const now = new Date();
    const timestamp = now.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // 타임스탬프 추가
    artifactMarket.chart_history.timestamps.push(timestamp);
    
    // 전체 유물 시장 지수 계산 (평균 배율)
    const multipliers = Object.values(artifactMarket.value_multipliers);
    const averageMultiplier = multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length;
    const marketIndex = Math.round(averageMultiplier * 1000); // 1000을 기준으로 지수화
    
    artifactMarket.chart_history.artifact_index.push(marketIndex);
    
    // 개별 유물 데이터 업데이트 (상위 10개만)
    const topArtifacts = Object.entries(artifactMarket.value_multipliers)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    for (const [artifactName, multiplier] of topArtifacts) {
        if (!artifactMarket.chart_history.individual_artifacts[artifactName]) {
            artifactMarket.chart_history.individual_artifacts[artifactName] = [];
        }
        
        const value = Math.round(multiplier * 100); // 백분율로 변환
        artifactMarket.chart_history.individual_artifacts[artifactName].push(value);
        
        // 최대 50개 데이터포인트만 유지
        if (artifactMarket.chart_history.individual_artifacts[artifactName].length > 50) {
            artifactMarket.chart_history.individual_artifacts[artifactName].shift();
        }
    }
    
    // 최대 50개 데이터포인트만 유지
    if (artifactMarket.chart_history.timestamps.length > 50) {
        artifactMarket.chart_history.timestamps.shift();
        artifactMarket.chart_history.artifact_index.shift();
    }
}

// 유물의 현재 시장 가치 계산
function calculateArtifactValue(artifact) {
    // 새로운 시세 시스템 사용
    const priceData = artifactMarket.priceHistory.get(artifact.name);
    if (priceData && priceData.currentPrice) {
        return priceData.currentPrice;
    }
    
    // 기존 시스템 폴백
    const stockArtifactMarket = STOCK_MARKET.artifact_market;
    const baseValue = artifact.value;
    const multiplier = stockArtifactMarket.value_multipliers[artifact.name] || 1.0;
    
    return Math.round(baseValue * multiplier);
}

// 유물 시장 차트 생성
async function generateArtifactChart(type = 'market') {
    try {
        const artifactMarket = STOCK_MARKET.artifact_market;
        const chartHistory = artifactMarket.chart_history;
        
        if (chartHistory.timestamps.length < 2) {
            return null;
        }
        
        const dataPoints = Math.min(25, chartHistory.timestamps.length);
        const labels = chartHistory.timestamps.slice(-dataPoints);
        
        let chartConfig;
        
        if (type === 'market') {
            // 전체 시장 지수 차트
            chartConfig = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: '유물 시장 지수',
                        data: chartHistory.artifact_index.slice(-dataPoints),
                        borderColor: '#f39c12',
                        backgroundColor: 'rgba(243,156,18,0.1)',
                        borderWidth: 3,
                        fill: true
                    }]
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: '🏺 유물 시장 종합 지수',
                            color: '#f39c12',
                            font: { size: 16 }
                        },
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    }
                }
            };
        } else {
            // 개별 유물 차트
            const topArtifacts = Object.entries(chartHistory.individual_artifacts)
                .filter(([name, data]) => data.length > 1)
                .slice(0, 5);
            
            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
            const datasets = topArtifacts.map(([name, data], index) => ({
                label: name,
                data: data.slice(-dataPoints),
                borderColor: colors[index],
                borderWidth: 2,
                fill: false
            }));
            
            chartConfig = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    plugins: {
                        title: {
                            display: true,
                            text: '💎 주요 유물 가치 변동',
                            color: '#f39c12',
                            font: { size: 16 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    }
                }
            };
        }
        
        const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=1000&height=500&backgroundColor=rgb(47,49,54)&format=png`;
        return chartUrl;
        
    } catch (error) {
        console.error('유물 차트 생성 오류:', error);
        return null;
    }
}

// 유물 시장 정기 업데이트 시작
intervals.push(setInterval(updateArtifactMarket, 5 * 60 * 1000)); // 5분마다 업데이트

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
    async createRaceGIF(racers, finalResults = null, raceFrames = null) {
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
                        
                        // 실제 레이스 데이터가 있으면 사용, 없으면 기존 로직
                        if (raceFrames && raceFrames.length > 0) {
                            // 실제 레이스 프레임에서 해당 프레임의 데이터 찾기
                            const frameIndex = Math.floor((frame / this.frameCount) * raceFrames.length);
                            const currentFrame = raceFrames[Math.min(frameIndex, raceFrames.length - 1)];
                            
                            if (currentFrame) {
                                const racerData = currentFrame.players.find(p => p.userId === racer.userId);
                                if (racerData) {
                                    progress = racerData.position;
                                    racer.currentProgress = progress;
                                } else {
                                    progress = 0;
                                }
                            } else {
                                progress = 0;
                            }
                        } else {
                            // 기존 랜덤 로직 (백업용)
                            if (!racer.fixedSpeed) {
                                racer.fixedSpeed = Math.random() * 1.2 + 0.7;
                            }
                            
                            const mainRandomness = Math.sin(frame * 0.1 + i) * 0.08;
                            const microRandomness = (Math.random() - 0.5) * 0.05;
                            const totalRandomness = mainRandomness + microRandomness;
                            
                            let baseProgress = frameProgress * 0.85;
                            const speedMultiplier = racer.fixedSpeed;
                            
                            progress = Math.min(
                                (baseProgress + totalRandomness) * speedMultiplier * 100,
                                100
                            );
                            
                            racer.currentProgress = progress;
                            
                            if (frame >= this.frameCount * 0.8) {
                                const currentRanking = [...sortedRacers]
                                    .map(r => ({ ...r, currentProgress: r.currentProgress || 0 }))
                                    .sort((a, b) => b.currentProgress - a.currentProgress);
                                
                                const currentPosition = currentRanking.findIndex(r => r.userId === racer.userId) + 1;
                                
                                if (currentPosition > 3) {
                                    const boostProgress = (frame - this.frameCount * 0.8) / (this.frameCount * 0.2);
                                    const boost = boostProgress * 12;
                                    progress = Math.min(progress + boost, 100);
                                    racer.currentProgress = progress;
                                }
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
                    // 레이싱 애니메이션 GIF 생성 (실제 레이스 데이터 사용)
                    const raceGifBuffer = await this.createRaceGIF(players, false, raceFrames);
                    
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

// 🐉 몬스터 배틀 아레나 시스템 클래스
class MonsterBattleSystem {
    constructor() {
        this.gameStats = {
            totalGames: 0,
            recentNumbers: [], // 최근 100개 결과
            hotNumbers: new Map(), // 숫자별 등장 횟수
            biggestWins: [] // 최대 당첨 기록
        };
        this.activeGames = new Map(); // userId -> 게임 상태
    }

    // 몬스터 배틀 아레나 메인 메뉴
    async showMonsterBattleMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌  등록되지 않은 사용자입니다.', flags: 64 });
        }

        const stats = user.oddEvenStats || {};
        const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';

        const embed = new EmbedBuilder()
            .setTitle('🐉 몬스터 배틀 아레나 🐉')
            .setDescription('**⚔️ 배틀 방식:** 1~100 레벨 몬스터가 랜덤 등장! 몬스터의 특성을 예측하여 승부!\n' +
                '**✨ 다중 예측:** 여러 특성에 동시 예측 가능! (예: 홀수레벨+약한몬스터)\n\n' +
                '**🎯 예측 옵션:**\n' +
                '⚡ **홀수 레벨** (1,3,5,7...) - 보상 1.95배\n' +
                '🌙 **짝수 레벨** (2,4,6,8...) - 보상 1.95배\n' +
                '🐛 **약한 몬스터** (1~50레벨) - 보상 1.95배\n' +
                '🐲 **강한 몬스터** (51~100레벨) - 보상 1.95배\n' +
                '🍀 **세븐 배수 레벨** (7,14,21...) - 보상 13.0배\n' +
                '💎 **정확한 레벨 예측** (1~100레벨) - 보상 99.0배\n\n' +
                '**⚔️ 예시:** 레벨 42 오크가 등장!\n' +
                '✅ 짝수 레벨 적중! ✅ 약한 몬스터 적중! ✅ 세븐 배수 적중!')
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 승률', value: `${winRate}%`, inline: true },
                { name: '🔥 연승', value: `${stats.currentStreak || 0}회`, inline: true },
                { name: '⚔️ 총 배틀', value: `${stats.totalGames || 0}회`, inline: true },
                { name: '💎 최대 보상', value: `${(stats.biggestWin || 0).toLocaleString()}G`, inline: true },
                { name: '📈 총 수익', value: `${((stats.totalWinnings || 0) - (stats.totalBets || 0)).toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700');

        // 최근 몬스터 등장 기록
        if (this.gameStats.recentNumbers.length > 0) {
            const recent = this.gameStats.recentNumbers.slice(-10).reverse();
            embed.addFields({
                name: '👹 최근 등장 몬스터',
                value: recent.map(level => {
                    const isOdd = level % 2 === 1;
                    const isWeak = level <= 50;
                    return `\`Lv.${level}\` ${isOdd ? '⚡' : '🌙'}${isWeak ? '🐛' : '🐲'}`;
                }).join(' '),
                inline: false
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_battle')
                    .setLabel('⚔️ 배틀 참가')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_stats')
                    .setLabel('📊 헌터 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('monster_history')
                    .setLabel('📜 배틀 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('monster_ranking')
                    .setLabel('🏆 헌터 랭킹')
                    .setStyle(ButtonStyle.Success)
            );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }

    // 베팅 메뉴 표시 (중복 베팅 지원)
    async showBettingMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        
        if (!user) {
            await interaction.reply({ content: '사용자 정보를 찾을 수 없습니다.', flags: 64 });
            return;
        }
        
        // 현재 베팅 초기화 (새로운 베팅 시작)
        if (!user.oddEvenStats) {
            user.oddEvenStats = {};
        }
        if (!user.oddEvenStats.currentBets) {
            user.oddEvenStats.currentBets = [];
        }
        
        let description = `**현재 골드:** ${user.gold.toLocaleString()}G\n`;
        description += `**최소 베팅:** ${MONSTER_BATTLE.betLimits.min.toLocaleString()}G | **최대 베팅:** ${(user.level >= 50 ? MONSTER_BATTLE.betLimits.vip_max : MONSTER_BATTLE.betLimits.max).toLocaleString()}G\n\n`;
        
        // 현재 베팅 목록 표시
        if (user.oddEvenStats.currentBets && user.oddEvenStats.currentBets.length > 0) {
            const totalBetAmount = user.oddEvenStats.currentBets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
            description += `**🎯 현재 베팅 목록:**\n`;
            user.oddEvenStats.currentBets.forEach(bet => {
                const option = MONSTER_BATTLE.betOptions[bet.betType];
                const amount = bet.amount || 0;
                const betInfo = bet.targetNumber ? 
                    `${option?.emoji || '🎲'} ${option?.name || bet.betType} (${bet.targetNumber}) - ${amount.toLocaleString()}G` :
                    `${option?.emoji || '🎲'} ${option?.name || bet.betType} - ${amount.toLocaleString()}G`;
                description += `${betInfo}\n`;
            });
            description += `**💰 총 베팅금:** ${totalBetAmount.toLocaleString()}G\n\n`;
            description += `**추가 베팅하거나 게임을 시작하세요!**`;
        } else {
            description += `**베팅할 옵션을 선택하세요:**\n*(여러 옵션에 중복 베팅 가능!)*`;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎲 베팅 선택 (중복 가능)')
            .setDescription(description)
            .setColor('#FF6B6B');

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('bet_odd')
                    .setLabel('🔥 홀 (1.95x)')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('bet_even')
                    .setLabel('❄️ 짝 (1.95x)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('bet_small')
                    .setLabel('🔻 소 (1.95x)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('bet_big')
                    .setLabel('🔺 대 (1.95x)')
                    .setStyle(ButtonStyle.Secondary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('bet_lucky7')
                    .setLabel('🍀 7배수 (13x)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('bet_jackpot')
                    .setLabel('💎 정확한 숫자 (99x)')
                    .setStyle(ButtonStyle.Danger)
            );

        // 베팅이 있을 때만 게임 시작/초기화 버튼 추가
        if (user.oddEvenStats.currentBets && user.oddEvenStats.currentBets.length > 0) {
            row2.addComponents(
                new ButtonBuilder()
                    .setCustomId('start_game')
                    .setLabel('🎲 게임 시작!')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('clear_bets')
                    .setLabel('🗑️ 베팅 초기화')
                    .setStyle(ButtonStyle.Danger)
            );
        }

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('oddeven_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        const components = user.oddEvenStats.currentBets?.length > 0 ? [row1, row2, row3] : [row1, row2, row3];
        
        // Modal submission은 update를 사용할 수 없으므로 reply 사용
        if (interaction.isModalSubmit()) {
            await interaction.reply({ embeds: [embed], components });
        } else if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components });
        } else {
            await interaction.update({ embeds: [embed], components });
        }
    }

    // 개별 베팅 추가
    async addBet(interaction, betType, betAmount, specificNumber = null) {
        const user = await User.findOne({ discordId: interaction.user.id });
        
        // 최소 베팅 금액 확인
        if (betAmount < MONSTER_BATTLE.betLimits.min) {
            return interaction.reply({ 
                content: `❌ 최소 베팅 금액은 ${MONSTER_BATTLE.betLimits.min.toLocaleString()}G 입니다!`, 
                flags: 64 
            });
        }
        
        // 골드 확인
        if (user.gold < betAmount) {
            return interaction.reply({ 
                content: `❌ 골드가 부족합니다! 현재: ${user.gold.toLocaleString()}G`, 
                flags: 64 
            });
        }

        // 베팅 한도 확인
        const maxBet = user.level >= 50 ? MONSTER_BATTLE.betLimits.vip_max : MONSTER_BATTLE.betLimits.max;
        if (betAmount > maxBet) {
            return interaction.reply({ 
                content: `❌ 최대 베팅 한도를 초과했습니다! 최대: ${maxBet.toLocaleString()}G`, 
                flags: 64 
            });
        }

        // 중복 베팅 확인 (같은 타입의 베팅이 이미 있는지)
        if (!user.oddEvenStats) {
            user.oddEvenStats = {};
        }
        if (!user.oddEvenStats.currentBets) {
            user.oddEvenStats.currentBets = [];
        }

        const existingBet = user.oddEvenStats.currentBets.find(bet => bet.betType === betType);
        if (existingBet) {
            return interaction.reply({ 
                content: `❌ 이미 ${MONSTER_BATTLE.betOptions[betType]?.name || betType}에 베팅했습니다!`, 
                flags: 64 
            });
        }

        // 베팅 추가
        const newBet = {
            betType,
            amount: betAmount,
            targetNumber: specificNumber,
            timestamp: new Date()
        };

        user.oddEvenStats.currentBets.push(newBet);
        await user.save();

        // 베팅 메뉴 새로고침
        await this.showBettingMenu(interaction);
    }

    // 중복 베팅 게임 실행
    async playMultipleBets(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        
        console.log('playMultipleBets - user.oddEvenStats:', user.oddEvenStats);
        console.log('playMultipleBets - currentBets:', user.oddEvenStats?.currentBets);
        
        if (!user.oddEvenStats?.currentBets || user.oddEvenStats.currentBets.length === 0) {
            return interaction.reply({ 
                content: '❌ 베팅이 없습니다!', 
                flags: 64 
            });
        }

        // 총 베팅 금액 계산
        const totalBetAmount = user.oddEvenStats.currentBets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
        
        // 골드 확인
        if (user.gold < totalBetAmount) {
            return interaction.reply({ 
                content: `❌ 골드가 부족합니다! 필요: ${totalBetAmount.toLocaleString()}G, 현재: ${user.gold.toLocaleString()}G`, 
                flags: 64 
            });
        }

        // 골드 차감
        user.gold -= totalBetAmount;

        // 랜덤 숫자 생성 (1-100)
        const resultNumber = Math.floor(Math.random() * 100) + 1;
        const isOdd = resultNumber % 2 === 1;
        const isSmall = resultNumber <= 50;
        const isLucky7 = resultNumber % 7 === 0;

        // 각 베팅별로 당첨 확인
        let totalPayout = 0;
        const betResults = [];

        for (const bet of user.oddEvenStats.currentBets) {
            let won = false;
            let multiplier = 0;

            switch (bet.betType) {
                case 'odd':
                    won = isOdd;
                    multiplier = MONSTER_BATTLE.betOptions.odd.multiplier;
                    break;
                case 'even':
                    won = !isOdd;
                    multiplier = MONSTER_BATTLE.betOptions.even.multiplier;
                    break;
                case 'small':
                    won = isSmall;
                    multiplier = MONSTER_BATTLE.betOptions.small.multiplier;
                    break;
                case 'big':
                    won = !isSmall;
                    multiplier = MONSTER_BATTLE.betOptions.big.multiplier;
                    break;
                case 'lucky7':
                    won = isLucky7;
                    multiplier = MONSTER_BATTLE.betOptions.lucky7.multiplier;
                    break;
                case 'jackpot':
                    won = resultNumber === bet.targetNumber;
                    multiplier = MONSTER_BATTLE.betOptions.jackpot.multiplier;
                    break;
            }

            const payout = won ? Math.floor(bet.amount * multiplier) : 0;
            totalPayout += payout;

            betResults.push({
                ...bet,
                won,
                payout,
                multiplier
            });
        }

        // 당첨금 지급
        if (totalPayout > 0) {
            user.gold += totalPayout;
        }

        // 통계 업데이트
        this.updateMultipleBetStats(user, betResults, resultNumber, totalBetAmount, totalPayout);
        this.updateGameStats(resultNumber, totalPayout, user.nickname);

        // 베팅 목록 초기화
        user.oddEvenStats.currentBets = [];
        await user.save();

        // 결과 표시
        await this.showMultipleBetResult(interaction, {
            user,
            resultNumber,
            betResults,
            totalBetAmount,
            totalPayout
        });
    }

    // 단일 베팅 게임 실행 (기존 함수 - 호환성 유지)
    async playGame(interaction, betType, betAmount, specificNumber = null) {
        const user = await User.findOne({ discordId: interaction.user.id });
        
        // 골드 확인
        if (user.gold < betAmount) {
            return interaction.reply({ 
                content: `❌ 골드가 부족합니다! 현재: ${user.gold.toLocaleString()}G`, 
                flags: 64 
            });
        }

        // 베팅 한도 확인
        const maxBet = user.level >= 50 ? MONSTER_BATTLE.betLimits.vip_max : MONSTER_BATTLE.betLimits.max;
        if (betAmount > maxBet) {
            return interaction.reply({ 
                content: `❌ 최대 베팅 한도를 초과했습니다! 최대: ${maxBet.toLocaleString()}G`, 
                flags: 64 
            });
        }

        // 골드 차감
        user.gold -= betAmount;

        // 랜덤 숫자 생성 (1-100)
        const resultNumber = Math.floor(Math.random() * 100) + 1;
        const isOdd = resultNumber % 2 === 1;
        const isSmall = resultNumber <= 50;
        const isLucky7 = resultNumber % 7 === 0;

        // 특수 이벤트 확인
        let specialEvent = null;
        for (const event of MONSTER_BATTLE.specialEvents) {
            if (Math.random() < event.probability) {
                specialEvent = event;
                break;
            }
        }

        // 당첨 확인
        let won = false;
        let multiplier = 0;

        switch (betType) {
            case 'odd':
                won = isOdd;
                multiplier = MONSTER_BATTLE.betOptions.odd.multiplier;
                break;
            case 'even':
                won = !isOdd;
                multiplier = MONSTER_BATTLE.betOptions.even.multiplier;
                break;
            case 'small':
                won = isSmall;
                multiplier = MONSTER_BATTLE.betOptions.small.multiplier;
                break;
            case 'big':
                won = !isSmall;
                multiplier = MONSTER_BATTLE.betOptions.big.multiplier;
                break;
            case 'lucky7':
                won = isLucky7;
                multiplier = MONSTER_BATTLE.betOptions.lucky7.multiplier;
                break;
            case 'jackpot':
                won = resultNumber === specificNumber;
                multiplier = MONSTER_BATTLE.betOptions.jackpot.multiplier;
                break;
        }

        // 연승 보너스 적용
        let streakBonus = 0;
        if (won && user.oddEvenStats?.currentStreak > 0) {
            const streak = user.oddEvenStats.currentStreak;
            for (const bonus of MONSTER_BATTLE.streakBonuses) {
                if (streak >= bonus.streak) {
                    streakBonus = bonus.bonus;
                }
            }
        }

        // 특수 이벤트 효과 적용
        if (specialEvent && won) {
            switch (specialEvent.effect.type) {
                case 'multiply_payout':
                    multiplier *= specialEvent.effect.value;
                    break;
                case 'chaos_result':
                    won = Math.random() < 0.5; // 50% 확률로 재결정
                    break;
            }
        }

        // 최종 배율 계산
        const finalMultiplier = multiplier * (1 + streakBonus);
        const payout = won ? Math.floor(betAmount * finalMultiplier) : 0;
        
        if (won) {
            user.gold += payout;
        }

        // 통계 업데이트
        this.updateUserStats(user, betType, betAmount, won, payout, resultNumber);
        this.updateGameStats(resultNumber, payout, user.nickname);

        await user.save();

        // 결과 표시
        await this.showGameResult(interaction, {
            user,
            betType,
            betAmount,
            resultNumber,
            won,
            payout,
            specialEvent,
            streakBonus,
            finalMultiplier
        });
    }

    // 유저 통계 업데이트
    updateUserStats(user, betType, betAmount, won, payout, resultNumber) {
        if (!user.oddEvenStats) {
            user.oddEvenStats = {
                totalGames: 0,
                totalBets: 0,
                totalWinnings: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                longestWinStreak: 0,
                longestLossStreak: 0,
                biggestWin: 0,
                biggestLoss: 0,
                recentResults: []
            };
        }

        const stats = user.oddEvenStats;
        stats.totalGames++;
        stats.totalBets += betAmount;
        stats.lastPlayDate = new Date();

        if (won) {
            stats.wins++;
            stats.totalWinnings += payout;
            stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
            stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentStreak);
            stats.biggestWin = Math.max(stats.biggestWin, payout);
        } else {
            stats.losses++;
            stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
            stats.longestLossStreak = Math.max(stats.longestLossStreak, Math.abs(stats.currentStreak));
            stats.biggestLoss = Math.max(stats.biggestLoss, betAmount);
        }

        // 최근 결과 기록 (최대 10개)
        stats.recentResults.unshift({
            number: resultNumber,
            bet: betType,
            amount: betAmount,
            won: won,
            payout: payout,
            date: new Date()
        });

        if (stats.recentResults.length > 10) {
            stats.recentResults = stats.recentResults.slice(0, 10);
        }
    }

    // 전체 게임 통계 업데이트
    updateGameStats(resultNumber, payout, nickname) {
        this.gameStats.totalGames++;
        this.gameStats.recentNumbers.push(resultNumber);
        
        // 최근 100개만 유지
        if (this.gameStats.recentNumbers.length > 100) {
            this.gameStats.recentNumbers.shift();
        }

        // 핫 넘버 업데이트
        const count = this.gameStats.hotNumbers.get(resultNumber) || 0;
        this.gameStats.hotNumbers.set(resultNumber, count + 1);

        // 대박 당첨 기록
        if (payout > 100000) {
            this.gameStats.biggestWins.push({
                amount: payout,
                user: nickname,
                date: new Date()
            });
            // 최대 10개만 유지
            this.gameStats.biggestWins.sort((a, b) => b.amount - a.amount);
            if (this.gameStats.biggestWins.length > 10) {
                this.gameStats.biggestWins = this.gameStats.biggestWins.slice(0, 10);
            }
        }
    }

    // 게임 결과 표시
    async showGameResult(interaction, gameData) {
        const { user, betType, betAmount, resultNumber, won, payout, specialEvent, streakBonus, finalMultiplier } = gameData;
        
        const isOdd = resultNumber % 2 === 1;
        const isSmall = resultNumber <= 50;
        
        const embed = new EmbedBuilder()
            .setTitle('🎲 홀짝 게임 결과 🎲')
            .setDescription(`**결과 숫자: \`${resultNumber}\`**\n${isOdd ? '🔥 홀' : '❄️ 짝'} | ${isSmall ? '🔻 소' : '🔺 대'}`)
            .addFields(
                { name: '🎯 베팅', value: `${MONSTER_BATTLE.betOptions[betType]?.name || betType} - ${betAmount.toLocaleString()}G`, inline: true },
                { name: '📊 결과', value: won ? '🎉 당첨!' : '😭 꽝!', inline: true },
                { name: '💰 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor(won ? '#00FF00' : '#FF0000');

        if (won) {
            embed.addFields(
                { name: '💎 당첨금', value: `${payout.toLocaleString()}G`, inline: true },
                { name: '📈 배율', value: `${finalMultiplier.toFixed(2)}x`, inline: true },
                { name: '🔥 연승', value: `${user.oddEvenStats.currentStreak}회`, inline: true }
            );
        }

        if (specialEvent) {
            embed.addFields({
                name: `✨ ${specialEvent.name}`,
                value: specialEvent.description,
                inline: false
            });
        }

        if (streakBonus > 0) {
            embed.addFields({
                name: '🔥 연승 보너스',
                value: `+${(streakBonus * 100).toFixed(0)}% 배율 증가!`,
                inline: false
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('oddeven_play_again')
                    .setLabel('🎲 다시하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('oddeven_main')
                    .setLabel('🌲 몬스터 메뉴')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('game_page_1')
                    .setLabel('🏠 게임 메인')
                    .setStyle(ButtonStyle.Success)
            );

        // Interaction 상태에 따라 적절히 응답
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            await interaction.update({ embeds: [embed], components: [row] });
        }
    }

    // 중복 베팅 통계 업데이트
    updateMultipleBetStats(user, betResults, resultNumber, totalBetAmount, totalPayout) {
        if (!user.oddEvenStats) {
            user.oddEvenStats = {
                totalGames: 0,
                totalBets: 0,
                totalWinnings: 0,
                wins: 0,
                losses: 0,
                currentStreak: 0,
                longestWinStreak: 0,
                longestLossStreak: 0,
                biggestWin: 0,
                biggestLoss: 0,
                recentResults: []
            };
        }

        const stats = user.oddEvenStats;
        stats.totalGames++;
        stats.totalBets += totalBetAmount;
        stats.lastPlayDate = new Date();

        const hasWin = betResults.some(bet => bet.won);
        
        if (hasWin) {
            stats.wins++;
            stats.totalWinnings += totalPayout;
            stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
            stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentStreak);
            stats.biggestWin = Math.max(stats.biggestWin, totalPayout);
        } else {
            stats.losses++;
            stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
            stats.longestLossStreak = Math.max(stats.longestLossStreak, Math.abs(stats.currentStreak));
            stats.biggestLoss = Math.max(stats.biggestLoss, totalBetAmount);
        }

        // 최근 결과 기록 (최대 10개)
        stats.recentResults.unshift({
            number: resultNumber,
            bet: 'multiple',
            amount: totalBetAmount,
            won: hasWin,
            payout: totalPayout,
            date: new Date()
        });

        if (stats.recentResults.length > 10) {
            stats.recentResults = stats.recentResults.slice(0, 10);
        }
    }

    // 중복 베팅 결과 표시
    async showMultipleBetResult(interaction, gameData) {
        const { user, resultNumber, betResults, totalBetAmount, totalPayout } = gameData;
        
        const isOdd = resultNumber % 2 === 1;
        const isSmall = resultNumber <= 50;
        const isLucky7 = resultNumber % 7 === 0;
        
        const embed = new EmbedBuilder()
            .setTitle('🎲 홀짝 게임 결과 (중복 베팅) 🎲')
            .setDescription(`**결과 숫자: \`${resultNumber}\`**\n${isOdd ? '🔥 홀' : '❄️ 짝'} | ${isSmall ? '🔻 소' : '🔺 대'} | ${isLucky7 ? '🍀 7배수' : ''}`)
            .addFields(
                { name: '💰 총 베팅금', value: `${totalBetAmount.toLocaleString()}G`, inline: true },
                { name: '💎 총 당첨금', value: `${totalPayout.toLocaleString()}G`, inline: true },
                { name: '📈 수익', value: `${(totalPayout - totalBetAmount).toLocaleString()}G`, inline: true }
            )
            .setColor(totalPayout > 0 ? '#00FF00' : '#FF0000');

        // 각 베팅별 결과 표시
        let betResultText = '';
        betResults.forEach(bet => {
            const option = MONSTER_BATTLE.betOptions[bet.betType];
            const emoji = bet.won ? '✅' : '❌';
            const amount = bet.amount || 0;
            const payout = bet.payout || 0;
            
            const betInfo = bet.targetNumber ? 
                `${emoji} ${option?.emoji || '🎲'} ${option?.name || bet.betType} (${bet.targetNumber}) - ${amount.toLocaleString()}G` :
                `${emoji} ${option?.emoji || '🎲'} ${option?.name || bet.betType} - ${amount.toLocaleString()}G`;
            
            if (bet.won) {
                betResultText += `${betInfo} → **${payout.toLocaleString()}G 당첨!**\n`;
            } else {
                betResultText += `${betInfo}\n`;
            }
        });

        embed.addFields({
            name: '🎯 베팅 결과',
            value: betResultText || '베팅 없음',
            inline: false
        });

        embed.addFields(
            { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
            { name: '🔥 연승', value: `${user.oddEvenStats.currentStreak || 0}회`, inline: true },
            { name: '🎯 승률', value: `${user.oddEvenStats.totalGames > 0 ? ((user.oddEvenStats.wins / user.oddEvenStats.totalGames) * 100).toFixed(1) : '0.0'}%`, inline: true }
        );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('oddeven_bet')
                    .setLabel('🎲 다시 베팅')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('oddeven_main')
                    .setLabel('🌲 몬스터 메뉴')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('game_page_1')
                    .setLabel('🏠 게임 메인')
                    .setStyle(ButtonStyle.Success)
            );

        // Interaction 상태에 따라 적절히 응답
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ embeds: [embed], components: [row] });
        } else {
            await interaction.update({ embeds: [embed], components: [row] });
        }
    }
}

// 🍄 독버섯 게임 시스템
class MushroomGameSystem {
    constructor() {
        this.sessions = mushroomGameSessions;
    }

    // 게임 시작
    async startGame(interaction, user, difficulty) {
        const userId = interaction.user.id;
        
        // 이미 진행 중인 게임이나 매칭 중인지 확인
        if (this.sessions.has(userId) || mushroomMatchmakingQueue.has(userId)) {
            await interaction.reply({ 
                content: '이미 진행 중인 게임이나 매칭이 있습니다!', 
                flags: 64 
            });
            return;
        }

        if (difficulty === 'pvp') {
            // 유저와 대결: 매칭 시스템 사용
            await this.startMatchmaking(interaction, user);
        } else {
            // 혼자 플레이 또는 봇과 대결: 바로 게임 시작
            await this.createGameSession(interaction, user, difficulty);
        }
    }

    // 매칭 시스템
    async startMatchmaking(interaction, user) {
        const userId = interaction.user.id;
        
        // 대기 중인 플레이어 찾기
        const waitingPlayer = Array.from(mushroomMatchmakingQueue.entries())
            .find(([id, data]) => id !== userId && data.difficulty === 'pvp');

        if (waitingPlayer) {
            // 매칭 성공
            const [opponentId, opponentData] = waitingPlayer;
            mushroomMatchmakingQueue.delete(opponentId);

            // PvP 게임 세션 생성
            await this.createPvPSession(interaction, user, opponentId, opponentData.user);
        } else {
            // 매칭 대기열에 추가
            mushroomMatchmakingQueue.set(userId, {
                timestamp: Date.now(),
                difficulty: 'pvp',
                user: user,
                interaction: interaction
            });

            const waitingEmbed = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('🔍 상대방을 찾고 있습니다...')
                .setDescription(`${user.nickname}님, 다른 플레이어를 찾고 있습니다!\n\n⏰ 30초 후 봇과 대결로 자동 전환됩니다.`)
                .setThumbnail(`attachment://${MUSHROOM_GAME.effects.thinking}`);

            const cancelButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mushroom_cancel_${userId}`)
                        .setLabel('❌ 매칭 취소')
                        .setStyle(ButtonStyle.Danger)
                );

            const thinkingAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.thinking}`);

            await interaction.reply({
                embeds: [waitingEmbed],
                components: [cancelButton],
                files: [thinkingAttachment]
            });

            // 30초 후 봇 매칭으로 전환
            setTimeout(async () => {
                if (mushroomMatchmakingQueue.has(userId)) {
                    mushroomMatchmakingQueue.delete(userId);
                    
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff9900')
                        .setTitle('⏰ 매칭 시간 초과')
                        .setDescription('상대방을 찾지 못해 봇과 대결로 전환됩니다!');

                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    });

                    // 1초 후 봇 게임 시작
                    setTimeout(async () => {
                        await this.createGameSession(interaction, user, 'bot', true);
                    }, 1000);
                }
            }, MUSHROOM_GAME.gameSettings.matchmakingTimeout);
        }
    }

    // PvP 게임 세션 생성
    async createPvPSession(interaction, user1, user2Id, user2) {
        const sessionId = `pvp_${user1.discordId}_${user2Id}`;
        
        const session = {
            sessionId: sessionId,
            type: 'pvp',
            players: {
                [user1.discordId]: {
                    userId: user1.discordId,
                    userName: user1.nickname,
                    isAlive: true,
                    survivedRounds: 0,
                    totalReward: 0,
                    lastChoice: null
                },
                [user2Id]: {
                    userId: user2Id,
                    userName: user2.nickname,
                    isAlive: true,
                    survivedRounds: 0,
                    totalReward: 0,
                    lastChoice: null
                }
            },
            currentRound: 1,
            startTime: Date.now(),
            currentMushrooms: [],
            waitingForChoices: new Set([user1.discordId, user2Id])
        };

        this.sessions.set(user1.discordId, session);
        this.sessions.set(user2Id, session);

        // 매칭 성공 알림
        const matchEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('⚔️ 매칭 성공!')
            .setDescription(`${user1.nickname} VS ${user2.nickname}\n\n버섯 사냥 대결이 시작됩니다!`)
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.gameStart}`)
            .setThumbnail(`attachment://${MUSHROOM_GAME.effects.gameStart}`);

        const startButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_pvp_start_${sessionId}`)
                    .setLabel('🍄 대결 시작!')
                    .setStyle(ButtonStyle.Primary)
            );

        const gameStartAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.gameStart}`);
        const effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.gameStart}`);

        await interaction.editReply({
            embeds: [matchEmbed],
            components: [startButton],
            files: [gameStartAttachment, effectAttachment]
        });

        // 상대방에게도 알림 (DM 또는 채널)
        try {
            const opponent = await client.users.fetch(user2Id);
            await opponent.send({
                embeds: [matchEmbed.setDescription(`${user2.nickname} VS ${user1.nickname}\n\n버섯 사냥 대결이 시작됩니다!`)],
                components: [startButton],
                files: [gameStartAttachment, effectAttachment]
            });
        } catch (error) {
            console.log('상대방 DM 전송 실패:', error);
        }
    }

    // 게임 세션 생성 (솔로/봇)
    async createGameSession(interaction, user, difficulty, isTimeout = false) {
        const userId = interaction.user.id;

        const session = {
            userId: userId,
            userName: user.nickname,
            difficulty: difficulty,
            currentRound: 1,
            survivedRounds: 0,
            isAlive: true,
            totalReward: 0,
            startTime: Date.now(),
            bot: difficulty === 'bot' ? this.selectBot() : null,
            botAlive: difficulty === 'bot',
            currentMushrooms: []
        };

        this.sessions.set(userId, session);

        // 게임 시작 화면 표시
        const startEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(MUSHROOM_GAME.messages.gameStart)
            .setDescription(`${user.nickname}님의 버섯 사냥이 시작됩니다!\n\n모드: ${this.getDifficultyName(difficulty)}`)
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.gameStart}`)
            .setThumbnail(`attachment://${MUSHROOM_GAME.effects.gameStart}`);

        const startButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_start_${userId}`)
                    .setLabel('🍄 탐험 시작!')
                    .setStyle(ButtonStyle.Primary)
            );

        const gameStartAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.gameStart}`);
        const effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.gameStart}`);

        if (isTimeout) {
            await interaction.editReply({
                embeds: [startEmbed],
                components: [startButton],
                files: [gameStartAttachment, effectAttachment]
            });
        } else {
            await interaction.reply({
                embeds: [startEmbed],
                components: [startButton],
                files: [gameStartAttachment, effectAttachment]
            });
        }
    }

    // 난이도 이름 반환
    getDifficultyName(difficulty) {
        const names = {
            solo: '🌱 혼자 플레이',
            pvp: '⚔️ 유저와 대결',
            bot: '🤖 봇과 대결'
        };
        return names[difficulty] || names.solo;
    }

    // 봇 선택
    selectBot() {
        const botTypes = Object.keys(MUSHROOM_GAME.botCharacters);
        const randomBot = botTypes[Math.floor(Math.random() * botTypes.length)];
        return {
            type: randomBot,
            ...MUSHROOM_GAME.botCharacters[randomBot],
            choiceIndex: 0
        };
    }

    // 라운드 시작
    async startRound(interaction, userId) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const roundInfo = MUSHROOM_GAME.difficultyByRound[session.currentRound];
        
        // 버섯 배치 생성 (6개 중 독버섯 개수만큼 랜덤 배치)
        const mushrooms = this.generateMushrooms(roundInfo.poisonCount);
        session.currentMushrooms = mushrooms;

        // 라운드 시작 화면
        const roundEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`🍄 라운드 ${session.currentRound}`)
            .setDescription(`${roundInfo.message}\n\n${MUSHROOM_GAME.messages.selectPrompt}`)
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.mushroomSelect}`)
            .setFooter({ text: `생존 라운드: ${session.survivedRounds} | 획득 골드: ${session.totalReward}G` });

        // 버섯 선택 버튼들
        const mushroomButtons = [];
        for (let i = 0; i < 2; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const num = i * 3 + j + 1;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mushroom_select_${userId}_${num}`)
                        .setLabel(`${num}️⃣ 신비한 버섯`)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❓')
                );
            }
            mushroomButtons.push(row);
        }

        const backgroundAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.mushroomSelect}`);

        await interaction.update({
            embeds: [roundEmbed],
            components: mushroomButtons,
            files: [backgroundAttachment]
        });

        // 봇 대결 모드인 경우 봇 선택 처리
        if (session.difficulty === 'bot' && session.bot && session.botAlive) {
            setTimeout(() => this.processBotChoice(interaction, userId), MUSHROOM_GAME.gameSettings.botThinkingTime);
        }
    }

    // 버섯 생성
    generateMushrooms(poisonCount) {
        const mushrooms = [];
        const types = Object.keys(MUSHROOM_GAME.mushroomTypes);
        
        // 6개 위치 중 독버섯 위치 선택
        const poisonPositions = new Set();
        while (poisonPositions.size < poisonCount) {
            poisonPositions.add(Math.floor(Math.random() * 6));
        }

        // 버섯 배치
        for (let i = 0; i < 6; i++) {
            const randomType = types[Math.floor(Math.random() * types.length)];
            mushrooms.push({
                type: randomType,
                isPoisonous: poisonPositions.has(i),
                position: i + 1
            });
        }

        return mushrooms;
    }

    // 버섯 선택 처리
    async processMushroomSelection(interaction, userId, position) {
        const session = this.sessions.get(userId);
        if (!session || !session.isAlive) return;

        const selectedMushroom = session.currentMushrooms[position - 1];
        const mushroomType = MUSHROOM_GAME.mushroomTypes[selectedMushroom.type];

        let resultEmbed;
        let resultAttachment;
        let effectAttachment;

        if (selectedMushroom.isPoisonous) {
            // 독버섯 선택
            session.isAlive = false;
            
            resultEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(MUSHROOM_GAME.messages.poisonSelected)
                .setDescription(`${mushroomType.emoji} **${mushroomType.name}**\n\n${mushroomType.poisonDesc}`)
                .setImage(`attachment://${mushroomType.poisonGif}`)
                .setThumbnail(`attachment://${MUSHROOM_GAME.effects.poisonDeath}`)
                .addFields(
                    { name: '🏆 최종 성과', value: `생존 라운드: ${session.survivedRounds}\n획득 골드: ${session.totalReward}G`, inline: true }
                );

            resultAttachment = new AttachmentBuilder(`resource/${mushroomType.poisonGif}`);
            effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.poisonDeath}`);
        } else {
            // 안전한 버섯 선택
            session.survivedRounds++;
            const roundReward = MUSHROOM_GAME.gameSettings.baseReward + (session.currentRound - 1) * MUSHROOM_GAME.gameSettings.survivalBonus;
            session.totalReward += roundReward;

            resultEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(MUSHROOM_GAME.messages.safeSelected)
                .setDescription(`${mushroomType.emoji} **${mushroomType.name}**\n\n${mushroomType.safeDesc}`)
                .setImage(`attachment://${mushroomType.safeGif}`)
                .setThumbnail(`attachment://${MUSHROOM_GAME.effects.safeSparkle}`)
                .addFields(
                    { name: '💰 획득 골드', value: `+${roundReward}G`, inline: true },
                    { name: '📊 현재 상태', value: `라운드 ${session.currentRound} 통과!`, inline: true }
                );

            resultAttachment = new AttachmentBuilder(`resource/${mushroomType.safeGif}`);
            effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.safeSparkle}`);
        }

        // 다음 액션 버튼
        const nextActions = new ActionRowBuilder();
        
        if (session.isAlive && session.currentRound < MUSHROOM_GAME.gameSettings.maxRounds) {
            session.currentRound++;
            nextActions.addComponents(
                new ButtonBuilder()
                    .setCustomId(`mushroom_continue_${userId}`)
                    .setLabel('🍄 다음 라운드')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        nextActions.addComponents(
            new ButtonBuilder()
                .setCustomId(`mushroom_end_${userId}`)
                .setLabel('🏁 게임 종료')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.update({
            embeds: [resultEmbed],
            components: [nextActions],
            files: [resultAttachment, effectAttachment]
        });

        // 게임 완료 체크
        if (session.isAlive && session.currentRound > MUSHROOM_GAME.gameSettings.maxRounds) {
            await this.completeGame(interaction, userId, true);
        } else if (!session.isAlive) {
            await this.saveGameResult(userId);
        }
    }

    // 봇 선택 처리
    async processBotChoice(interaction, userId) {
        const session = this.sessions.get(userId);
        if (!session || !session.bot || !session.botAlive) return;

        let choice;
        const bot = session.bot;

        switch (bot.strategy) {
            case 'sequential':
                choice = bot.pattern[bot.choiceIndex % bot.pattern.length];
                bot.choiceIndex++;
                break;
            case 'random':
                choice = Math.floor(Math.random() * 6) + 1;
                break;
            case 'safe_guess':
                // 통계적으로 가장 안전한 위치 선택 (중간 번호 선호)
                choice = [3, 4, 2, 5, 1, 6][Math.floor(Math.random() * 6)];
                break;
            case 'dangerous_guess':
                // 극단적인 번호 선호
                choice = [1, 6, 1, 6, 2, 5][Math.floor(Math.random() * 6)];
                break;
            default:
                choice = Math.floor(Math.random() * 6) + 1;
        }

        const selectedMushroom = session.currentMushrooms[choice - 1];
        
        if (selectedMushroom.isPoisonous) {
            session.botAlive = false;
        }

        // 봇 선택 결과 표시 (현재 embed에 추가)
        const channel = interaction.channel;
        await channel.send({
            content: `${bot.emoji} **${bot.name}**이(가) ${choice}번 버섯을 선택했습니다!${selectedMushroom.isPoisonous ? ' 💀 독버섯이었습니다!' : ' ✨ 안전했습니다!'}`
        });
    }

    // 게임 완료
    async completeGame(interaction, userId, perfectClear = false) {
        const session = this.sessions.get(userId);
        if (!session) return;

        // 완벽 클리어 보너스
        if (perfectClear) {
            session.totalReward += MUSHROOM_GAME.gameSettings.perfectBonus;
        }

        const user = await User.findOne({ discordId: userId });
        if (user) {
            user.gold += session.totalReward;
            await user.save();
        }

        const victoryEmbed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle(perfectClear ? MUSHROOM_GAME.messages.perfectVictory : MUSHROOM_GAME.messages.survivalVictory.replace('{rounds}', session.survivedRounds))
            .setDescription(`🎉 축하합니다! ${session.userName}님!`)
            .setImage(`attachment://${MUSHROOM_GAME.backgrounds.victory}`)
            .setThumbnail(`attachment://${MUSHROOM_GAME.effects.victory}`)
            .addFields(
                { name: '🏆 생존 라운드', value: `${session.survivedRounds}/${MUSHROOM_GAME.gameSettings.maxRounds}`, inline: true },
                { name: '💰 총 획득 골드', value: `${session.totalReward}G`, inline: true },
                { name: '⏱️ 플레이 시간', value: `${Math.floor((Date.now() - session.startTime) / 1000)}초`, inline: true }
            );

        if (session.difficulty === 'bot' && session.bot) {
            victoryEmbed.addFields({
                name: '🤖 봇 대결 결과',
                value: session.botAlive ? `${session.bot.emoji} ${session.bot.name} 생존! 무승부!` : `${session.bot.emoji} ${session.bot.name} 탈락! 승리!`,
                inline: false
            });
        }

        const backgroundAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.backgrounds.victory}`);
        const effectAttachment = new AttachmentBuilder(`resource/${MUSHROOM_GAME.effects.victory}`);

        await interaction.editReply({
            embeds: [victoryEmbed],
            components: [],
            files: [backgroundAttachment, effectAttachment]
        });

        this.sessions.delete(userId);
    }

    // 게임 결과 저장
    async saveGameResult(userId) {
        const session = this.sessions.get(userId);
        if (!session) return;

        const user = await User.findOne({ discordId: userId });
        if (user && session.totalReward > 0) {
            user.gold += session.totalReward;
            await user.save();
        }

        this.sessions.delete(userId);
    }

    // 게임 종료
    async endGame(interaction, userId) {
        const session = this.sessions.get(userId);
        if (!session) {
            await interaction.reply({ content: '진행 중인 게임이 없습니다.', flags: 64 });
            return;
        }

        await this.saveGameResult(userId);

        const endEmbed = new EmbedBuilder()
            .setColor('#808080')
            .setTitle(MUSHROOM_GAME.messages.gameOver)
            .setDescription(`${session.userName}님의 버섯 사냥이 종료되었습니다.`)
            .addFields(
                { name: '🏆 최종 성과', value: `생존 라운드: ${session.survivedRounds}\n획득 골드: ${session.totalReward}G`, inline: false }
            );

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                embeds: [endEmbed],
                components: []
            });
        } else {
            await interaction.update({
                embeds: [endEmbed],
                components: []
            });
        }
    }
}

// 몬스터 배틀 아레나 시스템 인스턴스
const monsterBattle = new MonsterBattleSystem();
const oddEvenGame = monsterBattle;

// 독버섯 게임 시스템 인스턴스
const mushroomGame = new MushroomGameSystem();

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
        const weapon = getEquippedItem(user, 'weapon');
        const armor = getEquippedItem(user, 'armor');
        
        if (weapon && weapon.stats) {
            equipmentBonus.attack += weapon.stats.attack?.[0] || 0;
        }
        if (armor && armor.stats) {
            equipmentBonus.defense += armor.stats.defense?.[0] || 0;
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
    
    // ObjectId나 잘못된 데이터 타입인 경우 null 반환
    if (slotIndex === -1 || slotIndex === null || slotIndex === undefined || typeof slotIndex === 'object') {
        return null;
    }
    
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

// 클로즈베타 설정
const BETA_MODE = process.env.BETA_MODE === 'true';
const BETA_CHANNEL_IDS = process.env.BETA_CHANNEL_IDS ? process.env.BETA_CHANNEL_IDS.split(',').map(id => id.trim()) : [];
const BETA_USER_IDS = process.env.BETA_USER_IDS ? process.env.BETA_USER_IDS.split(',').map(id => id.trim()) : [];

// 베타 테스터 확인 함수
function isBetaTester(userId) {
    return BETA_USER_IDS.includes(userId) || isAdmin(userId);
}

// 베타 채널 확인 함수
function isBetaChannel(channelId) {
    return BETA_CHANNEL_IDS.includes(channelId) || DEV_CHANNEL_IDS.includes(channelId);
}

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

// 강화 확률표 (0-30강)
const ENHANCEMENT_RATES = {
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
    30: { success: 0, fail: 0, destroy: 0 } // 30강은 최대
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
    if (currentStar >= 30) return 0; // 30강은 최대
    
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

// 강화 스탯 보너스 계산 함수
function calculateEnhancementBonus(itemLevel, enhanceLevel) {
    if (enhanceLevel <= 0) return { attack: 0, defense: 0 };
    
    // 강화 공식: 레벨/20 + 강화당 고정 보너스
    const baseBonus = Math.floor(itemLevel / 20) + 1;
    
    let attack = 0;
    let defense = 0;
    
    // 1-5강: 기본 보너스
    for (let i = 1; i <= Math.min(enhanceLevel, 5); i++) {
        attack += baseBonus;
        defense += baseBonus;
    }
    
    // 6-10강: 보너스 증가
    for (let i = 6; i <= Math.min(enhanceLevel, 10); i++) {
        attack += baseBonus + 1;
        defense += baseBonus + 1;
    }
    
    // 11-15강: 더 큰 보너스
    for (let i = 11; i <= Math.min(enhanceLevel, 15); i++) {
        attack += baseBonus + 2;
        defense += baseBonus + 2;
    }
    
    // 16-25강: 최고 보너스
    for (let i = 16; i <= Math.min(enhanceLevel, 25); i++) {
        attack += baseBonus + 3;
        defense += baseBonus + 3;
    }
    
    // 26-30강: 극한 보너스
    for (let i = 26; i <= Math.min(enhanceLevel, 30); i++) {
        attack += baseBonus + 5;
        defense += baseBonus + 5;
    }
    
    return { attack, defense };
}

// 집중력 확률 조정 함수
function applyFocus(rates) {
    const newSuccess = Math.min(100, rates.success * 1.05);
    const remaining = 100 - newSuccess;
    const failRatio = rates.fail / (rates.fail + rates.destroy);
    
    return {
        success: newSuccess,
        fail: remaining * failRatio,
        destroy: remaining * (1 - failRatio)
    };
}

// 축복받은날 확률 조정 함수 (15~22강만)
function applyBlessedDay(rates, enhanceLevel) {
    if (enhanceLevel < 15 || enhanceLevel > 22) return rates;
    
    const newDestroy = rates.destroy * 0.7;
    const newFail = rates.fail + (rates.destroy - newDestroy);
    
    return {
        success: rates.success,
        fail: newFail,
        destroy: newDestroy
    };
}

// 강화 시도 함수
function attemptEnhance(rates, isFocusMode = false, isBlessedDay = false, enhanceLevel = 0) {
    let finalRates = { ...rates };
    
    if (isFocusMode) {
        finalRates = applyFocus(finalRates);
    }
    
    if (isBlessedDay) {
        finalRates = applyBlessedDay(finalRates, enhanceLevel);
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
function attemptEnhanceWithProtection(rates, isFocusMode = false, isBlessedDay = false, enhanceLevel = 0, useProtection = false) {
    const baseResult = attemptEnhance(rates, isFocusMode, isBlessedDay, enhanceLevel);
    
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
    
    // 장비 보너스 및 강화 보너스
    let equipmentBonus = 0;
    let enhancementBonus = 0;
    
    // 각 장비슬롯별 계산 (신식 시스템 - 슬롯 번호 참조)
    Object.keys(user.equipment).forEach(slot => {
        const slotIndex = user.equipment[slot];
        
        if (slotIndex >= 0) {
            // 인벤토리에서 직접 찾기
            const equipment = user.inventory.find(item => item.inventorySlot === slotIndex);
            
            if (equipment && equipment.stats) {
                // 스탯 값 추출 (숫자 형태만 처리)
                let attack = Number(equipment.stats.attack) || 0;
                let defense = Number(equipment.stats.defense) || 0;
                let dodge = Number(equipment.stats.dodge) || 0;
                let luck = Number(equipment.stats.luck) || 0;
                
                const itemBonus = attack + defense + dodge + luck;
                equipmentBonus += itemBonus;
                
                // 강화 보너스 계산
                if (equipment.enhanceLevel > 0) {
                    const itemLevel = equipment.level || 1;
                    const bonus = calculateEnhancementBonus(itemLevel, equipment.enhanceLevel);
                    const enhanceBonus = (bonus.attack || 0) + (bonus.defense || 0);
                    enhancementBonus += enhanceBonus;
                }
            }
        }
    });
    
    // 레벨 보너스
    let levelBonus = user.level * 5;
    
    return Math.floor(basePower + equipmentBonus + enhancementBonus + levelBonus);
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
        
        // 일괄 정리 완료로 개별 마이그레이션 불필요
        
        return user;
    } catch (error) {
        console.error('유저 조회/생성 오류:', error);
        return null;
    }
}

// 개별 마이그레이션 함수 제거 (일괄 정리로 대체)

// 기존 ObjectId 장비 데이터 정리 함수
async function cleanupEquipmentData() {
    try {
        const result = await User.updateMany(
            {}, 
            {
                $set: {
                    'equipment.weapon': -1,
                    'equipment.armor': -1,
                    'equipment.helmet': -1,
                    'equipment.gloves': -1,
                    'equipment.boots': -1,
                    'equipment.accessory': -1
                }
            }
        );
        console.log(`✅ ${result.modifiedCount}명의 유저 장비 데이터가 초기화되었습니다.`);
    } catch (error) {
        console.error('장비 데이터 정리 실패:', error);
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
        .setDescription('장비를 강화합니다 (0-30강)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

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
        .setDescription('집중력 축복으로 장비를 강화합니다 (성공률 5% 증가)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('축복받은날')
        .setDescription('축복받은 날로 강화합니다 (15-22강 파괴율 30% 감소)')
        .addStringOption(option =>
            option.setName('장비슬롯')
                .setDescription('강화할 장비 슬롯')
                .setRequired(true)
                .addChoices(
                    { name: '무기', value: 'weapon' },
                    { name: '갑옷', value: 'armor' },
                    { name: '투구', value: 'helmet' },
                    { name: '장갑', value: 'gloves' },
                    { name: '신발', value: 'boots' },
                    { name: '액세서리', value: 'accessory' }
                ))
        .addBooleanOption(option =>
            option.setName('보호권사용')
                .setDescription('보호권을 사용하여 파괴를 방지합니다 (20강 이상만 사용 가능)')
                .setRequired(false)),

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
        .setDescription('🎯 특정 단계의 조각을 선택하여 수동으로 융합합니다'),
    
    new SlashCommandBuilder()
        .setName('홀짝')
        .setDescription('🎲 홀짝 게임을 플레이합니다'),
    
    new SlashCommandBuilder()
        .setName('독버섯')
        .setDescription('🍄 독버섯 게임을 플레이합니다 - 안전한 버섯을 찾아 생존하세요!')
        .addStringOption(option =>
            option.setName('난이도')
                .setDescription('게임 난이도 선택')
                .setRequired(false)
                .addChoices(
                    { name: '🌱 혼자 플레이', value: 'solo' },
                    { name: '⚔️ 유저와 대결', value: 'pvp' },
                    { name: '🤖 봇과 대결', value: 'bot' }
                )),
                
    new SlashCommandBuilder()
        .setName('주식복구')
        .setDescription('📈 잃어버린 주식 데이터를 복구합니다 (관리자 전용)')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('주식을 복구할 유저')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('기업')
                .setDescription('기업 ID (예: traveler_inn)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('수량')
                .setDescription('보유 주식 수량')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('평균가')
                .setDescription('평균 매수가')
                .setRequired(true)),
                
    new SlashCommandBuilder()
        .setName('유물탐사')
        .setDescription('🏺 유물을 탐사하여 보물을 찾아보세요!')
];

// 봇이 준비되었을 때
client.once('ready', async () => {
    try {
        console.log(`${client.user.tag} 봇이 온라인 상태입니다! - 자동 재시작 테스트`);
        console.log(`개발 모드: ${DEV_MODE ? '활성화' : '비활성화'}`);
        if (DEV_MODE && DEV_CHANNEL_IDS.length > 0) {
            console.log(`개발 채널들: ${DEV_CHANNEL_IDS.join(', ')}`);
        }
        
        // MongoDB 연결
        await connectDB();
        
        // 기존 ObjectId 데이터 일괄 정리
        await cleanupEquipmentData();
        
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
    } catch (error) {
        console.error('봇 초기화 중 오류 발생:', error);
    }
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

// 메뉴 시스템 인터랙션 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    
    const { customId, values, user } = interaction;
    console.log(`🟣 드롭다운 선택됨: ${customId}, 값: ${values[0]}`);
    
    try {
        // 메인 메뉴 처리
        if (customId === 'main_menu') {
            const selectedValue = values[0];
            
            // 관리자 패널 접근 권한 확인
            if (selectedValue === 'admin_panel' && !isAdmin(user.id)) {
                return await interaction.reply({ 
                    content: '❌ 관리자만 접근할 수 있습니다!', 
                    ephemeral: true 
                });
            }
            
            // 각 메뉴 항목에 따른 처리 - 기존 기능들을 실제로 호출
            switch (selectedValue) {
                case 'hunting':
                    // 기존 사냥 로직 호출
                    await interaction.deferReply();
                    
                    const user = await getUser(interaction.user.id);
                    if (!user || !user.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    // 사냥터 목록 표시 (기존 hunting 로직 재사용)
                    const currentPage = 0;
                    const itemsPerPage = 5;
                    const availableAreas = huntingAreas.filter(area => user.unlockedAreas.includes(area.id));
                    const totalPages = Math.ceil(availableAreas.length / itemsPerPage);
                    
                    if (availableAreas.length === 0) {
                        return await interaction.editReply({ content: '❌ 사용 가능한 사냥터가 없습니다!' });
                    }
                    
                    const embed = new EmbedBuilder()
                        .setColor('#ff6b6b')
                        .setTitle('🗡️ 사냥터 선택')
                        .setDescription('사냥할 지역을 선택하세요');
                    
                    const huntingButtons = new ActionRowBuilder();
                    const startIndex = currentPage * itemsPerPage;
                    const currentAreas = availableAreas.slice(startIndex, startIndex + itemsPerPage);
                    
                    currentAreas.forEach(area => {
                        huntingButtons.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`hunt_area_${area.id}`)
                                .setLabel(area.name)
                                .setStyle(ButtonStyle.Primary)
                        );
                    });
                    
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
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ 
                        embeds: [embed], 
                        components: [huntingButtons, navButtons] 
                    });
                    
                case 'equipment':
                    // 기존 장비 로직 호출
                    await interaction.deferReply();
                    
                    const equipUser = await getUser(interaction.user.id);
                    if (!equipUser || !equipUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    // 장비 관리 화면 표시
                    const equipmentEmbed = new EmbedBuilder()
                        .setColor('#ffaa00')
                        .setTitle('⚔️ 장비 관리')
                        .setDescription('장착 중인 장비를 확인하고 관리하세요');
                    
                    const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
                    
                    for (const slot of slots) {
                        const slotIndex = equipUser.equipment[slot];
                        let slotInfo = '착용 안함';
                        
                        if (slotIndex !== -1) {
                            const equippedItem = equipUser.inventory.find(item => item.inventorySlot === slotIndex);
                            if (equippedItem) {
                                const enhanceText = equippedItem.enhanceLevel > 0 ? ` (+${equippedItem.enhanceLevel}강)` : '';
                                slotInfo = `${equippedItem.name}${enhanceText}`;
                            }
                        }
                        
                        equipmentEmbed.addFields({
                            name: getSlotDisplayName(slot),
                            value: slotInfo,
                            inline: true
                        });
                    }
                    
                    const equipButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('equip_category_weapons')
                                .setLabel('⚔️ 무기 장착')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('equip_category_armor')
                                .setLabel('🛡️ 방어구')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('inventory')
                                .setLabel('🎒 인벤토리')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ 
                        embeds: [equipmentEmbed], 
                        components: [equipButtons] 
                    });
                    
                case 'shop':
                    // 기존 상점 로직 호출
                    await interaction.deferReply();
                    
                    const shopEmbed = new EmbedBuilder()
                        .setColor('#00ff7f')
                        .setTitle('🛒 김헌터 상점')
                        .setDescription('원하는 카테고리를 선택하세요');
                    
                    const categoryButtons1 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('shop_weapon')
                                .setLabel('⚔️ 무기')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('shop_armor')
                                .setLabel('🛡️ 갑옷')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('shop_helmet')
                                .setLabel('⛑️ 헬멧')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('shop_gloves')
                                .setLabel('🧤 장갑')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('shop_boots')
                                .setLabel('👢 부츠')
                                .setStyle(ButtonStyle.Primary)
                        );
                    
                    const categoryButtons2 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('shop_accessory')
                                .setLabel('💎 액세서리')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('shop_scroll')
                                .setLabel('📜 주문서')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('shop_consumables')
                                .setLabel('🧪 소비')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ 
                        embeds: [shopEmbed], 
                        components: [categoryButtons1, categoryButtons2] 
                    });
                    
                case 'stocks':
                    // 기존 주식 로직 호출
                    await interaction.deferReply();
                    
                    const stockEmbed = new EmbedBuilder()
                        .setColor('#4169e1')
                        .setTitle('📈 환상 차원 주식거래소')
                        .setDescription('환상적인 수익을 위한 차원간 투자!')
                        .setFooter({ text: '투자에는 위험이 따릅니다. 신중하게 결정하세요!' });
                    
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
                                .setStyle(ButtonStyle.Success)
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
                    
                    return await interaction.editReply({ 
                        embeds: [stockEmbed], 
                        components: [stockButtons1, stockButtons2] 
                    });
                    
                case 'artifacts':
                    // 기존 유물탐사 로직 호출
                    await interaction.deferReply();
                    
                    const artifactEmbed = new EmbedBuilder()
                        .setColor('#daa520')
                        .setTitle('🏺 유물 탐사 센터')
                        .setDescription('고대의 보물을 찾아 부를 축적하세요!')
                        .setFooter({ text: '탐사에는 위험이 따르지만, 그만큼 큰 보상이 기다립니다!' });
                    
                    const menuButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('artifact_direct_explore')
                                .setLabel('⛏️ 직접 탐사')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('artifact_companies')
                                .setLabel('🏢 탐사회사 투자')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('artifact_inventory')
                                .setLabel('🎒 유물 보관함')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('artifact_shop')
                                .setLabel('🏪 유물 상점')
                                .setStyle(ButtonStyle.Success)
                        );
                    
                    const extraButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('artifact_rankings')
                                .setLabel('🏆 탐사가 랭킹')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('artifact_guide')
                                .setLabel('📖 탐사 가이드')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('artifact_market_chart')
                                .setLabel('📈 유물 시장 차트')
                                .setStyle(ButtonStyle.Success)
                        );
                    
                    return await interaction.editReply({ 
                        embeds: [artifactEmbed], 
                        components: [menuButtons, extraButtons] 
                    });
                    
                case 'daily':
                    // 기존 일일보상 로직 호출
                    await interaction.deferReply();
                    
                    const dailyUser = await getUser(interaction.user.id);
                    if (!dailyUser || !dailyUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const today = new Date().toDateString();
                    if (dailyUser.lastDaily === today) {
                        return await interaction.editReply({ content: '오늘은 이미 출석체크를 하셨습니다!' });
                    }
                    
                    // 출석체크 실행
                    const baseReward = 100;
                    const streakBonus = dailyUser.attendanceStreak * 10;
                    const totalReward = baseReward + streakBonus;
                    
                    await User.findOneAndUpdate(
                        { discordId: interaction.user.id },
                        { 
                            $inc: { gold: totalReward, attendanceStreak: 1 },
                            $set: { lastDaily: today }
                        }
                    );
                    
                    const dailyEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('🎁 출석체크 완료!')
                        .setDescription(`**${totalReward}<:currency_emoji:1377404064316522778>** 골드를 획득했습니다!`)
                        .addFields(
                            { name: '기본 보상', value: `${baseReward}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '연속 출석 보너스', value: `${streakBonus}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '연속 출석일', value: `${dailyUser.attendanceStreak + 1}일`, inline: true }
                        );
                    
                    return await interaction.editReply({ embeds: [dailyEmbed] });
                    
                case 'profile':
                    // 기존 프로필 로직 호출
                    await interaction.deferReply();
                    
                    const profileUser = await getUser(interaction.user.id);
                    if (!profileUser || !profileUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const maxExp = profileUser.level * 100;
                    const profileEmbed = new EmbedBuilder()
                        .setColor('#9932cc')
                        .setTitle('👤 내 정보')
                        .setDescription(`**${profileUser.nickname}**님의 게임 정보`)
                        .addFields(
                            { name: '레벨', value: `Lv.${profileUser.level}`, inline: true },
                            { name: '경험치', value: `${profileUser.exp}/${maxExp} EXP`, inline: true },
                            { name: '골드', value: `${profileUser.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                            { name: '인기도', value: `${profileUser.popularity} ${profileUser.popularity > 0 ? '❤️' : profileUser.popularity < 0 ? '💔' : ''}`, inline: true },
                            { name: '출석 연속일', value: `${profileUser.attendanceStreak}일`, inline: true },
                            { name: '해제된 사냥터', value: `${profileUser.unlockedAreas.length}개`, inline: true }
                        );
                    
                    return await interaction.editReply({ embeds: [profileEmbed] });
                    
                case 'work':
                    // 일하기 기능
                    await interaction.deferReply();
                    
                    const workUser = await getUser(interaction.user.id);
                    if (!workUser || !workUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const now = Date.now();
                    const cooldownTime = 60 * 60 * 1000; // 1시간
                    if (workUser.lastWork && now - workUser.lastWork < cooldownTime) {
                        const remainingTime = Math.ceil((cooldownTime - (now - workUser.lastWork)) / 60000);
                        return await interaction.editReply({ content: `⏰ 아직 쉬는 시간입니다! ${remainingTime}분 후에 다시 일할 수 있어요.` });
                    }
                    
                    const workReward = Math.floor(Math.random() * 100) + 50;
                    await User.findOneAndUpdate(
                        { discordId: interaction.user.id },
                        { 
                            $inc: { gold: workReward },
                            $set: { lastWork: now }
                        }
                    );
                    
                    const workEmbed = new EmbedBuilder()
                        .setColor('#00bfff')
                        .setTitle('⚒️ 일하기 완료!')
                        .setDescription(`열심히 일해서 **${workReward}<:currency_emoji:1377404064316522778>** 골드를 벌었습니다!`);
                    
                    return await interaction.editReply({ embeds: [workEmbed] });
                    
                case 'quest':
                    // 의뢰 기능
                    await interaction.deferReply();
                    
                    const questUser = await getUser(interaction.user.id);
                    if (!questUser || !questUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const questEmbed = new EmbedBuilder()
                        .setColor('#ff00ff')
                        .setTitle('📜 의뢰 시스템')
                        .setDescription('의뢰 시스템은 준비 중입니다!\n곧 다양한 퀘스트를 수행할 수 있습니다.');
                    
                    return await interaction.editReply({ embeds: [questEmbed] });
                    
                case 'pvp':
                    // PVP 메뉴
                    await interaction.deferReply();
                    
                    const pvpUser = await getUser(interaction.user.id);
                    if (!pvpUser || !pvpUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const pvpEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⚔️ PVP 대전장')
                        .setDescription('다른 플레이어와 실력을 겨뤄보세요!')
                        .addFields(
                            { name: '🎖️ 나의 레이팅', value: `${pvpUser.pvp?.rating || 1000}점`, inline: true },
                            { name: '🏅 티어', value: pvpUser.pvp?.tier || 'Bronze', inline: true },
                            { name: '🎫 결투권', value: `${pvpUser.pvp?.duelTickets || 20}개`, inline: true }
                        );
                    
                    const pvpButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('pvp_matchmaking')
                                .setLabel('⚔️ 대전 시작')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('pvp_ranking')
                                .setLabel('🏆 PVP 랭킹')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('pvp_info')
                                .setLabel('📖 PVP 정보')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ embeds: [pvpEmbed], components: [pvpButtons] });
                    
                case 'mushroom':
                    // 독버섯 게임
                    await interaction.deferReply();
                    
                    const mushroomUser = await getUser(interaction.user.id);
                    if (!mushroomUser || !mushroomUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const mushroomEmbed = new EmbedBuilder()
                        .setColor('#32cd32')
                        .setTitle('🍄 독버섯 게임')
                        .setDescription('독버섯을 피하고 황금버섯을 찾아보세요!')
                        .addFields(
                            { name: '🎮 게임 방식', value: '여러 버섯 중 독버섯을 피하고 황금버섯을 찾으세요', inline: false },
                            { name: '💰 베팅 금액', value: '1라운드당 100골드', inline: true },
                            { name: '🏆 최대 보상', value: '베팅금의 10배까지!', inline: true }
                        );
                    
                    const mushroomButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('mushroom_solo')
                                .setLabel('🍄 혼자 플레이')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('mushroom_pvp')
                                .setLabel('👥 PVP 대전')
                                .setStyle(ButtonStyle.Danger)
                        );
                    
                    return await interaction.editReply({ embeds: [mushroomEmbed], components: [mushroomButtons] });
                    
                case 'oddeven':
                    // 홀짝 게임
                    await interaction.deferReply();
                    
                    const oddevenUser = await getUser(interaction.user.id);
                    if (!oddevenUser || !oddevenUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const oddevenEmbed = new EmbedBuilder()
                        .setColor('#ffd700')
                        .setTitle('🎲 몬스터 홀짝 대결')
                        .setDescription('몬스터와 홀짝 대결을 펼쳐보세요!')
                        .addFields(
                            { name: '🎲 게임 방식', value: '1-100 사이의 숫자를 맞추세요', inline: false },
                            { name: '💰 베팅 옵션', value: '홀/짝, 대/소, 럭키7, 잭팟', inline: true },
                            { name: '🏆 최대 배율', value: '잭팟 99배!', inline: true }
                        );
                    
                    const oddevenButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('oddeven_play')
                                .setLabel('🎲 게임 시작')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('oddeven_stats')
                                .setLabel('📊 내 기록')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ embeds: [oddevenEmbed], components: [oddevenButtons] });
                    
                case 'stats':
                    // 능력치
                    await interaction.deferReply();
                    
                    const statsUser = await getUser(interaction.user.id);
                    if (!statsUser || !statsUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const statsEmbed = new EmbedBuilder()
                        .setColor('#ff69b4')
                        .setTitle('💪 능력치')
                        .setDescription(`**${statsUser.nickname}**님의 능력치`)
                        .addFields(
                            { name: '💪 힘', value: `${statsUser.stats.strength}`, inline: true },
                            { name: '🏃 민첩', value: `${statsUser.stats.agility}`, inline: true },
                            { name: '🧠 지능', value: `${statsUser.stats.intelligence}`, inline: true },
                            { name: '❤️ 체력', value: `${statsUser.stats.vitality}`, inline: true },
                            { name: '🍀 행운', value: `${statsUser.stats.luck}`, inline: true },
                            { name: '📊 잔여 포인트', value: `${statsUser.statPoints}`, inline: true }
                        );
                    
                    const statButtons = new ActionRowBuilder();
                    if (statsUser.statPoints > 0) {
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
                    
                    return await interaction.editReply({ embeds: [statsEmbed], components: [statButtons] });
                    
                case 'skills':
                    // 스킬
                    await interaction.deferReply();
                    
                    const skillsUser = await getUser(interaction.user.id);
                    if (!skillsUser || !skillsUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const skillsEmbed = new EmbedBuilder()
                        .setColor('#9370db')
                        .setTitle('🔮 스킬 시스템')
                        .setDescription('스킬 시스템은 준비 중입니다!\n곧 다양한 스킬을 사용할 수 있습니다.');
                    
                    return await interaction.editReply({ embeds: [skillsEmbed] });
                    
                case 'inventory':
                    // 인벤토리
                    await interaction.deferReply();
                    
                    const invUser = await getUser(interaction.user.id);
                    if (!invUser || !invUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    const inventoryEmbed = new EmbedBuilder()
                        .setColor('#8a2be2')
                        .setTitle('🎒 인벤토리')
                        .setDescription('보유중인 아이템을 확인하세요')
                        .setFooter({ text: `슬롯: ${invUser.inventory.length}/${invUser.maxInventorySlots}` });
                    
                    const invCategoryButtons1 = new ActionRowBuilder()
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
                    
                    const invCategoryButtons2 = new ActionRowBuilder()
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
                    
                    const invCategoryButtons3 = new ActionRowBuilder()
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
                    
                    return await interaction.editReply({ 
                        embeds: [inventoryEmbed], 
                        components: [invCategoryButtons1, invCategoryButtons2, invCategoryButtons3] 
                    });
                    
                case 'enhancement':
                    // 장비 강화
                    await interaction.deferReply();
                    
                    const enhanceUser = await getUser(interaction.user.id);
                    if (!enhanceUser || !enhanceUser.registered) {
                        return await interaction.editReply({ content: '먼저 회원가입을 해주세요!' });
                    }
                    
                    if (enhanceUser.level < 10) {
                        return await interaction.editReply({ content: '⚠️ 장비 강화는 레벨 10부터 가능합니다!' });
                    }
                    
                    const enhanceEmbed = new EmbedBuilder()
                        .setColor('#ff1493')
                        .setTitle('💎 에너지 융합 시스템')
                        .setDescription('에너지 조각을 융합하여 더 높은 등급의 조각을 만들어보세요!');
                    
                    const enhanceButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('energy_mine')
                                .setLabel('⛏️ 에너지 채굴')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('energy_fusion')
                                .setLabel('✨ 에너지 융합')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('fusion_ranking')
                                .setLabel('🏆 융합 랭킹')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ embeds: [enhanceEmbed], components: [enhanceButtons] });
                    
                case 'auction':
                    // 경매장
                    await interaction.deferReply();
                    
                    const auctionEmbed = new EmbedBuilder()
                        .setColor('#ffd700')
                        .setTitle('🏛️ 김헌터 경매장')
                        .setDescription('아이템을 사고팔 수 있는 경매장입니다!')
                        .addFields(
                            { name: '📊 현재 등록된 매물', value: `${AUCTION_HOUSE.listings.size}개`, inline: true },
                            { name: '💰 24시간 거래량', value: '준비중', inline: true },
                            { name: '🔥 인기 아이템', value: AUCTION_HOUSE.topItems.length > 0 ? AUCTION_HOUSE.topItems[0] : '없음', inline: true }
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
                    
                    return await interaction.editReply({ embeds: [auctionEmbed], components: [auctionButtons1, auctionButtons2] });
                    
                case 'ranking':
                    // 랭킹
                    await interaction.deferReply();
                    
                    const rankingEmbed = new EmbedBuilder()
                        .setColor('#ff4500')
                        .setTitle('🏆 김헌터 랭킹')
                        .setDescription('다양한 분야의 최강자들을 확인하세요!');
                    
                    const rankingButtons1 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('ranking_level')
                                .setLabel('📊 레벨 랭킹')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('ranking_gold')
                                .setLabel('💰 재산 랭킹')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('ranking_popularity')
                                .setLabel('❤️ 인기도 랭킹')
                                .setStyle(ButtonStyle.Danger)
                        );
                    
                    const rankingButtons2 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('ranking_pvp')
                                .setLabel('⚔️ PVP 랭킹')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('ranking_racing')
                                .setLabel('🏁 레이싱 랭킹')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('ranking_energy')
                                .setLabel('✨ 융합 랭킹')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    
                    return await interaction.editReply({ embeds: [rankingEmbed], components: [rankingButtons1, rankingButtons2] });
                    
                case 'settings':
                    await interaction.reply({
                        content: '⚙️ 메뉴 설정',
                        components: [new ActionRowBuilder().addComponents(createMenuCustomizer())],
                        ephemeral: true
                    });
                    return;
                    
                case 'admin_panel':
                    await interaction.reply({
                        content: '🛠️ 관리자 패널에 접근합니다.',
                        components: [new ActionRowBuilder().addComponents(createAdminPanel())],
                        ephemeral: true
                    });
                    return;
                    
                default:
                    await interaction.reply({ 
                        content: `❌ 알 수 없는 메뉴: ${selectedValue}`, 
                        ephemeral: true 
                    });
            }
        }
        
        // 메뉴 커스터마이징 처리
        else if (customId === 'customize_menu') {
            const selectedValue = values[0];
            
            switch (selectedValue) {
                case 'reorder_menu':
                    // 메뉴 순서 변경
                    const user = await User.findOne({ discordId: interaction.user.id });
                    const currentOrder = user?.menuSettings?.menuOrder || [
                        'daily', 'work', 'quest', 
                        'hunting', 'racing', 'pvp', 'mushroom', 'oddeven',
                        'stats', 'skills', 'equipment', 'enhancement',
                        'shop', 'inventory', 'stocks', 'artifacts', 'auction',
                        'ranking', 'profile'
                    ];
                    
                    // 현재 순서를 보여주는 드롭다운 생성
                    const reorderMenu = new StringSelectMenuBuilder()
                        .setCustomId('reorder_select')
                        .setPlaceholder('🔽 위로 올릴 메뉴를 선택하세요')
                        .addOptions(
                            currentOrder.map((menuId, index) => {
                                const menuDef = MENU_DEFINITIONS[menuId];
                                return {
                                    label: `${index + 1}. ${menuDef.label}`,
                                    description: menuDef.description,
                                    value: menuId,
                                    emoji: menuDef.emoji
                                };
                            })
                        );
                    
                    await interaction.reply({
                        content: '📋 메뉴 순서 변경 - 위로 올릴 메뉴를 선택하세요',
                        components: [new ActionRowBuilder().addComponents(reorderMenu)],
                        ephemeral: true
                    });
                    break;
                    
                case 'favorite_menu':
                    // 즐겨찾기 설정
                    const favUser = await User.findOne({ discordId: interaction.user.id });
                    const favoriteMenus = favUser?.menuSettings?.favoriteMenus || [];
                    const allMenus = Object.keys(MENU_DEFINITIONS);
                    
                    const favoriteMenu = new StringSelectMenuBuilder()
                        .setCustomId('favorite_toggle')
                        .setPlaceholder('⭐ 즐겨찾기 추가/제거할 메뉴 선택')
                        .addOptions(
                            allMenus.map(menuId => {
                                const menuDef = MENU_DEFINITIONS[menuId];
                                const isFavorite = favoriteMenus.includes(menuId);
                                return {
                                    label: `${isFavorite ? '⭐ ' : ''}${menuDef.label}`,
                                    description: `${menuDef.description} ${isFavorite ? '(즐겨찾기 해제)' : '(즐겨찾기 추가)'}`,
                                    value: menuId,
                                    emoji: menuDef.emoji
                                };
                            })
                        );
                    
                    await interaction.reply({
                        content: '⭐ 즐겨찾기 메뉴 설정',
                        components: [new ActionRowBuilder().addComponents(favoriteMenu)],
                        ephemeral: true
                    });
                    break;
                    
                case 'toggle_menu':
                    // 메뉴 숨기기/보이기
                    const hideUser = await User.findOne({ discordId: interaction.user.id });
                    const hiddenMenus = hideUser?.menuSettings?.hiddenMenus || [];
                    const visibleMenus = Object.keys(MENU_DEFINITIONS);
                    
                    const toggleMenu = new StringSelectMenuBuilder()
                        .setCustomId('hide_toggle')
                        .setPlaceholder('👁️ 숨기기/보이기할 메뉴 선택')
                        .addOptions(
                            visibleMenus.map(menuId => {
                                const menuDef = MENU_DEFINITIONS[menuId];
                                const isHidden = hiddenMenus.includes(menuId);
                                return {
                                    label: `${isHidden ? '🚫 ' : '👁️ '}${menuDef.label}`,
                                    description: `${menuDef.description} ${isHidden ? '(숨김 → 보이기)' : '(보이기 → 숨김)'}`,
                                    value: menuId,
                                    emoji: menuDef.emoji
                                };
                            })
                        );
                    
                    await interaction.reply({
                        content: '👁️ 메뉴 숨기기/보이기 설정',
                        components: [new ActionRowBuilder().addComponents(toggleMenu)],
                        ephemeral: true
                    });
                    break;
                    
                case 'menu_style':
                    await interaction.reply({
                        content: '🎨 메뉴 스타일 변경 기능은 준비 중입니다.',
                        ephemeral: true
                    });
                    break;
                    
                case 'reset_menu':
                    // 메뉴 설정 초기화
                    await User.findOneAndUpdate(
                        { discordId: user.id },
                        { 
                            $unset: { 
                                'menuSettings.menuOrder': 1,
                                'menuSettings.favoriteMenus': 1,
                                'menuSettings.hiddenMenus': 1
                            }
                        }
                    );
                    await interaction.reply({
                        content: '🔄 메뉴 설정이 초기화되었습니다!',
                        ephemeral: true
                    });
                    break;
            }
        }
        
        // 관리자 패널 처리
        else if (customId === 'admin_panel' && isAdmin(user.id)) {
            const selectedValue = values[0];
            
            switch (selectedValue) {
                case 'admin_users':
                    await interaction.reply({
                        content: '👥 사용자 관리',
                        components: [new ActionRowBuilder().addComponents(createUserManagementMenu())],
                        ephemeral: true
                    });
                    break;
                    
                case 'admin_economy':
                    await interaction.reply({
                        content: '💰 경제 관리',
                        components: [new ActionRowBuilder().addComponents(createEconomyManagementMenu())],
                        ephemeral: true
                    });
                    break;
                    
                case 'admin_system':
                    await interaction.reply({
                        content: '🔧 시스템 제어',
                        components: [new ActionRowBuilder().addComponents(createSystemControlMenu())],
                        ephemeral: true
                    });
                    break;
                    
                case 'admin_stats':
                    await interaction.deferReply({ ephemeral: true });
                    const totalUsers = await User.countDocuments();
                    const totalGold = await User.aggregate([
                        { $group: { _id: null, total: { $sum: '$gold' } } }
                    ]);
                    
                    const statsEmbed = new EmbedBuilder()
                        .setTitle('📊 서버 통계')
                        .addFields(
                            { name: '👥 총 사용자 수', value: totalUsers.toString(), inline: true },
                            { name: '💰 총 골드량', value: (totalGold[0]?.total || 0).toLocaleString(), inline: true },
                            { name: '🤖 봇 상태', value: '정상 작동', inline: true }
                        )
                        .setColor('Blue');
                        
                    await interaction.editReply({ embeds: [statsEmbed] });
                    break;
                    
                default:
                    await interaction.reply({
                        content: `🔧 ${selectedValue} 기능은 준비 중입니다.`,
                        ephemeral: true
                    });
            }
        }
        
        // 메뉴 순서 변경 처리
        else if (customId === 'reorder_select') {
            const selectedMenu = values[0];
            const user = await User.findOne({ discordId: interaction.user.id });
            const currentOrder = user?.menuSettings?.menuOrder || [
                'daily', 'work', 'quest', 
                'hunting', 'racing', 'pvp', 'mushroom', 'oddeven',
                'stats', 'skills', 'equipment', 'enhancement',
                'shop', 'inventory', 'stocks', 'artifacts', 'auction',
                'ranking', 'profile'
            ];
            
            // 선택한 메뉴를 맨 위로 이동
            const newOrder = currentOrder.filter(id => id !== selectedMenu);
            newOrder.unshift(selectedMenu);
            
            await User.findOneAndUpdate(
                { discordId: interaction.user.id },
                { 'menuSettings.menuOrder': newOrder },
                { upsert: true }
            );
            
            await interaction.reply({
                content: `✅ **${MENU_DEFINITIONS[selectedMenu].label}** 메뉴가 맨 위로 이동되었습니다!`,
                ephemeral: true
            });
        }
        
        // 즐겨찾기 토글 처리
        else if (customId === 'favorite_toggle') {
            const selectedMenu = values[0];
            const user = await User.findOne({ discordId: interaction.user.id });
            const favoriteMenus = user?.menuSettings?.favoriteMenus || [];
            
            let newFavorites;
            let message;
            
            if (favoriteMenus.includes(selectedMenu)) {
                // 즐겨찾기에서 제거
                newFavorites = favoriteMenus.filter(id => id !== selectedMenu);
                message = `⭐ **${MENU_DEFINITIONS[selectedMenu].label}** 메뉴가 즐겨찾기에서 제거되었습니다.`;
            } else {
                // 즐겨찾기에 추가
                newFavorites = [...favoriteMenus, selectedMenu];
                message = `⭐ **${MENU_DEFINITIONS[selectedMenu].label}** 메뉴가 즐겨찾기에 추가되었습니다!`;
            }
            
            await User.findOneAndUpdate(
                { discordId: interaction.user.id },
                { 'menuSettings.favoriteMenus': newFavorites },
                { upsert: true }
            );
            
            await interaction.reply({
                content: message,
                ephemeral: true
            });
        }
        
        // 메뉴 숨김 토글 처리
        else if (customId === 'hide_toggle') {
            const selectedMenu = values[0];
            const user = await User.findOne({ discordId: interaction.user.id });
            const hiddenMenus = user?.menuSettings?.hiddenMenus || [];
            
            let newHidden;
            let message;
            
            if (hiddenMenus.includes(selectedMenu)) {
                // 숨김에서 제거 (보이기)
                newHidden = hiddenMenus.filter(id => id !== selectedMenu);
                message = `👁️ **${MENU_DEFINITIONS[selectedMenu].label}** 메뉴가 다시 표시됩니다.`;
            } else {
                // 숨김에 추가
                newHidden = [...hiddenMenus, selectedMenu];
                message = `🚫 **${MENU_DEFINITIONS[selectedMenu].label}** 메뉴가 숨겨졌습니다.`;
            }
            
            await User.findOneAndUpdate(
                { discordId: interaction.user.id },
                { 'menuSettings.hiddenMenus': newHidden },
                { upsert: true }
            );
            
            await interaction.reply({
                content: message,
                ephemeral: true
            });
        }
        
    } catch (error) {
        console.error('메뉴 시스템 오류:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: '❌ 오류가 발생했습니다. 다시 시도해주세요.', 
                ephemeral: true 
            });
        }
    }
});

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`명령어 실행 - 채널: ${interaction.channelId}, 사용자: ${interaction.user.id}, 베타 모드: ${BETA_MODE}`);
    
    // 베타 모드 체크
    if (BETA_MODE) {
        // 베타 채널이 아닌 경우
        if (!isBetaChannel(interaction.channelId)) {
            await interaction.reply({ 
                content: '🚧 현재 클로즈베타 테스트 중입니다.\n지정된 베타 채널에서만 사용 가능합니다.', 
                ephemeral: true 
            });
            return;
        }
        
        // 베타 테스터가 아닌 경우
        if (!isBetaTester(interaction.user.id)) {
            await interaction.reply({ 
                content: '🔒 현재 클로즈베타 테스트 중입니다.\n베타 테스터로 등록된 사용자만 이용할 수 있습니다.', 
                ephemeral: true 
            });
            return;
        }
    }
    
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

            // 커스터마이징된 드롭다운 메뉴 생성
            const mainMenu = await createCustomizedMenu(interaction.user.id);
            const menuRow = new ActionRowBuilder().addComponents(mainMenu);

            // 시간대별 이미지 첨부파일
            const timeAttachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });
            
            await interaction.editReply({ 
                embeds: [statusEmbed], 
                components: [menuRow], 
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
                await interaction.reply({ content: '이미 최대 강화 단계(30강)입니다!', flags: 64 });
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
            const rates = ENHANCEMENT_RATES[currentStar];
            const isFocusMode = commandName === '집중력';
            const isBlessedDay = commandName === '축복받은날';
            
            const result = attemptEnhanceWithProtection(rates, isFocusMode, isBlessedDay, currentStar, useProtection);
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
                
                // 신식 시스템: getEquippedItem이 이미 인벤토리의 실제 아이템을 참조하므로 별도 업데이트 불필요
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 강화 성공!')
                    .setDescription(`**${equipment.name}**이(가) 강화되었습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} → **+${equipment.enhanceLevel}**강`, inline: true },
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
                
                // 신식 시스템: getEquippedItem이 이미 인벤토리의 실제 아이템을 참조하므로 별도 업데이트 불필요
                
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
            if (isFocusMode) {
                resultEmbed.setFooter({ text: '🌟 집중력 이벤트 적용 (성공률 +5%)' });
            } else if (isBlessedDay && currentStar >= 15 && currentStar <= 22) {
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
            const portfolio = await getPlayerPortfolio(interaction.user.id);
            
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
                    { name: '⭐ 최고 강화', value: `+${stats.maxEnhanceLevel}강`, inline: true },
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
        
        else if (commandName === '홀짝') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }

            await oddEvenGame.showMonsterBattleMenu(interaction);
        }
        
        else if (commandName === '주식복구') {
            // 주식 데이터 복구 명령어 (관리자 전용)
            if (interaction.user.id !== '1123609568397836309') { // 본인 디스코드 ID로 변경
                await interaction.reply({ content: '❌ 관리자만 사용할 수 있는 명령어입니다!', flags: 64 });
                return;
            }
            
            const targetUser = interaction.options.getUser('유저');
            const companyId = interaction.options.getString('기업');
            const shares = interaction.options.getInteger('수량');
            const avgPrice = interaction.options.getInteger('평균가');
            
            try {
                const user = await User.findOne({ discordId: targetUser.id });
                if (!user) {
                    await interaction.reply({ content: '❌ 유저를 찾을 수 없습니다!', flags: 64 });
                    return;
                }
                
                if (!user.stockPortfolio) {
                    user.stockPortfolio = { stocks: new Map(), totalInvested: 0, lastUpdate: new Date() };
                }
                
                // 주식 복구
                user.stockPortfolio.stocks.set(companyId, {
                    shares: shares,
                    avgPrice: avgPrice
                });
                
                await user.save();
                
                const company = findCompany(companyId);
                const companyName = company ? company.name : companyId;
                
                await interaction.reply({
                    content: `✅ **${user.nickname}**님의 주식이 복구되었습니다!\n🏢 ${companyName}: ${shares}주 (평균가: ${avgPrice.toLocaleString()}골드)`,
                    flags: 64
                });
                
            } catch (error) {
                console.error('주식 복구 오류:', error);
                await interaction.reply({ content: '❌ 주식 복구 중 오류가 발생했습니다!', flags: 64 });
            }
        }
        
        else if (commandName === '유물탐사') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 레벨 제한 (레벨 15 이상)
            if (user.level < 15) {
                await interaction.reply({ 
                    content: `유물탐사는 **레벨 15 이상**부터 이용할 수 있습니다! (현재 레벨: ${user.level})`, 
                    flags: 64 
                });
                return;
            }
            
            await showArtifactExplorationMenu(interaction, user);
        }
        
        else if (commandName === '독버섯') {
            const user = await getUser(interaction.user.id);
            
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const difficulty = interaction.options.getString('난이도') || 'solo';
            await mushroomGame.startGame(interaction, user, difficulty);
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
    // 모든 버튼 클릭을 로깅
    if (interaction.isButton()) {
        console.log(`🔴 버튼 클릭됨: ${interaction.customId}`);
    }
    
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    
    if (interaction.customId && interaction.customId.includes('equip')) {
        console.log(`🟢 첫 번째 핸들러에서 equip 처리: ${interaction.customId}`);
    }

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
        // 주식 매수 버튼 처리 (최우선 처리)
        if (interaction.customId.startsWith('buy_stock_')) {
            const companyId = interaction.customId.replace('buy_stock_', '');
            const company = findCompany(companyId);
            
            if (!company) {
                await interaction.reply({ content: '존재하지 않는 기업입니다!', flags: 64 });
                return;
            }
            
            // 매수 모달 생성
            const buyModal = new ModalBuilder()
                .setCustomId(`buy_modal_${companyId}`)
                .setTitle(`${company.name} 주식 매수`);
            
            const sharesInput = new TextInputBuilder()
                .setCustomId('shares')
                .setLabel('매수할 주식 수량')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('1 ~ 1000')
                .setRequired(true)
                .setMaxLength(4);
            
            const actionRow = new ActionRowBuilder().addComponents(sharesInput);
            buyModal.addComponents(actionRow);
            
            await interaction.showModal(buyModal);
            return;
        }
        
        // 주식 매도 버튼 처리 (최우선 처리)
        else if (interaction.customId.startsWith('sell_stock_')) {
            const companyId = interaction.customId.replace('sell_stock_', '');
            const company = findCompany(companyId);
            const portfolio = await getPlayerPortfolio(interaction.user.id);
            
            if (!company) {
                await interaction.reply({ content: '존재하지 않는 기업입니다!', flags: 64 });
                return;
            }
            
            if (!portfolio.stocks.has(companyId)) {
                await interaction.reply({ content: '보유하지 않은 주식입니다!', flags: 64 });
                return;
            }
            
            const holding = portfolio.stocks.get(companyId);
            
            // 매도 모달 생성
            const sellModal = new ModalBuilder()
                .setCustomId(`sell_modal_${companyId}`)
                .setTitle(`${company.name} 주식 매도`);
            
            const sharesInput = new TextInputBuilder()
                .setCustomId('shares')
                .setLabel('매도할 주식 수량')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`1 ~ ${holding.shares}`)
                .setRequired(true)
                .setMaxLength(4);
            
            const actionRow = new ActionRowBuilder().addComponents(sharesInput);
            sellModal.addComponents(actionRow);
            
            await interaction.showModal(sellModal);
            return;
        }
        
        // 메인화면의 게임하기 버튼 처리
        else if (interaction.customId === 'game_start') {
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
            
            // Check if interaction has already been replied/deferred
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [huntGifEmbed], components: [], files: [huntGifAttachment] });
            } else {
                await interaction.update({ embeds: [huntGifEmbed], components: [], files: [huntGifAttachment] });
            }
            
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
                            value: `✨ 경험치: +${finalExp.toLocaleString()} EXP${bonusExp > 0 ? ` (+${bonusExp.toLocaleString()} 보너스)` : ''} | <:currency_emoji:1377404064316522778> 골드: +${adjustedGold.toLocaleString()}${adjustedBonusGold > 0 ? ` (+${adjustedBonusGold.toLocaleString()} 보너스)` : ''}${goldPenalty < 1.0 ? `\n📉 고레벨 페널티: ${Math.round((1-goldPenalty)*100)}% 골드 감소` : ''}${energyFragmentDrop ? `\n🔮 **에너지 조각 획득!** \`${energyFragmentDrop.tier}단계 조각 x${energyFragmentDrop.count}\` ✨` : ''}${droppedItems.length > 0 ? `\n\n🎁 **아이템 드롭!**\n${droppedItems.map(item => {
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
                            value: `🏆 레벨: Lv.${user.level} | ✨ 경험치: ${user.exp}/${user.level * 100} EXP | <:currency_emoji:1377404064316522778> 골드: ${user.gold.toLocaleString()}`, 
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
                            value: `<:currency_emoji:1377404064316522778> 벌금: -${actualPenalty.toLocaleString()} | ❌ 몬스터 드랍 골드의 **${Math.floor(actualPenalty/baseGold)}배** 손실`, 
                            inline: false 
                        },
                        { 
                            name: '📊 현재 상태', 
                            value: `🏆 레벨: Lv.${user.level} | ✨ 경험치: ${user.exp}/${user.level * 100} EXP | <:currency_emoji:1377404064316522778> 골드: ${user.gold.toLocaleString()}`, 
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
            // 운동하기 메인 메뉴 표시
            await showExerciseMenu(interaction, user);
        }
        
        else if (interaction.customId === 'exercise_select') {
            // 운동 선택 메뉴
            const availableExercises = [];
            
            // 사용 가능한 운동 확인
            for (const [id, exercise] of Object.entries(EXERCISE_SYSTEM.exercises)) {
                let canUse = false;
                
                if (exercise.requirements === null) {
                    canUse = true;
                } else if (exercise.requirements === 'gym' && user.fitness.memberships.gym.active) {
                    const now = Date.now();
                    if (user.fitness.memberships.gym.expiresAt > now) {
                        canUse = true;
                    }
                } else if (exercise.requirements === 'premium' && user.fitness.memberships.premium.active) {
                    const now = Date.now();
                    if (user.fitness.memberships.premium.expiresAt > now) {
                        canUse = true;
                    }
                }
                
                if (canUse || user.fitness.unlockedExercises.includes(id)) {
                    availableExercises.push(exercise);
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor('#4ecdc4')
                .setTitle('🏃 운동 선택')
                .setDescription('시작할 운동을 선택해주세요!')
                .addFields({
                    name: '💦 현재 피로도',
                    value: `${user.fitness.fatigue}/100 ${getFatigueBar(user.fitness.fatigue)}`,
                    inline: false
                });
            
            // 카테고리별로 운동 표시
            const categories = {
                basic: { name: '💪 기본 운동', exercises: [] },
                gym: { name: '🏋️ 헬스장 운동', exercises: [] },
                premium: { name: '🏊 프리미엄 운동', exercises: [] }
            };
            
            availableExercises.forEach(exercise => {
                categories[exercise.category].exercises.push(exercise);
            });
            
            for (const [catId, catData] of Object.entries(categories)) {
                if (catData.exercises.length > 0) {
                    let exerciseList = '';
                    catData.exercises.forEach(ex => {
                        const maxMinutes = Math.floor(ex.maxDuration / 60000);
                        exerciseList += `${ex.emoji} **${ex.name}** - 최대 ${maxMinutes}분\n`;
                        exerciseList += `   효과: ${ex.description}\n`;
                        exerciseList += `   보상: ${ex.rewards.goldPerMinute}G/분, ${ex.rewards.expPerMinute}EXP/분\n\n`;
                    });
                    
                    embed.addFields({
                        name: catData.name,
                        value: exerciseList,
                        inline: false
                    });
                }
            }
            
            // 운동 선택 버튼들
            const selectOptions = availableExercises.slice(0, 25).map(exercise => ({
                label: exercise.name,
                description: `${exercise.description} - 피로도 +${Math.round(exercise.fatigueRate * 10)}/10분`,
                value: `start_exercise_${exercise.id}`,
                emoji: exercise.emoji
            }));
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_exercise_type')
                .setPlaceholder('운동을 선택하세요')
                .addOptions(selectOptions);
            
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('🔙 뒤로가기')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [selectRow, backButton]
            });
        }
        
        else if (interaction.customId === 'exercise_equipment') {
            // 운동 장비 메뉴
            const embed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('🎽 운동 장비')
                .setDescription('운동 효율을 높여주는 장비들입니다!')
                .addFields(
                    {
                        name: '👕 운동복',
                        value: Object.entries(EXERCISE_SYSTEM.equipment.clothes).map(([id, item]) => {
                            const equipped = user.fitness.equipment.clothes === id ? ' ✅' : '';
                            const bonus = ((item.efficiency - 1) * 100).toFixed(0);
                            return `${item.name}${equipped}\n효율 ${bonus > 0 ? '+' : ''}${bonus}% | 가격: ${item.cost.toLocaleString()}G`;
                        }).join('\n\n'),
                        inline: true
                    },
                    {
                        name: '👟 운동화',
                        value: Object.entries(EXERCISE_SYSTEM.equipment.shoes).map(([id, item]) => {
                            const equipped = user.fitness.equipment.shoes === id ? ' ✅' : '';
                            const bonus = ((item.speed - 1) * 100).toFixed(0);
                            return `${item.name}${equipped}\n속도 ${bonus > 0 ? '+' : ''}${bonus}% | 가격: ${item.cost.toLocaleString()}G`;
                        }).join('\n\n'),
                        inline: true
                    }
                );
            
            const equipmentButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('buy_clothes_brand')
                        .setLabel('브랜드 운동복 구매')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.fitness.equipment.clothes !== 'basic' || user.gold < 5000),
                    new ButtonBuilder()
                        .setCustomId('buy_clothes_pro')
                        .setLabel('프로 운동복 구매')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.fitness.equipment.clothes === 'pro' || user.gold < 20000),
                    new ButtonBuilder()
                        .setCustomId('buy_shoes_running')
                        .setLabel('러닝화 구매')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.fitness.equipment.shoes !== 'basic' || user.gold < 8000),
                    new ButtonBuilder()
                        .setCustomId('buy_shoes_pro')
                        .setLabel('프로 운동화 구매')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.fitness.equipment.shoes === 'pro' || user.gold < 30000)
                );
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('🔙 운동 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [equipmentButtons, backButton]
            });
        }
        
        else if (interaction.customId === 'exercise_supplements') {
            // 보충제 메뉴
            const now = Date.now();
            const activeBooster = user.fitness.equipment.activeBooster;
            let activeInfo = '현재 사용 중인 보충제가 없습니다.';
            
            if (activeBooster.type && activeBooster.expiresAt > now) {
                const remaining = Math.ceil((activeBooster.expiresAt - now) / 60000);
                const supplement = EXERCISE_SYSTEM.supplements[activeBooster.type];
                activeInfo = `${supplement.emoji} **${supplement.name}** 사용 중 (${remaining}분 남음)`;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#e17055')
                .setTitle('🥤 보충제')
                .setDescription(`운동 효과를 증가시키는 보충제입니다!\n\n${activeInfo}`)
                .addFields(
                    Object.entries(EXERCISE_SYSTEM.supplements).map(([id, item]) => ({
                        name: `${item.emoji} ${item.name}`,
                        value: `${item.description}\n지속: ${Math.floor(item.duration / 60000)}분 | 가격: ${item.cost.toLocaleString()}G`,
                        inline: false
                    }))
                );
            
            const supplementButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('use_supplement_protein')
                        .setLabel('🥤 프로틴 사용')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.gold < 1000 || (activeBooster.type && activeBooster.expiresAt > now)),
                    new ButtonBuilder()
                        .setCustomId('use_supplement_bcaa')
                        .setLabel('💊 BCAA 사용')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.gold < 1500 || (activeBooster.type && activeBooster.expiresAt > now)),
                    new ButtonBuilder()
                        .setCustomId('use_supplement_booster')
                        .setLabel('⚡ 부스터 사용')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.gold < 2000 || (activeBooster.type && activeBooster.expiresAt > now))
                );
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('🔙 운동 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [supplementButtons, backButton]
            });
        }
        
        else if (interaction.customId === 'exercise_goals') {
            // 운동 목표
            const today = new Date().toDateString();
            if (user.fitness.goals.daily.lastReset !== today) {
                user.fitness.goals.daily.minutes30 = false;
                user.fitness.goals.daily.minutes60 = false;
                user.fitness.goals.daily.minutes180 = false;
                user.fitness.goals.daily.claimed30 = false;
                user.fitness.goals.daily.claimed60 = false;
                user.fitness.goals.daily.claimed180 = false;
                user.fitness.goals.daily.lastReset = today;
                await user.save();
            }
            
            const dailyGoals = [
                { 
                    name: '30분 운동', 
                    completed: user.fitness.goals.daily.minutes30,
                    reward: '500G + 100 EXP'
                },
                { 
                    name: '1시간 운동', 
                    completed: user.fitness.goals.daily.minutes60,
                    reward: '1,000G + 300 EXP'
                },
                { 
                    name: '3시간 운동', 
                    completed: user.fitness.goals.daily.minutes180,
                    reward: '3,000G + 1,000 EXP'
                }
            ];
            
            const embed = new EmbedBuilder()
                .setColor('#74b9ff')
                .setTitle('🎯 운동 목표')
                .setDescription('일일 목표를 달성하고 추가 보상을 받으세요!')
                .addFields(
                    {
                        name: '📅 일일 목표',
                        value: dailyGoals.map(goal => 
                            `${goal.completed ? '✅' : '⬜'} **${goal.name}**\n   보상: ${goal.reward}`
                        ).join('\n\n'),
                        inline: false
                    },
                    {
                        name: '📊 진행 상황',
                        value: `오늘 운동 시간: ${Math.floor(getTodayExerciseTime(user) / 60000)}분\n연속 운동: ${user.fitness.streak}일`,
                        inline: false
                    }
                );
            
            const claimButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_goal_30')
                        .setLabel('30분 보상 수령')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(!user.fitness.goals.daily.minutes30 || user.fitness.goals.daily.claimed30),
                    new ButtonBuilder()
                        .setCustomId('claim_goal_60')
                        .setLabel('1시간 보상 수령')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(!user.fitness.goals.daily.minutes60 || user.fitness.goals.daily.claimed60),
                    new ButtonBuilder()
                        .setCustomId('claim_goal_180')
                        .setLabel('3시간 보상 수령')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(!user.fitness.goals.daily.minutes180 || user.fitness.goals.daily.claimed180),
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('🔙 운동 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [claimButtons]
            });
        }
        
        else if (interaction.customId === 'exercise_stats') {
            // 운동 통계
            const totalMinutes = Math.floor(user.fitness.totalExerciseTime / 60000);
            const totalHours = Math.floor(totalMinutes / 60);
            const remainingMinutes = totalMinutes % 60;
            
            // 최근 7일 운동 기록
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const recentExercises = user.fitness.exerciseHistory
                .filter(record => new Date(record.date) > sevenDaysAgo)
                .slice(-10);
            
            // 운동별 통계
            const exerciseStats = {};
            user.fitness.exerciseHistory.forEach(record => {
                if (!exerciseStats[record.type]) {
                    exerciseStats[record.type] = {
                        count: 0,
                        totalTime: 0,
                        totalGold: 0
                    };
                }
                exerciseStats[record.type].count++;
                exerciseStats[record.type].totalTime += record.duration;
                exerciseStats[record.type].totalGold += record.rewards.gold;
            });
            
            // 가장 많이 한 운동
            let favoriteExercise = null;
            let maxCount = 0;
            for (const [type, stats] of Object.entries(exerciseStats)) {
                if (stats.count > maxCount) {
                    maxCount = stats.count;
                    favoriteExercise = type;
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor('#00cec9')
                .setTitle('📊 운동 통계')
                .setDescription(`**${user.nickname}**님의 운동 기록`)
                .addFields(
                    {
                        name: '⏱️ 총 운동 시간',
                        value: `${totalHours}시간 ${remainingMinutes}분`,
                        inline: true
                    },
                    {
                        name: '💪 피트니스 레벨',
                        value: `Lv.${user.fitness.level}`,
                        inline: true
                    },
                    {
                        name: '🔥 최장 연속',
                        value: `${user.fitness.streak}일`,
                        inline: true
                    },
                    {
                        name: '🏃 즐겨하는 운동',
                        value: favoriteExercise ? EXERCISE_SYSTEM.exercises[favoriteExercise].name : '없음',
                        inline: true
                    },
                    {
                        name: '💰 총 획득 골드',
                        value: `${user.fitness.exerciseHistory.reduce((sum, r) => sum + r.rewards.gold, 0).toLocaleString()}G`,
                        inline: true
                    },
                    {
                        name: '📈 총 운동 횟수',
                        value: `${user.fitness.exerciseHistory.length}회`,
                        inline: true
                    }
                );
            
            if (recentExercises.length > 0) {
                const recentList = recentExercises.map(record => {
                    const exercise = EXERCISE_SYSTEM.exercises[record.type];
                    const minutes = Math.floor(record.duration / 60000);
                    return `${exercise.emoji} ${exercise.name} - ${minutes}분`;
                }).join('\n');
                
                embed.addFields({
                    name: '📅 최근 운동 기록',
                    value: recentList,
                    inline: false
                });
            }
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('work')
                        .setLabel('🔙 운동 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [embed],
                components: [backButton]
            });
        }
        
        else if (interaction.customId === 'exercise_membership') {
            // 이용권 메뉴 (미구현)
            await interaction.reply({ 
                content: '이용권 시스템은 준비 중입니다!', 
                flags: 64 
            });
        }
        
        else if (interaction.customId === 'ranking') {
            // 통합 랭킹 메뉴
            await showRankingMenu(interaction, 0);
        }
        
        // 랭킹 페이지 네비게이션
        else if (interaction.customId.startsWith('ranking_prev_')) {
            const currentPage = parseInt(interaction.customId.replace('ranking_prev_', ''));
            await showRankingMenu(interaction, Math.max(0, currentPage - 1));
        }
        
        else if (interaction.customId.startsWith('ranking_next_')) {
            const currentPage = parseInt(interaction.customId.replace('ranking_next_', ''));
            await showRankingMenu(interaction, currentPage + 1);
        }
        
        else if (interaction.customId === 'ranking_select') {
            // 랭킹 카테고리 선택 메뉴
            const selectOptions = [
                { label: '📈 레벨 랭킹', value: 'ranking_goto_0', emoji: '📈' },
                { label: '💰 부자 랭킹', value: 'ranking_goto_1', emoji: '💰' },
                { label: '🎯 사냥 랭킹', value: 'ranking_goto_2', emoji: '🎯' },
                { label: '⚔️ 강화 랭킹', value: 'ranking_goto_3', emoji: '⚔️' },
                { label: '🏆 PVP 랭킹', value: 'ranking_goto_4', emoji: '🏆' },
                { label: '🏁 레이싱 랭킹', value: 'ranking_goto_5', emoji: '🏁' },
                { label: '⚡ 에너지 랭킹', value: 'ranking_goto_6', emoji: '⚡' },
                { label: '🎲 홀짝 랭킹', value: 'ranking_goto_7', emoji: '🎲' },
                { label: '🏺 유물 랭킹', value: 'ranking_goto_8', emoji: '🏺' },
                { label: '💪 운동 랭킹', value: 'ranking_goto_9', emoji: '💪' },
                { label: '❤️ 인기 랭킹', value: 'ranking_goto_10', emoji: '❤️' },
                { label: '🔥 출석 랭킹', value: 'ranking_goto_11', emoji: '🔥' }
            ];
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ranking_category_select')
                .setPlaceholder('랭킹 카테고리를 선택하세요')
                .addOptions(selectOptions);
            
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            
            await interaction.update({ 
                components: [selectRow] 
            });
        }
        
        else if (interaction.customId === 'exercise_ranking') {
            // 운동 랭킹 페이지로 이동
            await showRankingMenu(interaction, 9);
        }
        
        // 장비 구매 핸들러들
        else if (interaction.customId.startsWith('buy_clothes_')) {
            const type = interaction.customId.replace('buy_clothes_', '');
            const item = EXERCISE_SYSTEM.equipment.clothes[type];
            
            if (user.gold < item.cost) {
                await interaction.reply({ content: '골드가 부족합니다!', flags: 64 });
                return;
            }
            
            user.gold -= item.cost;
            user.fitness.equipment.clothes = type;
            await user.save();
            
            await interaction.reply({ 
                content: `✅ **${item.name}**을(를) 구매했습니다! 운동 효율이 증가합니다.`, 
                flags: 64 
            });
        }
        
        else if (interaction.customId.startsWith('buy_shoes_')) {
            const type = interaction.customId.replace('buy_shoes_', '');
            const item = EXERCISE_SYSTEM.equipment.shoes[type];
            
            if (user.gold < item.cost) {
                await interaction.reply({ content: '골드가 부족합니다!', flags: 64 });
                return;
            }
            
            user.gold -= item.cost;
            user.fitness.equipment.shoes = type;
            await user.save();
            
            await interaction.reply({ 
                content: `✅ **${item.name}**을(를) 구매했습니다! 운동 속도가 증가합니다.`, 
                flags: 64 
            });
        }
        
        // 보충제 사용 핸들러
        else if (interaction.customId.startsWith('use_supplement_')) {
            const type = interaction.customId.replace('use_supplement_', '');
            const supplement = EXERCISE_SYSTEM.supplements[type];
            
            if (user.gold < supplement.cost) {
                await interaction.reply({ content: '골드가 부족합니다!', flags: 64 });
                return;
            }
            
            const now = Date.now();
            if (user.fitness.equipment.activeBooster.type && user.fitness.equipment.activeBooster.expiresAt > now) {
                await interaction.reply({ content: '이미 보충제를 사용 중입니다!', flags: 64 });
                return;
            }
            
            user.gold -= supplement.cost;
            user.fitness.equipment.activeBooster = {
                type: type,
                expiresAt: new Date(now + supplement.duration)
            };
            await user.save();
            
            await interaction.reply({ 
                content: `✅ ${supplement.emoji} **${supplement.name}**을(를) 사용했습니다!\n${supplement.description}`, 
                flags: 64 
            });
        }
        
        // 목표 보상 수령 핸들러
        else if (interaction.customId.startsWith('claim_goal_')) {
            const goalType = interaction.customId.replace('claim_goal_', '');
            const rewards = {
                '30': { gold: 500, exp: 100 },
                '60': { gold: 1000, exp: 300 },
                '180': { gold: 3000, exp: 1000 }
            };
            
            const reward = rewards[goalType];
            if (!reward) {
                await interaction.reply({ content: '잘못된 목표입니다!', flags: 64 });
                return;
            }
            
            // 이미 수령했는지 확인
            if (user.fitness.goals.daily[`claimed${goalType}`]) {
                await interaction.reply({ content: '이미 보상을 수령했습니다!', flags: 64 });
                return;
            }
            
            user.gold += reward.gold;
            user.exp += reward.exp;
            user.fitness.goals.daily[`claimed${goalType}`] = true;
            
            // 레벨업 체크
            const { leveledUp, levelsGained, oldLevel } = processLevelUp(user);
            await user.save();
            
            const levelUpMessage = leveledUp ? `\n🎉 **레벨업!** Lv.${oldLevel} → Lv.${user.level}` : '';
            
            await interaction.reply({ 
                content: `✅ ${goalType}분 운동 목표 보상을 수령했습니다!\n💰 +${reward.gold.toLocaleString()}G | ✨ +${reward.exp} EXP${levelUpMessage}`, 
                flags: 64 
            });
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
                    { name: '운동상태', value: user.fitness.currentExercise.type ? '운동중' : '대기중', inline: true },
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
        
        // 상점 카테고리 버튼 처리 (shop_weapon, shop_armor 등)
        else if (interaction.customId.startsWith('shop_') && !interaction.customId.includes('_page') && interaction.customId !== 'shop_category') {
            const category = interaction.customId.replace('shop_', '');
            
            // 전역 상점 카테고리 데이터 사용
            const categoryData = SHOP_CATEGORIES[category];
            if (!categoryData) {
                await interaction.reply({ content: '해당 카테고리는 아직 준비 중입니다!', flags: 64 });
                return;
            }
            
            // 카테고리 이미지 첨부파일 생성
            const categoryAttachment = new AttachmentBuilder(
                path.join(__dirname, 'resource', categoryData.image), 
                { name: categoryData.image }
            );
            
            // 첫 번째 페이지 데이터
            const currentPage = 0;
            const itemsPerPage = 4;
            const startIndex = currentPage * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, categoryData.items.length);
            const currentItems = categoryData.items.slice(startIndex, endIndex);
            const totalPages = Math.ceil(categoryData.items.length / itemsPerPage);
            
            // 카테고리 정보 임베드
            const description = `**${user.nickname}** 모험가님의 현재 보유금액: **${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>**\n\n구매하고 싶은 아이템을 선택하세요!`;
            
            const categoryEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle(`🛒 ${categoryData.name}`)
                .setDescription(description)
                .setImage(`attachment://${categoryData.image}`)
                .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages}` });
            
            // 아이템 버튼들 생성 (최대 2행)
            const itemButtons = [];
            for (let i = 0; i < currentItems.length; i += 2) {
                const row = new ActionRowBuilder();
                
                // 첫 번째 아이템
                if (currentItems[i]) {
                    const item = currentItems[i];
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${item.id}`)
                            .setLabel(`${item.name} (${item.price.toLocaleString()}G)`)
                            .setStyle(ButtonStyle.Success)
                            .setEmoji(item.emoji || '💎')
                    );
                }
                
                // 두 번째 아이템 (있는 경우)
                if (currentItems[i + 1]) {
                    const item = currentItems[i + 1];
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`buy_${item.id}`)
                            .setLabel(`${item.name} (${item.price.toLocaleString()}G)`)
                            .setStyle(ButtonStyle.Success)
                            .setEmoji(item.emoji || '💎')
                    );
                }
                
                itemButtons.push(row);
            }
            
            // 네비게이션 버튼
            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_prev_page`)
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_page_info`)
                        .setLabel(`${currentPage + 1}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`shop_${category}_next_page`)
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
            
            await interaction.reply({
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
                
                // 더 안전한 장착 상태 확인
                let isEquipped = false;
                if (user.equipment && user.equipment[item.type]) {
                    const equippedItem = user.equipment[item.type];
                    if (typeof equippedItem === 'object' && equippedItem.id) {
                        isEquipped = (equippedItem.id === item.id);
                    }
                }
                
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}강)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? ' -착용중' : ''}\n`;
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
                
                console.log(`아이템 ${item.name} (${item.id}) - type: ${item.type}`);
                console.log(`현재 장착된 ${item.type}:`, user.equipment[item.type]);
                
                // 더 안전한 장착 상태 확인
                let isEquipped = false;
                if (user.equipment && user.equipment[item.type]) {
                    const equippedItem = user.equipment[item.type];
                    if (typeof equippedItem === 'object' && equippedItem.id) {
                        isEquipped = (equippedItem.id === item.id);
                    }
                }
                
                const isEquipment = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(item.type);
                
                console.log(`${item.name} - isEquipped: ${isEquipped}, equippedId: ${user.equipment[item.type]?.id || 'none'}`);
                
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
            
            // customId 파싱: inv_use_{itemId}_{category}_{currentPage}
            // itemId에 _가 포함되어 있으므로 마지막 두 부분을 제거하여 itemId 추출
            const customId = interaction.customId;
            const parts = customId.split('_');
            const currentPage = parseInt(parts[parts.length - 1]); // 마지막 부분
            const category = parts[parts.length - 2]; // 마지막에서 두 번째 부분
            const itemId = parts.slice(2, parts.length - 2).join('_'); // 나머지 부분들을 합쳐서 itemId
            
            
            const inventoryItem = user.inventory.find(inv => inv.id === itemId);
            
            if (inventoryItem) {
                // inventorySlot이 없는 경우 자동 할당
                if (inventoryItem.inventorySlot === undefined || inventoryItem.inventorySlot === null) {
                    const availableSlot = getAvailableInventorySlot(user);
                    if (availableSlot !== -1) {
                        inventoryItem.inventorySlot = availableSlot;
                    } else {
                        await interaction.reply({ content: '인벤토리가 가득 찼습니다!', flags: 64 });
                        return;
                    }
                }
            }
            
            if (!inventoryItem) {
                await interaction.reply({ content: `해당 아이템을 찾을 수 없습니다! (ID: ${itemId})`, flags: 64 });
                return;
            }
            
            // 장비 아이템인 경우 장착 처리
            if (['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(inventoryItem.type)) {
                // 이미 착용 중인지 확인 (신식 시스템 - 슬롯 번호 비교)
                if (user.equipment[inventoryItem.type] === inventoryItem.inventorySlot) {
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

                // 장착 전 전투력 계산
                const prevCombatPower = calculateCombatPower(user);
                
                // 이전에 장착된 아이템이 있다면 해제
                const prevSlotIndex = user.equipment[inventoryItem.type];
                
                // ObjectId인 경우 강제로 -1로 설정 (구식 데이터 처리)
                if (prevSlotIndex && typeof prevSlotIndex === 'object') {
                    console.log(`⚠️ 구식 ObjectId 데이터 감지: ${prevSlotIndex} → -1로 변경`);
                    user.equipment[inventoryItem.type] = -1;
                } else if (typeof prevSlotIndex === 'number' && prevSlotIndex !== -1) {
                    // 이전 장착 아이템의 equipped 상태 해제
                    const prevItem = user.inventory.find(item => item.inventorySlot === prevSlotIndex);
                    if (prevItem) {
                        prevItem.equipped = false;
                    }
                }
                
                // 장착 처리 - 신식 시스템 (슬롯 번호 참조)
                user.equipment[inventoryItem.type] = inventoryItem.inventorySlot;
                inventoryItem.equipped = true;
                
                await user.save();
                
                // 장착 후 전투력 계산
                const newCombatPower = calculateCombatPower(user);
                const powerChange = newCombatPower - prevCombatPower;
                const changeText = powerChange > 0 ? `(+${powerChange})` : powerChange < 0 ? `(${powerChange})` : '(변화 없음)';

                const equipEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('⚔️ 장비 착용 완료!')
                    .setDescription(`**${inventoryItem.name}**을(를) 성공적으로 착용했습니다!`)
                    .addFields(
                        { name: '착용한 아이템', value: `${inventoryItem.name}${inventoryItem.enhanceLevel > 0 ? ` (+${inventoryItem.enhanceLevel}강)` : ''}`, inline: true },
                        { name: '아이템 등급', value: inventoryItem.rarity, inline: true },
                        { name: '변화된 전투력', value: `${prevCombatPower.toLocaleString()} → ${newCombatPower.toLocaleString()} ${changeText}`, inline: true }
                    );

                // 돌아가기 버튼들
                // category를 올바른 형태로 변환 (weapons → weapon)
                const categoryMap = {
                    'weapons': 'weapon',
                    'armor': 'armor', 
                    'helmets': 'helmet',
                    'gloves': 'gloves',
                    'boots': 'boots',
                    'accessories': 'accessory'
                };
                const equipCategory = categoryMap[category] || inventoryItem.type;
                
                const backButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`equip_category_${equipCategory}`)
                            .setLabel('🔙 해당 카테고리로 돌아가기')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('inventory')
                            .setLabel('🏠 인벤토리 메인으로 돌아가기')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.update({
                    embeds: [equipEmbed],
                    components: [backButtons]
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
        
        // 장비 해제 처리
        else if (interaction.customId.startsWith('unequip_')) {
            const equipSlot = interaction.customId.replace('unequip_', '');
            
            const slotIndex = user.equipment[equipSlot];
            if (slotIndex === -1 || slotIndex === null || slotIndex === undefined || typeof slotIndex === 'object') {
                await interaction.update({ content: '해제할 장비가 없습니다!', embeds: [], components: [] });
                return;
            }
            
            // 해제 전 전투력 계산
            const prevCombatPower = calculateCombatPower(user);
            
            // 장착된 아이템의 equipped 상태 해제
            const unequippedItem = user.inventory.find(item => item.inventorySlot === slotIndex);
            if (unequippedItem) {
                unequippedItem.equipped = false;
            }
            
            // 장비 슬롯 비우기
            user.equipment[equipSlot] = -1;
            await user.save();
            
            // 해제 후 전투력 계산
            const newCombatPower = calculateCombatPower(user);
            const powerChange = newCombatPower - prevCombatPower;
            const changeText = powerChange > 0 ? `(+${powerChange})` : powerChange < 0 ? `(${powerChange})` : '(변화 없음)';
            
            const unequipEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🔓 장비 해제 완료!')
                .setDescription(`**${unequippedItem.name}**을(를) 해제했습니다!`)
                .addFields(
                    { name: '해제한 아이템', value: `${unequippedItem.name}${unequippedItem.enhanceLevel > 0 ? ` (+${unequippedItem.enhanceLevel}강)` : ''}`, inline: true },
                    { name: '아이템 등급', value: unequippedItem.rarity, inline: true },
                    { name: '변화된 전투력', value: `${prevCombatPower.toLocaleString()} → ${newCombatPower.toLocaleString()} ${changeText}`, inline: true }
                );

            // 돌아가기 버튼들 (장비 해제는 장비 메뉴에서 진행되므로)
            const backButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('🔙 장비 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('game_page_1')
                        .setLabel('🏠 게임 메인으로 돌아가기')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [unequipEmbed],
                components: [backButtons]
            });
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
                    const isEquipped = user.equipment[item.type] === item.inventorySlot;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}강)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? ' -착용중' : ''}\n`;
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
                    const isEquipped = user.equipment[item.type] === item.inventorySlot;
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
                    { name: '⚔️ 무기', value: getEquippedItem(user, 'weapon') ? (() => {
                        const weapon = getEquippedItem(user, 'weapon');
                        const enhanceLevel = weapon.enhanceLevel || 0;
                        const baseAttack = weapon.stats?.attack || [0, 0];
                        const minAttack = Array.isArray(baseAttack) ? baseAttack[0] : baseAttack;
                        const maxAttack = Array.isArray(baseAttack) ? baseAttack[1] : baseAttack;
                        const enhanceBonus = enhanceLevel * 2; // 강화당 +2 공격력
                        return `${weapon.name}${enhanceLevel > 0 ? ` (+${enhanceLevel}강)` : ''}\n공격력: ${minAttack + enhanceBonus}-${maxAttack + enhanceBonus}`;
                    })() : '미착용', inline: true },
                    { name: '🛡️ 갑옷', value: getEquippedItem(user, 'armor') ? (() => {
                        const armor = getEquippedItem(user, 'armor');
                        const enhanceLevel = armor.enhanceLevel || 0;
                        const baseDefense = armor.stats?.defense || [0, 0];
                        const minDefense = Array.isArray(baseDefense) ? baseDefense[0] : baseDefense;
                        const maxDefense = Array.isArray(baseDefense) ? baseDefense[1] : baseDefense;
                        const enhanceBonus = enhanceLevel * 2; // 강화당 +2 방어력
                        return `${armor.name}${enhanceLevel > 0 ? ` (+${enhanceLevel}강)` : ''}\n방어력: ${minDefense + enhanceBonus}-${maxDefense + enhanceBonus}`;
                    })() : '미착용', inline: true },
                    { name: '⛑️ 헬멧', value: getEquippedItem(user, 'helmet') ? `${getEquippedItem(user, 'helmet').name}${(getEquippedItem(user, 'helmet').enhanceLevel || 0) > 0 ? ` (+${getEquippedItem(user, 'helmet').enhanceLevel}강)` : ''}` : '미착용', inline: true },
                    { name: '🧤 장갑', value: getEquippedItem(user, 'gloves') ? `${getEquippedItem(user, 'gloves').name}${(getEquippedItem(user, 'gloves').enhanceLevel || 0) > 0 ? ` (+${getEquippedItem(user, 'gloves').enhanceLevel}강)` : ''}` : '미착용', inline: true },
                    { name: '👢 부츠', value: getEquippedItem(user, 'boots') ? `${getEquippedItem(user, 'boots').name}${(getEquippedItem(user, 'boots').enhanceLevel || 0) > 0 ? ` (+${getEquippedItem(user, 'boots').enhanceLevel}강)` : ''}` : '미착용', inline: true },
                    { name: '💎 액세서리', value: getEquippedItem(user, 'accessory') ? `${getEquippedItem(user, 'accessory').name}${(getEquippedItem(user, 'accessory').enhanceLevel || 0) > 0 ? ` (+${getEquippedItem(user, 'accessory').enhanceLevel}강)` : ''}` : '미착용', inline: true }
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

            // 장착된 아이템 해제 버튼들
            const unequipButtons = new ActionRowBuilder();
            const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
            const buttonLabels = ['⚔️', '🛡️', '⛑️', '🧤', '👢', '💎'];
            
            equipmentSlots.forEach((slot, index) => {
                const slotValue = user.equipment[slot];
                if (slotValue !== -1 && slotValue !== null && slotValue !== undefined && typeof slotValue === 'number') {
                    unequipButtons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`unequip_${slot}`)
                            .setLabel(`${buttonLabels[index]} 해제`)
                            .setStyle(ButtonStyle.Danger)
                    );
                }
            });

            const components = [categoryButtons, categoryButtons2];
            if (unequipButtons.components.length > 0) {
                components.push(unequipButtons);
            }

            await interaction.update({ 
                embeds: [equipmentEmbed], 
                components: components,
                files: [equipmentAttachment]
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

            console.log(`${category} 카테고리 아이템 표시 - 총 ${categoryItems.length}개, 현재 페이지: ${currentPage + 1}`);
            console.log('현재 페이지 아이템들:', currentItems.map((item, idx) => `${idx}: ${item.name} (ID: ${item.id || 'NO_ID'})`));

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
                const isEquipped = user.equipment[category] === item.inventorySlot;
                const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}강)` : '';
                
                itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? ' -착용중' : ''}\n`;
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
                const currentEquipped = user.equipment[category];
                
                // 장착 상태 확인 (호환성 고려)
                let isEquipped = false;
                if (currentEquipped) {
                    if (typeof currentEquipped === 'object' && currentEquipped.id === item.id) {
                        isEquipped = true;
                    } else if (typeof currentEquipped === 'number') {
                        const itemIndex = user.inventory.findIndex(inv => inv.id === item.id);
                        isEquipped = (currentEquipped === itemIndex);
                    }
                }
                
                // 아이템 ID가 없으면 인덱스 사용
                const itemIdentifier = item.id || (startIndex + index);
                
                console.log(`버튼 생성 - ${item.name}: itemIdentifier=${itemIdentifier}, customId=equip_item_${itemIdentifier}_${category}_${currentPage}`);
                
                itemButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_item_${itemIdentifier}_${category}_${currentPage}`)
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
            console.log('=== 장착 핸들러 진입 ===');
            
            // ObjectId 데이터 문제 해결을 위해 user 객체 새로 로드
            const freshUser = await User.findOne({ discordId: interaction.user.id });
            if (!freshUser) {
                await interaction.update({ content: '유저 데이터를 찾을 수 없습니다!', embeds: [], components: [] });
                return;
            }
            
            // customId 파싱: equip_item_{itemId}_{category}_{currentPage}
            // itemId에 _가 포함되어 있으므로 마지막 두 부분을 제거하여 itemId 추출
            const customId = interaction.customId;
            const parts = customId.split('_');
            const currentPage = parseInt(parts[parts.length - 1]); // 마지막 부분
            const category = parts[parts.length - 2]; // 마지막에서 두 번째 부분
            const itemId = parts.slice(2, parts.length - 2).join('_'); // 나머지 부분들을 합쳐서 itemId
            
            console.log(`장착 시도 - itemId: ${itemId}, category: ${category}`);
            console.log(`사용자 인벤토리 아이템 수: ${freshUser.inventory.length}`);
            
            // 아이템 검색
            const inventoryItem = freshUser.inventory.find(inv => inv.id === itemId);
            
            if (!inventoryItem) {
                console.log(`아이템을 찾을 수 없음 - 요청된 ID: ${itemId}`);
                await interaction.update({ content: `해당 아이템을 찾을 수 없습니다!`, embeds: [], components: [] });
                return;
            }
            
            // inventorySlot이 없는 경우 자동 할당
            if (inventoryItem.inventorySlot === undefined || inventoryItem.inventorySlot === null) {
                console.log(`⚠️ inventorySlot이 없는 아이템 발견! 자동 할당 중...`);
                const availableSlot = getAvailableInventorySlot(freshUser);
                if (availableSlot !== -1) {
                    inventoryItem.inventorySlot = availableSlot;
                    console.log(`✅ inventorySlot ${availableSlot}으로 할당 완료`);
                } else {
                    console.log(`❌ 사용 가능한 슬롯이 없음`);
                    await interaction.update({ content: '인벤토리가 가득 찼습니다!', embeds: [], components: [] });
                    return;
                }
            }
            
            console.log(`📦 아이템 정보: ${inventoryItem.name}, inventorySlot: ${inventoryItem.inventorySlot}`);
            console.log(`📊 아이템 스탯:`, JSON.stringify(inventoryItem.stats));
            console.log(`🔢 아이템 타입: ${inventoryItem.type}`);
            
            // 이미 착용 중인지 확인
            if (freshUser.equipment[inventoryItem.type] === inventoryItem.inventorySlot) {
                await interaction.update({ content: '이미 착용 중인 아이템입니다!', embeds: [], components: [] });
                return;
            }

            // 레벨 확인
            if (freshUser.level < inventoryItem.level) {
                await interaction.update({ 
                    content: `레벨이 부족합니다! (필요: Lv.${inventoryItem.level}, 현재: Lv.${freshUser.level})`, 
                    embeds: [], 
                    components: [] 
                });
                return;
            }

            // 장착 가능한 타입인지 확인
            if (!['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'].includes(inventoryItem.type)) {
                await interaction.update({ content: '장착할 수 없는 아이템입니다!', embeds: [], components: [] });
                return;
            }

            // 장착 전 전투력 계산
            console.log(`📐 장착 전 weapon 슬롯: ${freshUser.equipment.weapon}`);
            const prevCombatPower = calculateCombatPower(freshUser);
            console.log(`📐 장착 전 전투력: ${prevCombatPower}`);
            
            // 이전에 장착된 아이템이 있다면 해제
            const prevSlotIndex = freshUser.equipment[inventoryItem.type];
            
            // ObjectId인 경우 강제로 -1로 설정 (구식 데이터 처리)
            if (prevSlotIndex && typeof prevSlotIndex === 'object') {
                console.log(`⚠️ 구식 ObjectId 데이터 감지: ${prevSlotIndex} → -1로 변경`);
                freshUser.equipment[inventoryItem.type] = -1;
            } else if (typeof prevSlotIndex === 'number' && prevSlotIndex !== -1) {
                // 이전 장착 아이템의 equipped 상태 해제
                const prevItem = freshUser.inventory.find(item => item.inventorySlot === prevSlotIndex);
                if (prevItem) {
                    prevItem.equipped = false;
                }
            }
            
            // 장착 처리 - 신식 시스템 (슬롯 번호 참조)
            freshUser.equipment[inventoryItem.type] = inventoryItem.inventorySlot;
            
            // freshUser.inventory에서 동일한 아이템을 찾아 equipped 상태 업데이트
            const freshInventoryItem = freshUser.inventory.find(item => 
                item.id === inventoryItem.id || item.inventorySlot === inventoryItem.inventorySlot
            );
            if (freshInventoryItem) {
                freshInventoryItem.equipped = true;
            }
            
            console.log(`💾 저장 전 freshUser.equipment.weapon: ${freshUser.equipment.weapon}`);
            console.log(`💾 저장 전 inventoryItem.inventorySlot: ${inventoryItem.inventorySlot}`);
            await freshUser.save();
            console.log(`💾 저장 완료`);
            
            // 장착 후 전투력 계산 (새로 저장된 데이터 사용)
            const updatedUser = await User.findOne({ discordId: interaction.user.id });
            console.log(`📏 장착 후 weapon 슬롯 확인: ${updatedUser.equipment.weapon}`);
            console.log(`🔍 장착된 아이템 재확인:`, updatedUser.inventory.find(item => item.inventorySlot === updatedUser.equipment.weapon));
            const newCombatPower = calculateCombatPower(updatedUser);
            const powerChange = newCombatPower - prevCombatPower;
            const changeText = powerChange > 0 ? `(+${powerChange})` : powerChange < 0 ? `(${powerChange})` : '(변화 없음)';

            const equipEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('⚔️ 장비 착용 완료!')
                .setDescription(`**${inventoryItem.name}**을(를) 성공적으로 착용했습니다!`)
                .addFields(
                    { name: '착용한 아이템', value: `${inventoryItem.name}${inventoryItem.enhanceLevel > 0 ? ` (+${inventoryItem.enhanceLevel}강)` : ''}`, inline: true },
                    { name: '아이템 등급', value: inventoryItem.rarity, inline: true },
                    { name: '변화된 전투력', value: `${prevCombatPower.toLocaleString()} → ${newCombatPower.toLocaleString()} ${changeText}`, inline: true }
                );

            // 돌아가기 버튼들
            // category를 올바른 형태로 변환 (weapons → weapon)
            const categoryMap = {
                'weapons': 'weapon',
                'armor': 'armor', 
                'helmets': 'helmet',
                'gloves': 'gloves',
                'boots': 'boots',
                'accessories': 'accessory'
            };
            const equipCategory = categoryMap[category] || inventoryItem.type;
            
            const backButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`equip_category_${equipCategory}`)
                        .setLabel('🔙 해당 카테고리로 돌아가기')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('equipment')
                        .setLabel('⚔️ 장비 관리로 돌아가기')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [equipEmbed],
                components: [backButtons]
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
                    const isEquipped = user.equipment[category] === item.inventorySlot;
                    const enhanceText = item.enhanceLevel > 0 ? ` (+${item.enhanceLevel}강)` : '';
                    
                    itemList += `**${globalIndex + 1}. ${item.name}**${enhanceText} ${isEquipped ? ' -착용중' : ''}\n`;
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
                    const isEquipped = user.equipment[category] === item.inventorySlot;
                    
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
        
        else if (interaction.customId === 'enhancement') {
            // 강화 메뉴 처리
            if (user.level < 10) {
                await interaction.update({ content: '강화는 레벨 10부터 사용할 수 있습니다!', embeds: [], components: [] });
                return;
            }
            
            // 강화 가능한 장비 확인
            const equippedItems = [];
            const equipmentSlots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'accessory'];
            
            equipmentSlots.forEach(slot => {
                const equippedItem = getEquippedItem(user, slot);
                if (equippedItem) {
                    equippedItems.push({
                        slot: slot,
                        item: equippedItem,
                        displayName: getSlotDisplayName(slot)
                    });
                }
            });
            
            if (equippedItems.length === 0) {
                await interaction.update({ 
                    content: '강화할 장비가 없습니다! 먼저 장비를 착용해주세요.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            // 강화 메뉴 임베드
            const enhanceEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('⚡ 장비 강화')
                .setDescription(`**${user.nickname}**님의 강화 메뉴\n\n강화할 장비를 선택하세요!`)
                .setFooter({ text: '강화는 장비의 성능을 향상시키지만, 실패할 위험이 있습니다!' });
            
            // 장착된 장비들 표시
            let equipmentList = '';
            equippedItems.forEach((equipped, index) => {
                const item = equipped.item;
                const enhanceLevel = item.enhanceLevel || 0;
                const enhanceText = enhanceLevel > 0 ? ` (+${enhanceLevel}강)` : '';
                
                // 스탯 정보 추가
                const stats = item.stats || {};
                let statsText = '';
                if (stats.attack && stats.attack[0] > 0) statsText += ` | 공격: ${stats.attack[0]}-${stats.attack[1]}`;
                if (stats.defense && stats.defense[0] > 0) statsText += ` | 방어: ${stats.defense[0]}-${stats.defense[1]}`;
                if (stats.dodge && stats.dodge[0] > 0) statsText += ` | 회피: ${stats.dodge[0]}-${stats.dodge[1]}`;
                if (stats.luck && stats.luck[0] > 0) statsText += ` | 행운: ${stats.luck[0]}-${stats.luck[1]}`;
                
                equipmentList += `**${index + 1}. ${equipped.displayName}**: ${item.name}${enhanceText}${statsText}\n`;
            });
            
            enhanceEmbed.addFields({ name: '💎 장착된 장비', value: equipmentList, inline: false });
            
            // 강화 버튼들 (장비별로)
            const enhanceButtons = new ActionRowBuilder();
            equippedItems.slice(0, 5).forEach((equipped, index) => {
                const item = equipped.item;
                const enhanceLevel = item.enhanceLevel || 0;
                const isMaxLevel = enhanceLevel >= 30;
                
                enhanceButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_${equipped.slot}`)
                        .setLabel(`${equipped.displayName} (+${enhanceLevel})`)
                        .setStyle(isMaxLevel ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(isMaxLevel)
                );
            });
            
            // 뒤로가기 버튼
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴로 돌아가기')
                        .setStyle(ButtonStyle.Success)
                );
            
            const components = [enhanceButtons, backButton];
            
            await interaction.update({ 
                embeds: [enhanceEmbed], 
                components: components
            });
        }
        
        else if (interaction.customId.startsWith('enhance_')) {
            // 특정 장비 강화 처리
            const slotName = interaction.customId.replace('enhance_', '');
            const equipment = getEquippedItem(user, slotName);
            
            if (!equipment) {
                await interaction.update({ content: '해당 슬롯에 장착된 장비가 없습니다!', embeds: [], components: [] });
                return;
            }
            
            if (equipment.enhanceLevel >= 30) {
                await interaction.update({ content: '이미 최대 강화 단계(30강)입니다!', embeds: [], components: [] });
                return;
            }
            
            // 아이템 레벨 및 강화 비용 계산
            const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || 1;
            const currentStar = equipment.enhanceLevel || 0;
            const cost = calculateEnhanceCost(itemLevel, currentStar);
            
            if (user.gold < cost) {
                await interaction.reply({ 
                    content: `골드가 부족합니다! 필요: ${cost.toLocaleString()}<:currency_emoji:1377404064316522778>, 보유: ${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, 
                    flags: 64 
                });
                return;
            }
            
            // 강화 확률 및 정보 표시
            const rates = ENHANCEMENT_RATES[currentStar];
            const successRate = rates.success;
            const failRate = rates.fail;
            const destroyRate = rates.destroy;
            
            const confirmEmbed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('⚡ 강화 확인')
                .setDescription(`**${equipment.name}** (+${currentStar}강 → +${currentStar + 1}강)\n\n정말 강화하시겠습니까?`)
                .addFields(
                    { name: '💰 강화 비용', value: `${cost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                    { name: '✅ 성공 확률', value: `${successRate}%`, inline: true },
                    { name: '❌ 실패 확률', value: `${failRate}%`, inline: true },
                    { name: '💀 파괴 확률', value: `${destroyRate}%`, inline: true },
                    { name: '💎 현재 보유 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                )
                .setFooter({ text: '강화 후에는 되돌릴 수 없습니다!' });
            
            // 강화 실행 버튼
            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_enhance_${slotName}`)
                        .setLabel('⚡ 강화 실행!')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('enhancement')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [confirmEmbed],
                components: [confirmButtons]
            });
        }
        
        else if (interaction.customId.startsWith('confirm_enhance_')) {
            // 강화 실행
            const slotName = interaction.customId.replace('confirm_enhance_', '');
            const equipment = getEquippedItem(user, slotName);
            
            if (!equipment) {
                await interaction.update({ content: '해당 슬롯에 장착된 장비가 없습니다!', embeds: [], components: [] });
                return;
            }
            
            if (equipment.enhanceLevel >= 30) {
                await interaction.update({ content: '이미 최대 강화 단계(30강)입니다!', embeds: [], components: [] });
                return;
            }
            
            // 아이템 레벨 및 강화 비용 계산
            const itemLevel = ITEM_LEVELS[equipment.setName] || ITEM_LEVELS[equipment.name] || 1;
            const currentStar = equipment.enhanceLevel || 0;
            const cost = calculateEnhanceCost(itemLevel, currentStar);
            
            if (user.gold < cost) {
                await interaction.update({ 
                    content: `골드가 부족합니다! 필요: ${cost.toLocaleString()}<:currency_emoji:1377404064316522778>, 보유: ${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, 
                    embeds: [], 
                    components: [] 
                });
                return;
            }
            
            // 강화 시도
            const rates = ENHANCEMENT_RATES[currentStar];
            const result = attemptEnhanceWithProtection(rates, false, false, currentStar, false);
            user.gold -= cost;
            
            // 강화 통계 업데이트
            if (!user.enhanceStats) {
                user.enhanceStats = {
                    totalAttempts: 0,
                    successCount: 0,
                    destroyCount: 0,
                    totalCost: 0,
                    maxEnhanceLevel: 0
                };
            }
            
            user.enhanceStats.totalAttempts += 1;
            user.enhanceStats.totalCost += cost;
            
            let resultEmbed;
            
            if (result === 'success') {
                equipment.enhanceLevel += 1;
                user.enhanceStats.successCount += 1;
                user.enhanceStats.maxEnhanceLevel = Math.max(user.enhanceStats.maxEnhanceLevel, equipment.enhanceLevel);
                
                // 신식 시스템: getEquippedItem이 이미 인벤토리의 실제 아이템을 참조하므로 별도 업데이트 불필요
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('✅ 강화 성공!')
                    .setDescription(`**${equipment.name}**이(가) 성공적으로 강화되었습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} → **+${equipment.enhanceLevel}**강`, inline: true },
                        { name: '사용된 골드', value: `${cost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '남은 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    );
                    
                if (equipment.enhanceLevel >= 10) {
                    resultEmbed.setFooter({ text: '높은 강화 단계에 도달했습니다! 축하합니다!' });
                }
                
                triggerEnhancementEvent(equipment.enhanceLevel, true);
                
            } else if (result === 'fail') {
                resultEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('❌ 강화 실패')
                    .setDescription(`**${equipment.name}** 강화에 실패했습니다.`)
                    .addFields(
                        { name: '강화 결과', value: `+${currentStar} (변화 없음)`, inline: true },
                        { name: '사용된 골드', value: `${cost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '남은 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    );
                    
                triggerEnhancementEvent(equipment.enhanceLevel, false);
                
            } else if (result === 'destroy') {
                const oldLevel = equipment.enhanceLevel;
                equipment.enhanceLevel = Math.max(0, equipment.enhanceLevel - 1);
                user.enhanceStats.destroyCount += 1;
                
                // 신식 시스템: getEquippedItem이 이미 인벤토리의 실제 아이템을 참조하므로 별도 업데이트 불필요
                
                resultEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('💀 강화 파괴!')
                    .setDescription(`**${equipment.name}**이(가) 파괴되어 강화 단계가 하락했습니다!`)
                    .addFields(
                        { name: '강화 결과', value: `+${oldLevel} → **+${equipment.enhanceLevel}**💀`, inline: true },
                        { name: '사용된 골드', value: `${cost.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true },
                        { name: '남은 골드', value: `${user.gold.toLocaleString()}<:currency_emoji:1377404064316522778>`, inline: true }
                    )
                    .setFooter({ text: '파괴는 고위 강화에서만 발생합니다. 다음에는 더 신중하게!' });
                    
                triggerEnhancementEvent(equipment.enhanceLevel, false);
            }
            
            await user.save();
            
            // 결과 표시 후 다시 강화하기 버튼 추가
            const afterButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`enhance_${slotName}`)
                        .setLabel('🔄 다시 강화하기')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(equipment.enhanceLevel >= 30),
                    new ButtonBuilder()
                        .setCustomId('enhancement')
                        .setLabel('⚡ 강화 메뉴')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('back_to_game_menu')
                        .setLabel('🎮 게임 메뉴')
                        .setStyle(ButtonStyle.Success)
                );
            
            await interaction.update({
                embeds: [resultEmbed],
                components: [afterButtons]
            });
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
            const portfolio = await getPlayerPortfolio(interaction.user.id);
            
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
            
            // 실제 투자 원금 계산 (주식 구매에 사용한 금액)
            let totalInvested = 0;
            if (portfolio.stocks.size > 0) {
                for (const [companyId, holding] of portfolio.stocks) {
                    totalInvested += holding.avgPrice * holding.shares;
                }
                const profitLoss = totalValue - portfolio.cash - totalInvested;
                const profitRate = totalInvested > 0 ? (profitLoss / totalInvested * 100) : 0;
                portfolioText += `\n📊 **수익률**: ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(1)}%`;
            } else {
                portfolioText += `\n📊 **수익률**: 0.0%`;
            }

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
                    .setFooter({ text: '실시간으로 업데이트되는 전문 차트입니다!' });
                
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
                
                const top10Companies = allCompanies
                    .sort((a, b) => b.price - a.price)
                    .slice(0, 10);
                
                const companyOptions = top10Companies.map((company, index) => {
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
                            .setCustomId('all_companies_chart')
                            .setLabel('📊 전체 기업 차트')
                            .setStyle(ButtonStyle.Secondary),
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
                        { name: '🏆 상위 기업 목록', value: top10Companies.map((c, i) => `${i+1}. **${c.name}** - ${c.price.toLocaleString()}G`).join('\n'), inline: false }
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
            const portfolio = await getPlayerPortfolio(interaction.user.id);
            
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
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('stock_chart')
                        .setLabel('📈 차트')
                        .setStyle(ButtonStyle.Secondary)
                );
                
            const stockButtons2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('recover_my_stocks')
                        .setLabel('🔧 내 주식 복구')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('stock_help')
                        .setLabel('❓ 도움말')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [stockEmbed],
                components: [stockButtons1, stockButtons2]
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
            // PVP 랭킹 페이지로 이동
            await showRankingMenu(interaction, 4);
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
            // 레이싱 랭킹 페이지로 이동
            await showRankingMenu(interaction, 5);
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
        
        // 회원가입 버튼 처리
        else if (interaction.customId === 'register') {
            const modal = new ModalBuilder()
                .setCustomId('registerModal')
                .setTitle('🎮 김헌터 회원가입');
            
            const nicknameInput = new TextInputBuilder()
                .setCustomId('nickname')
                .setLabel('닉네임을 입력하세요')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('2-10자 사이의 닉네임')
                .setMinLength(2)
                .setMaxLength(10)
                .setRequired(true);
            
            const emailInput = new TextInputBuilder()
                .setCustomId('email')
                .setLabel('이메일을 입력하세요')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('example@email.com')
                .setRequired(true);
            
            modal.addComponents(
                new ActionRowBuilder().addComponents(nicknameInput),
                new ActionRowBuilder().addComponents(emailInput)
            );
            
            await interaction.showModal(modal);
        }
        
        else if (interaction.customId === 'game_page_1') {
            // game_page_1과 back_to_game_menu 동일한 기능으로 처리
            // 시간대별 이미지 및 인사말 설정
            const now = new Date();
            const hour = now.getHours();
            
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
                '🌟 강화왕 김헌터에 오신 것을 환영합니다!',
                '⚔️ 오늘도 모험을 떠날 준비가 되셨나요?',
                '🏆 새로운 도전이 당신을 기다리고 있습니다!',
                '💎 운명의 강화석이 당신을 부르고 있어요!',
                '🎯 목표를 향해 전진하세요, 용감한 모험가!'
            ];
            
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            const user = await User.findOne({ discordId: interaction.user.id });
            const combatPower = calculateCombatPower(user);
            
            const statusEmbed = new EmbedBuilder()
                .setColor(timeColor)
                .setTitle('🎮 김헌터 게임 메뉴')
                .setDescription(`${randomGreeting}\n\n**${getUserTitle(user)} ${user.nickname}**님\n레벨: ${user.level} | 🔥 전투력: ${combatPower.toLocaleString()}\n💰 골드: ${user.gold.toLocaleString()}`)
                .setImage('attachment://' + timeImage)
                .setFooter({ text: '버튼을 클릭하여 다양한 기능을 이용하세요!' })
                .setTimestamp();

            const pages = [
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('daily')
                            .setLabel('📅 출석체크')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('work')
                            .setLabel('💼 일하기')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('hunting')
                            .setLabel('🏹 사냥')
                            .setStyle(ButtonStyle.Success)
                    ]
                },
                {
                    buttons: [
                        new ButtonBuilder()
                            .setCustomId('monster_battle')
                            .setLabel('🐲 몬스터 배틀')
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

            const contentRow = new ActionRowBuilder()
                .addComponents(pages[0].buttons);
                
            const attachment = new AttachmentBuilder(path.join(__dirname, 'resource', timeImage), { name: timeImage });

            await interaction.update({ 
                embeds: [statusEmbed], 
                components: [contentRow, navigationRow], 
                files: [attachment] 
            });
        }
        
        // 🏺 유물탐사 버튼 핸들러들
        else if (interaction.customId === 'artifact_direct_explore') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            await showDirectExplorationMenu(interaction, user);
        }
        
        else if (interaction.customId === 'artifact_companies') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 탐사회사 투자 메뉴 (주식 시스템과 연동)
            const companies = STOCK_MARKET.exploration_companies;
            
            let companyList = '';
            companies.forEach(company => {
                const changeIcon = company.change > 0 ? '📈' : company.change < 0 ? '📉' : '➡️';
                const changeColor = company.change > 0 ? '+' : '';
                companyList += `📊 **${company.name}**\n`;
                companyList += `   주가: ${company.price.toLocaleString()}G ${changeIcon} ${changeColor}${company.change.toFixed(1)}%\n`;
                companyList += `   거래량: ${company.volume.toLocaleString()}\n\n`;
            });
            
            const embed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('🏢 유물탐사회사 투자')
                .setDescription('탐사회사에 투자하여 수익을 얻으세요!\n탐사 성공/실패에 따라 주가가 변동됩니다.')
                .addFields(
                    { name: '📈 유물탐사회사 주식', value: companyList, inline: false },
                    { name: '💡 투자 팁', value: '• 탐사 성공 시 주가 상승\n• 레어 유물 발견 시 대폭 상승\n• 실패 시 주가 하락', inline: false }
                );

            const stockButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('stock_main')
                        .setLabel('📊 주식 거래소')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('artifact_main_menu')
                        .setLabel('🔙 유물탐사 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({
                embeds: [embed],
                components: [stockButton]
            });
        }
        
        else if (interaction.customId === 'artifact_inventory') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const artifacts = user.artifacts || [];
            
            if (artifacts.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#95a5a6')
                    .setTitle('🎒 유물 보관함')
                    .setDescription('보관 중인 유물이 없습니다.\n\n직접 탐사를 통해 유물을 발견해보세요!')
                    .addFields(
                        { name: '💡 유물 획득 방법', value: '⛏️ 직접 탐사를 통한 발견\n🏢 탐사회사 투자 수익', inline: false }
                    );

                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('artifact_main_menu')
                            .setLabel('🔙 유물탐사 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.update({
                    embeds: [embed],
                    components: [backButton]
                });
                return;
            }
            
            // 유물을 등급별로 정렬
            const sortedArtifacts = artifacts.sort((a, b) => {
                const rarityOrder = { 'legendary': 4, 'epic': 3, 'rare': 2, 'common': 1 };
                return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
            });
            
            // 페이지네이션 (한 페이지에 5개)
            const itemsPerPage = 5;
            const totalPages = Math.ceil(sortedArtifacts.length / itemsPerPage);
            const currentPage = 0;
            
            const startIndex = currentPage * itemsPerPage;
            const pageArtifacts = sortedArtifacts.slice(startIndex, startIndex + itemsPerPage);
            
            let artifactList = '';
            pageArtifacts.forEach((artifact, index) => {
                const date = new Date(artifact.foundDate).toLocaleDateString('ko-KR');
                const currentValue = calculateArtifactValue(artifact);
                const originalValue = artifact.value;
                const changePercent = ((currentValue - originalValue) / originalValue * 100).toFixed(1);
                const changeIcon = currentValue > originalValue ? '📈' : currentValue < originalValue ? '📉' : '➡️';
                
                artifactList += `${artifact.emoji} **${artifact.name}** (${getRarityText(artifact.rarity)})\n`;
                artifactList += `   💰 시장가: ${currentValue.toLocaleString()}G ${changeIcon} ${changePercent > 0 ? '+' : ''}${changePercent}%\n`;
                artifactList += `   📊 기준가: ${originalValue.toLocaleString()}G\n`;
                artifactList += `   📅 발견일: ${date}`;
                if (artifact.company) artifactList += ` | 🏢 ${artifact.company}`;
                artifactList += '\n\n';
            });
            
            // 통계 계산 (현재 시장 가치 기준)
            const totalValue = artifacts.reduce((sum, artifact) => sum + calculateArtifactValue(artifact), 0);
            const originalTotalValue = artifacts.reduce((sum, artifact) => sum + artifact.value, 0);
            const totalChangePercent = ((totalValue - originalTotalValue) / originalTotalValue * 100).toFixed(1);
            const rarityCount = {
                common: artifacts.filter(a => a.rarity === 'common').length,
                rare: artifacts.filter(a => a.rarity === 'rare').length,
                epic: artifacts.filter(a => a.rarity === 'epic').length,
                legendary: artifacts.filter(a => a.rarity === 'legendary').length
            };
            
            const totalChangeIcon = totalValue > originalTotalValue ? '📈' : totalValue < originalTotalValue ? '📉' : '➡️';
            
            const embed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('🎒 유물 보관함')
                .setDescription(`**${user.nickname}**님의 유물 컬렉션\n\n💰 **총 시장가치**: ${totalValue.toLocaleString()}G ${totalChangeIcon} ${totalChangePercent > 0 ? '+' : ''}${totalChangePercent}%`)
                .addFields(
                    { name: '📊 보관 현황', value: `총 ${artifacts.length}개 | 📊 기준가치: ${originalTotalValue.toLocaleString()}G`, inline: false },
                    { name: '🏆 등급별 보유량', value: `💛 전설: ${rarityCount.legendary}개\n💜 에픽: ${rarityCount.epic}개\n💙 희귀: ${rarityCount.rare}개\n🤍 일반: ${rarityCount.common}개`, inline: true },
                    { name: `📜 유물 목록 (${currentPage + 1}/${totalPages})`, value: artifactList, inline: false }
                );

            const navButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artifact_inv_prev')
                        .setLabel('◀ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('artifact_inv_next')
                        .setLabel('다음 ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('artifact_market_chart')
                        .setLabel('📈 시장 차트')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('artifact_shop')
                        .setLabel('🏪 상점에서 판매')
                        .setStyle(ButtonStyle.Success)
                );
                
            const menuButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artifact_main_menu')
                        .setLabel('🔙 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.update({
                embeds: [embed],
                components: [navButtons, menuButtons]
            });
        }
        
        else if (interaction.customId === 'artifact_shop') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const artifacts = user.artifacts || [];
            
            if (artifacts.length === 0) {
                await interaction.update({
                    content: '판매할 유물이 없습니다! 먼저 탐사를 통해 유물을 발견해보세요.',
                    embeds: [],
                    components: []
                });
                return;
            }
            
            // 판매 가능한 유물 목록
            let sellList = '';
            artifacts.forEach((artifact, index) => {
                const currentPrice = calculateArtifactValue(artifact);
                const basePrice = artifact.value;
                const changePercent = ((currentPrice - basePrice) / basePrice * 100).toFixed(1);
                const changeIcon = currentPrice > basePrice ? '📈' : currentPrice < basePrice ? '📉' : '➡️';
                
                sellList += `${index + 1}. ${artifact.emoji} **${artifact.name}** (${getRarityText(artifact.rarity)})\n`;
                sellList += `   💰 판매가: ${currentPrice.toLocaleString()}G ${changeIcon} ${changePercent > 0 ? '+' : ''}${changePercent}%\n\n`;
            });
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🏪 유물 상점')
                .setDescription(`**${user.nickname}**님의 유물을 판매하세요!`)
                .addFields(
                    { name: '💰 판매 가능 유물', value: sellList || '판매할 유물이 없습니다.', inline: false },
                    { name: '💡 판매 안내', value: '• 유물 판매는 즉시 골드로 전환됩니다\n• 희귀할수록 높은 가격에 판매됩니다\n• 판매된 유물은 복구할 수 없습니다', inline: false }
                );

            // 유물이 있으면 선택 메뉴 생성
            if (artifacts.length > 0) {
                const selectOptions = artifacts.slice(0, 25).map((artifact, index) => {
                    const currentPrice = calculateArtifactValue(artifact);
                    const changePercent = ((currentPrice - artifact.value) / artifact.value * 100).toFixed(0);
                    const trend = currentPrice > artifact.value ? '↑' : currentPrice < artifact.value ? '↓' : '';
                    
                    return {
                        label: `${artifact.name} (${currentPrice.toLocaleString()}G ${trend}${changePercent}%)`,
                        description: `${getRarityText(artifact.rarity)} - ${artifact.description.substring(0, 50)}`,
                        value: `sell_artifact_${index}`,
                        emoji: artifact.emoji
                    };
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('sell_artifact_select')
                    .setPlaceholder('판매할 유물을 선택하세요')
                    .addOptions(selectOptions);

                const selectRow = new ActionRowBuilder().addComponents(selectMenu);
                
                const backButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('artifact_inventory')
                            .setLabel('🎒 보관함')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('artifact_main_menu')
                            .setLabel('🔙 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.update({
                    embeds: [embed],
                    components: [selectRow, backButton]
                });
            }
        }
        
        else if (interaction.customId === 'artifact_market_chart') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            await interaction.deferUpdate();
            
            // 사용자가 보유한 유물들의 시세 차트 표시
            const artifacts = user.artifacts || [];
            if (artifacts.length === 0) {
                await interaction.editReply({
                    content: '보유한 유물이 없어 시세를 확인할 수 없습니다.',
                    embeds: [],
                    components: []
                });
                return;
            }
            
            // 고유한 유물 타입별로 그룹화
            const uniqueArtifacts = new Map();
            artifacts.forEach(artifact => {
                if (!uniqueArtifacts.has(artifact.name)) {
                    uniqueArtifacts.set(artifact.name, {
                        ...artifact,
                        count: 1,
                        totalValue: calculateArtifactValue(artifact)
                    });
                } else {
                    const existing = uniqueArtifacts.get(artifact.name);
                    existing.count++;
                    existing.totalValue += calculateArtifactValue(artifact);
                }
            });
            
            // 시세 정보 텍스트 생성
            let marketInfo = '';
            let totalCurrentValue = 0;
            let totalOriginalValue = 0;
            
            uniqueArtifacts.forEach((artifactData, name) => {
                const priceData = artifactMarket.priceHistory.get(name);
                if (priceData) {
                    const currentPrice = priceData.currentPrice;
                    const basePrice = (artifactData.value[0] + artifactData.value[1]) / 2;
                    const changePercent = ((currentPrice - basePrice) / basePrice * 100).toFixed(1);
                    const trend = currentPrice > basePrice ? '📈' : currentPrice < basePrice ? '📉' : '➡️';
                    
                    marketInfo += `${artifactData.emoji} **${name}** (x${artifactData.count})\n`;
                    marketInfo += `   현재가: ${currentPrice.toLocaleString()}G ${trend} ${changePercent > 0 ? '+' : ''}${changePercent}%\n`;
                    marketInfo += `   보유 가치: ${(currentPrice * artifactData.count).toLocaleString()}G\n\n`;
                    
                    totalCurrentValue += currentPrice * artifactData.count;
                    totalOriginalValue += basePrice * artifactData.count;
                }
            });
            
            const totalChangePercent = ((totalCurrentValue - totalOriginalValue) / totalOriginalValue * 100).toFixed(1);
            const marketEvent = artifactMarket.currentEvent;
            
            const embed = new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('📈 유물 시세 차트')
                .setDescription(`**${user.nickname}**님의 유물 포트폴리오`)
                .addFields(
                    { 
                        name: '💰 총 평가액', 
                        value: `${totalCurrentValue.toLocaleString()}G (${totalChangePercent > 0 ? '+' : ''}${totalChangePercent}%)`, 
                        inline: true 
                    },
                    { 
                        name: '📊 보유 종류', 
                        value: `${uniqueArtifacts.size}종`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 총 보유량', 
                        value: `${artifacts.length}개`, 
                        inline: true 
                    }
                );
            
            if (marketEvent) {
                embed.addFields({
                    name: '🌟 시장 이벤트',
                    value: `**${marketEvent.name}**\n${marketEvent.description}\n효과: 시세 ${marketEvent.effect > 1 ? '+' : ''}${((marketEvent.effect - 1) * 100).toFixed(0)}%`,
                    inline: false
                });
            }
            
            embed.addFields({
                name: '📊 보유 유물 시세',
                value: marketInfo || '시세 정보가 없습니다.',
                inline: false
            });
            
            // 시세 변동 팁
            const tips = [
                '💡 유물 시세는 10분마다 변동됩니다.',
                '💡 시간대에 따라 거래량이 달라집니다.',
                '💡 특별 이벤트 발생시 시세가 크게 변동할 수 있습니다.',
                '💡 희귀도가 높을수록 변동폭이 큽니다.'
            ];
            embed.setFooter({ text: tips[Math.floor(Math.random() * tips.length)] });
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artifact_inventory')
                        .setLabel('🎒 보관함으로')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('artifact_shop')
                        .setLabel('🏪 판매하기')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('artifact_main_menu')
                        .setLabel('🔙 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        }
        
        else if (interaction.customId === 'artifact_main_menu') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            await showArtifactExplorationMenu(interaction, user);
        }
        
        else if (interaction.customId === 'artifact_rankings') {
            // 유물 랭킹 페이지로 이동
            await showRankingMenu(interaction, 8);
        }
        
        else if (interaction.customId === 'artifact_guide') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📖 유물탐사 완전 가이드')
                .setDescription('유물탐사의 모든 것을 알려드립니다!')
                .addFields(
                    { 
                        name: '⛏️ 직접 탐사', 
                        value: '• 탐사회사를 선택하여 직접 투자\n• 투자 금액이 클수록 성공률과 보상 증가\n• 성공 시 유물 획득, 실패 시 골드 손실', 
                        inline: false 
                    },
                    { 
                        name: '🏢 탐사회사 투자', 
                        value: '• 탐사회사 주식에 투자하여 수익 창출\n• 탐사 성공/실패에 따라 주가 변동\n• 레어 유물 발견 시 주가 대폭 상승', 
                        inline: false 
                    },
                    { 
                        name: '💎 유물 등급', 
                        value: '🤍 **일반** (70%) - 기본 유물\n💙 **희귀** (20%) - 중급 가치\n💜 **에픽** (8%) - 고급 가치\n💛 **전설** (2%) - 최고 가치', 
                        inline: false 
                    },
                    { 
                        name: '🗺️ 탐사 지역', 
                        value: '🏜️ **사막** - 안정적, 낮은 위험\n🌊 **심해** - 고위험 고수익\n⛰️ **설산** - 균형잡힌 수익\n🌴 **정글** - 높은 성공률\n🚀 **우주** - 최고 난이도, 최고 보상', 
                        inline: false 
                    },
                    { 
                        name: '💡 성공 팁', 
                        value: '• 시작은 정글이나 사막 탐사로!\n• 투자 금액을 점진적으로 늘려가세요\n• 탐사회사 주식도 함께 투자하세요\n• 유물은 적절한 타이밍에 판매하세요', 
                        inline: false 
                    }
                );

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artifact_main_menu')
                        .setLabel('🔙 유물탐사 메뉴')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [embed],
                components: [backButton]
            });
        }
        
        else if (interaction.customId === 'artifact_market_chart') {
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            await interaction.deferUpdate();
            
            try {
                // 유물 시장 차트 생성
                const marketChartUrl = await generateArtifactChart('market');
                const individualChartUrl = await generateArtifactChart('individual');
                
                if (!marketChartUrl) {
                    await interaction.editReply({
                        content: '❌ 유물 시장 데이터가 부족합니다. 잠시 후 다시 시도해주세요.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                // 현재 시장 상황 분석
                const artifactMarket = STOCK_MARKET.artifact_market;
                const multipliers = Object.values(artifactMarket.value_multipliers);
                const averageMultiplier = multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length;
                const marketTrend = averageMultiplier > 1.0 ? '상승' : averageMultiplier < 1.0 ? '하락' : '보합';
                const trendIcon = averageMultiplier > 1.0 ? '📈' : averageMultiplier < 1.0 ? '📉' : '➡️';
                
                // 상위 변동 유물들
                const topGainers = Object.entries(artifactMarket.value_multipliers)
                    .filter(([name, multiplier]) => multiplier > 1.0)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3);
                
                const topLosers = Object.entries(artifactMarket.value_multipliers)
                    .filter(([name, multiplier]) => multiplier < 1.0)
                    .sort(([,a], [,b]) => a - b)
                    .slice(0, 3);
                
                let marketAnalysis = `${trendIcon} **시장 동향**: ${marketTrend} (평균 ${(averageMultiplier * 100).toFixed(1)}%)\n\n`;
                
                if (topGainers.length > 0) {
                    marketAnalysis += `📈 **상승 유물**:\n`;
                    topGainers.forEach(([name, multiplier]) => {
                        marketAnalysis += `• ${name}: +${((multiplier - 1) * 100).toFixed(1)}%\n`;
                    });
                    marketAnalysis += '\n';
                }
                
                if (topLosers.length > 0) {
                    marketAnalysis += `📉 **하락 유물**:\n`;
                    topLosers.forEach(([name, multiplier]) => {
                        marketAnalysis += `• ${name}: ${((multiplier - 1) * 100).toFixed(1)}%\n`;
                    });
                }
                
                // 활성 이벤트 표시
                let activeEvents = '';
                if (artifactMarket.active_events.length > 0) {
                    activeEvents = '\n🎉 **활성 이벤트**:\n';
                    artifactMarket.active_events.forEach(event => {
                        const remainingTime = Math.max(0, event.start_time + event.duration - Date.now());
                        const hours = Math.floor(remainingTime / (60 * 60 * 1000));
                        const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
                        activeEvents += `• ${event.name} (${hours}시간 ${minutes}분 남음)\n`;
                    });
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#f39c12')
                    .setTitle('📈 유물 시장 차트')
                    .setDescription('실시간 유물 시장 동향을 확인하세요!')
                    .setImage(marketChartUrl)
                    .addFields(
                        { name: '📊 시장 분석', value: marketAnalysis + activeEvents, inline: false }
                    )
                    .setFooter({ text: `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')} | 5분마다 자동 업데이트` });

                const chartButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('artifact_chart_individual')
                            .setLabel('💎 개별 유물 차트')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(!individualChartUrl),
                        new ButtonBuilder()
                            .setCustomId('artifact_inventory')
                            .setLabel('🎒 보관함')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('artifact_main_menu')
                            .setLabel('🔙 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.editReply({
                    embeds: [embed],
                    components: [chartButtons]
                });
                
            } catch (error) {
                console.error('유물 시장 차트 오류:', error);
                await interaction.editReply({
                    content: '❌ 차트 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        else if (interaction.customId === 'artifact_chart_individual') {
            await interaction.deferUpdate();
            
            try {
                const individualChartUrl = await generateArtifactChart('individual');
                
                if (!individualChartUrl) {
                    await interaction.editReply({
                        content: '❌ 개별 유물 차트 데이터가 부족합니다.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#9b59b6')
                    .setTitle('💎 주요 유물 가치 변동 차트')
                    .setDescription('상위 유물들의 개별 가치 변동을 확인하세요!')
                    .setImage(individualChartUrl)
                    .setFooter({ text: `마지막 업데이트: ${new Date().toLocaleTimeString('ko-KR')} | 실시간 업데이트` });

                const backButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('artifact_market_chart')
                            .setLabel('📈 시장 지수 차트')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('artifact_inventory')
                            .setLabel('🎒 보관함')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('artifact_main_menu')
                            .setLabel('🔙 메뉴')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.editReply({
                    embeds: [embed],
                    components: [backButtons]
                });
                
            } catch (error) {
                console.error('개별 유물 차트 오류:', error);
                await interaction.editReply({
                    content: '❌ 개별 차트 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        // 탐사회사별 직접 탐사 버튼들
        else if (interaction.customId.startsWith('explore_')) {
            const companyId = interaction.customId.replace('explore_', '');
            const company = ARTIFACT_SYSTEM.companies[companyId];
            
            if (!company) {
                await interaction.followUp({ content: '❌ 존재하지 않는 탐사회사입니다!', flags: 64 });
                return;
            }
            
            const user = await getUser(interaction.user.id);
            if (!user || !user.registered) {
                await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
                return;
            }
            
            // 투자 금액 입력 모달 표시
            const investModal = new ModalBuilder()
                .setCustomId(`invest_modal_${companyId}`)
                .setTitle(`${company.emoji} ${company.name} 탐사 투자`);
            
            const costs = ARTIFACT_SYSTEM.explorationCosts[company.specialty];
            const investInput = new TextInputBuilder()
                .setCustomId('investment_amount')
                .setLabel('투자 금액')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`${costs.min.toLocaleString()} ~ ${costs.max.toLocaleString()}G`)
                .setRequired(true)
                .setMaxLength(10);
            
            const firstActionRow = new ActionRowBuilder().addComponents(investInput);
            investModal.addComponents(firstActionRow);
            
            await interaction.showModal(investModal);
        }
        
    } catch (error) {
        console.error('인터렉션 처리 오류:', error);
    }
});

// Modal 제출 처리
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    
    console.log('🔵 모달 제출됨:', interaction.customId);
    
    // 운동 시간 설정 모달
    if (interaction.customId.startsWith('exercise_duration_')) {
        const exerciseId = interaction.customId.replace('exercise_duration_', '');
        const durationInput = interaction.fields.getTextInputValue('duration');
        const duration = parseInt(durationInput);
        
        const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
        if (!exercise) {
            await interaction.reply({ content: '운동을 찾을 수 없습니다!', flags: 64 });
            return;
        }
        
        const maxMinutes = Math.floor(exercise.maxDuration / 60000);
        if (isNaN(duration) || duration < 1 || duration > maxMinutes) {
            await interaction.reply({ content: `운동 시간은 1분에서 ${maxMinutes}분 사이여야 합니다!`, flags: 64 });
            return;
        }
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            await interaction.reply({ content: '먼저 회원가입을 해주세요!', flags: 64 });
            return;
        }
        
        // 피로도 확인
        if (user.fitness.fatigue >= EXERCISE_SYSTEM.fatigue.exerciseLimit) {
            await interaction.reply({ content: '피로도가 너무 높아 운동할 수 없습니다! 휴식이 필요합니다.', flags: 64 });
            return;
        }
        
        // 이미 운동 중인지 확인
        if (user.fitness.currentExercise.type) {
            await interaction.reply({ content: '이미 운동 중입니다!', flags: 64 });
            return;
        }
        
        // 운동 시작
        const now = Date.now();
        const durationMs = duration * 60000;
        
        user.fitness.currentExercise = {
            type: exerciseId,
            startTime: now,
            duration: durationMs,
            accumulated: 0
        };
        
        // 연속 운동 체크
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        if (user.fitness.lastExerciseDate !== today) {
            if (user.fitness.lastExerciseDate === yesterday) {
                user.fitness.streak += 1;
            } else {
                user.fitness.streak = 1;
            }
            user.fitness.lastExerciseDate = today;
        }
        
        await user.save();
        
        // 운동 시작 임베드
        const embed = new EmbedBuilder()
            .setColor('#00b894')
            .setTitle(`${exercise.emoji} ${exercise.name} 시작!`)
            .setDescription(`**${user.nickname}**님이 운동을 시작했습니다!`)
            .addFields(
                { name: '⏱️ 운동 시간', value: `${duration}분`, inline: true },
                { name: '🏁 완료 예정', value: `<t:${Math.floor((now + durationMs) / 1000)}:R>`, inline: true },
                { name: '🔥 연속 운동', value: `${user.fitness.streak}일`, inline: true },
                { name: '💰 예상 보상', value: `골드: ~${(exercise.rewards.goldPerMinute * duration).toLocaleString()}G\n경험치: ~${(exercise.rewards.expPerMinute * duration).toLocaleString()} EXP`, inline: false }
            )
            .setFooter({ text: '운동이 끝나면 다시 운동 메뉴를 열어 보상을 확인하세요!' });
        
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('work')
                    .setLabel('🏃 운동 상태 확인')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.reply({
            embeds: [embed],
            components: [backButton]
        });
        
        // 피로도 증가 (시작시 일부만 증가)
        const fatigueIncrease = Math.floor(exercise.fatigueRate * duration * 0.5);
        user.fitness.fatigue = Math.min(100, user.fitness.fatigue + fatigueIncrease);
        await user.save();
    }
    
    else if (interaction.customId === 'registerModal') {
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
        console.log('🟢 매수 모달 처리 시작:', interaction.customId);
        const companyId = interaction.customId.replace('buy_modal_', '');
        const sharesText = interaction.fields.getTextInputValue('shares');
        const shares = parseInt(sharesText);
        
        console.log(`🟢 매수 정보: 기업=${companyId}, 수량=${shares}`);
        
        if (isNaN(shares) || shares <= 0) {
            console.log('❌ 잘못된 수량:', sharesText);
            await interaction.reply({ content: '올바른 수량을 입력해주세요!', flags: 64 });
            return;
        }
        
        console.log('🟢 buyStock 함수 호출 중...');
        const result = await buyStock(interaction.user.id, companyId, shares);
        
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
        console.log('🔴 매도 모달 처리 시작:', interaction.customId);
        const companyId = interaction.customId.replace('sell_modal_', '');
        const sharesText = interaction.fields.getTextInputValue('shares');
        const shares = parseInt(sharesText);
        
        console.log(`🔴 매도 정보: 기업=${companyId}, 수량=${shares}`);
        
        if (isNaN(shares) || shares <= 0) {
            console.log('❌ 잘못된 수량:', sharesText);
            await interaction.reply({ content: '올바른 수량을 입력해주세요!', flags: 64 });
            return;
        }
        
        console.log('🔴 sellStock 함수 호출 중...');
        const result = await sellStock(interaction.user.id, companyId, shares);
        
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
    
    // 베팅 모달 처리 (홀/짝, 소/대, 럭키7)
    else if (interaction.customId === 'bet_modal_odd' || interaction.customId === 'bet_modal_even' || 
             interaction.customId === 'bet_modal_small' || interaction.customId === 'bet_modal_big' || 
             interaction.customId === 'bet_modal_lucky7') {
        
        const betAmountText = interaction.fields.getTextInputValue('bet_amount');
        const betAmount = parseInt(betAmountText.replace(/[^\d]/g, '')); // 숫자만 추출
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await interaction.reply({ content: '올바른 베팅 금액을 입력해주세요!', flags: 64 });
            return;
        }
        
        // 베팅 타입 결정
        let betType;
        switch (interaction.customId) {
            case 'bet_modal_odd':
                betType = 'odd';
                break;
            case 'bet_modal_even':
                betType = 'even';
                break;
            case 'bet_modal_small':
                betType = 'small';
                break;
            case 'bet_modal_big':
                betType = 'big';
                break;
            case 'bet_modal_lucky7':
                betType = 'lucky7';
                break;
        }
        
        try {
            await oddEvenGame.addBet(interaction, betType, betAmount);
        } catch (error) {
            console.error('베팅 처리 오류:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '베팅 처리 중 오류가 발생했습니다!', flags: 64 });
            }
        }
    }
    
    // 잭팟 모달 처리
    else if (interaction.customId === 'jackpot_modal') {
        const betAmountText = interaction.fields.getTextInputValue('bet_amount');
        const targetNumberText = interaction.fields.getTextInputValue('target_number');
        
        const betAmount = parseInt(betAmountText.replace(/[^\d]/g, ''));
        const targetNumber = parseInt(targetNumberText.replace(/[^\d]/g, ''));
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await interaction.reply({ content: '올바른 베팅 금액을 입력해주세요!', flags: 64 });
            return;
        }
        
        if (isNaN(targetNumber) || targetNumber < 1 || targetNumber > 100) {
            await interaction.reply({ content: '1부터 100까지의 숫자를 입력해주세요!', flags: 64 });
            return;
        }
        
        try {
            await oddEvenGame.addBet(interaction, 'jackpot', betAmount, targetNumber);
        } catch (error) {
            console.error('잭팟 베팅 처리 오류:', error);
            await interaction.reply({ content: '잭팟 베팅 처리 중 오류가 발생했습니다!', flags: 64 });
        }
    }
    
    // 유물탐사 투자 모달 처리
    else if (interaction.customId.startsWith('invest_modal_')) {
        const companyId = interaction.customId.replace('invest_modal_', '');
        const investmentText = interaction.fields.getTextInputValue('investment_amount');
        const investmentAmount = parseInt(investmentText.replace(/[^\d]/g, ''));
        
        if (isNaN(investmentAmount) || investmentAmount <= 0) {
            await interaction.reply({ content: '올바른 투자 금액을 입력해주세요!', flags: 64 });
            return;
        }
        
        const company = ARTIFACT_SYSTEM.companies[companyId];
        if (!company) {
            await interaction.reply({ content: '존재하지 않는 탐사회사입니다!', flags: 64 });
            return;
        }
        
        const costs = ARTIFACT_SYSTEM.explorationCosts[company.specialty];
        if (investmentAmount < costs.min || investmentAmount > costs.max) {
            await interaction.reply({ 
                content: `투자 금액은 ${costs.min.toLocaleString()}G ~ ${costs.max.toLocaleString()}G 사이여야 합니다!`, 
                flags: 64 
            });
            return;
        }
        
        // 탐사 실행
        await interaction.deferReply({ flags: 64 });
        const user = await getUser(interaction.user.id);
        await executeExploration(interaction, user, companyId, investmentAmount);
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
    
    // 첫 번째 handler에서 처리하는 버튼들은 건너뛰기
    if (interaction.isButton() && ['equipment', 'game_page_', 'enhance', 'inventory', 'quest', 'pvp', 'shop', 'hunting', 'register', 'equip_item_', 'equip_category_', 'equip_', 'inv_use_', 'inv_', 'unequip_', 'buy_stock_', 'sell_stock_', 'stock_regions', 'stock_chains', 'stock_portfolio', 'stock_news', 'stock_chart', 'stock_analysis', 'all_companies_chart', 'artifact_direct_explore', 'artifact_companies', 'artifact_inventory', 'artifact_shop', 'artifact_main_menu', 'artifact_rankings', 'artifact_guide', 'artifact_market_chart', 'artifact_chart_individual', 'explore_'].some(id => interaction.customId.includes(id))) {
        console.log(`🟡 두 번째 핸들러에서 제외됨: ${interaction.customId}`);
        return;
    }
    
    if (interaction.isButton()) {
        console.log(`🔵 두 번째 핸들러에서 처리: ${interaction.customId}`);
    }
    
    try {
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            await interaction.reply({ content: '등록되지 않은 사용자입니다. 먼저 /가입을 완료해주세요!', flags: 64 });
            return;
        }

        // 랭킹 카테고리 선택 처리
        if (interaction.customId === 'ranking_category_select') {
            const selectedValue = interaction.values[0];
            const page = parseInt(selectedValue.replace('ranking_goto_', ''));
            await showRankingMenu(interaction, page);
        }
        
        // 운동 선택 처리
        else if (interaction.customId === 'select_exercise_type') {
            const selectedValue = interaction.values[0];
            const exerciseId = selectedValue.replace('start_exercise_', '');
            const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
            
            if (!exercise) {
                await interaction.reply({ content: '운동을 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            // 운동 시간 선택 모달
            const modal = new ModalBuilder()
                .setCustomId(`exercise_duration_${exerciseId}`)
                .setTitle(`${exercise.name} 시간 설정`);
            
            const maxMinutes = Math.floor(exercise.maxDuration / 60000);
            const durationInput = new TextInputBuilder()
                .setCustomId('duration')
                .setLabel(`운동 시간 (분) - 최대 ${maxMinutes}분`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`1 ~ ${maxMinutes}`)
                .setRequired(true)
                .setMaxLength(3)
                .setMinLength(1);
            
            const firstRow = new ActionRowBuilder().addComponents(durationInput);
            modal.addComponents(firstRow);
            
            await interaction.showModal(modal);
        }
        
        // 유물 판매 선택
        else if (interaction.customId === 'sell_artifact_select') {
            const selectionValue = interaction.values[0];
            const artifactIndex = parseInt(selectionValue.replace('sell_artifact_', ''));
            
            const artifacts = user.artifacts || [];
            const selectedArtifact = artifacts[artifactIndex];
            
            if (!selectedArtifact) {
                await interaction.reply({ content: '선택한 유물을 찾을 수 없습니다!', flags: 64 });
                return;
            }
            
            // 현재 시세 계산
            const currentPrice = calculateArtifactValue(selectedArtifact);
            const basePrice = selectedArtifact.value;
            const priceChange = currentPrice - basePrice;
            const changePercent = ((priceChange / basePrice) * 100).toFixed(1);
            const changeIcon = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️';
            
            // 골드 추가 및 유물 제거 (시세 반영)
            await User.updateOne(
                { discordId: interaction.user.id },
                { 
                    $inc: { 
                        gold: currentPrice,
                        'explorationStats.totalEarned': currentPrice 
                    },
                    $pull: { artifacts: { _id: selectedArtifact._id } }
                }
            );
            
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🏪 유물 판매 완료!')
                .setDescription(`**${selectedArtifact.name}**을(를) 성공적으로 판매했습니다!`)
                .addFields(
                    { name: '💎 판매 유물', value: `${selectedArtifact.emoji} **${selectedArtifact.name}**\n${getRarityText(selectedArtifact.rarity)}`, inline: true },
                    { name: '💰 판매 가격', value: `${currentPrice.toLocaleString()}G ${changeIcon} ${changePercent > 0 ? '+' : ''}${changePercent}%\n(기준가: ${basePrice.toLocaleString()}G)`, inline: true },
                    { name: '💳 현재 골드', value: `${(user.gold + selectedArtifact.value).toLocaleString()}G`, inline: true }
                )
                .setFooter({ text: '판매된 유물은 복구할 수 없습니다!' });

            const continueButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('artifact_shop')
                        .setLabel('🔄 계속 판매')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('artifact_inventory')
                        .setLabel('🎒 보관함')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('artifact_main_menu')
                        .setLabel('🏠 메뉴')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.update({
                embeds: [embed],
                components: [continueButtons]
            });
        }

        // 주식 지역 선택
        else if (interaction.customId === 'select_region') {
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
            
            const portfolio = await getPlayerPortfolio(interaction.user.id);
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
            
            const portfolio = await getPlayerPortfolio(interaction.user.id);
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
            
            const portfolio = await getPlayerPortfolio(interaction.user.id);
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

        // 몬스터 배틀 참가 버튼
        else if (interaction.customId === 'monster_battle') {
            try {
                await oddEvenGame.showBettingMenu(interaction);
            } catch (error) {
                console.error('몬스터 배틀 메뉴 표시 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '몬스터 배틀 메뉴를 표시하는 중 오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }
        
        // 홀짝 게임 베팅 메뉴
        else if (interaction.customId === 'oddeven_bet') {
            await oddEvenGame.showBettingMenu(interaction);
        }

        // 몬스터 배틀 통계
        else if (interaction.customId === 'monster_stats') {
            // 몬스터 배틀 통계 처리 (추후 구현)
            await interaction.reply({ content: '몬스터 헌터 통계 기능이 곧 출시됩니다!', flags: 64 });
        }
        
        // 홀짝 게임 통계
        else if (interaction.customId === 'oddeven_stats') {
            // 홀짝 게임 통계 처리 (추후 구현)
            await interaction.reply({ content: '홀짝 게임 통계 기능이 곧 출시됩니다!', flags: 64 });
        }

        // 몬스터 배틀 기록
        else if (interaction.customId === 'monster_history') {
            // 몬스터 배틀 기록 처리 (추후 구현)
            await interaction.reply({ content: '배틀 히스토리 기능이 곧 출시됩니다!', flags: 64 });
        }

        // 홀짝 게임 기록
        else if (interaction.customId === 'oddeven_history') {
            // 홀짝 게임 기록 처리 (추후 구현)
            await interaction.reply({ content: '홀짝 게임 기록 기능이 곧 출시됩니다!', flags: 64 });
        }

        // 몬스터 배틀 랭킹
        else if (interaction.customId === 'monster_ranking') {
            // 몬스터 배틀 랭킹 처리 (추후 구현)
            await interaction.reply({ content: '헌터 랭킹 기능이 곧 출시됩니다!', flags: 64 });
        }

        // 홀짝 게임 랭킹
        else if (interaction.customId === 'oddeven_ranking') {
            // 홀짝 게임 랭킹 처리 (추후 구현)
            await interaction.reply({ content: '홀짝 게임 랭킹 기능이 곧 출시됩니다!', flags: 64 });
        }

        // 홀짝 베팅 버튼들
        else if (interaction.customId.startsWith('bet_')) {
            const betType = interaction.customId.replace('bet_', '');
            
            // 잭팟 베팅은 숫자도 입력받아야 함
            if (betType === 'jackpot') {
                const modal = new ModalBuilder()
                    .setCustomId(`jackpot_modal`)
                    .setTitle('💎 잭팟 베팅');

                const amountInput = new TextInputBuilder()
                    .setCustomId('bet_amount')
                    .setLabel('베팅 금액')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1000 ~ 1000000')
                    .setRequired(true);

                const numberInput = new TextInputBuilder()
                    .setCustomId('target_number')
                    .setLabel('예상 숫자 (1-100)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1부터 100까지의 숫자')
                    .setRequired(true);

                const firstRow = new ActionRowBuilder().addComponents(amountInput);
                const secondRow = new ActionRowBuilder().addComponents(numberInput);
                modal.addComponents(firstRow, secondRow);

                await interaction.showModal(modal);
            } else {
                // 일반 베팅 (금액만 입력)
                const modal = new ModalBuilder()
                    .setCustomId(`bet_modal_${betType}`)
                    .setTitle(`${MONSTER_BATTLE.betOptions[betType]?.emoji || '🎲'} ${MONSTER_BATTLE.betOptions[betType]?.name || betType} 베팅`);

                const amountInput = new TextInputBuilder()
                    .setCustomId('bet_amount')
                    .setLabel('베팅 금액')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1000 ~ 1000000')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(amountInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        }

        // 홀짝 게임 뒤로가기
        else if (interaction.customId === 'oddeven_back') {
            try {
                await oddEvenGame.showMonsterBattleMenu(interaction);
            } catch (error) {
                console.error('홀짝 게임 뒤로가기 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }

        // 홀짝 게임 다시하기
        else if (interaction.customId === 'oddeven_play_again') {
            try {
                await oddEvenGame.showBettingMenu(interaction);
            } catch (error) {
                console.error('홀짝 게임 다시하기 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }

        // 홀짝 게임 메인으로
        else if (interaction.customId === 'oddeven_main') {
            try {
                await oddEvenGame.showMonsterBattleMenu(interaction);
            } catch (error) {
                console.error('홀짝 게임 메인 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }

        // 홀짝 게임 시작
        else if (interaction.customId === 'start_game') {
            try {
                await oddEvenGame.playMultipleBets(interaction);
            } catch (error) {
                console.error('홀짝 게임 시작 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '게임 시작 중 오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }

        // 홀짝 게임 베팅 초기화
        else if (interaction.customId === 'clear_bets') {
            try {
                const user = await User.findOne({ discordId: interaction.user.id });
                if (user.oddEvenStats?.currentBets) {
                    user.oddEvenStats.currentBets = [];
                    await user.save();
                }
                await oddEvenGame.showBettingMenu(interaction);
            } catch (error) {
                console.error('베팅 초기화 오류:', error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '베팅 초기화 중 오류가 발생했습니다. 다시 시도해주세요.', flags: 64 });
                }
            }
        }
        
        // 🍄 독버섯 게임 버튼 핸들러
        else if (interaction.customId.startsWith('mushroom_start_')) {
            const userId = interaction.customId.split('_')[2];
            if (userId !== interaction.user.id) {
                await interaction.reply({ content: '다른 플레이어의 게임입니다!', flags: 64 });
                return;
            }
            await mushroomGame.startRound(interaction, userId);
        }
        
        else if (interaction.customId.startsWith('mushroom_select_')) {
            const parts = interaction.customId.split('_');
            const userId = parts[2];
            const position = parseInt(parts[3]);
            
            if (userId !== interaction.user.id) {
                await interaction.reply({ content: '다른 플레이어의 게임입니다!', flags: 64 });
                return;
            }
            
            await mushroomGame.processMushroomSelection(interaction, userId, position);
        }
        
        else if (interaction.customId.startsWith('mushroom_continue_')) {
            const userId = interaction.customId.split('_')[2];
            if (userId !== interaction.user.id) {
                await interaction.reply({ content: '다른 플레이어의 게임입니다!', flags: 64 });
                return;
            }
            await mushroomGame.startRound(interaction, userId);
        }
        
        else if (interaction.customId.startsWith('mushroom_end_')) {
            const userId = interaction.customId.split('_')[2];
            if (userId !== interaction.user.id) {
                await interaction.reply({ content: '다른 플레이어의 게임입니다!', flags: 64 });
                return;
            }
            await mushroomGame.endGame(interaction, userId);
        }
        
        else if (interaction.customId.startsWith('mushroom_cancel_')) {
            const userId = interaction.customId.split('_')[2];
            if (userId !== interaction.user.id) {
                await interaction.reply({ content: '다른 플레이어의 매칭입니다!', flags: 64 });
                return;
            }
            
            if (mushroomMatchmakingQueue.has(userId)) {
                mushroomMatchmakingQueue.delete(userId);
                
                const cancelEmbed = new EmbedBuilder()
                    .setColor('#808080')
                    .setTitle('❌ 매칭이 취소되었습니다')
                    .setDescription('언제든지 다시 도전해보세요!');

                await interaction.update({
                    embeds: [cancelEmbed],
                    components: []
                });
            }
        }
        
        // 전체 기업 차트 버튼 처리
        else if (interaction.customId === 'all_companies_chart') {
            await interaction.deferUpdate();
            
            try {
                // 모든 기업 수집
                const allCompanies = [];
                for (const regionKey of Object.keys(STOCK_MARKET.regions)) {
                    const region = STOCK_MARKET.regions[regionKey];
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
                
                // 25개씩 페이지 나누기
                const itemsPerPage = 25;
                const totalPages = Math.ceil(allCompanies.length / itemsPerPage);
                const currentPage = 0;
                const startIndex = currentPage * itemsPerPage;
                const currentCompanies = allCompanies.slice(startIndex, startIndex + itemsPerPage);
                
                // 전체 기업 선택 메뉴 생성 (Discord의 25개 제한)
                const companyOptions = currentCompanies.map((company, index) => {
                    const chartHistory = STOCK_MARKET.chart_history;
                    let changeText = '';
                    
                    if (chartHistory.top_companies[company.id] && chartHistory.top_companies[company.id].length > 1) {
                        const prices = chartHistory.top_companies[company.id];
                        const change = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(1);
                        changeText = ` (${change > 0 ? '+' : ''}${change}%)`;
                    }
                    
                    return {
                        label: company.name + changeText,
                        description: `${company.region} | ${company.price.toLocaleString()}G`,
                        value: `company_chart_${company.id}`
                    };
                });
                
                const allCompanySelect = new StringSelectMenuBuilder()
                    .setCustomId('select_company_chart')
                    .setPlaceholder('전체 기업 목록에서 선택하세요')
                    .addOptions(companyOptions);
                
                const selectRow = new ActionRowBuilder().addComponents(allCompanySelect);
                
                const navigationButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('company_charts')
                            .setLabel('🔙 상위 기업만')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('stock_chart')
                            .setLabel('📊 전체 차트')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                const embed = new EmbedBuilder()
                    .setColor('#9b59b6')
                    .setTitle('📊 전체 기업 차트 선택')
                    .setDescription(`모든 기업의 개별 차트를 확인할 수 있습니다.\n\n**총 ${allCompanies.length}개 기업** (페이지 ${currentPage + 1}/${totalPages})`)
                    .addFields(
                        { 
                            name: '📋 기업 목록', 
                            value: currentCompanies.map((c, i) => `${startIndex + i + 1}. **${c.name}** (${c.region})`).join('\n'), 
                            inline: false 
                        }
                    );
                
                await interaction.editReply({
                    embeds: [embed],
                    components: [selectRow, navigationButtons],
                    files: []
                });
                
            } catch (error) {
                console.error('전체 기업 차트 오류:', error);
                await interaction.editReply({
                    content: '❌ 전체 기업 차트 생성 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            }
        }
        
        // 내 주식 복구 버튼
        else if (interaction.customId === 'recover_my_stocks') {
            await interaction.deferReply({ flags: 64 });
            
            try {
                const user = await User.findOne({ discordId: interaction.user.id });
                if (!user) {
                    await interaction.editReply({ content: '❌ 유저 데이터를 찾을 수 없습니다!' });
                    return;
                }
                
                // 예시 복구 (실제 상황에 맞게 수정 필요)
                if (!user.stockPortfolio) {
                    user.stockPortfolio = { stocks: new Map(), totalInvested: 0, lastUpdate: new Date() };
                }
                
                // 임시 복구 - 여행자 여관 1주
                user.stockPortfolio.stocks.set('traveler_inn', {
                    shares: 1,
                    avgPrice: 1379
                });
                
                await user.save();
                
                await interaction.editReply({ 
                    content: '✅ 주식 데이터가 복구되었습니다!\n🏨 여행자 여관: 1주 (평균가: 1,379골드)\n\n**실제 보유하신 주식이 다르다면 관리자에게 문의해주세요.**' 
                });
                
            } catch (error) {
                console.error('주식 복구 오류:', error);
                await interaction.editReply({ content: '❌ 주식 복구 중 오류가 발생했습니다!' });
            }
        }
        
        // 주식 도움말 버튼
        else if (interaction.customId === 'stock_help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('📈 주식 시스템 도움말')
                .setDescription('김헌터 주식 시스템 사용법을 안내해드립니다!')
                .addFields(
                    { name: '📊 기본 사용법', value: '• 지역별/체인 기업에서 주식 매수/매도\n• 포트폴리오에서 보유 현황 확인\n• 차트에서 주가 동향 분석', inline: false },
                    { name: '💰 매수/매도', value: '• 기업 선택 → 매수/매도 버튼 클릭\n• 팝업창에서 수량 입력\n• 실시간 주가로 거래 체결', inline: false },
                    { name: '🔧 데이터 복구', value: '• 봇 재시작으로 주식이 사라진 경우\n• "내 주식 복구" 버튼 클릭\n• 관리자에게 정확한 복구 요청', inline: false },
                    { name: '📈 차트 기능', value: '• 실시간 시장 차트\n• 개별 기업 차트\n• 전체 기업 목록 조회', inline: false }
                )
                .setFooter({ text: '주식 투자는 신중하게! 가격 변동에 유의하세요.' });
            
            await interaction.reply({ embeds: [helpEmbed], flags: 64 });
        }

    } catch (error) {
        console.error('인터렉션 처리 오류:', error);
        
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
