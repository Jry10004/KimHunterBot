// 레벨 100 제한 헬퍼 함수
const MAX_LEVEL = 100;

// 경험치 추가 전 레벨 체크
function canGainExperience(user) {
    return user.level < MAX_LEVEL;
}

// 안전한 경험치 추가 함수
function addExperienceSafely(user, expAmount) {
    if (user.level >= MAX_LEVEL) {
        // 만렙인 경우 경험치 추가하지 않음
        console.log(`[EXP Cap] ${user.nickname || user.discordId}님은 만렙(${MAX_LEVEL})이므로 경험치를 추가하지 않습니다.`);
        return 0;
    }
    
    user.exp += expAmount;
    return expAmount;
}

// 레벨과 경험치 체크 및 조정
function enforceMaxLevel(user) {
    if (user.level > MAX_LEVEL) {
        user.level = MAX_LEVEL;
        user.exp = 0;
        console.log(`[Level Cap] ${user.nickname || user.discordId}님의 레벨을 ${MAX_LEVEL}로 조정했습니다.`);
    } else if (user.level === MAX_LEVEL && user.exp > 0) {
        user.exp = 0;
        console.log(`[EXP Cap] ${user.nickname || user.discordId}님은 만렙이므로 경험치를 0으로 조정했습니다.`);
    }
}

module.exports = {
    MAX_LEVEL,
    canGainExperience,
    addExperienceSafely,
    enforceMaxLevel
};