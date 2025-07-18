const User = require('../../models/User');
const { calculateCombatPower: calculateCombatPowerFromModule } = require('./combatPower');

// 사용자 정보 가져오기
async function getUser(discordId) {
    try {
        let user = await User.findOne({ discordId });
        return user;
    } catch (error) {
        console.error('사용자 조회 오류:', error);
        return null;
    }
}

// 사용자 정보 저장하기
async function saveUser(user) {
    try {
        if (!user) return false;
        await user.save();
        return true;
    } catch (error) {
        console.error('사용자 저장 오류:', error);
        return false;
    }
}

// 관리자 확인
const ADMIN_IDS = [
    '424480594542592009',   // 요리
    '295980447849250817',   // 하연94
    '592659577384730645'    // 해물파전
];

function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

// 숫자 포맷팅
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 경험치 계산
function calculateExpForLevel(level) {
    return level * 100;
}

// 레벨업 체크
async function checkLevelUp(user) {
    const maxExp = calculateExpForLevel(user.level);
    if (user.exp >= maxExp) {
        user.level += 1;
        user.exp -= maxExp;
        user.statPoints += 5;
        return true;
    }
    return false;
}

// 티어 계산
function calculateTier(rating) {
    if (rating >= 2000) return 'Diamond';
    if (rating >= 1700) return 'Platinum';
    if (rating >= 1400) return 'Gold';
    if (rating >= 1100) return 'Silver';
    return 'Bronze';
}

// 티어 이모지
function getTierEmoji(tier) {
    const tierEmojis = {
        'Bronze': '🥉',
        'Silver': '🥈',
        'Gold': '🥇',
        'Platinum': '💎',
        'Diamond': '💠'
    };
    return tierEmojis[tier] || '🥉';
}

// 장착된 아이템 가져오기
function getEquippedItem(user, slot) {
    return user.equipment?.[slot] || null;
}

// 엠블럼 레벨 가져오기
function getEmblemLevel(emblemName) {
    const emblemLevels = {
        '초보전사': 1, '튼튼한 기사': 2, '용맹한 검사': 3, '맹렬한 전사': 4, '전설의 기사': 5,
        '마을사냥꾼': 1, '숲의 궁수': 2, '바람 사수': 3, '정확한 사격수': 4, '전설의 명궁': 5,
        '초보 수호자': 1, '철벽 방패병': 2, '불굴의 수호자': 3, '강철 파수꾼': 4, '전설의 철벽': 5,
        '견습 마법사': 1, '원소 술사': 2, '신비한 현자': 3, '대마법사': 4, '전설의 아크메이지': 5,
        '떠돌이 도적': 1, '운 좋은 도둑': 2, '행운의 닌자': 3, '복 많은 도적': 4, '전설의 행운아': 5
    };
    return emblemLevels[emblemName] || 0;
}

// 통합 전투력 계산 함수 - combatPower.js의 함수를 사용
function calculateCombatPower(user) {
    return calculateCombatPowerFromModule(user);
}

module.exports = {
    getUser,
    saveUser,
    isAdmin,
    ADMIN_IDS,
    formatNumber,
    calculateExpForLevel,
    checkLevelUp,
    calculateTier,
    getTierEmoji,
    calculateCombatPower
};