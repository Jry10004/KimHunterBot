const { saveUser, getUser } = require('../common/utils');
const { showProfile } = require('./profile');
const { showInventory, showItemDetail, equipItem } = require('./inventory');
const { showStatDistribution } = require('./statDistribution');
const { showEquipment } = require('./equipment');
const { showEmblem, showEmblemShop, showEmblemEnhance, handleEmblemPurchase } = require('./emblem');

// 이벤트 및 상호작용 핸들러
async function handleCharacterInteraction(interaction) {
    const customId = interaction.customId;
    console.log(`[Character Handler] Processing interaction: ${customId}`);
    
    // 프로필 관련
    if (customId === 'profile') {
        return await showProfile(interaction);
    }
    else if (customId === 'profile_page_1') {
        return await showProfile(interaction, 1);
    }
    else if (customId === 'profile_page_2') {
        return await showProfile(interaction, 2);
    }
    
    // 인벤토리 관련
    else if (customId === 'inventory') {
        return await showInventory(interaction);
    }
    else if (customId.startsWith('inventory_page_')) {
        const page = parseInt(customId.split('_')[2]);
        return await showInventory(interaction, page);
    }
    else if (customId === 'inventory_item_select') {
        // 아이템 선택 시 바로 상세보기
        const selectedIndex = parseInt(interaction.values[0]);
        return await showItemDetail(interaction, selectedIndex);
    }
    else if (customId === 'inventory_sort') {
        return await showInventory(interaction, 1, 'sorted');
    }
    
    // 스탯 관련
    else if (customId === 'stat_distribution') {
        return await showStatDistribution(interaction);
    }
    else if (customId === 'stat_add_custom') {
        console.log('[Character Handler] stat_add_custom 버튼 클릭됨');
        const { showCustomStatModal } = require('./statDistribution');
        console.log('[Character Handler] showCustomStatModal 함수 호출 시작');
        return await showCustomStatModal(interaction);
    }
    else if (customId.startsWith('stat_add_')) {
        const statName = customId.replace('stat_add_', '');
        const { addStatPoint } = require('./statDistribution');
        return await addStatPoint(interaction, statName);
    }
    else if (customId === 'stat_custom_modal') {
        console.log('[Character Handler] stat_custom_modal 모달 제출 처리 시작');
        const { handleCustomStatDistribution } = require('./statDistribution');
        return await handleCustomStatDistribution(interaction);
    }
    else if (customId.startsWith('stat_custom_')) {
        console.log('[Character Handler] 커스텀 스탯 버튼 처리:', customId);
        const { handleCustomStatButton } = require('./statDistribution');
        return await handleCustomStatButton(interaction, customId);
    }
    else if (customId === 'stat_reset') {
        const { showStatResetConfirm } = require('./statDistribution');
        return await showStatResetConfirm(interaction);
    }
    else if (customId === 'stat_reset_confirm') {
        const { executeStatReset } = require('./statDistribution');
        return await executeStatReset(interaction);
    }
    else if (customId === 'stat_reset_cancel') {
        return await showStatDistribution(interaction);
    }
    
    // 장비 관련
    else if (customId === 'equipment') {
        return await showEquipment(interaction);
    }
    else if (customId.startsWith('equipment_slot_')) {
        const { handleEquipmentSlotSelect } = require('./equipment');
        return await handleEquipmentSlotSelect(interaction);
    }
    else if (customId.startsWith('equip_item_')) {
        const { handleEquipItem } = require('./equipment');
        return await handleEquipItem(interaction);
    }
    else if (customId === 'equipment_back') {
        return await showEquipment(interaction);
    }
    else if (customId.startsWith('unequip_')) {
        const { handleUnequip } = require('./equipment');
        return await handleUnequip(interaction);
    }
    else if (customId === 'optimize_equipment') {
        console.log('[Character Handler] optimize_equipment 처리 시작');
        const { optimizeEquipment } = require('./equipment');
        const result = await optimizeEquipment(interaction);
        console.log('[Character Handler] optimize_equipment 처리 완료');
        return result;
    }
    else if (customId === 'equip_category') {
        console.log('[Character Handler] equip_category 처리 시작');
        const { showEquipCategory } = require('./equipment');
        const result = await showEquipCategory(interaction);
        console.log('[Character Handler] equip_category 처리 완료');
        return result;
    }
    else if (customId === 'unequip_all') {
        const { unequipAll } = require('./equipment');
        return await unequipAll(interaction);
    }
    else if (customId === 'equip_slot_select') {
        console.log('[Character Handler] equip_slot_select 처리 시작');
        const slot = interaction.values[0];
        console.log('[Character Handler] 선택된 슬롯:', slot);
        
        // 악세서리 카테고리인 경우
        if (slot === 'accessory_category') {
            const { showAccessorySlots } = require('./equipment');
            return await showAccessorySlots(interaction);
        }
        
        const { showEquippableItems } = require('./equipment');
        const result = await showEquippableItems(interaction, slot);
        console.log('[Character Handler] equip_slot_select 처리 완료');
        return result;
    }
    else if (customId === 'accessory_slot_select') {
        console.log('[Character Handler] accessory_slot_select 처리 시작');
        const slot = interaction.values[0];
        console.log('[Character Handler] 선택된 악세서리 슬롯:', slot);
        const { showEquippableItems } = require('./equipment');
        const result = await showEquippableItems(interaction, slot, 1, true);
        console.log('[Character Handler] accessory_slot_select 처리 완료');
        return result;
    }
    else if (customId.startsWith('equip_page_')) {
        const parts = customId.split('_');
        const slot = parts[2];
        const page = parseInt(parts[3]);
        const { showEquippableItems } = require('./equipment');
        return await showEquippableItems(interaction, slot, page);
    }
    
    // 엠블럼 관련
    else if (customId === 'emblem') {
        return await showEmblem(interaction);
    }
    else if (customId === 'emblem_menu') {
        return await showEmblem(interaction);
    }
    else if (customId === 'emblem_shop') {
        const { showPersonalEmblemShop } = require('../../systems/emblemShop');
        const user = await getUser(interaction.user.id);
        return await showPersonalEmblemShop(interaction, user);
    }
    else if (customId.startsWith('buy_emblem_')) {
        return await handleEmblemPurchase(interaction);
    }
    else if (customId.startsWith('evolve_emblem_')) {
        // evolveEmblem 함수가 없으므로 제거 또는 다른 처리
        return;
    }
    else if (customId === 'emblem_evolve') {
        // 엠블럼 진화는 구매로 처리됨
        const { showPersonalEmblemShop } = require('../../systems/emblemShop');
        const user = await getUser(interaction.user.id);
        return await showPersonalEmblemShop(interaction, user);
    }
    else if (customId === 'emblem_enhance') {
        const { showEmblemEnhance } = require('./emblem');
        return await showEmblemEnhance(interaction);
    }
    else if (customId === 'emblem_enhance_try') {
        const { tryEnhanceEmblem } = require('../../systems/emblemEnhancement');
        return await tryEnhanceEmblem(interaction);
    }
    else if (customId === 'emblem_enhance_try_10') {
        const { tryEnhanceEmblem } = require('../../systems/emblemEnhancement');
        return await tryEnhanceEmblem(interaction, 10);
    }
    else if (customId === 'emblem_enhance_try_max') {
        const { tryEnhanceEmblem } = require('../../systems/emblemEnhancement');
        return await tryEnhanceEmblem(interaction, 'max');
    }
    else if (customId === 'emblem_shop_back') {
        const { handleEmblemShopInteraction } = require('../../systems/emblemShop');
        const { getUser, saveUser } = require('../common/utils');
        return await handleEmblemShopInteraction(interaction, getUser, saveUser);
    }
    else if (customId === 'emblem_enhance_info') {
        try {
            await interaction.deferUpdate();
            await interaction.followUp({
                content: '📊 **엠블럼 강화 정보**\n\n' +
                        '**✨ 강화 확률 (주요 구간)**\n' +
                        '```\n' +
                        '0강 → 1강: 100%\n' +
                        '5강 → 6강: 70%\n' +
                        '9강 → 10강: 55%\n' +
                        '10강 → 11강: 50%\n' +
                        '20강 → 21강: 30%\n' +
                        '30강 → 31강: 10%\n' +
                        '50강 → 51강: 3%\n' +
                        '70강 → 71강: 1%\n' +
                        '90강 → 91강: 0.3%\n' +
                        '```\n\n' +
                        '**💔 실패 시**\n' +
                        '• 70% - 레벨 유지\n' +
                        '• 29.9% - 1레벨 하락\n' +
                        '• 0.1% - 0강으로 초기화\n\n' +
                        '**🎯 강화 보너스**\n' +
                        '• 10강마다 추가 스탯 보너스\n' +
                        '• 100강 달성 시 특별 보너스!',
                flags: 64
            });
        } catch (error) {
            console.error('엠블럼 강화 정보 오류:', error);
        }
        return;
    }
    else if (customId === 'emblem_enhance_ranking') {
        try {
            await interaction.deferUpdate();
            const User = require('../../models/User');
            const { EmbedBuilder } = require('discord.js');
            
            // 모든 유저 중 엠뺔럼 강화 레벨이 있는 유저만 필터링
            const allUsers = await User.find({ 
                'emblemEnhancement.level': { $gt: 0 },
                'emblem': { $exists: true, $ne: null }
            })
            .sort({ 'emblemEnhancement.level': -1 })
            .limit(10);
            
            if (allUsers.length === 0) {
                await interaction.followUp({
                    content: '🏆 아직 강화를 시도한 유저가 없습니다!',
                    flags: 64
                });
                return;
            }
            
            const rankingEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏆 엠블럼 강화 랭킹')
                .setDescription('TOP 10 강화 랭커');
                
            const rankingText = allUsers.map((u, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                return `${medal} **${u.nickname || '알 수 없음'}** - ${u.emblem} **+${u.emblemEnhancement.level}**`;
            }).join('\n');
            
            rankingEmbed.addFields({
                name: '📊 랭킹',
                value: rankingText || '랭킹 정보 없음',
                inline: false
            });
            
            // 현재 유저의 순위 표시
            const currentUser = await getUser(interaction.user.id);
            if (currentUser?.emblemEnhancement?.level > 0) {
                const userRank = await User.countDocuments({
                    'emblemEnhancement.level': { $gt: currentUser.emblemEnhancement.level }
                }) + 1;
                
                rankingEmbed.addFields({
                    name: '🎯 내 순위',
                    value: `${userRank}위 - ${currentUser.emblem} **+${currentUser.emblemEnhancement.level}**`,
                    inline: false
                });
            }
            
            rankingEmbed.setFooter({ text: '🔥 강화를 통해 더 높은 순위에 도전하세요!' });
            
            await interaction.followUp({
                embeds: [rankingEmbed],
                flags: 64
            });
        } catch (error) {
            console.error('엠블럼 강화 랭킹 오류:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '🚨 랭킹 조회 중 오류가 발생했습니다.', flags: 64 });
                } else {
                    await interaction.followUp({ content: '🚨 랭킹 조회 중 오류가 발생했습니다.', flags: 64 });
                }
            } catch (replyError) {
                console.error('에러 응답 실패:', replyError);
            }
        }
        return;
    }
    else if (customId === 'emblem_use_blessing') {
        const { enhanceEmblemWithScroll } = require('./emblem');
        return await enhanceEmblemWithScroll(interaction, 'blessing');
    }
    else if (customId === 'emblem_use_protection') {
        const { enhanceEmblemWithScroll } = require('./emblem');
        return await enhanceEmblemWithScroll(interaction, 'protection');
    }
    
    // 인벤토리 아이템 상세
    if (customId.startsWith('item_detail_')) {
        const itemIndex = parseInt(customId.split('_')[2]);
        return await showItemDetail(interaction, itemIndex);
    }
    else if (customId.startsWith('item_equip_')) {
        const { equipItemFromInventory } = require('./inventory');
        const itemIndex = parseInt(customId.split('_')[2]);
        return await equipItemFromInventory(interaction, itemIndex);
    }
    else if (customId.startsWith('item_sell_')) {
        const { sellItem } = require('./inventory');
        const itemIndex = parseInt(customId.split('_')[2]);
        return await sellItem(interaction, itemIndex);
    }
    else if (customId.startsWith('item_use_')) {
        const { useItem } = require('./itemUsage');
        const itemIndex = parseInt(customId.split('_')[2]);
        return await useItem(interaction, itemIndex);
    }
    else if (customId === 'inventory_back') {
        return await showInventory(interaction);
    }
}

module.exports = {
    handleCharacterInteraction,
    showProfile,
    showInventory,
    showStatDistribution,
    showEquipment
};