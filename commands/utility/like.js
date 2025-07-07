const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const Popularity = require('../models/Popularity');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('좋아요')
        .setDescription('다른 유저에게 좋아요를 보냅니다')
        .addUserOption(option =>
            option.setName('유저')
                .setDescription('좋아요를 보낼 유저')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const giver = interaction.user;
        const receiver = interaction.options.getUser('유저');
        
        // 자기 자신에게 좋아요 방지
        if (giver.id === receiver.id) {
            return await interaction.editReply('❌ 자기 자신에게는 좋아요를 보낼 수 없습니다!');
        }
        
        // 봇에게 좋아요 방지
        if (receiver.bot) {
            return await interaction.editReply('❌ 봇에게는 좋아요를 보낼 수 없습니다!');
        }
        
        // 유저 확인
        const targetUser = await User.findOne({ discordId: receiver.id });
        if (!targetUser || !targetUser.registered) {
            return await interaction.editReply('❌ 해당 유저는 게임에 가입하지 않았습니다!');
        }
        
        // 오늘 날짜 (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];
        
        // 좋아요 주는 사람의 인기도 데이터
        let giverPopularity = await Popularity.findOne({ userId: giver.id });
        if (!giverPopularity) {
            giverPopularity = new Popularity({
                userId: giver.id,
                nickname: giver.username,
                dailyGiven: { date: today, users: [] }
            });
        }
        
        // 일일 제한 체크
        if (giverPopularity.dailyGiven.date !== today) {
            // 날짜가 바뀌었으면 초기화
            giverPopularity.dailyGiven = { date: today, users: [] };
        }
        
        // 이미 오늘 이 유저에게 좋아요를 줬는지 체크
        if (giverPopularity.dailyGiven.users.includes(receiver.id)) {
            return await interaction.editReply('❌ 오늘 이미 이 유저에게 좋아요를 보냈습니다!');
        }
        
        // 좋아요 받는 사람의 인기도 데이터
        let receiverPopularity = await Popularity.findOne({ userId: receiver.id });
        if (!receiverPopularity) {
            receiverPopularity = new Popularity({
                userId: receiver.id,
                nickname: targetUser.nickname || receiver.username
            });
        }
        
        // 좋아요 처리
        const now = new Date();
        
        // 주는 사람 업데이트
        giverPopularity.dailyGiven.users.push(receiver.id);
        giverPopularity.givenLikes.push({
            targetUserId: receiver.id,
            date: now
        });
        
        // 받는 사람 업데이트
        receiverPopularity.totalLikes += 1;
        receiverPopularity.weeklyLikes += 1;
        receiverPopularity.receivedLikes.push({
            fromUserId: giver.id,
            date: now
        });
        
        // 최고 주간 좋아요 기록 갱신
        if (receiverPopularity.weeklyLikes > receiverPopularity.statistics.peakWeeklyLikes) {
            receiverPopularity.statistics.peakWeeklyLikes = receiverPopularity.weeklyLikes;
        }
        
        // 저장
        await giverPopularity.save();
        await receiverPopularity.save();
        
        // 결과 임베드
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('💖 좋아요 전송!')
            .setDescription(`<@${giver.id}>님이 <@${receiver.id}>님에게 좋아요를 보냈습니다!`)
            .addFields(
                {
                    name: '📊 받은 사람 현황',
                    value: `총 좋아요: **${receiverPopularity.totalLikes}**개\n` +
                           `이번 주: **${receiverPopularity.weeklyLikes}**개`,
                    inline: true
                },
                {
                    name: '🎯 오늘 보낸 좋아요',
                    value: `${giverPopularity.dailyGiven.users.length}명에게 전송`,
                    inline: true
                }
            )
            .setFooter({ text: '매일 각 유저에게 1번씩만 좋아요를 보낼 수 있습니다!' })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        // 공개 채널에도 알림 (선택사항)
        try {
            const publicEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setDescription(`💖 <@${giver.id}>님이 <@${receiver.id}>님에게 좋아요를 보냈습니다!`)
                .setFooter({ text: `${targetUser.nickname}님의 인기도 +1` });
            
            await interaction.followUp({ embeds: [publicEmbed] });
        } catch (error) {
            // 공개 메시지 실패 시 무시
        }
    }
};