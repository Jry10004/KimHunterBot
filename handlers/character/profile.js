// ⚠️ 중요: 프로필 시스템은 장비/인벤토리와 통합되어 있습니다. 수정 시 주의!
// 통일화 작업 완료 (2025-01-19) - 변경 시 개발자와 상의 필요
// 관련 파일: inventory.js, equipment.js, combatPower.js
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { getUser, formatNumber, calculateExpForLevel, getTierEmoji, calculateTier } = require('../common/utils');
const { checkAndProcessLevelUp } = require('../common/levelUp');
const BOSS_ACCESSORIES = require('../../data/bossAccessories');
const { migrateAccessories } = require('./equipment');

// 스탯 보너스 표시 헬퍼 함수
function getStatBonus(value) {
    if (!value || value <= 0) return '';
    return ` (+${value})`;
}

async function showProfile(interaction, page = 1) {
    // interaction 상태 확인 후 적절히 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        console.log('[Profile] Defer 처리 스킵:', error.message);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.',
            embeds: [],
            components: []
        });
    }
    
    // 장신구 데이터 마이그레이션
    await migrateAccessories(user);
    await user.save();
    
    // 레벨업 체크
    const { leveledUp, levelsGained } = await checkAndProcessLevelUp(user);

    // 경험치 계산
    const maxExp = calculateExpForLevel(user.level);
    const expPercentage = Math.floor((user.exp / maxExp) * 100);
    
    // 전투력 계산 (통합 함수 사용) - 직접 require 방식으로 변경
    let combatPower = 0;
    let fragmentAttack = 0;
    try {
        const combatPowerModule = require('../common/combatPower');
        combatPower = combatPowerModule.calculateCombatPower(user);
        fragmentAttack = combatPowerModule.getFragmentAttackBonus(user);
    } catch (error) {
        console.error('[Profile] 전투력 계산 오류:', error);
        combatPower = user.combatPower || 0;
    }
    
    // 계산된 전투력이 DB와 다르면 업데이트
    if (user.combatPower !== combatPower) {
        user.combatPower = combatPower;
        await user.save();
    }
    
    // 직업별 스탯 표시 확인 (강화 수치 제거)
    const emblemName = user.emblem ? user.emblem.replace(/\s*\+\d+$/, '') : '';
    const equippedEmblemName = user.equippedEmblem ? user.equippedEmblem.replace(/\s*\+\d+$/, '') : '';
    const checkEmblem = equippedEmblemName || emblemName;
    
    let classType = 'physical';
    if (checkEmblem && (
        checkEmblem.includes('마법사') || checkEmblem.includes('원소 술사') || 
        checkEmblem.includes('신비한 현자') || checkEmblem.includes('대마법사') || 
        checkEmblem.includes('아크메이지')
    )) {
        classType = 'magic';
    }
    
    const isMage = classType === 'magic';
    const attackLabel = isMage ? '마력' : '공격력';
    const attackIcon = isMage ? '🔮' : '⚔️';
    
    const emblemType = checkEmblem || '없음';
    
    // 티어 계산
    const { tier, stars } = calculateTier(user.level);
    const tierEmoji = getTierEmoji(tier, stars);
    
    // 경험치 프로그레스 바 생성
    const barLength = 20;
    const filledLength = Math.floor(barLength * (expPercentage / 100));
    const emptyLength = barLength - filledLength;
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    
    // 추가 스탯 계산
    const distributedStats = user.distributedStats || {};
    const emblemStats = user.emblemEnhancement?.appliedStats || {};
    const exerciseStats = user.exerciseStats || {};
    
    // 기본 스탯 (user.stats에는 이미 운동 스탯이 포함되어 있음)
    // 기본 스탯은 모든 직업이 10으로 시작
    const baseStats = {
        strength: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10
    };
    
    // 장비 스탯 계산 - 실제 사용하는 스탯만 포함
    const equipmentStats = {
        strength: 0,
        agility: 0,
        intelligence: 0,
        vitality: 0,
        luck: 0,
        attack: 0,  // 마법사는 이것을 '마력'으로 표시
        defense: 0,
        hp: 0,
        dodge: 0,
        // TODO: 아래 스탯들은 아직 아이템에 구현되지 않았지만, 나중에 추가될 예정
        // 새로운 아이템 옵션 추가 시 이 코드를 참고하여 사용하세요
        criticalChance: 0,    // 치명타 확률 (%)
        criticalDamage: 0,    // 치명타 피해 (%)
        goldBonus: 0,         // 골드 획득 보너스 (%)
        expBonus: 0           // 경험치 획득 보너스 (%)
    };
    
    // 일반 장비 스탯 합산
    if (user.equipment && user.inventory) {
        for (const [slot, equippedSlot] of Object.entries(user.equipment)) {
            if (equippedSlot >= 0) {
                let equippedItem = null;
                
                // inventorySlot으로 먼저 찾기
                equippedItem = user.inventory.find(item => item && item.inventorySlot === equippedSlot);
                
                // 못 찾았으면 배열 인덱스로 찾기
                if (!equippedItem && user.inventory[equippedSlot]) {
                    equippedItem = user.inventory[equippedSlot];
                }
                
                if (equippedItem && equippedItem.stats) {
                    for (const [stat, value] of Object.entries(equippedItem.stats)) {
                        if (value > 0) {
                            // equipmentStats에 없는 스탯이면 추가
                            if (!equipmentStats.hasOwnProperty(stat)) {
                                equipmentStats[stat] = 0;
                            }
                            equipmentStats[stat] += value;
                        }
                    }
                }
            }
        }
    }
    
    // 악세서리 스탯 합산
    if (user.equippedAccessories) {
        for (const accessory of Object.values(user.equippedAccessories)) {
            if (accessory) {
                // stats가 Map인 경우 Object로 변환
                const stats = accessory.stats instanceof Map 
                    ? Object.fromEntries(accessory.stats) 
                    : (accessory.stats || {});
                
                // 구버전 악세서리 호환성 (개별 속성으로 되어있는 경우)
                if (Object.keys(stats).length === 0) {
                    if (accessory.attack) stats.attack = accessory.attack;
                    if (accessory.defense) stats.defense = accessory.defense;
                    if (accessory.hp) stats.hp = accessory.hp;
                    if (accessory.strength) stats.strength = accessory.strength;
                    if (accessory.agility) stats.agility = accessory.agility;
                    if (accessory.intelligence) stats.intelligence = accessory.intelligence;
                    if (accessory.vitality) stats.vitality = accessory.vitality;
                    if (accessory.luck) stats.luck = accessory.luck;
                    if (accessory.magic) stats.magic = accessory.magic;
                }
                
                for (const [stat, value] of Object.entries(stats)) {
                    if (value > 0) {
                        // equipmentStats에 없는 스탯이면 추가
                        if (!equipmentStats.hasOwnProperty(stat)) {
                            equipmentStats[stat] = 0;
                        }
                        equipmentStats[stat] += value;
                    }
                }
            }
        }
    }
    
    // 총 스탯 계산 (user.stats에 이미 운동이 포함되어 있으므로 운동은 따로 더하지 않음)
    const totalStats = {
        strength: (user.stats?.strength || 10) + (distributedStats.strength || 0) + (emblemStats.strength || 0) + (equipmentStats.strength || 0),
        agility: (user.stats?.agility || 10) + (distributedStats.agility || 0) + (emblemStats.agility || 0) + (equipmentStats.agility || 0),
        intelligence: (user.stats?.intelligence || 10) + (distributedStats.intelligence || 0) + (emblemStats.intelligence || 0) + (equipmentStats.intelligence || 0),
        vitality: (user.stats?.vitality || 10) + (distributedStats.vitality || 0) + (emblemStats.vitality || 0) + (equipmentStats.vitality || 0),
        luck: (user.stats?.luck || 10) + (distributedStats.luck || 0) + (emblemStats.luck || 0) + (equipmentStats.luck || 0)
    };
    
    // 장비 전투력 계산
    let equipmentCombatPower = 0;
    try {
        const { getJobFromEmblem, JOB_WEIGHTS } = require('../common/combatPower');
        const job = getJobFromEmblem(user.emblem);
        const weights = job ? JOB_WEIGHTS[job] : {
            strength: 2,
            agility: 1.5,
            intelligence: 1.2,
            vitality: 1.8,
            luck: 0.5,
            attack: 2,
            defense: 1.5,
            hp: 0.3,
            dodge: 1
        };
        
        // 장비 스탯의 전투력 계산
        for (const [stat, value] of Object.entries(equipmentStats)) {
            const weight = weights[stat] || 0.1;
            equipmentCombatPower += value * weight;
        }
        
        equipmentCombatPower = Math.floor(equipmentCombatPower);
    } catch (error) {
        console.error('[Profile] 장비 전투력 계산 오류:', error);
        equipmentCombatPower = 0;
    }
    
    // 스탯 표시 생성 (상세 정보 포함)
    const statDisplay = [];
    
    // 스탯 상세 표시 함수
    const formatStatDetail = (statName, icon, total, base, distributed, emblem, exercise, equipment) => {
        let detail = `${icon} ${statName}: ${formatNumber(total)}`;
        
        // 증가 요소가 있을 때만 상세 표시
        if (distributed > 0 || emblem > 0 || exercise > 0 || equipment > 0 || base > 10) {
            detail += ` (`;
            const parts = [];
            
            // 기본 스탯 (운동 제외)
            parts.push(`기본 ${base}`);
            
            // 운동 스탯
            if (exercise > 0) {
                parts.push(`운동 +${exercise}`);
            }
            
            // 분배 포인트
            if (distributed > 0) {
                parts.push(`분배 +${distributed}`);
            }
            
            // 엠블럼 강화
            if (emblem > 0) {
                parts.push(`엠블럼 +${emblem}`);
            }
            
            // 장비 스탯
            if (equipment > 0) {
                parts.push(`장비 +${equipment}`);
            }
            
            detail += parts.join(' + ');
            detail += `)`;
        }
        
        return detail;
    };
    
    // 직업별 특화 스탯 표시 - 정확한 엠블럼 이름 사용
    // 전사 계열: 초보전사, 튼튼한 기사, 용맹한 검사, 맹렬한 전사, 전설의 기사
    if (checkEmblem === '초보전사' || checkEmblem === '튼튼한 기사' || 
        checkEmblem === '용맹한 검사' || checkEmblem === '맹렬한 전사' || 
        checkEmblem === '전설의 기사') {
        statDisplay.push(formatStatDetail('힘', '💪', totalStats.strength, baseStats.strength, distributedStats.strength || 0, emblemStats.strength || 0, exerciseStats.strength || 0, equipmentStats.strength || 0));
        statDisplay.push(formatStatDetail('체력', '❤️', totalStats.vitality, baseStats.vitality, distributedStats.vitality || 0, emblemStats.vitality || 0, exerciseStats.vitality || 0, equipmentStats.vitality || 0));
    } 
    // 궁수 계열: 마을사냥꾼, 숲의 궁수, 바람 사수, 정확한 사격수, 전설의 명궁
    else if (checkEmblem === '마을사냥꾼' || checkEmblem === '숲의 궁수' || 
             checkEmblem === '바람 사수' || checkEmblem === '정확한 사격수' || 
             checkEmblem === '전설의 명궁') {
        statDisplay.push(formatStatDetail('민첩', '🏃', totalStats.agility, baseStats.agility, distributedStats.agility || 0, emblemStats.agility || 0, exerciseStats.agility || 0, equipmentStats.agility || 0));
        statDisplay.push(formatStatDetail('행운', '🍀', totalStats.luck, baseStats.luck, distributedStats.luck || 0, emblemStats.luck || 0, exerciseStats.luck || 0, equipmentStats.luck || 0));
    } 
    // 마법사 계열: 견습 마법사, 원소 술사, 신비한 현자, 대마법사, 전설의 아크메이지
    else if (checkEmblem === '견습 마법사' || checkEmblem === '원소 술사' || 
             checkEmblem === '신비한 현자' || checkEmblem === '대마법사' || 
             checkEmblem === '전설의 아크메이지') {
        statDisplay.push(formatStatDetail('지능', '🧠', totalStats.intelligence, baseStats.intelligence, distributedStats.intelligence || 0, emblemStats.intelligence || 0, exerciseStats.intelligence || 0, equipmentStats.intelligence || 0));
        statDisplay.push(formatStatDetail('행운', '🍀', totalStats.luck, baseStats.luck, distributedStats.luck || 0, emblemStats.luck || 0, exerciseStats.luck || 0, equipmentStats.luck || 0));
    } 
    // 도적 계열: 떠돌이 도적, 운 좋은 도둑, 행운의 닌자, 복 많은 도적, 전설의 행운아
    else if (checkEmblem === '떠돌이 도적' || checkEmblem === '운 좋은 도둑' || 
             checkEmblem === '행운의 닌자' || checkEmblem === '복 많은 도적' || 
             checkEmblem === '전설의 행운아') {
        statDisplay.push(formatStatDetail('민첩', '🏃', totalStats.agility, baseStats.agility, distributedStats.agility || 0, emblemStats.agility || 0, exerciseStats.agility || 0, equipmentStats.agility || 0));
        statDisplay.push(formatStatDetail('행운', '🍀', totalStats.luck, baseStats.luck, distributedStats.luck || 0, emblemStats.luck || 0, exerciseStats.luck || 0, equipmentStats.luck || 0));
    } 
    // 수호자 계열: 초보 수호자, 철벽 방패병, 불굴의 수호자, 강철 파수꾼, 전설의 철벽
    else if (checkEmblem === '초보 수호자' || checkEmblem === '철벽 방패병' || 
             checkEmblem === '불굴의 수호자' || checkEmblem === '강철 파수꾼' || 
             checkEmblem === '전설의 철벽') {
        statDisplay.push(formatStatDetail('체력', '❤️', totalStats.vitality, baseStats.vitality, distributedStats.vitality || 0, emblemStats.vitality || 0, exerciseStats.vitality || 0, equipmentStats.vitality || 0));
        statDisplay.push(formatStatDetail('힘', '💪', totalStats.strength, baseStats.strength, distributedStats.strength || 0, emblemStats.strength || 0, exerciseStats.strength || 0, equipmentStats.strength || 0));
    } else {
        // 엠블럼이 없는 경우 모든 스탯 표시
        statDisplay.push(formatStatDetail('힘', '💪', totalStats.strength, baseStats.strength, distributedStats.strength || 0, emblemStats.strength || 0, exerciseStats.strength || 0, equipmentStats.strength || 0));
        statDisplay.push(formatStatDetail('민첩', '🏃', totalStats.agility, baseStats.agility, distributedStats.agility || 0, emblemStats.agility || 0, exerciseStats.agility || 0, equipmentStats.agility || 0));
        statDisplay.push(formatStatDetail('지능', '🧠', totalStats.intelligence, baseStats.intelligence, distributedStats.intelligence || 0, emblemStats.intelligence || 0, exerciseStats.intelligence || 0, equipmentStats.intelligence || 0));
        statDisplay.push(formatStatDetail('체력', '❤️', totalStats.vitality, baseStats.vitality, distributedStats.vitality || 0, emblemStats.vitality || 0, exerciseStats.vitality || 0, equipmentStats.vitality || 0));
        statDisplay.push(formatStatDetail('행운', '🍀', totalStats.luck, baseStats.luck, distributedStats.luck || 0, emblemStats.luck || 0, exerciseStats.luck || 0, equipmentStats.luck || 0));
    }
    
    // 장비에서 제공하는 추가 스탯 표시
    const additionalStats = [];
    
    // 기본 스탯
    if (equipmentStats.strength > 0) {
        additionalStats.push(`💪 힘: +${formatNumber(equipmentStats.strength)}`);
    }
    if (equipmentStats.agility > 0) {
        additionalStats.push(`🏃 민첩: +${formatNumber(equipmentStats.agility)}`);
    }
    if (equipmentStats.intelligence > 0) {
        additionalStats.push(`🧠 지능: +${formatNumber(equipmentStats.intelligence)}`);
    }
    if (equipmentStats.vitality > 0) {
        additionalStats.push(`❤️ 체력: +${formatNumber(equipmentStats.vitality)}`);
    }
    if (equipmentStats.luck > 0) {
        additionalStats.push(`🍀 행운: +${formatNumber(equipmentStats.luck)}`);
    }
    
    // 전투 스탯
    if (equipmentStats.attack > 0) {
        // 마법사인 경우 '마력'으로 표시
        const attackLabel = isMage ? '마력' : '공격력';
        const attackIcon = isMage ? '🔮' : '⚔️';
        additionalStats.push(`${attackIcon} ${attackLabel}: +${formatNumber(equipmentStats.attack)}`);
    }
    if (equipmentStats.defense > 0) {
        additionalStats.push(`🛡️ 방어력: +${formatNumber(equipmentStats.defense)}`);
    }
    if (equipmentStats.hp > 0) {
        additionalStats.push(`❤️ HP: +${formatNumber(equipmentStats.hp)}`);
    }
    
    // 특수 스탯
    if (equipmentStats.dodge > 0) {
        additionalStats.push(`💨 회피: +${formatNumber(equipmentStats.dodge)}`);
    }
    
    // TODO: 아래 스탯들은 아이템에 구현될 때 활성화됩니다
    // 새로운 특수 옵션 아이템 추가 시 이 코드를 사용하세요
    if (equipmentStats.criticalChance > 0) {
        additionalStats.push(`⚡ 치명타 확률: +${formatNumber(equipmentStats.criticalChance)}%`);
    }
    if (equipmentStats.criticalDamage > 0) {
        additionalStats.push(`💥 치명타 피해: +${formatNumber(equipmentStats.criticalDamage)}%`);
    }
    
    // 보너스 스탯 (골드/경험치 획득량 증가)
    if (equipmentStats.goldBonus > 0) {
        additionalStats.push(`💰 골드 획득: +${formatNumber(equipmentStats.goldBonus)}%`);
    }
    if (equipmentStats.expBonus > 0) {
        additionalStats.push(`✨ 경험치 획득: +${formatNumber(equipmentStats.expBonus)}%`);
    }
    
    // 기타 스탯 (정의되지 않은 스탯들도 표시)
    for (const [stat, value] of Object.entries(equipmentStats)) {
        if (value > 0 && !['strength', 'agility', 'intelligence', 'vitality', 'luck', 
            'attack', 'magic', 'defense', 'hp', 'dodge', 
            'criticalChance', 'criticalDamage', 'goldBonus', 'expBonus'].includes(stat)) {
            additionalStats.push(`📊 ${stat}: +${formatNumber(value)}`);
        }
    }
    
    if (additionalStats.length > 0) {
        statDisplay.push(`\n📦 **장비 추가 능력치**`);
        statDisplay.push(...additionalStats);
    }
    
    // 조각 시스템 공격력 표시
    if (fragmentAttack > 0) {
        statDisplay.push(`\n⚔️ 공격력: +${formatNumber(fragmentAttack)} (조각)`);
    }
    
    // 스탯 포인트 표시
    const availablePoints = user.statPoints || 0;
    if (availablePoints > 0) {
        statDisplay.push(`\n📌 **사용 가능한 스탯 포인트: ${availablePoints}**`);
    }
    
    // 프로필 Embed 생성
    const profileEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`👤 ${user.nickname || interaction.user.username}님의 프로필`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
            { 
                name: '📊 기본 정보', 
                value: [
                    `${tierEmoji} **레벨**: ${user.level}`,
                    `💰 **골드**: ${formatNumber(user.gold)}G`,
                    `${attackIcon} **${isMage ? '마력' : '전투력'}**: ${formatNumber(combatPower)}`,
                    `🛡️ **장비 전투력**: ${formatNumber(equipmentCombatPower)}`,
                    `🎖️ **엠블럼**: ${user.emblem || '없음'}`
                ].join('\n'),
                inline: true 
            },
            { 
                name: '⚔️ 전투 기록', 
                value: [
                    `🏰 **던전 최고층**: ${formatNumber(user.rankingStats?.dungeon?.maxFloor || 0)}층`,
                    `👹 **보스 처치**: ${formatNumber(user.rankingStats?.boss?.totalKills || user.bossKills || 0)}회`,
                    `💥 **보스 총 데미지**: ${formatNumber(user.rankingStats?.boss?.totalDamage || 0)}`,
                    `🏆 **PVP 승리**: ${formatNumber(user.pvpWins || 0)}회`,
                    `💀 **PVP 패배**: ${formatNumber(user.pvpLosses || 0)}회`
                ].join('\n'),
                inline: true 
            },
            { 
                name: '💎 경험치', 
                value: [
                    `${progressBar} ${expPercentage}%`,
                    `${formatNumber(user.exp)} / ${formatNumber(maxExp)}`
                ].join('\n'),
                inline: false 
            },
            { 
                name: '📈 스탯', 
                value: statDisplay.join('\n'),
                inline: false 
            }
        );

    // 누적 활동 표시
    const activities = [];
    if (user.achievements?.totalGoldEarned) {
        activities.push(`💰 누적 획득 골드: ${formatNumber(user.achievements.totalGoldEarned)}G`);
    }
    if (user.achievements?.totalExpEarned) {
        activities.push(`✨ 누적 획득 경험치: ${formatNumber(user.achievements.totalExpEarned)}`);
    }
    if (user.achievements?.totalItemsFound) {
        activities.push(`📦 누적 획득 아이템: ${formatNumber(user.achievements.totalItemsFound)}개`);
    }
    
    if (activities.length > 0) {
        profileEmbed.addFields({
            name: '📊 누적 활동',
            value: activities.join('\n'),
            inline: false
        });
    }

    // 최근 업적 표시
    const recentAchievements = [];
    
    // PVP 연승
    if (user.pvp?.currentWinStreak > 0) {
        recentAchievements.push(`🔥 PVP ${user.pvp.currentWinStreak}연승 중!`);
    }
    
    // 최고 기록
    if (user.pvp?.bestWinStreak > 0) {
        recentAchievements.push(`🏆 최고 연승: ${user.pvp.bestWinStreak}연승`);
    }
    
    if (recentAchievements.length > 0) {
        profileEmbed.addFields({
            name: '🏅 최근 업적',
            value: recentAchievements.join('\n'),
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
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId('profile_page_2')
                .setLabel('⚔️ 장비 정보')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    // 페이지 1만 표시
    if (page === 1) {
        return await interaction.editReply({
            embeds: [profileEmbed],
            components: [buttons]
        });
    }
    
    // 페이지 2: 장비 정보 (equipment.js와 동일한 전투력 계산 사용)
    return await showEquipmentPage(interaction, user);
}

// 장비 페이지 표시 함수
async function showEquipmentPage(interaction, user) {
    const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
    const { formatNumber } = require('../common/utils');
    const { calculateCombatPower, getJobFromEmblem, JOB_WEIGHTS } = require('../common/combatPower');
    const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
    
    const equipmentEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`⚔️ ${user.nickname || interaction.user.username}님의 장비`)
        .setThumbnail(interaction.user.displayAvatarURL());
    
    // 장비 슬롯 정의
    const equipmentSlots = {
        weapon: '🗡️ 무기',
        armor: '🛡️ 갑옷',
        helmet: '⛑️ 투구',
        gloves: '🧤 장갑',
        boots: '👢 신발',
        shield: '🛡️ 방패'
    };
    
    // 악세서리 슬롯 정의
    const accessorySlots = {
        ring1: '💍 반지 1',
        ring2: '💍 반지 2',
        necklace: '📿 목걸이',
        bracelet1: '🔗 팔찌 1',
        bracelet2: '🔗 팔찌 2',
        earring1: '💎 귀걸이 1',
        earring2: '💎 귀걸이 2'
    };
    
    // 직업 확인
    const job = getJobFromEmblem(user.emblem);
    const weights = job ? JOB_WEIGHTS[job] : null;
    
    // 장비 정보 표시
    let totalCombatPowerFromItems = 0;
    const equipmentInfo = [];
    
    // 일반 장비
    for (const [slot, slotName] of Object.entries(equipmentSlots)) {
        const equippedSlot = user.equipment?.[slot];
        let equippedItem = null;
        
        if (equippedSlot >= 0 && user.inventory) {
            // inventorySlot으로 먼저 찾기
            equippedItem = user.inventory.find(item => item && item.inventorySlot === equippedSlot);
            
            // 못 찾았으면 배열 인덱스로 찾기
            if (!equippedItem && user.inventory[equippedSlot]) {
                equippedItem = user.inventory[equippedSlot];
            }
        }
        
        if (equippedItem) {
            const stats = equippedItem.stats || {};
            let itemPower = 0;
            let statDetails = [];
            
            // 각 스탯별 상세 정보 수집
            for (const [stat, value] of Object.entries(stats)) {
                if (value > 0) {
                    // 강화 수치 확인
                    const baseStat = equippedItem.baseStats?.[stat] || value;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? value - baseStat : 0;
                    
                    let statText = '';
                    switch(stat) {
                        case 'attack': 
                            statText = enhanceBonus > 0 ? `공격력 +${value} (${baseStat}+${enhanceBonus})` : `공격력 +${value}`;
                            break;
                        case 'defense': 
                            statText = enhanceBonus > 0 ? `방어력 +${value} (${baseStat}+${enhanceBonus})` : `방어력 +${value}`;
                            break;
                        case 'hp': 
                            statText = enhanceBonus > 0 ? `HP +${value} (${baseStat}+${enhanceBonus})` : `HP +${value}`;
                            break;
                        case 'strength': 
                            statText = enhanceBonus > 0 ? `힘 +${value} (${baseStat}+${enhanceBonus})` : `힘 +${value}`;
                            break;
                        case 'agility': 
                            statText = enhanceBonus > 0 ? `민첩 +${value} (${baseStat}+${enhanceBonus})` : `민첩 +${value}`;
                            break;
                        case 'intelligence': 
                            statText = enhanceBonus > 0 ? `지능 +${value} (${baseStat}+${enhanceBonus})` : `지능 +${value}`;
                            break;
                        case 'vitality': 
                            statText = enhanceBonus > 0 ? `체력 +${value} (${baseStat}+${enhanceBonus})` : `체력 +${value}`;
                            break;
                        case 'luck': 
                            statText = enhanceBonus > 0 ? `행운 +${value} (${baseStat}+${enhanceBonus})` : `행운 +${value}`;
                            break;
                        case 'dodge': 
                            statText = enhanceBonus > 0 ? `회피 +${value} (${baseStat}+${enhanceBonus})` : `회피 +${value}`;
                            break;
                    }
                    
                    if (statText) statDetails.push(statText);
                }
            }
            
            if (weights) {
                // 직업별 가중치 적용
                for (const [stat, value] of Object.entries(stats)) {
                    if (weights[stat]) {
                        itemPower += value * weights[stat];
                    }
                }
            } else {
                // 기본 가중치
                itemPower = (stats.attack || 0) * 2 + (stats.defense || 0) * 1.5 + 
                          (stats.hp || 0) * 0.3 + (stats.luck || 0) * 0.5;
            }
            
            totalCombatPowerFromItems += itemPower;
            
            // 아이템 정보 표시
            let itemText = `${slotName}: **${equippedItem.name}**`;
            const enhanceLevel = equippedItem.enhanceLevel || 0;
            const { ENHANCE_SYSTEM } = require('../enhance/enhanceSystem');
            const rankName = ENHANCE_SYSTEM.rankNames[enhanceLevel] || '무계급';
            
            if (enhanceLevel > 0) {
                itemText += ` [${rankName}]`;
            }
            itemText += ` (전투력: ${Math.floor(itemPower)})`;
            
            if (statDetails.length > 0) {
                itemText += `\n  └ ${statDetails.join(', ')}`;
            }
            
            equipmentInfo.push(itemText);
        } else {
            equipmentInfo.push(`${slotName}: 비어있음`);
        }
    }
    
    // 일반 장비 전투력 계산
    let equipmentCombatPower = 0;
    for (const [slot, slotName] of Object.entries(equipmentSlots)) {
        const equippedSlot = user.equipment?.[slot];
        if (equippedSlot >= 0 && user.inventory) {
            const equippedItem = user.inventory.find(item => item && item.inventorySlot === equippedSlot) || user.inventory[equippedSlot];
            if (equippedItem) {
                const stats = equippedItem.stats || {};
                let itemPower = 0;
                if (weights) {
                    for (const [stat, value] of Object.entries(stats)) {
                        if (weights[stat]) {
                            itemPower += value * weights[stat];
                        }
                    }
                } else {
                    itemPower = (stats.attack || 0) * 2 + (stats.defense || 0) * 1.5 + 
                              (stats.hp || 0) * 0.3 + (stats.luck || 0) * 0.5;
                }
                equipmentCombatPower += itemPower;
            }
        }
    }
    
    equipmentEmbed.addFields({
        name: '🛡️ 장비',
        value: equipmentInfo.join('\n') || '장착된 장비가 없습니다.',
        inline: false
    });
    
    equipmentEmbed.addFields({
        name: '🛡️ 장비 전투력',
        value: `**${formatNumber(Math.floor(equipmentCombatPower))}**`,
        inline: true
    });
    
    // 악세서리 정보 표시
    const accessoryInfo = [];
    
    for (const [slot, slotName] of Object.entries(accessorySlots)) {
        if (user.equippedAccessories && user.equippedAccessories[slot]) {
            const accessory = user.equippedAccessories[slot];
            // stats가 Map인 경우 Object로 변환
            const stats = accessory.stats instanceof Map 
                ? Object.fromEntries(accessory.stats) 
                : (accessory.stats || {});
            let itemPower = 0;
            let statDetails = [];
            
            // 각 스탯별 상세 정보 수집
            for (const [stat, value] of Object.entries(stats)) {
                if (value > 0) {
                    let statText = '';
                    switch(stat) {
                        case 'attack': statText = `공격력 +${value}`; break;
                        case 'defense': statText = `방어력 +${value}`; break;
                        case 'hp': statText = `HP +${value}`; break;
                        case 'strength': statText = `힘 +${value}`; break;
                        case 'agility': statText = `민첩 +${value}`; break;
                        case 'intelligence': statText = `지능 +${value}`; break;
                        case 'vitality': statText = `체력 +${value}`; break;
                        case 'luck': statText = `행운 +${value}`; break;
                        case 'dodge': statText = `회피 +${value}`; break;
                        case 'goldBonus': statText = `골드 획득 +${value}%`; break;
                        case 'expBonus': statText = `경험치 획득 +${value}%`; break;
                        case 'criticalChance': statText = `치명타 확률 +${value}%`; break;
                        case 'criticalDamage': statText = `치명타 피해 +${value}%`; break;
                    }
                    
                    if (statText) statDetails.push(statText);
                }
            }
            
            if (weights) {
                for (const [stat, value] of Object.entries(stats)) {
                    if (weights[stat]) {
                        itemPower += value * weights[stat];
                    }
                }
            }
            
            totalCombatPowerFromItems += itemPower;
            const name = accessory.name || accessory.type;
            
            if (!name) {
                // 이름이 없으면 비어있음으로 처리
                accessoryInfo.push(`${slotName}: 비어있음`);
            } else {
                // 구버전 악세서리 호환성 체크 - stats가 없고 개별 속성으로 되어있는 경우
                if (Object.keys(stats).length === 0) {
                    // 개별 속성들을 확인
                    if (accessory.attack) { stats.attack = accessory.attack; statDetails.push(`공격력 +${accessory.attack}`); }
                    if (accessory.defense) { stats.defense = accessory.defense; statDetails.push(`방어력 +${accessory.defense}`); }
                    if (accessory.hp) { stats.hp = accessory.hp; statDetails.push(`HP +${accessory.hp}`); }
                    if (accessory.strength) { stats.strength = accessory.strength; statDetails.push(`힘 +${accessory.strength}`); }
                    if (accessory.agility) { stats.agility = accessory.agility; statDetails.push(`민첩 +${accessory.agility}`); }
                    if (accessory.intelligence) { stats.intelligence = accessory.intelligence; statDetails.push(`지능 +${accessory.intelligence}`); }
                    if (accessory.vitality) { stats.vitality = accessory.vitality; statDetails.push(`체력 +${accessory.vitality}`); }
                    if (accessory.luck) { stats.luck = accessory.luck; statDetails.push(`행운 +${accessory.luck}`); }
                    if (accessory.dodge || accessory.evasion) { 
                        const dodgeValue = accessory.dodge || accessory.evasion;
                        stats.dodge = dodgeValue; 
                        statDetails.push(`회피 +${dodgeValue}`); 
                    }
                    if (accessory.goldBonus) { statDetails.push(`골드 획득 +${accessory.goldBonus}%`); }
                    if (accessory.expBonus) { statDetails.push(`경험치 획득 +${accessory.expBonus}%`); }
                    if (accessory.criticalChance) { statDetails.push(`치명타 확률 +${accessory.criticalChance}%`); }
                    if (accessory.criticalDamage) { statDetails.push(`치명타 피해 +${accessory.criticalDamage}%`); }
                    
                    // 전투력 재계산
                    itemPower = 0;
                    if (weights) {
                        for (const [stat, value] of Object.entries(stats)) {
                            if (weights[stat] && value > 0) {
                                itemPower += value * weights[stat];
                            }
                        }
                    }
                    totalCombatPowerFromItems += itemPower;
                }
                
                // 악세서리 정보 표시
                let itemText = `${slotName}: **${name}**`;
                const enhanceLevel = accessory.enhanceLevel || 0;
                const rankName = ENHANCE_SYSTEM.rankNames[enhanceLevel] || '무계급';
                
                if (enhanceLevel > 0) {
                    itemText += ` [${rankName}]`;
                }
                itemText += ` (전투력: ${Math.floor(itemPower)})`;
                
                if (statDetails.length > 0) {
                    itemText += `\n  └ ${statDetails.join(', ')}`;
                }
                
                accessoryInfo.push(itemText);
            }
        } else {
            accessoryInfo.push(`${slotName}: 비어있음`);
        }
    }
    
    // 악세서리 전투력 계산
    let accessoryCombatPower = 0;
    for (const [slot, slotName] of Object.entries(accessorySlots)) {
        if (user.equippedAccessories && user.equippedAccessories[slot]) {
            const accessory = user.equippedAccessories[slot];
            const stats = accessory.stats instanceof Map 
                ? Object.fromEntries(accessory.stats) 
                : (accessory.stats || {});
            let itemPower = 0;
            
            if (weights) {
                for (const [stat, value] of Object.entries(stats)) {
                    if (weights[stat]) {
                        itemPower += value * weights[stat];
                    }
                }
            }
            accessoryCombatPower += itemPower;
        }
    }
    
    equipmentEmbed.addFields({
        name: '💍 악세서리',
        value: accessoryInfo.join('\n') || '장착된 악세서리가 없습니다.',
        inline: false
    });
    
    equipmentEmbed.addFields({
        name: '💍 악세서리 전투력',
        value: `**${formatNumber(Math.floor(accessoryCombatPower))}**`,
        inline: true
    });
    
    // 전체 전투력 표시 (calculateCombatPower 사용)
    const totalCombatPower = calculateCombatPower(user);
    
    const totalEquipmentPower = Math.floor(equipmentCombatPower + accessoryCombatPower);
    
    equipmentEmbed.addFields({
        name: '⚔️ 총 전투력',
        value: `**${formatNumber(totalCombatPower)}** (장비 전투력: ${formatNumber(totalEquipmentPower)})`,
        inline: false
    });
    
    // 페이지 2 버튼
    const page2Buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('profile_page_1')
                .setLabel('◀️ 기본 정보')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('🔄 장비 관리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [equipmentEmbed],
        components: [page2Buttons]
    });
}

module.exports = {
    showProfile
};