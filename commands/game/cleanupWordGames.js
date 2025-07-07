const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('워드게임정리')
        .setDescription('멈춰있는 워드게임 세션을 정리합니다'),
    
    async execute(interaction) {
        // 관리자 권한 확인
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // wordGames 핸들러 가져오기
            const wordGamesHandler = require('../handlers/minigames/wordGames.js');
            const wordGames = wordGamesHandler.wordGamesSystem;
            
            if (!wordGames) {
                return interaction.editReply('❌ 워드게임 시스템을 찾을 수 없습니다.');
            }

            const beforeCount = wordGames.sessions.size;
            
            // 모든 세션 정리
            for (const [sessionId, session] of wordGames.sessions.entries()) {
                console.log(`[워드게임 정리] 세션 제거: ${sessionId}`);
                
                // 채널이 있으면 삭제
                if (session.channel || session.waitingChannel) {
                    const channelToDelete = session.channel || session.waitingChannel;
                    try {
                        await channelToDelete.delete('관리자 명령어로 정리');
                    } catch (error) {
                        console.error('채널 삭제 실패:', error);
                    }
                }
                
                // 플레이어 대기열 정리
                if (session.players) {
                    const playerArray = session.players instanceof Map ? 
                        Array.from(session.players.values()) : session.players;
                    playerArray.forEach(player => {
                        wordGames.queues.delete(player.id);
                    });
                }
            }
            
            // 모든 세션 삭제
            wordGames.sessions.clear();
            wordGames.queues.clear();
            
            await interaction.editReply({
                content: `✅ 워드게임 세션 정리 완료!\n- 정리된 세션: ${beforeCount}개\n- 남은 세션: 0개`
            });

        } catch (error) {
            console.error('워드게임 정리 오류:', error);
            await interaction.editReply('❌ 세션 정리 중 오류가 발생했습니다.');
        }
    }
};