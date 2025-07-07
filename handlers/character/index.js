const { showProfile } = require('./profile');
const { showInventory, showItemDetail } = require('./inventory');
const { showEquipment, showEquipCategory, showEquippableItems } = require('./equipment');
const { showEmblem, showEmblemShop, showEmblemEnhance, enhanceEmblem } = require('./emblem');
const { showStatDistribution, addStatPoint, showCustomStatModal, handleCustomStatDistribution } = require('./statDistribution');

// 캐릭터 인터랙션 핸들러
async function handleCharacterInteraction(interaction) {
    const customId = interaction.customId;
    const value = interaction.values ? interaction.values[0] : null;
    
    // 드롭다운 메뉴 처리
    if (value === 'profile') {
        return await showProfile(interaction);
    }
    else if (value === 'inventory') {
        return await showInventory(interaction);
    }
    else if (value === 'equipment') {
        return await showEquipment(interaction);
    }
    else if (value === 'emblem') {
        return await showEmblem(interaction);
    }
    
    // 버튼 처리
    if (customId === 'stat_distribution') {
        return await showStatDistribution(interaction);
    }
    else if (customId === 'profile') {
        return await showProfile(interaction);
    }
    else if (customId === 'inventory') {
        return await showInventory(interaction);
    }
    else if (customId === 'inventory_sort') {
        // 정렬 버튼 처리 - 정렬된 인벤토리 표시
        return await showInventory(interaction, 0, 'sorted');
    }
    else if (customId === 'equipment') {
        return await showEquipment(interaction);
    }
    else if (customId === 'profile_back' || customId === 'inventory_back' || 
        customId === 'equipment_back' || customId === 'emblem_back' || customId === 'main_menu') {
        // 메인 메뉴로 돌아가기
        const { handleMainInteraction } = require('../../interactionHandler');
        interaction.customId = 'main_menu';
        interaction.isButton = () => true;
        return await handleMainInteraction(interaction);
    }
    
    // 장비 관련
    if (customId === 'optimize_equipment') {
        const { optimizeEquipment } = require('./equipment');
        return await optimizeEquipment(interaction);
    }
    else if (customId === 'equip_category') {
        return await showEquipCategory(interaction);
    }
    else if (customId === 'equip_slot_select' && interaction.values) {
        const slot = interaction.values[0];
        return await showEquippableItems(interaction, slot);
    }
    else if (customId.startsWith('equip_item_') && interaction.values) {
        const { equipItem } = require('./equipment');
        const slot = customId.split('_')[2];
        const itemIndex = parseInt(interaction.values[0]);
        return await equipItem(interaction, slot, itemIndex);
    }
    else if (customId === 'unequip_all') {
        const { unequipAll } = require('./equipment');
        return await unequipAll(interaction);
    }
    else if (customId.startsWith('equip_page_')) {
        // equip_page_슬롯_페이지 형식 파싱
        const parts = customId.split('_');
        const slot = parts[2];
        const page = parseInt(parts[3]);
        return await showEquippableItems(interaction, slot, page);
    }
    
    // 엠블럼 관련
    if (customId === 'emblem_shop') {
        return await showEmblemShop(interaction);
    }
    else if (customId === 'emblem_enhance') {
        return await showEmblemEnhance(interaction);
    }
    else if (customId === 'emblem_enhance_confirm' || customId === 'emblem_enhance_try') {
        return await enhanceEmblem(interaction);
    }
    else if (customId === 'emblem') {
        // 버튼으로 돌아가기 또는 메인 메뉴에서 선택
        return await showEmblem(interaction);
    }
    else if (customId.startsWith('buy_emblem_')) {
        const { handleEmblemPurchase } = require('./emblem');
        return await handleEmblemPurchase(interaction);
    }
    else if (customId === 'emblem_shop_category') {
        // 엠블럼 상점 시스템으로 처리 위임
        const { handleEmblemShopInteraction } = require('../../systems/emblemShop');
        const { getUser, saveUser } = require('../common/utils');
        return await handleEmblemShopInteraction(interaction, getUser, saveUser);
    }
    else if (customId === 'emblem_shop_refresh') {
        const { handleEmblemShopInteraction } = require('../../systems/emblemShop');
        const { getUser, saveUser } = require('../common/utils');
        return await handleEmblemShopInteraction(interaction, getUser, saveUser);
    }
    else if (customId === 'emblem_shop_back') {
        const { handleEmblemShopInteraction } = require('../../systems/emblemShop');
        const { getUser, saveUser } = require('../common/utils');
        return await handleEmblemShopInteraction(interaction, getUser, saveUser);
    }
    else if (customId === 'emblem_enhance_info') {
        await interaction.deferUpdate();
        await interaction.followUp({
            content: '📊 강화 정보\n\n' +
                    '**강화 확률 테이블**\n' +
                    '0~10강: 100% 성공\n' +
                    '11~20강: 90% 성공\n' +
                    '21~30강: 80% 성공\n' +
                    '31~40강: 70% 성공\n' +
                    '41~50강: 60% 성공\n' +
                    '51강+: 더 낮은 확률\n\n' +
                    '⚠️ 실패 시 레벨이 하락할 수 있습니다!',
            flags: 64
        });
        return;
    }
    else if (customId === 'emblem_enhance_ranking') {
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
        return;
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
    else if (customId === 'inventory_item_select' && interaction.values) {
        const itemIndex = parseInt(interaction.values[0]);
        return await showItemDetail(interaction, itemIndex);
    }
    else if (customId.startsWith('inventory_page_')) {
        const page = parseInt(customId.split('_')[2]);
        return await showInventory(interaction, page);
    }
    
    // 스탯 분배 관련
    if (customId === 'stat_add_custom') {
        return await showCustomStatModal(interaction);
    }
    else if (customId.startsWith('stat_add_')) {
        const statName = customId.replace('stat_add_', '');
        return await addStatPoint(interaction, statName);
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
    
    // 모달 처리
    if (customId === 'stat_custom_modal') {
        return await handleCustomStatDistribution(interaction);
    }
}

module.exports = {
    // 핸들러
    handleCharacterInteraction,
    
    // 프로필
    showProfile,
    
    // 인벤토리
    showInventory,
    showItemDetail,
    
    // 장비
    showEquipment,
    showEquipCategory,
    showEquippableItems,
    
    // 엠블럼
    showEmblem,
    showEmblemShop,
    showEmblemEnhance,
    enhanceEmblem
};