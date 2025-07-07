const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

// 통일된 미니게임 UI 컴포넌트
const MinigameUI = {
    // 색상 테마
    Colors: {
        PRIMARY: '#4169E1',    // 파란색 - 메인 메뉴, 일반 정보
        SECONDARY: '#9b59b6',  // 보라색 - 대기실, 준비 상태
        SUCCESS: '#00ff00',    // 초록색 - 게임 진행, 성공
        WARNING: '#FFA500',    // 주황색 - 경고, 주의
        DANGER: '#ff0000',     // 빨간색 - 오류, 실패, 취소
        GOLD: '#FFD700',       // 금색 - 보상, 특별 이벤트
        INFO: '#00CED1'        // 청록색 - 정보, 안내
    },

    // 통일된 버튼 스타일 가이드
    ButtonStyles: {
        MAIN_ACTION: ButtonStyle.Primary,    // 주요 액션 (시작, 참가, 플레이)
        POSITIVE: ButtonStyle.Success,        // 긍정적 액션 (준비, 확인)
        NEGATIVE: ButtonStyle.Danger,         // 부정적 액션 (취소, 나가기)
        NAVIGATION: ButtonStyle.Secondary     // 네비게이션 (뒤로, 메뉴, 통계)
    },

    // 메인 메뉴 임베드 생성
    createMainMenuEmbed(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(this.Colors.PRIMARY)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    },

    // 게임 대기실 임베드 생성
    createLobbyEmbed(gameType, gameEmoji, hostName, players, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setColor(this.Colors.SECONDARY)
            .setTitle(`${gameEmoji} ${gameType} 대기실`)
            .setDescription(`호스트: **${hostName}**`)
            .addFields(
                { name: '👥 참가자', value: `${players.length}명`, inline: true },
                { name: '⏱️ 대기 시간', value: '최대 5분', inline: true },
                { name: '🎮 게임 상태', value: '대기 중', inline: true }
            )
            .setTimestamp();

        // 추가 정보가 있으면 필드 추가
        if (additionalInfo.betAmount) {
            embed.addFields({ name: '💰 배팅금', value: `${additionalInfo.betAmount.toLocaleString()}G`, inline: true });
        }
        if (additionalInfo.minPlayers) {
            embed.addFields({ name: '👤 최소 인원', value: `${additionalInfo.minPlayers}명`, inline: true });
        }
        if (additionalInfo.maxPlayers) {
            embed.addFields({ name: '👥 최대 인원', value: `${additionalInfo.maxPlayers}명`, inline: true });
        }

        return embed;
    },

    // 게임 시작 임베드 생성
    createGameStartEmbed(gameType, gameEmoji, players, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setColor(this.Colors.SUCCESS)
            .setTitle(`${gameEmoji} ${gameType} 시작!`)
            .setDescription('게임이 곧 시작됩니다!')
            .addFields(
                { name: '👥 참가자', value: players.map(p => p.name || p.userName).join(', '), inline: false }
            )
            .setTimestamp();

        if (additionalInfo.totalPot) {
            embed.addFields({ name: '💰 총 상금', value: `${additionalInfo.totalPot.toLocaleString()}G`, inline: true });
        }
        if (additionalInfo.rounds) {
            embed.addFields({ name: '🔢 라운드', value: `${additionalInfo.rounds}`, inline: true });
        }

        return embed;
    },

    // 게임 결과 임베드 생성
    createResultEmbed(gameType, gameEmoji, winner, reward, additionalInfo = {}) {
        const embed = new EmbedBuilder()
            .setColor(this.Colors.GOLD)
            .setTitle(`${gameEmoji} ${gameType} 종료!`)
            .setDescription(`🏆 **${winner}** 승리!`)
            .addFields(
                { name: '💰 획득 보상', value: `${reward.toLocaleString()}G`, inline: true }
            )
            .setTimestamp();

        if (additionalInfo.totalRounds) {
            embed.addFields({ name: '🔢 총 라운드', value: `${additionalInfo.totalRounds}`, inline: true });
        }
        if (additionalInfo.gameDuration) {
            embed.addFields({ name: '⏱️ 게임 시간', value: additionalInfo.gameDuration, inline: true });
        }

        return embed;
    },

    // 에러 임베드 생성
    createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor(this.Colors.DANGER)
            .setTitle('❌ 오류 발생')
            .setDescription(message)
            .setTimestamp();
    },

    // 정보 임베드 생성
    createInfoEmbed(title, description, fields = []) {
        const embed = new EmbedBuilder()
            .setColor(this.Colors.INFO)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        return embed;
    },

    // 통일된 게임 설명 포맷
    formatGameDescription(gameInfo) {
        let description = '';
        
        if (gameInfo.description) {
            description += `${gameInfo.description}\n\n`;
        }
        
        if (gameInfo.howToPlay) {
            description += `**🎮 플레이 방법**\n${gameInfo.howToPlay}\n\n`;
        }
        
        if (gameInfo.rules) {
            description += `**📋 게임 규칙**\n${gameInfo.rules}\n\n`;
        }
        
        if (gameInfo.rewards) {
            description += `**🏆 보상**\n${gameInfo.rewards}`;
        }

        return description;
    },

    // 플레이어 통계 필드 생성
    createStatsFields(stats) {
        return [
            { name: '💰 보유 골드', value: `${stats.gold?.toLocaleString() || 0}G`, inline: true },
            { name: '🏆 승률', value: `${stats.winRate || 0}%`, inline: true },
            { name: '🎮 총 게임 수', value: `${stats.totalGames || 0}회`, inline: true }
        ];
    },

    // 표준 버튼 생성 함수들
    createBackButton(customId = 'minigame_menu') {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('뒤로가기')
            .setEmoji('🔙')
            .setStyle(this.ButtonStyles.NAVIGATION);
    },

    createStartButton(customId = 'start_game') {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('시작하기')
            .setEmoji('▶️')
            .setStyle(this.ButtonStyles.MAIN_ACTION);
    },

    createJoinButton(customId = 'join_game') {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('참가하기')
            .setEmoji('➕')
            .setStyle(this.ButtonStyles.POSITIVE);
    },

    createLeaveButton(customId = 'leave_game') {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('나가기')
            .setEmoji('🚪')
            .setStyle(this.ButtonStyles.NEGATIVE);
    },

    createStatsButton(customId = 'view_stats') {
        return new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('통계 보기')
            .setEmoji('📊')
            .setStyle(this.ButtonStyles.NAVIGATION);
    }
};

module.exports = MinigameUI;