const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Popularity = require('../models/Popularity');
const User = require('../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('인기도랭킹')
        .setDescription('인기도 랭킹을 확인합니다')
        .addStringOption(option =>
            option.setName('기간')
                .setDescription('랭킹 기간')
                .addChoices(
                    { name: '주간', value: 'weekly' },
                    { name: '전체', value: 'total' }
                )
                .setRequired(false)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const period = interaction.options.getString('기간') || 'weekly';
        const isWeekly = period === 'weekly';
        
        // 랭킹 조회
        const sortField = isWeekly ? 'weeklyLikes' : 'totalLikes';
        const rankings = await Popularity.find({})
            .sort({ [sortField]: -1, totalLikes: -1 })
            .limit(10);
        
        if (rankings.length === 0) {
            return await interaction.editReply('📊 아직 인기도 데이터가 없습니다!');
        }
        
        // 현재 유저의 순위 찾기
        const userId = interaction.user.id;
        let userRank = null;
        let userData = null;
        
        const userPopularity = await Popularity.findOne({ userId });
        if (userPopularity) {
            const count = await Popularity.countDocuments({
                [sortField]: { $gt: userPopularity[sortField] }
            });
            userRank = count + 1;
            userData = userPopularity;
        }
        
        // 랭킹 임베드 생성
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`💖 인기도 랭킹 - ${isWeekly ? '주간' : '전체'}`)
            .setDescription(isWeekly ? 
                '이번 주 가장 많은 좋아요를 받은 유저들입니다!' :
                '전체 기간 동안 가장 많은 좋아요를 받은 유저들입니다!')
            .setTimestamp();
        
        // 랭킹 표시
        const rankEmojis = ['🥇', '🥈', '🥉'];
        let rankingText = '';
        
        for (let i = 0; i < rankings.length; i++) {
            const rank = rankings[i];
            const emoji = rankEmojis[i] || `**${i + 1}.**`;
            const likes = isWeekly ? rank.weeklyLikes : rank.totalLikes;
            const crown = rank.hasTitle ? ' 👑' : '';
            
            rankingText += `${emoji} ${rank.nickname}${crown}\n`;
            rankingText += `ㄴ 💖 ${likes}개`;
            
            if (isWeekly && rank.totalLikes > 0) {
                rankingText += ` (전체: ${rank.totalLikes}개)`;
            }
            
            rankingText += '\n\n';
        }
        
        embed.addFields({
            name: '🏆 TOP 10',
            value: rankingText || '데이터 없음',
            inline: false
        });
        
        // 현재 유저 정보
        if (userRank && userData) {
            const myLikes = isWeekly ? userData.weeklyLikes : userData.totalLikes;
            embed.addFields({
                name: '📍 내 순위',
                value: `**${userRank}위** - 💖 ${myLikes}개`,
                inline: false
            });
        }
        
        // 인기왕 정보
        if (isWeekly && rankings.length > 0 && rankings[0].hasTitle) {
            embed.addFields({
                name: '👑 현재 인기왕',
                value: `**${rankings[0].nickname}**님이 인기왕 칭호를 보유중입니다!`,
                inline: false
            });
        }
        
        // 버튼 추가
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(isWeekly ? 'popularity_total' : 'popularity_weekly')
                    .setLabel(isWeekly ? '전체 랭킹' : '주간 랭킹')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(isWeekly ? '📊' : '📅'),
                new ButtonBuilder()
                    .setCustomId('popularity_stats')
                    .setLabel('내 통계')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📈')
            );
        
        // 다음 초기화 시간 (월요일 00:00)
        if (isWeekly) {
            const now = new Date();
            const nextMonday = new Date();
            const dayOfWeek = now.getDay();
            const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
            
            nextMonday.setDate(now.getDate() + daysUntilMonday);
            nextMonday.setHours(0, 0, 0, 0);
            
            const timeLeft = nextMonday.getTime() - now.getTime();
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            embed.setFooter({ 
                text: `⏰ 주간 랭킹 초기화까지: ${days}일 ${hours}시간` 
            });
        }
        
        await interaction.editReply({ embeds: [embed], components: [buttons] });
    }
};