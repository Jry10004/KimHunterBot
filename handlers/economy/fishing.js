const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { fishingManager } = require('../../systems/fishingSystemNew');
const { FISHING_SYSTEM } = require('../../data/fishingSystemNew');

async function handleFishingInteraction(interaction, user) {
    console.log('[Fishing Handler] handleFishingInteraction called with customId:', interaction.customId);
    
    if (!user) {
        console.log('[Fishing Handler] No user found, sending registration message');
        await interaction.reply({ content: '낚시하려면 먼저 회원가입을 완료해주세요!', flags: 64 });
        return;
    }
    
    // 낚시 데이터 초기화
    if (!user.fishing) {
        console.log('[Fishing Handler] Initializing fishing data for user');
        user.fishing = {
            level: 1,
            exp: 0,
            rod: 'wooden',
            bait: 10,
            baits: {
                worm: 10,
                shrimp: 0,
                bread: 0,
                lure: 0,
                glowing: 0,
                golden: 0,
                legendary: 0
            },
            specialBaits: {
                shiny: 0,
                giant: 0,
                legendary: 0
            },
            unlockedSpots: ['pond'],
            stats: {
                totalCaught: 0,
                totalEarned: 0,
                biggestCatch: {
                    fishId: null,
                    size: 0,
                    date: null
                },
                rarestCatch: {
                    fishId: null,
                    rarity: null,
                    date: null
                },
                perfectSales: 0,
                missedOpportunities: 0
            },
            collection: [],
            inventory: [],
            tickets: 20,
            lastTicketRegen: new Date()
        };
        await user.save();
    }
    
    // 기존 유저를 위한 collection과 inventory 초기화
    let needsSave = false;
    if (user.fishing) {
        // collection 초기화
        if (!Array.isArray(user.fishing.collection)) {
            // 기존 데이터 백업
            const oldCollection = user.fishing.collection;
            user.fishing.collection = [];
            
            // 기존 데이터 마이그레이션
            if (oldCollection && typeof oldCollection === 'object') {
                if (oldCollection.uniqueVariants && Array.isArray(oldCollection.uniqueVariants)) {
                    oldCollection.uniqueVariants.forEach(fishType => {
                        user.fishing.collection.push({
                            type: fishType,
                            firstCatch: { name: fishType, size: 0, date: new Date() },
                            bestCatch: { name: fishType, size: 0, date: new Date() }
                        });
                    });
                }
            }
            needsSave = true;
        }
        
        // inventory 초기화
        if (!Array.isArray(user.fishing.inventory)) {
            user.fishing.inventory = [];
            needsSave = true;
        }
        
        // tickets 초기화
        if (user.fishing.tickets === undefined || user.fishing.tickets === null) {
            user.fishing.tickets = 20;
            user.fishing.lastTicketRegen = new Date();
            needsSave = true;
        }
    }
    
    if (needsSave) {
        await user.save();
    }
    
    const customId = interaction.customId;
    
    // 낚시 메뉴
    if (customId === 'fishing_menu' || customId === 'fishing_cast') {
        console.log('[Fishing Handler] Processing fishing menu');
        try {
            const embed = fishingManager.createMainEmbed(user);
            const components = fishingManager.createMainComponents(user);
            
            console.log('[Fishing Handler] Embed and components created successfully');
            
            // 이미 reply된 상태인지 확인
            if (interaction.deferred || interaction.replied) {
                console.log('[Fishing Handler] Using editReply (already deferred/replied)');
                await interaction.editReply({ 
                    embeds: [embed], 
                    components: components 
                });
            } else {
                console.log('[Fishing Handler] Using reply (not deferred/replied)');
                await interaction.reply({ 
                    embeds: [embed], 
                    components: components,
                    flags: 64
                });
            }
            console.log('[Fishing Handler] Fishing menu sent successfully');
        } catch (error) {
            console.error('[Fishing Handler] Error in fishing menu:', error);
            throw error;
        }
    }
    
    // 낚시터 선택
    else if (customId.startsWith('fishing_spot_')) {
        const spotId = customId.replace('fishing_spot_', '');
        const spot = FISHING_SYSTEM.fishingSpots[spotId];
        
        if (!spot) {
            await interaction.reply({ content: '❌ 유효하지 않은 낚시터입니다.', flags: 64 });
            return;
        }
        
        // 레벨 제한 확인
        if ((user.fishing?.level || 1) < spot.requiredLevel) {
            await interaction.reply({ 
                content: `❌ 이 낚시터는 레벨 ${spot.requiredLevel} 이상만 이용할 수 있습니다!`, 
                flags: 64 
            });
            return;
        }
        
        const embed = fishingManager.createSpotDetailEmbed(spot, user);
        const components = fishingManager.createBaitSelectionComponents(spot, user);
        
        // 이미 defer된 상태이므로 editReply 사용
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 미끼 선택 후 낚시 실행
    else if (customId.startsWith('fishing_execute_')) {
        const [, , spotId, baitId] = customId.split('_');
        
        try {
            // collection 강제 초기화
            if (!Array.isArray(user.fishing.collection)) {
                user.fishing.collection = [];
                user.markModified('fishing.collection');
            }
            
            // inventory도 체크
            if (!Array.isArray(user.fishing.inventory)) {
                user.fishing.inventory = [];
                user.markModified('fishing.inventory');
            }
            
            // 낚시 애니메이션 시작
            const waitingEmbed = new EmbedBuilder()
                .setTitle('🎣 낚시 중...')
                .setDescription('낚싯대를 드리우고 기다리는 중...\n\n🌊 ～～～～～～～～～～ 🎣')
                .setColor('#3498db')
                .setFooter({ text: '물고기가 물기를 기다리세요...' });
            
            await interaction.editReply({ embeds: [waitingEmbed], components: [] });
            
            // 2-4초 랜덤 대기
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
            
            const result = await fishingManager.executeFishing(user, spotId, baitId);
            
            if (result.success) {
                await user.save();
                await interaction.editReply({ 
                    embeds: [result.embed], 
                    components: result.components 
                });
            } else {
                // 실패해도 user 객체가 변경되었을 수 있으므로 저장
                await user.save();
                await interaction.editReply({ 
                    content: `❌ ${result.message}`, 
                    embeds: [],
                    components: [] 
                });
            }
        } catch (error) {
            console.error('낚시 실행 오류:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ 
                    content: '❌ 낚시 중 오류가 발생했습니다.', 
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.reply({ 
                    content: '❌ 낚시 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
        }
    }
    
    // 인벤토리 보기
    else if (customId === 'fishing_inventory') {
        const embed = fishingManager.createInventoryEmbed(user);
        const components = fishingManager.createInventoryComponents(user);
        
        await interaction.editReply({ embeds: [embed], components });
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
                    .setCustomId('fishing_market')
                    .setLabel('🏪 수산시장')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('fishing_back')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 수산시장
    else if (customId === 'fishing_market') {
        const { fishMarket } = require('../../systems/fishMarket');
        const embed = fishMarket.createMarketEmbed();
        const components = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('fishing_market_detail')
                    .setLabel('📊 상세 시세')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fishing_sell')
                    .setLabel('💰 물고기 판매')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('fishing_shop')
                    .setLabel('🔙 상점으로')
                    .setStyle(ButtonStyle.Secondary)
            )
        ];
        
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 시세 상세보기
    else if (customId === 'fishing_market_detail') {
        const { fishMarket } = require('../../systems/fishMarket');
        const embed = fishMarket.createDetailedPriceEmbed();
        await interaction.editReply({ 
            embeds: [embed], 
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('fishing_market')
                        .setLabel('🔙 시장으로')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });
    }
    
    // 낚싯대 상점
    else if (customId === 'fishing_shop_rods') {
        const embed = fishingManager.createRodShopEmbed(user);
        const components = fishingManager.createRodShopComponents(user);
        
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 미끼 상점
    else if (customId === 'fishing_shop_baits') {
        const embed = fishingManager.createBaitShopEmbed(user);
        const components = fishingManager.createBaitShopComponents(user);
        
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 도감 보기
    else if (customId === 'fishing_collection') {
        const embed = fishingManager.createCollectionEmbed(user);
        await interaction.editReply({ 
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
        
        await interaction.editReply({ embeds: [embed], components });
    }
    
    // 시세 확인
    else if (customId === 'fishing_prices') {
        const embed = fishingManager.createPriceEmbed();
        await interaction.editReply({ 
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
                await interaction.editReply({ 
                    embeds: [result.embed], 
                    components: result.components 
                });
            } else {
                await interaction.editReply({ 
                    content: `❌ ${result.message}`, 
                    embeds: [],
                    components: [] 
                });
            }
        } catch (error) {
            console.error('물고기 판매 오류:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ 
                    content: '❌ 판매 중 오류가 발생했습니다.', 
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.reply({ 
                    content: '❌ 판매 중 오류가 발생했습니다.', 
                    flags: 64 
                });
            }
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
                
                await interaction.editReply({ embeds: [embed], components });
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
                
                await interaction.editReply({ embeds: [embed], components });
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
        await interaction.editReply({ 
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
        await interaction.editReply({ 
            embeds: [fishingManager.createMainEmbed(user)], 
            components: fishingManager.createMainComponents(user) 
        });
    }
}

module.exports = {
    handleFishingInteraction
};