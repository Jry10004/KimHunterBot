const dungeonSystem = require('./dungeonSystem');

async function handleDungeonInteraction(interaction) {
    // 모든 던전 관련 인터랙션을 던전 시스템으로 처리
    await dungeonSystem.startAutoDungeon(interaction);
}

module.exports = { handleDungeonInteraction };