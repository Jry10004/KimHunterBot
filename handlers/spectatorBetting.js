const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const spectatorBetting = require('../data/spectatorBetting');

// 임시 베팅 데이터 저장
if (!global.tempBettingData) {
    global.tempBettingData = new Map();
}

async function handleBettingInteraction(interaction, user) {
    if (!user) {
        await interaction.reply({ content: '베팅하려면 먼저 회원가입을 완료해주세요!', flags: 64 });
        return;
    }
    
    // spectator_bet_intro 처리 (베팅 소개)
    if (interaction.customId.startsWith('spectator_bet_intro_')) {
        const gameId = interaction.customId.replace('spectator_bet_intro_', '');
        
        // 베팅 풀 확인
        const pool = spectatorBetting.getPool(gameId);
        if (!pool) {
            await interaction.reply({ 
                content: '❌ 해당 게임의 베팅이 종료되었거나 찾을 수 없습니다.', 
                flags: 64 
            });
            return;
        }
        
        // 베팅 금액 선택 UI
        const betEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 베팅 금액 선택')
            .setDescription('베팅할 금액을 선택하세요:')
            .addFields(
                { name: '💵 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎮 게임 타입', value: pool.gameType || '독버섯', inline: true }
            );
            
        const betButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_5000_${gameId}`)
                    .setLabel('5,000G')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(user.gold < 5000),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_10000_${gameId}`)
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 10000),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_30000_${gameId}`)
                    .setLabel('30,000G')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < 30000),
                new ButtonBuilder()
                    .setCustomId(`spectator_bet_50000_${gameId}`)
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(user.gold < 50000)
            );
            
        await interaction.reply({
            embeds: [betEmbed],
            components: [betButtons],
            flags: 64
        });
        return;
    }
    
    // spectator_bet_ 형식 처리 (미니게임 직접 배팅)
    if (interaction.customId.startsWith('spectator_bet_')) {
        const parts = interaction.customId.split('_');
        const amount = parseInt(parts[2]);
        const gameId = parts[3];
        
        // 골드 확인
        if (user.gold < amount) {
            await interaction.reply({ 
                content: `❌ 골드가 부족합니다! (보유: ${user.gold.toLocaleString()}G)`, 
                flags: 64 
            });
            return;
        }
        
        // 베팅 풀 확인
        const pool = spectatorBetting.getPool(gameId);
        if (!pool) {
            await interaction.reply({ 
                content: '❌ 해당 게임의 베팅이 종료되었거나 찾을 수 없습니다.', 
                flags: 64 
            });
            return;
        }
        
        // 플레이어 선택 UI 표시
        const playerEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎯 베팅 대상 선택')
            .setDescription(`${amount.toLocaleString()}G를 베팅할 플레이어를 선택하세요:`)
            .addFields(
                { name: '💰 베팅 금액', value: `${amount.toLocaleString()}G`, inline: true },
                { name: '💵 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            );
            
        const playerButtons = new ActionRowBuilder();
        
        // 플레이어 버튼 생성
        pool.options.forEach((player, index) => {
            if (index < 5) { // 최대 5개 버튼
                playerButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`betting_player_${gameId}_${amount}_${player.id}`)
                        .setLabel(player.username)
                        .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setEmoji('🎮')
                );
            }
        });
        
        await interaction.reply({
            embeds: [playerEmbed],
            components: [playerButtons],
            flags: 64
        });
        
        return;
    }
    
    // 베팅 금액 버튼 처리
    if (interaction.customId.startsWith('betting_') && interaction.isButton()) {
        const parts = interaction.customId.split('_');
        
        // betting_player_ 처리 (플레이어 선택 후 베팅)
        if (parts[1] === 'player') {
            const gameId = parts[2];
            const amount = parseInt(parts[3]);
            const playerId = parts[4];
            
            // 골드 재확인
            if (user.gold < amount) {
                await interaction.reply({ 
                    content: `❌ 골드가 부족합니다! (보유: ${user.gold.toLocaleString()}G)`, 
                    flags: 64 
                });
                return;
            }
            
            try {
                // spectatorBetting 모듈 사용하여 베팅 처리
                const result = await spectatorBetting.placeBet(gameId, interaction.user.id, playerId, amount);
                
                if (result.success) {
                    // 베팅 성공 시 골드 차감
                    user.gold -= amount;
                    await user.save();
                    
                    // 베팅 확인 메시지
                    const embed = new EmbedBuilder()
                        .setTitle('✅ 베팅 완료!')
                        .setDescription(`${result.option}에 ${amount.toLocaleString()}G를 베팅했습니다!`)
                        .addFields(
                            { name: '💰 남은 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                            { name: '🎲 예상 배당', value: `x${result.multiplier}`, inline: true }
                        )
                        .setColor('#00ff00');
                    
                    await interaction.reply({ embeds: [embed], flags: 64 });
                } else {
                    await interaction.reply({ 
                        content: `❌ 베팅 실패: ${result.error || result.message}`, 
                        flags: 64 
                    });
                }
            } catch (error) {
                console.error('베팅 처리 오류:', error);
                await interaction.reply({ 
                    content: '❌ 베팅 처리 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
            return;
        }
        
        // betting_winner_ 처리 (PVP 직접 베팅)
        if (parts[1] === 'winner') {
            const gameId = parts[2];
            const optionId = parts.slice(3).join('_');
            
            // 임시 베팅 정보 확인
            const tempData = global.tempBettingData?.get(interaction.user.id);
            if (!tempData || tempData.gameId !== gameId) {
                await interaction.reply({ 
                    content: '먼저 베팅 금액을 선택해주세요!', 
                    flags: 64 
                });
                return;
            }
            
            const betAmount = tempData.amount;
            
            try {
                // spectatorBetting 모듈 사용하여 베팅 처리
                const result = await spectatorBetting.placeBet(gameId, interaction.user.id, optionId, betAmount);
                
                if (result.success) {
                    // 베팅 성공 시 골드 차감
                    user.gold -= betAmount;
                    await user.save();
                    
                    // 베팅 확인 메시지
                    const embed = new EmbedBuilder()
                        .setTitle('✅ 베팅 완료!')
                        .setDescription(`${result.option}에 ${betAmount.toLocaleString()}G를 베팅했습니다!`)
                        .addFields(
                            { name: '💰 남은 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                            { name: '🎲 예상 배당', value: `x${result.multiplier}`, inline: true }
                        )
                        .setColor('#00ff00');
                    
                    await interaction.reply({ embeds: [embed], flags: 64 });
                    
                    // 임시 데이터 삭제
                    global.tempBettingData.delete(interaction.user.id);
                } else {
                    await interaction.reply({ 
                        content: `❌ 베팅 실패: ${result.error || result.message}`, 
                        flags: 64 
                    });
                }
            } catch (error) {
                console.error('베팅 처리 오류:', error);
                await interaction.reply({ 
                    content: '❌ 베팅 처리 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        }
        // betting_amount_ 처리 (베팅 금액 선택)
        else if (parts[1] === 'amount') {
            const gameId = parts[2];
            const amount = parseInt(parts[3]);
            
            // 골드 확인
            if (user.gold < amount) {
                await interaction.reply({ 
                    content: `❌ 골드가 부족합니다! (보유: ${user.gold.toLocaleString()}G)`, 
                    flags: 64 
                });
                return;
            }
            
            // 임시 베팅 정보 저장
            global.tempBettingData.set(interaction.user.id, {
                gameId: gameId,
                amount: amount,
                timestamp: Date.now()
            });
            
            await interaction.reply({ 
                content: `💰 ${amount.toLocaleString()}G를 선택했습니다. 이제 베팅할 대상을 선택해주세요!`, 
                flags: 64 
            });
            
            // 5분 후 자동 삭제
            setTimeout(() => {
                global.tempBettingData.delete(interaction.user.id);
            }, 5 * 60 * 1000);
        }
    }
    // betting_option_ 처리 (몬스터 배틀 등의 옵션 베팅)
    else if (interaction.customId.startsWith('betting_option_')) {
        const parts = interaction.customId.split('_');
        const gameId = parts[2];
        const optionId = parts.slice(3).join('_');
        
        // 임시 베팅 정보 확인
        const tempData = global.tempBettingData?.get(interaction.user.id);
        if (!tempData || tempData.gameId !== gameId) {
            await interaction.reply({ 
                content: '먼저 베팅 금액을 선택해주세요!', 
                flags: 64 
            });
            return;
        }
        
        const betAmount = tempData.amount;
        
        try {
            // spectatorBetting 모듈 사용하여 베팅 처리
            const result = await spectatorBetting.placeBet(gameId, interaction.user.id, optionId, betAmount);
            
            if (result.success) {
                // 베팅 성공 시 골드 차감
                user.gold -= betAmount;
                await user.save();
                
                // 베팅 확인 메시지
                const embed = new EmbedBuilder()
                    .setTitle('✅ 베팅 완료!')
                    .setDescription(`${result.option}에 ${betAmount.toLocaleString()}G를 베팅했습니다!`)
                    .addFields(
                        { name: '💰 남은 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                        { name: '🎲 예상 배당', value: `x${result.multiplier}`, inline: true }
                    )
                    .setColor('#00ff00');
                
                await interaction.reply({ embeds: [embed], flags: 64 });
                
                // 임시 데이터 삭제
                global.tempBettingData.delete(interaction.user.id);
            } else {
                await interaction.reply({ 
                    content: `❌ 베팅 실패: ${result.message}`, 
                    flags: 64 
                });
            }
        } catch (error) {
            console.error('베팅 처리 오류:', error);
            await interaction.reply({ 
                content: '❌ 베팅 처리 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
}

module.exports = {
    handleBettingInteraction
};