const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const randomItemGenerator = require('./randomItemGenerator');
const fs = require('fs');
const path = require('path');
const GAME_GIFS = require('../data/gameGifs');
const User = require('../models/User');
const InventoryManager = require('../utils/inventoryManager');
const ShopTransactionManager = require('../utils/shopTransactionManager');

// 상점 메시지 ID 저장
const permanentMessageIds = new Map();
const MESSAGE_IDS_FILE = path.join(__dirname, '..', 'data', 'shopMessages.json');

// 임시 아이템 저장소 (인벤토리에 저장하지 않은 아이템들)
const tempItems = new Map(); // userId -> [items]
const TEMP_ITEMS_FILE = path.join(__dirname, '..', 'data', 'tempItems.json');

// 뽑기 처리 중인 유저 추적 (중복 클릭 방지)
const gachaInProgress = new Set();

// 5분마다 자동으로 막힌 뽑기 상태 정리
setInterval(() => {
    if (gachaInProgress.size > 0) {
        console.log(`[GachaCleanup] 막힌 뽑기 상태 정리 - 현재 ${gachaInProgress.size}개`);
        gachaInProgress.clear();
    }
}, 300000);

// 부위별 이모지
const SLOT_EMOJIS = {
    weapon: '⚔️',
    armor: '🛡️',
    helmet: '🪖',
    gloves: '🧤',
    boots: '👢',
    shield: '🛡️',
    accessory: '💍'
};

// 부위별 한글명
const SLOT_NAMES = {
    weapon: '무기',
    armor: '갑옷',
    helmet: '투구',
    gloves: '장갑',
    boots: '신발',
    shield: '방패',
    accessory: '장신구'
};

// 레벨별 확률 테이블 - 30% 너프 적용
const LEVEL_RATES = {
    1: { legendary: 0.0007, unique: 0.007, epic: 0.035, rare: 0.15, normal: 0.7573, trash: 0.05 },
    2: { legendary: 0.0014, unique: 0.0105, epic: 0.042, rare: 0.16, normal: 0.7361, trash: 0.05 },
    3: { legendary: 0.0021, unique: 0.014, epic: 0.049, rare: 0.17, normal: 0.7149, trash: 0.05 },
    4: { legendary: 0.0028, unique: 0.0175, epic: 0.0525, rare: 0.185, normal: 0.6922, trash: 0.05 },
    5: { legendary: 0.0035, unique: 0.021, epic: 0.056, rare: 0.20, normal: 0.6695, trash: 0.05 },
    6: { legendary: 0.0042, unique: 0.0245, epic: 0.063, rare: 0.21, normal: 0.6483, trash: 0.05 },
    7: { legendary: 0.0049, unique: 0.028, epic: 0.07, rare: 0.22, normal: 0.6271, trash: 0.05 },
    8: { legendary: 0.0056, unique: 0.0315, epic: 0.077, rare: 0.23, normal: 0.6059, trash: 0.05 },
    9: { legendary: 0.0063, unique: 0.0336, epic: 0.0805, rare: 0.24, normal: 0.5896, trash: 0.05 },
    10: { legendary: 0.007, unique: 0.035, epic: 0.084, rare: 0.25, normal: 0.574, trash: 0.05 },
    11: { legendary: 0.0084, unique: 0.042, epic: 0.091, rare: 0.26, normal: 0.5586, trash: 0.04 },
    12: { legendary: 0.0098, unique: 0.049, epic: 0.098, rare: 0.27, normal: 0.5432, trash: 0.04 },
    13: { legendary: 0.0112, unique: 0.056, epic: 0.105, rare: 0.28, normal: 0.5278, trash: 0.03 },
    14: { legendary: 0.0126, unique: 0.063, epic: 0.112, rare: 0.29, normal: 0.5124, trash: 0.03 },
    15: { legendary: 0.014, unique: 0.07, epic: 0.126, rare: 0.30, normal: 0.47, trash: 0.02 },
    16: { legendary: 0.0175, unique: 0.084, epic: 0.14, rare: 0.31, normal: 0.4485, trash: 0.02 },
    17: { legendary: 0.021, unique: 0.098, epic: 0.147, rare: 0.32, normal: 0.413, trash: 0.01 },
    18: { legendary: 0.0245, unique: 0.112, epic: 0.154, rare: 0.33, normal: 0.3785, trash: 0.01 },
    19: { legendary: 0.028, unique: 0.126, epic: 0.161, rare: 0.34, normal: 0.344, trash: 0.01 },
    20: { legendary: 0.035, unique: 0.14, epic: 0.175, rare: 0.35, normal: 0.29, trash: 0.01 }
};

// 레벨업 필요 경험치 계산
function getRequiredExp(level) {
    // 레벨이 올라갈수록 기하급수적으로 증가
    if (level <= 5) return level * 10; // 1-5: 10, 20, 30, 40, 50
    if (level <= 10) return level * 15; // 6-10: 90, 105, 120, 135, 150
    if (level <= 15) return level * 25; // 11-15: 275, 300, 325, 350, 375
    return level * 40; // 16-20: 640, 680, 720, 760, 800
}

// 현재 레벨의 확률 가져오기
function getRatesForLevel(level) {
    console.log(`[getRatesForLevel] 레벨 ${level}에 대한 확률 테이블 조회`);
    
    // 레벨이 20을 초과하면 20레벨 확률 사용
    const actualLevel = Math.min(level, 20);
    const selectedRates = LEVEL_RATES[actualLevel] || LEVEL_RATES[1];
    
    console.log(`- Lv.${level} → Lv.${actualLevel} 확률 사용`);
    console.log(`- 선택된 확률:`, selectedRates);
    return selectedRates;
}

// 임시 아이템 저장
function saveTempItems() {
    try {
        const data = {};
        tempItems.forEach((items, userId) => {
            data[userId] = items;
        });
        
        const dataDir = path.dirname(TEMP_ITEMS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(TEMP_ITEMS_FILE, JSON.stringify(data, null, 2));
        console.log('✅ 임시 아이템 저장 완료');
    } catch (error) {
        console.error('임시 아이템 저장 실패:', error);
    }
}

// 임시 아이템 로드
function loadTempItems() {
    try {
        if (fs.existsSync(TEMP_ITEMS_FILE)) {
            const data = JSON.parse(fs.readFileSync(TEMP_ITEMS_FILE, 'utf8'));
            Object.entries(data).forEach(([userId, items]) => {
                tempItems.set(userId, items);
            });
            console.log('✅ 임시 아이템 로드 완료');
        }
    } catch (error) {
        console.error('임시 아이템 로드 실패:', error);
    }
}

// 저장된 메시지 ID 로드
function loadMessageIds() {
    try {
        if (fs.existsSync(MESSAGE_IDS_FILE)) {
            const data = JSON.parse(fs.readFileSync(MESSAGE_IDS_FILE, 'utf8'));
            Object.entries(data).forEach(([channelId, messageId]) => {
                permanentMessageIds.set(channelId, messageId);
            });
            console.log('✅ 상점 메시지 ID 로드 완료');
        }
    } catch (error) {
        console.error('상점 메시지 ID 로드 실패:', error);
    }
}

// 메시지 ID 저장
function saveMessageIds() {
    try {
        const data = {};
        permanentMessageIds.forEach((messageId, channelId) => {
            data[channelId] = messageId;
        });
        
        const dataDir = path.dirname(MESSAGE_IDS_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(MESSAGE_IDS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('상점 메시지 ID 저장 실패:', error);
    }
}

// 로드
loadMessageIds();
loadTempItems();

// 상점 초기화 (유저 데이터에 상점 레벨 추가)
function initializeUserShopLevels(user) {
    // shopLevels가 없거나 기본 구조가 아닌 경우 초기화
    if (!user.shopLevels || typeof user.shopLevels !== 'object') {
        user.shopLevels = {
            weapon: { level: 1, exp: 0, totalPulls: 0 },
            armor: { level: 1, exp: 0, totalPulls: 0 },
            helmet: { level: 1, exp: 0, totalPulls: 0 },
            gloves: { level: 1, exp: 0, totalPulls: 0 },
            boots: { level: 1, exp: 0, totalPulls: 0 },
            shield: { level: 1, exp: 0, totalPulls: 0 },
            accessory: { level: 1, exp: 0, totalPulls: 0 }
        };
    }
    
    // 각 부위별로 필드가 없으면 초기화
    const slots = ['weapon', 'armor', 'helmet', 'gloves', 'boots', 'shield', 'accessory'];
    slots.forEach(slot => {
        // 숫자로 저장된 경우나 객체가 아닌 경우 재초기화
        if (!user.shopLevels[slot] || typeof user.shopLevels[slot] !== 'object') {
            user.shopLevels[slot] = { level: 1, exp: 0, totalPulls: 0 };
        }
        // 필드가 누락된 경우 기본값 설정
        if (!user.shopLevels[slot].level) user.shopLevels[slot].level = 1;
        if (!user.shopLevels[slot].exp) user.shopLevels[slot].exp = 0;
        if (!user.shopLevels[slot].totalPulls) user.shopLevels[slot].totalPulls = 0;
    });
    
    return user.shopLevels;
}

// 상점 메인 Embed 생성
function createShopEmbed(user) {
    const shopLevels = initializeUserShopLevels(user);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏪 장비 상점')
        .setDescription(
            '**천장 시스템 기반 장비 상점**\n' +
            '뽑기를 할수록 상점 레벨이 오르고 좋은 아이템 확률이 증가합니다!\n\n' +
            '💰 **가격**: 10,000 골드 / 1회 | 90,000 골드 / 10회 (10% 할인)\n' +
            `💵 **보유 골드**: ${user.gold.toLocaleString()} 골드\n\n` +
            '**📊 상점 레벨 현황**'
        );

    // 각 부위별 레벨 표시
    Object.entries(shopLevels).forEach(([slot, data]) => {
        const requiredExp = getRequiredExp(data.level);
        const progressBar = createProgressBar(data.exp, requiredExp);
        
        embed.addFields({
            name: `${SLOT_EMOJIS[slot]} ${SLOT_NAMES[slot]} 상점 Lv.${data.level}`,
            value: `${progressBar} (${data.exp}/${requiredExp})\n총 ${data.totalPulls}회 뽑기`,
            inline: true
        });
    });

    // 확률 정보 추가
    embed.addFields({
        name: '\n📈 레벨별 확률 정보',
        value: 
            '**Lv.1**: 🏆 0.1% | 💎 1%\n' +
            '**Lv.5**: 🏆 0.5% | 💎 3%\n' +
            '**Lv.10**: 🏆 1% | 💎 5%\n' +
            '**Lv.15**: 🏆 2% | 💎 10%\n' +
            '**Lv.20**: 🏆 5% | 💎 20%',
        inline: false
    });

    embed.addFields({
        name: '📌 범례',
        value: '🏆 = Legendary (전설) | 💎 = Unique (유니크)',
        inline: false
    });

    embed.setFooter({ text: '부위를 선택하여 장비를 뽑아보세요!' })
        .setTimestamp();

    return embed;
}

// 진행도 바 생성
function createProgressBar(current, max) {
    // 유효성 검사
    if (!max || max <= 0) return '░░░░░░░░░░ 0%';
    if (current < 0) current = 0;
    if (current > max) current = max;
    
    const percentage = Math.floor((current / max) * 100);
    const filled = Math.max(0, Math.floor(percentage / 10)); // 최소값 0 보장
    const empty = Math.max(0, 10 - filled); // 최소값 0 보장
    
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${percentage}%`;
}

// 부위 선택 메뉴 생성
function createSlotSelectMenu(user) {
    const shopLevels = initializeUserShopLevels(user);
    
    const options = Object.entries(SLOT_NAMES).map(([slot, name]) => ({
        label: `${name} (Lv.${shopLevels[slot].level})`,
        description: `${name} 뽑기 - 현재 레벨: ${shopLevels[slot].level}`,
        value: slot,
        emoji: SLOT_EMOJIS[slot]
    }));
    
    // 판매 옵션 추가
    options.push({
        label: '💰 장비 판매',
        description: '보유한 장비를 판매합니다',
        value: 'sell_items',
        emoji: '💰'
    });
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_slot_select')
        .setPlaceholder('메뉴를 선택하세요')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(selectMenu);
}


// 레벨에 따른 뽑기 함수
function generateItemWithPity(slot, slotData, user) {
    const level = slotData.level;
    const rates = getRatesForLevel(level);
    
    // 디버그 로그 추가
    console.log(`[generateItemWithPity] 디버그 정보:`);
    console.log(`- 슬롯: ${slot}`);
    console.log(`- 현재 레벨: ${level}`);
    console.log(`- 적용된 확률:`, JSON.stringify(rates, null, 2));
    console.log(`- legendary: ${(rates.legendary * 100).toFixed(2)}%`);
    console.log(`- unique: ${(rates.unique * 100).toFixed(2)}%`);
    console.log(`- epic: ${(rates.epic * 100).toFixed(2)}%`);
    console.log(`- rare: ${(rates.rare * 100).toFixed(2)}%`);
    console.log(`- normal: ${(rates.normal * 100).toFixed(2)}%`);
    console.log(`- trash: ${(rates.trash * 100).toFixed(2)}%`);
    
    // 유저의 엠블럼 타입 가져오기 (강화 레벨 제거)
    const userEmblemType = user.emblem ? user.emblem.replace(/\s*\+\d+$/, '') : null;
    
    // 디버그: 엠블럼 확인
    if (userEmblemType) {
        console.log(`[generateItemWithPity] 유저 ${user.nickname}의 엠블럼: ${userEmblemType}`);
    } else {
        console.log(`[generateItemWithPity] 유저 ${user.nickname}의 엠블럼이 없음`);
    }
    
    try {
        // 커스텀 확률로 아이템 생성
        const customGachaType = {
            name: `Level ${level} Gacha`,
            rates: rates
        };
        
        // randomItemGenerator의 데이터 구조에 맞게 설정
        randomItemGenerator.data.gachaRates['custom'] = customGachaType;
        
        // 부위별 아이템 생성
        const item = randomItemGenerator.generateItemBySlot(slot, 'custom', userEmblemType);
        
        // 원래 설정 복구
        delete randomItemGenerator.data.gachaRates['custom'];
        
        // 필수 필드 추가
        if (!item.setName) {
            item.setName = '장비';  // 기본값 설정
        }
        if (!item.quantity) {
            item.quantity = 1;
        }
        if (!item.appraisedAt) {
            item.appraisedAt = new Date();
        }
        if (!item.foundAt) {
            item.foundAt = new Date();
        }
        
        // 생성된 아이템 정보 로그
        console.log(`[generateItemWithPity] 생성된 아이템:`);
        console.log(`- 이름: ${item.name}`);
        console.log(`- 등급: ${item.rarity}`);
        console.log(`- 점수: ${item.score}`);
        console.log(`- 가격: ${item.price}`);
        console.log(`- 판매가: ${item.sellPrice}`);
        console.log(`-------------------`);
        
        return item;
    } catch (error) {
        console.error(`[generateItemWithPity] 아이템 생성 중 오류:`, error);
        
        // 오류 발생 시 원래 설정 복구
        delete randomItemGenerator.data.gachaRates['custom'];
        
        // 기본 아이템 반환
        const slotNames = {
            weapon: '무기',
            armor: '갑옷', 
            helmet: '투구',
            gloves: '장갑',
            boots: '신발',
            shield: '방패',
            accessory: '장신구'
        };
        
        return {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: `평범한 ${slotNames[slot] || '장비'}`,
            type: slot,
            rarity: 'normal',
            color: '#95a5a6',
            emoji: '⚪',
            stats: { attack: 10, defense: 10 },
            description: '평범하지만 쓸만한 아이템입니다.',
            price: 1000,
            sellPrice: 300,
            enhanceLevel: 0,
            score: 10,
            setName: '장비',
            quantity: 1,
            appraisedAt: new Date(),
            foundAt: new Date()
        };
    }
}

// 뽑기 애니메이션 프레임
const GACHA_ANIMATION_FRAMES = [
    '🎰 뽑는 중... ⠋',
    '🎰 뽑는 중... ⠙',
    '🎰 뽑는 중... ⠹',
    '🎰 뽑는 중... ⠸',
    '🎰 뽑는 중... ⠼',
    '🎰 뽑는 중... ⠴',
    '🎰 뽑는 중... ⠦',
    '🎰 뽑는 중... ⠧',
    '🎰 뽑는 중... ⠇',
    '🎰 뽑는 중... ⠏'
];

// 점수별 반응 메시지
function getScoreReaction(score) {
    if (score >= 90) return '🏆 대박! 최고급 아이템입니다!';
    if (score >= 70) return '✨ 훌륭한 아이템입니다!';
    if (score >= 50) return '👍 좋은 아이템입니다!';
    if (score >= 30) return '😊 쓸만한 아이템입니다.';
    return '😅 다음엔 더 좋은게 나올거예요...';
}

// 에픽 이상 아이템 특별 설명
function getEpicItemDescription(rarity, score) {
    if (rarity !== 'epic' && rarity !== 'unique' && rarity !== 'legendary') return null;
    
    const epicDescriptions = [
        "뛰어난 장인이 심혈을 기울여 만든 명품입니다.",
        "고대의 비밀이 깃든 신비로운 아이템입니다.",
        "전설적인 영웅이 사용했던 것으로 전해집니다.",
        "천년의 세월을 견뎌낸 불멸의 걸작입니다.",
        "신들의 축복이 깃든 성스러운 유물입니다.",
        "마법의 정수가 응축된 환상적인 작품입니다.",
        "용의 숨결로 단조된 전설의 무구입니다.",
        "별빛을 머금은 천상의 보물입니다.",
        "시간을 초월한 불가사의한 유물입니다.",
        "운명을 바꿀 수 있는 힘이 깃들어 있습니다."
    ];
    
    const uniqueDescriptions = [
        "세상에 단 하나뿐인 독특한 아이템입니다.",
        "신비한 힘이 소용돌이치는 희귀한 보물입니다.",
        "고대 문명의 잃어버린 기술로 제작되었습니다.",
        "차원의 균열에서 발견된 이계의 유물입니다.",
        "영혼의 공명을 일으키는 신비한 아이템입니다.",
        "시공간을 뛰어넘은 기적의 산물입니다.",
        "천재 장인의 일생일대의 역작입니다.",
        "마법과 과학이 융합된 궁극의 걸작입니다.",
        "신화 속에만 존재했던 환상의 아이템입니다.",
        "무한한 가능성을 품은 기적의 결정체입니다."
    ];
    
    const legendaryDescriptions = [
        "신화의 시대부터 전해져 내려온 전설의 유물입니다.",
        "신들조차 탐내는 궁극의 보물입니다.",
        "세계의 운명을 좌우할 힘을 지닌 성물입니다.",
        "창조의 힘이 깃든 태초의 아이템입니다.",
        "불멸의 존재들이 남긴 최후의 유산입니다.",
        "차원을 초월한 절대적인 힘의 결정체입니다.",
        "우주의 진리가 새겨진 궁극의 아티팩트입니다.",
        "시간의 시작과 끝을 아는 영원의 보물입니다.",
        "신계와 인간계를 잇는 신성한 매개체입니다.",
        "만물의 이치가 깃든 창조의 걸작품입니다."
    ];
    
    let descriptions;
    if (rarity === 'legendary') {
        descriptions = legendaryDescriptions;
    } else if (rarity === 'unique') {
        descriptions = uniqueDescriptions;
    } else {
        descriptions = epicDescriptions;
    }
    
    // 점수에 따라 다른 설명 선택 (높은 점수일수록 더 화려한 설명)
    const index = score >= 90 ? Math.floor(Math.random() * 3) + 7 : 
                  score >= 70 ? Math.floor(Math.random() * 4) + 3 :
                  Math.floor(Math.random() * descriptions.length);
    
    return descriptions[Math.min(index, descriptions.length - 1)];
}

// 안전한 인터랙션 응답 헬퍼
async function safeInteractionDefer(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
            return true;
        } catch (error) {
            if (error.code === 10062) {
                console.log('인터랙션이 만료되었습니다.');
            } else if (error.code === 40060) {
                console.log('인터랙션이 이미 처리되었습니다.');
            }
            return false;
        }
    }
    return true;
}

// 안전한 인터랙션 응답 헬퍼
async function safeInteractionReply(interaction, options) {
    try {
        if (interaction.deferred) {
            await interaction.editReply(options);
        } else if (!interaction.replied) {
            await interaction.reply(options);
        }
    } catch (error) {
        console.error('인터랙션 응답 실패:', error.code, error.message);
    }
}

// 상점 상호작용 처리
async function handleShopInteraction(interaction, getUser, saveUser) {
    // User 모델 직접 import
    const User = require('../models/User');
    
    // 버튼에 사용자 ID가 포함된 경우, 해당 사용자만 사용 가능
    // 하지만 페이지 번호나 다른 숫자 파라미터는 제외
    const excludedPatterns = ['quick_sell_page_', 'inventory_page_', 'equip_page_', 'temp_page_', '_page_'];
    const shouldCheckUserId = interaction.customId.includes('_') && 
                            !excludedPatterns.some(pattern => interaction.customId.includes(pattern));
    
    if (shouldCheckUserId) {
        const parts = interaction.customId.split('_');
        const targetUserId = parts[parts.length - 1];
        // 숫자로만 이루어진 경우 사용자 ID로 판단
        if (/^\d{15,}$/.test(targetUserId) && targetUserId !== interaction.user.id) {
            await interaction.reply({
                content: '❌ 다른 사람의 상점입니다!',
                flags: 64
            });
            return;
        }
    }
    
    if (interaction.customId === 'shop_refresh') {
        // 안전한 defer 처리
        const deferred = await safeInteractionDefer(interaction);
        if (!deferred) return;
        
        const user = await getUser(interaction.user.id);
        
        // 상점으로 돌아갈 때도 해당 유저의 모든 뽑기 세션 정리
        const userId = interaction.user.id;
        const keysToRemove = [];
        
        for (const key of gachaInProgress) {
            if (key.startsWith(userId)) {
                keysToRemove.push(key);
            }
        }
        
        if (keysToRemove.length > 0) {
            console.log(`[Shop Refresh] ${userId}의 이전 뽑기 세션 정리:`, keysToRemove);
            for (const key of keysToRemove) {
                gachaInProgress.delete(key);
            }
        }
        
        if (!user || !user.registered) {
            await interaction.editReply({
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
            return;
        }
        
        const embed = createShopEmbed(user);
        const selectMenu = createSlotSelectMenu(user);
        
        await interaction.editReply({
            embeds: [embed],
            components: [selectMenu]
        });
        return;
    }

    if (interaction.customId === 'shop_slot_select') {
        // 안전한 defer 처리
        const deferred = await safeInteractionDefer(interaction);
        if (!deferred) return;
        
        const selectedValue = interaction.values[0];
        const user = await getUser(interaction.user.id);
        
        // 상점 메뉴를 새로 열 때 해당 유저의 모든 뽑기 세션 정리
        const userId = interaction.user.id;
        const keysToRemove = [];
        
        // 해당 유저의 모든 뽑기 키 찾기
        for (const key of gachaInProgress) {
            if (key.startsWith(userId)) {
                keysToRemove.push(key);
            }
        }
        
        // 찾은 키들 제거
        if (keysToRemove.length > 0) {
            console.log(`[Shop] ${userId}의 이전 뽑기 세션 정리:`, keysToRemove);
            for (const key of keysToRemove) {
                gachaInProgress.delete(key);
            }
        }
        
        if (!user || !user.registered) {
            await interaction.editReply({
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
            return;
        }

        // 판매 메뉴 선택
        if (selectedValue === 'sell_items') {
            try {
                console.log('판매 메뉴 선택됨, user:', user?.discordId, 'inventory 길이:', user?.inventory?.length);
                const { showSellMenu } = require('./sellSystem');
                await showSellMenu(interaction, user);
            } catch (error) {
                console.error('판매 메뉴 호출 오류:', error);
                await interaction.editReply({
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    embeds: [],
                    components: []
                });
            }
            return;
        }

        // 뽑기 방식 선택 화면 표시
        await showGachaOptions(interaction, user, selectedValue);
        return;
    }

    // 단일 뽑기 처리
    if (interaction.customId.startsWith('gacha_single_')) {
        await handleSingleGacha(interaction, getUser, saveUser);
        return;
    }
    
    // 10회 뽑기 처리
    if (interaction.customId.startsWith('gacha_multi_')) {
        await handleMultiGacha(interaction, getUser, saveUser);
        return;
    }
    
    // 다시 10회 뽑기 처리
    if (interaction.customId.startsWith('retry_multi_')) {
        await handleMultiGacha(interaction, getUser, saveUser);
        return;
    }
    
    // 임시 아이템 저장
    if (interaction.customId === 'save_all_temp') {
        await interaction.deferUpdate();
        const user = await getUser(interaction.user.id);
        const userTempItems = tempItems.get(user.discordId) || [];
        
        if (userTempItems.length === 0) {
            await interaction.followUp({
                content: '❌ 저장할 임시 아이템이 없습니다.',
                flags: 64
            });
            return;
        }
        
        // 인벤토리 아이템 형식에 맞게 변환하여 추가
        const inventoryItems = userTempItems.map(item => ({
            ...item,
            setName: '장비', // 장비 아이템으로 분류
            quantity: 1,
            appraisedAt: new Date(),
            foundAt: new Date()
        }));
        user.inventory.push(...inventoryItems);
        await saveUser(user);
        
        const savedCount = userTempItems.length;
        tempItems.set(user.discordId, []); // 임시 저장소 비우기
        saveTempItems(); // 파일에 저장
        
        await interaction.followUp({
            content: `✅ ${savedCount}개의 아이템을 인벤토리에 저장했습니다!`,
            flags: 64
        });
        return;
    }
    
    // 새로운 판매 시스템 인터랙션 처리
    const sellSystem = require('./sellSystem');
    
    // 판매 모드 선택
    if (interaction.customId === 'sell_mode_quick') {
        await sellSystem.showQuickSellMode(interaction, await getUser(interaction.user.id));
        return;
    }
    
    if (interaction.customId === 'sell_mode_cart') {
        // 즉시 응답
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        // 기존 카트 판매 모드로 전환
        const user = await getUser(interaction.user.id);
        await showSellMenu(interaction, user, getUser, saveUser);
        return;
    }
    
    if (interaction.customId === 'sell_grade_menu') {
        await sellSystem.showGradeSellMenu(interaction, await getUser(interaction.user.id));
        return;
    }
    
    // 등급별 판매 실행
    if (interaction.customId.startsWith('grade_sell_')) {
        const grade = interaction.customId.replace('grade_sell_', '');
        await sellSystem.executeGradeSell(interaction, interaction.user.id, grade);
        return;
    }
    
    // 등급별 판매 확인
    if (interaction.customId.startsWith('confirm_grade_sell_')) {
        const grade = interaction.customId.replace('confirm_grade_sell_', '');
        await sellSystem.executeGradeSell(interaction, interaction.user.id, grade, true); // isConfirmed = true
        return;
    }
    
    // 빠른 판매 페이지 네비게이션
    if (interaction.customId.startsWith('quick_sell_page_')) {
        const page = parseInt(interaction.customId.replace('quick_sell_page_', ''));
        await sellSystem.showQuickSellMode(interaction, await getUser(interaction.user.id), page);
        return;
    }
    
    // 빠른 판매 아이템 선택
    if (interaction.customId === 'quick_sell_select') {
        // 인터랙션 즉시 defer
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        const itemIndex = parseInt(interaction.values[0].replace('quick_sell_', ''));
        await sellSystem.executeQuickSell(interaction, interaction.user.id, itemIndex);
        return;
    }
    
    // 판매 메뉴 돌아가기
    if (interaction.customId === 'sell_menu_back' || interaction.customId === 'sell_menu_return') {
        await sellSystem.showSellMenu(interaction, await getUser(interaction.user.id));
        return;
    }
    
    // shop_continue 또는 shop_back 버튼 처리
    if (interaction.customId.startsWith('shop_continue_') || interaction.customId.startsWith('shop_back_')) {
        // 버튼의 사용자 ID 추출
        const buttonUserId = interaction.customId.split('_').pop();
        
        // 버튼을 클릭한 사용자가 원래 사용자인지 확인
        if (interaction.user.id !== buttonUserId) {
            await interaction.reply({
                content: '❌ 이 버튼은 뽑기를 한 사용자만 사용할 수 있습니다!',
                flags: 64
            });
            return;
        }
        
        await interaction.deferUpdate();
        const user = await getUser(interaction.user.id);
        
        const embed = createShopEmbed(user);
        const selectMenu = createSlotSelectMenu(user);
        
        await interaction.editReply({
            embeds: [embed],
            components: [selectMenu]
        });
    }
    
}

// 상점 초기화
async function initializeShop(client, channelId, forceNew = false) {
    try {
        const channel = await client.channels.fetch(channelId).catch(err => {
            console.error(`채널 ${channelId} 접근 권한 없음:`, err.message);
            return null;
        });
        
        if (!channel) {
            return null;
        }
        
        if (!channel.permissionsFor(client.user).has(['SendMessages', 'ViewChannel'])) {
            console.error(`채널 ${channelId}에 메시지 전송 권한이 없습니다.`);
            return null;
        }

        // 기본 유저 데이터로 embed 생성
        const defaultUser = {
            gold: 0,
            shopLevels: null
        };
        
        const embed = createShopEmbed(defaultUser);
        const selectMenu = createSlotSelectMenu(defaultUser);

        // 저장된 메시지 ID 확인
        const storedMessageId = permanentMessageIds.get(channelId);
        
        if (storedMessageId && !forceNew) {
            try {
                const existingMessage = await channel.messages.fetch(storedMessageId);
                await existingMessage.edit({
                    embeds: [embed],
                    components: [selectMenu]
                });
                console.log(`✅ 장비 상점 메시지 업데이트 완료 (채널: ${channel.name})`);
                return existingMessage;
            } catch (error) {
                console.log(`기존 메시지를 찾을 수 없어 새로 생성합니다. (채널: ${channel.name})`);
                permanentMessageIds.delete(channelId);
            }
        }
        
        // 최근 메시지에서 상점 메시지 찾기
        if (!forceNew) {
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const shopMessage = messages.find(msg => 
                    msg.author.id === client.user.id && 
                    msg.embeds.length > 0 && 
                    msg.embeds[0].title === '🏪 장비 상점'
                );
                
                if (shopMessage) {
                    console.log(`✅ 기존 장비 상점 메시지 발견! 업데이트합니다. (채널: ${channel.name})`);
                    await shopMessage.edit({
                        embeds: [embed],
                        components: [selectMenu]
                    });
                    
                    permanentMessageIds.set(channelId, shopMessage.id);
                    saveMessageIds();
                    
                    return shopMessage;
                }
            } catch (error) {
                console.log('최근 메시지 검색 중 오류:', error.message);
            }
        }

        // 새 메시지 생성
        const message = await channel.send({
            embeds: [embed],
            components: [selectMenu]
        });

        permanentMessageIds.set(channelId, message.id);
        saveMessageIds();
        console.log(`✅ 장비 상점 메시지 생성 완료 (채널: ${channel.name}, ID: ${message.id})`);
        
        return message;
    } catch (error) {
        console.error(`장비 상점 초기화 오류 (채널 ${channelId}):`, error);
        return null;
    }
}

// 뽑기 방식 선택 화면
async function showGachaOptions(interaction, user, selectedSlot) {
    const shopLevel = user.shopLevels[selectedSlot];
    const rates = getRatesForLevel(shopLevel.level);
    const price = 10000;
    const requiredExp = getRequiredExp(shopLevel.level);
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`${SLOT_EMOJIS[selectedSlot]} ${SLOT_NAMES[selectedSlot]} 상점 (Lv.${shopLevel.level})`)
        .setDescription(`경험치: ${shopLevel.exp}/${requiredExp}\n총 뽑기: ${shopLevel.totalPulls}회`)
        .addFields(
            {
                name: '📊 현재 확률',
                value: `🟠 전설: ${(rates.legendary * 100).toFixed(1)}%\n` +
                       `🟣 유니크: ${(rates.unique * 100).toFixed(1)}%\n` +
                       `🔴 에픽: ${(rates.epic * 100).toFixed(1)}%\n` +
                       `🔵 레어: ${(rates.rare * 100).toFixed(1)}%`,
                inline: true
            },
            {
                name: '💰 가격',
                value: `1회: ${price.toLocaleString()}G\n10회: ${(price * 9).toLocaleString()}G (10% 할인)`,
                inline: true
            },
            {
                name: '💵 보유 골드',
                value: `${user.gold.toLocaleString()}G`,
                inline: true
            }
        );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`gacha_single_${selectedSlot}_${user.discordId}`)
                .setLabel(`1회 뽑기 (${price.toLocaleString()}G)`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.gold < price),
            new ButtonBuilder()
                .setCustomId(`gacha_multi_${selectedSlot}_${user.discordId}`)
                .setLabel(`10회 뽑기 (${(price * 9).toLocaleString()}G)`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(user.gold < price * 9),
            new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('뒤로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 단일 뽑기 처리
async function handleSingleGacha(interaction, getUser, saveUser) {
    // customId 파싱 - gacha_single_weapon_123456789 형식
    const parts = interaction.customId.split('_');
    const selectedSlot = parts[2];
    const targetUserId = parts[3];
    
    // 사용자 확인
    if (targetUserId && targetUserId !== interaction.user.id) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 다른 사람의 뽑기입니다!',
                    flags: 64
                });
            }
        } catch (e) {
            console.error('[handleSingleGacha] 타인 접근 응답 실패:', e);
        }
        return;
    }
    
    // 중복 클릭 방지 - 슬롯별로 구분
    const gachaKey = `${targetUserId || interaction.user.id}_single_${selectedSlot}`;
    console.log(`[handleSingleGacha] 처리 시작 - 사용자: ${interaction.user.id}, 키: ${gachaKey}`);
    console.log(`[handleSingleGacha] 현재 진행중인 뽑기:`, Array.from(gachaInProgress));
    
    if (gachaInProgress.has(gachaKey)) {
        console.log('[handleSingleGacha] 이미 처리 중인 뽑기입니다.');
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '⏳ 뽑기가 이미 진행 중입니다. 잠시 기다려주세요.',
                    flags: 64
                });
            }
        } catch (e) {
            console.error('[handleSingleGacha] 중복 알림 실패:', e);
        }
        return;
    }
    
    // 처리 시작 표시
    gachaInProgress.add(gachaKey);
    
    // 15초 후 자동 해제 (안전장치) - 느린 네트워크 대응
    const cleanupTimeout = setTimeout(() => {
        if (gachaInProgress.has(gachaKey)) {
            console.log(`[handleSingleGacha] 15초 경과 - 자동 해제: ${gachaKey}`);
            gachaInProgress.delete(gachaKey);
        }
    }, 15000);
    
    try {
        // 안전한 defer 처리 및 버튼 즉시 비활성화
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
                
                // 버튼을 즉시 비활성화
                const message = interaction.message;
                if (message && message.components) {
                    const updatedComponents = message.components.map(row => {
                        const newRow = new ActionRowBuilder();
                        row.components.forEach(component => {
                            if (component.type === 2) { // Button type
                                const newButton = ButtonBuilder.from(component);
                                newButton.setDisabled(true);
                                newRow.addComponents(newButton);
                            }
                        });
                        return newRow;
                    });
                    
                    await interaction.editReply({
                        embeds: message.embeds,
                        components: updatedComponents
                    });
                }
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('[handleSingleGacha] 인터랙션이 만료되었습니다.');
                return;
            } else if (error.code === 40060) {
                console.log('[handleSingleGacha] 인터랙션이 이미 처리되었습니다.');
            } else {
                console.error('[handleSingleGacha] defer 오류:', error);
                return;
            }
        }
        
        // 트랜잭션 방식으로 처리
        const result = await ShopTransactionManager.executeSingleGacha(
            interaction.user.id,
            selectedSlot,
            generateItemWithPity
        );
        
        if (!result.success) {
            throw new Error(result.error || '아이템 뽑기에 실패했습니다.');
        }
        
        const { user, item, leveledUp } = result;
        
        // 애니메이션
        const rollingEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎰 뽑기 중...')
            .setDescription('두근두근... 어떤 아이템이 나올까요?')
            .setImage(GAME_GIFS.shop.gacha);
    
        await interaction.editReply({
            embeds: [rollingEmbed],
            components: []
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 이미 트랜잭션에서 처리됨
        
        // 결과 표시 (기존 코드 활용)
        const resultEmbed = new EmbedBuilder()
            .setColor(item.color)
            .setTitle(`${getRarityEmoji(item.rarity)} ${item.rarity.toUpperCase()} 아이템 획득!`)
            .setDescription(`**${item.name}**\n점수: ${item.score}점\n\n✅ 인벤토리에 자동 저장되었습니다!`)
            .addFields(
                {
                    name: '📊 능력치',
                    value: formatItemStats(item.stats),
                    inline: true
                },
                {
                    name: '📝 정보',
                    value: `종류: ${SLOT_NAMES[item.type]}\n가격: ${item.price ? item.price.toLocaleString() : '10,000'}G\n${item.description}`,
                    inline: true
                }
            );
        
        // 레어도에 따른 GIF 추가
        if (item.rarity === 'legendary' || item.rarity === 'unique' || item.rarity === 'epic') {
            resultEmbed.setImage(GAME_GIFS.shop.jackpot);
        }
        
        if (leveledUp) {
            resultEmbed.addFields({
                name: '🎉 레벨업!',
                value: `${SLOT_NAMES[selectedSlot]} 상점이 Lv.${user.shopLevels[selectedSlot].level}로 상승했습니다!`,
                inline: false
            });
        }
        
        const continueButton = new ButtonBuilder()
            .setCustomId(`shop_continue_${interaction.user.id}`)
            .setLabel('계속 뽑기')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎰');
        
        const backButton = new ButtonBuilder()
            .setCustomId(`shop_back_${interaction.user.id}`)
            .setLabel('돌아가기')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️');
        
        const buttonRow = new ActionRowBuilder().addComponents(continueButton, backButton);
        
        await interaction.editReply({
            embeds: [resultEmbed],
            components: [buttonRow]
        });
        
        // Epic 이상 공지 - 10초 후 삭제
        if (item.rarity === 'epic' || item.rarity === 'unique' || item.rarity === 'legendary') {
            const announceEmbed = new EmbedBuilder()
                .setColor(item.color)
                .setTitle('🎊 희귀 아이템 획득!')
                .setDescription(
                    `**${interaction.member.displayName}**님이 뽑기에서 희귀 아이템을 획득했습니다!\n\n` +
                    `${item.emoji} **${item.name}**\n` +
                    `등급: **${item.rarity.toUpperCase()}**`
                )
                .setFooter({ text: '이 메시지는 10초 후 삭제됩니다.' });
            
            const announceMsg = await interaction.channel.send({ embeds: [announceEmbed] });
            
            // 10초 후 삭제
            setTimeout(async () => {
                try {
                    await announceMsg.delete();
                } catch (error) {
                    console.log('공지 메시지 삭제 실패:', error.message);
                }
            }, 10000);
        }
        
        // 처리 완료 표시
        console.log(`[handleSingleGacha] 처리 완료 - 키 제거: ${gachaKey}`);
        gachaInProgress.delete(gachaKey);
    } catch (error) {
        console.error('[handleSingleGacha] 에러 발생:', error);
        console.error('에러 스택:', error.stack);
        
        // 에러 발생 시에도 처리 완료 표시
        console.log(`[handleSingleGacha] 에러로 인한 처리 완료 - 키 제거: ${gachaKey}`);
        gachaInProgress.delete(gachaKey);
        
        try {
            // 에러 발생 시 버튼을 다시 활성화
            const user = await getUser(interaction.user.id);
            if (user) {
                await showGachaOptions(interaction, user, selectedSlot);
            } else {
                await interaction.editReply({
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    embeds: [],
                    components: []
                });
            }
        } catch (replyError) {
            console.error('[handleSingleGacha] 응답 전송 실패:', replyError);
        }
    }
}

// 10회 뽑기 처리
async function handleMultiGacha(interaction, getUser, saveUser) {
    // retry_multi인 경우와 일반 multi gacha 구분
    const isRetry = interaction.customId.startsWith('retry_multi_');
    
    // customId 파싱 - gacha_multi_weapon_123456789 또는 retry_multi_weapon_123456789 형식
    const parts = interaction.customId.split('_');
    const selectedSlot = parts[2];
    const targetUserId = parts[3];
    
    // 사용자 확인
    if (targetUserId && targetUserId !== interaction.user.id) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 다른 사람의 뽑기입니다!',
                    flags: 64
                });
            }
        } catch (e) {
            console.error('[handleMultiGacha] 타인 접근 응답 실패:', e);
        }
        return;
    }
    
    // 중복 클릭 방지 - 유저별 + 슬롯별로 유일한 키 사용
    const gachaKey = `${targetUserId || interaction.user.id}_multi_${selectedSlot}`;
    
    // 동일한 뽑기가 진행 중인지 확인
    console.log(`[handleMultiGacha] 처리 시작 - 사용자: ${interaction.user.id}, 키: ${gachaKey}`);
    console.log(`[handleMultiGacha] 현재 진행중인 뽑기:`, Array.from(gachaInProgress));
    
    if (gachaInProgress.has(gachaKey)) {
        console.log('[handleMultiGacha] 이미 처리 중인 뽑기입니다.');
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '⏳ 뽑기가 이미 진행 중입니다. 잠시 기다려주세요.',
                    flags: 64
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: '⏳ 뽑기가 이미 진행 중입니다. 잠시 기다려주세요.'
                });
            } else {
                await interaction.followUp({
                    content: '⏳ 뽑기가 이미 진행 중입니다. 잠시 기다려주세요.',
                    flags: 64
                });
            }
        } catch (e) {
            console.error('[handleMultiGacha] 중복 알림 실패:', e);
        }
        return;
    }
    
    // 처리 시작 표시
    gachaInProgress.add(gachaKey);
    
    // 45초 후 자동 해제 (안전장치) - 10회 뽑기는 시간이 더 걸림
    const cleanupTimeout = setTimeout(() => {
        if (gachaInProgress.has(gachaKey)) {
            console.log(`[handleMultiGacha] 45초 경과 - 자동 해제: ${gachaKey}`);
            gachaInProgress.delete(gachaKey);
        }
    }, 45000);
    
    try {
        // 안전한 defer 처리 및 버튼 즉시 비활성화
        let deferSuccess = false;
        try {
            if (!interaction.deferred && !interaction.replied) {
                if (isRetry) {
                    // retry는 update 사용
                    await interaction.deferUpdate();
                    
                    // 버튼을 즉시 비활성화
                    const message = interaction.message;
                    if (message && message.components) {
                        const updatedComponents = message.components.map(row => {
                            const newRow = new ActionRowBuilder();
                            row.components.forEach(component => {
                                if (component.type === 2) { // Button type
                                    const newButton = ButtonBuilder.from(component);
                                    newButton.setDisabled(true);
                                    newRow.addComponents(newButton);
                                }
                            });
                            return newRow;
                        });
                        
                        await interaction.editReply({
                            embeds: message.embeds,
                            components: updatedComponents
                        });
                    }
                } else {
                    // 일반 multi gacha는 reply 사용 (공개)
                    await interaction.deferReply();
                }
                deferSuccess = true;
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('[handleMultiGacha] 인터랙션이 만료되었습니다.');
                // 만료된 경우 새로운 메시지로 처리
                gachaInProgress.delete(gachaKey);
                const channel = interaction.channel || interaction.message?.channel;
                if (channel) {
                    const newMessage = await channel.send({
                        content: '⏰ 시간이 초과되어 새로운 뽑기를 시작합니다...',
                        embeds: [],
                        components: []
                    });
                    
                    // 새로운 interaction 객체 생성
                    interaction.followUp = async (options) => {
                        return await newMessage.edit(options);
                    };
                    interaction.editReply = async (options) => {
                        return await newMessage.edit(options);
                    };
                    interaction.expired = true;
                    deferSuccess = true;
                } else {
                    return;
                }
            } else if (error.code === 40060) {
                console.log('[handleMultiGacha] 인터랙션이 이미 처리되었습니다. 계속 진행합니다.');
                // 이미 처리된 경우에도 계속 진행
                deferSuccess = true;
            } else {
                console.error('[handleMultiGacha] defer 오류:', error);
                return;
            }
        }
    // 트랜잭션 방식으로 처리
    const result = await ShopTransactionManager.executeMultiGacha(
        interaction.user.id,
        selectedSlot,
        generateItemWithPity
    );
    
    if (!result.success) {
        throw new Error(result.error || '10회 뽑기에 실패했습니다.');
    }
    
    const { user, items, levelUps } = result;
    
    // 애니메이션
    const rollingEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎰 10회 뽑기 중...')
        .setDescription('잠시만 기다려주세요...')
        .setImage(GAME_GIFS.shop.gacha);
    
    // 안전한 응답 처리
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                embeds: [rollingEmbed],
                components: []
            });
        } else {
            await interaction.reply({
                embeds: [rollingEmbed],
                components: []
            });
        }
    } catch (replyError) {
        console.error('[handleMultiGacha] 응답 전송 실패:', replyError);
        // 실패해도 계속 진행
    }
    
    // 이미 트랜잭션에서 처리됨
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 희귀도별 정렬
    const rarityOrder = ['legendary', 'unique', 'epic', 'rare', 'normal', 'trash'];
    items.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));
    
    // 페이지네이션
    let currentPage = 0;
    const itemsPerPage = 5;
    await showMultiGachaResultPage(interaction, items, currentPage, itemsPerPage, user, selectedSlot, levelUps, isRetry);
    
    // 페이지 네비게이션 수집기
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === user.discordId,
        time: 300000 // 5분으로 증가
    });
    
    collector.on('collect', async i => {
        // 사용자 확인
        if (i.user.id !== user.discordId) {
            await i.reply({
                content: '❌ 다른 사람의 뽑기 결과입니다!',
                flags: 64
            });
            return;
        }
        
        if (i.customId === 'multi_prev') {
            try {
                // 안전한 defer 처리
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate().catch(err => {
                        console.log('[multi_prev] deferUpdate 실패:', err.message);
                    });
                }
                currentPage--;
                await showMultiGachaResultPage(i, items, currentPage, itemsPerPage, user, selectedSlot, levelUps, isRetry);
            } catch (error) {
                console.error('multi_prev 처리 중 오류:', error);
                // 에러 처리는 로그만 남기고 사용자에게는 표시하지 않음
            }
        } else if (i.customId === 'multi_next') {
            try {
                // 안전한 defer 처리
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate().catch(err => {
                        console.log('[multi_next] deferUpdate 실패:', err.message);
                    });
                }
                currentPage++;
                await showMultiGachaResultPage(i, items, currentPage, itemsPerPage, user, selectedSlot, levelUps, isRetry);
            } catch (error) {
                console.error('multi_next 처리 중 오류:', error);
                // 에러 처리는 로그만 남기고 사용자에게는 표시하지 않음
            }
        } else if (i.customId.startsWith('retry_multi')) {
            try {
                // 컬렉터를 먼저 정지하여 중복 이벤트 방지 (retry_initiated 이유로 종료)
                collector.stop('retry_initiated');
                
                // defer 즉시 처리
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (deferError) {
                        // 이미 만료된 상호작용인 경우 새로운 메시지로 처리
                        if (deferError.code === 10062) {
                            console.log('[Shop] Interaction expired, creating new message');
                            const User = require('../models/User');
                            const updatedUser = await User.findOne({ discordId: i.user.id });
                            await handleMultiGacha(i, async (id) => await User.findOne({ discordId: id }), async (u) => await u.save());
                            return;
                        }
                        throw deferError;
                    }
                }
                
                const User = require('../models/User');
                await handleMultiGacha(i, async (id) => await User.findOne({ discordId: id }), async (u) => await u.save());
            } catch (error) {
                console.error('retry_multi 처리 중 오류:', error);
                if (error.code === 10062) {
                    // 상호작용이 만료된 경우 사용자에게 알림
                    const channel = i.channel || i.message?.channel;
                    if (channel) {
                        await channel.send({
                            content: '⏰ 시간이 초과되어 새로운 뽑기를 시작합니다.',
                            flags: 64
                        }).catch(() => {});
                    }
                }
            }
            return;
        } else if (i.customId === 'shop_refresh') {
            try {
                collector.stop();
                const User = require('../models/User');
                const updatedUser = await User.findOne({ discordId: user.discordId });
                const embed = createShopEmbed(updatedUser);
                const selectMenu = createSlotSelectMenu(updatedUser);
                await i.update({
                    embeds: [embed],
                    components: [selectMenu]
                });
            } catch (error) {
                console.error('shop_refresh 처리 중 오류:', error);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: '❌ 오류가 발생했습니다.', flags: 64 });
                }
            }
        }
    });
    
    // 희귀 아이템 공지 - 15초 후 삭제
    const rareItems = items.filter(item => ['epic', 'unique', 'legendary'].includes(item.rarity));
    if (rareItems.length > 0) {
        const announceEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎊 10회 뽑기 대박!')
            .setDescription(`**${interaction.member.displayName}**님이 10회 뽑기에서 희귀 아이템 ${rareItems.length}개를 획득했습니다!`)
            .setFooter({ text: '이 메시지는 15초 후 삭제됩니다.' });
        
        // 최대 6개까지만 표시 (너무 길어지지 않도록)
        const displayItems = rareItems.slice(0, 6);
        displayItems.forEach(item => {
            announceEmbed.addFields({
                name: `${getRarityEmoji(item.rarity)} ${item.rarity.toUpperCase()}`,
                value: item.name,
                inline: true
            });
        });
        
        if (rareItems.length > 6) {
            announceEmbed.addFields({
                name: '그 외',
                value: `+${rareItems.length - 6}개`,
                inline: true
            });
        }
        
        const announceMsg = await interaction.channel.send({ embeds: [announceEmbed] });
        
        // 15초 후 삭제
        setTimeout(async () => {
            try {
                await announceMsg.delete();
            } catch (error) {
                console.log('공지 메시지 삭제 실패:', error.message);
            }
        }, 15000);
    }
    
    // 컬렉터 종료 시 버튼 비활성화
    collector.on('end', async (collected, reason) => {
        // retry_initiated로 종료된 경우는 키를 제거하지 않음
        if (reason === 'retry_initiated') {
            console.log('[collector.end] retry로 인한 종료 - 키 유지, 버튼 비활성화 건너뜀');
            // retry 시에는 gachaInProgress 키를 유지하지 않고 즉시 제거
            // 새로운 뽑기가 시작될 때 새로운 키로 등록되도록 함
            gachaInProgress.delete(gachaKey);
            return;
        }
        
        // 다른 이유로 종료된 경우 처리 완료 표시
        console.log(`[handleMultiGacha] 컬렉터 종료 - 사유: ${reason}, 키 제거: ${gachaKey}`);
        gachaInProgress.delete(gachaKey);
        
        try {
            const disabledButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('multi_prev')
                        .setLabel('◀️ 이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('multi_next')
                        .setLabel('다음 ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`retry_multi_${selectedSlot}_${user.discordId}`)
                        .setLabel('다시 10회 뽑기')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎰')
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('shop_refresh')
                        .setLabel('상점으로')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🏪')
                        .setDisabled(true)
                );
            
            // 마지막 메시지 수정 시도
            const lastMessage = interaction.channel.messages.cache.find(
                msg => msg.interaction?.id === interaction.id
            );
            
            if (lastMessage && lastMessage.editable) {
                await lastMessage.edit({ components: [disabledButtons] });
            }
        } catch (error) {
            console.error('컬렉터 종료 시 버튼 비활성화 실패:', error);
        }
    });
    
    } catch (error) {
        console.error('[handleMultiGacha] 처리 중 오류:', error);
        // 에러 발생 시에도 처리 완료 표시
        gachaInProgress.delete(gachaKey);
        if (typeof cleanupTimeout !== 'undefined') {
            clearTimeout(cleanupTimeout);
        }
        
        try {
            // 에러 발생 시 버튼을 다시 활성화
            const user = await getUser(interaction.user.id);
            if (user && interaction.deferred || interaction.replied) {
                await showGachaOptions(interaction, user, selectedSlot);
            } else if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '❌ 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    embeds: [],
                    components: []
                });
            }
        } catch (replyError) {
            console.error('[handleMultiGacha] 응답 전송 실패:', replyError);
        }
    } finally {
        // 타임아웃 정리
        if (typeof cleanupTimeout !== 'undefined') {
            clearTimeout(cleanupTimeout);
        }
    }
}

// 10회 뽑기 결과 페이지
async function showMultiGachaResultPage(interaction, items, currentPage, itemsPerPage, user, selectedSlot, levelUps, isRetry = false) {
    const totalPages = 10; // 각 아이템마다 한 페이지
    const item = items[currentPage];
    const slotData = user.shopLevels[selectedSlot];
    
    // 아이템 이름 분석
    const nameParts = item.name.split(' ');
    // nameRarities가 있으면 그것을 사용, 없으면 기본 파싱
    let prefix, adjective, itemName;
    
    if (item.nameRarities) {
        // nameRarities에서 정확한 이름 구성 가져오기
        prefix = nameParts[0] || '';
        adjective = nameParts[1] || '';
        itemName = nameParts.slice(2).join(' ') || '';
    } else {
        // 기본 파싱
        prefix = nameParts[0] || '';
        adjective = nameParts[1] || '';
        itemName = nameParts.slice(2).join(' ') || '';
    }
    
    // 아이템 이름이 비어있는 경우 디버그
    if (!itemName && nameParts.length >= 2) {
        console.log('[showMultiGachaResultPage] 아이템 이름 파싱 문제:', {
            fullName: item.name,
            nameParts: nameParts,
            prefix: prefix,
            adjective: adjective,
            itemName: itemName
        });
    }
    
    // 이미지와 동일한 형식의 결과 표시
    const resultEmbed = new EmbedBuilder()
        .setColor(item.color)
        .setTitle(`⭐ ${item.rarity.toUpperCase()} 아이템 획득! (${currentPage + 1}/10)`)
        .setDescription(`### ${SLOT_EMOJIS[selectedSlot]} ${item.name}\n\n평범하지만 쓸만한 아이템입니다.\n\n✅ **인벤토리에 자동 저장되었습니다!**`);
    
    // 레어도에 따른 GIF 추가
    if (item.rarity === 'legendary' || item.rarity === 'unique' || item.rarity === 'epic') {
        resultEmbed.setImage(GAME_GIFS.shop.jackpot);
    }
    
    // 아이템 구성
    resultEmbed.addFields({
        name: '아이템 구성',
        value: `${getRarityEmoji(item.nameRarities?.prefix || item.rarity)} ${prefix} *(${item.nameRarities?.prefix || item.rarity})*\n` +
               `${getRarityEmoji(item.nameRarities?.adjective || item.rarity)} ${adjective} *(${item.nameRarities?.adjective || item.rarity})*\n` +
               `${getRarityEmoji(item.nameRarities?.itemName || item.rarity)} ${itemName} *(${item.nameRarities?.itemName || item.rarity})*`,
        inline: false
    });
    
    // 아이템 평가
    const scoreBar = createProgressBar(item.score || 0, 100);
    resultEmbed.addFields({
        name: '⭐ 아이템 평가',
        value: `${scoreBar} **${item.score || 0}점**\n${getScoreReaction(item.score || 0)}`,
        inline: false
    });
    
    // 에픽 이상 아이템 특별 설명
    const epicDescription = getEpicItemDescription(item.rarity, item.score || 0);
    if (epicDescription) {
        resultEmbed.addFields({
            name: '📜 특별한 설명',
            value: `*"${epicDescription}"*`,
            inline: false
        });
    }
    
    // 기본 정보와 주요 능력치 TOP 3
    const sortedStats = Object.entries(item.stats || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    let topStatsText = '';
    sortedStats.forEach(([key, value]) => {
        const statNames = {
            attack: '공격력',
            defense: '방어력',
            strength: '힘',
            agility: '민첩',
            intelligence: '지능',
            vitality: '체력',
            luck: '행운',
            hp: 'HP',
            dodge: '회피'
        };
        topStatsText += `${statNames[key] || key}: +${value}\n`;
    });
    
    resultEmbed.addFields(
        {
            name: '📊 기본 정보',
            value: `종류: ${SLOT_NAMES[item.type]}\n가격: ${item.price ? item.price.toLocaleString() : '알 수 없음'} 💰\n판매가: ${item.sellPrice ? item.sellPrice.toLocaleString() : Math.floor((item.price || 10000) * 0.6).toLocaleString()} 💰`,
            inline: true
        },
        {
            name: '⚡ 주요 능력치 TOP 3',
            value: topStatsText || '없음',
            inline: true
        }
    );
    
    // 전체 능력치
    const allStats = Object.entries(item.stats || {})
        .map(([key, value]) => {
            const statNames = {
                attack: '공격력',
                defense: '방어력',
                strength: '힘',
                agility: '민첩',
                intelligence: '지능',
                vitality: '체력',
                luck: '행운',
                hp: 'HP',
                dodge: '회피'
            };
            return `${statNames[key] || key}: +${value}`;
        })
        .join('\n');
    
    if (allStats) {
        resultEmbed.addFields({
            name: '📋 전체 능력치',
            value: allStats,
            inline: false
        });
    }
    
    // 상점 정보
    const shopExpBar = createProgressBar(slotData.exp, getRequiredExp(slotData.level));
    resultEmbed.addFields({
        name: '🏪 상점 정보',
        value: `${SLOT_NAMES[selectedSlot]} 상점 Lv.${slotData.level}\n` +
               `${shopExpBar} ${Math.floor((slotData.exp / getRequiredExp(slotData.level)) * 100)}%\n` +
               `총 뽑기: ${slotData.totalPulls}회`,
        inline: false
    });
    
    // 현재 확률
    const currentRates = getRatesForLevel(slotData.level);
    resultEmbed.addFields({
        name: '🎲 현재 확률',
        value: `🟠 전설: ${(currentRates.legendary * 100).toFixed(1)}%\n` +
               `🟣 유니크: ${(currentRates.unique * 100).toFixed(1)}%\n` +
               `🔴 에픽: ${(currentRates.epic * 100).toFixed(1)}%\n` +
               `🔵 레어: ${(currentRates.rare * 100).toFixed(1)}%`,
        inline: true
    });
    
    // 잔액 정보
    resultEmbed.addFields({
        name: '💰 잔액 정보',
        value: `사용 골드: 10,000 💰\n남은 골드: ${user.gold.toLocaleString()} 💰\n추가 뽑기: 864회 가능`,
        inline: true
    });
    
    // 푸터
    resultEmbed.setFooter({
        text: `_10004 | ${SLOT_NAMES[selectedSlot]} 뽑기`,
        iconURL: interaction.user.displayAvatarURL()
    })
    .setTimestamp();
    
    const navigationButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('multi_prev')
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('multi_next')
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`retry_multi_${selectedSlot}_${user.discordId}`)
                .setLabel('🎰 다시 10회 뽑기')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.gold < 90000),
            new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('상점으로')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // retry인 경우와 일반 gacha 구분하여 응답
    try {
        if (isRetry || interaction.expired) {
            // retry는 이미 메시지가 있으므로 edit
            await interaction.editReply({
                embeds: [resultEmbed],
                components: [navigationButtons]
            });
        } else {
            // 일반 gacha는 새 메시지
            await interaction.editReply({
                embeds: [resultEmbed],
                components: [navigationButtons]
            });
        }
    } catch (error) {
        if (error.code === 10062) {
            // 만료된 경우 새 메시지 전송
            console.log('[showMultiGachaResultPage] 인터랙션 만료, 새 메시지 전송');
            const channel = interaction.channel || interaction.message?.channel;
            if (channel) {
                await channel.send({
                    embeds: [resultEmbed],
                    components: [navigationButtons]
                });
            }
        } else {
            console.error('[showMultiGachaResultPage] 응답 오류:', error);
        }
    }
}

// 희귀도 이모지
function getRarityEmoji(rarity) {
    const emojis = {
        legendary: '🟠',
        unique: '🟣',
        epic: '🔴',
        rare: '🔵',
        normal: '⚪',
        trash: '🟫'
    };
    return emojis[rarity] || '⚪';
}

// 판매 카트 저장소 (userId -> [{item, count}])
const sellCarts = new Map();

// 판매 처리 중 플래그 (중복 판매 방지)
const sellingInProgress = new Set();

// 장비 판매 메뉴 표시
async function showSellMenu(interaction, user, getUser, saveUser) {
    try {
        // 최신 사용자 정보 가져오기
        const User = require('../models/User');
        const freshUser = await User.findOne({ discordId: user.discordId });
        
        if (!freshUser || !freshUser.inventory) {
            console.error('판매 메뉴 오류: user 또는 inventory가 없습니다', user);
            await interaction.editReply({
                content: '❌ 사용자 정보를 불러올 수 없습니다.',
                embeds: [],
                components: []
            });
            return;
        }
        
        // 최신 정보로 업데이트
        user = freshUser;
        
        // equipment가 없으면 초기화
        if (!user.equipment) {
            user.equipment = {};
        }
        
        // 판매 카트 초기화
        if (!sellCarts.has(user.discordId)) {
            sellCarts.set(user.discordId, []);
        }
        
        console.log('장비 슬롯 상태:', user.equipment);
        console.log('인벤토리 아이템 개수:', user.inventory.length);
        
        // 판매 가능한 아이템 필터링 (장착하지 않은 것만, 사냥 전리품 제외)
        let sellableItems = [];
        try {
            sellableItems = user.inventory.filter((item, index) => {
            if (!item || !item.id) {
                console.log(`아이템 ${index}: 아이템 또는 ID 없음`);
                return false;
            }
            
            
            // 사냥 전리품 제외 (감정사에게만 판매 가능)
            if (item.type === 'material' || item.fromMonster || item.fromArea) {
                console.log(`아이템 ${index} (${item.name}): 사냥 전리품 제외`);
                return false;
            }
            
            // 장착 중인지 확인 (equipment 값이 inventorySlot을 가리킴)
            const isEquipped = Object.values(user.equipment).some(slotIndex => 
                slotIndex !== null && slotIndex !== undefined && slotIndex !== -1 &&
                item.inventorySlot !== undefined && item.inventorySlot === slotIndex
            );
            
            if (isEquipped) {
                console.log(`아이템 ${index} (${item.name}): 장착 중 제외`);
            } else {
                console.log(`아이템 ${index} (${item.name}): 판매 가능`);
            }
            
            return !isEquipped;
        });
        } catch (filterError) {
            console.error('아이템 필터링 중 오류:', filterError);
            console.error('오류 스택:', filterError.stack);
            throw filterError;
        }
        
        console.log('판매 가능한 아이템 개수:', sellableItems.length);

    if (sellableItems.length === 0) {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('💰 장비 판매')
            .setDescription('판매할 수 있는 장비가 없습니다.\n(장착 중인 장비는 판매할 수 없습니다)')
            .setFooter({ text: '상점으로 돌아가려면 아래 버튼을 클릭하세요' });
        
        const backButton = new ButtonBuilder()
            .setCustomId('shop_refresh')
            .setLabel('상점으로 돌아가기')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏪');
        
        await interaction.editReply({
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(backButton)]
        });
        return;
    }
    
    // 판매 모드 선택 화면 표시
    const modeEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💰 판매 모드 선택')
        .setDescription(`판매 가능한 아이템: **${sellableItems.length}개**\n\n어떤 방식으로 판매하시겠습니까?`)
        .addFields(
            {
                name: '🚀 빠른 판매',
                value: '아이템을 선택하면 즉시 판매\n카트 없이 빠르게 처리',
                inline: true
            },
            {
                name: '📦 카트 판매',
                value: '여러 아이템을 카트에 담아 일괄 판매\n신중하게 선택 가능',
                inline: true
            }
        )
        .setFooter({ text: `보유 골드: ${user.gold.toLocaleString()}G` });
    
    const modeButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sell_mode_quick')
            .setLabel('🚀 빠른 판매')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('sell_mode_cart')
            .setLabel('📦 카트 판매')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sell_grade_menu')
            .setLabel('🎯 등급별 판매')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('shop_refresh')
            .setLabel('🏪 돌아가기')
            .setStyle(ButtonStyle.Danger)
    );
    
    await interaction.editReply({
        embeds: [modeEmbed],
        components: [modeButtons]
    });
    
    return; // 모드 선택 후 실제 판매 화면은 별도 함수에서 처리

    // 아이템을 등급별로 정렬
    const rarityOrder = ['legendary', 'unique', 'epic', 'rare', 'normal', 'trash'];
    sellableItems.sort((a, b) => {
        const rarityDiff = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
        if (rarityDiff !== 0) return rarityDiff;
        return (b.sellPrice || 0) - (a.sellPrice || 0);
    });

    // 페이지네이션 설정 - 페이지당 10개로 증가
    const itemsPerPage = 10;
    let totalPages = Math.ceil(sellableItems.length / itemsPerPage);
    let currentPage = 0;

    const showSellPage = async (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = sellableItems.slice(start, end);
        const userCart = sellCarts.get(user.discordId) || [];

        // 현재 카트의 총 가격 계산
        const cartTotal = userCart.reduce((sum, cartItem) => {
            const sellPrice = cartItem.item.sellPrice || Math.floor((cartItem.item.price || 0) * 0.3);
            return sum + (sellPrice * cartItem.count);
        }, 0);

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`💰 장비 판매 (${page + 1}/${totalPages})`)
            .setDescription(`아이템을 선택하여 판매 카트에 추가하세요\n**🛒 현재 카트**: ${userCart.length}종류, 총 ${cartTotal.toLocaleString()}G`)
            .setFooter({ text: `총 ${sellableItems.length}개의 장비 보유 | 보유 골드: ${user.gold.toLocaleString()}G` });

        // 아이템 목록 표시 (버튼으로)
        const itemButtons = [];
        pageItems.forEach((item, index) => {
            const globalIndex = start + index;
            const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
            
            // 카트에 있는지 확인
            const cartItem = userCart.find(ci => ci.item.id === item.id);
            const inCartCount = cartItem ? cartItem.count : 0;
            
            embed.addFields({
                name: `${globalIndex + 1}. ${getRarityEmoji(item.rarity)} ${item.name} ${inCartCount > 0 ? `(카트: ${inCartCount}개)` : ''}`,
                value: `등급: ${item.rarity} | 판매가: ${sellPrice.toLocaleString()}G`,
                inline: false
            });
            
            // 각 아이템에 대한 버튼 생성
            itemButtons.push(
                new ButtonBuilder()
                    .setCustomId(`add_to_cart_${item.id}`)
                    .setLabel(`${globalIndex + 1}번 추가`)
                    .setStyle(inCartCount > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji('➕')
            );
        });

        // 아이템 버튼 행 생성 (최대 5개씩)
        const itemButtonRows = [];
        for (let i = 0; i < itemButtons.length; i += 5) {
            itemButtonRows.push(new ActionRowBuilder().addComponents(itemButtons.slice(i, i + 5)));
        }
        
        // 네비게이션 버튼
        const navigationButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('sell_prev')
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId('sell_next')
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
                .setCustomId('view_sell_cart')
                .setLabel(`🛒 카트 보기 (${userCart.length})`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(userCart.length === 0),
            new ButtonBuilder()
                .setCustomId('clear_sell_cart')
                .setLabel('🗑️ 카트 비우기')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(userCart.length === 0)
        );
        
        // 액션 버튼
        const actionButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('execute_sell_cart')
                .setLabel(`💰 카트 판매 (${cartTotal.toLocaleString()}G)`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(userCart.length === 0),
            new ButtonBuilder()
                .setCustomId('sell_all_trash')
                .setLabel('🟫 낮은등급일괄판매')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('sell_all_unique')
                .setLabel('💎 유니크이하일괄판매')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('shop_refresh')
                .setLabel('🏪 상점으로')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({
            embeds: [embed],
            components: [...itemButtonRows, navigationButtons, actionButtons]
        });
    };

    await showSellPage(currentPage);

    // 컬렉터 설정
    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === user.discordId,
        time: 300000
    });

    collector.on('collect', async i => {
        if (i.user.id !== user.discordId) {
            await i.reply({
                content: '❌ 다른 사람의 판매 메뉴입니다!',
                flags: 64  // Ephemeral flag
            });
            return;
        }

        // 아이템을 카트에 추가
        if (i.customId.startsWith('add_to_cart_')) {
            try {
                // 먼저 아이템이 존재하는지 확인
                const itemId = i.customId.replace('add_to_cart_', '');
                const item = sellableItems.find(it => it.id === itemId);
                
                if (!item) {
                    // 아이템이 없으면 바로 응답
                    if (!i.deferred && !i.replied) {
                        try {
                            await i.reply({
                                content: '❌ 아이템을 찾을 수 없습니다. 페이지를 새로고침해주세요.',
                                flags: 64
                            });
                        } catch (err) {
                            console.log('카트 추가 오류 응답 실패:', err.code);
                        }
                    }
                    return;
                }
                
                // 아이템이 있을 때만 defer
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (deferError) {
                        if (deferError.code === 10062) {
                            console.log('카트 추가: 인터랙션이 만료되었습니다.');
                            return;
                        } else if (deferError.code === 40060) {
                            console.log('카트 추가: 인터랙션이 이미 처리되었습니다.');
                            // 이미 처리된 경우에도 계속 진행
                        } else {
                            throw deferError;
                        }
                    }
                }
                
                const userCart = sellCarts.get(user.discordId) || [];
                const existingCartItem = userCart.find(ci => ci.item.id === itemId);
                
                if (existingCartItem) {
                    // 중복 추가 방지 - 한 번 클릭당 1개만 추가
                    const currentCount = existingCartItem.count;
                    if (currentCount < 99) { // 최대 수량 제한
                        existingCartItem.count++;
                    } else {
                        if (i.deferred || i.replied) {
                            await i.followUp({
                                content: '❌ 해당 아이템은 최대 99개까지만 카트에 담을 수 있습니다.',
                                flags: 64
                            });
                        }
                        return;
                    }
                } else {
                    userCart.push({ item: item, count: 1 });
                }
                
                sellCarts.set(user.discordId, userCart);
                
                // 페이지 업데이트
                if (i.deferred || i.replied) {
                    await showSellPage(currentPage);
                }
            } catch (error) {
                // Unknown interaction 오류는 무시
                if (error.code === 10062) {
                    console.log('카트 추가: 인터랙션이 만료되었습니다.');
                    return;
                }
                console.error('카트 추가 오류:', error.code || error.message);
            }
        }
        
        // 카트 보기
        else if (i.customId === 'view_sell_cart') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                
                const userCart = sellCarts.get(user.discordId) || [];
                if (userCart.length === 0) {
                    await i.followUp({
                        content: '❌ 카트가 비어있습니다.',
                        flags: 64
                    });
                    return;
                }
                
                const cartEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('🛒 판매 카트')
                    .setDescription('카트에 담긴 아이템들입니다.');
                
                let totalPrice = 0;
                userCart.forEach((cartItem, index) => {
                    const sellPrice = cartItem.item.sellPrice || Math.floor((cartItem.item.price || 0) * 0.3);
                    const subtotal = sellPrice * cartItem.count;
                    totalPrice += subtotal;
                    
                    cartEmbed.addFields({
                        name: `${index + 1}. ${getRarityEmoji(cartItem.item.rarity)} ${cartItem.item.name}`,
                        value: `수량: ${cartItem.count}개 | 개당: ${sellPrice.toLocaleString()}G | 소계: ${subtotal.toLocaleString()}G`,
                        inline: false
                    });
                });
                
                cartEmbed.addFields({
                    name: '💰 총 판매가',
                    value: `**${totalPrice.toLocaleString()}G**`,
                    inline: false
                });
                
                await i.followUp({
                    embeds: [cartEmbed],
                    flags: 64
                });
            } catch (error) {
                console.error('카트 보기 오류:', error);
            }
        }
        
        // 카트 비우기
        else if (i.customId === 'clear_sell_cart') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                
                sellCarts.set(user.discordId, []);
                await showSellPage(currentPage);
                
                await i.followUp({
                    content: '✅ 카트를 비웠습니다.',
                    flags: 64
                });
            } catch (error) {
                console.error('카트 비우기 오류:', error);
            }
        }
        
        // 카트 판매 실행
        else if (i.customId === 'execute_sell_cart') {
            try {
                // 중복 판매 방지 체크
                if (sellingInProgress.has(user.discordId)) {
                    try {
                        await i.reply({
                            content: '⏳ 이미 판매가 진행 중입니다. 잠시만 기다려주세요.',
                            flags: 64
                        });
                    } catch (e) {
                        console.log('카트 판매 중복 체크 응답 실패');
                    }
                    return;
                }
                
                // 판매 처리 시작
                sellingInProgress.add(user.discordId);
                
                // 안전한 defer 처리
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (deferError) {
                        sellingInProgress.delete(user.discordId);
                        if (deferError.code === 10062) {
                            console.log('아이템 선택 판매: 인터랙션이 만료되었습니다.');
                            return;
                        }
                        throw deferError;
                    }
                }
                
                const userCart = sellCarts.get(user.discordId) || [];
                if (userCart.length === 0) {
                    sellingInProgress.delete(user.discordId);
                    await i.followUp({
                        content: '❌ 카트가 비어있습니다.',
                        flags: 64
                    });
                    return;
                }
                
                let totalSellPrice = 0;
                const soldItems = [];
                
                // 최신 유저 정보 가져오기
                const User = require('../models/User');
                const latestUser = await User.findOne({ discordId: user.discordId });
                if (!latestUser) {
                    throw new Error('사용자를 찾을 수 없습니다');
                }

                // 카트의 아이템들 판매
                const notFoundItems = [];
                const alreadySoldItems = [];
                
                for (const cartItem of userCart) {
                    const { item, count } = cartItem;
                    
                    // 인벤토리에서 해당 아이템 찾기 (장착되지 않은 것만)
                    const inventoryItems = [];
                    console.log(`[판매] ${item.name} (ID: ${item.id}) 찾는 중...`);
                    
                    latestUser.inventory.forEach((invItem, index) => {
                        if (invItem) {
                            // ID가 없는 경우 이름과 타입으로 비교
                            const matchById = invItem.id && invItem.id === item.id;
                            const matchByNameAndType = !invItem.id && invItem.name === item.name && invItem.type === item.type;
                            
                            if (matchById || matchByNameAndType) {
                                // 장착 중인지 확인 (equipment 값이 inventorySlot을 가리킴)
                                const isEquipped = Object.values(latestUser.equipment || {}).some(slotIndex => 
                                    slotIndex !== null && slotIndex !== undefined && slotIndex !== -1 &&
                                    invItem.inventorySlot !== undefined && invItem.inventorySlot === slotIndex
                                );
                                if (!isEquipped) {
                                    inventoryItems.push({...invItem, inventoryIndex: index});
                                    console.log(`[판매] 찾음: 인덱스 ${index}, 장착여부: ${isEquipped}`);
                                }
                            }
                        }
                    });
                    
                    if (inventoryItems.length === 0) {
                        // 아이템을 찾을 수 없음 (이미 판매됐거나 존재하지 않음)
                        alreadySoldItems.push({
                            name: item.name,
                            count: count
                        });
                        continue;
                    }
                    
                    // 실제로 판매할 수 있는 수량
                    const availableCount = Math.min(inventoryItems.length, count);
                    let removedCount = 0;
                    
                    // 인벤토리에서 아이템 제거
                    for (let j = 0; j < availableCount; j++) {
                        const itemToRemove = inventoryItems[j];
                        if (itemToRemove && itemToRemove.inventoryIndex !== undefined) {
                            // 인덱스 재계산 (이전 삭제로 인한 인덱스 변경 고려)
                            const currentIndex = latestUser.inventory.findIndex((invItem, idx) => {
                                if (!invItem) return false;
                                const matchById = invItem.id && invItem.id === item.id;
                                const matchByNameAndType = !invItem.id && invItem.name === item.name && invItem.type === item.type;
                                return matchById || matchByNameAndType;
                            });
                            
                            if (currentIndex !== -1) {
                                const sellPrice = latestUser.inventory[currentIndex].sellPrice || 
                                               Math.floor((latestUser.inventory[currentIndex].price || 0) * 0.3);
                                totalSellPrice += sellPrice;
                                latestUser.inventory.splice(currentIndex, 1);
                                removedCount++;
                                console.log(`[판매] 아이템 제거됨: ${item.name}, 판매가: ${sellPrice}`);
                            }
                        }
                    }
                    
                    if (removedCount > 0) {
                        soldItems.push({ 
                            name: item.name, 
                            price: item.sellPrice || Math.floor((item.price || 0) * 0.3), 
                            rarity: item.rarity,
                            count: removedCount
                        });
                    }
                    
                    // 요청한 수량보다 적게 판매된 경우
                    if (removedCount < count) {
                        notFoundItems.push({
                            name: item.name,
                            requested: count,
                            sold: removedCount
                        });
                    }
                }

                latestUser.gold += totalSellPrice;
                await latestUser.save();
                
                // user 객체도 업데이트
                user = latestUser;

                // 카트 비우기
                sellCarts.set(user.discordId, []);

                // 아무것도 판매되지 않은 경우
                if (soldItems.length === 0 && alreadySoldItems.length > 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('❌ 판매 실패')
                        .setDescription('카트의 아이템들이 이미 판매되었거나 존재하지 않습니다.')
                        .addFields({
                            name: '이미 판매된 아이템',
                            value: alreadySoldItems.map(item => 
                                `• ${item.name} (${item.count}개)`
                            ).join('\n'),
                            inline: false
                        });
                    
                    await i.editReply({
                        embeds: [errorEmbed],
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('sell_menu')
                                .setLabel('판매 메뉴로')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('💰'),
                            new ButtonBuilder()
                                .setCustomId('shop_refresh')
                                .setLabel('상점으로')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('🏪')
                        )]
                    });
                    sellingInProgress.delete(user.discordId);
                    return;
                }

                // 판매 결과 표시
                const resultEmbed = new EmbedBuilder()
                    .setColor(soldItems.length > 0 ? '#00FF00' : '#FF9900')
                    .setTitle(soldItems.length > 0 ? '💰 판매 완료!' : '⚠️ 일부 판매 완료')
                    .setDescription(`${soldItems.length}종류의 아이템을 판매했습니다`)
                    .setImage(GAME_GIFS.shop.sold);
                
                // 판매 내역
                if (soldItems.length > 0) {
                    resultEmbed.addFields({
                        name: '✅ 판매 내역',
                        value: soldItems.slice(0, 10).map(item => 
                            `${getRarityEmoji(item.rarity)} ${item.name} x${item.count} - ${(item.price * item.count).toLocaleString()}G`
                        ).join('\n') + (soldItems.length > 10 ? `\n... 외 ${soldItems.length - 10}개` : ''),
                        inline: false
                    });
                }
                
                // 이미 판매된 아이템
                if (alreadySoldItems.length > 0) {
                    resultEmbed.addFields({
                        name: '❌ 이미 판매된 아이템',
                        value: alreadySoldItems.slice(0, 5).map(item => 
                            `• ${item.name} (${item.count}개)`
                        ).join('\n') + (alreadySoldItems.length > 5 ? `\n... 외 ${alreadySoldItems.length - 5}개` : ''),
                        inline: false
                    });
                }
                
                // 부분 판매된 아이템
                if (notFoundItems.length > 0) {
                    resultEmbed.addFields({
                        name: '⚠️ 일부만 판매된 아이템',
                        value: notFoundItems.slice(0, 5).map(item => 
                            `• ${item.name} (요청: ${item.requested}개, 판매: ${item.sold}개)`
                        ).join('\n'),
                        inline: false
                    });
                }
                
                resultEmbed.addFields(
                    {
                        name: '💵 획득 골드',
                        value: `+${totalSellPrice.toLocaleString()}G`,
                        inline: true
                    },
                    {
                        name: '💰 보유 골드',
                        value: `${latestUser.gold.toLocaleString()}G`,
                        inline: true
                    }
                );

                if (i.deferred || i.replied) {
                    await i.editReply({
                        embeds: [resultEmbed],
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('sell_menu')
                                .setLabel('계속 판매하기')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('💰'),
                            new ButtonBuilder()
                                .setCustomId('shop_refresh')
                                .setLabel('상점으로')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji('🏪')
                        )]
                    });
                    
                    // 판매 성공 후 user 객체 업데이트
                    user = latestUser;
                    
                    // 판매 처리 완료
                    sellingInProgress.delete(user.discordId);
                }
            } catch (error) {
                // Unknown interaction 오류는 무시
                if (error.code === 10062) {
                    console.log('카트 판매: 인터랙션이 만료되었습니다.');
                } else {
                    console.error('카트 판매 오류:', error.message);
                }
                sellingInProgress.delete(user.discordId);
            }
        }

        // 페이지 네비게이션
        else if (i.customId === 'sell_prev') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                currentPage--;
                await showSellPage(currentPage);
            } catch (error) {
                if (error.code === 10062) {
                    console.log('페이지 이전: 인터랙션이 만료되었습니다.');
                } else {
                    console.error('sell_prev 오류:', error);
                }
            }
        }
        else if (i.customId === 'sell_next') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                currentPage++;
                await showSellPage(currentPage);
            } catch (error) {
                if (error.code === 10062) {
                    console.log('페이지 다음: 인터랙션이 만료되었습니다.');
                } else {
                    console.error('sell_next 오류:', error);
                }
            }
        }

        // 일괄 판매
        else if (i.customId === 'sell_all_normal' || i.customId === 'sell_all_trash' || i.customId === 'sell_all_unique') {
            try {
                // 안전한 defer 처리
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (deferError) {
                        if (deferError.code === 10062) {
                            console.log('일괄 판매: 인터랙션이 만료되었습니다.');
                            return;
                        }
                        throw deferError;
                    }
                }
                
                // 판매 대상 등급 설정
                let targetRarities = [];
                if (i.customId === 'sell_all_trash') {
                    targetRarities = ['trash', 'normal'];
                } else if (i.customId === 'sell_all_unique') {
                    targetRarities = ['trash', 'normal', 'rare', 'epic', 'unique'];
                }
                let totalSellPrice = 0;
                let soldCount = 0;

            // 최신 유저 정보 가져오기
            const User = require('../models/User');
            const latestUser = await User.findOne({ discordId: user.discordId });
            if (!latestUser) {
                throw new Error('사용자를 찾을 수 없습니다');
            }

            // 역순으로 삭제 (인덱스 문제 방지)
            for (let i = latestUser.inventory.length - 1; i >= 0; i--) {
                const item = latestUser.inventory[i];
                if (item && targetRarities.includes(item.rarity)) {
                    // 사냥 전리품 제외
                    if (item.type === 'material' || item.fromMonster || item.fromArea) {
                        continue;
                    }
                    
                    // 장착 중인지 확인 (equipment 값이 inventorySlot을 가리킴)
                    const isEquipped = Object.values(latestUser.equipment || {}).some(slotIndex => 
                        slotIndex !== null && slotIndex !== undefined && slotIndex !== -1 &&
                        item.inventorySlot !== undefined && item.inventorySlot === slotIndex
                    );
                    
                    if (!isEquipped) {
                        const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
                        totalSellPrice += sellPrice;
                        soldCount++;
                        latestUser.inventory.splice(i, 1);
                    }
                }
            }

            if (soldCount > 0) {
                latestUser.gold += totalSellPrice;
                await latestUser.save();
                user = latestUser;

                const resultEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('💰 일괄 판매 완료!')
                    .setDescription(`일반 등급 아이템 ${soldCount}개를 판매했습니다`)
                    .addFields(
                        {
                            name: '💵 획득 골드',
                            value: `+${totalSellPrice.toLocaleString()}G`,
                            inline: true
                        },
                        {
                            name: '💰 보유 골드',
                            value: `${user.gold.toLocaleString()}G`,
                            inline: true
                        }
                    );

                await i.editReply({
                    embeds: [resultEmbed],
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('continue_sell')
                            .setLabel('계속 판매하기')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('💰'),
                        new ButtonBuilder()
                            .setCustomId('shop_refresh')
                            .setLabel('상점으로')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('🏪')
                    )],
                    flags: 64  // Ephemeral
                });
            } else {
                await i.editReply({
                    content: `❌ 판매할 수 있는 일반 등급(trash, normal) 아이템이 없습니다.`,
                    embeds: [],
                    components: []
                });
            }
            } catch (error) {
                console.error('일괄 판매 처리 중 오류:', error);
                if (i.deferred && !i.replied) {
                    await i.editReply({ 
                        content: '❌ 오류가 발생했습니다.', 
                        embeds: [],
                        components: []
                    });
                }
            }
        }

        // 계속 판매하기 버튼
        else if (i.customId === 'sell_menu') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                
                // 카트 초기화
                sellCarts.set(user.discordId, []);
                
                // 판매 메뉴 다시 표시
                await showSellMenu(i, user, getUser, saveUser);
            } catch (error) {
                console.error('sell_menu 오류:', error);
                if (!i.replied) {
                    await i.followUp({
                        content: '❌ 판매 메뉴를 불러오는 중 오류가 발생했습니다.',
                        flags: 64
                    });
                }
            }
        }
        
        // 임시 아이템 판매
        else if (i.customId === 'sell_temp_items') {
            // 이미 응답한 인터랙션인지 확인
            if (!i.deferred && !i.replied) {
                await i.deferUpdate();
            }
            
            const userTempItems = tempItems.get(user.discordId) || [];
            if (userTempItems.length === 0) {
                await i.followUp({
                    content: '❌ 판매할 임시 아이템이 없습니다.',
                    flags: 64
                });
                return;
            }
            
            // 확인 메시지
            const confirmEmbed = new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle('⚠️ 임시 아이템 판매 확인')
                .setDescription(`**${userTempItems.length}개**의 임시 아이템을 모두 판매하시겠습니까?\n\n` +
                    `⚠️ **주의: 인벤토리에 저장하지 않은 아이템들입니다!**\n` +
                    `이 아이템들은 판매 후 복구할 수 없습니다.`)
                .addFields({
                    name: '💰 예상 판매 금액',
                    value: `약 ${userTempItems.reduce((sum, item) => sum + (item.sellPrice || Math.floor((item.price || 0) * 0.3)), 0).toLocaleString()}G`,
                    inline: false
                });
            
            const confirmButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_sell_temp')
                    .setLabel('판매 확인')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId('cancel_sell_temp')
                    .setLabel('취소')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );
            
            await i.editReply({
                embeds: [confirmEmbed],
                components: [confirmButtons]
            });
        }
        
        // 임시 아이템 판매 확인
        else if (i.customId === 'confirm_sell_temp') {
            await i.deferUpdate();
            
            const userTempItems = tempItems.get(user.discordId) || [];
            let totalSellPrice = 0;
            const soldItems = [];
            
            for (const item of userTempItems) {
                const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.3);
                totalSellPrice += sellPrice;
                soldItems.push({ name: item.name, price: sellPrice, rarity: item.rarity });
            }
            
            user.gold += totalSellPrice;
            await saveUser(user);
            tempItems.set(user.discordId, []); // 임시 저장소 비우기
            saveTempItems(); // 파일에 저장
        saveTempItems(); // 파일에 저장
            
            const resultEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('💰 임시 아이템 판매 완료!')
                .setDescription(`${soldItems.length}개의 임시 아이템을 판매했습니다`)
                .addFields(
                    {
                        name: '💵 획득 골드',
                        value: `+${totalSellPrice.toLocaleString()}G`,
                        inline: true
                    },
                    {
                        name: '💰 보유 골드',
                        value: `${user.gold.toLocaleString()}G`,
                        inline: true
                    }
                );
            
            await i.editReply({
                embeds: [resultEmbed],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('continue_sell')
                        .setLabel('계속 판매하기')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('💰'),
                    new ButtonBuilder()
                        .setCustomId('shop_refresh')
                        .setLabel('상점으로')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🏪')
                )],
                flags: 64
            });
        }
        
        // 임시 아이템 판매 취소
        else if (i.customId === 'cancel_sell_temp') {
            const deferred = await safeInteractionDefer(i);
            if (!deferred) return;
            
            const updatedUser = await getUser(user.discordId);
            await showSellMenu(i, updatedUser, getUser, saveUser);
        }
        
        // 임시 보관함 보기
        else if (i.customId === 'view_temp_items') {
            // 안전한 defer 처리
            const deferred = await safeInteractionDefer(i);
            if (!deferred) return;
            
            const userTempItems = tempItems.get(user.discordId) || [];
            if (userTempItems.length === 0) {
                await i.editReply({
                    content: '❌ 임시 보관함이 비어있습니다.',
                    embeds: [],
                    components: []
                });
                return;
            }
            
            // 페이지네이션을 위한 변수
            let currentPage = 0;
            const itemsPerPage = 5;
            const totalPages = Math.ceil(userTempItems.length / itemsPerPage);
            
            const showTempItemsPage = async (page) => {
                // 최신 임시 아이템 목록 가져오기
                const latestTempItems = tempItems.get(user.discordId) || [];
                const totalPagesUpdated = Math.ceil(latestTempItems.length / itemsPerPage);
                
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = latestTempItems.slice(start, end);
                
                const embed = new EmbedBuilder()
                    .setColor('#0099FF')
                    .setTitle(`📦 임시 보관함 (${latestTempItems.length}개)`)
                    .setDescription('뽑기로 얻은 아이템들이 임시 보관되어 있습니다.\n각 아이템을 개별적으로 저장하거나 판매할 수 있습니다.')
                    .setFooter({ text: `페이지 ${page + 1}/${totalPagesUpdated}` });
                
                pageItems.forEach((item, index) => {
                    const globalIndex = start + index;
                    embed.addFields({
                        name: `${globalIndex + 1}. ${item.emoji} ${item.name}`,
                        value: `등급: ${item.rarity.toUpperCase()}\n` +
                               `종류: ${SLOT_NAMES[item.type]}\n` +
                               `가격: ${item.price.toLocaleString()}G\n` +
                               `능력치: ${formatItemStats(item.stats)}`,
                        inline: true
                    });
                });
                
                // 아이템 선택 메뉴
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('temp_item_select')
                    .setPlaceholder('저장하거나 판매할 아이템 선택')
                    .addOptions(
                        pageItems.map((item, index) => ({
                            label: `${start + index + 1}. ${item.name}`,
                            description: `${item.rarity.toUpperCase()} - ${SLOT_NAMES[item.type]}`,
                            value: `${start + index}`,
                            emoji: item.emoji
                        }))
                    );
                
                const navigationButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('temp_prev_page')
                        .setLabel('이전')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('temp_next_page')
                        .setLabel('다음')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page >= totalPagesUpdated - 1),
                    new ButtonBuilder()
                        .setCustomId('back_to_sell_menu')
                        .setLabel('돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('◀️')
                );
                
                const actionButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('save_all_temp')
                        .setLabel('모두 저장')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💾'),
                    new ButtonBuilder()
                        .setCustomId('sell_all_temp')
                        .setLabel('모두 판매')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('💰')
                );
                
                await i.editReply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(selectMenu), navigationButtons, actionButtons]
                });
            };
            
            await showTempItemsPage(currentPage);
            
            // 임시 아이템 페이지 네비게이션 수집기
            const tempCollector = i.channel.createMessageComponentCollector({
                filter: btn => btn.user.id === user.discordId,
                time: 300000
            });
            
            tempCollector.on('collect', async btn => {
                if (btn.user.id !== user.discordId) {
                    await btn.reply({
                        content: '❌ 다른 사람의 임시 보관함입니다!',
                        flags: 64
                    });
                    return;
                }
                
                if (btn.customId === 'temp_prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                    await btn.deferUpdate();
                    await showTempItemsPage(currentPage);
                }
                else if (btn.customId === 'temp_next_page') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                    await btn.deferUpdate();
                    await showTempItemsPage(currentPage);
                }
                else if (btn.customId === 'temp_item_select') {
                    await btn.deferUpdate();
                    const selectedIndex = parseInt(btn.values[0]);
                    
                    // 최신 임시 아이템 목록 가져오기
                    const currentUserTempItems = tempItems.get(user.discordId) || [];
                    const selectedItem = currentUserTempItems[selectedIndex];
                    
                    if (!selectedItem) {
                        await btn.followUp({
                            content: '❌ 선택한 아이템을 찾을 수 없습니다.',
                            flags: 64
                        });
                        return;
                    }
                    
                    // 개별 아이템 처리 메뉴
                    const itemEmbed = new EmbedBuilder()
                        .setColor(selectedItem.color)
                        .setTitle(`${selectedItem.emoji} ${selectedItem.name}`)
                        .setDescription(`이 아이템을 어떻게 하시겠습니까?`)
                        .addFields(
                            {
                                name: '📊 능력치',
                                value: formatItemStats(selectedItem.stats),
                                inline: true
                            },
                            {
                                name: '💰 가격',
                                value: `구매가: ${selectedItem.price.toLocaleString()}G\n판매가: ${selectedItem.sellPrice.toLocaleString()}G`,
                                inline: true
                            }
                        );
                    
                    // 아이템에 고유 ID가 없으면 생성
                    if (!selectedItem.id) {
                        selectedItem.id = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                        // ID 추가 후 저장
                        currentUserTempItems[selectedIndex] = selectedItem;
                        tempItems.set(user.discordId, currentUserTempItems);
                        saveTempItems();
                    }
                    
                    console.log(`[임시 아이템 선택] 인덱스: ${selectedIndex}, ID: ${selectedItem.id}, 이름: ${selectedItem.name}`);
                    
                    const itemButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`save_temp_item_${selectedItem.id}`)
                            .setLabel('인벤토리에 저장')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💾'),
                        new ButtonBuilder()
                            .setCustomId(`sell_temp_item_${selectedItem.id}`)
                            .setLabel('판매하기')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('💰'),
                        new ButtonBuilder()
                            .setCustomId('back_to_temp_list')
                            .setLabel('목록으로')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('📋')
                    );
                    
                    await btn.editReply({
                        embeds: [itemEmbed],
                        components: [itemButtons]
                    });
                }
                else if (btn.customId.startsWith('save_temp_item_')) {
                    try {
                        await btn.deferUpdate();
                        const itemIdOrIndex = btn.customId.substring('save_temp_item_'.length);
                        
                        console.log(`[임시 아이템 저장] customId: ${btn.customId}, 추출된 값: ${itemIdOrIndex}`);
                        
                        // 최신 임시 아이템 목록 가져오기
                        const currentTempItems = tempItems.get(user.discordId) || [];
                        
                        console.log(`[임시 아이템 저장] 현재 아이템 수: ${currentTempItems.length}`);
                        
                        let itemIndex = -1;
                        
                        // 숫자인지 확인 (하위 호환성)
                        if (!isNaN(itemIdOrIndex)) {
                            // 인덱스로 처리
                            itemIndex = parseInt(itemIdOrIndex);
                            console.log(`[임시 아이템 저장] 인덱스 기반 처리: ${itemIndex}`);
                        } else {
                            // ID로 아이템 찾기
                            itemIndex = currentTempItems.findIndex(item => item.id === itemIdOrIndex);
                            console.log(`[임시 아이템 저장] ID 기반 처리: ${itemIdOrIndex}`);
                        }
                        
                        if (itemIndex === -1) {
                            await btn.followUp({
                                content: '❌ 아이템을 찾을 수 없습니다. 이미 처리되었을 수 있습니다.',
                                flags: 64
                            });
                            return;
                        }
                        
                        const itemToSave = currentTempItems[itemIndex];
                        
                        if (!itemToSave) {
                            await btn.followUp({
                                content: '❌ 아이템을 찾을 수 없습니다.',
                                flags: 64
                            });
                            return;
                        }
                        
                        // 인벤토리 아이템 형식에 맞게 변환
                        const inventoryItem = {
                            id: itemToSave.id || `random_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                            name: itemToSave.name,
                            type: itemToSave.type || 'weapon',
                            rarity: itemToSave.rarity || 'normal',
                            color: itemToSave.color,
                            emoji: itemToSave.emoji,
                            stats: itemToSave.stats || {},
                            description: itemToSave.description,
                            price: itemToSave.price || 0,
                            sellPrice: itemToSave.sellPrice || Math.floor((itemToSave.price || 0) * 0.6),
                            enhanceLevel: itemToSave.enhanceLevel || 0,
                            score: itemToSave.score || 0,
                            setName: '장비', // 필수 필드
                            quantity: 1,
                            appraisedAt: new Date(),
                            foundAt: new Date()
                        };
                        
                        // 인벤토리에 저장
                        const updatedUser = await getUser(user.discordId);
                        updatedUser.inventory.push(inventoryItem);
                        await saveUser(updatedUser);
                        
                        // 임시 보관함에서 제거
                        currentTempItems.splice(itemIndex, 1);
                        tempItems.set(user.discordId, currentTempItems);
                        saveTempItems(); // 파일에 저장
                        
                        await btn.followUp({
                            content: `✅ **${itemToSave.name}**을(를) 인벤토리에 저장했습니다!`,
                            flags: 64
                        });
                    } catch (error) {
                        console.error('save_temp_item 오류:', error);
                        await btn.followUp({
                            content: '❌ 아이템 저장 중 오류가 발생했습니다.',
                            flags: 64
                        });
                    }
                    
                    // 목록 새로고침
                    const remainingItems = tempItems.get(user.discordId) || [];
                    if (remainingItems.length > 0) {
                        currentPage = Math.min(currentPage, Math.ceil(remainingItems.length / itemsPerPage) - 1);
                        await showTempItemsPage(currentPage);
                    } else {
                        await btn.editReply({
                            content: '✅ 모든 임시 아이템을 처리했습니다.',
                            embeds: [],
                            components: []
                        });
                        tempCollector.stop();
                    }
                }
                else if (btn.customId.startsWith('sell_temp_item_')) {
                    try {
                        await btn.deferUpdate();
                        const itemIdOrIndex = btn.customId.substring('sell_temp_item_'.length);
                        
                        console.log(`[임시 아이템 판매] customId: ${btn.customId}, 추출된 값: ${itemIdOrIndex}`);
                        
                        // 최신 임시 아이템 목록 가져오기
                        const currentTempItems = tempItems.get(user.discordId) || [];
                        
                        let itemIndex = -1;
                        
                        // 숫자인지 확인 (하위 호환성)
                        if (!isNaN(itemIdOrIndex)) {
                            // 인덱스로 처리
                            itemIndex = parseInt(itemIdOrIndex);
                            console.log(`[임시 아이템 판매] 인덱스 기반 처리: ${itemIndex}`);
                        } else {
                            // ID로 아이템 찾기
                            itemIndex = currentTempItems.findIndex(item => item.id === itemIdOrIndex);
                            console.log(`[임시 아이템 판매] ID 기반 처리: ${itemIdOrIndex}`);
                        }
                        
                        if (itemIndex === -1) {
                            await btn.followUp({
                                content: '❌ 아이템을 찾을 수 없습니다. 이미 처리되었을 수 있습니다.',
                                flags: 64
                            });
                            return;
                        }
                        
                        const itemToSell = currentTempItems[itemIndex];
                        
                        if (!itemToSell) {
                            await btn.followUp({
                                content: '❌ 아이템을 찾을 수 없습니다.',
                                flags: 64
                            });
                            return;
                        }
                        
                        // 골드 지급
                        const updatedUser = await getUser(user.discordId);
                        const sellPrice = itemToSell.sellPrice || Math.floor((itemToSell.price || 0) * 0.6);
                        updatedUser.gold += sellPrice;
                        await saveUser(updatedUser);
                        
                        // 임시 보관함에서 제거
                        currentTempItems.splice(itemIndex, 1);
                        tempItems.set(user.discordId, currentTempItems);
                        saveTempItems(); // 파일에 저장
                        
                        await btn.followUp({
                            content: `💰 **${itemToSell.name}**을(를) ${sellPrice.toLocaleString()}G에 판매했습니다!`,
                            flags: 64
                        });
                    } catch (error) {
                        console.error('sell_temp_item 오류:', error);
                        await btn.followUp({
                            content: '❌ 아이템 판매 중 오류가 발생했습니다.',
                            flags: 64
                        });
                    }
                    
                    // 목록 새로고침
                    const remainingItems = tempItems.get(user.discordId) || [];
                    if (remainingItems.length > 0) {
                        currentPage = Math.min(currentPage, Math.ceil(remainingItems.length / itemsPerPage) - 1);
                        await showTempItemsPage(currentPage);
                    } else {
                        await btn.editReply({
                            content: '✅ 모든 임시 아이템을 처리했습니다.',
                            embeds: [],
                            components: []
                        });
                        tempCollector.stop();
                    }
                }
                else if (btn.customId === 'back_to_temp_list') {
                    await btn.deferUpdate();
                    await showTempItemsPage(currentPage);
                }
                else if (btn.customId === 'sell_all_temp') {
                    await btn.deferUpdate();
                    
                    const currentTempItems = tempItems.get(user.discordId) || [];
                    if (currentTempItems.length === 0) {
                        await btn.followUp({
                            content: '❌ 판매할 임시 아이템이 없습니다.',
                            flags: 64
                        });
                        return;
                    }
                    
                    // 확인 메시지
                    const totalPrice = currentTempItems.reduce((sum, item) => sum + (item.sellPrice || Math.floor((item.price || 0) * 0.6)), 0);
                    const confirmEmbed = new EmbedBuilder()
                        .setColor('#FF9900')
                        .setTitle('⚠️ 모든 임시 아이템 판매 확인')
                        .setDescription(`**${currentTempItems.length}개**의 모든 임시 아이템을 판매하시겠습니까?`)
                        .addFields({
                            name: '💰 예상 판매 금액',
                            value: `${totalPrice.toLocaleString()}G`,
                            inline: false
                        });
                    
                    const confirmButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_sell_all_temp')
                            .setLabel('모두 판매')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('💰'),
                        new ButtonBuilder()
                            .setCustomId('cancel_sell_all_temp')
                            .setLabel('취소')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('❌')
                    );
                    
                    await btn.editReply({
                        embeds: [confirmEmbed],
                        components: [confirmButtons]
                    });
                }
                else if (btn.customId === 'confirm_sell_all_temp') {
                    await btn.deferUpdate();
                    
                    const currentTempItems = tempItems.get(user.discordId) || [];
                    let totalSellPrice = 0;
                    
                    for (const item of currentTempItems) {
                        const sellPrice = item.sellPrice || Math.floor((item.price || 0) * 0.6);
                        totalSellPrice += sellPrice;
                    }
                    
                    // 골드 지급
                    const updatedUser = await getUser(user.discordId);
                    updatedUser.gold += totalSellPrice;
                    await saveUser(updatedUser);
                    
                    // 임시 보관함 비우기
                    tempItems.set(user.discordId, []);
                    saveTempItems();
                    
                    const resultEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('💰 모든 임시 아이템 판매 완료!')
                        .setDescription(`${currentTempItems.length}개의 아이템을 판매했습니다`)
                        .addFields(
                            {
                                name: '💵 획득 골드',
                                value: `+${totalSellPrice.toLocaleString()}G`,
                                inline: true
                            },
                            {
                                name: '💰 보유 골드',
                                value: `${updatedUser.gold.toLocaleString()}G`,
                                inline: true
                            }
                        );
                    
                    await btn.editReply({
                        embeds: [resultEmbed],
                        components: []
                    });
                    
                    tempCollector.stop();
                }
                else if (btn.customId === 'cancel_sell_all_temp') {
                    await btn.deferUpdate();
                    await showTempItemsPage(currentPage);
                }
                else if (btn.customId === 'back_to_sell_menu') {
                    await btn.deferUpdate();
                    tempCollector.stop();
                    const updatedUser = await getUser(user.discordId);
                    await showSellMenu(btn, updatedUser, getUser, saveUser);
                }
            });
            
            tempCollector.on('end', () => {
                // 컬렉터 종료
            });
        }
        
        // 계속 판매하기
        else if (i.customId === 'sell_menu' || i.customId === 'continue_sell') {
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate();
                }
                
                // 최신 사용자 정보 가져오기
                const User = require('../models/User');
                const freshUser = await User.findOne({ discordId: user.discordId });
                
                if (!freshUser || !freshUser.inventory) {
                    await i.editReply({
                        content: '❌ 사용자 정보를 불러올 수 없습니다.',
                        embeds: [],
                        components: []
                    });
                    return;
                }
                
                // 카트 초기화
                sellCarts.set(user.discordId, []);
                
                // 판매 가능한 아이템 필터링 (최신 정보로)
                sellableItems = freshUser.inventory.filter((item, index) => {
                    if (!item || !item.id) return false;
                    
                    // 사냥 전리품 제외 (감정사에게만 판매 가능)
                    if (item.type === 'material' || item.fromMonster || item.fromArea) {
                        return false;
                    }
                    
                    // 장착 중인 아이템 확인 (equipment는 inventorySlot을 저장함)
                    const isEquipped = Object.values(freshUser.equipment || {}).some(slotIndex => 
                        slotIndex !== null && slotIndex !== undefined && slotIndex !== -1 &&
                        item.inventorySlot !== undefined && item.inventorySlot === slotIndex
                    );
                    return !isEquipped;
                });
                
                // 각 아이템의 sellPrice가 없으면 계산해서 추가
                sellableItems.forEach(item => {
                    if (!item.sellPrice) {
                        item.sellPrice = Math.floor((item.price || 0) * 0.3);
                    }
                });
                
                // 아이템을 등급별로 정렬
                const rarityOrder = ['legendary', 'unique', 'epic', 'rare', 'normal', 'trash'];
                sellableItems.sort((a, b) => {
                    const rarityDiff = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
                    if (rarityDiff !== 0) return rarityDiff;
                    return (b.sellPrice || 0) - (a.sellPrice || 0);
                });
                
                // user 객체 업데이트
                user = freshUser;
                
                // 페이지 리셋
                currentPage = 0;
                totalPages = Math.ceil(sellableItems.length / itemsPerPage);
                
                // 페이지 표시
                await showSellPage(currentPage);
            } catch (error) {
                console.error('계속 판매하기 오류:', error);
                if (i.deferred || i.replied) {
                    await i.editReply({
                        content: '❌ 오류가 발생했습니다.',
                        embeds: [],
                        components: []
                    });
                }
            }
        }

        // 상점으로 돌아가기
        else if (i.customId === 'shop_refresh') {
            try {
                // 인터랙션 상태 확인
                if (!i.deferred && !i.replied) {
                    try {
                        await i.deferUpdate();
                    } catch (deferError) {
                        if (deferError.code === 10062) {
                            console.log('상점 새로고침: 인터랙션이 만료되었습니다.');
                            return;
                        } else if (deferError.code === 40060) {
                            console.log('상점 새로고침: 인터랙션이 이미 처리되었습니다.');
                            // 이미 처리된 경우에도 계속 진행
                        } else {
                            throw deferError;
                        }
                    }
                }
                
                collector.stop();
                const updatedUser = await getUser(user.discordId);
                const embed = createShopEmbed(updatedUser);
                const selectMenu = createSlotSelectMenu(updatedUser);
                
                if (i.deferred || i.replied) {
                    await i.editReply({
                        embeds: [embed],
                        components: [selectMenu]
                    });
                }
            } catch (error) {
                console.error('shop_refresh 처리 중 오류:', error);
                if (!i.replied && !i.deferred) {
                    try {
                        await i.reply({ content: '❌ 오류가 발생했습니다.', flags: 64 });
                    } catch (replyError) {
                        console.error('응답 전송 실패:', replyError);
                    }
                }
            }
        }
    });

    collector.on('end', () => {
        // 컬렉터 종료 시 처리
    });
    
    } catch (error) {
        console.error('showSellMenu 오류:', error);
        console.error('오류 스택:', error.stack);
        
        // interaction이 유효한지 확인
        if (interaction && interaction.editReply) {
            try {
                await interaction.editReply({
                    content: '❌ 판매 메뉴를 불러오는 중 오류가 발생했습니다.',
                    embeds: [],
                    components: []
                });
            } catch (replyError) {
                console.error('응답 전송 실패:', replyError);
            }
        }
    }
}

// 능력치 포맷
function formatItemStats(stats) {
    const statNames = {
        attack: "⚔️ 공격력",
        defense: "🛡️ 방어력",
        strength: "💪 힘",
        agility: "🏃 민첩",
        intelligence: "🧠 지능",
        vitality: "❤️ 체력",
        luck: "🍀 행운",
        hp: "💖 추가HP",
        dodge: "💨 회피력"
    };
    
    return Object.entries(stats)
        .map(([key, value]) => `${statNames[key]}: +${value}`)
        .join('\n');
}

// 모든 지정된 채널에 상점 초기화
async function initializeAllShops(client) {
    const shopChannelIds = ['1381614153399140412', '1388182808895291422']; // 엠블럼 상점과 동일한 채널 사용
    
    for (const channelId of shopChannelIds) {
        await initializeShop(client, channelId);
    }
}

// 관리자용 뽑기 상태 초기화
function clearGachaInProgress() {
    const size = gachaInProgress.size;
    gachaInProgress.clear();
    return size;
}

module.exports = {
    createShopEmbed,
    createSlotSelectMenu,
    initializeShop,
    initializeAllShops,
    handleShopInteraction,
    permanentMessageIds,
    initializeUserShopLevels,
    getRatesForLevel,
    getRequiredExp
};