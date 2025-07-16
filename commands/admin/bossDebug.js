const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const worldBossSystem = require('../../systems/worldBossSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('보스디버그')
        .setDescription('보스 시스템 디버깅 (관리자 전용)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('상태')
                .setDescription('현재 보스 상태 확인')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('소환')
                .setDescription('보스 강제 소환')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('리셋')
                .setDescription('보스 시스템 리셋')
        ),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                flags: 64 
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === '상태') {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🔍 보스 시스템 상태')
                .setTimestamp();

            const now = Date.now();
            const timeSinceLastSpawn = now - worldBossSystem.lastSpawnTime;
            const timeUntilNextSpawn = Math.max(0, worldBossSystem.SPAWN_COOLDOWN - timeSinceLastSpawn);

            embed.addFields(
                { 
                    name: '📊 시스템 정보', 
                    value: `\`\`\`
활성 보스: ${worldBossSystem.activeWorldBoss ? '있음' : '없음'}
마지막 소환: ${worldBossSystem.lastSpawnTime ? new Date(worldBossSystem.lastSpawnTime).toLocaleString('ko-KR') : '없음'}
다음 소환 가능: ${timeUntilNextSpawn > 0 ? Math.floor(timeUntilNextSpawn / 1000 / 60) + '분 후' : '지금 가능'}
소환 쿨다운: ${Math.floor(worldBossSystem.SPAWN_COOLDOWN / 1000 / 60)}분
\`\`\``,
                    inline: false
                }
            );

            if (worldBossSystem.activeWorldBoss) {
                const boss = worldBossSystem.activeWorldBoss;
                embed.addFields({
                    name: '👹 현재 보스',
                    value: `\`\`\`
이름: ${boss.boss.name}
HP: ${boss.currentHp}/${boss.maxHp}
참가자: ${boss.participants.length}명
시작 시간: ${new Date(boss.startTime).toLocaleString('ko-KR')}
\`\`\``,
                    inline: false
                });
            }

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], flags: 64 });
            }
        } 
        else if (subcommand === '소환') {

            // 활성 보스가 있는지 확인
            if (worldBossSystem.activeWorldBoss) {
                return interaction.editReply({
                    content: '❌ 이미 활성화된 보스가 있습니다!'
                });
            }

            // 강제 소환
            const result = await worldBossSystem.spawnRandomBoss(interaction.client);
            
            if (result !== false) {
                await interaction.editReply({
                    content: '✅ 보스가 성공적으로 소환되었습니다!'
                });
            } else {
                await interaction.editReply({
                    content: '❌ 보스 소환에 실패했습니다. 콘솔 로그를 확인하세요.'
                });
            }
        }
        else if (subcommand === '리셋') {
            // 보스 시스템 리셋
            worldBossSystem.activeWorldBoss = null;
            worldBossSystem.lastSpawnTime = 0;
            worldBossSystem.READY_PARTICIPANTS.clear();
            
            if (worldBossSystem.AUTO_START_TIMER) {
                clearTimeout(worldBossSystem.AUTO_START_TIMER);
                worldBossSystem.AUTO_START_TIMER = null;
            }

            if (interaction.deferred) {
                await interaction.editReply({
                    content: '✅ 보스 시스템이 리셋되었습니다.'
                });
            } else {
                await interaction.reply({
                    content: '✅ 보스 시스템이 리셋되었습니다.',
                    flags: 64
                });
            }
        }
    }
};