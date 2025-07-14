const spectatorBetting = require('../data/spectatorBetting');
const User = require('../models/User');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 관전자 베팅 핸들러
async function handleSpectatorInteraction(interaction, gameType, sessionData) {
    const customId = interaction.customId;
    const userId = interaction.user.id;
    
    // 관전자로 참여 버튼 처리
    if (customId.includes('_spectate_')) {
        const gameId = customId.split('_').slice(-1)[0];
        
        // 이미 플레이어인지 확인
        if (sessionData.players) {
            const isPlayer = sessionData.players instanceof Map ? 
                sessionData.players.has(userId) :
                Array.isArray(sessionData.players) && sessionData.players.some(p => (p.id || p.userId) === userId);
                
            if (isPlayer) {
                if (interaction.replied || interaction.deferred) {
                    return interaction.followUp({ 
                        content: '❌ 이미 게임에 참가중입니다!', 
                        flags: 64 
                    });
                } else {
                    return interaction.reply({ 
                        content: '❌ 이미 게임에 참가중입니다!', 
                        flags: 64 
                    });
                }
            }
        }
        
        // 베팅 풀이 없으면 생성
        if (!spectatorBetting.hasPool(gameId)) {
            const players = sessionData.players instanceof Map ? 
                Array.from(sessionData.players.values()).map(p => ({
                    id: p.id || p.userId,
                    username: p.name || p.userName || '알 수 없음'
                })) :
                sessionData.players.map(p => ({
                    id: p.id || p.userId,
                    username: p.name || p.userName || '알 수 없음'
                }));
            
            spectatorBetting.createBettingPool(gameId, gameType, players);
        }
        
        // 베팅 금액 선택 UI 표시
        const betEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 관전자 베팅')
            .setDescription('배팅할 금액을 선택하세요:')
            .setFooter({ text: '게임 시작 전까지 배팅을 변경할 수 있습니다.' });
            
        const betButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_10000_${gameId}`)
                    .setLabel('1만')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💰'),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_50000_${gameId}`)
                    .setLabel('5만')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💎'),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_100000_${gameId}`)
                    .setLabel('10만')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💎'),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_500000_${gameId}`)
                    .setLabel('50만')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔥'),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_1000000_${gameId}`)
                    .setLabel('100만')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('👑')
            );
            
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                embeds: [betEmbed],
                components: [betButtons],
                flags: 64
            });
        } else {
            await interaction.reply({
                embeds: [betEmbed],
                components: [betButtons],
                flags: 64
            });
        }
        
        // 첫 관전자인 경우 게임 채널에 베팅 안내 메시지 전송
        if (spectatorBetting.getSpectatorCount(gameId) === 0) {
            const pool = spectatorBetting.bettingPools.get(gameId);
            const bettingEmbed = spectatorBetting.createBettingEmbed(pool);
            const bettingButtons = spectatorBetting.createBettingButtons(gameId);
            
            // 게임 채널에 베팅 UI 전송
            if (sessionData.channel) {
                await sessionData.channel.send({
                    content: '🎰 **관전자 베팅이 열렸습니다!**',
                    embeds: [bettingEmbed],
                    components: bettingButtons
                });
            }
        }
    }
    
    // 베팅 금액 선택 처리
    else if (customId.startsWith('spectator_bet_')) {
        const parts = customId.split('_');
        const amount = parseInt(parts[2]);
        const gameId = parts[3];
        
        const user = await User.findOne({ discordId: userId });
        if (!user) {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ 
                    content: '❌ 등록되지 않은 사용자입니다.', 
                    flags: 64 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ 등록되지 않은 사용자입니다.', 
                    flags: 64 
                });
            }
        }
        
        if (user.gold < amount) {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ 
                    content: `❌ 골드가 부족합니다! (필요: ${amount.toLocaleString()}G, 보유: ${user.gold.toLocaleString()}G)`, 
                    flags: 64 
                });
            } else {
                return interaction.reply({ 
                    content: `❌ 골드가 부족합니다! (필요: ${amount.toLocaleString()}G, 보유: ${user.gold.toLocaleString()}G)`, 
                    flags: 64 
                });
            }
        }
        
        // 베팅 옵션 선택 (간단히 첫 번째 옵션 선택)
        const pool = spectatorBetting.bettingPools.get(gameId);
        if (!pool || pool.status !== 'open') {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ 
                    content: '❌ 베팅이 마감되었습니다.', 
                    flags: 64 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ 베팅이 마감되었습니다.', 
                    flags: 64 
                });
            }
        }
        
        // 베팅 옵션 선택 UI
        const optionEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎯 베팅 옵션 선택')
            .setDescription(`**${amount.toLocaleString()}G**를 베팅합니다.\n어떤 옵션에 베팅하시겠습니까?`);
            
        const optionButtons = [];
        const optionRows = [];
        
        pool.betOptions.forEach((option, index) => {
            optionButtons.push(
                new ButtonBuilder()
                    .setCustomId(`spectator_confirm_${gameId}_${option.id}_${amount}`)
                    .setLabel(`${option.label} (x${option.odds})`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(spectatorBetting.getOptionEmoji(option.type))
            );
            
            // 5개씩 줄바꿈
            if (optionButtons.length === 5 || index === pool.betOptions.length - 1) {
                optionRows.push(new ActionRowBuilder().addComponents(...optionButtons));
                optionButtons.length = 0;
            }
        });
        
        // Defer the update if not already done
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(console.error);
        }
        
        await interaction.editReply({
            embeds: [optionEmbed],
            components: optionRows
        });
    }
    
    // 베팅 확정 처리
    else if (customId.startsWith('spectator_confirm_')) {
        const parts = customId.split('_');
        const gameId = parts[2];
        const optionId = parts.slice(3, -1).join('_');
        const amount = parseInt(parts[parts.length - 1]);
        
        const user = await User.findOne({ discordId: userId });
        if (!user || user.gold < amount) {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ 
                    content: '❌ 골드가 부족합니다.', 
                    flags: 64 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ 골드가 부족합니다.', 
                    flags: 64 
                });
            }
        }
        
        // 베팅 실행
        const result = spectatorBetting.placeBet(gameId, userId, optionId, amount);
        
        if (result.success) {
            // 골드 차감
            user.gold -= amount;
            await user.save();
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ 베팅 완료!')
                .setDescription(
                    `**베팅 옵션**: ${result.option}\n` +
                    `**베팅 금액**: ${amount.toLocaleString()}G\n` +
                    `**배당률**: x${result.multiplier}\n` +
                    `**예상 수익**: ${result.bet.potentialWin.toLocaleString()}G`
                )
                .setFooter({ text: '행운을 빕니다! 🍀' });
                
            // Defer the update if not already done
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate().catch(console.error);
            }
            
            await interaction.editReply({
                embeds: [successEmbed],
                components: []
            });
        } else {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: `❌ ${result.error}`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.error}`, 
                    flags: 64 
                });
            }
        }
    }
}

module.exports = {
    handleSpectatorInteraction
};