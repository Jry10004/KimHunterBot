const autoDungeonSystem = require('./autoDungeonSystem');

async function handleDungeonInteraction(interaction) {
    // 메뉴에서 던전 선택한 경우
    if (interaction.customId === 'dungeon') {
        await autoDungeonSystem.startAutoDungeon(interaction);
        return;
    }
    
    // 자동 던전 재탐험
    if (interaction.customId.startsWith('dungeon:auto:')) {
        await autoDungeonSystem.startAutoDungeon(interaction);
        return;
    }
    
    // 기타 던전 관련 처리가 필요한 경우 여기에 추가
}

module.exports = { handleDungeonInteraction };