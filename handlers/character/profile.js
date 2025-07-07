const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getUser, formatNumber, calculateExpForLevel, getTierEmoji, calculateTier } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const { checkAndProcessLevelUp } = require('../common/levelUp');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');

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

    // 프로필 임베드
    const profileEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`👤 ${user.nickname || interaction.user.username}님의 프로필`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { 
                name: '📊 기본 정보', 
                value: `**레벨**: ${user.level}\n**경험치**: ${formatNumber(user.exp)}/${formatNumber(maxExp)} (${expPercentage}%)\n**골드**: ${formatNumber(user.gold)}G\n**인기도**: ${formatNumber(user.popularity)}`, 
                inline: true 
            },
            { 
                name: '⚔️ 전투 정보', 
                value: `**전투력**: ${formatNumber(combatPower)}\n**PVP 레이팅**: ${user.pvp?.rating || 1000}\n**티어**: ${getTierEmoji(calculateTier(user.pvp?.rating || 1000))} ${calculateTier(user.pvp?.rating || 1000)}`, 
                inline: true 
            },
            { 
                name: '📈 스탯', 
                value: `**힘**: ${user.stats?.strength || 10}\n**민첩**: ${user.stats?.agility || 10}\n**지능**: ${user.stats?.intelligence || 10}\n**체력**: ${user.stats?.vitality || 10}\n**행운**: ${user.stats?.luck || 10}\n**스탯 포인트**: ${user.statPoints || 0}`, 
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
        accessory: '💍 악세서리'
    };

    // getEquippedItem 함수 로컬 구현
    const getEquippedItem = function(user, slot) {
        if (!user.equipment || user.equipment[slot] === undefined || user.equipment[slot] === null || user.equipment[slot] === -1) {
            return null;
        }
        
        const slotIndex = user.equipment[slot];
        if (slotIndex < 0 || !user.inventory || !user.inventory[slotIndex]) {
            return null;
        }
        
        const item = user.inventory[slotIndex];
        
        // shield는 accessory 슬롯에 장착 가능
        const isValidType = (slot === 'accessory' && (item.type === 'accessory' || item.type === 'shield')) ||
                           item.type === slot;
        
        if (!isValidType) return null;
        
        return item;
    };

    for (const [slot, emoji] of Object.entries(slots)) {
        const item = getEquippedItem(user, slot);
        if (item && item.name) {
            let itemText = `${emoji}: ${item.name}`;
            
            // 강화 수치
            if (item.enhancement && item.enhancement > 0) {
                itemText += ` (+${item.enhancement})`;
            }
            
            // 능력치 표시
            const statText = [];
            if (item.stats) {
                if (item.stats.attack) {
                    const totalAttack = item.stats.attack + (item.enhancement || 0) * 10;
                    statText.push(`⚔️${totalAttack}`);
                }
                if (item.stats.defense) {
                    const totalDefense = item.stats.defense + (item.enhancement || 0) * 10;
                    statText.push(`🛡️${totalDefense}`);
                }
                if (item.stats.hp) {
                    const totalHp = item.stats.hp + (item.enhancement || 0) * 20;
                    statText.push(`❤️${totalHp}`);
                }
                if (item.stats.dodge) statText.push(`💨${item.stats.dodge}`);
                if (item.stats.luck) statText.push(`🍀${item.stats.luck}`);
            }
            
            if (statText.length > 0) {
                itemText += ` [${statText.join(' ')}]`;
            }
            
            equipmentInfo.push(itemText);
        } else {
            equipmentInfo.push(`${emoji}: 비어있음`);
        }
    }

    profileEmbed.addFields({
        name: '🎒 장착 장비',
        value: equipmentInfo.join('\n'),
        inline: false
    });
    
    // 장착한 장신구 표시
    const accessorySlots = {
        ring1: '💍 반지1',
        ring2: '💍 반지2',
        necklace: '📿 목걸이',
        bracelet1: '🔗 팔찌1',
        bracelet2: '🔗 팔찌2',
        earring1: '💎 귀걸이1',
        earring2: '💎 귀걸이2'
    };

    const accessoryInfo = [];
    let equippedSetCounts = {};
    let hasAnyAccessory = false;

    // 각 슬롯별로 장착된 장신구 확인
    for (const [slot, slotName] of Object.entries(accessorySlots)) {
        if (user.equippedAccessories && user.equippedAccessories[slot] && user.equippedAccessories[slot].name) {
            const accessory = user.equippedAccessories[slot];
            hasAnyAccessory = true;
            let accessoryText = `${slotName}: **${accessory.name}**`;
            
            // 스탯 표시
            const statText = [];
            if (accessory.stats) {
                // Map을 객체로 변환하여 처리
                const stats = accessory.stats instanceof Map ? Object.fromEntries(accessory.stats) : accessory.stats;
                
                if (stats.attack) statText.push(`⚔️+${stats.attack}`);
                if (stats.defense) statText.push(`🛡️+${stats.defense}`);
                if (stats.hp) statText.push(`❤️+${stats.hp}`);
                if (stats.criticalChance) statText.push(`⚡+${stats.criticalChance}%`);
                if (stats.criticalDamage) statText.push(`💥+${stats.criticalDamage}%`);
                if (stats.goldBonus) statText.push(`💰+${stats.goldBonus}%`);
                if (stats.expBonus) statText.push(`⭐+${stats.expBonus}%`);
                if (stats.dropRate) statText.push(`🎁+${stats.dropRate}%`);
                if (stats.pvpDamage) statText.push(`⚔️PVP+${stats.pvpDamage}%`);
                if (stats.dodge) statText.push(`💨+${stats.dodge}`);
                if (stats.luck) statText.push(`🍀+${stats.luck}`);
            }
            
            if (statText.length > 0) {
                accessoryText += ` [${statText.join(' ')}]`;
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

    // 장신구를 하나라도 장착했을 때만 표시
    if (hasAnyAccessory) {
        profileEmbed.addFields({
            name: '💎 장착 장신구',
            value: accessoryInfo.join('\n'),
            inline: false
        });
    }

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
                .setDisabled(user.statPoints === 0),
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