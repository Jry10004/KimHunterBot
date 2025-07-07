const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const newsSystem = require('../systems/newsSystem');
const weatherSystem = require('../systems/weatherSystem');
const timeSystem = require('../systems/timeSystem');
const { formatNumber } = require('../handlers/common/utils');
const { getAllCompanies } = require('../data/companiesData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뉴스')
        .setDescription('김헌터 월드의 최신 뉴스를 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        // 현재 시간대와 날씨 정보
        const currentTime = timeSystem.getCurrentPeriodInfo();
        const currentWeather = weatherSystem.getCurrentWeatherInfo();
        
        // 메인 뉴스 화면
        const mainEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📰 김헌터 월드 뉴스')
            .setDescription('실시간 뉴스와 시장 정보를 확인하세요!')
            .addFields(
                {
                    name: '🕐 현재 시간대',
                    value: `${currentTime.emoji} **${currentTime.name}**\n${currentTime.description}`,
                    inline: true
                },
                {
                    name: '🌤️ 현재 날씨',
                    value: `${currentWeather.emoji} **${currentWeather.name}**\n${currentWeather.description}`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: '김헌터 월드 뉴스 센터' });
        
        // 최근 속보
        const breakingNews = newsSystem.breakingNews.slice(-3);
        if (breakingNews.length > 0) {
            let breakingText = '';
            breakingNews.forEach(news => {
                const category = newsSystem.NEWS_CATEGORIES[news.category];
                breakingText += `${category.emoji} **[속보]** ${news.content}\n`;
            });
            mainEmbed.addFields({
                name: '📢 최근 속보',
                value: breakingText || '현재 속보가 없습니다.'
            });
        }
        
        // 주요 기업 동향
        const topCompanies = getAllCompanies()
            .map(company => {
                // 변동률 계산
                const changePercent = ((company.currentPrice / company.basePrice - 1) * 100);
                return {
                    ...company,
                    changePercent: changePercent
                };
            })
            .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
            .slice(0, 5);
        
        let marketText = '';
        topCompanies.forEach(company => {
            const change = company.changePercent.toFixed(2);
            const arrow = change > 0 ? '📈' : change < 0 ? '📉' : '➖';
            marketText += `${company.emoji} **${company.name}**: ${formatNumber(company.currentPrice)}G ${arrow} ${change > 0 ? '+' : ''}${change}%\n`;
        });
        
        mainEmbed.addFields({
            name: '📊 주요 기업 동향',
            value: marketText
        });
        
        // 버튼 생성
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('news_recent')
                    .setLabel('📰 최근 뉴스')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('news_market')
                    .setLabel('📈 시장 뉴스')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('news_activities')
                    .setLabel('🎯 추천 활동')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('news_forecast')
                    .setLabel('🌤️ 날씨 예보')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        await interaction.editReply({
            embeds: [mainEmbed],
            components: [buttons]
        });
    }
};