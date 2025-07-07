// 레벨업 처리 함수
async function checkAndProcessLevelUp(user) {
    let leveledUp = false;
    let levelsGained = 0;
    
    // 레벨업 체크 (여러 레벨을 한번에 올릴 수 있도록)
    while (user.exp >= user.level * 100) {
        user.exp -= user.level * 100;
        user.level++;
        levelsGained++;
        leveledUp = true;
        
        // 레벨업 보상
        user.statPoints = (user.statPoints || 0) + 5;
        
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