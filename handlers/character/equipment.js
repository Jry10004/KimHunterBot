// ⚠️ 중요: 장비 시스템은 인벤토리/프로필과 통합되어 있습니다. 수정 시 주의!
// 통일화 작업 완료 (2025-01-19) - 변경 시 개발자와 상의 필요
// 관련 파일: inventory.js, profile.js, combatPower.js
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const User = require('../../models/User');

// 장비 슬롯 정보
const EQUIPMENT_SLOTS = {
    weapon: { name: '무기', emoji: '🗡️' },
    armor: { name: '갑옷', emoji: '🛡️' },
    helmet: { name: '투구', emoji: '⛑️' },
    gloves: { name: '장갑', emoji: '🧤' },
    boots: { name: '신발', emoji: '👢' },
    shield: { name: '방패', emoji: '🛡️' }
};

// 악세서리 슬롯 정보 (별도 관리)
const ACCESSORY_SLOTS = {
    ring1: { name: '반지 1', emoji: '💍' },
    ring2: { name: '반지 2', emoji: '💍' },
    necklace: { name: '목걸이', emoji: '📿' },
    bracelet1: { name: '팔찌 1', emoji: '🔗' },
    bracelet2: { name: '팔찌 2', emoji: '🔗' },
    earring1: { name: '귀걸이 1', emoji: '💎' },
    earring2: { name: '귀걸이 2', emoji: '💎' }
};

// 희귀도별 색상 및 이모지
const RARITY_COLORS = {
    일반: '#95a5a6',
    고급: '#3498db',
    레어: '#9b59b6',
    에픽: '#e74c3c',
    레전드리: '#f39c12',
    신화: '#ff00ff'
};

const RARITY_EMOJIS = {
    일반: '⬜',
    고급: '🔵',
    레어: '🟣',
    에픽: '🔴',
    레전드리: '🟠',
    신화: '✨'
};

// 아이템 점수 계산 (최적화 장착용)
function calculateItemScore(item, userEmblemType = null) {
    if (!item) return 0;
    
    // 직업별 주스탯 정의
    const mainStatByEmblem = {
        '전사': 'strength',
        'warrior': 'strength',
        '궁수': 'agility',
        'archer': 'agility',
        '마법사': 'intelligence',
        'mage': 'intelligence',
        '도적': 'agility',
        'rogue': 'agility',
        '수호자': 'vitality',
        'guardian': 'vitality'
    };
    
    // 유저의 주스탯 확인
    let userMainStat = null;
    if (userEmblemType) {
        const emblemBase = userEmblemType.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
        for (const [key, value] of Object.entries(mainStatByEmblem)) {
            if (emblemBase.toLowerCase().includes(key)) {
                userMainStat = value;
                break;
            }
        }
    }
    
    // 기본 점수 계산
    let score = 0;
    
    // 새로운 아이템 시스템의 score 필드가 있으면 기본점수로 사용
    if (item.score !== undefined) {
        score = item.score;
    } else {
        // 구 시스템: 희귀도 기반 기본 점수
        const rarityScores = {
            'legendary': 800, '전설': 800,
            'unique': 400, '유니크': 400,
            'epic': 200, '에픽': 200,
            'rare': 100, '레어': 100,
            'normal': 50, '일반': 50,
            'trash': 10, '쓰레기': 10
        };
        score = rarityScores[item.rarity] || 10;
    }
    
    // 강화 레벨 보너스 (통일: 강화당 1000점)
    const enhanceLevel = item.enhanceLevel || item.enhancement || 0;
    score += enhanceLevel * 1000;
    
    // 스탯 기반 점수 계산
    if (item.stats) {
        // 강화된 스탯 계산
        let totalMultiplier = 1;
        if (enhanceLevel > 0) {
            for (let i = 1; i <= enhanceLevel; i++) {
                if (i <= 5) totalMultiplier += 0.02;
                else if (i <= 10) totalMultiplier += 0.03;
                else if (i <= 15) totalMultiplier += 0.04;
                else if (i <= 20) totalMultiplier += 0.05;
                else if (i <= 25) totalMultiplier += 0.06;
                else totalMultiplier += 0.07;
            }
        }
        
        // 궁수 직업 확인
        const isArcher = userEmblemType && (
            userEmblemType.includes('궁수') || userEmblemType.includes('archer') ||
            userEmblemType.includes('사냥꾼') || userEmblemType.includes('명사수') ||
            userEmblemType.includes('호크아이')
        );
        
        // 주스탯 가중치 적용 (주스탯은 10배 가중치)
        if (userMainStat && item.stats[userMainStat]) {
            const statValue = item.baseStats?.[userMainStat] || item.stats[userMainStat];
            score += Math.floor(statValue * totalMultiplier) * 10;
        }
        
        // 공격력/방어력 (강화 포함)
        if (item.stats.attack) {
            const baseAttack = item.baseStats?.attack || item.stats.attack;
            score += Math.floor(baseAttack * totalMultiplier) * 5;
        }
        if (item.stats.defense) {
            const baseDefense = item.baseStats?.defense || item.stats.defense;
            score += Math.floor(baseDefense * totalMultiplier) * 3;
        }
        
        // 궁수의 경우 민첩을 공격력으로도 계산
        if (isArcher && item.stats.agility) {
            const baseAgility = item.baseStats?.agility || item.stats.agility;
            score += Math.floor(baseAgility * totalMultiplier * 2.2) * 5; // 민첩 기반 공격력
        }
        
        // 기타 스탯들
        score += (item.stats.hp || 0) * 1;
        score += (item.stats.dodge || 0) * 2;
        score += (item.stats.luck || 0) * 2;
        
        // 주스탯이 아닌 스탯들
        if (userMainStat !== 'strength' && item.stats.strength) score += item.stats.strength * 2;
        if (userMainStat !== 'agility' && item.stats.agility && !isArcher) score += item.stats.agility * 2;
        if (userMainStat !== 'intelligence' && item.stats.intelligence) score += item.stats.intelligence * 2;
        if (userMainStat !== 'vitality' && item.stats.vitality) score += item.stats.vitality * 2;
    }
    
    return score;
}

async function showEquipment(interaction) {
    await interaction.deferUpdate().catch(() => {});
    
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

    // 마법사 엠블럼 확인
    const emblemName = user.emblem || '';
    const equippedEmblemName = user.equippedEmblem || '';
    const checkEmblem = equippedEmblemName || emblemName;
    
    const isMage = checkEmblem && (
        checkEmblem === '견습 마법사' || 
        checkEmblem === '원소 술사' ||
        checkEmblem === '신비한 현자' ||
        checkEmblem === '대마법사' ||
        checkEmblem === '전설의 아크메이지' ||
        checkEmblem.includes('마법사') ||
        checkEmblem.includes('아크메이지')
    );

    // 장비 임베드
    const equipmentEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle(`⚔️ ${user.nickname || interaction.user.username}님의 장비관리`)
        .setDescription('현재 장착 중인 장비 목록입니다.\n🎆 **최적화 장착**을 사용하면 가장 좋은 장비를 자동으로 장착합니다!');

    // 전체 스탯 계산
    // [중요] 이 totalStats 객체는 장비 스탯 합산 전용입니다.
    // 사용자의 기본 스탯이나 다른 소스의 스탯은 여기에 추가하지 마세요.
    // combatPower.js의 getTotalStats 함수가 모든 스탯을 통합합니다.
    let totalStats = {
        attack: 0,
        defense: 0,
        hp: 0,
        dodge: 0,
        luck: 0,
        strength: 0,      // [중요] 장비 스탯만 추가
        agility: 0,       // [중요] 장비 스탯만 추가
        intelligence: 0,  // [중요] 장비 스탯만 추가
        vitality: 0,      // [중요] 장비 스탯만 추가
        luck: 0           // [중요] 장비 스탯만 추가
    };

    // 각 슬롯별 장비 표시
    for (const [slot, info] of Object.entries(EQUIPMENT_SLOTS)) {
        const equippedSlot = user.equipment?.[slot];
        let equippedItem = null;
        
        // 장착된 아이템 찾기 - inventorySlot 또는 인덱스로 찾기
        if (equippedSlot >= 0 && user.inventory) {
            // inventorySlot으로 먼저 찾기
            equippedItem = user.inventory.find(item => item.inventorySlot === equippedSlot);
            
            // 못 찾았으면 배열 인덱스로 찾기
            if (!equippedItem) {
                equippedItem = user.inventory[equippedSlot];
            }
        }
        
        if (equippedItem) {
            const enhancement = equippedItem.enhancement ? ` (+${equippedItem.enhancement})` : '';
            
            // 희귀도 이모지 처리 - 영문/한글 모두 지원
            let rarityEmoji = '';
            if (equippedItem.rarity) {
                // 영문 희귀도를 한글로 변환
                const rarityMap = {
                    'common': '일반',
                    'uncommon': '고급',
                    'rare': '레어',
                    'epic': '에픽',
                    'legendary': '레전드리',
                    'mythic': '신화'
                };
                const rarity = rarityMap[equippedItem.rarity] || equippedItem.rarity;
                rarityEmoji = RARITY_EMOJIS[rarity] || '';
            }
            
            const statText = [];
            
            // 구버전 호환성을 위한 stats 객체 생성
            const itemStats = equippedItem.stats || {};
            if (!equippedItem.stats) {
                // 구버전 아이템의 개별 속성들을 stats 객체로 복사
                if (equippedItem.attack !== undefined) itemStats.attack = equippedItem.attack;
                if (equippedItem.defense !== undefined) itemStats.defense = equippedItem.defense;
                if (equippedItem.strength !== undefined) itemStats.strength = equippedItem.strength;
                if (equippedItem.agility !== undefined) itemStats.agility = equippedItem.agility;
                if (equippedItem.intelligence !== undefined) itemStats.intelligence = equippedItem.intelligence;
                if (equippedItem.vitality !== undefined) itemStats.vitality = equippedItem.vitality;
                if (equippedItem.luck !== undefined) itemStats.luck = equippedItem.luck;
                if (equippedItem.hp !== undefined) itemStats.hp = equippedItem.hp;
                if (equippedItem.dodge !== undefined) itemStats.dodge = equippedItem.dodge;
                if (equippedItem.evasion !== undefined) itemStats.dodge = equippedItem.evasion;
            }
            
            if (itemStats.attack) {
                // stats.attack에 이미 강화 보너스가 포함되어 있음
                const attackBonus = itemStats.attack;
                const baseAttack = equippedItem.baseStats?.attack || attackBonus;
                const enhanceBonus = equippedItem.enhanceLevel > 0 ? attackBonus - baseAttack : 0;
                
                // 직업별 스탯 표시 확인
                const emblemName = user.emblem || '';
                const equippedEmblemName = user.equippedEmblem || '';
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
                
                const attackEmoji = isMage ? '🔮' : '⚔️';
                if (enhanceBonus > 0) {
                    statText.push(`${attackEmoji} +${attackBonus} (${baseAttack}+${enhanceBonus})`);
                } else {
                    statText.push(`${attackEmoji} +${attackBonus}`);
                }
                totalStats.attack += attackBonus;
            }
            if (itemStats.defense) {
                    // stats.defense에 이미 강화 보너스가 포함되어 있음
                    const defenseBonus = itemStats.defense;
                    const baseDefense = equippedItem.baseStats?.defense || defenseBonus;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 ? defenseBonus - baseDefense : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`🛡️ +${defenseBonus} (${baseDefense}+${enhanceBonus})`);
                    } else {
                        statText.push(`🛡️ +${defenseBonus}`);
                    }
                    totalStats.defense += defenseBonus;
                }
                if (itemStats.strength) {
                    const baseStrength = equippedItem.baseStats?.strength || itemStats.strength;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.strength - baseStrength : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`💪 +${itemStats.strength} (${baseStrength}+${enhanceBonus})`);
                    } else {
                        statText.push(`💪 +${itemStats.strength}`);
                    }
                    totalStats.strength += itemStats.strength; // [중요] totalStats에 추가됨
                }
                if (itemStats.agility) {
                    const baseAgility = equippedItem.baseStats?.agility || itemStats.agility;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.agility - baseAgility : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`🏃 +${itemStats.agility} (${baseAgility}+${enhanceBonus})`);
                    } else {
                        statText.push(`🏃 +${itemStats.agility}`);
                    }
                    totalStats.agility += itemStats.agility;
                }
                if (itemStats.intelligence) {
                    const baseIntelligence = equippedItem.baseStats?.intelligence || itemStats.intelligence;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.intelligence - baseIntelligence : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`🧠 +${itemStats.intelligence} (${baseIntelligence}+${enhanceBonus})`);
                    } else {
                        statText.push(`🧠 +${itemStats.intelligence}`);
                    }
                    totalStats.intelligence += itemStats.intelligence;
                }
                if (itemStats.vitality) {
                    const baseVitality = equippedItem.baseStats?.vitality || itemStats.vitality;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.vitality - baseVitality : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`❤️ +${itemStats.vitality} (${baseVitality}+${enhanceBonus})`);
                    } else {
                        statText.push(`❤️ +${itemStats.vitality}`);
                    }
                    totalStats.vitality += itemStats.vitality;
                }
                if (itemStats.luck) {
                    const baseLuck = equippedItem.baseStats?.luck || itemStats.luck;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.luck - baseLuck : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`🍀 +${itemStats.luck} (${baseLuck}+${enhanceBonus})`);
                    } else {
                        statText.push(`🍀 +${itemStats.luck}`);
                    }
                    totalStats.luck += itemStats.luck;
                }
                if (itemStats.hp) {
                    // stats.hp에 이미 강화 보너스가 포함되어 있음
                    const hpBonus = itemStats.hp;
                    const baseHp = equippedItem.baseStats?.hp || hpBonus;
                    const enhanceBonus = equippedItem.enhanceLevel > 0 ? hpBonus - baseHp : 0;
                    
                    if (enhanceBonus > 0) {
                        statText.push(`💖 +${hpBonus} (${baseHp}+${enhanceBonus})`);
                    } else {
                        statText.push(`💖 +${hpBonus}`);
                    }
                    totalStats.hp += hpBonus;
                }
            if (itemStats.dodge) {
                const baseDodge = equippedItem.baseStats?.dodge || itemStats.dodge;
                const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.dodge - baseDodge : 0;
                
                if (enhanceBonus > 0) {
                    statText.push(`💨 +${itemStats.dodge} (${baseDodge}+${enhanceBonus})`);
                } else {
                    statText.push(`💨 +${itemStats.dodge}`);
                }
                totalStats.dodge += itemStats.dodge;
            }
            
            // 특수 속성 (악세서리용)
            if (itemStats.goldBonus) {
                statText.push(`💰 골드 +${itemStats.goldBonus}%`);
            }
            if (itemStats.expBonus) {
                statText.push(`⭐ 경험치 +${itemStats.expBonus}%`);
            }
            if (itemStats.criticalChance) {
                statText.push(`⚡ 치명타 +${itemStats.criticalChance}%`);
            }
            if (itemStats.criticalDamage) {
                statText.push(`💥 치명타 피해 +${itemStats.criticalDamage}%`);
            }
            
            const itemScore = calculateItemScore(equippedItem);
            
            // 개별 아이템 전투력 계산
            let itemCombatPower = 0;
            const { getJobFromEmblem, JOB_WEIGHTS } = require('../common/combatPower');
            const job = getJobFromEmblem(user.emblem);
            const weights = job ? JOB_WEIGHTS[job] : null;
            
            if (weights) {
                // 직업별 가중치 적용
                if (itemStats.attack) itemCombatPower += itemStats.attack * (weights.attack || 1);
                if (itemStats.defense) itemCombatPower += itemStats.defense * (weights.defense || 1);
                if (itemStats.strength) itemCombatPower += itemStats.strength * (weights.strength || 1);
                if (itemStats.agility) itemCombatPower += itemStats.agility * (weights.agility || 1);
                if (itemStats.intelligence) itemCombatPower += itemStats.intelligence * (weights.intelligence || 1);
                if (itemStats.vitality) itemCombatPower += itemStats.vitality * (weights.vitality || 1);
                if (itemStats.luck) itemCombatPower += itemStats.luck * (weights.luck || 1);
                if (itemStats.hp) itemCombatPower += itemStats.hp * (weights.hp || 0.3);
                if (itemStats.dodge) itemCombatPower += itemStats.dodge * (weights.dodge || 1);
            } else {
                // 기본 가중치
                if (itemStats.attack) itemCombatPower += itemStats.attack * 2;
                if (itemStats.defense) itemCombatPower += itemStats.defense * 1.5;
                if (itemStats.strength) itemCombatPower += itemStats.strength * 2;
                if (itemStats.agility) itemCombatPower += itemStats.agility * 1.5;
                if (itemStats.intelligence) itemCombatPower += itemStats.intelligence * 1.2;
                if (itemStats.vitality) itemCombatPower += itemStats.vitality * 1.8;
                if (itemStats.luck) itemCombatPower += itemStats.luck * 0.5;
                if (itemStats.hp) itemCombatPower += itemStats.hp * 0.3;
                if (itemStats.dodge) itemCombatPower += itemStats.dodge * 1;
            }
            
            // 이름이 없는 경우 처리
            const itemName = equippedItem.name || equippedItem.type;
            
            if (!itemName) {
                // 이름이 없으면 비어있음으로 처리
                equipmentEmbed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: '🕳️ `비어있음`',
                    inline: true
                });
            } else {
                const displayStats = statText.length > 0 ? statText.join(' ') : '능력치 없음';
                
                equipmentEmbed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: `${rarityEmoji} **${itemName}**${enhancement}\n${displayStats}\n💯 점수: ${formatNumber(itemScore)}`,
                    inline: true
                });
            }
        } else {
            equipmentEmbed.addFields({
                name: `${info.emoji} ${info.name}`,
                value: '🕳️ `비어있음`',
                inline: true
            });
        }
    }

    // 악세서리 섹션 추가
    equipmentEmbed.addFields({
        name: '\n💍 악세서리',
        value: '━━━━━━━━━━━━━━━━━━━━',
        inline: false
    });

    // 각 악세서리 슬롯별 장비 표시
    for (const [slot, info] of Object.entries(ACCESSORY_SLOTS)) {
        let equippedItem = null;
        
        // equippedAccessories에서만 찾기 (마이그레이션이 완료되었으므로)
        if (user.equippedAccessories && user.equippedAccessories[slot]) {
            equippedItem = user.equippedAccessories[slot];
        }
        
        if (equippedItem) {
            const enhancement = equippedItem.enhancement ? ` (+${equippedItem.enhancement})` : '';
            
            // 희귀도 이모지 처리
            let rarityEmoji = '';
            if (equippedItem.rarity) {
                const rarityMap = {
                    'common': '일반',
                    'uncommon': '고급',
                    'rare': '레어',
                    'epic': '에픽',
                    'legendary': '레전드리',
                    'mythic': '신화'
                };
                const rarity = rarityMap[equippedItem.rarity] || equippedItem.rarity;
                rarityEmoji = RARITY_EMOJIS[rarity] || '';
            }
            
            const statText = [];
            
            // 구버전 호환성을 위한 stats 객체 생성
            const itemStats = equippedItem.stats || {};
            if (!equippedItem.stats) {
                // 구버전 아이템의 개별 속성들을 stats 객체로 복사
                if (equippedItem.attack !== undefined) itemStats.attack = equippedItem.attack;
                if (equippedItem.defense !== undefined) itemStats.defense = equippedItem.defense;
                if (equippedItem.strength !== undefined) itemStats.strength = equippedItem.strength;
                if (equippedItem.agility !== undefined) itemStats.agility = equippedItem.agility;
                if (equippedItem.intelligence !== undefined) itemStats.intelligence = equippedItem.intelligence;
                if (equippedItem.vitality !== undefined) itemStats.vitality = equippedItem.vitality;
                if (equippedItem.luck !== undefined) itemStats.luck = equippedItem.luck;
                if (equippedItem.hp !== undefined) itemStats.hp = equippedItem.hp;
                if (equippedItem.dodge !== undefined) itemStats.dodge = equippedItem.dodge;
                if (equippedItem.evasion !== undefined) itemStats.dodge = equippedItem.evasion;
            }
            
            if (itemStats.attack) {
                // stats.attack에 이미 강화 보너스가 포함되어 있음
                const attackBonus = itemStats.attack;
                const attackEmoji = isMage ? '🔮' : '⚔️';
                statText.push(`${attackEmoji} +${attackBonus}`);
                totalStats.attack += attackBonus;
            }
            if (itemStats.defense) {
                // stats.defense에 이미 강화 보너스가 포함되어 있음
                const defenseBonus = itemStats.defense;
                statText.push(`🛡️ +${defenseBonus}`);
                totalStats.defense += defenseBonus;
            }
            if (itemStats.luck) {
                statText.push(`🍀 +${itemStats.luck}`);
                totalStats.luck += itemStats.luck;
            }
            if (itemStats.hp) {
                // stats.hp에 이미 강화 보너스가 포함되어 있음
                const hpBonus = itemStats.hp;
                statText.push(`💖 +${hpBonus}`);
                totalStats.hp += hpBonus;
            }
            if (itemStats.dodge) {
                const baseDodge = equippedItem.baseStats?.dodge || itemStats.dodge;
                const enhanceBonus = equippedItem.enhanceLevel > 0 && equippedItem.baseStats ? itemStats.dodge - baseDodge : 0;
                
                if (enhanceBonus > 0) {
                    statText.push(`💨 +${itemStats.dodge} (${baseDodge}+${enhanceBonus})`);
                } else {
                    statText.push(`💨 +${itemStats.dodge}`);
                }
                totalStats.dodge += itemStats.dodge;
            }
            
            // 특수 속성 (악세서리용)
            if (itemStats.goldBonus) {
                statText.push(`💰 골드 +${itemStats.goldBonus}%`);
            }
            if (itemStats.expBonus) {
                statText.push(`⭐ 경험치 +${itemStats.expBonus}%`);
            }
            if (itemStats.criticalChance) {
                statText.push(`⚡ 치명타 +${itemStats.criticalChance}%`);
            }
            if (itemStats.criticalDamage) {
                statText.push(`💥 치명타 피해 +${itemStats.criticalDamage}%`);
            }
            
            const itemScore = calculateItemScore(equippedItem);
            
            // 개별 아이템 전투력 계산
            let itemCombatPower = 0;
            const { getJobFromEmblem, JOB_WEIGHTS } = require('../common/combatPower');
            const job = getJobFromEmblem(user.emblem);
            const weights = job ? JOB_WEIGHTS[job] : null;
            
            if (weights) {
                // 직업별 가중치 적용
                if (itemStats.attack) itemCombatPower += itemStats.attack * (weights.attack || 1);
                if (itemStats.defense) itemCombatPower += itemStats.defense * (weights.defense || 1);
                if (itemStats.strength) itemCombatPower += itemStats.strength * (weights.strength || 1);
                if (itemStats.agility) itemCombatPower += itemStats.agility * (weights.agility || 1);
                if (itemStats.intelligence) itemCombatPower += itemStats.intelligence * (weights.intelligence || 1);
                if (itemStats.vitality) itemCombatPower += itemStats.vitality * (weights.vitality || 1);
                if (itemStats.luck) itemCombatPower += itemStats.luck * (weights.luck || 1);
                if (itemStats.hp) itemCombatPower += itemStats.hp * (weights.hp || 0.3);
                if (itemStats.dodge) itemCombatPower += itemStats.dodge * (weights.dodge || 1);
            } else {
                // 기본 가중치
                if (itemStats.attack) itemCombatPower += itemStats.attack * 2;
                if (itemStats.defense) itemCombatPower += itemStats.defense * 1.5;
                if (itemStats.strength) itemCombatPower += itemStats.strength * 2;
                if (itemStats.agility) itemCombatPower += itemStats.agility * 1.5;
                if (itemStats.intelligence) itemCombatPower += itemStats.intelligence * 1.2;
                if (itemStats.vitality) itemCombatPower += itemStats.vitality * 1.8;
                if (itemStats.luck) itemCombatPower += itemStats.luck * 0.5;
                if (itemStats.hp) itemCombatPower += itemStats.hp * 0.3;
                if (itemStats.dodge) itemCombatPower += itemStats.dodge * 1;
            }
            
            // 이름이 없는 경우 처리
            const itemName = equippedItem.name || equippedItem.type;
            
            if (!itemName) {
                // 이름이 없으면 비어있음으로 처리
                equipmentEmbed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: '🕳️ `비어있음`',
                    inline: true
                });
            } else {
                const displayStats = statText.length > 0 ? statText.join(' ') : '능력치 없음';
                
                equipmentEmbed.addFields({
                    name: `${info.emoji} ${info.name}`,
                    value: `${rarityEmoji} **${itemName}**${enhancement}\n${displayStats}\n💯 점수: ${formatNumber(itemScore)}`,
                    inline: true
                });
            }
        } else {
            equipmentEmbed.addFields({
                name: `${info.emoji} ${info.name}`,
                value: '🕳️ `비어있음`',
                inline: true
            });
        }
    }

    // 전체 스탯 합계 및 전투력 기여도 계산
    const totalStatText = [];
    const attackLabel = isMage ? '🔮 마력' : '⚔️ 공격력';
    
    // 직업별 가중치 가져오기
    const { getJobFromEmblem, JOB_WEIGHTS } = require('../common/combatPower');
    const job = getJobFromEmblem(user.emblem);
    const weights = job ? JOB_WEIGHTS[job] : null;
    
    // 각 스탯의 전투력 기여도 계산
    let statContributions = {};
    
    if (totalStats.attack > 0) {
        const weight = weights?.attack || 1.5;
        const contribution = Math.floor(totalStats.attack * weight);
        statContributions.attack = contribution;
        totalStatText.push(`${attackLabel}: +${totalStats.attack} (전투력 +${contribution})`);
    }
    if (totalStats.defense > 0) {
        const weight = weights?.defense || 1.2;
        const contribution = Math.floor(totalStats.defense * weight);
        statContributions.defense = contribution;
        totalStatText.push(`🛡️ 방어력: +${totalStats.defense} (전투력 +${contribution})`);
    }
    if (totalStats.hp > 0) {
        const weight = weights?.hp || 0.3;
        const contribution = Math.floor(totalStats.hp * weight);
        statContributions.hp = contribution;
        totalStatText.push(`❤️ HP: +${totalStats.hp} (전투력 +${contribution})`);
    }
    if (totalStats.dodge > 0) {
        const weight = weights?.dodge || 1.0;
        const contribution = Math.floor(totalStats.dodge * weight);
        statContributions.dodge = contribution;
        totalStatText.push(`💨 회피: +${totalStats.dodge} (전투력 +${contribution})`);
    }
    if (totalStats.luck > 0) {
        const weight = weights?.luck || 0.5;
        const contribution = Math.floor(totalStats.luck * weight);
        statContributions.luck = contribution;
        totalStatText.push(`🍀 행운: +${totalStats.luck} (전투력 +${contribution})`);
    }
    
    // 기본 스탯들도 표시
    if (totalStats.strength > 0) {
        const weight = weights?.strength || 1.0;
        const contribution = Math.floor(totalStats.strength * weight);
        statContributions.strength = contribution;
        totalStatText.push(`💪 힘: +${totalStats.strength} (전투력 +${contribution})`);
    }
    if (totalStats.agility > 0) {
        const weight = weights?.agility || 1.0;
        const contribution = Math.floor(totalStats.agility * weight);
        statContributions.agility = contribution;
        totalStatText.push(`🏃 민첩: +${totalStats.agility} (전투력 +${contribution})`);
    }
    if (totalStats.intelligence > 0) {
        const weight = weights?.intelligence || 1.0;
        const contribution = Math.floor(totalStats.intelligence * weight);
        statContributions.intelligence = contribution;
        totalStatText.push(`🧠 지능: +${totalStats.intelligence} (전투력 +${contribution})`);
    }
    if (totalStats.vitality > 0) {
        const weight = weights?.vitality || 1.0;
        const contribution = Math.floor(totalStats.vitality * weight);
        statContributions.vitality = contribution;
        totalStatText.push(`❤️ 체력: +${totalStats.vitality} (전투력 +${contribution})`);
    }

    if (totalStatText.length > 0) {
        equipmentEmbed.addFields({
            name: '📊 총 장비 스탯',
            value: totalStatText.join('\n'),
            inline: false
        });
    }

    // 전투력 계산 - 통합 함수 사용
    const combatPower = calculateCombatPower(user);
    
    // DB의 전투력과 다르면 업데이트
    if (user.combatPower !== combatPower) {
        user.combatPower = combatPower;
        await user.save();
    }
    
    equipmentEmbed.addFields({
        name: '⚔️ 전투력',
        value: `${formatNumber(combatPower)}`,
        inline: false
    });

    // 버튼 생성
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('optimize_equipment')
                .setLabel('🎆 최적화 장착')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('equip_category')
                .setLabel('🎽 수동 장착')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('unequip_all')
                .setLabel('🚫 전체 해제')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setLabel('🎒 인벤토리')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );

    try {
        return await interaction.editReply({
            embeds: [equipmentEmbed],
            components: [buttons],
        });
    } catch (error) {
        console.error('[showEquipment] editReply 오류:', error);
        throw error;
    }
}

// 장비 카테고리 선택
async function showEquipCategory(interaction) {
    console.log('[showEquipCategory] 함수 시작');
    console.log('[showEquipCategory] interaction 상태:', {
        deferred: interaction.deferred,
        replied: interaction.replied,
        customId: interaction.customId
    });
    
    const categoryEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎽 장비 카테고리 선택')
        .setDescription('장착할 장비의 카테고리를 선택하세요.');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('equip_slot_select')
        .setPlaceholder('장비 슬롯을 선택하세요')
        .addOptions([
            // 일반 장비 슬롯
            ...Object.entries(EQUIPMENT_SLOTS).map(([slot, info]) => ({
                label: info.name,
                value: slot,
                emoji: info.emoji,
                description: `${info.name} 슬롯의 장비를 장착합니다`
            })),
            // 악세서리 카테고리 추가
            {
                label: '악세서리',
                value: 'accessory_category',
                emoji: '💍',
                description: '악세서리 슬롯을 선택합니다'
            }
        ]);

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비로 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );

    // interaction 응답 처리
    try {
        if (interaction.deferred || interaction.replied) {
            console.log('[showEquipCategory] editReply 사용');
            return await interaction.editReply({
                embeds: [categoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        } else {
            console.log('[showEquipCategory] update 사용');
            return await interaction.update({
                embeds: [categoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        }
    } catch (error) {
        console.error('[showEquipCategory] 응답 오류:', error.message);
        if (error.code === 10062) {
            console.log('[showEquipCategory] Unknown interaction - 타임아웃');
            return;
        }
        throw error;
    }
}

// 장착 가능한 아이템 목록 표시
async function showEquippableItems(interaction, slot, page = 1, isAccessorySlot = false) {
    console.log('[showEquippableItems] 함수 시작 - 슬롯:', slot, '페이지:', page, '악세서리슬롯:', isAccessorySlot);
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!', 
            flags: 64 
        });
    }

    // 해당 슬롯에 장착 가능한 아이템 필터링
    const equippableItems = user.inventory?.filter(item => {
        // 악세서리 슬롯인 경우 악세서리 타입만
        if (isAccessorySlot || ACCESSORY_SLOTS[slot]) {
            return item.type === 'accessory';
        }
        return item.type === slot;
    }) || [];
    
    if (equippableItems.length === 0) {
        const slotInfo = ACCESSORY_SLOTS[slot] ? 
            `${ACCESSORY_SLOTS[slot].emoji} ${ACCESSORY_SLOTS[slot].name}` : 
            `${EQUIPMENT_SLOTS[slot].emoji} ${EQUIPMENT_SLOTS[slot].name}`;
        const additionalInfo = ACCESSORY_SLOTS[slot] ? '\n\nℹ️ 악세서리 타입의 아이템을 장착할 수 있습니다.' : '';
        
        try {
            const responseData = {
                content: `${slotInfo} 슬롯에 장착 가능한 아이템이 없습니다.${additionalInfo}`,
                embeds: [],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('equip_category')
                            .setLabel('🎽 다른 슬롯 선택')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('equipment')
                            .setLabel('⚔️ 장비로 돌아가기')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ]
            };
            
            if (interaction.deferred || interaction.replied) {
                console.log('[showEquippableItems] 아이템 없음 - editReply 사용');
                return await interaction.editReply(responseData);
            } else {
                console.log('[showEquippableItems] 아이템 없음 - update 사용');
                return await interaction.update(responseData);
            }
        } catch (error) {
            console.error('[showEquippableItems] 응답 오류:', error);
            if (error.code === 10062) {
                return;
            }
            throw error;
        }
    }

    // 페이지네이션 설정
    const itemsPerPage = 20;
    const totalPages = Math.ceil(equippableItems.length / itemsPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = equippableItems.slice(startIndex, endIndex);

    const slotDisplay = ACCESSORY_SLOTS[slot] ? 
        `${ACCESSORY_SLOTS[slot].emoji} ${ACCESSORY_SLOTS[slot].name}` : 
        `${EQUIPMENT_SLOTS[slot].emoji} ${EQUIPMENT_SLOTS[slot].name}`;
    
    const itemListEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`${slotDisplay} 장착`)
        .setDescription(`장착할 아이템을 선택하세요.\n총 ${equippableItems.length}개의 아이템`)
        .setFooter({ text: `페이지 ${currentPage}/${totalPages}` });

    // 아이템 선택 메뉴 (최대 25개)
    const selectOptions = pageItems.slice(0, 25).map((item) => {
        const enhancement = item.enhancement ? ` (+${item.enhancement})` : '';
        const stats = [];
        if (item.stats?.attack) {
            const totalAttack = item.stats.attack + (item.enhancement || 0) * 10;
            stats.push(`⚔️ +${totalAttack}`);
        }
        if (item.stats?.defense) {
            const totalDefense = item.stats.defense + (item.enhancement || 0) * 10;
            stats.push(`🛡️ +${totalDefense}`);
        }
        if (item.stats?.hp) stats.push(`❤️ +${item.stats.hp}`);
        
        // 실제 인벤토리에서의 인덱스 찾기
        const inventoryIndex = user.inventory.findIndex(invItem => invItem === item);
        
        const rarityEmoji = RARITY_EMOJIS[item.rarity] || '';
        
        
        return {
            label: `${item.name}${enhancement}`,
            value: String(inventoryIndex),
            description: stats.join(' ') || '스탯 없음',
            emoji: rarityEmoji || (ACCESSORY_SLOTS[slot] ? ACCESSORY_SLOTS[slot].emoji : EQUIPMENT_SLOTS[slot]?.emoji) || '💍'
        };
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`equip_item_${slot}`)
        .setPlaceholder('아이템을 선택하세요')
        .addOptions(selectOptions);

    // 페이지네이션 버튼
    const navigationButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`equip_page_${slot}_${currentPage - 1}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`equip_page_${slot}_${currentPage + 1}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages),
            new ButtonBuilder()
                .setCustomId('equip_category')
                .setLabel('🎽 다른 슬롯')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('⚔️ 장비관리')
                .setStyle(ButtonStyle.Secondary)
        );

    const components = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지가 여러 개인 경우에만 네비게이션 버튼 추가
    if (totalPages > 1 || true) {  // 항상 버튼을 표시
        components.push(navigationButtons);
    }

    try {
        const responseData = {
            embeds: [itemListEmbed],
            components: components
        };
        
        if (interaction.deferred || interaction.replied) {
            console.log('[showEquippableItems] 아이템 목록 표시 - editReply 사용');
            return await interaction.editReply(responseData);
        } else {
            console.log('[showEquippableItems] 아이템 목록 표시 - update 사용');
            return await interaction.update(responseData);
        }
    } catch (error) {
        console.error('[showEquippableItems] 아이템 목록 응답 오류:', error);
        if (error.code === 10062) {
            console.log('[showEquippableItems] Unknown interaction - 타임아웃');
            return;
        }
        throw error;
    }
}


// 최적화 장착 기능
async function optimizeEquipment(interaction) {
    console.log('[optimizeEquipment] 함수 시작');
    console.log('[optimizeEquipment] interaction 상태:', {
        deferred: interaction.deferred,
        replied: interaction.replied,
        customId: interaction.customId
    });
    
    // defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
            console.log('[optimizeEquipment] deferUpdate 성공');
        } else {
            console.log('[optimizeEquipment] 이미 deferred 또는 replied 상태');
        }
    } catch (error) {
        console.error('[optimizeEquipment] defer 오류:', error.message);
        if (error.code === 10062) {
            console.log('[optimizeEquipment] Unknown interaction - 타임아웃');
            return;
        }
    }
    
    let user;
    try {
        user = await getUser(interaction.user.id);
        if (!user || !user.registered) {
            return await interaction.followUp({ 
                content: '먼저 회원가입을 해주세요!',
                flags: 64
            });
        }
        console.log('[optimizeEquipment] 유저 정보 로드 완료:', user.nickname || user.discordId);
    } catch (error) {
        console.error('[optimizeEquipment] 유저 데이터 로드 오류:', error);
        return await interaction.followUp({ 
            content: '❌ 유저 데이터 로드 중 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    console.log(`[optimizeEquipment] 유저 ${user.nickname || interaction.user.username}의 일괄착용 시작`);
    console.log(`[optimizeEquipment] 인벤토리 아이템 개수: ${user.inventory?.length || 0}`);
    
    let changedSlots = [];
    let totalScoreImprovement = 0;
    
    // 각 슬롯별로 최적 아이템 찾기
    for (const [slot, info] of Object.entries(EQUIPMENT_SLOTS)) {
        const currentSlot = user.equipment?.[slot];
        let currentItem = null;
        
        // inventorySlot으로 찾기
        if (currentSlot >= 0) {
            currentItem = user.inventory?.find(item => item.inventorySlot === currentSlot);
            if (!currentItem) {
                // 배열 인덱스로 찾기 (fallback)
                currentItem = user.inventory?.[currentSlot];
            }
        }
        
        const currentScore = calculateItemScore(currentItem, user.emblem);
        
        if (currentItem) {
            console.log(`[optimizeEquipment] ${slot} 현재 장착: "${currentItem.name}" (인덱스: ${currentSlot}, 점수: ${currentScore}, 희귀도: ${currentItem.rarity}, 강화: +${currentItem.enhancement || 0})`);
        } else {
            console.log(`[optimizeEquipment] ${slot} 현재 장착: 없음`);
        }
        
        // 해당 슬롯에 장착 가능한 모든 아이템 찾기 (인덱스와 함께)
        const availableItems = [];
        user.inventory?.forEach((item, index) => {
            // 아이템 타입 확인
            if (!item.type) {
                console.log(`[optimizeEquipment] 경고: 아이템 "${item.name}"의 타입이 없음`);
                return;
            }
            
            // 해당 슬롯에 맞는 아이템만
            if (item.type === slot) {
                availableItems.push({ item, index });
            }
        });
        
        console.log(`[optimizeEquipment] ${slot} 슬롯: 장착 가능한 아이템 ${availableItems.length}개`);
        
        // 최고 점수 아이템 찾기
        let bestItem = null;
        let bestItemIndex = -1;
        let bestScore = 0;
        
        for (const { item, index } of availableItems) {
            const score = calculateItemScore(item, user.emblem);
            const stats = item.stats ? Object.entries(item.stats).map(([k, v]) => `${k}:${v}`).join(', ') : 'none';
            console.log(`[optimizeEquipment] ${slot} 아이템 평가: "${item.name}" (인덱스: ${index}, 점수: ${score}, 희귀도: ${item.rarity}, 강화: +${item.enhancement || 0}, 스탯: ${stats})`);
            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
                bestItemIndex = index;
            }
        }
        
        if (bestItem) {
            console.log(`[optimizeEquipment] ${slot} 최고 점수 아이템: ${bestItem.name} (점수: ${bestScore}, 인덱스: ${bestItemIndex})`);
        }
        
        // 더 좋은 아이템이 있으면 교체
        if (bestItem && bestScore > currentScore && bestItemIndex !== -1) {
            console.log(`[optimizeEquipment] ${slot} 슬롯 교체: 현재 점수 ${currentScore} → 새 점수 ${bestScore}`);
            console.log(`[optimizeEquipment] 교체 상세: 기존 인덱스 ${currentSlot} → 새 인덱스 ${bestItemIndex}`);
            
            // 현재 장착 슬롯 해제 (이미 인벤토리에 있으므로 추가 작업 불필요)
            if (currentSlot >= 0) {
                // 현재 장착된 아이템은 이미 인벤토리에 있음
            }
            
            // 새 아이템 장착 (inventorySlot 사용)
            user.equipment = user.equipment || {};
            const slotToUse = bestItem.inventorySlot !== undefined ? bestItem.inventorySlot : bestItemIndex;
            user.equipment[slot] = slotToUse;
            console.log(`[optimizeEquipment] ${slot} 슬롯 설정 완료: user.equipment[${slot}] = ${slotToUse} (inventorySlot: ${bestItem.inventorySlot}, index: ${bestItemIndex})`);
            
            // 장착된 아이템은 인벤토리에서 제거하지 않음 (슬롯 번호로 참조)
            
            changedSlots.push({
                slot: info.name,
                emoji: info.emoji,
                oldItem: currentItem,
                newItem: bestItem,
                scoreImprovement: bestScore - currentScore
            });
            
            totalScoreImprovement += bestScore - currentScore;
        }
    }
    
    // 악세서리 슬롯 최적화
    // 모든 악세서리 아이템을 수집하고 점수로 정렬
    const allAccessories = [];
    user.inventory?.forEach((item, index) => {
        if (item && item.type === 'accessory') {
            const score = calculateItemScore(item, user.emblem);
            allAccessories.push({ item, index, score });
        }
    });
    
    // 점수가 높은 순으로 정렬
    allAccessories.sort((a, b) => b.score - a.score);
    
    console.log(`[optimizeEquipment] 악세서리 아이템 ${allAccessories.length}개 발견`);
    
    // equippedAccessories 초기화
    if (!user.equippedAccessories) {
        user.equippedAccessories = {};
    }
    
    // 각 악세서리 슬롯에 최적의 아이템 할당
    let accessoryIndex = 0;
    for (const [slot, info] of Object.entries(ACCESSORY_SLOTS)) {
        // 현재 장착된 아이템 확인
        let currentItem = user.equippedAccessories[slot] || null;
        
        const currentScore = calculateItemScore(currentItem, user.emblem);
        
        // 아직 장착되지 않은 최고 점수 악세서리 찾기
        let bestAccessory = null;
        for (let i = accessoryIndex; i < allAccessories.length; i++) {
            const { item, index, score } = allAccessories[i];
            
            // 이미 다른 슬롯에 장착된 아이템인지 확인
            const slotToUse = item.inventorySlot !== undefined ? item.inventorySlot : index;
            const isAlreadyEquipped = Object.entries(user.equippedAccessories || {}).some(
                ([s, acc]) => s !== slot && acc && acc.inventorySlot === slotToUse
            );
            
            if (!isAlreadyEquipped && score > currentScore) {
                bestAccessory = allAccessories[i];
                accessoryIndex = i + 1; // 다음 슬롯은 그 다음 아이템부터 검색
                break;
            }
        }
        
        // 더 좋은 악세서리가 있으면 교체
        if (bestAccessory) {
            const { item: bestItem, index: bestItemIndex, score: bestScore } = bestAccessory;
            
            console.log(`[optimizeEquipment] ${slot} 슬롯 교체: 현재 점수 ${currentScore} → 새 점수 ${bestScore}`);
            
            // 새 아이템 장착
            const slotToUse = bestItem.inventorySlot !== undefined ? bestItem.inventorySlot : bestItemIndex;
            user.equippedAccessories[slot] = {
                ...bestItem,
                inventorySlot: slotToUse
            };
            
            changedSlots.push({
                slot: info.name,
                emoji: info.emoji,
                oldItem: currentItem,
                newItem: bestItem,
                scoreImprovement: bestScore - currentScore
            });
            
            totalScoreImprovement += bestScore - currentScore;
        }
    }
    
    try {
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        console.log(`[optimizeEquipment] 저장 완료. 변경된 슬롯 수: ${changedSlots.length}`);
        
        // 저장 후 확인
        const savedUser = await getUser(interaction.user.id);
        console.log(`[optimizeEquipment] 저장된 장비 상태:`, savedUser.equipment);
    } catch (saveError) {
        console.error('[optimizeEquipment] 저장 오류:', saveError);
        return await interaction.followUp({
            content: '❌ 장비 저장 중 오류가 발생했습니다.',
            flags: 64
        });
    }
    
    // 결과 메시지 생성
    if (changedSlots.length > 0) {
        const resultEmbed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎆 최적화 장착 완료!')
            .setDescription(`${changedSlots.length}개의 장비가 교체되었습니다.\n총 점수 상승: +${totalScoreImprovement}`)
            .setFooter({ text: '💡 팁: 강화 레벨이 높은 장비가 우선시됩니다!' });
        
        for (const change of changedSlots) {
            const oldName = change.oldItem ? `${change.oldItem.name} (+${change.oldItem.enhancement || 0})` : '비어있음';
            const newName = change.newItem ? `${change.newItem.name} (+${change.newItem.enhancement || 0})` : '알 수 없는 아이템';
            
            // 희귀도 이모지 처리 - 영문/한글 모두 지원
            let rarityEmoji = '';
            if (change.newItem && change.newItem.rarity) {
                // 영문 희귀도를 한글로 변환
                const rarityMap = {
                    'common': '일반',
                    'uncommon': '고급',
                    'rare': '레어',
                    'epic': '에픽',
                    'legendary': '레전드리',
                    'mythic': '신화'
                };
                const rarity = rarityMap[change.newItem.rarity] || change.newItem.rarity;
                rarityEmoji = RARITY_EMOJIS[rarity] || '';
            }
            
            resultEmbed.addFields({
                name: `${change.emoji} ${change.slot}`,
                value: `${oldName} → ${rarityEmoji} **${newName}**\n💯 점수: +${change.scoreImprovement}`,
                inline: true
            });
        }
        
        await interaction.followUp({
            embeds: [resultEmbed],
            flags: 64
        });
    } else {
        await interaction.followUp({
            content: '✅ 이미 최적의 장비를 착용 중입니다!',
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 아이템 장착 처리
async function equipItem(interaction, slot, itemIndex) {
    console.log('[equipItem] 함수 시작 - 슬롯:', slot, '아이템 인덱스:', itemIndex);
    
    // defer 처리
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
            console.log('[equipItem] deferUpdate 성공');
        }
    } catch (error) {
        console.error('[equipItem] defer 오류:', error.message);
        if (error.code === 10062) {
            return;
        }
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.followUp({ 
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    
    // 현재 장착된 아이템 확인
    const currentSlot = user.equipment?.[slot];
    
    // 장비 해제
    if (itemIndex === -1) {
        const isAccessorySlot = ACCESSORY_SLOTS[slot] !== undefined;
        
        if (isAccessorySlot) {
            // 장신구 해제
            if (user.equippedAccessories && user.equippedAccessories[slot]) {
                delete user.equippedAccessories[slot];
                
                // 전투력 재계산
                user.combatPower = calculateCombatPower(user);
                await user.save();
                
                await interaction.followUp({
                    content: `✅ ${ACCESSORY_SLOTS[slot].name}을(를) 해제했습니다.`,
                    flags: 64
                });
            }
        } else {
            // 일반 장비 해제
            if (currentSlot >= 0) {
                user.equipment[slot] = -1;
                // 전투력 재계산
                user.combatPower = calculateCombatPower(user);
                
                await user.save();
                
                await interaction.followUp({
                    content: `✅ ${EQUIPMENT_SLOTS[slot].name}을(를) 해제했습니다.`,
                    flags: 64
                });
            }
        }
    } else {
        // 새 아이템 확인
        console.log(`[equipItem] 장착 시도 - 슬롯: ${slot}, 인덱스: ${itemIndex}`);
        console.log(`[equipItem] 인벤토리 크기: ${user.inventory?.length || 0}`);
        
        // inventorySlot으로 아이템 찾기 (우선), 못 찾으면 인덱스로 찾기
        let newItem = user.inventory?.find(item => item.inventorySlot === itemIndex);
        if (!newItem) {
            newItem = user.inventory?.[itemIndex];
        }
        
        if (!newItem) {
            console.log(`[equipItem] 아이템을 찾을 수 없음 - 인덱스/슬롯: ${itemIndex}`);
            return await interaction.followUp({
                content: `❌ 아이템을 찾을 수 없습니다. (인덱스: ${itemIndex})`,
                flags: 64
            });
        }
        
        console.log(`[equipItem] 찾은 아이템: ${newItem.name}, 타입: ${newItem.type}, inventorySlot: ${newItem.inventorySlot}`);
        
        // 장신구 슬롯인지 확인
        const isAccessorySlot = ACCESSORY_SLOTS[slot] !== undefined;
        
        // 각 슬롯에 맞는 타입만 장착 가능
        const isValidType = isAccessorySlot ? newItem.type === 'accessory' : newItem.type === slot;
        
        if (!isValidType) {
            return await interaction.followUp({
                content: '❌ 이 슬롯에 장착할 수 없는 아이템입니다.',
                flags: 64
            });
        }
        
        // inventorySlot을 사용하여 장착
        const slotToUse = newItem.inventorySlot !== undefined ? newItem.inventorySlot : itemIndex;
        
        if (isAccessorySlot) {
            // 장신구 장착 처리
            if (!user.equippedAccessories) user.equippedAccessories = {};
            
            // 이미 다른 장신구 슬롯에 장착 중인지 확인
            const alreadyEquippedAccessory = Object.entries(user.equippedAccessories || {}).find(
                ([s, acc]) => s !== slot && acc && acc.inventorySlot === slotToUse
            );
            
            if (alreadyEquippedAccessory) {
                return await interaction.followUp({
                    content: `❌ 이 아이템은 이미 ${ACCESSORY_SLOTS[alreadyEquippedAccessory[0]].name}에 장착 중입니다.`,
                    flags: 64
                });
            }
            
            // 장신구 장착
            user.equippedAccessories[slot] = {
                ...newItem,
                inventorySlot: slotToUse
            };
        } else {
            // 일반 장비 장착 처리
            // 이미 다른 슬롯에 장착 중인지 확인
            const alreadyEquipped = Object.entries(user.equipment || {}).find(
                ([s, idx]) => s !== slot && idx === slotToUse
            );
            
            if (alreadyEquipped) {
                return await interaction.followUp({
                    content: `❌ 이 아이템은 이미 ${EQUIPMENT_SLOTS[alreadyEquipped[0]].name}에 장착 중입니다.`,
                    flags: 64
                });
            }
            
            // 장비 설정
            if (!user.equipment) user.equipment = {};
            user.equipment[slot] = slotToUse;
        }
        
        // inventorySlot 필드도 설정
        if (newItem.inventorySlot === undefined) {
            newItem.inventorySlot = itemIndex;
            user.markModified('inventory');
        }
        
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        
        // 희귀도 이모지 처리 - 영문/한글 모두 지원
        let rarityEmoji = '';
        if (newItem.rarity) {
            // 영문 희귀도를 한글로 변환
            const rarityMap = {
                'common': '일반',
                'uncommon': '고급',
                'rare': '레어',
                'epic': '에픽',
                'legendary': '레전드리',
                'mythic': '신화'
            };
            const rarity = rarityMap[newItem.rarity] || newItem.rarity;
            rarityEmoji = RARITY_EMOJIS[rarity] || '';
        }
        
        const enhancement = newItem.enhancement ? ` (+${newItem.enhancement})` : '';
        const slotName = isAccessorySlot ? ACCESSORY_SLOTS[slot].name : EQUIPMENT_SLOTS[slot].name;
        
        await interaction.followUp({
            content: `✅ ${rarityEmoji} **${newItem.name}**${enhancement}을(를) ${slotName}에 장착했습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 전체 장비 해제
async function unequipAll(interaction) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[Equipment] Interaction expired');
            return;
        }
        console.error('[Equipment] Defer error:', error);
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }
    
    // 모든 장비 슬롯 초기화
    let unequippedCount = 0;
    if (user.equipment) {
        for (const slot of Object.keys(EQUIPMENT_SLOTS)) {
            if (user.equipment[slot] >= 0) {
                user.equipment[slot] = -1;
                unequippedCount++;
            }
        }
    }
    
    // 모든 장신구 슬롯 초기화
    if (user.equippedAccessories) {
        for (const slot of Object.keys(ACCESSORY_SLOTS)) {
            if (user.equippedAccessories[slot]) {
                delete user.equippedAccessories[slot];
                unequippedCount++;
            }
        }
    }
    
    if (unequippedCount === 0) {
        await interaction.followUp({
            content: 'ℹ️ 장착 중인 장비가 없습니다.',
            flags: 64
        });
    } else {
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        await interaction.followUp({
            content: `✅ ${unequippedCount}개의 장비를 모두 해제했습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 아이템 장착 핸들러
async function handleEquipItem(interaction) {
    console.log('[handleEquipItem] 함수 시작');
    console.log('[handleEquipItem] customId:', interaction.customId);
    
    // equip_item_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[2];
    const selectedValues = interaction.values;
    
    console.log('[handleEquipItem] 슬롯:', slot, '선택된 값:', selectedValues);
    
    if (!selectedValues || selectedValues.length === 0) {
        return await interaction.reply({
            content: '❌ 아이템을 선택해주세요.',
            flags: 64
        });
    }
    
    const itemIndex = parseInt(selectedValues[0]);
    console.log('[handleEquipItem] 아이템 인덱스:', itemIndex);
    
    return await equipItem(interaction, slot, itemIndex);
}

// 장비 해제 핸들러
async function handleUnequip(interaction) {
    // unequip_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[1];
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({
            content: '먼저 회원가입을 해주세요!',
            flags: 64
        });
    }
    
    // 해당 슬롯의 장비 해제
    if (user.equipment && user.equipment[slot] >= 0) {
        user.equipment[slot] = -1;
        // 전투력 재계산
        user.combatPower = calculateCombatPower(user);
        
        await user.save();
        
        await interaction.reply({
            content: `✅ ${EQUIPMENT_SLOTS[slot].name} 장비를 해제했습니다.`,
            flags: 64
        });
    } else {
        await interaction.reply({
            content: `❌ ${EQUIPMENT_SLOTS[slot].name} 슬롯에 장착된 장비가 없습니다.`,
            flags: 64
        });
    }
    
    // 장비 화면 다시 표시
    return await showEquipment(interaction);
}

// 악세서리 슬롯 선택 화면
async function showAccessorySlots(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요!',
            embeds: [],
            components: []
        });
    }

    const accessoryEmbed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💍 악세서리 슬롯 선택')
        .setDescription('장착할 악세서리 슬롯을 선택하세요.');

    // 현재 장착된 악세서리 정보 표시
    let statusText = '';
    for (const [slot, info] of Object.entries(ACCESSORY_SLOTS)) {
        const equippedSlot = user.equipment?.[slot];
        let equippedItem = null;
        
        if (equippedSlot >= 0 && user.inventory) {
            equippedItem = user.inventory.find(item => item.inventorySlot === equippedSlot);
            if (!equippedItem) {
                equippedItem = user.inventory[equippedSlot];
            }
        }
        
        if (equippedItem) {
            statusText += `${info.emoji} **${info.name}**: ${equippedItem.name}\n`;
        } else {
            statusText += `${info.emoji} **${info.name}**: 비어있음\n`;
        }
    }
    
    accessoryEmbed.addFields({
        name: '현재 장착 상태',
        value: statusText || '모든 슬롯이 비어있습니다.',
        inline: false
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('accessory_slot_select')
        .setPlaceholder('악세서리 슬롯을 선택하세요')
        .addOptions(
            Object.entries(ACCESSORY_SLOTS).map(([slot, info]) => ({
                label: info.name,
                value: slot,
                emoji: info.emoji,
                description: `${info.name} 슬롯에 악세서리를 장착합니다`
            }))
        );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('equip_category')
                .setLabel('⚔️ 카테고리로 돌아가기')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('equipment')
                .setLabel('🏠 장비관리로')
                .setStyle(ButtonStyle.Primary)
        );

    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({
                embeds: [accessoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        } else {
            return await interaction.update({
                embeds: [accessoryEmbed],
                components: [
                    new ActionRowBuilder().addComponents(selectMenu),
                    buttons
                ]
            });
        }
    } catch (error) {
        console.error('[showAccessorySlots] 응답 오류:', error);
        if (error.code === 10062) {
            return;
        }
        throw error;
    }
}

// 장비 슬롯 선택 핸들러
async function handleEquipmentSlotSelect(interaction) {
    // equipment_slot_slot 형식
    const parts = interaction.customId.split('_');
    const slot = parts[2];
    
    // 악세서리 카테고리인 경우
    if (slot === 'accessory_category') {
        return await showAccessorySlots(interaction);
    }
    
    // 해당 슬롯의 장착 가능한 아이템 표시
    return await showEquippableItems(interaction, slot);
}

// 악세서리 슬롯 선택 핸들러
async function handleAccessorySlotSelect(interaction) {
    const slot = interaction.values[0];
    // 악세서리 타입의 아이템 표시
    return await showEquippableItems(interaction, slot, 1, true);
}

// 장신구 데이터 마이그레이션 함수
async function migrateAccessories(user) {
    if (!user.equippedAccessories) {
        user.equippedAccessories = {};
    }
    
    // 구 방식에서 신 방식으로 마이그레이션
    for (const [slot, info] of Object.entries(ACCESSORY_SLOTS)) {
        if (user.equipment && user.equipment[slot] >= 0 && !user.equippedAccessories[slot]) {
            const equippedSlot = user.equipment[slot];
            let equippedItem = null;
            
            // inventorySlot으로 먼저 찾기
            equippedItem = user.inventory.find(item => item && item.inventorySlot === equippedSlot);
            
            // 못 찾았으면 배열 인덱스로 찾기
            if (!equippedItem && user.inventory[equippedSlot]) {
                equippedItem = user.inventory[equippedSlot];
            }
            
            // 장신구 타입인지 확인
            if (equippedItem && equippedItem.type === 'accessory') {
                user.equippedAccessories[slot] = {
                    ...equippedItem,
                    inventorySlot: equippedSlot
                };
                // 구 방식 데이터 제거
                delete user.equipment[slot];
            }
        }
    }
    
    return user;
}

module.exports = {
    showEquipment,
    showEquipCategory,
    showEquippableItems,
    optimizeEquipment,
    equipItem,
    unequipAll,
    handleEquipItem,
    handleUnequip,
    handleEquipmentSlotSelect,
    showAccessorySlots,
    handleAccessorySlotSelect,
    migrateAccessories
};