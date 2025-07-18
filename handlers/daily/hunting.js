const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { calculateCombatPower } = require('../common/combatPower');
const { huntingAreas, DROP_ITEMS } = require('../../data/huntingAreas');
const ActivityLog = require('../../models/ActivityLog');
const { MONSTER_EMOJIS } = require('../../data/monsterEmojis');
const { applyHuntingDamageBonus, applyGoldBonus, applyExpBonus, applyDropRateBonus } = require('../common/specialEffects');
const { MONSTER_MUTATIONS, generateMutation, calculateElementalDamage } = require('../../data/monsterMutations');
const { 
    calculateHuntingDamage, 
    calculateDodgeChance, 
    calculateDamageReduction,
    applyWarriorDamageReduction,
    calculateDefenderShield,
    calculateDefenderDamageReduction,
    calculateDefenderCounterAttack,
    calculateThiefDodgeCounter
} = require('../common/damageCalculator');
const buffSystem = require('../common/buffSystem');
const { LOOT_APPRAISAL } = require('../../data/lootAppraisal');
const { HUNTING_TOURNAMENT, calculateWeeklyScore } = require('../../data/huntingTournament');
const { LOOT_MARKET, calculateAppraiserChance, recordMarketEvent, updateMarketPrices } = require('../../data/lootMarket');
const lifeSystem = require('../../systems/lifeSystemIntegration');
const MissionHelper = require('../../utils/missionHelper');
const { restBonusSystem } = require('../../systems/restBonus');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../../utils/levelCapHelper');
// const { showCraftingMenu } = require('../../systems/materialCraftingSystem');
// const { updateMissionProgress } = require('../../systems/huntingPassSystem');

const GAME_GIFS = require('../../data/gameGifs');

// 사냥 GIF/이미지 목록
const HUNTING_GIFS = {
    tracking: [
        'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyC/giphy.gif',
        'https://media.giphy.com/media/l0HlBO7eyYKUbbcGI/giphy.gif'
    ],
    combat: [
        'https://media.giphy.com/media/xUPGcz2H1TXdCz4suY/giphy.gif',
        'https://media.giphy.com/media/l0HlFZ3c4NENSMQsU/giphy.gif'
    ],
    victory: [
        'https://media.giphy.com/media/l3q2Z9667uYOVOod2/giphy.gif',
        'https://media.giphy.com/media/xT5LMESsx1kUe3Hiyk/giphy.gif'
    ],
    defeat: [
        'https://media.giphy.com/media/d2W7eZX5z62ziqdi/giphy.gif',
        'https://media.giphy.com/media/xT5LMFnKnhOcLTpEek/giphy.gif'
    ],
    rare: [
        'https://media.giphy.com/media/5VKbfrlwiM9cY/giphy.gif',
        'https://media.giphy.com/media/xT5LMunCnfMUdJiAKs/giphy.gif'
    ],
    boss: [
        'https://media.giphy.com/media/VdWnBa3I6sZmY/giphy.gif',
        'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnG/giphy.gif'
    ]
};

// 연속 사냥 보너스 계산 (강화된 보너스)
function getStreakBonus(streak) {
    if (streak >= 100) return { expBonus: 3.0, goldBonus: 3.0, dropBonus: 1.0 };
    if (streak >= 50) return { expBonus: 2.5, goldBonus: 2.5, dropBonus: 0.8 };
    if (streak >= 30) return { expBonus: 2.0, goldBonus: 2.0, dropBonus: 0.6 };
    if (streak >= 20) return { expBonus: 1.7, goldBonus: 1.7, dropBonus: 0.4 };
    if (streak >= 10) return { expBonus: 1.5, goldBonus: 1.5, dropBonus: 0.3 };
    if (streak >= 5) return { expBonus: 1.3, goldBonus: 1.3, dropBonus: 0.2 };
    if (streak >= 3) return { expBonus: 1.1, goldBonus: 1.1, dropBonus: 0.1 };
    return { expBonus: 1.0, goldBonus: 1.0, dropBonus: 0 };
}

// 다음 티켓 재생성 시간 계산
function getNextTicketRegenTime(user) {
    // 티켓이 이미 최대치인 경우
    if (!user.lastHuntingTicketRegen || user.huntingTickets >= 20) return null;
    
    // 티켓이 0 이상 20 미만인 경우에만 재생성 시간 계산
    if (user.huntingTickets >= 0 && user.huntingTickets < 20) {
        const lastRegen = new Date(user.lastHuntingTicketRegen).getTime();
        const timeSinceLastRegen = Date.now() - lastRegen;
        const timeUntilNextRegen = 1800000 - (timeSinceLastRegen % 1800000); // 30분
        
        const minutes = Math.floor(timeUntilNextRegen / 60000);
        const seconds = Math.floor((timeUntilNextRegen % 60000) / 1000);
        
        return `${minutes}분 ${seconds}초`;
    }
    
    return null;
}

// 사냥터 메인 메뉴
async function showHuntingMenu(interaction, page = 0) {
    let user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }

    // 티켓 재생성 (TicketManager 사용)
    const TicketManager = require('../../utils/ticketManager');
    const ticketInfo = await TicketManager.getTicketInfo(user.discordId);
    user.huntingTickets = ticketInfo.hunting;
    
    // 레벨에 맞는 사냥터 자동 해금
    const unlockedBefore = user.unlockedAreas.length;
    huntingAreas.forEach(area => {
        if (user.level >= area.unlockLevel && !user.unlockedAreas.includes(area.id)) {
            user.unlockedAreas.push(area.id);
        }
    });
    
    // 새로 해금된 지역이 있으면 저장
    if (user.unlockedAreas.length > unlockedBefore) {
        await user.save();
    }
    
    const itemsPerPage = 3;
    const availableAreas = huntingAreas.filter(area => user.unlockedAreas.includes(area.id));
    const totalPages = Math.ceil(availableAreas.length / itemsPerPage);
    
    if (availableAreas.length === 0) {
        return await interaction.reply({ 
            content: '❌ 사용 가능한 사냥터가 없습니다!', 
            flags: 64 
        });
    }
    
    const userPower = calculateCombatPower(user);
    const streakBonus = getStreakBonus(user.huntingStreak || 0);
    
    const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setAuthor({ 
            name: `${user.nickname}의 사냥`, 
            iconURL: interaction.user.displayAvatarURL() 
        })
        .setTitle('⚔️ 사냥터 선택')
        .setThumbnail(HUNTING_GIFS.tracking[0])
        .setDescription(`## 🏞️ 사냥 지역 선택\n> 🎫 **사냥권**: \`${user.huntingTickets || 0}/20\`${getNextTicketRegenTime(user) ? ` | 다음 재생성: ${getNextTicketRegenTime(user)}` : ''}\n> ⚔️ **내 전투력**: \`${userPower}\`\n> 🔥 **연속 사냥**: \`${user.huntingStreak || 0}\` ${user.huntingStreak >= 3 ? `(보너스 ${Math.floor((streakBonus.expBonus - 1) * 100)}% 적용중!)` : ''}\n> 💡 30분마다 1장씩 자동 재생성됩니다`)
        .addFields(
            { name: '📊 사냥 정보', value: '```yaml\n전투력이 높을수록 승률 상승\n레벨이 높은 지역일수록 보상 증가\n각 지역마다 고유 드롭 아이템 존재\n연속 사냥 시 보너스 증가!\n```', inline: false },
            { name: '🏆 사냥 통계', value: `> 총 사냥 횟수: \`${user.totalHunts || 0}\`\n> 보스 처치: \`${user.bossKills || 0}\``, inline: false }
        )
        .setFooter({ 
            text: `🎮 원하는 사냥터를 선택하세요 | 페이지 ${page + 1}/${totalPages}` 
        })
        .setTimestamp();
    
    const huntingButtons = new ActionRowBuilder();
    const startIndex = page * itemsPerPage;
    const currentAreas = availableAreas.slice(startIndex, startIndex + itemsPerPage);
    
    // 지역별 필드 추가
    currentAreas.forEach(area => {
        const areaEmoji = ['🌸', '🌈', '🌲', '💎'][area.id - 1] || '🗺️';
        embed.addFields({
            name: `${areaEmoji} ${area.name} (${area.levelRange})`,
            value: `> 드롭률: ${Math.floor(area.dropRate * 100)}%\n> 몬스터: ${area.monsters.length}종`,
            inline: true
        });
        
        huntingButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(`hunt_area_${area.id}`)
                .setLabel(area.name)
                .setStyle(ButtonStyle.Primary)
                .setEmoji(areaEmoji)
        );
    });
    
    const navButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`hunting_prev_${page}`)
                .setLabel('◀️ 이전')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`hunting_next_${page}`)
                .setLabel('다음 ▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1),
            new ButtonBuilder()
                .setCustomId('appraisal_menu')
                .setLabel('🔍 감정소')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!user.lootAppraisal || user.lootAppraisal.unidentifiedItems.length === 0),
            new ButtonBuilder()
                .setCustomId('tournament_menu')
                .setLabel('🏆 토너먼트')
                .setStyle(ButtonStyle.Success)
                .setDisabled(false), // 테스트를 위해 임시로 항상 활성화
            // new ButtonBuilder()
            //     .setCustomId('material_crafting')
            //     .setLabel('🔨 재료 제작')
            //     .setStyle(ButtonStyle.Success),
            // new ButtonBuilder()
            //     .setCustomId('hunting_pass')
            //     .setLabel('🎫 사냥 패스')
            //     .setStyle(ButtonStyle.Primary)
        );
    
    const mainButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 이미 응답되었는지 확인
    if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
            embeds: [embed],
            components: [huntingButtons, navButtons, mainButton]
        });
    } else {
        return await interaction.reply({
            embeds: [embed],
            components: [huntingButtons, navButtons, mainButton],
            flags: 64
        });
    }
}

// 사냥 실행
async function executeHunt(interaction, areaId) {
    // 먼저 defer 처리 (에러 무시)
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: 64 });
        }
    } catch (error) {
        console.log('[Hunt] Defer failed:', error.message);
        // 이미 만료된 상호작용인 경우 종료
        if (error.code === 10062) {
            return;
        }
    }
    
    let user = await getUser(interaction.user.id);
    // areaId를 숫자로 변환
    const numericAreaId = parseInt(areaId);
    const area = huntingAreas.find(a => a.id === numericAreaId);
    
    if (!area) {
        return await interaction.editReply({ 
            content: '❌ 잘못된 사냥터입니다!' 
        });
    }
    
    if (!user.unlockedAreas.includes(numericAreaId)) {
        return await interaction.editReply({ 
            content: '❌ 이 지역은 아직 잠겨있습니다!' 
        });
    }
    
    
    // 나중에 전투 성공 시 처리하도록 이동
    // user.totalHunts = (user.totalHunts || 0) + 1;
    
    // 전투력 계산 (UI 표시용)
    const userPower = calculateCombatPower(user);
    
    // 희귀 몬스터 또는 보스 출현 확률 (연속 사냥 보너스 적용)
    const rareChance = 0.05 + (user.huntingStreak * 0.002); // 기본 5% + 연속당 0.2%
    const bossChance = 0.02 + (user.huntingStreak * 0.001); // 기본 2% + 연속당 0.1%
    
    let monster;
    let isBoss = false;
    let isRare = false;
    
    if (Math.random() < bossChance && area.id >= 2) { // 2지역부터 보스 출현
        // 보스 몬스터 생성
        const bossMonsters = area.monsters.filter(m => m.rarity === '에픽' || m.rarity === '레전드리');
        monster = bossMonsters.length > 0 ? bossMonsters[Math.floor(Math.random() * bossMonsters.length)] : area.monsters[area.monsters.length - 1];
        isBoss = true;
    } else if (Math.random() < rareChance) {
        // 희귀 몬스터 우선 선택
        const rareMonsters = area.monsters.filter(m => m.rarity !== '일반');
        monster = rareMonsters.length > 0 ? rareMonsters[Math.floor(Math.random() * rareMonsters.length)] : area.monsters[Math.floor(Math.random() * area.monsters.length)];
        isRare = true;
    } else {
        // 일반 몬스터
        monster = area.monsters[Math.floor(Math.random() * area.monsters.length)];
    }
    
    // 변이 몬스터 생성
    const mutation = generateMutation(area, user.huntingStreak || 0);
    if (mutation) {
        monster = { ...monster }; // 원본 몬스터 복사
        monster.mutation = mutation;
        monster.name = `${mutation.emoji} ${mutation.name} ${monster.name}`;
    }
    
    // 몬스터 power 계산 (UI 표시용)
    let monsterPower = calculateMonsterPower(monster);
    if (isBoss) monsterPower *= 1.5;
    if (mutation) monsterPower *= mutation.effects.powerMultiplier;
    
    // 몬스터 스탯 생성
    const monsterStats = {
        attack: monster.stats?.atk || 10,
        defense: monster.stats?.def || 10,
        health: (monster.stats?.atk || 10) * 10,
        stats: {
            agility: monster.stats?.dodge || 10,
            luck: monster.stats?.luck || 10
        }
    };
    
    // 실제 전투 계산 (데미지 기반)
    const userDamageResult = calculateHuntingDamage(user, monsterStats);
    const monsterDodgeChance = calculateDodgeChance(monsterStats.stats.agility || 10);
    
    // 몬스터의 공격도 회피 가능
    const userDodgeChance = calculateDodgeChance(user.stats?.agility || 10);
    const isDodged = Math.random() < userDodgeChance;
    
    // 실제 전투 시뮬레이션
    // 유저 체력 계산 개선 (기본체력 + 체력스탯보너스 + 레벨보너스)
    let userHealth = 1000 + (user.stats?.vitality || 10) * 50 + user.level * 100;
    let monsterHealth = monsterStats.health;
    
    // 보스/변이 체력 보정
    if (isBoss) monsterHealth *= 2;
    if (mutation) monsterHealth *= mutation.effects.powerMultiplier;
    
    // 전투 버프 초기화
    const userBuffs = [];
    const monsterBuffs = [];
    
    // 변이 몬스터 특수 효과
    if (mutation && mutation.type === 'venomous') {
        // 독성 변이 - 시작부터 독 효과
        const poisonBuff = buffSystem.applyBuff(
            { activeBuffs: userBuffs },
            'POISON',
            Math.floor(monsterStats.attack * 0.1),
            5
        );
        userBuffs.push(poisonBuff);
    }
    
    // 전투 턴 계산 (최대 20턴으로 증가)
    let turns = 0;
    let isWin = false;
    let isCritical = userDamageResult.isCritical;
    let battleEffects = [];
    
    while (turns < 20 && userHealth > 0 && monsterHealth > 0) {
        // 유저 공격
        const damageResult = calculateHuntingDamage(user, monsterStats);
        let actualDamage = 0;
        
        if (Math.random() > monsterDodgeChance) {
            actualDamage = damageResult.damage;
            
            // 궁수 2연타 확인
            if (damageResult.hasDoubleHit) {
                actualDamage = damageResult.totalDamage;
                battleEffects.push('🏹 2연타 공격!');
            }
            
            // 도적 그림자 공격 확인
            if (damageResult.hasExtraAttack) {
                actualDamage = damageResult.totalDamage;
                battleEffects.push('🗡️ 그림자 공격!');
            }
            
            monsterHealth -= actualDamage;
            if (damageResult.isCritical) isCritical = true;
            
            // 특수 무기 효과 (랜덤 버프)
            if (user.equipment?.weapon && Math.random() < 0.1) {
                const attackBuff = buffSystem.applyBuff(
                    { activeBuffs: userBuffs },
                    'ATTACK_UP',
                    20,
                    3
                );
                userBuffs.push(attackBuff);
                battleEffects.push('⚔️ 무기 효과 발동!');
            }
        } else {
            // 도적 회피 반격 체크
            const dodgeCounter = calculateThiefDodgeCounter(monsterStats, user);
            if (dodgeCounter.hasCounter) {
                monsterHealth -= dodgeCounter.counterDamage;
                battleEffects.push(`🗡️ 회피 반격! ${dodgeCounter.counterDamage} 데미지`);
            }
        }
        
        // 몬스터 공격
        if (monsterHealth > 0 && !isDodged) {
            // 몬스터 데미지 계산 조정 (너무 높았음)
            let monsterDamage = Math.floor((monsterStats.attack) * (0.5 + Math.random() * 0.3));
            
            // 수호자 보호막 및 기본 방어 적용
            const shieldReduction = calculateDefenderShield(user);
            const baseReduction = calculateDefenderDamageReduction(user);
            const defenseReduction = calculateDamageReduction(user.defense || 10);
            const totalReduction = shieldReduction + baseReduction + defenseReduction;
            
            if (shieldReduction > 0) {
                battleEffects.push('🛡️ 보호막 발동!');
            }
            
            monsterDamage = Math.floor(monsterDamage * (1 - totalReduction));
            
            // 전사 불굴의 의지 체크
            const warriorReduction = applyWarriorDamageReduction(monsterDamage, user);
            if (warriorReduction.reduced) {
                monsterDamage = warriorReduction.damage;
                battleEffects.push(`⚔️ 불굴의 의지! -${warriorReduction.reductionAmount}`);
            }
            
            userHealth -= monsterDamage;
            
            // 수호자 반격 체크
            const counterAttack = calculateDefenderCounterAttack(monsterDamage, user);
            if (counterAttack.hasCounter) {
                monsterHealth -= counterAttack.counterDamage;
                battleEffects.push(`🛡️ 반격! ${counterAttack.counterDamage} 데미지`);
            }
            
            // 보스 특수 공격
            if (isBoss && Math.random() < 0.2) {
                const debuff = buffSystem.applyDebuff(
                    { activeBuffs: userBuffs, stats: user.stats },
                    'DEFENSE_DOWN',
                    15,
                    2
                );
                if (!debuff.resisted) {
                    userBuffs.push(debuff);
                    battleEffects.push('🔻 방어력 감소!');
                }
            }
        }
        
        // 턴 종료 버프 처리
        const userBuffResult = buffSystem.processBuffsEndTurn({ activeBuffs: userBuffs });
        userBuffResult.ongoingEffects?.forEach(effect => {
            if (effect.type === 'damage') {
                userHealth -= effect.value;
                battleEffects.push(`☠️ 독 피해 -${effect.value}`);
            }
        });
        
        turns++;
    }
    
    isWin = monsterHealth <= 0 && userHealth > 0;
    
    // 승률 계산 (UI 표시용)
    const expectedUserDamage = userDamageResult.damage;
    const expectedMonsterDamage = Math.floor((monsterStats.attack + 10) * 0.7);
    const userTurnsToKill = Math.ceil(monsterHealth / expectedUserDamage);
    const monsterTurnsToKill = Math.ceil(userHealth / expectedMonsterDamage);
    const winChance = Math.min(0.95, Math.max(0.05, monsterTurnsToKill / (userTurnsToKill + monsterTurnsToKill)));
    
    // 티켓 차감 (TicketManager 사용)
    const TicketManager = require('../../utils/ticketManager');
    const ticketResult = await TicketManager.useTicket(user.discordId, 'hunting');
    if (!ticketResult.success) {
        return await interaction.editReply({ 
            content: `❌ ${ticketResult.error}\n🎫 티켓은 30분마다 1장씩 충전됩니다.` 
        });
    }
    
    // 중요: ticketResult.user로 교체하지 않고 기존 user 객체의 티켓 정보만 업데이트
    user.huntingTickets = ticketResult.user.huntingTickets;
    user.lastHuntingTicketRegen = ticketResult.user.lastHuntingTicketRegen;
    
    // 추가 보상 확률 체크
    const treasureChance = 0.1 + (user.huntingStreak * 0.01); // 기본 10% + 연속당 1%
    const doubleDropChance = 0.05 + (user.huntingStreak * 0.005); // 기본 5% + 연속당 0.5%
    let foundTreasure = isWin && Math.random() < treasureChance;
    let doubleDrop = isWin && Math.random() < doubleDropChance;
    
    // 전투 메시지 준비
    const trackingMessages = [
        '발자국을 따라가고 있습니다...',
        '냄새를 추적하고 있습니다...',
        '흔적을 발견했습니다!',
        '몬스터가 가까이 있습니다...',
        '사냥감의 기척이 느껴집니다...'
    ];
    
    const combatMessages = {
        normal: [
            '격렬한 전투가 시작됩니다!',
            '칼날이 부딪치는 소리가 울려퍼집니다!',
            '치열한 공방이 이어집니다!',
            '전투의 열기가 고조됩니다!'
        ],
        critical: [
            '💥 급소를 정확히 노렸습니다!',
            '💥 완벽한 타이밍의 일격!',
            '💥 빈틈을 놓치지 않았습니다!',
            '💥 회심의 일격이 터졌습니다!'
        ],
        dodge: [
            '💨 순간적으로 몸을 피했습니다!',
            '💨 간발의 차로 회피했습니다!',
            '💨 완벽한 반사신경!',
            '💨 몬스터의 공격이 허공을 갈랐습니다!'
        ]
    };
    
    // 1단계: 추적 시작 (즉시 표시)
    const trackingEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔍 몬스터 추적 중...')
        .setDescription(`${area.name}에서 ${trackingMessages[Math.floor(Math.random() * trackingMessages.length)]}`)
        .setThumbnail(HUNTING_GIFS.tracking[Math.floor(Math.random() * HUNTING_GIFS.tracking.length)])
        .setFooter({ text: '사냥 진행 중... (1/3)' });
    
    await interaction.editReply({
        embeds: [trackingEmbed]
    });
    
    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2단계: 전투 중 (수정)
    let combatDescription = '';
    if (isCritical) {
        combatDescription = combatMessages.critical[Math.floor(Math.random() * combatMessages.critical.length)];
    } else if (isDodged) {
        combatDescription = combatMessages.dodge[Math.floor(Math.random() * combatMessages.dodge.length)];
    } else {
        combatDescription = combatMessages.normal[Math.floor(Math.random() * combatMessages.normal.length)];
    }
    
    const combatEmbed = new EmbedBuilder()
        .setColor(mutation ? mutation.color : (isBoss ? '#ff0000' : isRare ? '#f39c12' : '#e74c3c'))
        .setTitle(`${mutation ? `${mutation.emoji} 변이 몬스터!` : (isBoss ? '⚠️ 보스와의 결투!' : isRare ? '✨ 희귀 몬스터와 전투!' : '⚔️ 전투 발생!')}`)
        .setDescription(`**${MONSTER_EMOJIS[monster.name] || '👾'} ${monster.name}** ${isBoss ? '(BOSS)' : ''}\n${mutation ? `_${mutation.description}_\n` : ''}\n${combatDescription}`)
        .addFields(
            { name: '내 전투력', value: isCritical ? `\`${userPower}\` 💥\n(크리티컬 히트!)` : isDodged ? `\`${userPower}\` 💨\n(회피 성공!)` : `\`${userPower}\``, inline: true },
            { name: 'VS', value: '⚔️', inline: true },
            { name: '몬스터 전투력', value: `\`${monsterPower}\``, inline: true }
        )
        .setImage(HUNTING_GIFS.combat[Math.floor(Math.random() * HUNTING_GIFS.combat.length)])
        .setFooter({ text: `승률: ${Math.floor(winChance * 100)}% | 사냥 진행 중... (2/3)` });
    
    await interaction.editReply({
        embeds: [combatEmbed]
    });
    
    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3단계: 결과
    let embed;
    let levelUpInfo = null; // 레벨업 정보를 저장할 변수
    let goldGain = 0;
    let expGain = 0;
    let dropItems = [];
    let leveledUp = false;
    
    if (isWin) {
        // 승리 처리
        // 연속 사냥 체크 (120분 이내에 다시 사냥하면 연속) - 승리 시에만 카운트
        const now = new Date();
        if (user.lastHuntingTime && (now - user.lastHuntingTime) < 7200000) {
            user.huntingStreak = (user.huntingStreak || 0) + 1;
        } else {
            user.huntingStreak = 1;
        }
        user.lastHuntingTime = now;
        user.totalHunts = (user.totalHunts || 0) + 1;
        
        // 연속 사냥 미션 체크
        // if (user.huntingStreak >= 50) {
        //     await updateMissionProgress(user, 'streak', user.huntingStreak);
        // }
        
        // 연속 사냥 정보 즉시 저장 (VersionError 대비 retry 로직)
        let saveAttempts = 0;
        const maxAttempts = 3;
        while (saveAttempts < maxAttempts) {
            try {
                await user.save();
                break;
            } catch (error) {
                if (error.name === 'VersionError' && saveAttempts < maxAttempts - 1) {
                    saveAttempts++;
                    console.log(`[Hunting] VersionError on save attempt ${saveAttempts}, retrying...`);
                    // 사용자 데이터 다시 조회
                    const freshUser = await User.findById(user._id);
                    if (freshUser) {
                        // 필요한 필드만 업데이트
                        freshUser.huntingTickets = user.huntingTickets;
                        freshUser.huntingStreak = user.huntingStreak;
                        freshUser.lastHuntingTime = user.lastHuntingTime;
                        freshUser.totalHunts = user.totalHunts;
                        user = freshUser;
                    }
                } else {
                    throw error;
                }
            }
        }
        
        // 몬스터의 exp와 gold는 배열 형태 [최소값, 최대값]
        const expMin = monster.exp[0];
        const expMax = monster.exp[1];
        const goldMin = monster.gold[0];
        const goldMax = monster.gold[1];
        
        // 랜덤값 선택
        expGain = Math.floor(expMin + Math.random() * (expMax - expMin));
        goldGain = Math.floor(goldMin + Math.random() * (goldMax - goldMin));
        
        // 보스/희귀 몬스터 보너스
        if (isBoss) {
            expGain *= 3;
            goldGain *= 3;
            user.bossKills = (user.bossKills || 0) + 1;
            // 사냥 패스 미션 업데이트
            // await updateMissionProgress(user, 'boss', 1);
        } else if (isRare) {
            expGain *= 1.5;
            goldGain *= 1.5;
            // 사냥 패스 미션 업데이트
            // await updateMissionProgress(user, 'rare', 1);
        }
        
        // 일반 사냥 미션 업데이트
        // await updateMissionProgress(user, 'hunt', 1);
        
        // 변이 보너스 적용
        if (mutation) {
            expGain = Math.floor(expGain * mutation.effects.expMultiplier);
            goldGain = Math.floor(goldGain * mutation.effects.goldMultiplier);
        }
        
        // 연속 사냥 보너스 적용
        const streakBonus = getStreakBonus(user.huntingStreak);
        expGain = Math.floor(expGain * streakBonus.expBonus);
        goldGain = Math.floor(goldGain * streakBonus.goldBonus);
        
        // 특수 효과 적용
        console.log(`[Hunting] ${user.nickname || user.discordId} - 특수 효과 적용 전 골드: ${goldGain}, 경험치: ${expGain}`);
        goldGain = applyGoldBonus(goldGain, user);
        expGain = applyExpBonus(expGain, user);
        console.log(`[Hunting] ${user.nickname || user.discordId} - 특수 효과 적용 후 골드: ${goldGain}, 경험치: ${expGain}`);
        
        // 휴식 보상 적용
        expGain = restBonusSystem.applyExpWithRestBonus(expGain, user.discordId);
        goldGain = restBonusSystem.applyGoldWithRestBonus(goldGain, user.discordId);
        
        // 보물상자 발견 시 추가 골드
        let treasureGold = 0;
        if (foundTreasure) {
            treasureGold = Math.floor(goldGain * (0.5 + Math.random() * 0.5)); // 50~100% 추가
            goldGain += treasureGold;
        }
        
        // 만렙 체크 후 경험치 추가
        let actualExpGained = 0;
        if (canGainExperience(user)) {
            actualExpGained = addExperienceSafely(user, expGain);
        } else {
            expGain = 0; // 만렙인 경우 경험치 획득량 0으로 표시
        }
        user.gold += goldGain;
        
        console.log(`[사냥] ${user.discordId} - 경험치: ${user.exp} (+${expGain}), 골드: ${user.gold} (+${goldGain})`);
        
        // 유저 활동 업데이트 (휴식 보상 시스템)
        await restBonusSystem.updateUserActivity(user.discordId);
        
        // 레벨업 체크 (checkAndProcessLevelUp 사용)
        const { checkAndProcessLevelUp } = require('../common/levelUp');
        const levelUpResult = await checkAndProcessLevelUp(user);
        leveledUp = levelUpResult.leveledUp;
        
        if (leveledUp) {
            
            // 라이프 시스템 뉴스 연동 - 레벨 신기록
            if (user.level % 50 === 0 || user.level >= 100) {
                lifeSystem.reportLevelRecord(user, user.level);
            }
            
            // 새로운 지역 해금
            const nextArea = huntingAreas.find(a => a.unlockLevel === user.level);
            if (nextArea && !user.unlockedAreas.includes(nextArea.id)) {
                user.unlockedAreas.push(nextArea.id);
                
                // 레벨업 및 지역 해금 정보 저장
                levelUpInfo = {
                    level: user.level,
                    newArea: nextArea.name
                };
            } else {
                // 지역 해금이 없어도 레벨업 정보 저장
                levelUpInfo = {
                    level: user.level,
                    newArea: null
                };
            }
        }
        
        // 드롭 아이템 확인 (연속 사냥 보너스 적용)
        dropItems = [];
        let dropChance = area.dropRate + streakBonus.dropBonus;
        
        // 칭호 효과 적용 (드롭률 보너스)
        dropChance = applyDropRateBonus(dropChance, user);
        
        // 보스는 100% 드롭, 희귀는 2배 확률
        const finalDropChance = isBoss ? 1.0 : (isRare ? dropChance * 2 : dropChance);
        
        if (Math.random() < finalDropChance) {
            const dropPool = DROP_ITEMS[area.dropTable];
            if (dropPool && dropPool.length > 0) {
                // 드롭 개수 결정 (보스는 2-3개, 희귀는 1-2개, 일반은 1개)
                let dropCount = 1;
                if (isBoss) {
                    dropCount = Math.random() < 0.5 ? 3 : 2;
                } else if (isRare) {
                    dropCount = Math.random() < 0.3 ? 2 : 1;
                }
                
                // 여러 개의 아이템 드롭
                for (let i = 0; i < dropCount; i++) {
                    const dropItem = dropPool[Math.floor(Math.random() * dropPool.length)];
                    let dropQuantity = 1;
                    
                    // 더블 드롭 이벤트
                    if (doubleDrop) {
                        dropQuantity = 2;
                    }
                    
                    // 보스는 추가 수량 가능
                    if (isBoss && Math.random() < 0.3) {
                        dropQuantity++;
                    }
                
                // 라이프 시스템 뉴스 연동 - 보스 처치
                if (isBoss) {
                    const isFirst = !user.bossKills || user.bossKills === 0;
                    lifeSystem.reportBossKill(user, monster, isFirst, true);
                }
                
                    dropItems.push({ item: dropItem, quantity: dropQuantity });
                    
                    // 라이프 시스템 뉴스 연동 - 희귀 아이템 획득
                    if (dropItem.rarity === '레전드리' || (dropItem.rarity === '에픽' && dropQuantity >= 5)) {
                        lifeSystem.reportRareDrop(user, dropItem, area.name, dropQuantity);
                    }
                    
                    // 인벤토리에 재료 추가
                    console.log(`[사냥 드롭 시도] ${user.nickname}: ${dropItem.name} (ID: ${dropItem.id})`);
                    const existingItem = user.inventory.find(item => 
                        item.id === dropItem.id && item.type === 'material'
                    );
                    
                    if (existingItem) {
                        // 이미 있는 아이템이면 수량 증가
                        const oldQuantity = existingItem.quantity || 1;
                        existingItem.quantity = oldQuantity + dropQuantity;
                        console.log(`[사냥 드롭] ${user.nickname}: ${dropItem.name} 수량 증가 ${oldQuantity} → ${existingItem.quantity}`);
                    } else {
                        // 새 아이템 추가
                        const newSlot = user.inventory.length > 0 ? 
                            Math.max(...user.inventory.map(i => i.inventorySlot || 0)) + 1 : 0;
                        
                        user.inventory.push({
                            id: dropItem.id,
                            name: dropItem.name,
                            type: 'material',
                            rarity: dropItem.rarity,
                            setName: '재료',
                            level: 1,
                            quantity: dropQuantity,
                            enhanceLevel: 0,
                            stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
                            price: dropItem.value || 100,
                            description: `${area.name}에서 획득한 재료`,
                            equipped: false,
                            inventorySlot: newSlot
                        });
                        console.log(`[사냥 드롭] ${user.nickname}: ${dropItem.name} 새로 추가 (수량: ${dropQuantity})`);
                    }
                }
            }
        }
        
        // 변이 몬스터 특수 드롭
        if (mutation && Math.random() < mutation.specialDrop.chance) {
            const mutationDrop = mutation.specialDrop;
            dropItems.push({ 
                item: mutationDrop, 
                quantity: 1,
                isMutationDrop: true 
            });
            
            // 변이 특수 드롭도 뉴스로 보고
            lifeSystem.reportRareDrop(user, mutationDrop, area.name, 1);
            
            // 인벤토리에 변이 드롭 추가
            const existingMutationItem = user.inventory.find(item => 
                item.id === mutationDrop.id && item.type === 'material'
            );
            
            if (existingMutationItem) {
                // 이미 있는 아이템이면 수량 증가
                existingMutationItem.quantity = (existingMutationItem.quantity || 1) + 1;
            } else {
                // 새 아이템 추가
                const newSlot = user.inventory.length > 0 ? 
                    Math.max(...user.inventory.map(i => i.inventorySlot || 0)) + 1 : 0;
                
                user.inventory.push({
                    id: mutationDrop.id,
                    name: mutationDrop.name,
                    type: 'material',
                    rarity: mutationDrop.rarity || '희귀',
                    setName: '재료',
                    level: 1,
                    quantity: 1,
                    enhanceLevel: 0,
                    stats: { attack: 0, defense: 0, dodge: 0, luck: 0 },
                    price: mutationDrop.value || 500,
                    description: `${area.name}에서 획득한 변이 재료`,
                    equipped: false,
                    inventorySlot: newSlot,
                    fromMutation: true
                });
            }
        }
        
        // 엠블럼 기적의 주문서 드롭 체크 (0.035% 확률)
        if (Math.random() < 0.00035) { // 0.035%
            if (!user.items) user.items = {};
            user.items.emblemMiracleScroll = (user.items.emblemMiracleScroll || 0) + 1;
            
            // 드롭 아이템 목록에 추가
            dropItems.push({
                item: {
                    id: 'emblemMiracleScroll',
                    name: '엠블럼 기적의 주문서',
                    emoji: '🌟',
                    rarity: '신화',
                    value: 10000000
                },
                quantity: 1,
                isSpecialDrop: true
            });
            
            // 라이프 시스템 뉴스 연동
            lifeSystem.reportRareDrop(user, {
                name: '엠블럼 기적의 주문서',
                rarity: '신화'
            }, area.name, 1);
        }
        
        // 미확인 아이템 드롭 (변이 몬스터와 보스는 확률 증가)
        let unidentifiedChance = 0.1; // 기본 10%
        if (mutation) unidentifiedChance += mutation.effects.dropRateBonus;
        if (isBoss) unidentifiedChance += 0.2;
        if (isRare) unidentifiedChance += 0.1;
        
        if (Math.random() < unidentifiedChance) {
            // 등급 결정
            let grade = 'common';
            const gradeRoll = Math.random();
            if (gradeRoll < 0.05) grade = 'divine';
            else if (gradeRoll < 0.15) grade = 'ancient';
            else if (gradeRoll < 0.40) grade = 'mysterious';
            
            // 미확인 아이템 추가
            if (!user.lootAppraisal) {
                user.lootAppraisal = {
                    unidentifiedItems: [],
                    totalAppraised: 0,
                    jackpotCount: 0,
                    trashCount: 0,
                    goldSpentOnAppraisal: 0
                };
            }
            
            const beforeCount = user.lootAppraisal.unidentifiedItems.length;
            user.lootAppraisal.unidentifiedItems.push({
                grade,
                foundAt: new Date(),
                fromMonster: monster.name,
                fromArea: area.id
            });
            const afterCount = user.lootAppraisal.unidentifiedItems.length;
            console.log(`[미확인물품] ${user.nickname || user.discordId}: ${beforeCount} -> ${afterCount} (${grade})`);
            
            // Mongoose 변경 감지를 위한 markModified
            user.markModified('lootAppraisal.unidentifiedItems');
        }
        
        const victoryMessages = {
            normal: [
                '깔끔한 사냥이었습니다!',
                '전투의 승리자가 되었습니다!',
                '사냥에 성공했습니다!',
                '몬스터를 물리쳤습니다!'
            ],
            critical: [
                '💥 크리티컬 히트로 단번에 처치했습니다!',
                '💥 압도적인 실력을 보여주었습니다!',
                '💥 완벽한 일격이었습니다!'
            ],
            dodge: [
                '💨 단 한 번도 맞지 않고 승리했습니다!',
                '💨 무적의 회피술을 보여주었습니다!',
                '💨 그림자처럼 움직였습니다!'
            ],
            boss: [
                '🏆 전설적인 보스 사냥꾼이 되었습니다!',
                '🏆 보스를 무릎 꿇렸습니다!',
                '🏆 역사에 남을 전투였습니다!'
            ],
            rare: [
                '✨ 희귀한 전리품의 주인이 되었습니다!',
                '✨ 특별한 사냥이었습니다!',
                '✨ 행운이 함께했습니다!'
            ]
        };
        
        // 승리 메시지 선택
        let selectedMessage;
        if (isBoss) {
            selectedMessage = victoryMessages.boss[Math.floor(Math.random() * victoryMessages.boss.length)];
        } else if (isRare) {
            selectedMessage = victoryMessages.rare[Math.floor(Math.random() * victoryMessages.rare.length)];
        } else if (isCritical) {
            selectedMessage = victoryMessages.critical[Math.floor(Math.random() * victoryMessages.critical.length)];
        } else if (isDodged) {
            selectedMessage = victoryMessages.dodge[Math.floor(Math.random() * victoryMessages.dodge.length)];
        } else {
            selectedMessage = victoryMessages.normal[Math.floor(Math.random() * victoryMessages.normal.length)];
        }
        
        // 전투 통계 계산
        const damageDealt = Math.floor(monsterPower * (isWin ? 1.2 : 0.8));
        const damageTaken = isDodged ? 0 : Math.floor(monsterPower * 0.3);
        
        embed = new EmbedBuilder()
            .setColor(isBoss ? '#ff00ff' : isRare ? '#ffd700' : '#00ff00')
            .setTitle(`⚔️ 사냥 성공! ${isBoss ? '🏆 보스 처치!' : isRare ? '✨ 희귀 몬스터!' : ''}`)
            .setDescription(`**${MONSTER_EMOJIS[monster.name] || '👾'} ${monster.name}** ${isBoss ? '(BOSS)' : ''}을(를) 처치했습니다!\n\n_${selectedMessage}_`)
            .setImage(isBoss ? HUNTING_GIFS.boss[0] : isRare ? HUNTING_GIFS.rare[0] : HUNTING_GIFS.victory[Math.floor(Math.random() * HUNTING_GIFS.victory.length)])
            .addFields(
                { 
                    name: '📊 전투 통계', 
                    value: `\`\`\`yaml\n준 데미지: ${damageDealt}${isCritical ? ' (크리티컬!)' : ''}\n받은 데미지: ${damageTaken}${isDodged ? ' (완벽회피!)' : ''}\n내 전투력: ${userPower}\n몬스터 전투력: ${monsterPower}\n최종 승률: ${Math.floor(winChance * 100)}%\n\`\`\``, 
                    inline: false 
                }
            );
        
        // 버프 효과가 있었다면 표시
        if (battleEffects.length > 0) {
            embed.addFields({
                name: '🌟 전투 효과',
                value: battleEffects.slice(0, 5).join('\n'), // 최대 5개만 표시
                inline: false
            });
        }
        
        // 보상 정보를 더 화려하게 표시
        let rewardText = '';
        rewardText += `💰 **골드**: +${formatNumber(goldGain - (treasureGold || 0))}G`;
        if (streakBonus.goldBonus > 1) rewardText += ` _(x${streakBonus.goldBonus} 보너스)_`;
        if (restBonusSystem.isRestBonusActive(user.discordId)) rewardText += ` _(x${restBonusSystem.getRestBonusMultiplier(user.discordId, 'gold')} 휴식보상)_`;
        if (foundTreasure) rewardText += `\n💎 **보물상자**: +${formatNumber(treasureGold)}G`;
        rewardText += `\n\n⭐ **경험치**: +${expGain} EXP`;
        if (streakBonus.expBonus > 1) rewardText += ` _(x${streakBonus.expBonus} 보너스)_`;
        if (restBonusSystem.isRestBonusActive(user.discordId)) rewardText += ` _(x${restBonusSystem.getRestBonusMultiplier(user.discordId, 'exp')} 휴식보상)_`;
        
        embed.addFields({ name: '🎁 획득 보상', value: rewardText, inline: true });
        
        // 레벨업 정보 추가
        if (levelUpInfo) {
            let levelUpText = `🎊 **레벨 ${levelUpInfo.level}** 달성!\n💪 스탯포인트 +5`;
            if (levelUpInfo.newArea) {
                levelUpText += `\n🗺️ 새로운 지역 해금: **${levelUpInfo.newArea}**`;
            }
            embed.addFields({ name: '⬆️ 레벨 업!', value: levelUpText, inline: true });
        }
        
        // 연속 사냥 정보
        if (user.huntingStreak > 1) {
            let streakText = `🔥 **${user.huntingStreak}회 연속!**`;
            
            // 마일스톤 달성
            if (user.huntingStreak === 5) {
                streakText += '\n🎊 5연속 달성! (보너스 +5%)';
            } else if (user.huntingStreak === 10) {
                streakText += '\n🎊 10연속 달성! (보너스 +20%)';
                user.gold += 1000; // 보너스 골드
                streakText += '\n💰 보너스 골드 +1,000G';
            } else if (user.huntingStreak === 20) {
                streakText += '\n🎊 20연속 달성! (보너스 +30%)';
                user.gold += 3000; // 보너스 골드
                streakText += '\n💰 보너스 골드 +3,000G';
            } else if (user.huntingStreak === 30) {
                streakText += '\n🎊 30연속 달성! (보너스 +50%)';
                user.gold += 5000; // 보너스 골드
                streakText += '\n💰 보너스 골드 +5,000G';
            } else if (user.huntingStreak === 50) {
                streakText += '\n🏆 50연속 달성! (최대 보너스!)';
                user.gold += 10000; // 보너스 골드
                streakText += '\n💰 보너스 골드 +10,000G';
            }
            
            embed.addFields({ name: '🔥 연속 사냥', value: streakText, inline: true });
        }
        
        embed.addFields({ name: '🎫 남은 사냥권', value: `${user.huntingTickets}/20`, inline: true });
        
        // 추가 보상 표시
        if (foundTreasure || doubleDrop) {
            let eventText = '';
            if (foundTreasure) eventText += '💎 **보물상자 발견!**\n';
            if (doubleDrop) eventText += '🎰 **더블 드롭 보너스!**\n';
            embed.addFields({ name: '✨ 추가 보상', value: eventText.trim(), inline: false });
        }
        
        // 드롭 아이템 화려하게 표시
        if (dropItems.length > 0) {
            let dropText = '';
            dropItems.forEach(drop => {
                if (drop.isMutationDrop) {
                    dropText += `${drop.item.emoji} **${drop.item.name}** (${drop.item.rarity}) ✨ _변이 특수 드롭!_\n`;
                } else if (drop.isSpecialDrop) {
                    dropText += `${drop.item.emoji} **${drop.item.name}** (${drop.item.rarity}) 🌟 _극희귀 드롭!_\n`;
                } else {
                    dropText += `${drop.item.emoji || '📦'} **${drop.item.name}** (${drop.item.rarity})`;
                    if (drop.quantity > 1) dropText += ` x${drop.quantity}`;
                    if (doubleDrop) dropText += ' _더블 드롭!_';
                    dropText += '\n';
                }
            });
            embed.addFields({ 
                name: '🎁 드롭 아이템', 
                value: dropText.trim(), 
                inline: false 
            });
        }
        
        // 미확인 아이템 발견 표시
        if (user.lootAppraisal?.unidentifiedItems?.length > 0) {
            const lastItem = user.lootAppraisal.unidentifiedItems[user.lootAppraisal.unidentifiedItems.length - 1];
            const gradeData = LOOT_APPRAISAL.grades[lastItem.grade];
            embed.addFields({
                name: '❓ 미확인 아이템 발견!',
                value: `${gradeData.emoji} **${gradeData.name}** - 감정이 필요합니다!`,
                inline: false
            });
        }
        
        // 주간 토너먼트 점수 계산
        const huntResult = {
            isBoss,
            isRare,
            mutation: mutation ? true : false,
            isPerfect: isDodged
        };
        const weeklyPoints = calculateWeeklyScore(huntResult);
        
        if (!user.huntingTournament) {
            user.huntingTournament = {
                weeklyScore: 0,
                weeklyRank: 0,
                lastWeekRank: 0,
                weeklyRewards: [],
                weeklyBadge: null,
                speedHuntRecords: new Map(),
                dailySpeedAttempts: 0,
                lastSpeedHuntDate: null,
                worldBossDamage: 0,
                treasureGoblinsKilled: 0,
                specialTrophies: []
            };
        }
        
        user.huntingTournament.weeklyScore += weeklyPoints;
        
        if (weeklyPoints > 0) {
            embed.addFields({
                name: '🏆 주간 토너먼트',
                value: `+${weeklyPoints}점 (현재: ${user.huntingTournament.weeklyScore}점)`,
                inline: true
            });
        }
        
        // 일일 미션 업데이트
        await User.updateOne(
            { discordId: interaction.user.id },
            { $inc: { 'dailyMissions.hunting.current': 1 } }
        );
        
    } else {
        // 패배 처리
        const goldLoss = Math.floor(((monster.gold[0] + monster.gold[1]) / 2) * 0.3);
        user.gold = Math.max(0, user.gold - goldLoss);
        
        const defeatMessages = {
            normal: [
                '몬스터의 힘이 예상보다 강했습니다...',
                '아쉽게 패배했습니다. 다음엔 꼭!',
                '전투력을 더 키워서 도전하세요.',
                '오늘은 여기까지...'
            ],
            boss: [
                '😱 보스의 압도적인 힘 앞에 무릎을 꿇었습니다...',
                '😱 보스가 너무 강력했습니다!',
                '😱 보스에게 도전하기엔 아직 이릅니다...'
            ],
            close: [ // 승률이 40% 이상일 때
                '정말 아깝게 졌습니다! 조금만 더!',
                '간발의 차이로 패배했습니다...',
                '다음엔 반드시 이길 수 있을 거예요!'
            ]
        };
        
        // 패배 메시지 선택
        let selectedMessage;
        if (isBoss) {
            selectedMessage = defeatMessages.boss[Math.floor(Math.random() * defeatMessages.boss.length)];
        } else if (winChance >= 0.4) {
            selectedMessage = defeatMessages.close[Math.floor(Math.random() * defeatMessages.close.length)];
        } else {
            selectedMessage = defeatMessages.normal[Math.floor(Math.random() * defeatMessages.normal.length)];
        }
        
        // 전투 통계 계산
        const damageDealt = Math.floor(userPower * 0.7); // 패배 시 70% 데미지만
        const damageTaken = Math.floor(monsterPower * 0.8);
        
        // 연속 사냥 기록
        const previousStreak = user.huntingStreak;
        user.huntingStreak = 0;
        
        // 연속 사냥 초기화 즉시 저장
        await user.save();
        
        embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`💀 사냥 실패... ${isBoss ? '😱 보스전 패배!' : ''}`)
            .setDescription(`**${MONSTER_EMOJIS[monster.name] || '👾'} ${monster.name}** ${isBoss ? '(BOSS)' : ''}에게 패배했습니다...\n\n_${selectedMessage}_`)
            .setImage(HUNTING_GIFS.defeat[Math.floor(Math.random() * HUNTING_GIFS.defeat.length)])
            .addFields(
                { 
                    name: '📊 전투 통계', 
                    value: `\`\`\`yaml\n준 데미지: ${damageDealt}\n받은 데미지: ${damageTaken} (치명상!)\n내 전투력: ${userPower}\n몬스터 전투력: ${monsterPower}\n승률: ${Math.floor(winChance * 100)}%\n\`\`\``, 
                    inline: false 
                },
                { name: '💸 잃은 골드', value: `-${formatNumber(goldLoss)}G`, inline: true },
                { name: '🎫 남은 사냥권', value: `${user.huntingTickets}/20`, inline: true }
            );
        
        // 버프 효과가 있었다면 표시
        if (battleEffects.length > 0) {
            embed.addFields({
                name: '🌟 전투 효과',
                value: battleEffects.slice(0, 5).join('\n'), // 최대 5개만 표시
                inline: false
            });
        }
        
        // 연속 사냥이 끊긴 경우
        if (previousStreak >= 3) {
            embed.addFields({ 
                name: '💔 연속 사냥 종료', 
                value: `${previousStreak}회 연속 기록이 초기화되었습니다...`, 
                inline: true 
            });
        }
        
        // 조언 추가
        let adviceText = '';
        if (winChance < 0.3) {
            adviceText = '💡 **조언**: 더 낮은 레벨의 사냥터에서 전투력을 키우세요!';
        } else if (winChance < 0.5) {
            adviceText = '💡 **조언**: 장비를 강화하거나 스탯을 올려보세요!';
        } else {
            adviceText = '💡 **조언**: 조금만 더 강해지면 충분히 이길 수 있습니다!';
        }
        
        embed.setFooter({ text: adviceText });
    }
    
    // 시장 이벤트 기록
    recordMarketEvent('hunterActivity', 1);
    if (mutation) recordMarketEvent('mutationSightings', 1);
    if (isWin && (isBoss || isRare)) recordMarketEvent('legendaryDrops', 1);
    
    // 시세 업데이트
    updateMarketPrices();
    
    // 감정사 등장 체크 (승리 시에만)
    let appraiserAppeared = false;
    if (isWin) {
        const appraiserChance = calculateAppraiserChance({ 
            mutation: !!mutation, 
            isBoss, 
            streak: user.huntingStreak 
        });
        
        if (Math.random() < appraiserChance) {
            appraiserAppeared = true;
        }
    }
    
    // 미션 진행도 업데이트
    await MissionHelper.updateHunting(interaction.user.id);
    
    // 골드 획득 미션 업데이트 (승리한 경우에만, goldGain이 정의되어 있을 때)
    if (isWin && typeof goldGain !== 'undefined' && goldGain > 0) {
        await MissionHelper.updateGoldEarned(interaction.user.id, goldGain);
    }
    
    // 인벤토리 변경사항을 Mongoose에 알림
    user.markModified('inventory');
    
    // 활동 로그 기록 - 승리 시에만
    if (isWin) {
        await ActivityLog.create({
            userId: user.discordId,
            nickname: user.nickname,
            activityType: 'hunting',
            details: {
                huntingArea: area.name,
                monsterKilled: isBoss ? bossName : (isRare ? area.rareMonster : area.monster),
                huntingRewards: {
                    gold: goldGain || 0,
                    exp: expGain || 0,
                    items: dropItems || []
                },
                goldChange: goldGain || 0,
                expGained: expGain || 0,
                levelUp: leveledUp || false,
                newLevel: leveledUp ? user.level : null
            }
        });
    }
    
    // 경험치, 골드, 아이템 등 모든 변경사항 저장
    await user.save();
    
    // 보스/희귀 몬스터 처치 시 결과 채널로 전송
    if ((isBoss || isRare) && isWin) {
        try {
            const gameResultManager = require('../../utils/gameResultManager').getInstance();
            await gameResultManager.sendHuntingResult(user, {
                monsterName: monster.name,
                areaName: area.name,
                gold: goldGain,
                exp: expGain,
                items: dropItems.map(d => ({ name: d.item.name })),
                isBoss: isBoss,
                isRare: isRare
            });
        } catch (err) {
            console.error('[Hunting] 결과 전송 실패:', err);
        }
    }
    
    const buttons = new ActionRowBuilder();
    
    // 감정사가 등장한 경우
    if (appraiserAppeared) {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('appraiser_greet')
                .setLabel('🧙 감정사와 대화')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💬'),
            new ButtonBuilder()
                .setCustomId(`hunt_area_${numericAreaId}`)
                .setLabel('🔄 다시 사냥')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.huntingTickets <= 0)
        );
        
        // 감정사 등장 알림 추가
        embed.addFields({
            name: '🧙 특별 방문!',
            value: `**${LOOT_MARKET.appraiser.name}**이(가) 나타났습니다!\n"${LOOT_MARKET.appraiser.dialogues.greeting[Math.floor(Math.random() * LOOT_MARKET.appraiser.dialogues.greeting.length)]}"`,
            inline: false
        });
    } else {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`hunt_area_${numericAreaId}`)
                .setLabel('🔄 다시 사냥')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.huntingTickets <= 0),
            new ButtonBuilder()
                .setCustomId('hunting')
                .setLabel('🗺️ 다른 지역')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('market_prices')
                .setLabel('📊 시세 확인')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}


// 몬스터 전투력 계산
function calculateMonsterPower(monster) {
    if (!monster.stats) return 50; // 기본값
    
    const stats = monster.stats;
    let power = 0;
    
    // 공격력과 방어력 위주로 계산
    power += (stats.atk || 0) * 2;
    power += (stats.def || 0) * 1.5;
    power += (stats.dodge || 0) * 0.8;
    power += (stats.luck || 0) * 0.5;
    
    // 레벨 보정 (몬스터의 평균 레벨 사용)
    const avgLevel = monster.level ? (monster.level[0] + monster.level[1]) / 2 : 1;
    power += avgLevel * 5;
    
    // 몬스터 희귀도에 따른 추가 보정
    const rarityBonus = {
        '일반': 1.0,
        '고급': 1.2,
        '레어': 1.5,
        '에픽': 2.0,
        '레전드리': 2.5
    };
    power *= (rarityBonus[monster.rarity] || 1.0);
    
    return Math.floor(power);
}

// 사냥권 재생성
function regenerateHuntingTickets(user) {
    // 이미 최대치인 경우 또는 값이 없는 경우
    if (!user.huntingTickets || user.huntingTickets >= 20) return 0;
    
    const now = Date.now();
    const REGEN_TIME = 300000; // 5분
    
    // 마지막 재생성 시간이 없으면 현재 시간으로 설정
    if (!user.lastHuntingTicketRegen) {
        user.lastHuntingTicketRegen = new Date();
        return 0;
    }
    
    const lastRegen = new Date(user.lastHuntingTicketRegen).getTime();
    const timePassed = now - lastRegen;
    const ticketsToAdd = Math.floor(timePassed / REGEN_TIME);
    
    if (ticketsToAdd > 0) {
        const currentTickets = user.huntingTickets;
        const newTickets = Math.min(20, currentTickets + ticketsToAdd);
        const addedTickets = newTickets - currentTickets;
        
        // 실제로 추가된 티켓 수만큼만 시간 업데이트
        user.huntingTickets = newTickets;
        user.lastHuntingTicketRegen = new Date(lastRegen + (addedTickets * REGEN_TIME));
        return addedTickets;
    }
    
    return 0;
}

module.exports = {
    showHuntingMenu,
    executeHunt
};