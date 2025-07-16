const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getUser, formatNumber, calculateExpForLevel, getTierEmoji, calculateTier } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const { checkAndProcessLevelUp } = require('../common/levelUp');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');

// 스탯 보너스 표시 헬퍼 함수
function getStatBonus(value) {
    if (!value || value <= 0) return '';
    return ` (+${value})`;
}

async function showProfile(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }
    
    // 레벨업 체크
    const { leveledUp, levelsGained } = await checkAndProcessLevelUp(user);

    // 경험치 계산
    const maxExp = calculateExpForLevel(user.level);
    const expPercentage = Math.floor((user.exp / maxExp) * 100);
    
    // 전투력 계산 (통합 함수 사용)
    const combatPower = calculateCombatPower(user);
    
    // 계산된 전투력이 DB와 다르면 업데이트
    if (user.combatPower !== combatPower) {
        user.combatPower = combatPower;
        await user.save();
    }
    
    // 마법사 엠블럼 확인
    const isMage = user.equippedEmblem && (
        user.equippedEmblem.includes('마법사') || 
        user.equippedEmblem.includes('원소 술사') ||
        user.equippedEmblem.includes('신비한 현자') ||
        user.equippedEmblem.includes('대마법사') ||
        user.equippedEmblem.includes('아크메이지')
    );
    
    const powerLabel = isMage ? '마력' : '전투력';
    const powerEmoji = isMage ? '🔮' : '⚔️';

    // 프로필 임베드
    const profileEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`👤 ${user.nickname || interaction.user.username}님의 프로필`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { 
                name: '📊 기본 정보', 
                value: `**레벨**: ${user.level}\n**경험치**: ${formatNumber(user.exp)}/${formatNumber(maxExp)} (${expPercentage}%)\n**골드**: ${formatNumber(user.gold)}G\n**인기도**: ${formatNumber(user.popularity)}\n**엠블럼**: ${user.emblem || '없음'}`, 
                inline: true 
            },
            { 
                name: `${powerEmoji} 전투 정보`, 
                value: `**${powerLabel}**: ${formatNumber(combatPower)}\n**PVP 레이팅**: ${user.pvp?.rating || 1000}\n**티어**: ${getTierEmoji(calculateTier(user.pvp?.rating || 1000))} ${calculateTier(user.pvp?.rating || 1000)}`, 
                inline: true 
            },
            { 
                name: '📈 기본 스탯', 
                value: `💪 **힘**: ${user.stats?.strength || 10}${getStatBonus(user.emblemEnhancement?.appliedStats?.strength)}\n🏃 **민첩**: ${user.stats?.agility || 10}${getStatBonus(user.emblemEnhancement?.appliedStats?.agility)}\n🧠 **지능**: ${user.stats?.intelligence || 10}${getStatBonus(user.emblemEnhancement?.appliedStats?.intelligence)}\n❤️ **체력**: ${user.stats?.vitality || 10}${getStatBonus(user.emblemEnhancement?.appliedStats?.vitality)}\n🍀 **행운**: ${user.stats?.luck || 10}${getStatBonus(user.emblemEnhancement?.appliedStats?.luck)}\n\n📍 **남은 스탯 포인트**: ${user.statPoints || 0}`, 
                inline: true 
            }
        );

    // 장비 정보 추가
    const equipmentInfo = [];
    const slots = {
        weapon: '🗡️ 무기',
        armor: '🛡️ 갑옷',
        helmet: '⛑️ 투구',
        gloves: '🧤 장갑',
        boots: '👢 신발',
        shield: '🛡️ 방패'
    };

    // getEquippedItem 함수 로컬 구현
    const getEquippedItem = function(user, slot) {
        if (!user.equipment || user.equipment[slot] === undefined || user.equipment[slot] === null || user.equipment[slot] === -1) {
            return null;
        }
        
        const slotIndex = user.equipment[slot];
        if (slotIndex < 0 || !user.inventory) {
            return null;
        }
        
        // inventorySlot으로 먼저 찾기
        let item = user.inventory.find(item => item && item.inventorySlot === slotIndex);
        
        // 못 찾았으면 배열 인덱스로 찾기
        if (!item) {
            item = user.inventory[slotIndex];
        }
        
        if (!item) return null;
        
        // 각 슬롯에 맞는 타입만 장착 가능
        const isValidType = item.type === slot;
        
        if (!isValidType) return null;
        
        return item;
    };

    // 총 장비 능력치 계산
    let totalEquipStats = {
        attack: 0,
        defense: 0,
        strength: 0,
        agility: 0,
        intelligence: 0,
        vitality: 0,
        luck: 0,
        hp: 0,
        dodge: 0
    };

    for (const [slot, emoji] of Object.entries(slots)) {
        const item = getEquippedItem(user, slot);
        if (item && item.name) {
            let itemText = `${emoji}: **${item.name}**`;
            
            // 강화 수치
            if (item.enhancement && item.enhancement > 0) {
                itemText += ` ✨(+${item.enhancement})`;
            }
            
            // 희귀도 표시
            if (item.rarity) {
                const rarityColors = {
                    'legendary': '🟡',
                    'unique': '🟣',
                    'epic': '🔵',
                    'rare': '🟢',
                    'normal': '⚪',
                    'trash': '🔴'
                };
                itemText = `${rarityColors[item.rarity] || '⚪'} ` + itemText;
            }
            
            // 능력치 표시를 더 간단하고 명확하게
            const statText = [];
            let itemCombatPower = 0;
            
            // 스탯 확인 - stats가 없으면 기본 속성 확인
            const itemStats = item.stats || {};
            
            // 구버전 호환성 - stats가 없더라도 기본 속성 확인
            if (!item.stats) {
                if (item.attack !== undefined) itemStats.attack = item.attack;
                if (item.defense !== undefined) itemStats.defense = item.defense;
                if (item.strength !== undefined) itemStats.strength = item.strength;
                if (item.agility !== undefined) itemStats.agility = item.agility;
                if (item.intelligence !== undefined) itemStats.intelligence = item.intelligence;
                if (item.vitality !== undefined) itemStats.vitality = item.vitality;
                if (item.luck !== undefined) itemStats.luck = item.luck;
                if (item.hp !== undefined) itemStats.hp = item.hp;
                if (item.dodge !== undefined) itemStats.dodge = item.dodge;
                if (item.evasion !== undefined) itemStats.dodge = item.evasion; // evasion -> dodge
            }
            
            if (Object.keys(itemStats).length > 0) {
                // 주요 스탯만 표시
                if (itemStats.attack) {
                    const totalAttack = itemStats.attack + (item.enhancement || 0) * 10;
                    statText.push(`공격+${totalAttack}`);
                    totalEquipStats.attack += totalAttack;
                    itemCombatPower += totalAttack * 2;
                }
                if (itemStats.defense) {
                    const totalDefense = itemStats.defense + (item.enhancement || 0) * 10;
                    statText.push(`방어+${totalDefense}`);
                    totalEquipStats.defense += totalDefense;
                    itemCombatPower += totalDefense * 1.5;
                }
                
                // 부가 스탯은 있는 것만 표시
                if (itemStats.strength) {
                    statText.push(`힘+${itemStats.strength}`);
                    totalEquipStats.strength += itemStats.strength;
                    itemCombatPower += itemStats.strength * 2;
                }
                if (itemStats.agility) {
                    statText.push(`민첩+${itemStats.agility}`);
                    totalEquipStats.agility += itemStats.agility;
                    itemCombatPower += itemStats.agility * 1.5;
                }
                if (itemStats.intelligence) {
                    statText.push(`지능+${itemStats.intelligence}`);
                    totalEquipStats.intelligence += itemStats.intelligence;
                    itemCombatPower += itemStats.intelligence * 1.2;
                }
                if (itemStats.vitality) {
                    statText.push(`체력+${itemStats.vitality}`);
                    totalEquipStats.vitality += itemStats.vitality;
                    itemCombatPower += itemStats.vitality * 1.8;
                }
                if (itemStats.luck) {
                    statText.push(`행운+${itemStats.luck}`);
                    totalEquipStats.luck += itemStats.luck;
                    itemCombatPower += itemStats.luck * 0.5;
                }
                if (itemStats.hp) {
                    const totalHp = itemStats.hp + (item.enhancement || 0) * 20;
                    statText.push(`HP+${totalHp}`);
                    totalEquipStats.hp += totalHp;
                    itemCombatPower += totalHp * 0.3;
                }
                if (itemStats.dodge || itemStats.evasion) {
                    const dodgeValue = itemStats.dodge || itemStats.evasion;
                    statText.push(`회피+${dodgeValue}`);
                    totalEquipStats.dodge += dodgeValue;
                    itemCombatPower += dodgeValue * 1;
                }
            }
            
            // 능력치가 있을 때만 표시
            if (statText.length > 0) {
                itemText += `\n　├ ${statText.join(', ')}\n　└ ${powerEmoji} ${powerLabel}: **${Math.floor(itemCombatPower)}**`;
            }
            
            equipmentInfo.push(itemText);
        } else {
            equipmentInfo.push(`${emoji}: 비어있음`);
        }
    }

    // 장비로 인한 전투력 계산
    const equipmentCombatPower = Math.floor(
        (totalEquipStats.attack * 2) + 
        (totalEquipStats.defense * 1.5) + 
        (totalEquipStats.strength * 2) + 
        (totalEquipStats.agility * 1.5) + 
        (totalEquipStats.intelligence * 1.2) + 
        (totalEquipStats.vitality * 1.8) + 
        (totalEquipStats.luck * 0.5) + 
        (totalEquipStats.hp * 0.3) + 
        (totalEquipStats.dodge * 1)
    );
    
    profileEmbed.addFields({
        name: `⚔️ 장착 장비`,
        value: `┌─ 총 ${powerLabel}: **${formatNumber(equipmentCombatPower)}** ─┐\n\n${equipmentInfo.join('\n')}`,
        inline: false
    });

    // 장비 능력치 총합 표시
    const equipStatsSummary = [];
    if (totalEquipStats.attack > 0) equipStatsSummary.push(`⚔️ 공격력 +${totalEquipStats.attack}`);
    if (totalEquipStats.defense > 0) equipStatsSummary.push(`🛡️ 방어력 +${totalEquipStats.defense}`);
    if (totalEquipStats.strength > 0) equipStatsSummary.push(`💪 힘 +${totalEquipStats.strength}`);
    if (totalEquipStats.agility > 0) equipStatsSummary.push(`🏃 민첩 +${totalEquipStats.agility}`);
    if (totalEquipStats.intelligence > 0) equipStatsSummary.push(`🧠 지능 +${totalEquipStats.intelligence}`);
    if (totalEquipStats.vitality > 0) equipStatsSummary.push(`❤️ 체력 +${totalEquipStats.vitality}`);
    if (totalEquipStats.luck > 0) equipStatsSummary.push(`🍀 행운 +${totalEquipStats.luck}`);
    if (totalEquipStats.hp > 0) equipStatsSummary.push(`💖 HP +${totalEquipStats.hp}`);
    if (totalEquipStats.dodge > 0) equipStatsSummary.push(`💨 회피 +${totalEquipStats.dodge}`);

    if (equipStatsSummary.length > 0) {
        profileEmbed.addFields({
            name: '📊 장비 능력치 총합',
            value: `${equipStatsSummary.join(' | ')}`,
            inline: false
        });
    }

    
    // 장착한 장신구 표시
    const accessorySlots = {
        ring1: '💍 반지 1',
        ring2: '💍 반지 2',
        necklace: '📿 목걸이',
        bracelet1: '🔗 팔찌 1',
        bracelet2: '🔗 팔찌 2',
        earring1: '💎 귀걸이 1',
        earring2: '💎 귀걸이 2'
    };

    const accessoryInfo = [];
    let equippedSetCounts = {};
    let hasAnyAccessory = false;
    let totalAccessoryCombatPower = 0;
    let totalAccessoryStats = {
        attack: 0,
        defense: 0,
        hp: 0,
        criticalChance: 0,
        criticalDamage: 0,
        goldBonus: 0,
        expBonus: 0,
        dropRate: 0,
        pvpDamage: 0,
        dodge: 0,
        luck: 0
    };

    // 각 슬롯별로 장착된 장신구 확인
    for (const [slot, slotName] of Object.entries(accessorySlots)) {
        if (user.equippedAccessories && user.equippedAccessories[slot] && user.equippedAccessories[slot].name) {
            const accessory = user.equippedAccessories[slot];
            hasAnyAccessory = true;
            let accessoryText = `${slotName}: **${accessory.name}**`;
            
            // 스탯 표시
            const statText = [];
            let accessoryCombatPower = 0;
            
            if (accessory.stats) {
                // Map을 객체로 변환하여 처리
                const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                
                // 스탯 표시 및 합산
                if (stats.attack) {
                    statText.push(`⚔️+${stats.attack}`);
                    totalAccessoryStats.attack += stats.attack;
                    accessoryCombatPower += stats.attack * 2.5;
                }
                if (stats.defense) {
                    statText.push(`🛡️+${stats.defense}`);
                    totalAccessoryStats.defense += stats.defense;
                    accessoryCombatPower += stats.defense * 1.8;
                }
                if (stats.hp) {
                    statText.push(`❤️+${stats.hp}`);
                    totalAccessoryStats.hp += stats.hp;
                    accessoryCombatPower += stats.hp * 0.4;
                }
                if (stats.criticalChance) {
                    statText.push(`⚡+${stats.criticalChance}%`);
                    totalAccessoryStats.criticalChance += stats.criticalChance;
                    accessoryCombatPower += stats.criticalChance * 5;
                }
                if (stats.criticalDamage) {
                    statText.push(`💥+${stats.criticalDamage}%`);
                    totalAccessoryStats.criticalDamage += stats.criticalDamage;
                    accessoryCombatPower += stats.criticalDamage * 3;
                }
                if (stats.goldBonus) {
                    statText.push(`💰+${stats.goldBonus}%`);
                    totalAccessoryStats.goldBonus += stats.goldBonus;
                }
                if (stats.expBonus) {
                    statText.push(`⭐+${stats.expBonus}%`);
                    totalAccessoryStats.expBonus += stats.expBonus;
                }
                if (stats.dropRate) {
                    statText.push(`🎁+${stats.dropRate}%`);
                    totalAccessoryStats.dropRate += stats.dropRate;
                }
                if (stats.pvpDamage) {
                    statText.push(`⚔️PVP+${stats.pvpDamage}%`);
                    totalAccessoryStats.pvpDamage += stats.pvpDamage;
                    accessoryCombatPower += stats.pvpDamage * 4;
                }
                if (stats.dodge) {
                    statText.push(`💨+${stats.dodge}`);
                    totalAccessoryStats.dodge += stats.dodge;
                    accessoryCombatPower += stats.dodge * 1.2;
                }
                if (stats.luck) {
                    statText.push(`🍀+${stats.luck}`);
                    totalAccessoryStats.luck += stats.luck;
                    accessoryCombatPower += stats.luck * 0.8;
                }
            }
            
            if (statText.length > 0) {
                accessoryText += `\n　├ ${statText.join(' ')}\n　└ ${powerEmoji} ${powerLabel}: **${Math.floor(accessoryCombatPower)}**`;
            }
            
            accessoryInfo.push(accessoryText);
            
            // 세트 카운트
            if (accessory.setId) {
                equippedSetCounts[accessory.setId] = (equippedSetCounts[accessory.setId] || 0) + 1;
            }
        } else {
            accessoryInfo.push(`${slotName}: 비어있음`);
        }
    }

    // 장신구로 인한 전투력 계산
    totalAccessoryCombatPower = Math.floor(
        (totalAccessoryStats.attack * 2.5) + 
        (totalAccessoryStats.defense * 1.8) + 
        (totalAccessoryStats.hp * 0.4) + 
        (totalAccessoryStats.dodge * 1.2) + 
        (totalAccessoryStats.luck * 0.8) +
        (totalAccessoryStats.criticalChance * 5) +
        (totalAccessoryStats.criticalDamage * 3) +
        (totalAccessoryStats.pvpDamage * 4)
    );
    
    // 장신구 섹션은 항상 표시
    let accessoryFieldValue = `┌─ 총 ${powerLabel}: **${formatNumber(totalAccessoryCombatPower)}** ─┐\n\n`;
    accessoryFieldValue += accessoryInfo.join('\n');
    
    if (!hasAnyAccessory) {
        accessoryFieldValue += '\n\n────────────────────────────\n📌 *모든 슬롯이 비어있습니다*';
    }
    
    profileEmbed.addFields({
        name: `💎 장착 장신구`,
        value: accessoryFieldValue,
        inline: false
    });

    // 활성화된 세트 효과 표시
    const activeSetEffects = [];
    for (const [setId, count] of Object.entries(equippedSetCounts)) {
        if (count >= 2) {
            const setInfo = Object.values(BOSS_ACCESSORIES.sets).find(set => set.id === setId);
            if (setInfo) {
                activeSetEffects.push(`**${setInfo.name}** (${count}/4)`);
                
                // 세트 보너스 표시
                if (count >= 2) activeSetEffects.push(`  ▸ 2세트: 기본 보너스 활성화`);
                if (count >= 3) activeSetEffects.push(`  ▸ 3세트: 강화 보너스 활성화`);
                if (count >= 4) activeSetEffects.push(`  ▸ 4세트: 특수 능력 활성화`);
            }
        }
    }

    if (activeSetEffects.length > 0) {
        profileEmbed.addFields({
            name: '✨ 세트 효과',
            value: activeSetEffects.join('\n'),
            inline: false
        });
    }

    // 버튼 생성
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('stat_distribution')
                .setLabel('📊 스탯 분배')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false), // 항상 접근 가능하도록 변경
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    return await interaction.editReply({
        embeds: [profileEmbed],
        components: [buttons]
    });
}

module.exports = {
    showProfile
};