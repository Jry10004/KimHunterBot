const { SlashCommandBuilder } = require('discord.js');
const qaLogger = require('../systems/qaLogger');
const fs = require('fs').promises;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('버그리포트')
        .setDescription('버그 리포트 생성 (관리자 전용)')
        .addStringOption(option =>
            option.setName('기간')
                .setDescription('오늘, 어제, 이번주, 전체')
                .setRequired(false)
                .addChoices(
                    { name: '오늘', value: 'today' },
                    { name: '어제', value: 'yesterday' },
                    { name: '이번주', value: 'week' },
                    { name: '전체', value: 'all' }
                )),
    
    async execute(interaction) {
        // 개발자 확인
        const DEVELOPER_ID = '424480594542592009';
        
        if (interaction.user.id !== DEVELOPER_ID) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 개발자만 사용할 수 있습니다.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const period = interaction.options.getString('기간') || 'today';
        
        let startDate = null;
        let endDate = null;
        const now = new Date();
        
        switch (period) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                startDate = new Date(yesterday.setHours(0, 0, 0, 0));
                endDate = new Date(yesterday.setHours(23, 59, 59, 999));
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                startDate = weekAgo;
                break;
        }

        const result = await qaLogger.generateBugReport(
            startDate?.toISOString().split('T')[0],
            endDate?.toISOString().split('T')[0]
        );

        if (result.success) {
            let description = `📊 **${period === 'today' ? '오늘' : period === 'yesterday' ? '어제' : period === 'week' ? '이번 주' : '전체'} 버그 리포트**\n\n`;
            description += `❌ 오류: ${result.summary.오류}건\n`;
            description += `⚠️ 경고: ${result.summary.경고}건\n`;
            description += `💬 사용자 신고: ${result.summary.사용자피드백}건\n`;
            description += `🐌 성능 문제: ${result.summary.성능문제}건`;

            await interaction.editReply({
                content: description,
                files: [result.reportPath]
            });
        } else {
            await interaction.editReply('❌ 리포트 생성 실패: ' + result.error);
        }
    }
};