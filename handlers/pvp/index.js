const { showPVPMenu, showPVPEnhance, processPVPEnhance, showPVPRanking } = require('./pvpMenu');
const { getUser } = require('../common/utils');
const { handlePVPWaitingRoomInteraction } = require('./pvpWaitingRoom');
const pvpSystem = require('../../systems/pvpSystem');

// PVP 시스템 인스턴스 가져오기
function getPVPSystem() {
    return pvpSystem;
}

// PVP 인터랙션 핸들러
async function handlePVPInteraction(interaction) {
    const customId = interaction.customId;
    console.log('[PVP Handler] handlePVPInteraction called with customId:', customId);

    // PVP 메뉴
    if (customId === 'pvp' || customId === 'pvp_menu') {
        console.log('[PVP Handler] Showing PVP menu');
        return await showPVPMenu(interaction);
    }

    // PVP 대전방 만들기
    if (customId === 'pvp_create_room') {
        console.log('[PVP Handler] Creating PVP room');
        
        // Defer the interaction first
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(console.error);
        }
        
        const user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.followUp({ 
                content: '먼저 회원가입을 해주세요!', 
                ephemeral: true 
            });
        }

        const pvpSystem = getPVPSystem();
        console.log('[PVP Handler] PVP System:', pvpSystem ? 'Loaded' : 'Not loaded');
        return await pvpSystem.createWaitingRoom(interaction, user);
    }

    // 매치메이킹 취소
    if (customId === 'pvp_cancel_matchmaking') {
        const pvpSystem = getPVPSystem();
        const result = pvpSystem.leaveQueue(interaction.user.id);
        
        if (result.success) {
            await interaction.reply({ 
                content: '✅ 매치메이킹을 취소했습니다.', 
                flags: 64 
            });
        } else {
            await interaction.reply({ 
                content: '❌ 매치메이킹 중이 아닙니다.', 
                flags: 64 
            });
        }
        return;
    }

    // PVP 강화
    if (customId === 'pvp_enhance') {
        return await showPVPEnhance(interaction);
    }

    // PVP 강화 처리
    if (customId.startsWith('pvp_enhance_')) {
        const position = customId.split('_')[2]; // high, middle, low
        return await processPVPEnhance(interaction, position);
    }

    // PVP 랭킹
    if (customId === 'pvp_ranking') {
        return await showPVPRanking(interaction);
    }

    // PVP 정보
    if (customId === 'pvp_info') {
        console.log('[PVP Handler] Showing PVP info');
        const user = await getUser(interaction.user.id);
        if (!user) {
            return await interaction.reply({ 
                content: '유저 데이터를 불러올 수 없습니다!', 
                flags: 64 
            });
        }

        const pvpSystem = getPVPSystem();
        const pvpInfo = await pvpSystem.getPVPInfo(user);
        console.log('[PVP Handler] PVP Info:', pvpInfo);
        
        const { EmbedBuilder } = require('discord.js');
        const infoEmbed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🎮 내 PVP 정보')
            .setDescription(`**${user.nickname}**님의 PVP 통계`)
            .addFields(
                { name: '🎖️ 티어', value: `${pvpInfo.tierEmoji} ${pvpInfo.tier}`, inline: true },
                { name: '📈 레이팅', value: `${pvpInfo.rating}점`, inline: true },
                { name: '🎫 결투권', value: `${pvpInfo.tickets}/20`, inline: true },
                { name: '⚔️ 총 전투', value: `${pvpInfo.totalGames}회`, inline: true },
                { name: '🏆 전적', value: `${pvpInfo.wins}승 ${pvpInfo.losses}패`, inline: true },
                { name: '📊 승률', value: `${pvpInfo.winRate}%`, inline: true },
                { name: '🔥 연승', value: `${pvpInfo.winStreak}회`, inline: true },
                { name: '🌟 최고 연승', value: `${pvpInfo.maxWinStreak}회`, inline: true },
                { name: '⬆️ 다음 티어까지', value: pvpInfo.pointsToNextTier > 0 ? `${pvpInfo.pointsToNextTier}점` : '최고 티어', inline: true }
            );

        // 최근 매치 기록 (matchHistory가 있는 경우만)
        if (pvpInfo.matchHistory && pvpInfo.matchHistory.length > 0) {
            let historyText = '';
            pvpInfo.matchHistory.slice(0, 5).forEach(match => {
                const resultEmoji = match.result === 'win' ? '🟢' : '🔴';
                const ratingChangeText = match.ratingChange > 0 ? `+${match.ratingChange}` : `${match.ratingChange}`;
                
                // goldChange 처리 (0일 때도 표시)
                let goldChangeText = '';
                if (match.goldChange !== undefined && match.goldChange !== null) {
                    if (match.goldChange > 0) {
                        goldChangeText = `💰 +${match.goldChange.toLocaleString()}G`;
                    } else if (match.goldChange < 0) {
                        goldChangeText = `💸 ${match.goldChange.toLocaleString()}G`;
                    } else {
                        goldChangeText = `💰 0G`;
                    }
                } else {
                    // 기존 기록은 결과로 추정 (승리=+500G, 패배=-100G 기본값)
                    if (match.result === 'win') {
                        goldChangeText = `💰 +500G (추정)`;
                    } else {
                        goldChangeText = `💸 -100G (추정)`;
                    }
                }
                
                const dateText = new Date(match.date).toLocaleString('ko-KR', { 
                    month: 'numeric', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false
                });
                
                // 전투 기록 한 줄로 정리
                historyText += `${resultEmoji} **${match.opponent}** (${match.opponentRating}점) | ${ratingChangeText}점 | ${goldChangeText} | ${dateText}\n`;
            });
            infoEmbed.addFields({ name: '📊 최근 5경기', value: historyText || '전적이 없습니다.', inline: false });
        }
        
        // 골드 통계 추가 (항상 표시)
        infoEmbed.addFields({
            name: '💰 총 골드 통계',
            value: `🏆 총 획득: **${pvpInfo.totalGoldWon.toLocaleString()}** 골드\n` +
                   `💸 총 손실: **${pvpInfo.totalGoldLost.toLocaleString()}** 골드\n` +
                   `📊 순손익: **${pvpInfo.netGold > 0 ? '+' : ''}${pvpInfo.netGold.toLocaleString()}** 골드 ${pvpInfo.netGold > 0 ? '📈' : pvpInfo.netGold < 0 ? '📉' : '➡️'}`,
            inline: false
        });

        const { ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pvp_menu')
                    .setLabel('🔙 뒤로')
                    .setStyle(ButtonStyle.Secondary)
            );

        return await interaction.update({ 
            embeds: [infoEmbed],
            components: [buttons]
        });
    }

    // PVP 펜들럼 배틀 버튼 처리
    if (customId.startsWith('pvp_pendulum_')) {
        const parts = customId.split('_');
        const position = parts[parts.length - 1]; // high, middle, low
        const matchId = parts.slice(2, -1).join('_'); // matchId
        
        console.log(`[PVP] 펜들럼 버튼 클릭 - matchId: ${matchId}, position: ${position}, userId: ${interaction.user.id}`);
        const pvpSystem = getPVPSystem();
        await pvpSystem.handlePendulumChoice(interaction, matchId, position);
        return;
    }

    // PVP 타임아웃 버튼 처리
    if (customId === 'pvp_timeout') {
        await interaction.reply({ 
            content: '⏰ 시간 내에 선택하지 않으면 자동으로 중간 위치가 선택됩니다!', 
            flags: 64 
        });
        return;
    }

    // PVP 관전자로 참여
    if (customId.startsWith('pvp_spectate_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const matchId = customId.replace('pvp_spectate_', '');
        const pvpSystem = getPVPSystem();
        const match = pvpSystem.activeMatches.get(matchId);
        
        if (!match) {
            return interaction.reply({ content: '❌ 매치를 찾을 수 없습니다.', ephemeral: true });
        }
        
        // 이미 참가자인지 확인
        const userId = interaction.user.id;
        if (match.player1.user.discordId === userId || 
            (!match.player2.isBot && match.player2.user.discordId === userId)) {
            return interaction.reply({ content: '❌ 이미 경기에 참가중입니다!', ephemeral: true });
        }
        
        // match 객체를 sessionData 형식으로 변환
        const sessionData = {
            players: [
                {
                    id: match.player1.user.discordId,
                    userId: match.player1.user.discordId,
                    name: match.player1.user.nickname || 'Player1',
                    rating: match.player1.rating
                },
                {
                    id: match.player2.isBot ? 'bot_' + match.player2.user.nickname : match.player2.user.discordId,
                    userId: match.player2.isBot ? 'bot_' + match.player2.user.nickname : match.player2.user.discordId,
                    name: match.player2.user.nickname || 'Player2',
                    rating: match.player2.rating
                }
            ],
            channel: match.pvpChannel
        };
        
        return await handleSpectatorInteraction(interaction, 'pvp', sessionData);
    }
    
    // 관전자 베팅 처리
    if (customId.startsWith('spectator_bet_') || customId.startsWith('spectator_confirm_')) {
        const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
        const gameId = customId.split('_')[2] || customId.split('_')[3];
        const pvpSystem = getPVPSystem();
        const match = pvpSystem.activeMatches.get(gameId);
        
        if (!match) {
            return interaction.reply({ content: '❌ 매치를 찾을 수 없습니다.', ephemeral: true });
        }
        
        const sessionData = {
            players: [
                {
                    id: match.player1.user.discordId,
                    userId: match.player1.user.discordId,
                    name: match.player1.user.nickname || 'Player1',
                    rating: match.player1.rating
                },
                {
                    id: match.player2.isBot ? 'bot_' + match.player2.user.nickname : match.player2.user.discordId,
                    userId: match.player2.isBot ? 'bot_' + match.player2.user.nickname : match.player2.user.discordId,
                    name: match.player2.user.nickname || 'Player2',
                    rating: match.player2.rating
                }
            ],
            channel: match.pvpChannel
        };
        
        return await handleSpectatorInteraction(interaction, 'pvp', sessionData);
    }

    // PVP 대기실 관련 인터랙션
    if (customId.startsWith('pvp_join_') || customId.startsWith('pvp_start_') || 
        customId.startsWith('pvp_offline_') || customId.startsWith('pvp_leave_') ||
        customId.startsWith('pvp_spectate_')) {
        return await handlePVPWaitingRoomInteraction(interaction, getPVPSystem());
    }

    return false;
}

module.exports = {
    handlePVPInteraction
};