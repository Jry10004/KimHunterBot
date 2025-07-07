// 가위바위보 멀티플레이어 게임 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');

// 게임 설정
const RPS_GAME = {
    multiplayerSettings: {
        entryFee: 1000,  // 참가비
        winnerTakeRate: 0.9,  // 승자가 90% 획득
        maxRounds: 5,  // 최대 라운드
        winCondition: 2  // 2승 시 승리
    },
    ticketRegen: 1000 * 60 * 30  // 30분마다 티켓 재생성
};

// 세션 저장소 (실제로는 global에서 관리)
let rpsMultiplayerSessions = new Map();
let rpsTempChannels = new Map();

// 세션 초기화
function initializeSessions(sessions, tempChannels) {
    rpsMultiplayerSessions = sessions;
    rpsTempChannels = tempChannels;
}

// 게임 시작 임베드 생성 (공통 함수)
function createGameStartEmbed(gameName, hostName, players, options = {}) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🎮 ${gameName} 게임 시작!`)
        .setDescription(`호스트: ${hostName}\n\n참가자:\n${players.map((p, i) => `${i + 1}. ${p.userName}`).join('\n')}`);
    
    if (options.extraFields) {
        embed.addFields(...options.extraFields);
    }
    
    if (options.status) {
        embed.addFields({ name: '📊 상태', value: options.status, inline: false });
    }
    
    if (options.footer) {
        embed.setFooter({ text: options.footer });
    }
    
    embed.setTimestamp();
    return embed;
}

// 가위바위보 멀티플레이어 게임 시작
async function startRpsMultiplayerGame(channel, lobbyId) {
    const session = rpsMultiplayerSessions.get(lobbyId);
    if (!session || session.gameStarted) return;
    
    session.gameStarted = true;
    
    // 각 플레이어 참가비 차감 및 티켓 사용
    for (const [playerId, playerData] of session.players) {
        const user = await User.findOne({ discordId: playerId });
        if (user) {
            user.gold -= RPS_GAME.multiplayerSettings.entryFee;
            user.rpsGameData.userTickets--;
            await user.save();
        }
    }
    
    // 통일된 게임 시작 메시지 사용
    const players = Array.from(session.players.values());
    const startEmbed = createGameStartEmbed(
        '가위바위보',
        session.hostName,
        players,
        {
            status: '게임 진행 중',
            footer: '곧 첫 번째 라운드가 시작됩니다!',
            extraFields: [
                { name: '💎 참가비', value: `${RPS_GAME.multiplayerSettings.entryFee.toLocaleString()}G`, inline: true },
                { name: '🏆 총 상금', value: `${(RPS_GAME.multiplayerSettings.entryFee * players.length).toLocaleString()}G`, inline: true }
            ]
        }
    );
    
    await channel.send({ embeds: [startEmbed] });
    
    // 3초 후 첫 라운드 시작
    setTimeout(() => startRpsRound(channel, lobbyId), 3000);
}

// 가위바위보 라운드 시작
async function startRpsRound(channel, lobbyId) {
    const session = rpsMultiplayerSessions.get(lobbyId);
    if (!session) return;
    
    session.playerChoices.clear();
    
    // 라운드 시작 메시지
    const roundEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`🎮 라운드 ${session.roundNumber}`)
        .setDescription(
            `**현재 스코어**\n` +
            Array.from(session.players.values())
                .map(p => `${p.userName}: ${session.scores.get(p.userId)}승`)
                .join('\n') +
            `\n\n⏱️ **10초** 안에 선택하세요!`
        );
    
    await channel.send({ embeds: [roundEmbed] });
    
    // 3, 2, 1 카운트다운
    for (let i = 3; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await channel.send(`**${i}**...`);
    }
    await channel.send('🎯 **가위바위보!**');
    
    // 선택 버튼 생성
    const choiceButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`rps_multi_choice_${lobbyId}_rock`)
                .setLabel('바위')
                .setEmoji('✊')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`rps_multi_choice_${lobbyId}_scissors`)
                .setLabel('가위')
                .setEmoji('✌️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`rps_multi_choice_${lobbyId}_paper`)
                .setLabel('보')
                .setEmoji('✋')
                .setStyle(ButtonStyle.Primary)
        );
    
    const choiceEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('선택하세요!')
        .setDescription('✊ 바위, ✌️ 가위, ✋ 보 중 하나를 선택하세요!');
    
    await channel.send({
        embeds: [choiceEmbed],
        components: [choiceButtons]
    });
    
    // 10초 타이머
    if (session.roundTimer) {
        clearTimeout(session.roundTimer);
    }
    
    session.roundTimer = setTimeout(() => processRpsRoundEnd(channel, lobbyId), 10000);
}

// 가위바위보 라운드 종료 처리
async function processRpsRoundEnd(channel, lobbyId) {
    const session = rpsMultiplayerSessions.get(lobbyId);
    if (!session) return;
    
    // 타이머 정리
    if (session.roundTimer) {
        clearTimeout(session.roundTimer);
        session.roundTimer = null;
    }
    
    // 선택하지 않은 플레이어는 랜덤 선택
    for (const [playerId, playerData] of session.players) {
        if (!session.playerChoices.has(playerId)) {
            const randomChoice = ['rock', 'scissors', 'paper'][Math.floor(Math.random() * 3)];
            session.playerChoices.set(playerId, randomChoice);
        }
    }
    
    // 결과 계산
    const players = Array.from(session.players.values());
    const player1 = players[0];
    const player2 = players[1];
    
    const choice1 = session.playerChoices.get(player1.userId);
    const choice2 = session.playerChoices.get(player2.userId);
    
    const choiceMap = { 'rock': '✊', 'scissors': '✌️', 'paper': '✋' };
    const choiceNameMap = { 'rock': '바위', 'scissors': '가위', 'paper': '보' };
    
    // 승부 판정
    let winner = null;
    let resultText = '';
    
    if (choice1 === choice2) {
        resultText = '🤝 무승부!';
    } else if (
        (choice1 === 'rock' && choice2 === 'scissors') ||
        (choice1 === 'scissors' && choice2 === 'paper') ||
        (choice1 === 'paper' && choice2 === 'rock')
    ) {
        winner = player1;
        session.scores.set(player1.userId, session.scores.get(player1.userId) + 1);
        resultText = `🎉 **${player1.userName}** 승리!`;
    } else {
        winner = player2;
        session.scores.set(player2.userId, session.scores.get(player2.userId) + 1);
        resultText = `🎉 **${player2.userName}** 승리!`;
    }
    
    // 결과 표시
    const resultEmbed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`라운드 ${session.roundNumber} 결과`)
        .setDescription(
            `**${player1.userName}**: ${choiceMap[choice1]} ${choiceNameMap[choice1]}\n` +
            `**${player2.userName}**: ${choiceMap[choice2]} ${choiceNameMap[choice2]}\n\n` +
            resultText
        )
        .addFields({
            name: '현재 스코어',
            value: `${player1.userName}: ${session.scores.get(player1.userId)}승\n` +
                   `${player2.userName}: ${session.scores.get(player2.userId)}승`
        });
    
    await channel.send({ embeds: [resultEmbed] });
    
    // 게임 종료 확인
    const player1Score = session.scores.get(player1.userId);
    const player2Score = session.scores.get(player2.userId);
    
    // 디버깅 로그
    console.log(`[RPS] 라운드 ${session.roundNumber} 종료 - ${player1.userName}: ${player1Score}, ${player2.userName}: ${player2Score}`);
    
    // 이미 게임이 종료된 경우 추가 처리 방지
    if (session.gameEnded) {
        console.log('[RPS] 게임이 이미 종료됨');
        return;
    }
    
    if (player1Score >= RPS_GAME.multiplayerSettings.winCondition || 
        player2Score >= RPS_GAME.multiplayerSettings.winCondition) {
        // 게임 종료 표시
        session.gameEnded = true;
        // 게임 종료
        await endRpsMultiplayerGame(channel, lobbyId);
    } else if (session.roundNumber >= RPS_GAME.multiplayerSettings.maxRounds) {
        // 최대 라운드 제한 (안전장치)
        console.log('[RPS] 최대 라운드 도달');
        session.gameEnded = true;
        await endRpsMultiplayerGame(channel, lobbyId);
    } else {
        // 다음 라운드
        session.roundNumber++;
        setTimeout(() => startRpsRound(channel, lobbyId), 3000);
    }
}

// 가위바위보 게임 종료
async function endRpsMultiplayerGame(channel, lobbyId) {
    const session = rpsMultiplayerSessions.get(lobbyId);
    if (!session) return;
    
    const players = Array.from(session.players.values());
    const player1 = players[0];
    const player2 = players[1];
    
    const player1Score = session.scores.get(player1.userId);
    const player2Score = session.scores.get(player2.userId);
    
    const winner = player1Score > player2Score ? player1 : player2;
    const loser = winner === player1 ? player2 : player1;
    
    // 보상 계산
    const totalPot = RPS_GAME.multiplayerSettings.entryFee * 2;
    const winnerReward = Math.floor(totalPot * RPS_GAME.multiplayerSettings.winnerTakeRate);
    
    // 데이터베이스 업데이트
    const winnerUser = await User.findOne({ discordId: winner.userId });
    const loserUser = await User.findOne({ discordId: loser.userId });
    
    if (winnerUser) {
        winnerUser.gold += winnerReward;
        winnerUser.rpsGameData.wins++;
        winnerUser.rpsGameData.currentStreak++;
        winnerUser.rpsGameData.bestStreak = Math.max(winnerUser.rpsGameData.bestStreak, winnerUser.rpsGameData.currentStreak);
        winnerUser.rpsGameData.totalWinnings += winnerReward;
        winnerUser.rpsGameData.totalGames++;
        await winnerUser.save();
    }
    
    if (loserUser) {
        loserUser.rpsGameData.losses++;
        loserUser.rpsGameData.currentStreak = 0;
        loserUser.rpsGameData.totalLosses += RPS_GAME.multiplayerSettings.entryFee;
        loserUser.rpsGameData.totalGames++;
        await loserUser.save();
    }
    
    // 최종 결과 표시
    const finalEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 게임 종료!')
        .setDescription(
            `**승자: ${winner.userName}** 🎉\n\n` +
            `최종 스코어:\n` +
            `${player1.userName}: ${player1Score}승\n` +
            `${player2.userName}: ${player2Score}승\n\n` +
            `💰 상금: ${winnerReward.toLocaleString()}G`
        )
        .setFooter({ text: 'GG! 수고하셨습니다!' });
    
    await channel.send({ embeds: [finalEmbed] });
    
    // 임시 채널 정리
    if (session.tempChannel) {
        setTimeout(async () => {
            try {
                await session.tempChannel.send('🍄 10초 후 채널이 삭제됩니다.');
                setTimeout(() => {
                    session.tempChannel.delete().catch(console.error);
                }, 10000);
            } catch (error) {
                console.error('채널 정리 실패:', error);
            }
        }, 5000);
    }
    
    // 세션 정리
    rpsMultiplayerSessions.delete(lobbyId);
    rpsTempChannels.delete(lobbyId);
}

module.exports = {
    RPS_GAME,
    initializeSessions,
    createGameStartEmbed,
    startRpsMultiplayerGame,
    startRpsRound,
    processRpsRoundEnd,
    endRpsMultiplayerGame
};