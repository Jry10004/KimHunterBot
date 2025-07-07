const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Word = require('../models/Word');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('단어통계')
        .setDescription('단어 데이터베이스 통계를 확인합니다 (관리자 전용)'),
    
    async execute(interaction) {
        // 관리자 확인
        if (!['295980447849250817', '532128778175619084'].includes(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                ephemeral: true 
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // 통계 수집
            const totalWords = await Word.countDocuments();
            const sourceStats = await Word.aggregate([
                { $group: { _id: '$source', count: { $sum: 1 } } }
            ]);
            const lengthStats = await Word.aggregate([
                { $group: { _id: '$length', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);
            const topUsedWords = await Word.find()
                .sort({ usageCount: -1 })
                .limit(10)
                .lean();
            const recentWords = await Word.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
            const hanBangWords = await Word.countDocuments({ isHanBang: true });
            
            // 통계 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle('📊 단어 데이터베이스 통계')
                .setColor('#0099ff')
                .addFields(
                    { 
                        name: '📈 전체 통계', 
                        value: `총 단어 수: **${totalWords.toLocaleString()}개**\n한방 단어: **${hanBangWords}개**`, 
                        inline: false 
                    },
                    { 
                        name: '🔤 출처별 통계', 
                        value: sourceStats.map(s => `${s._id}: ${s.count}개`).join('\n') || '없음', 
                        inline: true 
                    },
                    { 
                        name: '📏 길이별 통계', 
                        value: lengthStats.slice(0, 5).map(l => `${l._id}글자: ${l.count}개`).join('\n'), 
                        inline: true 
                    },
                    { 
                        name: '🔥 가장 많이 사용된 단어 TOP 10', 
                        value: topUsedWords.map((w, i) => `${i+1}. ${w.word} (${w.usageCount}회)`).join('\n') || '없음', 
                        inline: false 
                    },
                    { 
                        name: '🆕 최근 추가된 단어', 
                        value: recentWords.slice(0, 5).map(w => `• ${w.word} (${w.source})`).join('\n') || '없음', 
                        inline: false 
                    }
                )
                .setTimestamp()
                .setFooter({ text: '단어 DB는 게임을 할수록 자동으로 확장됩니다!' });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('단어 통계 오류:', error);
            await interaction.editReply({ 
                content: '❌ 통계를 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }
};