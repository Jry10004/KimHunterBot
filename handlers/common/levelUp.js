// 레벨업 처리 함수
async function checkAndProcessLevelUp(user) {
    let leveledUp = false;
    let levelsGained = 0;
    const MAX_LEVEL = 100; // 최대 레벨
    
    // 이미 만렙인 경우 경험치 0으로 고정
    if (user.level >= MAX_LEVEL) {
        user.level = MAX_LEVEL;
        if (user.exp > 0) {
            user.exp = 0;
            await user.save();
            console.log(`[레벨업] ${user.nickname || user.discordId}님은 이미 만렙입니다. 경험치를 0으로 설정했습니다.`);
        }
        return { leveledUp: false, levelsGained: 0 };
    }
    
    // 레벨업 체크 (여러 레벨을 한번에 올릴 수 있도록)
    while (user.exp >= user.level * 100 && user.level < MAX_LEVEL) {
        user.exp -= user.level * 100;
        user.level++;
        levelsGained++;
        leveledUp = true;
        
        // 레벨업 보상
        user.statPoints = (user.statPoints || 0) + 5;
        
        // 만렉 도달 체크
        if (user.level >= MAX_LEVEL) {
            user.level = MAX_LEVEL;
            user.exp = 0; // 만렙 도달 시 경험치 0으로 설정
            console.log(`[레벨업] ${user.nickname || user.discordId}님이 만렉(${MAX_LEVEL})에 도달했습니다!`);
            break;
        }
        
        // 무한 루프 방지
        if (levelsGained > 100) break;
    }
    
    if (leveledUp) {
        await user.save();
    }
    
    return { leveledUp, levelsGained };
}

module.exports = {
    checkAndProcessLevelUp
};