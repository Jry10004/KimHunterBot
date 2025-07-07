const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const newsSystem = require('../systems/newsSystem');
const externalNewsAdapter = require('../systems/externalNewsAdapter');
const { COMPANIES } = require('../data/companiesData');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('뉴스테스트')
        .setDescription('뉴스 시스템을 테스트합니다 (관리자 전용)')
        .addStringOption(option =>
            option.setName('유형')
                .setDescription('테스트할 뉴스 유형')
                .setRequired(true)
                .addChoices(
                    { name: '아침 뉴스', value: 'morning' },
                    { name: '저녁 뉴스', value: 'evening' },
                    { name: '심야 뉴스', value: 'night' },
                    { name: '속보 테스트', value: 'breaking' },
                    { name: '실제 뉴스 API', value: 'realapi' },
                    { name: '텍스트 변환', value: 'transform' },
                    { name: '주식 영향', value: 'stockimpact' }
                ))
        .addStringOption(option =>
            option.setName('텍스트')
                .setDescription('변환 테스트용 텍스트 (텍스트 변환 유형에서만 사용)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        
        const type = interaction.options.getString('유형');
        const testText = interaction.options.getString('텍스트');
        
        // 실제 뉴스 API 테스트
        if (type === 'realapi') {
            return await testRealNewsAPI(interaction);
        }
        
        // 텍스트 변환 테스트
        if (type === 'transform') {
            if (!testText) {
                return await interaction.editReply({
                    content: '❌ 텍스트 변환 테스트를 위해서는 텍스트를 입력해주세요!'
                });
            }
            return await testTextTransform(interaction, testText);
        }
        
        // 주식 영향 테스트
        if (type === 'stockimpact') {
            return await testStockImpact(interaction);
        }
        
        // 기존 뉴스 시스템 테스트
        if (newsSystem.newsChannels.size === 0) {
            return await interaction.editReply({
                content: '❌ 먼저 `/뉴스채널설정` 명령어로 뉴스 채널을 설정해주세요!'
            });
        }
        
        if (type === 'breaking') {
            // 속보 테스트
            const testNews = {
                id: Date.now().toString(),
                type: 'test',
                category: 'SPECIAL',
                content: '🧪 [테스트] 이것은 뉴스 시스템 테스트 속보입니다!',
                timestamp: new Date(),
                isBreaking: true
            };
            
            newsSystem.breakingNews.push(testNews);
            await newsSystem.publishBreakingNews(testNews);
            
            await interaction.editReply({
                content: '✅ 속보 테스트를 발송했습니다!'
            });
        } else {
            // 정기 뉴스 테스트
            await newsSystem.generateScheduledNews(type);
            
            const newsName = {
                morning: '아침 뉴스',
                evening: '저녁 뉴스',
                night: '심야 뉴스'
            };
            
            await interaction.editReply({
                content: `✅ ${newsName[type]} 테스트를 발송했습니다!`
            });
        }
    }
};

// 실제 뉴스 API 테스트
async function testRealNewsAPI(interaction) {
    try {
        // 실제 뉴스 가져오기
        const externalNews = await externalNewsAdapter.fetchExternalNews();
        
        if (externalNews.length === 0) {
            return await interaction.editReply({
                content: '❌ 뉴스를 가져올 수 없습니다. API 키를 확인해주세요.'
            });
        }

        // 활성 유저 가져오기
        const activeUsers = await User.find({ registered: true }).limit(10);
        
        // 게임 뉴스로 변환
        const gameNews = await externalNewsAdapter.convertToGameNews(activeUsers);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📰 실제 뉴스 → 게임 뉴스 변환 테스트')
            .setDescription('실제 뉴스 API에서 가져온 뉴스를 게임 내 뉴스로 변환')
            .setTimestamp();

        // 최대 3개의 뉴스만 표시
        const newsToShow = Math.min(3, externalNews.length);
        
        for (let i = 0; i < newsToShow; i++) {
            const original = externalNews[i];
            const converted = gameNews[i];
            
            embed.addFields({
                name: `📰 뉴스 ${i + 1}`,
                value: `**[원본]**\n${original.title}\n\n**[변환]**\n${converted.content}\n\n**대상 기업**: ${converted.company} (${converted.companyId})\n**영향**: ${(converted.impact.impact * 100).toFixed(1)}%`,
                inline: false
            });
        }

        embed.addFields({
            name: '📊 API 정보',
            value: `총 ${externalNews.length}개 뉴스 가져옴\n변환된 뉴스: ${gameNews.length}개\nAPI 키: ${process.env.NEWS_API_KEY ? '설정됨' : '없음'}`,
            inline: false
        });

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        console.error('[뉴스 API 테스트] 오류:', error);
        await interaction.editReply({
            content: `❌ API 테스트 중 오류 발생: ${error.message}`
        });
    }
}

// 텍스트 변환 테스트
async function testTextTransform(interaction, text) {
    try {
        // 더미 유저
        const dummyUsers = [
            { nickname: '김모험가' },
            { nickname: '이전사' },
            { nickname: '박마법사' }
        ];
        
        const { transformed, matchedCompany, companyId } = externalNewsAdapter.transformText(text, dummyUsers);
        const sentiment = externalNewsAdapter.analyzeSentiment(text);
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🔄 텍스트 변환 테스트')
            .addFields(
                { name: '원본 텍스트', value: text.substring(0, 1024), inline: false },
                { name: '변환된 텍스트', value: transformed.substring(0, 1024), inline: false },
                { name: '매칭된 기업', value: matchedCompany ? `${matchedCompany} (${companyId})` : '없음', inline: true },
                { name: '감정 분석', value: `점수: ${sentiment}\n${sentiment > 0 ? '긍정적' : sentiment < 0 ? '부정적' : '중립'}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        console.error('[텍스트 변환 테스트] 오류:', error);
        await interaction.editReply({
            content: `❌ 텍스트 변환 중 오류 발생: ${error.message}`
        });
    }
}

// 주식 영향 테스트
async function testStockImpact(interaction) {
    try {
        // 실제 뉴스 가져오기
        const activeUsers = await User.find({ registered: true }).limit(5);
        const gameNews = await externalNewsAdapter.convertToGameNews(activeUsers);
        
        if (gameNews.length === 0) {
            return await interaction.editReply({
                content: '❌ 변환된 뉴스가 없습니다.'
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('📈 뉴스의 주식 영향 테스트')
            .setDescription('실제 뉴스가 주식 시장에 미치는 영향 시뮬레이션')
            .setTimestamp();

        // 각 뉴스의 영향 계산
        for (const news of gameNews.slice(0, 5)) {
            const company = COMPANIES[news.companyId];
            if (!company) continue;
            
            const oldPrice = company.currentPrice;
            const newPrice = Math.floor(oldPrice * (1 + news.impact.impact));
            const priceChange = newPrice - oldPrice;
            
            embed.addFields({
                name: `📰 ${news.content.substring(0, 60)}...`,
                value: [
                    `**기업**: ${company.emoji} ${company.name}`,
                    `**현재가**: ${oldPrice.toLocaleString()}G → ${newPrice.toLocaleString()}G`,
                    `**변동**: ${priceChange >= 0 ? '+' : ''}${priceChange.toLocaleString()}G (${(news.impact.impact * 100).toFixed(1)}%)`,
                    `**카테고리**: ${news.category}`
                ].join('\n'),
                inline: false
            });
        }

        // 실제로 주가를 변경하지는 않음 (테스트이므로)
        embed.setFooter({ text: '⚠️ 테스트 모드 - 실제 주가는 변경되지 않았습니다' });

        await interaction.editReply({
            embeds: [embed]
        });
    } catch (error) {
        console.error('[주식 영향 테스트] 오류:', error);
        await interaction.editReply({
            content: `❌ 주식 영향 테스트 중 오류 발생: ${error.message}`
        });
    }
};