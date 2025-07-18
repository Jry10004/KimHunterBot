const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { startEvent, endEvent, forceEndEvent, eventState } = require('../../handlers/events/puppyNecklaceEvent');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕이벤트')
        .setDescription('댕댕봇 목걸이 도둑 잡기 이벤트 관리')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('시작')
                .setDescription('이벤트를 시작합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('종료')
                .setDescription('다음 보스 처치 시 이벤트를 종료합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('강제종료')
                .setDescription('이벤트를 즉시 강제 종료합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('상태')
                .setDescription('현재 이벤트 상태를 확인합니다')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === '시작') {
            // 이벤트 채널 ID (1386447256408035399)
            const eventChannelId = '1386447256408035399';
            const result = await startEvent(interaction.client, eventChannelId);
            
            await interaction.editReply({
                content: result.message
            });
        } else if (subcommand === '종료') {
            const result = await endEvent(interaction.client, interaction);
            
            await interaction.editReply({
                content: result.message
            });
        } else if (subcommand === '강제종료') {
            const result = await forceEndEvent(interaction.client);
            
            await interaction.editReply({
                content: result.message
            });
        } else if (subcommand === '상태') {
            // 이벤트 상태 확인
            const statusEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 댕댕이벤트 상태')
                .setTimestamp();
            
            // 메모리 상태
            statusEmbed.addFields({
                name: '💾 메모리 상태',
                value: `활성: **${eventState.active}**\n` +
                       `채널: **${eventState.eventChannel || '없음'}**\n` +
                       `보스 수: **${eventState.bossCount}**\n` +
                       `처치 수: **${eventState.totalBossesDefeated}**\n` +
                       `참여자 수: **${eventState.participants.size}**`,
                inline: true
            });
            
            // 현재 보스 정보
            if (eventState.currentBoss) {
                statusEmbed.addFields({
                    name: '🦝 현재 보스',
                    value: `이름: **${eventState.currentBoss.name}**\n` +
                           `HP: **${eventState.currentBoss.currentHp}/${eventState.currentBoss.maxHp}**\n` +
                           `번호: **${eventState.currentBoss.bossNumber}번째**\n` +
                           `공격자: **${eventState.currentBoss.attackedUsers ? 
                             (eventState.currentBoss.attackedUsers instanceof Set ? 
                               eventState.currentBoss.attackedUsers.size : 
                               Object.keys(eventState.currentBoss.attackedUsers).length) : 0}명**`,
                    inline: true
                });
            }
            
            // 파일 상태 읽기
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const EVENT_STATE_FILE = path.join(__dirname, '../../data/eventState.json');
                const fileContent = await fs.readFile(EVENT_STATE_FILE, 'utf8');
                const fileData = JSON.parse(fileContent);
                
                statusEmbed.addFields({
                    name: '📁 파일 상태',
                    value: `활성: **${fileData.puppyNecklaceEvent?.active || false}**\n` +
                           `보스 수: **${fileData.puppyNecklaceEvent?.bossCount || 0}**\n` +
                           `처치 수: **${fileData.puppyNecklaceEvent?.totalBossesDefeated || 0}**`,
                    inline: false
                });
            } catch (error) {
                statusEmbed.addFields({
                    name: '📁 파일 상태',
                    value: `오류: ${error.message}`,
                    inline: false
                });
            }
            
            await interaction.editReply({ embeds: [statusEmbed] });
        }
    }
};