const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getChartImageUrl } = require('../data/chartService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('차트테스트')
        .setDescription('차트 이미지 생성 테스트'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        // 라인 차트 생성
        const lineChartUrl = getChartImageUrl(
            'test-item-1',
            '테스트 아이템',
            'TEST',
            15000,
            null,
            'line'
        );
        
        // 캔들스틱 차트 생성
        const candleChartUrl = getChartImageUrl(
            'test-item-2',
            '프리미엄 아이템',
            'PREM',
            50000,
            null,
            'candlestick'
        );
        
        const embed1 = new EmbedBuilder()
            .setColor('#131722')
            .setTitle('📈 라인 차트 테스트')
            .setDescription('QuickChart.io를 사용한 실시간 차트')
            .setImage(lineChartUrl);
        
        const embed2 = new EmbedBuilder()
            .setColor('#131722')
            .setTitle('📊 캔들스틱 차트 테스트')
            .setDescription('5분봉 캔들 차트')
            .setImage(candleChartUrl);
        
        await interaction.editReply({
            content: '✅ 차트 이미지가 정상적으로 생성되었습니다!',
            embeds: [embed1, embed2]
        });
    }
};