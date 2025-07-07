const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');
const { getUser, formatNumber } = require('../common/utils');

// 장신구 인벤토리 표시
async function showAccessoryInventory(interaction, page = 0) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            if (interaction.isButton()) {
                await interaction.deferUpdate();
            } else {
                await interaction.deferReply();
            }
        }

        const user = await getUser(interaction.user.id);
        if (!user) {
            return await interaction.editReply({ 
                content: '먼저 회원가입을 해주세요!',
                embeds: [],
                components: []
            });
        }

        // 장신구 인벤토리 초기화
        if (!user.accessoryInventory) user.accessoryInventory = [];
        if (!user.equippedAccessories) {
            user.equippedAccessories = {
                ring1: null,
                ring2: null,
                necklace: null,
                bracelet1: null,
                bracelet2: null,
                earring1: null,
                earring2: null
            };
        }

        const accessories = user.accessoryInventory;
        const equipped = user.equippedAccessories;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(accessories.length / itemsPerPage);
        const currentPage = Math.min(page, totalPages - 1);

        // 현재 세트 효과 계산
        const setBonus = BOSS_ACCESSORIES.calculateSetBonus(equipped);
        
        // 세트별 장착 개수 계산
        const equippedSets = {};
        Object.values(equipped).forEach(item => {
            if (item && item.setId) {
                equippedSets[item.setId] = (equippedSets[item.setId] || 0) + 1;
            }
        });

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('💎 장신구 인벤토리')
            .setDescription('보유한 장신구를 확인하고 장착할 수 있습니다.')
            .setFooter({ text: `페이지 ${currentPage + 1}/${totalPages || 1} | 총 ${accessories.length}개 보유` })
            .setTimestamp();

        // 현재 장착 상태 표시
        let equippedDisplay = '**현재 장착 중:**\n';
        const slotNames = {
            ring1: '반지1',
            ring2: '반지2',
            necklace: '목걸이',
            bracelet1: '팔찌1',
            bracelet2: '팔찌2',
            earring1: '귀걸이1',
            earring2: '귀걸이2'
        };

        Object.entries(equipped).forEach(([slot, item]) => {
            if (item) {
                equippedDisplay += `${slotNames[slot]}: ${item.emoji} ${item.name}\n`;
            } else {
                equippedDisplay += `${slotNames[slot]}: 비어있음\n`;
            }
        });

        embed.addFields({ name: '📿 장착 슬롯', value: equippedDisplay, inline: false });

        // 세트 효과 표시
        if (Object.keys(equippedSets).length > 0) {
            let setEffectDisplay = '';
            Object.entries(equippedSets).forEach(([setId, count]) => {
                const setData = BOSS_ACCESSORIES.sets[setId];
                if (setData) {
                    setEffectDisplay += `**${setData.name}** (${count}/4)\n`;
                    
                    // 활성화된 세트 효과 표시
                    if (count >= 2) {
                        setEffectDisplay += `  2세트: ✅ 활성\n`;
                    }
                    if (count >= 3) {
                        setEffectDisplay += `  3세트: ✅ 활성\n`;
                    }
                    if (count >= 4) {
                        setEffectDisplay += `  4세트: ✅ ${BOSS_ACCESSORIES.setEffects[4][setId].ability}\n`;
                    }
                }
            });
            embed.addFields({ name: '🏆 세트 효과', value: setEffectDisplay || '없음', inline: false });
        }

        // 인벤토리 아이템 표시
        if (accessories.length > 0) {
            const startIdx = currentPage * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, accessories.length);
            const pageItems = accessories.slice(startIdx, endIdx);

            let inventoryDisplay = '';
            pageItems.forEach((item, idx) => {
                const globalIdx = startIdx + idx;
                const isEquipped = Object.values(equipped).some(e => e && e.id === item.id && e.obtainedAt?.getTime() === item.obtainedAt?.getTime());
                inventoryDisplay += `${globalIdx + 1}. ${item.emoji} **${item.name}** ${isEquipped ? '(장착중)' : ''}\n`;
                inventoryDisplay += `   ${item.setName} | ${item.slotType}\n`;
            });

            embed.addFields({ name: '🎒 보유 장신구', value: inventoryDisplay || '없음', inline: false });
        } else {
            embed.addFields({ name: '🎒 보유 장신구', value: '보유한 장신구가 없습니다.', inline: false });
        }

        const components = [];

        // 아이템 선택 메뉴 (장착/해제용)
        if (accessories.length > 0) {
            const startIdx = currentPage * itemsPerPage;
            const endIdx = Math.min(startIdx + itemsPerPage, accessories.length);
            const pageItems = accessories.slice(startIdx, endIdx);

            const itemOptions = pageItems.map((item, idx) => {
                const globalIdx = startIdx + idx;
                const isEquipped = Object.values(equipped).some(e => e && e.id === item.id && e.obtainedAt?.getTime() === item.obtainedAt?.getTime());
                
                return {
                    label: `${item.name} ${isEquipped ? '(장착중)' : ''}`,
                    description: `${item.setName} - ${item.slotType}`,
                    value: `${globalIdx}`,
                    emoji: item.emoji
                };
            });

            const itemSelect = new StringSelectMenuBuilder()
                .setCustomId('accessory_select')
                .setPlaceholder('장착/해제할 장신구 선택')
                .addOptions(itemOptions);

            components.push(new ActionRowBuilder().addComponents(itemSelect));
        }

        // 버튼들
        const buttons = new ActionRowBuilder();

        // 페이지 네비게이션
        if (totalPages > 1) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`accessory_inv_prev_${Math.max(0, currentPage - 1)}`)
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId(`accessory_inv_next_${Math.min(totalPages - 1, currentPage + 1)}`)
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages - 1)
            );
        }

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('unequip_all_accessories')
                .setLabel('🔓 전체 해제')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('boss_token_shop')
                .setLabel('🛍️ 장신구 상점')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('boss_raid_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

        components.push(buttons);

        return await interaction.editReply({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        console.error('[Accessory Inventory] Show error:', error);
        return await interaction.editReply({ 
            content: '❌ 장신구 인벤토리를 표시하는 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 장신구 장착/해제 처리
async function handleAccessoryEquip(interaction, itemIndex) {
    try {
        await interaction.deferUpdate();

        const user = await getUser(interaction.user.id);
        const accessories = user.accessoryInventory || [];
        
        if (itemIndex >= accessories.length) {
            return await interaction.editReply({
                content: '❌ 잘못된 아이템 선택입니다.',
                embeds: [],
                components: []
            });
        }

        const selectedItem = accessories[itemIndex];
        const slotType = selectedItem.slotType;

        // 슬롯 매핑
        let targetSlots = [];
        if (slotType === 'ring') {
            targetSlots = ['ring1', 'ring2'];
        } else if (slotType === 'bracelet') {
            targetSlots = ['bracelet1', 'bracelet2'];
        } else if (slotType === 'earring') {
            targetSlots = ['earring1', 'earring2'];
        } else if (slotType === 'necklace') {
            targetSlots = ['necklace'];
        }

        // 이미 장착중인지 확인
        let isEquipped = false;
        let equippedSlot = null;
        
        for (const slot of targetSlots) {
            const equipped = user.equippedAccessories[slot];
            if (equipped && equipped.id === selectedItem.id && equipped.obtainedAt?.getTime() === selectedItem.obtainedAt?.getTime()) {
                isEquipped = true;
                equippedSlot = slot;
                break;
            }
        }

        if (isEquipped) {
            // 해제
            user.equippedAccessories[equippedSlot] = null;
            await user.save();
            
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔓 장신구 해제')
                .setDescription(`${selectedItem.emoji} **${selectedItem.name}**을(를) 해제했습니다.`)
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: []
            });
            
            // 2초 후 인벤토리로 돌아가기
            setTimeout(async () => {
                await showAccessoryInventory(interaction);
            }, 2000);
        } else {
            // 장착
            // 빈 슬롯 찾기
            let availableSlot = null;
            for (const slot of targetSlots) {
                if (!user.equippedAccessories[slot]) {
                    availableSlot = slot;
                    break;
                }
            }

            if (!availableSlot) {
                // 모든 슬롯이 차있으면 교체 선택
                const replaceEmbed = new EmbedBuilder()
                    .setColor('#FFFF00')
                    .setTitle('⚠️ 슬롯이 가득 참')
                    .setDescription(`${selectedItem.emoji} **${selectedItem.name}**을(를) 장착하려면 기존 장비를 교체해야 합니다.`)
                    .setTimestamp();

                const buttons = new ActionRowBuilder();
                targetSlots.forEach((slot, idx) => {
                    const equipped = user.equippedAccessories[slot];
                    buttons.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`replace_accessory_${itemIndex}_${slot}`)
                            .setLabel(`${equipped.name} 교체`)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(equipped.emoji)
                    );
                });

                buttons.addComponents(
                    new ButtonBuilder()
                        .setCustomId('accessory_inventory')
                        .setLabel('취소')
                        .setStyle(ButtonStyle.Secondary)
                );

                return await interaction.editReply({
                    embeds: [replaceEmbed],
                    components: [buttons]
                });
            } else {
                // 장착
                user.equippedAccessories[availableSlot] = {
                    id: selectedItem.id,
                    name: selectedItem.name,
                    emoji: selectedItem.emoji,
                    slotType: selectedItem.slotType,
                    setId: selectedItem.setId,
                    setName: selectedItem.setName,
                    tier: selectedItem.tier,
                    stats: selectedItem.stats,
                    obtainedAt: selectedItem.obtainedAt
                };
                
                await user.save();

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ 장신구 장착')
                    .setDescription(`${selectedItem.emoji} **${selectedItem.name}**을(를) 장착했습니다.`)
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [embed],
                    components: []
                });
                
                // 2초 후 인벤토리로 돌아가기
                setTimeout(async () => {
                    await showAccessoryInventory(interaction);
                }, 2000);
            }
        }
    } catch (error) {
        console.error('[Accessory Inventory] Equip error:', error);
        return await interaction.editReply({ 
            content: '❌ 장신구 장착 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 장신구 교체 처리
async function handleAccessoryReplace(interaction, itemIndex, slot) {
    try {
        await interaction.deferUpdate();

        const user = await getUser(interaction.user.id);
        const accessories = user.accessoryInventory || [];
        const selectedItem = accessories[itemIndex];

        if (!selectedItem) {
            return await interaction.editReply({
                content: '❌ 잘못된 아이템 선택입니다.',
                embeds: [],
                components: []
            });
        }

        // 기존 장비 해제하고 새 장비 장착
        user.equippedAccessories[slot] = {
            id: selectedItem.id,
            name: selectedItem.name,
            emoji: selectedItem.emoji,
            slotType: selectedItem.slotType,
            setId: selectedItem.setId,
            setName: selectedItem.setName,
            tier: selectedItem.tier,
            stats: selectedItem.stats,
            obtainedAt: selectedItem.obtainedAt
        };
        
        await user.save();

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🔄 장신구 교체')
            .setDescription(`${selectedItem.emoji} **${selectedItem.name}**을(를) 장착했습니다.`)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });
        
        // 2초 후 인벤토리로 돌아가기
        setTimeout(async () => {
            await showAccessoryInventory(interaction);
        }, 2000);
    } catch (error) {
        console.error('[Accessory Inventory] Replace error:', error);
        return await interaction.editReply({ 
            content: '❌ 장신구 교체 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 전체 장신구 해제
async function unequipAllAccessories(interaction) {
    try {
        await interaction.deferUpdate();

        const user = await getUser(interaction.user.id);
        
        // 모든 슬롯 비우기
        user.equippedAccessories = {
            ring1: null,
            ring2: null,
            necklace: null,
            bracelet1: null,
            bracelet2: null,
            earring1: null,
            earring2: null
        };
        
        await user.save();

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔓 전체 해제 완료')
            .setDescription('모든 장신구를 해제했습니다.')
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });
        
        // 2초 후 인벤토리로 돌아가기
        setTimeout(async () => {
            await showAccessoryInventory(interaction);
        }, 2000);
    } catch (error) {
        console.error('[Accessory Inventory] Unequip all error:', error);
        return await interaction.editReply({ 
            content: '❌ 전체 해제 중 오류가 발생했습니다.', 
            embeds: [],
            components: []
        });
    }
}

// 인터랙션 핸들러
async function handleAccessoryInventoryInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'accessory_inventory') {
        return await showAccessoryInventory(interaction);
    }
    else if (customId === 'accessory_select') {
        const itemIndex = parseInt(interaction.values[0]);
        return await handleAccessoryEquip(interaction, itemIndex);
    }
    else if (customId.startsWith('accessory_inv_prev_') || customId.startsWith('accessory_inv_next_')) {
        const page = parseInt(customId.split('_').pop());
        return await showAccessoryInventory(interaction, page);
    }
    else if (customId.startsWith('replace_accessory_')) {
        const parts = customId.split('_');
        const itemIndex = parseInt(parts[2]);
        const slot = parts.slice(3).join('_');
        return await handleAccessoryReplace(interaction, itemIndex, slot);
    }
    else if (customId === 'unequip_all_accessories') {
        return await unequipAllAccessories(interaction);
    }
}

module.exports = {
    showAccessoryInventory,
    handleAccessoryInventoryInteraction
};