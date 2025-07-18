const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const EXERCISE_SYSTEM = require('../../data/exerciseSystem');

// 락커룸 메인 화면
async function showLockerRoom(interaction) {
    // Defer if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton()) {
            await interaction.deferUpdate();
        } else {
            await interaction.deferReply({ flags: 64 });
        }
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }
    
    // fitness.exerciseInventory 초기화
    if (!user.fitness) {
        user.fitness = {
            level: 1,
            exp: 0,
            totalExerciseTime: 0,
            lastExercise: null,
            streak: 0,
            fatigue: 0,
            lastFatigueUpdate: Date.now(),
            equipment: {
                clothes: 'basic',
                shoes: 'basic'
            },
            activeSupplements: [],
            exerciseHistory: [],
            exerciseInventory: []
        };
        await user.save();
    }
    
    if (!user.fitness.exerciseInventory) {
        user.fitness.exerciseInventory = [];
        await user.save();
    }
    
    const embed = new EmbedBuilder()
        .setColor('#4B0082')
        .setTitle('🚪 락커룸')
        .setDescription('운동 장비를 관리하고 보충제를 사용할 수 있습니다.')
        .setThumbnail('https://i.imgur.com/7KJxZxQ.png'); // 락커룸 이미지
    
    // 장비류 필터링
    const equipment = user.fitness.exerciseInventory.filter(item => item.type === 'equipment');
    const supplements = user.fitness.exerciseInventory.filter(item => 
        item.type === 'supplement' && 
        (!item.expiresAt || new Date(item.expiresAt) > new Date())
    );
    const specialItems = user.fitness.exerciseInventory.filter(item => 
        item.type === 'gym_pass' || item.type === 'time_extension' || item.type === 'fatigue_reset'
    );
    
    // 현재 장착된 장비 표시
    const equippedItems = equipment.filter(item => item.equipped);
    if (equippedItems.length > 0) {
        const equippedText = equippedItems.map(item => 
            `${item.emoji || '🎽'} **${item.name}**\n└ ${getEquipmentEffect(item)}`
        ).join('\n\n');
        
        embed.addFields({
            name: '🎽 현재 장착 중',
            value: equippedText || '없음',
            inline: false
        });
    }
    
    // 보유 장비
    if (equipment.length > 0) {
        const equipmentText = equipment.map((item, index) => {
            const equipped = item.equipped ? ' 🔸장착중' : '';
            return `**${index + 1}.** ${item.emoji || '🎽'} ${item.name}${equipped}\n└ ${getEquipmentEffect(item)}`;
        }).join('\n');
        
        embed.addFields({
            name: '🎒 보유 장비',
            value: equipmentText || '없음',
            inline: false
        });
    } else {
        embed.addFields({
            name: '🎒 보유 장비',
            value: '보유한 장비가 없습니다.\n운동 용품점에서 구매할 수 있습니다.',
            inline: false
        });
    }
    
    // 보충제
    if (supplements.length > 0) {
        const supplementText = supplements.map((item, index) => {
            const remainingTime = new Date(item.expiresAt) - new Date();
            const hours = Math.floor(remainingTime / 3600000);
            const minutes = Math.floor((remainingTime % 3600000) / 60000);
            return `**${equipment.length + index + 1}.** ${item.emoji || '🥤'} ${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}\n└ ${getSupplementEffect(item)} (${hours}시간 ${minutes}분)`;
        }).join('\n');
        
        embed.addFields({
            name: '🥤 보충제',
            value: supplementText || '없음',
            inline: false
        });
    }
    
    // 특수 아이템
    if (specialItems.length > 0) {
        const specialText = specialItems.map((item, index) => {
            let statusText = '';
            if (item.name === '헬스장 VIP 회원권' && user.fitness.permanentGymAccess) {
                statusText = ' ✅ 활성화됨';
            }
            return `${item.emoji || '🎫'} ${item.name}${statusText}`;
        }).join('\n');
        
        embed.addFields({
            name: '🎫 특수 아이템',
            value: specialText || '없음',
            inline: false
        });
    }
    
    // 버튼 생성
    const buttons = [];
    
    // 장비가 있으면 장비 관리 버튼
    if (equipment.length > 0) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId('locker_equip_manage')
                .setLabel('🎽 장비 관리')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    // 보충제가 있으면 사용 버튼
    if (supplements.length > 0) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId('locker_use_supplement')
                .setLabel('🥤 보충제 사용')
                .setStyle(ButtonStyle.Success)
        );
    }
    
    buttons.push(
        new ButtonBuilder()
            .setCustomId('exercise_menu')
            .setLabel('🏃 운동하러 가기')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('exercise_gym_shop')
            .setLabel('🏪 운동 용품점')
            .setStyle(ButtonStyle.Secondary)
    );
    
    const buttonRow = new ActionRowBuilder().addComponents(buttons);
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttonRow]
    });
}

// 장비 관리
async function showEquipmentManagement(interaction) {
    const user = await getUser(interaction.user.id);
    const equipment = user.fitness.exerciseInventory.filter(item => item.type === 'equipment');
    
    if (equipment.length === 0) {
        return await interaction.reply({
            content: '❌ 보유한 장비가 없습니다!',
            flags: 64
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#4B0082')
        .setTitle('🎽 장비 관리')
        .setDescription('장착할 장비를 선택하세요. 한 번에 여러 개의 장비를 장착할 수 있습니다.');
    
    // 장비 목록 생성
    const options = equipment.map((item, index) => ({
        label: item.name,
        description: `${getEquipmentEffect(item)} ${item.equipped ? '(장착중)' : ''}`,
        value: index.toString(),
        emoji: item.emoji || '🎽',
        default: item.equipped || false
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('locker_equip_select')
        .setPlaceholder('장착/해제할 장비를 선택하세요')
        .addOptions(options)
        .setMinValues(0)
        .setMaxValues(equipment.length);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, backButton]
    });
}

// 보충제 사용
async function showSupplementMenu(interaction) {
    const user = await getUser(interaction.user.id);
    const supplements = user.fitness.exerciseInventory.filter(item => 
        item.type === 'supplement' && 
        (!item.expiresAt || new Date(item.expiresAt) > new Date())
    );
    
    if (supplements.length === 0) {
        return await interaction.reply({
            content: '❌ 사용 가능한 보충제가 없습니다!',
            flags: 64
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🥤 보충제 사용')
        .setDescription('사용할 보충제를 선택하세요.')
        .addFields({
            name: '😫 현재 피로도',
            value: `${user.fitness.fatigue}/100`,
            inline: true
        });
    
    // 보충제별로 그룹화
    const supplementGroups = {};
    supplements.forEach(item => {
        if (!supplementGroups[item.name]) {
            supplementGroups[item.name] = {
                count: 0,
                item: item
            };
        }
        supplementGroups[item.name].count += item.quantity || 1;
    });
    
    const options = Object.entries(supplementGroups).map(([name, data]) => ({
        label: `${name} (${data.count}개)`,
        description: getSupplementEffect(data.item),
        value: name,
        emoji: data.item.emoji || '🥤'
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('locker_supplement_select')
        .setPlaceholder('사용할 보충제를 선택하세요')
        .addOptions(options);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [row, backButton]
    });
}

// 장비 효과 표시
function getEquipmentEffect(item) {
    if (!item.effect) return '효과 없음';
    
    const effects = [];
    if (item.effect.allEfficiency) {
        effects.push(`모든 운동 효율 +${Math.round((item.effect.allEfficiency - 1) * 100)}%`);
    }
    if (item.effect.cardioEfficiency) {
        effects.push(`유산소 운동 효율 +${Math.round((item.effect.cardioEfficiency - 1) * 100)}%`);
    }
    if (item.effect.strengthEfficiency) {
        effects.push(`힘 운동 효율 +${Math.round((item.effect.strengthEfficiency - 1) * 100)}%`);
    }
    if (item.effect.expBonus) {
        effects.push(`경험치 획득 +${Math.round((item.effect.expBonus - 1) * 100)}%`);
    }
    if (item.effect.statMultiplier) {
        effects.push(`스탯 증가량 +${Math.round((item.effect.statMultiplier - 1) * 100)}%`);
    }
    
    return effects.join(', ') || '효과 없음';
}

// 보충제 효과 표시
function getSupplementEffect(item) {
    if (!item.effect) {
        // 즉시 사용 아이템
        if (item.name === '에너지 드링크') return '즉시 피로도 -20';
        if (item.name === '울트라 에너지') return '즉시 피로도 -50';
        return '효과 없음';
    }
    
    const effects = [];
    if (item.effect.efficiency) {
        effects.push(`운동 효율 +${Math.round((item.effect.efficiency - 1) * 100)}%`);
    }
    
    return effects.join(', ') || '효과 없음';
}

// 장비 장착/해제 처리
async function handleEquipmentSelection(interaction) {
    const user = await getUser(interaction.user.id);
    const selectedIndices = interaction.values.map(v => parseInt(v));
    const equipment = user.fitness.exerciseInventory.filter(item => item.type === 'equipment');
    
    // 모든 장비 해제
    equipment.forEach(item => {
        item.equipped = false;
    });
    
    // 선택된 장비 장착
    selectedIndices.forEach(index => {
        if (equipment[index]) {
            equipment[index].equipped = true;
        }
    });
    
    await user.save();
    
    const equippedCount = selectedIndices.length;
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 장비 설정 완료')
        .setDescription(`${equippedCount}개의 장비를 장착했습니다.`);
    
    if (equippedCount > 0) {
        const equippedItems = selectedIndices.map(index => 
            `${equipment[index].emoji || '🎽'} ${equipment[index].name}`
        ).join('\n');
        
        embed.addFields({
            name: '장착된 장비',
            value: equippedItems,
            inline: false
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🚪 락커룸으로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🏃 운동하러 가기')
                .setStyle(ButtonStyle.Success)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 보충제 사용 처리
async function handleSupplementUse(interaction) {
    const user = await getUser(interaction.user.id);
    const supplementName = interaction.values[0];
    
    // 해당 보충제 찾기
    const supplementIndex = user.fitness.exerciseInventory.findIndex(item => 
        item.type === 'supplement' && 
        item.name === supplementName &&
        (!item.expiresAt || new Date(item.expiresAt) > new Date())
    );
    
    if (supplementIndex === -1) {
        return await interaction.reply({
            content: '❌ 해당 보충제를 찾을 수 없습니다!',
            flags: 64
        });
    }
    
    const supplement = user.fitness.exerciseInventory[supplementIndex];
    let message = '';
    
    // 보충제 효과 적용
    switch(supplement.name) {
        case '에너지 드링크':
            user.fitness.fatigue = Math.max(0, user.fitness.fatigue - 20);
            message = '에너지 드링크를 마셨습니다! 피로도가 20 감소했습니다.';
            break;
        case '울트라 에너지':
            user.fitness.fatigue = Math.max(0, user.fitness.fatigue - 50);
            message = '울트라 에너지를 마셨습니다! 피로도가 50 감소했습니다.';
            break;
        case '프로틴 쉐이크':
        case '슈퍼 프로틴':
            message = `${supplement.name}을(를) 사용했습니다! 운동 효율이 증가합니다.`;
            break;
        default:
            message = `${supplement.name}을(를) 사용했습니다!`;
    }
    
    // 수량 감소 또는 제거
    if (supplement.quantity > 1) {
        supplement.quantity--;
    } else {
        user.fitness.exerciseInventory.splice(supplementIndex, 1);
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ 보충제 사용')
        .setDescription(message)
        .addFields({
            name: '😌 현재 피로도',
            value: `${user.fitness.fatigue}/100`,
            inline: true
        });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🚪 락커룸으로')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🏃 운동하러 가기')
                .setStyle(ButtonStyle.Success)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

module.exports = {
    showLockerRoom,
    showEquipmentManagement,
    showSupplementMenu,
    handleEquipmentSelection,
    handleSupplementUse
};