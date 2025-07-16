// 재료 제작 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');
const { formatNumber } = require('../handlers/common/utils');

// 제작 레시피 데이터
const CRAFTING_RECIPES = {
    // 소모품 제작
    consumables: {
        '체력 물약 (대)': {
            materials: [
                { id: 'slime_jelly', quantity: 5 },
                { id: 'butterfly_dust', quantity: 3 }
            ],
            result: {
                id: 'large_health_potion',
                name: '체력 물약 (대)',
                type: 'consumable',
                effect: 'HP 50% 회복',
                quantity: 3
            },
            craftingTime: 60000, // 1분
            level: 10,
            exp: 50
        },
        '경험치 부스터': {
            materials: [
                { id: 'rainbow_flower', quantity: 3 },
                { id: 'crystal_shard', quantity: 2 }
            ],
            result: {
                id: 'exp_booster',
                name: '경험치 부스터',
                type: 'consumable',
                effect: '30분간 경험치 +50%',
                quantity: 1
            },
            craftingTime: 120000, // 2분
            level: 25,
            exp: 100
        },
        '행운의 부적': {
            materials: [
                { id: 'rabbit_foot', quantity: 10 },
                { id: 'unicorn_hair', quantity: 1 }
            ],
            result: {
                id: 'lucky_charm',
                name: '행운의 부적',
                type: 'consumable',
                effect: '1시간 드롭률 +30%',
                quantity: 1
            },
            craftingTime: 180000, // 3분
            level: 40,
            exp: 200
        }
    },
    
    // 장비 재료 제작
    equipment_materials: {
        '강화석 조합': {
            materials: [
                { id: 'crystal_shard', quantity: 10 },
                { id: 'diamond_dust', quantity: 5 }
            ],
            result: {
                id: 'enhancement_stone',
                name: '고급 강화석',
                type: 'material',
                effect: '장비 강화 재료',
                quantity: 1
            },
            craftingTime: 300000, // 5분
            level: 30,
            exp: 150
        },
        '엠블럼 조각 합성': {
            materials: [
                { id: 'tree_essence', quantity: 5 },
                { id: 'crystal_antler', quantity: 3 },
                { id: 'wolf_fang', quantity: 2 }
            ],
            result: {
                id: 'emblem_fragment_large',
                name: '큰 엠블럼 조각',
                type: 'material',
                effect: '엠블럼 강화 재료 (10개 효과)',
                quantity: 1
            },
            craftingTime: 600000, // 10분
            level: 50,
            exp: 300
        }
    },
    
    // 특수 아이템 제작
    special: {
        '보물 지도': {
            materials: [
                { id: 'owl_feather', quantity: 5 },
                { id: 'monkey_tail', quantity: 3 },
                { id: 'king_crown', quantity: 1 }
            ],
            result: {
                id: 'treasure_map',
                name: '고대의 보물 지도',
                type: 'special',
                effect: '숨겨진 보물 위치 표시',
                quantity: 1
            },
            craftingTime: 1800000, // 30분
            level: 60,
            exp: 500
        },
        '차원의 열쇠': {
            materials: [
                { id: 'diamond_dust', quantity: 10 },
                { id: 'unicorn_hair', quantity: 2 },
                { id: 'king_crown', quantity: 2 }
            ],
            result: {
                id: 'dimension_key',
                name: '차원의 열쇠',
                type: 'special',
                effect: '특별 던전 입장권',
                quantity: 1
            },
            craftingTime: 3600000, // 60분
            level: 70,
            exp: 1000
        }
    }
};

// 재료 제작 메인 메뉴
async function showCraftingMenu(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔨 재료 제작소')
        .setDescription('수집한 재료로 유용한 아이템을 제작하세요!')
        .addFields(
            { name: '📊 제작 레벨', value: `Lv.${user.craftingLevel || 1}`, inline: true },
            { name: '⚡ 제작 경험치', value: `${user.craftingExp || 0}/${(user.craftingLevel || 1) * 100}`, inline: true },
            { name: '🎯 제작 성공률', value: `${calculateSuccessRate(user.craftingLevel || 1)}%`, inline: true }
        );
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`crafting_category_${userId}`)
        .setPlaceholder('제작 카테고리를 선택하세요')
        .addOptions([
            {
                label: '🧪 소모품',
                description: '물약, 부스터 등 소모품 제작',
                value: 'consumables',
                emoji: '🧪'
            },
            {
                label: '⚒️ 장비 재료',
                description: '강화석, 엠블럼 조각 등 제작',
                value: 'equipment_materials',
                emoji: '⚒️'
            },
            {
                label: '✨ 특수 아이템',
                description: '보물 지도, 차원의 열쇠 등 제작',
                value: 'special',
                emoji: '✨'
            }
        ]);
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`crafting_inventory_${userId}`)
                .setLabel('🎒 재료 보관함')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`crafting_history_${userId}`)
                .setLabel('📜 제작 기록')
                .setStyle(ButtonStyle.Secondary)
        );
    
    await interaction.reply({ 
        embeds: [embed], 
        components: [row1, row2],
        flags: 64 
    });
}

// 성공률 계산
function calculateSuccessRate(level) {
    const baseRate = 70;
    const levelBonus = Math.min(level * 0.5, 25); // 최대 25% 보너스
    return Math.min(baseRate + levelBonus, 95); // 최대 95%
}

// 카테고리별 레시피 표시
async function showCategoryRecipes(interaction, category, userId) {
    const user = await User.findOne({ discordId: userId });
    const recipes = CRAFTING_RECIPES[category];
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🔨 ${getCategoryName(category)} 제작`)
        .setDescription('제작할 아이템을 선택하세요');
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`crafting_recipe_${userId}_${category}`)
        .setPlaceholder('제작할 아이템 선택');
    
    for (const [recipeName, recipe] of Object.entries(recipes)) {
        const canCraft = checkMaterials(user, recipe.materials);
        const levelMet = (user.level || 1) >= recipe.level;
        
        let description = `필요 레벨: ${recipe.level}\n재료: `;
        recipe.materials.forEach(mat => {
            const hasQuantity = getMaterialQuantity(user, mat.id);
            description += `\n${mat.quantity}개 (보유: ${hasQuantity})`;
        });
        
        embed.addFields({
            name: `${canCraft && levelMet ? '✅' : '❌'} ${recipeName}`,
            value: description,
            inline: true
        });
        
        if (levelMet) {
            selectMenu.addOptions({
                label: recipeName,
                value: recipeName,
                description: `${recipe.result.effect}`,
                emoji: canCraft ? '✅' : '❌'
            });
        }
    }
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    await interaction.update({ 
        embeds: [embed], 
        components: [row] 
    });
}

// 재료 확인
function checkMaterials(user, materials) {
    return materials.every(mat => 
        getMaterialQuantity(user, mat.id) >= mat.quantity
    );
}

// 재료 수량 확인
function getMaterialQuantity(user, materialId) {
    const item = user.inventory.find(i => 
        i.id === materialId && i.type === 'material'
    );
    return item ? (item.quantity || 1) : 0;
}

// 카테고리 이름 가져오기
function getCategoryName(category) {
    const names = {
        consumables: '소모품',
        equipment_materials: '장비 재료',
        special: '특수 아이템'
    };
    return names[category] || category;
}

// 아이템 제작
async function craftItem(interaction, category, recipeName, userId) {
    const user = await User.findOne({ discordId: userId });
    const recipe = CRAFTING_RECIPES[category][recipeName];
    
    if (!recipe) {
        return await interaction.reply({ 
            content: '❌ 잘못된 레시피입니다.', 
            flags: 64 
        });
    }
    
    // 레벨 확인
    if ((user.level || 1) < recipe.level) {
        return await interaction.reply({ 
            content: `❌ 레벨 ${recipe.level} 이상이 필요합니다.`, 
            flags: 64 
        });
    }
    
    // 재료 확인
    if (!checkMaterials(user, recipe.materials)) {
        return await interaction.reply({ 
            content: '❌ 재료가 부족합니다.', 
            flags: 64 
        });
    }
    
    // 재료 소모
    for (const mat of recipe.materials) {
        const item = user.inventory.find(i => 
            i.id === mat.id && i.type === 'material'
        );
        if (item) {
            item.quantity = (item.quantity || 1) - mat.quantity;
            if (item.quantity <= 0) {
                user.inventory = user.inventory.filter(i => i !== item);
            }
        }
    }
    
    // 성공률 계산
    const successRate = calculateSuccessRate(user.craftingLevel || 1);
    const isSuccess = Math.random() * 100 < successRate;
    
    const embed = new EmbedBuilder()
        .setTitle('🔨 제작 중...')
        .setDescription(`${recipeName} 제작을 시작합니다...`)
        .setColor('#FFD700');
    
    await interaction.reply({ embeds: [embed], flags: 64 });
    
    // 제작 시간 대기
    setTimeout(async () => {
        if (isSuccess) {
            // 제작 성공
            const result = recipe.result;
            
            // 아이템 추가
            if (result.type === 'material' && result.id === 'emblem_fragment_large') {
                // 큰 엠블럼 조각은 일반 조각 10개로 변환
                user.emblemFragments = (user.emblemFragments || 0) + 10;
            } else {
                // 일반 아이템은 인벤토리에 추가
                const newItem = {
                    id: result.id,
                    name: result.name,
                    type: result.type,
                    quantity: result.quantity,
                    effect: result.effect,
                    inventorySlot: user.inventory.length
                };
                user.inventory.push(newItem);
            }
            
            // 경험치 추가
            user.craftingExp = (user.craftingExp || 0) + recipe.exp;
            
            // 레벨업 체크
            const expNeeded = (user.craftingLevel || 1) * 100;
            if (user.craftingExp >= expNeeded) {
                user.craftingLevel = (user.craftingLevel || 1) + 1;
                user.craftingExp -= expNeeded;
            }
            
            await user.save();
            
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ 제작 성공!')
                .setDescription(`${recipeName} 제작에 성공했습니다!`)
                .setColor('#00FF00')
                .addFields(
                    { name: '🎁 획득 아이템', value: `${result.name} x${result.quantity}`, inline: true },
                    { name: '⚡ 획득 경험치', value: `+${recipe.exp} EXP`, inline: true }
                );
            
            await interaction.followUp({ embeds: [successEmbed], flags: 64 });
        } else {
            // 제작 실패
            await user.save();
            
            const failEmbed = new EmbedBuilder()
                .setTitle('❌ 제작 실패')
                .setDescription('아쉽게도 제작에 실패했습니다...')
                .setColor('#FF0000')
                .addFields(
                    { name: '💔 실패 원인', value: '제작 과정에서 실수가 발생했습니다', inline: true },
                    { name: '📊 성공률', value: `${successRate}%`, inline: true }
                );
            
            await interaction.followUp({ embeds: [failEmbed], flags: 64 });
        }
    }, 3000); // 3초 대기
}

// 재료 보관함 표시
async function showMaterialInventory(interaction, userId) {
    const user = await User.findOne({ discordId: userId });
    
    const materials = user.inventory.filter(item => item.type === 'material');
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎒 재료 보관함')
        .setDescription(`보유 중인 재료: ${materials.length}종`);
    
    if (materials.length === 0) {
        embed.addFields({
            name: '📦 보관함이 비어있습니다',
            value: '사냥을 통해 재료를 수집하세요!'
        });
    } else {
        // 재료를 레어도별로 정렬
        const sortedMaterials = materials.sort((a, b) => {
            const rarityOrder = ['일반', '고급', '레어', '에픽', '레전드리', '신화'];
            return rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
        });
        
        let materialList = '';
        sortedMaterials.forEach(mat => {
            const emoji = getEmojiByRarity(mat.rarity);
            materialList += `${emoji} **${mat.name}** x${mat.quantity || 1}\n`;
        });
        
        embed.addFields({
            name: '📋 보유 재료',
            value: materialList.slice(0, 1024) // Discord 필드 제한
        });
    }
    
    await interaction.update({ embeds: [embed], components: [] });
}

// 레어도별 이모지
function getEmojiByRarity(rarity) {
    const emojis = {
        '일반': '⚪',
        '고급': '🟢',
        '레어': '🔵',
        '에픽': '🟣',
        '레전드리': '🟡',
        '신화': '🔴'
    };
    return emojis[rarity] || '⚪';
}

module.exports = {
    showCraftingMenu,
    showCategoryRecipes,
    craftItem,
    showMaterialInventory
};