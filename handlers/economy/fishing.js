const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');
const { fishingManager } = require('../systems/fishingSystem');
const { FISHING_SYSTEM } = require('../data/fishingSystem');

async function handleFishingInteraction(interaction, user) {
    if (!user) {
        await interaction.reply({ content: '낚시하려면 먼저 회원가입을 완료해주세요!', flags: 64 });
        return;
    }
    
    const customId = interaction.customId;
    
    // 낚시 시작
    if (customId === 'fishing_cast') {
        await interaction.reply({ 
            embeds: [fishingManager.createMainEmbed(user)], 
            components: fishingManager.createMainComponents(user) 
        });
    }
    
    // 낚시터 선택
    else if (customId.startsWith('fishing_spot_')) {
        const spotId = customId.replace('fishing_spot_', '');
        const spot = FISHING_SYSTEM.spots[spotId];
        
        if (!spot) {
            await interaction.reply({ content: '❌ 유효하지 않은 낚시터입니다.', flags: 64 });
            return;
        }
        
        // 레벨 제한 확인
        if (user.fishingData?.level < spot.requiredLevel) {
            await interaction.reply({ 
                content: `❌ 이 낚시터는 레벨 ${spot.requiredLevel} 이상만 이용할 수 있습니다!`, 
                flags: 64 
            });
            return;
        }
        
        const embed = fishingManager.createSpotDetailEmbed(spot, user);
        const components = fishingManager.createBaitSelectionComponents(spot, user);
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 미끼 선택 후 낚시 실행
    else if (customId.startsWith('fishing_execute_')) {
        const [, , spotId, baitId] = customId.split('_');
        
        try {
            const result = await fishingManager.executeFishing(user, spotId, baitId);
            
            if (result.success) {
                await user.save();
                await interaction.update({ 
                    embeds: [result.embed], 
                    components: result.components 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.message}`, 
                    flags: 64 
                });
            }
        } catch (error) {
            console.error('낚시 실행 오류:', error);
            await interaction.reply({ 
                content: '❌ 낚시 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
    
    // 인벤토리 보기
    else if (customId === 'fishing_inventory') {
        const embed = fishingManager.createInventoryEmbed(user);
        const components = fishingManager.createInventoryComponents(user);
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 낚시 상점
    else if (customId === 'fishing_shop') {
        const embed = fishingManager.createShopEmbed(user);
        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_shop_rods')
                    .setLabel('🎣 낚싯대')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fishing_shop_baits')
                    .setLabel('🪱 미끼')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 낚싯대 상점
    else if (customId === 'fishing_shop_rods') {
        const embed = fishingManager.createRodShopEmbed(user);
        const components = fishingManager.createRodShopComponents(user);
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 미끼 상점
    else if (customId === 'fishing_shop_baits') {
        const embed = fishingManager.createBaitShopEmbed(user);
        const components = fishingManager.createBaitShopComponents(user);
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 도감 보기
    else if (customId === 'fishing_collection') {
        const embed = fishingManager.createCollectionEmbed(user);
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('fishing_back')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }
    
    // 물고기 판매
    else if (customId === 'fishing_sell') {
        const embed = fishingManager.createSellEmbed(user);
        const components = fishingManager.createSellComponents(user);
        
        await interaction.update({ embeds: [embed], components });
    }
    
    // 시세 확인
    else if (customId === 'fishing_prices') {
        const embed = fishingManager.createPriceEmbed();
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('fishing_back')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }
    
    // 물고기 판매 실행
    else if (customId.startsWith('fishing_sell_')) {
        const action = customId.replace('fishing_sell_', '');
        
        try {
            const result = await fishingManager.sellFish(user, action);
            
            if (result.success) {
                await user.save();
                await interaction.update({ 
                    embeds: [result.embed], 
                    components: result.components 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.message}`, 
                    flags: 64 
                });
            }
        } catch (error) {
            console.error('물고기 판매 오류:', error);
            await interaction.reply({ 
                content: '❌ 판매 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
    
    // 낚싯대 구매
    else if (customId.startsWith('fishing_buy_rod_')) {
        const rodId = customId.replace('fishing_buy_rod_', '');
        
        try {
            const result = await fishingManager.buyRod(user, rodId);
            
            if (result.success) {
                await user.save();
                const embed = fishingManager.createRodShopEmbed(user);
                const components = fishingManager.createRodShopComponents(user);
                
                await interaction.update({ embeds: [embed], components });
                await interaction.followUp({ 
                    content: `✅ ${result.message}`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.message}`, 
                    flags: 64 
                });
            }
        } catch (error) {
            console.error('낚싯대 구매 오류:', error);
            await interaction.reply({ 
                content: '❌ 구매 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
    
    // 미끼 구매
    else if (customId.startsWith('fishing_buy_bait_')) {
        const parts = customId.split('_');
        const baitId = parts[3];
        const amount = parseInt(parts[4]) || 1;
        
        try {
            const result = await fishingManager.buyBait(user, baitId, amount);
            
            if (result.success) {
                await user.save();
                const embed = fishingManager.createBaitShopEmbed(user);
                const components = fishingManager.createBaitShopComponents(user);
                
                await interaction.update({ embeds: [embed], components });
                await interaction.followUp({ 
                    content: `✅ ${result.message}`, 
                    flags: 64 
                });
            } else {
                await interaction.reply({ 
                    content: `❌ ${result.message}`, 
                    flags: 64 
                });
            }
        } catch (error) {
            console.error('미끼 구매 오류:', error);
            await interaction.reply({ 
                content: '❌ 구매 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
    
    // 랭킹 보기
    else if (customId === 'fishing_ranking') {
        const embed = await fishingManager.createRankingEmbed();
        await interaction.update({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('fishing_back')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }
    
    // 돌아가기
    else if (customId === 'fishing_back') {
        await interaction.update({ 
            embeds: [fishingManager.createMainEmbed(user)], 
            components: fishingManager.createMainComponents(user) 
        });
    }
}

module.exports = {
    handleFishingInteraction
};