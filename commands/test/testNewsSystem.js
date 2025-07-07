const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const newsSystem = require('../../systems/newsSystem');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testnews')
        .setDescription('뉴스 시스템 테스트')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('뉴스 시스템 상태 확인'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('현재 채널을 뉴스 채널로 설정'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('breaking')
                .setDescription('테스트 속보 발송'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('generate')
                .setDescription('즉시 뉴스 생성')),
                
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'status':
                const statusEmbed = new EmbedBuilder()
                    .setTitle('📰 뉴스 시스템 상태')
                    .setColor('#0099ff')
                    .addFields(
                        { name: '초기화 상태', value: newsSystem.isInitialized ? '✅ 초기화됨' : '❌ 초기화 안됨' },
                        { name: '뉴스 채널 수', value: `${newsSystem.newsChannels.size}개` },
                        { name: '뉴스 채널 ID', value: newsSystem.newsChannels.size > 0 ? Array.from(newsSystem.newsChannels).join('\n') : '없음' },
                        { name: '뉴스 히스토리', value: `${newsSystem.newsHistory.length}개` },
                        { name: '속보 대기', value: `${newsSystem.breakingNews.length}개` }
                    );
                    
                await interaction.reply({ embeds: [statusEmbed] });
                break;
                
            case 'setchannel':
                newsSystem.addNewsChannel(interaction.channel.id);
                await interaction.reply(`✅ 이 채널(${interaction.channel.id})이 뉴스 채널로 설정되었습니다.`);
                break;
                
            case 'breaking':
                const testBreaking = {
                    id: Date.now().toString(),
                    type: 'test',
                    category: 'SPECIAL',
                    content: '🧪 이것은 테스트 속보입니다! 뉴스 시스템이 정상적으로 작동하고 있습니다.',
                    timestamp: new Date(),
                    isBreaking: true
                };
                
                newsSystem.breakingNews.push(testBreaking);
                newsSystem.newsHistory.unshift(testBreaking);
                await newsSystem.publishBreakingNews(testBreaking);
                
                await interaction.reply('📢 테스트 속보가 발송되었습니다!');
                break;
                
            case 'generate':
                await interaction.deferReply();
                
                // 활성 유저 확인
                const activeUsers = await User.find({
                    lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                    registered: true
                }).limit(20);
                
                if (activeUsers.length < 3) {
                    return interaction.editReply(`❌ 활성 유저가 부족합니다. (현재: ${activeUsers.length}명, 필요: 3명 이상)`);
                }
                
                // 뉴스 생성 트리거
                const fakeNewsGenerator = require('../../systems/fakeNewsGenerator');
                const newsToSend = [];
                
                // 각 카테고리별 뉴스 생성
                const marketNews = fakeNewsGenerator.generateFakeNews(activeUsers, ['FINANCE', 'BUSINESS']);
                if (marketNews) newsToSend.push(marketNews);
                
                const entertainmentNews = fakeNewsGenerator.generateFakeNews(activeUsers, ['ENTERTAINMENT']);
                if (entertainmentNews) newsToSend.push(entertainmentNews);
                
                const crimeNews = fakeNewsGenerator.generateFakeNews(activeUsers, ['CRIME']);
                if (crimeNews) newsToSend.push(crimeNews);
                
                // 뉴스 발송
                for (const news of newsToSend) {
                    const breakingNews = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                        type: 'fake_news',
                        category: news.category || 'SPECIAL',
                        content: news.content,
                        timestamp: new Date(),
                        isBreaking: true
                    };
                    
                    await newsSystem.publishBreakingNews(breakingNews);
                }
                
                await interaction.editReply(`✅ ${newsToSend.length}개의 뉴스가 생성되어 발송되었습니다!`);
                break;
        }
    }
};