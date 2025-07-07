const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('채널정리')
        .setDescription('대기실 메시지 삭제 및 빈 게임 채널 정리 (관리자 전용)'),
    
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
            const guild = interaction.guild;
            let deletedChannels = 0;
            let cleanedWaitingRooms = 0;
            let deletedMessages = 0;
            
            // 미니게임 카테고리 찾기
            const gameCategories = guild.channels.cache.filter(c => 
                (c.name === '🎮 미니게임' || c.name === 'PVP 경기장') && c.type === 4
            );
            
            for (const category of gameCategories.values()) {
                // 카테고리 내의 모든 채널 확인
                const channels = category.children.cache;
                
                for (const channel of channels.values()) {
                    if (channel.type === 0) { // 텍스트 채널만
                        const channelName = channel.name.toLowerCase();
                        
                        // 대기실 채널인 경우
                        if (channelName.includes('대기실') || channelName.includes('waiting')) {
                            try {
                                // 최근 메시지 가져오기
                                const messages = await channel.messages.fetch({ limit: 100 });
                                
                                // 봇 메시지와 시스템 메시지를 제외한 모든 메시지 삭제
                                const messagesToDelete = messages.filter(msg => 
                                    !msg.author.bot && 
                                    !msg.system && 
                                    (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000 // 14일 이내
                                );
                                
                                if (messagesToDelete.size > 0) {
                                    await channel.bulkDelete(messagesToDelete);
                                    deletedMessages += messagesToDelete.size;
                                    cleanedWaitingRooms++;
                                }
                            } catch (error) {
                                console.error(`대기실 정리 오류 (${channel.name}):`, error);
                            }
                        }
                        
                        // 게임 채널인 경우 (대기실 제외)
                        else if (
                            channelName.includes('독버섯') || 
                            channelName.includes('슬롯머신') ||
                            channelName.includes('가위바위보') ||
                            channelName.includes('초성게임') ||
                            channelName.includes('끝말잇기') ||
                            channelName.includes('-vs-') ||
                            channelName.includes('몬스터배틀') ||
                            channelName.includes('홀짝')
                        ) {
                            try {
                                // 채널 생성된 지 30분 이상 경과했는지 확인
                                const channelAge = Date.now() - channel.createdTimestamp;
                                if (channelAge > 30 * 60 * 1000) { // 30분
                                    // 최근 5분 내에 메시지가 있는지 확인
                                    const recentMessages = await channel.messages.fetch({ limit: 1 });
                                    const lastMessage = recentMessages.first();
                                    
                                    if (!lastMessage || (Date.now() - lastMessage.createdTimestamp) > 5 * 60 * 1000) {
                                        // 채널에 아무도 없거나 5분 이상 활동이 없으면 삭제
                                        await channel.delete('비활성 게임 채널 자동 정리');
                                        deletedChannels++;
                                    }
                                }
                            } catch (error) {
                                console.error(`채널 삭제 오류 (${channel.name}):`, error);
                            }
                        }
                    }
                }
            }
            
            // 결과 메시지
            let resultMessage = '🧹 **채널 정리 완료!**\n\n';
            
            if (cleanedWaitingRooms > 0) {
                resultMessage += `✅ ${cleanedWaitingRooms}개 대기실에서 ${deletedMessages}개 메시지 삭제\n`;
            }
            
            if (deletedChannels > 0) {
                resultMessage += `✅ ${deletedChannels}개 비활성 게임 채널 삭제\n`;
            }
            
            if (cleanedWaitingRooms === 0 && deletedChannels === 0) {
                resultMessage += '정리할 채널이 없습니다.';
            }
            
            await interaction.editReply({ content: resultMessage });
            
        } catch (error) {
            console.error('채널 정리 오류:', error);
            await interaction.editReply({ 
                content: '❌ 채널 정리 중 오류가 발생했습니다.' 
            });
        }
    }
};