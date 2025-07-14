const { EmbedBuilder } = require('discord.js');

const RESULT_CHANNEL_ID = '1393529431271673997';

class GameResultManager {
    constructor(client) {
        this.client = client;
        this.resultChannel = null;
    }

    // 결과 채널 가져오기
    async getResultChannel() {
        if (!this.resultChannel || this.resultChannel.deleted) {
            try {
                this.resultChannel = await this.client.channels.fetch(RESULT_CHANNEL_ID);
            } catch (error) {
                console.error('[GameResultManager] 결과 채널을 찾을 수 없습니다:', error);
                return null;
            }
        }
        return this.resultChannel;
    }

    // 미니게임 결과 전송
    async sendMinigameResult(gameType, winner, loser, gameData = {}) {
        const channel = await this.getResultChannel();
        if (!channel) return;

        const gameTypeKorean = {
            'tictactoe': '틱택토',
            'rockpaperscissors': '가위바위보',
            'wordchain': '끝말잇기',
            'mushroom': '독버섯 찾기',
            'slotmachine': '슬롯머신'
        };

        const gameName = gameTypeKorean[gameType] || gameType;
        const { reward = 0, streak = 0, special = '' } = gameData;

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`🎮 ${gameName} 게임 결과`)
            .setDescription(`**${winner.nickname}**님이 **${loser.nickname || loser.name}**님을 상대로 승리했습니다!`)
            .addFields(
                { name: '🏆 승자', value: winner.nickname, inline: true },
                { name: '💀 패자', value: loser.nickname || loser.name, inline: true }
            )
            .setTimestamp();

        if (reward > 0) {
            embed.addFields({ name: '💰 보상', value: `${reward.toLocaleString()}G`, inline: true });
        }

        if (streak > 0) {
            embed.addFields({ name: '🔥 연승', value: `${streak}연승`, inline: true });
        }

        if (special) {
            embed.addFields({ name: '✨ 특별 이벤트', value: special, inline: false });
        }

        // 게임별 특수 정보
        if (gameType === 'tictactoe' && gameData.board) {
            embed.addFields({ name: '📋 최종 게임판', value: this.formatTicTacToeBoard(gameData.board), inline: false });
        }

        if (gameType === 'mushroom' && gameData.totalMushrooms) {
            embed.addFields({ 
                name: '🍄 게임 정보', 
                value: `총 버섯: ${gameData.totalMushrooms}개\n독버섯: ${gameData.poisonMushrooms}개`, 
                inline: true 
            });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[GameResultManager] 미니게임 결과 전송 실패:', error);
        }
    }

    // PVP 결과 전송
    async sendPVPResult(winner, loser, pvpData = {}) {
        const channel = await this.getResultChannel();
        if (!channel) return;

        const { 
            winnerRatingChange = 0, 
            loserRatingChange = 0,
            winnerNewRating = 1000,
            loserNewRating = 1000,
            totalDamage = 0,
            rounds = 0
        } = pvpData;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚔️ PVP 대전 결과')
            .setDescription(`**${winner.nickname}**님이 **${loser.nickname}**님을 격파했습니다!`)
            .addFields(
                { 
                    name: '🏆 승자', 
                    value: `${winner.nickname}\n레이팅: ${winnerNewRating} (${winnerRatingChange > 0 ? '+' : ''}${winnerRatingChange})`, 
                    inline: true 
                },
                { 
                    name: '💀 패자', 
                    value: `${loser.nickname}\n레이팅: ${loserNewRating} (${loserRatingChange})`, 
                    inline: true 
                }
            )
            .setTimestamp();

        if (rounds > 0) {
            embed.addFields({ name: '⚔️ 전투 정보', value: `라운드: ${rounds}회\n총 데미지: ${totalDamage}`, inline: false });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[GameResultManager] PVP 결과 전송 실패:', error);
        }
    }

    // 사냥 결과 전송 (대형 사냥/보스만)
    async sendHuntingResult(user, monsterData = {}) {
        const channel = await this.getResultChannel();
        if (!channel) return;

        const { 
            monsterName = '알 수 없는 몬스터',
            areaName = '알 수 없는 지역',
            gold = 0,
            exp = 0,
            items = [],
            isBoss = false,
            isRare = false
        } = monsterData;

        // 일반 몬스터는 전송하지 않음
        if (!isBoss && !isRare) return;

        const embed = new EmbedBuilder()
            .setColor(isBoss ? '#FFD700' : '#9B59B6')
            .setTitle(isBoss ? '👹 보스 사냥 성공!' : '✨ 희귀 몬스터 사냥!')
            .setDescription(`**${user.nickname}**님이 **${areaName}**에서 **${monsterName}**을(를) 처치했습니다!`)
            .addFields(
                { name: '🏹 사냥꾼', value: user.nickname, inline: true },
                { name: '💰 골드', value: `${gold.toLocaleString()}G`, inline: true },
                { name: '⭐ 경험치', value: `${exp.toLocaleString()} EXP`, inline: true }
            )
            .setTimestamp();

        if (items.length > 0) {
            embed.addFields({ 
                name: '🎁 획득 아이템', 
                value: items.map(item => `• ${item.name}`).join('\n'), 
                inline: false 
            });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[GameResultManager] 사냥 결과 전송 실패:', error);
        }
    }

    // 던전 클리어 결과 전송
    async sendDungeonResult(user, dungeonData = {}) {
        const channel = await this.getResultChannel();
        if (!channel) return;

        const {
            dungeonName = '알 수 없는 던전',
            floorsCleared = 0,
            totalFloors = 0,
            gold = 0,
            exp = 0,
            items = [],
            clearTime = 0
        } = dungeonData;

        const minutes = Math.floor(clearTime / 60);
        const seconds = clearTime % 60;

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🏰 던전 클리어!')
            .setDescription(`**${user.nickname}**님이 **${dungeonName}**을(를) 정복했습니다!`)
            .addFields(
                { name: '🗡️ 도전자', value: user.nickname, inline: true },
                { name: '📊 진행도', value: `${floorsCleared}/${totalFloors}층`, inline: true },
                { name: '⏱️ 소요 시간', value: `${minutes}분 ${seconds}초`, inline: true },
                { name: '💰 총 골드', value: `${gold.toLocaleString()}G`, inline: true },
                { name: '⭐ 총 경험치', value: `${exp.toLocaleString()} EXP`, inline: true }
            )
            .setTimestamp();

        if (items.length > 0) {
            embed.addFields({ 
                name: '🎁 획득 아이템', 
                value: items.slice(0, 5).map(item => `• ${item.name}`).join('\n') + (items.length > 5 ? `\n... 외 ${items.length - 5}개` : ''), 
                inline: false 
            });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[GameResultManager] 던전 결과 전송 실패:', error);
        }
    }

    // 틱택토 보드 포맷팅
    formatTicTacToeBoard(board) {
        const symbols = { 1: '❌', 2: '⭕', 0: '⬜' };
        let result = '';
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                result += symbols[board[i][j]] || '⬜';
            }
            result += '\n';
        }
        return result;
    }

    // 강화 성공 결과 전송 (높은 등급만)
    async sendEnhanceResult(user, enhanceData = {}) {
        const channel = await this.getResultChannel();
        if (!channel) return;

        const {
            itemName = '알 수 없는 아이템',
            beforeLevel = 0,
            afterLevel = 0,
            cost = 0
        } = enhanceData;

        // +10 이상만 전송
        if (afterLevel < 10) return;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('⚒️ 강화 대성공!')
            .setDescription(`**${user.nickname}**님이 **${itemName}** 강화에 성공했습니다!`)
            .addFields(
                { name: '👤 강화자', value: user.nickname, inline: true },
                { name: '📈 강화 결과', value: `+${beforeLevel} → +${afterLevel}`, inline: true },
                { name: '💰 소모 골드', value: `${cost.toLocaleString()}G`, inline: true }
            )
            .setTimestamp();

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[GameResultManager] 강화 결과 전송 실패:', error);
        }
    }
}

// 싱글톤 인스턴스
let instance = null;

module.exports = {
    initialize: (client) => {
        if (!instance) {
            instance = new GameResultManager(client);
        }
        return instance;
    },
    getInstance: () => {
        if (!instance) {
            throw new Error('GameResultManager가 초기화되지 않았습니다. 먼저 initialize()를 호출하세요.');
        }
        return instance;
    }
};