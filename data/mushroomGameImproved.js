// 🍄 독버섯 게임 개선된 시스템
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

const gameHelpers = {
    getRoundMessage(round) {
        const messages = [
            '🌱 첫 번째 도전!',
            '🌿 두 번째 도전!',
            '🌳 세 번째 도전!',
            '🌲 네 번째 도전!',
            '🏔️ 마지막 도전!'
        ];
        return messages[round - 1] || `라운드 ${round}`;
    },
    
    getStatusEmoji(mushrooms) {
        return mushrooms.map(m => m.revealed ? (m.isPoisonous ? '💀' : '✅') : '❓').join(' ');
    },
    
    getActiveEffects(session) {
        const effects = [];
        if (session.currentRound >= 3) effects.push('🔥 연속 보너스');
        if (session.totalPot > 10000) effects.push('💰 고액 상금');
        return effects.length > 0 ? effects.join(' | ') : '없음';
    }
};

async function improvedBotBattle(interaction, session, gameId) {
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`🍄 라운드 ${session.currentRound} - 봇 대전`)
        .setDescription(`${session.bot.emoji} **${session.bot.name}**과(와)의 대결!`)
        .addFields(
            { name: '👤 플레이어', value: session.userName, inline: true },
            { name: '🤖 봇', value: session.bot.name, inline: true },
            { name: '💰 누적 보상', value: `${session.totalReward}G`, inline: true }
        );
    
    const buttons = createImprovedMushroomButtons(gameId, session.mushrooms, 'player');
    
    return {
        embeds: [embed],
        components: buttons
    };
}

function createImprovedMushroomButtons(gameId, mushrooms, playerType, isMultiplayer = false) {
    const rows = [];
    const buttonsPerRow = 4;
    const totalButtons = 12; // 항상 12개로 고정
    
    // 정확히 3줄 생성 (4개씩)
    for (let i = 0; i < totalButtons; i += buttonsPerRow) {
        const row = new ActionRowBuilder();
        
        for (let j = i; j < Math.min(i + buttonsPerRow, totalButtons); j++) {
            const mushroom = mushrooms && mushrooms[j] ? mushrooms[j] : null;
            let emoji = '🍄';
            let disabled = false;
            
            if (mushroom && mushroom.revealed) {
                emoji = mushroom.isPoisonous ? '💀' : '✅';
                disabled = true;
            }
            
            const customId = isMultiplayer 
                ? `mushroom_multi_select_${gameId}_${j}`
                : `mushroom_select_${gameId}_${j}`;
            
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(customId)
                    .setLabel(`${j + 1}`)
                    .setEmoji(emoji)
                    .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
                    .setDisabled(disabled)
            );
        }
        
        rows.push(row);
    }
    
    // 항상 3개의 ActionRow만 반환
    return rows.slice(0, 3);
}

function improvedMultiplayerRound(session) {
    // Multiplayer round improvements
    return {
        roundInfo: `라운드 ${session.currentRound}`,
        playerCount: session.players.size,
        totalPot: session.totalPot
    };
}

function animateBotChoice(botName, choice) {
    return `${botName}이(가) ${choice}번 버섯을 선택하는 중...`;
}

function showMultiplayerResults(results) {
    const embed = new EmbedBuilder()
        .setTitle('🍄 라운드 결과')
        .setDescription(results.description || '결과 없음')
        .setColor('#ff9900');
    
    return embed;
}

// 멀티플레이어용 통합 게임 시작 메시지
function createGameStartEmbed(gameType, hostName, players, options = {}) {
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🎮 ${gameType} 게임 시작!`)
        .setDescription(`호스트: ${hostName}\n\n${options.status || '게임이 곧 시작됩니다!'}`)
        .setFooter({ text: options.footer || '준비하세요!' });
    
    if (players && players.length > 0) {
        embed.addFields({
            name: '👥 참가자',
            value: players.map((p, i) => `${i + 1}. ${p.userName || p.name}`).join('\n'),
            inline: false
        });
    }
    
    if (options.extraFields) {
        options.extraFields.forEach(field => {
            embed.addFields(field);
        });
    }
    
    return embed;
}

// 미니게임 임시 채널 생성 함수
async function createMinigameChannel(guild, gameType, hostName, players, allowSpectators = false) {
    try {
        // 게임 카테고리 찾기 또는 생성
        let gameCategory = guild.channels.cache.find(
            c => c.name === '🎮 미니게임' && c.type === 4 // 4 = GUILD_CATEGORY
        );
        
        if (!gameCategory) {
            gameCategory = await guild.channels.create({
                name: '🎮 미니게임',
                type: 4,
                position: 99
            });
        }
        
        // 게임별 이모지와 이름 설정
        const gameConfig = {
            '가위바위보': { emoji: '✊', name: '가위바위보' },
            '레이싱': { emoji: '🏁', name: '레이싱' },
            '독버섯': { emoji: '🍄', name: '독버섯게임' },
            '독버섯게임': { emoji: '🍄', name: '독버섯게임' },
            '초성게임': { emoji: '🔤', name: '초성게임' },
            '끝말잇기': { emoji: '📝', name: '끝말잇기' }
        };
        
        const config = gameConfig[gameType] || { emoji: '🎮', name: gameType };
        
        // 이미 존재하는 채널 확인 (호스트 이름과 게임 타입으로)
        const channelName = `${config.emoji}-${config.name}-${hostName}`;
        const existingChannel = guild.channels.cache.find(
            c => c.name === channelName && c.parentId === gameCategory.id && c.type === 0
        );
        
        if (existingChannel) {
            console.log(`[미니게임] 기존 채널 사용: ${channelName}`);
            // 기존 채널의 권한 업데이트
            for (const player of players) {
                try {
                    await existingChannel.permissionOverwrites.create(player.id, {
                        SendMessages: true,
                        ViewChannel: true
                    });
                } catch (error) {
                    console.error(`채널 권한 업데이트 실패 (${player.name}):`, error);
                }
            }
            return existingChannel;
        }
        
        // 권한 설정
        const permissionOverwrites = [
            {
                id: guild.id,
                deny: ['SendMessages'],
                allow: allowSpectators ? ['ViewChannel'] : []
            }
        ];
        
        // 참가자들에게 권한 부여
        players.forEach(player => {
            permissionOverwrites.push({
                id: player.id,
                allow: ['SendMessages', 'ViewChannel']
            });
        });
        
        // 새 채널 생성
        const tempChannel = await guild.channels.create({
            name: channelName,
            type: 0, // 텍스트 채널
            parent: gameCategory.id,
            permissionOverwrites,
            reason: `${gameType} 게임 임시 채널`
        });
        
        console.log(`[미니게임] 새 채널 생성: ${tempChannel.name}`);
        return tempChannel;
    } catch (error) {
        console.error('임시 채널 생성 오류:', error);
        return null;
    }
}

module.exports = {
    gameHelpers,
    improvedBotBattle,
    createImprovedMushroomButtons,
    improvedMultiplayerRound,
    animateBotChoice,
    showMultiplayerResults,
    createGameStartEmbed,
    createMinigameChannel
};