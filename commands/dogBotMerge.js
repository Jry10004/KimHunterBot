const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const stateManager = require('../systems/dogBotStateManager');
const { ADMIN_IDS } = require('../config/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇데이터병합')
        .setDescription('댕댕봇 구출 이벤트의 중복된 유저 데이터를 병합합니다')
        .addStringOption(option =>
            option.setName('구id')
                .setDescription('병합할 이전 Discord ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('신id')
                .setDescription('병합 대상이 될 새로운 Discord ID')
                .setRequired(true)),
    
    async execute(interaction) {
        // 관리자만 사용 가능
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
                ephemeral: true
            });
        }
        
        const oldUserId = interaction.options.getString('구id');
        const newUserId = interaction.options.getString('신id');
        
        // 현재 데이터 확인
        const oldUserData = {
            damage: stateManager.state.statistics.userDamage[oldUserId] || 0,
            attacks: stateManager.state.statistics.userAttackCount[oldUserId] || 0
        };
        
        const newUserData = {
            damage: stateManager.state.statistics.userDamage[newUserId] || 0,
            attacks: stateManager.state.statistics.userAttackCount[newUserId] || 0
        };
        
        if (oldUserData.damage === 0 && oldUserData.attacks === 0) {
            return await interaction.reply({
                content: `❌ 구 ID(${oldUserId})에 데이터가 없습니다.`,
                ephemeral: true
            });
        }
        
        // 병합 실행
        await stateManager.mergeUserData(oldUserId, newUserId);
        
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ 댕댕봇 데이터 병합 완료')
            .setDescription('중복된 유저 데이터가 성공적으로 병합되었습니다.')
            .addFields(
                {
                    name: '📊 병합 전',
                    value: `**구 ID (${oldUserId})**\n` +
                           `💥 데미지: ${oldUserData.damage.toLocaleString()}\n` +
                           `⚔️ 공격: ${oldUserData.attacks}회\n\n` +
                           `**신 ID (${newUserId})**\n` +
                           `💥 데미지: ${newUserData.damage.toLocaleString()}\n` +
                           `⚔️ 공격: ${newUserData.attacks}회`,
                    inline: true
                },
                {
                    name: '📊 병합 후',
                    value: `**신 ID (${newUserId})**\n` +
                           `💥 총 데미지: ${(oldUserData.damage + newUserData.damage).toLocaleString()}\n` +
                           `⚔️ 총 공격: ${oldUserData.attacks + newUserData.attacks}회`,
                    inline: true
                }
            )
            .setFooter({ text: '구 ID의 모든 데이터가 신 ID로 이전되었습니다.' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};