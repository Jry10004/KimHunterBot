const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const newsSystem = require('../../systems/newsSystem');
const User = require('../../models/User');
const fakeNewsGenerator = require('../../systems/fakeNewsGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('newstest')
        .setDescription('뉴스 시스템 완전 테스트')
        .addSubcommand(subcommand =>
            subcommand
                .setName('debug')
                .setDescription('뉴스 시스템 디버그 정보'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('forcenews')
                .setDescription('강제로 3가지 카테고리 뉴스 생성'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fixchannel')
                .setDescription('하드코딩 채널 수정')),
                
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
            case 'debug':
                const debugEmbed = new EmbedBuilder()
                    .setTitle('🔍 뉴스 시스템 디버그 정보')
                    .setColor('#FF0000')
                    .addFields(
                        { name: '시스템 상태', value: `초기화: ${newsSystem.isInitialized ? '✅' : '❌'}\n클라이언트: ${newsSystem.client ? '✅' : '❌'}` },
                        { name: '채널 정보', value: `채널 수: ${newsSystem.newsChannels.size}\n하드코딩 채널: 1389401523418693723\n현재 채널 포함: ${newsSystem.newsChannels.has('1389401523418693723') ? '✅' : '❌'}` },
                        { name: '큐 상태', value: `뉴스 큐: ${newsSystem.newsQueue.length}\n속보 큐: ${newsSystem.breakingNews.length}\n히스토리: ${newsSystem.newsHistory.length}` }
                    );
                    
                // 하드코딩 채널 권한 확인
                try {
                    const hardcodedChannel = await interaction.client.channels.fetch('1389401523418693723');
                    const botMember = hardcodedChannel.guild.members.cache.get(interaction.client.user.id);
                    const permissions = hardcodedChannel.permissionsFor(botMember);
                    
                    debugEmbed.addFields({
                        name: '하드코딩 채널 권한',
                        value: `채널명: ${hardcodedChannel.name}\n보기: ${permissions.has('ViewChannel') ? '✅' : '❌'}\n전송: ${permissions.has('SendMessages') ? '✅' : '❌'}\n임베드: ${permissions.has('EmbedLinks') ? '✅' : '❌'}`
                    });
                } catch (error) {
                    debugEmbed.addFields({
                        name: '하드코딩 채널 에러',
                        value: error.message
                    });
                }
                
                await interaction.reply({ embeds: [debugEmbed] });
                break;
                
            case 'forcenews':
                await interaction.deferReply();
                
                // 테스트용 유저 데이터
                const testUsers = [
                    { nickname: '김헌터', _id: '1', level: 50 },
                    { nickname: '드래곤슬레이어', _id: '2', level: 45 },
                    { nickname: '마법사길드장', _id: '3', level: 60 },
                    { nickname: '초보모험가', _id: '4', level: 10 },
                    { nickname: '골드파머', _id: '5', level: 30 }
                ];
                
                const newsGenerated = [];
                
                // 1. 시장/경제 뉴스
                const marketNews = {
                    content: `📈 주식 시장이 ${Math.random() > 0.5 ? '상승' : '하락'} 추세를 보이고 있습니다. 전문가들은 ${['신중한 투자', '적극적인 매수', '관망세'][Math.floor(Math.random() * 3)]}를 권하고 있습니다.`,
                    severity: 'finance',
                    impact: { sectors: ['all'], change: (Math.random() - 0.5) * 0.1 }
                };
                
                // 2. 연예 뉴스
                const entertainmentNews = {
                    content: `💕 ${testUsers[0].nickname}님과 ${testUsers[1].nickname}님이 비밀 데이트 중이라는 목격담이 전해졌습니다!`,
                    severity: 'scandal',
                    impact: null
                };
                
                // 3. 사건사고 뉴스
                const crimeNews = {
                    content: `🚨 던전에서 대규모 몬스터 폭동이 발생했습니다. ${testUsers[2].nickname}님이 진압에 나섰습니다.`,
                    severity: 'crime',
                    impact: { companies: ['PTL', 'STF'], change: -0.05 }
                };
                
                // 뉴스 발송
                for (const news of [marketNews, entertainmentNews, crimeNews]) {
                    const breakingNews = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
                        type: 'fake_news',
                        category: newsSystem.getCategoryBySeverity(news.severity),
                        content: news.content,
                        timestamp: new Date(),
                        isBreaking: true,
                        marketImpact: news.impact
                    };
                    
                    await newsSystem.publishBreakingNews(breakingNews);
                    newsGenerated.push(`${newsSystem.NEWS_CATEGORIES[breakingNews.category]?.emoji || '📰'} ${breakingNews.category}: ${news.content}`);
                    
                    // 5초 대기
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                
                await interaction.editReply(`✅ 3개의 뉴스를 생성했습니다:\n\n${newsGenerated.join('\n\n')}`);
                break;
                
            case 'fixchannel':
                // 현재 채널을 뉴스 채널로 설정
                newsSystem.newsChannels.clear();
                newsSystem.addNewsChannel(interaction.channel.id);
                
                await interaction.reply(`✅ 뉴스 채널을 현재 채널로 변경했습니다.\n이전: 1389401523418693723\n현재: ${interaction.channel.id} (${interaction.channel.name})`);
                break;
        }
    }
};