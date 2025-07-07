const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testnews')
        .setDescription('뉴스 시스템 테스트 명령어')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('테스트할 뉴스 타입')
                .setRequired(true)
                .addChoices(
                    { name: '속보 발송', value: 'breaking' },
                    { name: '가짜 뉴스 생성', value: 'fake' },
                    { name: '시스템 상태', value: 'status' },
                    { name: '채널 설정', value: 'setchannel' }
                )),
    
    async execute(interaction) {
        // 관리자 권한 체크
        if (!interaction.member.permissions.has('Administrator')) {
            return await interaction.reply({ content: '이 명령어는 관리자만 사용할 수 있습니다.', ephemeral: true });
        }
        
        const newsSystem = require('../systems/newsSystem');
        const type = interaction.options.getString('type');
        
        switch(type) {
            case 'status':
                const statusEmbed = {
                    color: 0x0099ff,
                    title: '📰 뉴스 시스템 상태',
                    fields: [
                        { name: '초기화 상태', value: newsSystem.isInitialized ? '✅ 초기화됨' : '❌ 초기화 안됨', inline: true },
                        { name: '클라이언트', value: newsSystem.client ? '✅ 설정됨' : '❌ 설정 안됨', inline: true },
                        { name: '뉴스 채널 수', value: `${newsSystem.newsChannels.size}개`, inline: true },
                        { name: '뉴스 채널 목록', value: newsSystem.newsChannels.size > 0 ? Array.from(newsSystem.newsChannels).join('\n') : '없음' },
                        { name: '뉴스 큐', value: `${newsSystem.newsQueue.length}개 대기 중`, inline: true },
                        { name: '뉴스 히스토리', value: `${newsSystem.newsHistory.length}개 저장됨`, inline: true },
                        { name: '속보 큐', value: `${newsSystem.breakingNews.length}개`, inline: true }
                    ],
                    timestamp: new Date()
                };
                await interaction.reply({ embeds: [statusEmbed] });
                break;
                
            case 'breaking':
                // 테스트 속보 생성
                const testBreaking = {
                    id: Date.now().toString(),
                    type: 'test',
                    category: 'SPECIAL',
                    content: `🧪 ${interaction.user.username}님이 발송한 테스트 속보입니다!`,
                    timestamp: new Date(),
                    isBreaking: true
                };
                
                await interaction.deferReply();
                await newsSystem.publishBreakingNews(testBreaking);
                await interaction.editReply('✅ 테스트 속보를 발송했습니다. 뉴스 채널을 확인해주세요.');
                break;
                
            case 'fake':
                await interaction.deferReply();
                
                const User = require('../models/User');
                const fakeNewsGenerator = require('../systems/fakeNewsGenerator');
                
                // 활성 유저 가져오기
                const activeUsers = await User.find({ registered: true }).limit(10);
                
                if (activeUsers.length < 3) {
                    await interaction.editReply(`❌ 가짜 뉴스 생성에 필요한 활성 유저가 부족합니다. (현재: ${activeUsers.length}명, 필요: 3명 이상)`);
                    return;
                }
                
                // 가짜 뉴스 생성
                const fakeNews = fakeNewsGenerator.generateFakeNews(activeUsers);
                
                const fakeBreaking = {
                    id: Date.now().toString(),
                    type: 'fake_news',
                    category: newsSystem.getCategoryBySeverity(fakeNews.severity),
                    content: fakeNews.content,
                    timestamp: new Date(),
                    isBreaking: true,
                    marketImpact: fakeNews.impact
                };
                
                await newsSystem.publishBreakingNews(fakeBreaking);
                await interaction.editReply(`✅ 가짜 뉴스를 생성하여 발송했습니다!\n**내용**: ${fakeNews.content}`);
                break;
                
            case 'setchannel':
                // 현재 채널을 뉴스 채널로 설정
                const channelId = interaction.channel.id;
                newsSystem.addNewsChannel(channelId);
                
                // DB에도 저장
                const ServerSettings = require('../models/ServerSettings');
                await ServerSettings.findOneAndUpdate(
                    { guildId: interaction.guild.id },
                    { newsChannelId: channelId },
                    { upsert: true }
                );
                
                await interaction.reply(`✅ 이 채널(${interaction.channel.name})을 뉴스 채널로 설정했습니다!`);
                break;
        }
    }
};