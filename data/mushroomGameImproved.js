// 🍄 개선된 독버섯 게임 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const MUSHROOM_GAME = require('./mushroomGame');

// 게임 진행 상황을 더 재미있게 만드는 헬퍼 함수들
const gameHelpers = {
    // 라운드별 특별 메시지
    getRoundMessage(round) {
        const messages = {
            1: "🌱 첫 번째 숲 - 초보자의 길",
            2: "🌿 두 번째 숲 - 안개가 자욱한 곳", 
            3: "🌳 세 번째 숲 - 거대한 나무들 사이",
            4: "🌲 네 번째 숲 - 어둠이 내린 깊은 곳",
            5: "🏔️ 마지막 숲 - 전설의 버섯이 자라는 곳"
        };
        return messages[round] || "🍄 신비한 숲";
    },

    // 봇의 생각 메시지
    getBotThinkingMessage(bot) {
        const messages = {
            coward: ["😰 으으... 무서워...", "😨 어떤 걸 골라야 하지?", "😱 실수하면 안 돼..."],
            intuition: ["🎲 운명에 맡기자!", "🎯 직감이 말하길...", "🤔 느낌이 좋은데?"],
            analyst: ["🧐 통계적으로 계산하면...", "📊 확률을 분석해보니...", "🤓 논리적으로 생각하면..."],
            adventurer: ["😎 위험할수록 재밌지!", "🏃 도전해볼까?", "💪 겁날 게 뭐 있어!"]
        };
        const botMessages = messages[bot.strategy] || ["🤔 고민 중..."];
        return botMessages[Math.floor(Math.random() * botMessages.length)];
    },

    // 봇의 선택 반응
    getBotReaction(bot, isPoisonous) {
        const reactions = {
            coward: {
                safe: ["😌 휴... 다행이야", "😅 살았다!", "🥹 무서웠어..."],
                poison: ["😭 역시 난 못해!", "😵 알았어야 했는데...", "💀 으악!"]
            },
            intuition: {
                safe: ["😄 역시 내 직감!", "🎉 운이 좋네!", "✨ 느낌이 맞았어!"],
                poison: ["😵‍💫 운이 나빴네...", "🎲 다음엔 더 잘할게!", "😅 이럴 수도 있지!"]
            },
            analyst: {
                safe: ["🤓 계산대로야!", "📈 예상이 맞았군", "🧮 확률은 거짓말하지 않아"],
                poison: ["😤 계산 실수였나?", "📉 통계의 함정이군...", "🤯 이건 예상 못했어!"]
            },
            adventurer: {
                safe: ["💪 역시 나야!", "🏆 모험은 계속된다!", "😎 쉽네!"],
                poison: ["💥 화려하게 산화!", "🔥 이것도 모험이지!", "😂 재밌었어!"]
            }
        };
        const botReactions = reactions[bot.strategy] || { safe: ["👍"], poison: ["👎"] };
        const reactionList = isPoisonous ? botReactions.poison : botReactions.safe;
        return reactionList[Math.floor(Math.random() * reactionList.length)];
    },

    // 플레이어 격려 메시지
    getEncouragementMessage(round, totalRounds) {
        if (round === 1) return "🌟 좋은 시작이에요!";
        if (round === totalRounds) return "🏆 마지막 라운드! 조금만 더!";
        if (round > totalRounds / 2) return "💪 절반 이상 왔어요!";
        return "✨ 계속 가세요!";
    },

    // 게임 상황 이모지
    getStatusEmoji(mushrooms) {
        const revealed = mushrooms.filter(m => m.revealed).length;
        const total = mushrooms.length;
        const ratio = revealed / total;
        
        if (ratio === 0) return "🌑"; // 시작
        if (ratio < 0.25) return "🌒"; // 초반
        if (ratio < 0.5) return "🌓"; // 중반
        if (ratio < 0.75) return "🌔"; // 후반
        return "🌕"; // 거의 끝
    }
};

// 개선된 봇 대전 함수
async function improvedBotBattle(interaction, session, gameId) {
    const { bot, round, mushrooms, earnings } = session;
    const mushroomInfo = MUSHROOM_GAME.mushroomTypes[session.mushroomType];
    
    // 게임 시작 임베드
    const startEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`${gameHelpers.getRoundMessage(round)}`)
        .setDescription(
            `🎮 **플레이어** VS ${bot.emoji} **${bot.name}**\n\n` +
            `${mushroomInfo.emoji} **${mushroomInfo.name}**들이 자라있습니다!\n` +
            `이 중 **${MUSHROOM_GAME.difficultyByRound[round].poisonCount}개**가 독버섯입니다!\n\n` +
            `💡 **팁**: ${bot.description}`
        )
        .addFields(
            { name: '🎯 현재 라운드', value: `${round}/5`, inline: true },
            { name: '💰 누적 보상', value: `${earnings.toLocaleString()}G`, inline: true },
            { name: '🏆 승리 배율', value: `x${round}`, inline: true }
        )
        .setFooter({ text: gameHelpers.getEncouragementMessage(round, 5) })
        .setImage('attachment://kim_hunting.gif');
    
    const huntingGif = new AttachmentBuilder(
        path.join(__dirname, '..', 'resource', 'kim_hunting.gif'),
        { name: 'kim_hunting.gif' }
    );
    
    console.log(`🍄 improvedBotBattle - currentTurn: ${session.currentTurn}`);
    const buttons = createImprovedMushroomButtons(gameId, mushrooms, session.currentTurn);
    
    return {
        embeds: [startEmbed],
        components: buttons,
        files: [huntingGif]
    };
}

// 개선된 버섯 버튼 생성
function createImprovedMushroomButtons(gameId, mushrooms, turn, isMultiplayer = false) {
    const rows = [];
    const mushroomsPerRow = 4;
    const rowCount = Math.ceil(mushrooms.length / mushroomsPerRow);
    
    for (let i = 0; i < rowCount; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < mushroomsPerRow; j++) {
            const index = i * mushroomsPerRow + j;
            if (index >= mushrooms.length) break;
            
            const mushroom = mushrooms[index];
            let style = ButtonStyle.Secondary;
            let emoji = '🍄';
            let label = `${index + 1}`;
            
            if (mushroom.revealed) {
                style = ButtonStyle.Secondary;
                emoji = mushroom.isPoisonous ? '☠️' : '✨';
                label = mushroom.selectedBy === 'player' ? 'P' : mushroom.selectedBy === 'bot' ? 'B' : '?';
                
                // 이미 선택된 버섯은 비활성화
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`mushroom_revealed_${gameId}_${index}`)
                        .setLabel(label)
                        .setEmoji(emoji)
                        .setStyle(style)
                        .setDisabled(true)
                );
            } else {
                // 멀티플레이어는 항상 활성화, 싱글플레이어는 봇 턴일 때 비활성화
                const disabled = !isMultiplayer && turn === 'bot';
                
                // 멀티플레이어용 customId
                const customId = isMultiplayer 
                    ? `mushroom_multi_select_${gameId}_${index}`
                    : `mushroom_select_${gameId}_${index}`;
                
                // 디버깅: 첫 번째 버튼의 customId 출력
                if (index === 0 && isMultiplayer) {
                    console.log(`🍄 멀티플레이어 버튼 customId: ${customId}`);
                }
                
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(customId)
                        .setLabel(label)
                        .setEmoji(emoji)
                        .setStyle(style)
                        .setDisabled(disabled)
                );
            }
        }
        rows.push(row);
    }
    
    // 게임 정보 버튼 추가
    const infoRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('mushroom_help')
                .setLabel('❓ 도움말')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`mushroom_status_${gameId}`)
                .setLabel(`${gameHelpers.getStatusEmoji(mushrooms)} 진행도`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );
    
    rows.push(infoRow);
    return rows;
}

// 개선된 멀티플레이어 라운드
async function improvedMultiplayerRound(channel, session, lobbyId) {
    const { currentRound, players, totalPot } = session;
    const roundInfo = MUSHROOM_GAME.difficultyByRound[currentRound];
    const alivePlayers = Array.from(players.values()).filter(p => p.isAlive);
    
    // 라운드 시작 메시지
    const roundStartEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`${gameHelpers.getRoundMessage(currentRound)}`)
        .setDescription(
            `🎮 **라운드 ${currentRound} 시작!**\n\n` +
            `${roundInfo.message}\n\n` +
            `⏱️ **15초** 안에 버섯을 선택하세요!\n` +
            `선택하지 않으면 랜덤으로 선택됩니다!`
        )
        .addFields(
            { name: '👥 생존자', value: alivePlayers.map(p => p.userName).join(', '), inline: false },
            { name: '💰 총 상금', value: `${totalPot.toLocaleString()}G`, inline: true },
            { name: '🎯 생존 보너스', value: `${(MUSHROOM_GAME.gameSettings.survivalBonus * currentRound).toLocaleString()}G`, inline: true }
        )
        .setFooter({ text: '🍄 신중하게 선택하세요! 행운을 빕니다!' });
    
    // 카운트다운 메시지
    await channel.send({ embeds: [roundStartEmbed] });
    
    // 3, 2, 1 카운트다운
    for (let i = 3; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await channel.send(`**${i}**... ${i === 1 ? '🍄 시작!' : ''}`);
    }
    
    return roundStartEmbed;
}

// 개선된 봇 선택 애니메이션
async function animateBotChoice(interaction, bot, mushrooms) {
    const thinkingMessage = gameHelpers.getBotThinkingMessage(bot);
    
    // 봇이 고민하는 모습 표시
    const thinkingEmbed = new EmbedBuilder()
        .setColor('#ffff00')
        .setTitle(`${bot.emoji} ${bot.name}의 차례`)
        .setDescription(`💭 ${thinkingMessage}`)
        .setImage('attachment://kim_hunting2.gif');
    
    const thinkingGif = new AttachmentBuilder(
        path.join(__dirname, '..', 'resource', 'kim_hunting2.gif'),
        { name: 'kim_hunting2.gif' }
    );
    
    await interaction.followUp({ 
        embeds: [thinkingEmbed], 
        files: [thinkingGif] 
    });
    
    // 생각하는 애니메이션 (점점점...)
    for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        thinkingEmbed.setDescription(`💭 ${thinkingMessage}${'.'.repeat(i + 1)}`);
        await interaction.editReply({ embeds: [thinkingEmbed] });
    }
    
    return true;
}

// 멀티플레이어 결과 애니메이션
async function showMultiplayerResults(channel, session, results) {
    const { currentRound } = session;
    
    // 결과 집계 중...
    const calculatingEmbed = new EmbedBuilder()
        .setColor('#ffff00')
        .setTitle('🎲 결과 집계 중...')
        .setDescription('누가 살아남았을까요?');
    
    await channel.send({ embeds: [calculatingEmbed] });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 드라마틱한 결과 공개
    let resultText = '';
    const survivors = [];
    const eliminated = [];
    
    for (const result of results) {
        if (result.survived) {
            survivors.push(`✅ **${result.playerName}** - 생존! (+${result.bonus}G)`);
        } else {
            eliminated.push(`❌ **${result.playerName}** - 탈락! ${result.reaction || ''}`);
        }
    }
    
    const resultEmbed = new EmbedBuilder()
        .setColor(eliminated.length > 0 ? '#ff0000' : '#00ff00')
        .setTitle(`🍄 라운드 ${currentRound} 결과`)
        .setDescription(
            eliminated.length > 0 
                ? `${eliminated.join('\n')}\n\n${survivors.join('\n')}`
                : `🎉 모든 플레이어가 생존했습니다!\n\n${survivors.join('\n')}`
        )
        .setFooter({ text: survivors.length > 0 ? '게임은 계속됩니다!' : '게임 종료!' });
    
    await channel.send({ embeds: [resultEmbed] });
    
    return { survivors: survivors.length, eliminated: eliminated.length };
}

module.exports = {
    gameHelpers,
    improvedBotBattle,
    createImprovedMushroomButtons,
    improvedMultiplayerRound,
    animateBotChoice,
    showMultiplayerResults
};