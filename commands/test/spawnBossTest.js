const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('보스소환테스트')
        .setDescription('보스를 테스트로 소환합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 확인
        const ADMIN_IDS = ['424480594542592009', '295980447849250817', '592659577384730645'];
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }

        const worldBossSystem = require('../systems/worldBossSystem');
        
        // 현재 진행중인 보스가 있는지 확인
        if (worldBossSystem.activeWorldBoss) {
            return interaction.reply({
                content: '❌ 이미 진행중인 보스가 있습니다!',
                ephemeral: true
            });
        }

        // 쿨타임 무시하고 보스 소환
        worldBossSystem.lastSpawnTime = 0; // 쿨타임 초기화
        const success = await worldBossSystem.spawnRandomBoss(interaction.client);
        
        if (success) {
            await interaction.reply({
                content: '✅ 보스가 테스트로 소환되었습니다!',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ 보스 소환에 실패했습니다!',
                ephemeral: true
            });
        }
    }
};