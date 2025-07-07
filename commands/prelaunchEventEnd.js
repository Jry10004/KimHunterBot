const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('사전강화종료')
        .setDescription('사전강화 이벤트 종료를 공지합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 권한 확인
        const adminIds = ['424480594542592009', '295980447849250817', '532128778175619084'];
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!',
                ephemeral: true
            });
        }
        
        await interaction.deferReply();
        
        // 사전강화 데이터가 없으면 종료
        if (!global.prelaunchEventData) {
            return await interaction.editReply('❌ 사전강화 이벤트 데이터가 없습니다.');
        }
        
        // 유저별 포인트로 정렬
        const rankings = Object.entries(global.prelaunchEventData)
            .map(([userId, data]) => ({
                userId,
                nickname: data.nickname || '알 수 없음',
                points: data.points || 0,
                level: data.currentLevel || 0,
                item: data.currentItem || '없음'
            }))
            .sort((a, b) => b.points - a.points);
        
        // 결과 임베드 생성
        const resultEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎊 사전강화 이벤트 종료!')
            .setDescription('모든 참가자 여러분 수고하셨습니다!')
            .setTimestamp();
        
        // 최종 순위 표시
        let rankingText = '';
        for (let i = 0; i < Math.min(10, rankings.length); i++) {
            const user = rankings[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}**`;
            rankingText += `${medal} ${user.nickname} - ${user.points.toLocaleString()}P (${user.item} +${user.level})\n`;
        }
        
        resultEmbed.addFields({
            name: '🏅 사전강화 이벤트 최종 순위',
            value: rankingText || '참가자 없음',
            inline: false
        });
        
        resultEmbed.addFields({
            name: '🏆 최종 순위 보상 (2배 상향!)',
            value: '🥇 **1등**: 스타벅스 아메리카노 + 40만골드\n🥈 **2등**: 300,000 골드\n🥉 **3등**: 200,000 골드\n🎖️ **4~10등**: 100,000 골드',
            inline: false
        });
        
        resultEmbed.addFields({
            name: '📢 안내사항',
            value: '• 서버 오픈 후 `/회원가입` 명령어로 가입하시면 사전강화 데이터가 자동 연동됩니다!\n• 보상은 관리자가 확인 후 지급 예정입니다.',
            inline: false
        });
        
        // 이벤트 종료 플래그 설정
        global.prelaunchEventEnded = true;
        
        await interaction.editReply({ embeds: [resultEmbed] });
        
        // 전체 채널에 공지
        const channel = interaction.channel;
        await channel.send({
            content: '@everyone',
            embeds: [resultEmbed]
        });
    }
};