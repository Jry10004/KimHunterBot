const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const EXERCISE_SYSTEM = require('../../data/exerciseSystem');
const GAME_GIFS = require('../../data/gameGifs');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../../utils/levelCapHelper');

// 피로도 상수 정의
const MAX_FATIGUE = 100;
const FATIGUE_RECOVERY_RATE = 2; // 분당 회복량
const REST_TIME_REQUIRED = 10; // 운동 후 필요한 휴식 시간(분)

// 피로도 회복 계산
function updateFatigue(user) {
    if (!user.fitness) return;
    
    // lastFatigueUpdate가 없으면 현재 시간으로 초기화
    if (!user.fitness.lastFatigueUpdate) {
        user.fitness.lastFatigueUpdate = Date.now();
        return;
    }
    
    const now = Date.now();
    const timePassed = (now - user.fitness.lastFatigueUpdate) / 60000; // 분 단위
    
    if (timePassed > 0 && user.fitness.fatigue > 0) {
        // 레벨 보너스 적용
        let recoveryMultiplier = 1.0;
        const userLevel = user.fitness.level || 1;
        
        Object.entries(EXERCISE_SYSTEM.levelBonuses || {}).forEach(([level, bonus]) => {
            if (userLevel >= parseInt(level) && bonus.fatigueRecovery) {
                recoveryMultiplier = bonus.fatigueRecovery;
            }
        });
        
        const recovery = timePassed * FATIGUE_RECOVERY_RATE * recoveryMultiplier;
        user.fitness.fatigue = Math.max(0, user.fitness.fatigue - recovery);
        user.fitness.lastFatigueUpdate = now;
    }
}

// 오늘 사용한 운동 시간 계산
function getTodayUsedTime(user) {
    const today = new Date().toDateString();
    const todayExercises = user.fitness.exerciseHistory.filter(
        ex => new Date(ex.date).toDateString() === today
    );
    
    return todayExercises.reduce((total, ex) => total + ex.duration, 0) / 60000; // 분 단위로 반환
}

// 오늘 사용 가능한 총 시간 계산 (기본 + 보너스)
function getTodayTotalLimit(user) {
    const userType = user.premium?.type || 'basic';
    let baseLimit = EXERCISE_SYSTEM.dailyLimits[userType] || 120;
    
    // 레벨 보너스 적용
    const userLevel = user.fitness?.level || 1;
    let levelBonus = 0;
    
    Object.entries(EXERCISE_SYSTEM.levelBonuses || {}).forEach(([level, bonus]) => {
        if (userLevel >= parseInt(level) && bonus.bonusMinutes) {
            levelBonus = bonus.bonusMinutes;
        }
    });
    
    baseLimit += levelBonus;
    
    return baseLimit;
}

// 오늘 운동 시간 계산
function getTodayExerciseTime(user) {
    const today = new Date().toDateString();
    const todayExercises = user.fitness.exerciseHistory.filter(
        ex => new Date(ex.date).toDateString() === today
    );
    
    return todayExercises.reduce((total, ex) => total + ex.duration, 0);
}

// 운동 메인 메뉴
async function showExerciseMenu(interaction) {
    // Defer if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
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
    
    // 피로도 회복 적용
    updateFatigue(user);
    await user.save();
    
    // 피트니스 초기화
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
    
    // exerciseInventory 초기화 체크
    if (!user.fitness.exerciseInventory) {
        user.fitness.exerciseInventory = [];
        await user.save();
    }
    
    // 오늘 사용한 운동 시간 확인
    const todayUsedMinutes = getTodayUsedTime(user);
    const dailyLimit = getTodayTotalLimit(user);
    const remainingMinutes = dailyLimit - todayUsedMinutes;
    
    // 오늘 운동 시간 확인
    const todayExerciseTime = getTodayExerciseTime(user);
    const todayMinutes = Math.floor(todayExerciseTime / 60000);
    
    // 현재 레벨 티어 확인
    let currentTier = null;
    for (const [level, tier] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
        if (user.fitness.level >= parseInt(level)) {
            currentTier = tier;
        }
    }
    
    // 현재 운동 중인지 확인
    const isExercising = user.fitness.currentExercise && 
                        user.fitness.currentExercise.endTime > Date.now();
    
    let embedDescription = `**${currentTier.emoji} ${currentTier.name}** Lv.${user.fitness.level}\n\n📊 오늘 운동 현황:\n• 사용 시간: ${todayUsedMinutes}분 / ${dailyLimit}분\n• 남은 시간: **${remainingMinutes}분**\n• 현재 피로도: ${Math.floor(user.fitness.fatigue || 0)}/${MAX_FATIGUE}`;
    
    // 피로도에 따른 상태 표시
    if (user.fitness.fatigue >= 80) {
        embedDescription += ' 🔴 매우 피곤';
    } else if (user.fitness.fatigue >= 60) {
        embedDescription += ' 🟡 피곤함';
    } else if (user.fitness.fatigue >= 30) {
        embedDescription += ' 🟢 보통';
    } else {
        embedDescription += ' 💚 상쾌함';
    }
    
    // 레벨 보너스 표시
    if (user.fitness.level >= 10) {
        const appliedBonuses = [];
        Object.entries(EXERCISE_SYSTEM.levelBonuses || {}).forEach(([level, bonus]) => {
            if (user.fitness.level >= parseInt(level)) {
                if (bonus.efficiency > 1) appliedBonuses.push(`운동 효율 +${Math.round((bonus.efficiency - 1) * 100)}%`);
                if (bonus.statBonus > 1) appliedBonuses.push(`스탯 증가량 +${Math.round((bonus.statBonus - 1) * 100)}%`);
                if (bonus.bonusMinutes) appliedBonuses.push(`일일 보너스 +${bonus.bonusMinutes}분`);
            }
        });
        if (appliedBonuses.length > 0) {
            embedDescription += `\n\n🎯 **레벨 보너스:** ${appliedBonuses.join(', ')}`;
        }
    }
    
    if (isExercising) {
        const currentExercise = EXERCISE_SYSTEM.exercises[user.fitness.currentExercise.exerciseId];
        const remainingTime = Math.ceil((user.fitness.currentExercise.endTime - Date.now()) / 60000);
        embedDescription += `\n\n🏃 **현재 운동 중:** ${currentExercise?.emoji || '🏃'} ${currentExercise?.name || '운동'}\n⏱️ 남은 시간: ${remainingTime}분`;
    }
    
    if (remainingMinutes <= 0) {
        embedDescription += `\n\n⚠️ **오늘의 운동 시간을 모두 사용했습니다!**`;
    }
    
    // 피로도가 높으면 휴식 필요
    if (user.fitness.fatigue >= 80) {
        embedDescription += `\n\n😫 **피로도가 높습니다! 운동 효율이 감소합니다.**`;
    }
    
    // 직업별 추천 운동 찾기
    let userClass = null;
    if (user.emblem) {
        const emblemBase = user.emblem.replace(/\s*\+\d+$/, ''); // 강화 레벨 제거
        for (const className of Object.keys(EXERCISE_SYSTEM.recommendedExercises || {})) {
            if (emblemBase.includes(className)) {
                userClass = className;
                break;
            }
        }
    }
    
    // 운동으로 얻은 스탯만 표시
    const exerciseStats = user.exerciseStats || {};
    
    const embed = new EmbedBuilder()
        .setColor(isExercising ? '#FFA500' : '#00ff7f')
        .setTitle('🏃 운동하기')
        .setDescription(embedDescription + (userClass ? `\n\n🎯 **${userClass} 추천 운동**: ${EXERCISE_SYSTEM.recommendedExercises[userClass].map(id => EXERCISE_SYSTEM.exercises[id]?.name || id).join(', ')}` : ''))
        .addFields(
            { name: '💪 힘', value: `+${exerciseStats.strength || 0}`, inline: true },
            { name: '🏃 민첩', value: `+${exerciseStats.agility || 0}`, inline: true },
            { name: '🧠 지능', value: `+${exerciseStats.intelligence || 0}`, inline: true },
            { name: '❤️ 체력', value: `+${exerciseStats.vitality || 0}`, inline: true },
            { name: '🍀 행운', value: `+${exerciseStats.luck || 0}`, inline: true },
            { name: '⏱️ 오늘 운동', value: `${todayMinutes}분/${dailyLimit}분`, inline: true }
        );
    
    // 운동 종류 드롭다운
    const exerciseOptions = [];
    
    // 기본 운동
    Object.values(EXERCISE_SYSTEM.exercises)
        .filter(ex => ex.category === 'basic')
        .forEach(ex => {
            exerciseOptions.push({
                label: `${ex.emoji} ${ex.name}`,
                description: ex.description,
                value: ex.id,
                emoji: ex.emoji
            });
        });
    
    // 헬스장 운동 (일일 이용권 확인)
    const hasGymPass = user.fitness?.exerciseInventory?.some(item => 
        item.name === '헬스장 일일 이용권' && 
        (!item.expiresAt || new Date(item.expiresAt) > new Date())
    ) || false;
    Object.values(EXERCISE_SYSTEM.exercises)
        .filter(ex => ex.category === 'gym')
        .forEach(ex => {
            exerciseOptions.push({
                label: `${ex.emoji} ${ex.name} ${!hasGymPass ? '(이용권 필요)' : ''}`,
                description: ex.description,
                value: ex.id,
                emoji: ex.emoji
            });
        });
    
    const exerciseSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('exercise_select')
        .setPlaceholder(isExercising ? '🏃 운동 진행 중...' : '🏃 운동을 선택하세요')
        .addOptions(exerciseOptions)
        .setDisabled(isExercising);
    
    const selectRow = new ActionRowBuilder().addComponents(exerciseSelectMenu);
    
    const buttons = [];
    
    // 운동 중이면 진행도 확인 버튼 추가
    if (isExercising) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId('exercise_check_progress')
                .setLabel('🔍 진행도 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('exercise_complete_early')
                .setLabel('✅ 운동 완료')
                .setStyle(ButtonStyle.Success)
        );
    }
    
    buttons.push(
        new ButtonBuilder()
            .setCustomId('exercise_gym_shop')
            .setLabel('🏪 운동 용품점')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('exercise_stats')
            .setLabel('📊 상세 스탯')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('main_menu')
            .setLabel('🏠 메인 메뉴')
            .setStyle(ButtonStyle.Secondary)
    );
    
    // 버튼이 5개를 초과하면 두 줄로 나누기
    const buttonRows = [];
    if (buttons.length > 5) {
        buttonRows.push(new ActionRowBuilder().addComponents(buttons.slice(0, 2)));
        buttonRows.push(new ActionRowBuilder().addComponents(buttons.slice(2)));
    } else {
        buttonRows.push(new ActionRowBuilder().addComponents(buttons));
    }
    
    return await interaction.editReply({
        embeds: [embed],
        components: [selectRow, ...buttonRows]
    });
}

// 운동 실행 (모달 표시)
async function executeExercise(interaction, exerciseId) {
    const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
    const user = await getUser(interaction.user.id);
    const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
    
    if (!exercise) {
        return await interaction.editReply({ 
            content: '❌ 잘못된 운동입니다!' 
        });
    }
    
    // 현재 운동 중인지 확인
    if (user.fitness?.currentExercise && user.fitness.currentExercise.endTime > Date.now()) {
        return await interaction.editReply({ 
            content: '❌ 이미 운동 중입니다! 운동을 완료한 후 다시 시도해주세요.' 
        });
    }
    
    // 헬스장 운동 체크
    if (exercise.category === 'gym') {
        const hasGymPass = user.fitness?.permanentGymAccess || false;
        if (!hasGymPass) {
            return await interaction.editReply({ 
                content: '❌ 헬스장 VIP 회원권이 필요합니다! (운동 용품점에서 구매 가능)' 
            });
        }
    }
    
    // 오늘 운동 시간 확인
    const todayUsedMinutes = getTodayUsedTime(user);
    const userType = user.premium?.type || 'basic';
    const dailyLimit = EXERCISE_SYSTEM.dailyLimits[userType] || 60;
    const remainingMinutes = dailyLimit - todayUsedMinutes;
    
    if (remainingMinutes <= 0) {
        return await interaction.editReply({ 
            content: `😫 오늘의 운동 시간을 모두 사용했습니다! (${dailyLimit}분/${dailyLimit}분)\n🌟 프리미엄 회원은 더 많은 시간을 사용할 수 있습니다!`
        });
    }
    
    // 운동 시간 선택 버튼 생성
    const timeOptions = [10, 20, 30, 45, 60].filter(t => t <= remainingMinutes);
    const timeButtons = timeOptions.map(minutes => 
        new ButtonBuilder()
            .setCustomId(`exercise_start_${exerciseId}_${minutes}`)
            .setLabel(`${minutes}분`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏱️')
    );
    
    // 사용자 정의 시간 버튼
    const customButton = new ButtonBuilder()
        .setCustomId(`exercise_custom_${exerciseId}`)
        .setLabel('시간 직접 입력')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️');
    
    const cancelButton = new ButtonBuilder()
        .setCustomId('exercise_cancel')
        .setLabel('취소')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌');
    
    const rows = [];
    // 첫 번째 줄: 시간 버튼들
    if (timeButtons.length > 0) {
        rows.push(new ActionRowBuilder().addComponents(timeButtons.slice(0, Math.min(5, timeButtons.length))));
    }
    // 두 번째 줄: 사용자 정의 버튼과 취소 버튼
    rows.push(new ActionRowBuilder().addComponents(customButton, cancelButton));
    
    // 피로도 회복 적용
    updateFatigue(user);
    
    const currentFatigue = user.fitness.fatigue || 0;
    let description = `운동할 시간을 선택해주세요.\n남은 운동 시간: **${remainingMinutes}분**\n현재 피로도: ${Math.floor(currentFatigue)}/${MAX_FATIGUE}`;
    
    if (currentFatigue >= 80) {
        description += `\n\n⚠️ **피로도가 매우 높습니다!**\n운동 효율이 50%로 감소합니다.`;
    } else if (currentFatigue >= 60) {
        description += `\n\n⚠️ **피로도가 높습니다.**\n운동 효율이 70%로 감소합니다.`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`${exercise.emoji} ${exercise.name} 시간 설정`)
        .setDescription(description)
        .setColor(currentFatigue >= 60 ? '#FF6600' : '#00FF00')
        .setFooter({ text: '운동 시간을 선택하면 바로 운동이 시작됩니다!' });
    
    return await interaction.editReply({
        embeds: [embed],
        components: rows
    });
}

// 실제 운동 수행 함수 (운동 시작)
async function performExercise(interaction, exerciseId, minutes) {
    const user = await getUser(interaction.user.id);
    const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
    
    if (!exercise) {
        return await interaction.editReply({ 
            content: '❌ 잘못된 운동입니다!' 
        });
    }
    
    // 운동 시작 시간 설정
    const startTime = Date.now();
    const endTime = startTime + (minutes * 60000);
    
    // 운동 상태 저장
    user.fitness.currentExercise = {
        exerciseId: exerciseId,
        startTime: startTime,
        endTime: endTime,
        minutes: minutes
    };
    await user.save();
    
    // 운동 시작 메시지
    const startEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle(`${exercise.emoji} ${exercise.name} 시작!`)
        .setDescription(`🏃 **${minutes}분** 동안 운동을 진행합니다!`)
        .addFields(
            { name: '⏰ 종료 시간', value: `<t:${Math.floor(endTime/1000)}:R>`, inline: true },
            { name: '😫 피로도 사용', value: `${Math.floor(exercise.fatigueRate * minutes)} / ${MAX_FATIGUE}`, inline: true }
        )
        .setFooter({ text: '운동이 끝나면 결과를 확인할 수 있습니다!' });
    
    const checkButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_check_progress')
                .setLabel('🔍 진행도 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('exercise_complete_early')
                .setLabel('✅ 운동 종료')
                .setStyle(ButtonStyle.Success)
        );
    
    return await interaction.editReply({
        embeds: [startEmbed],
        components: [checkButton]
    });
}

// 운동 완료 처리 함수
async function completeExercise(interaction) {
    const user = await getUser(interaction.user.id);
    
    if (!user.fitness?.currentExercise) {
        return await interaction.followUp({
            content: '❌ 진행 중인 운동이 없습니다!',
            flags: 64
        });
    }
    
    const currentExercise = user.fitness.currentExercise;
    const exercise = EXERCISE_SYSTEM.exercises[currentExercise.exerciseId];
    const now = Date.now();
    
    // 실제 운동한 시간 계산
    const elapsedTime = now - currentExercise.startTime;
    const minutes = Math.min(currentExercise.minutes, Math.floor(elapsedTime / 60000));
    
    if (minutes < 1) {
        return await interaction.followUp({
            content: '❌ 최소 1분은 운동해야 보상을 받을 수 있습니다!',
            flags: 64
        });
    }
    
    // 오늘 사용한 운동 시간 계산
    const todayUsedMinutes = getTodayUsedTime(user);
    const dailyLimit = getTodayTotalLimit(user);
    
    // duration 변수 정의 (밀리초)
    const duration = minutes * 60 * 1000;
    
    // 보충제 효과 확인
    let efficiencyMultiplier = 1.0;
    const activeSupplements = user.fitness.exerciseInventory?.filter(item => 
        item.type === 'supplement' && 
        item.effect && 
        (!item.expiresAt || new Date(item.expiresAt) > new Date())
    ) || [];
    
    activeSupplements.forEach(supplement => {
        if (supplement.effect.efficiency) {
            efficiencyMultiplier *= supplement.effect.efficiency;
        }
    });
    
    // 장비 효과 확인
    const equipment = user.fitness.exerciseInventory?.filter(item => 
        item.type === 'equipment' && item.equipped
    ) || [];
    
    let expMultiplier = 1.0;
    let statMultiplier = 1.0;
    
    equipment.forEach(equip => {
        if (equip.effect.allEfficiency) {
            efficiencyMultiplier *= equip.effect.allEfficiency;
        }
        if (equip.effect.cardioEfficiency && (exercise.category === 'basic' || exercise.id === 'jogging' || exercise.id === 'spinning' || exercise.id === 'jumprope')) {
            efficiencyMultiplier *= equip.effect.cardioEfficiency;
        }
        if (equip.effect.strengthEfficiency && (exercise.id === 'pushup' || exercise.id === 'weight' || exercise.id === 'powerlifting')) {
            efficiencyMultiplier *= equip.effect.strengthEfficiency;
        }
        if (equip.effect.expBonus) {
            expMultiplier *= equip.effect.expBonus;
        }
        if (equip.effect.statMultiplier) {
            statMultiplier *= equip.effect.statMultiplier;
        }
    });
    
    // 레벨 보너스 적용
    const userLevel = user.fitness.level || 1;
    let levelEfficiencyBonus = 1.0;
    let levelStatBonus = 1.0;
    
    // 레벨별 보너스 확인
    Object.entries(EXERCISE_SYSTEM.levelBonuses || {}).forEach(([level, bonus]) => {
        if (userLevel >= parseInt(level)) {
            levelEfficiencyBonus = bonus.efficiency || 1.0;
            levelStatBonus = bonus.statBonus || 1.0;
        }
    });
    
    // 최종 배율 계산
    efficiencyMultiplier *= levelEfficiencyBonus;
    statMultiplier *= levelStatBonus;
    
    // 피로도에 따른 효율 감소
    const currentFatigue = user.fitness.fatigue || 0;
    if (currentFatigue >= 80) {
        efficiencyMultiplier *= 0.5; // 50% 효율
        statMultiplier *= 0.5;
    } else if (currentFatigue >= 60) {
        efficiencyMultiplier *= 0.7; // 70% 효율
        statMultiplier *= 0.7;
    } else if (currentFatigue >= 40) {
        efficiencyMultiplier *= 0.85; // 85% 효율
        statMultiplier *= 0.85;
    }
    
    // 보상 계산
    const goldReward = Math.floor(exercise.rewards.goldPerMinute * minutes * efficiencyMultiplier);
    let expReward = Math.floor(exercise.rewards.expPerMinute * minutes * efficiencyMultiplier * expMultiplier);
    const fitnessExpReward = Math.floor(exercise.rewards.fitnessExpPerMinute * minutes * efficiencyMultiplier);
    
    // 스탯 증가 계산 (실제 게임 스탯)
    const statGains = {};
    if (exercise.statGains) {
        Object.entries(exercise.statGains).forEach(([stat, gainPerHour]) => {
            // 시간당 스탯 증가량을 분 단위로 계산 (statMultiplier 적용)
            const totalGain = Math.floor((gainPerHour * minutes * statMultiplier) / 60);
            if (totalGain > 0) {
                statGains[stat] = totalGain;
                // 실제 게임 스탯 증가
                if (!user.stats) user.stats = {};
                user.stats[stat] = (user.stats[stat] || 10) + totalGain;
                
                // 운동으로 얻은 스탯 별도 추적
                if (!user.exerciseStats) user.exerciseStats = {};
                user.exerciseStats[stat] = (user.exerciseStats[stat] || 0) + totalGain;
            }
        });
    }
    
    // 피로도 증가
    const fatigueIncrease = Math.floor(exercise.fatigueRate * minutes);
    user.fitness.fatigue = Math.min(MAX_FATIGUE, user.fitness.fatigue + fatigueIncrease);
    user.fitness.lastFatigueUpdate = Date.now();
    
    // 보상 지급
    // 레벨 100 체크 후 경험치 추가
    if (user.level < MAX_LEVEL) {
        user.exp += expReward;
    } else {
        expReward = 0; // 만렙인 경우 경험치 획득량 0으로 표시
    }
    user.fitness.exp += fitnessExpReward;
    user.fitness.totalExerciseTime += duration;
    
    // 레벨업 체크
    // 레벨업 공식: 점진적으로 증가하는 경험치 요구량
    // 1년(365일) 매일 2시간 운동 시 레벨 100 도달 목표
    // 총 필요 경험치: 약 876,000 (365일 * 120분 * 평균 20 피트니스 경험치/분)
    const getRequiredExp = (level) => {
        if (level < 10) return level * 50;
        if (level < 20) return level * 100;
        if (level < 30) return level * 200;
        if (level < 40) return level * 400;
        if (level < 50) return level * 800;
        if (level < 60) return level * 1200;
        if (level < 70) return level * 1600;
        if (level < 80) return level * 2000;
        if (level < 90) return level * 2500;
        return level * 3000; // 90-100 구간
    };
    
    while (user.fitness.level < 100) {
        const requiredExp = getRequiredExp(user.fitness.level);
        if (user.fitness.exp >= requiredExp) {
            user.fitness.exp -= requiredExp;
            user.fitness.level++;
            
            // 레벨업 보상 (매 10레벨마다 특별 보상)
            if (user.fitness.level % 10 === 0) {
                user.gold += user.fitness.level * 1000000; // 레벨 * 100만 골드
            }
        } else {
            break;
        }
    }
    
    // 운동 기록 추가
    user.fitness.exerciseHistory.push({
        exerciseType: exercise.id,
        date: new Date(),
        duration: duration,
        rewards: {
            gold: goldReward,
            exp: expReward,
            fitnessExp: fitnessExpReward
        }
    });
    
    // 마지막 운동 날짜 업데이트
    const today = new Date().toDateString();
    if (user.fitness.lastExerciseDate !== today) {
        user.fitness.lastExerciseDate = today;
        // 연속 운동 체크
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (user.fitness.lastExerciseDate === yesterday.toDateString()) {
            user.fitness.streak++;
        } else {
            user.fitness.streak = 1;
        }
    }
    
    // 일일 미션 업데이트
    const MissionHelper = require('../../utils/missionHelper');
    await MissionHelper.updateExercise(interaction.user.id);
    
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`${exercise.emoji} ${exercise.name} 완료!`)
        .setDescription(`${minutes}분 동안 운동했습니다!`)
        .setImage(GAME_GIFS.exercise.workout)
        .addFields(
            { name: '⭐ 경험치', value: `+${expReward} EXP`, inline: true },
            { name: '💪 피트니스 EXP', value: `+${fitnessExpReward}`, inline: true },
            { name: '⏱️ 오늘 운동', value: `${todayUsedMinutes + minutes}분/${dailyLimit}분`, inline: true }
        );
    
    if (Object.keys(statGains).length > 0) {
        const statText = Object.entries(statGains)
            .map(([stat, gain]) => `${getStatEmoji(stat)} ${getStatName(stat)} +${gain}`)
            .join('\n');
        embed.addFields({ name: '📈 스탯 증가', value: statText, inline: false });
    }
    
    // 보충제/장비 효과 표시
    const totalEfficiency = efficiencyMultiplier * (currentFatigue >= 80 ? 0.5 : currentFatigue >= 60 ? 0.7 : currentFatigue >= 40 ? 0.85 : 1.0);
    if (totalEfficiency !== 1.0) {
        let bonusText = `x${totalEfficiency.toFixed(2)}`;
        const factors = [];
        if (levelEfficiencyBonus > 1.0) factors.push(`레벨 보너스`);
        if (equipment.length > 0) factors.push(`장비 효과`);
        if (activeSupplements.length > 0) factors.push(`보충제`);
        if (currentFatigue >= 40) factors.push(`피로도 감소`);
        
        if (factors.length > 0) {
            bonusText += ` (${factors.join(', ')})`;
        }
        
        embed.addFields({ 
            name: '🌟 최종 효율', 
            value: bonusText, 
            inline: false 
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🏃 계속 운동')
                .setStyle(ButtonStyle.Primary)
                .setDisabled((todayUsedMinutes + minutes) >= dailyLimit),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // 운동 상태 초기화
    user.fitness.currentExercise = null;
    await user.save();
    
    return await interaction.followUp({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 운동 용품점
async function showExerciseShop(interaction) {
    console.log('[Exercise Shop] Starting showExerciseShop function');
    
    // Defer if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton()) {
            console.log('[Exercise Shop] Deferring button update');
            await interaction.deferUpdate();
        } else {
            console.log('[Exercise Shop] Deferring reply');
            await interaction.deferReply({ flags: 64 });
        }
    }
    
    console.log('[Exercise Shop] Getting user data');
    const user = await getUser(interaction.user.id);
    console.log('[Exercise Shop] User data retrieved:', user ? 'Found' : 'Not Found');
    
    if (!user || !user.registered) {
        console.log('[Exercise Shop] User not found or not registered');
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
        });
    }
    
    // exerciseInventory 초기화 체크
    if (!user.fitness?.exerciseInventory) {
        if (!user.fitness) {
            user.fitness = {
                level: 1,
                exp: 0,
                totalExerciseTime: 0,
                lastExercise: null,
                streak: 0,
                fatigue: 0,
                stats: {
                    strength: 1,
                    stamina: 1,
                    flexibility: 1,
                    agility: 1,
                    mental: 1
                },
                equipment: {
                    clothes: 'basic',
                    shoes: 'basic'
                },
                activeSupplements: [],
                exerciseHistory: [],
                exerciseInventory: []
            };
        } else {
            user.fitness.exerciseInventory = [];
        }
        await user.save();
    }
    
    // Ensure fatigue is initialized
    if (user.fitness.fatigue === undefined) {
        user.fitness.fatigue = 0;
    }
    
    console.log('[Exercise Shop] User fitness data initialized, fatigue:', user.fitness.fatigue);
    
    const shopItems = [
        // 🎫 특수 아이템
        { 
            name: '헬스장 VIP 회원권', 
            price: 100000000, // 1억
            emoji: '🎫', 
            description: '구독자 전용 혜택 - 골드로 구매 불가 (추후 구독자에게 지급 예정)',
            type: 'gym_pass',
            category: '특수'
        },
        { 
            name: '시간 연장권', 
            price: 300000000, // 3억
            emoji: '⏰', 
            description: '오늘 운동 시간 +60분 (즉시 적용)',
            type: 'time_extension',
            category: '특수'
        },
        { 
            name: '피로도 회복제', 
            price: 500000000, // 5억
            emoji: '💉', 
            description: '피로도 완전 회복 (100으로)',
            type: 'fatigue_reset',
            category: '특수'
        },
        
        // 🥤 보충제 카테고리
        { 
            name: '프로틴 쉐이크', 
            price: 200000000, // 2억
            emoji: '🥤', 
            description: '운동 효율 +20% (2시간)',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '슈퍼 프로틴', 
            price: 1000000000, // 10억
            emoji: '💪', 
            description: '운동 효율 +50% (4시간)',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '에너지 드링크', 
            price: 150000000, // 1.5억
            emoji: '🧃', 
            description: '즉시 피로도 -20',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '울트라 에너지', 
            price: 800000000, // 8억
            emoji: '⚡', 
            description: '즉시 피로도 -50',
            type: 'supplement',
            category: '보충제'
        },
        
        // 👕 장비 카테고리 (영구)
        { 
            name: '운동복 세트', 
            price: 2000000000, // 20억
            emoji: '👕', 
            description: '모든 운동 효율 +10%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '프로 운동복 세트', 
            price: 5000000000, // 50억
            emoji: '🥋', 
            description: '모든 운동 효율 +25%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '러닝화', 
            price: 1500000000, // 15억
            emoji: '👟', 
            description: '유산소 운동 효율 +15%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '프로 러닝화', 
            price: 4000000000, // 40억
            emoji: '🏃', 
            description: '유산소 운동 효율 +35%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '스마트 워치', 
            price: 3000000000, // 30억
            emoji: '⌚', 
            description: '경험치 획득 +20%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '파워 벨트', 
            price: 8000000000, // 80억
            emoji: '🔗', 
            description: '힘 운동 효율 +40%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '전설의 덤벨', 
            price: 10000000000, // 100억
            emoji: '🏆', 
            description: '모든 스탯 증가량 +50%',
            type: 'equipment',
            category: '장비'
        }
    ];
    
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('🏪 운동 용품점')
        .setDescription(`💰 보유 골드: ${formatNumber(user.gold)}G\n😫 현재 피로도: ${user.fitness.fatigue}/${MAX_FATIGUE}\n\n📌 **카테고리별 상품**`)
        .setFooter({ text: '버튼을 눌러 구매하세요! (1~13번)' });
    
    // 카테고리별로 그룹화
    const categories = {};
    shopItems.forEach((item, index) => {
        if (!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push({ ...item, index });
    });
    
    // 카테고리별로 필드 추가
    Object.entries(categories).forEach(([category, items]) => {
        const itemList = items.map(item => {
            // 보유 수량 확인
            const owned = user.fitness.exerciseInventory.filter(inv => inv.name === item.name);
            let ownedText = '';
            
            if (owned.length > 0) {
                if (item.type === 'equipment') {
                    ownedText = ' ✅';
                } else {
                    const totalQuantity = owned.reduce((sum, inv) => sum + (inv.quantity || 1), 0);
                    ownedText = ` (${totalQuantity})`;
                }
            }
            
            return `**${item.index + 1}.** ${item.emoji} ${item.name}${ownedText}\n└ ${formatNumber(item.price)}G - ${item.description}`;
        }).join('\n\n');
        
        embed.addFields({
            name: `━━━ ${category} ━━━`,
            value: itemList || '상품 없음',
            inline: false
        });
    });
    
    // 보유 아이템 표시
    if (user.fitness.exerciseInventory.length > 0) {
        const inventoryText = user.fitness.exerciseInventory
            .filter(item => !item.expiresAt || new Date(item.expiresAt) > new Date())
            .map(item => {
                let text = `${item.emoji || '📦'} ${item.name}`;
                if (item.quantity > 1) text += ` x${item.quantity}`;
                if (item.expiresAt) {
                    const remainingTime = new Date(item.expiresAt) - new Date();
                    const hours = Math.floor(remainingTime / 3600000);
                    const minutes = Math.floor((remainingTime % 3600000) / 60000);
                    text += ` (${hours}시간 ${minutes}분)`;
                }
                if (item.equipped) text += ' 🔸장착중';
                return text;
            })
            .join('\n');
        
        if (inventoryText) {
            embed.addFields({
                name: '🎒 운동 인벤토리',
                value: inventoryText || '비어있음',
                inline: false
            });
        }
    }
    
    // 버튼 생성 (여러 줄로 나누기)
    const buttonRows = [];
    const itemsPerRow = 5;
    
    for (let i = 0; i < shopItems.length; i += itemsPerRow) {
        const row = new ActionRowBuilder();
        const rowItems = shopItems.slice(i, i + itemsPerRow);
        
        rowItems.forEach((item, idx) => {
            const globalIndex = i + idx;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`exercise_buy_${globalIndex}`)
                    .setLabel(`${globalIndex + 1}`)
                    .setStyle(user.gold >= item.price ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(user.gold < item.price)
            );
        });
        
        buttonRows.push(row);
    }
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🚪 락커룸')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    try {
        console.log('[Exercise Shop] Sending reply with embed and components');
        return await interaction.editReply({
            embeds: [embed],
            components: [...buttonRows, backButton]
        });
    } catch (error) {
        console.error('[Exercise Shop] Error sending reply:', error);
        throw error;
    }
}

// 스탯 이모지 헬퍼
function getStatEmoji(stat) {
    const emojis = {
        strength: '💪',
        agility: '🏃',
        intelligence: '🧠',
        vitality: '❤️',
        luck: '🍀',
        // 기존 운동 스탯 호환성
        stamina: '🏃',
        flexibility: '🧘',
        mental: '🧠'
    };
    return emojis[stat] || '📊';
}

// 스탯 이름 헬퍼
function getStatName(stat) {
    const names = {
        strength: '힘',
        agility: '민첩',
        intelligence: '지능',
        vitality: '체력',
        luck: '행운',
        // 기존 운동 스탯 호환성
        stamina: '체력',
        flexibility: '유연성',
        mental: '정신력'
    };
    return names[stat] || stat;
}

// 운동 상세 스탯 표시
async function showExerciseStats(interaction) {
    const user = await getUser(interaction.user.id);
    
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }
    
    // 오늘 사용한 운동 시간 확인
    const todayUsedMinutes = getTodayUsedTime(user);
    const dailyLimit = getTodayTotalLimit(user);
    const remainingMinutes = dailyLimit - todayUsedMinutes;
    
    // 전체 운동 시간 계산
    const totalMinutes = Math.floor(user.fitness.totalExerciseTime / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;
    
    // 운동별 통계 계산
    const exerciseStats = {};
    user.fitness.exerciseHistory.forEach(record => {
        if (!exerciseStats[record.exerciseType]) {
            exerciseStats[record.exerciseType] = {
                count: 0,
                totalTime: 0,
                totalGold: 0,
                totalExp: 0
            };
        }
        exerciseStats[record.exerciseType].count++;
        exerciseStats[record.exerciseType].totalTime += record.duration || 0;
        exerciseStats[record.exerciseType].totalGold += record.rewards?.gold || 0;
        exerciseStats[record.exerciseType].totalExp += record.rewards?.fitnessExp || 0;
    });
    
    // 가장 많이 한 운동 찾기
    let favoriteExercise = null;
    let maxCount = 0;
    for (const [exerciseId, stats] of Object.entries(exerciseStats)) {
        if (stats.count > maxCount) {
            maxCount = stats.count;
            favoriteExercise = exerciseId;
        }
    }
    
    // 현재 레벨 티어 확인
    let currentTier = null;
    let nextTier = null;
    let nextLevelReq = 0;
    
    const tierLevels = Object.entries(EXERCISE_SYSTEM.levelTiers).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    for (let i = 0; i < tierLevels.length; i++) {
        const [level, tier] = tierLevels[i];
        if (user.fitness.level >= parseInt(level)) {
            currentTier = tier;
            if (i < tierLevels.length - 1) {
                nextTier = tierLevels[i + 1][1];
                nextLevelReq = parseInt(tierLevels[i + 1][0]);
            }
        }
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('📊 피트니스 상세 스탯')
        .setDescription(`**${currentTier.emoji} ${currentTier.name}** Lv.${user.fitness.level}`)
        .addFields(
            { 
                name: '⏱️ 총 운동 시간', 
                value: `${totalHours}시간 ${totalRemainingMinutes}분`, 
                inline: true 
            },
            { 
                name: '🔥 연속 운동', 
                value: `${user.fitness.streak}일`, 
                inline: true 
            },
            { 
                name: '💪 최애 운동', 
                value: favoriteExercise ? `${EXERCISE_SYSTEM.exercises[favoriteExercise]?.emoji || '🏃'} ${EXERCISE_SYSTEM.exercises[favoriteExercise]?.name || favoriteExercise}` : '없음', 
                inline: true 
            }
        );
    
    // 운동으로 증가한 게임 스탯 표시
    const statIncreases = {
        strength: Math.max(0, (user.stats?.strength || 10) - 10),
        agility: Math.max(0, (user.stats?.agility || 10) - 10),
        intelligence: Math.max(0, (user.stats?.intelligence || 10) - 10),
        vitality: Math.max(0, (user.stats?.vitality || 10) - 10),
        luck: Math.max(0, (user.stats?.luck || 10) - 10)
    };
    
    embed.addFields(
        { name: '\u200B', value: '**📈 운동으로 증가한 스탯**', inline: false },
        { name: '💪 힘', value: `+${statIncreases.strength}`, inline: true },
        { name: '🏃 민첩', value: `+${statIncreases.agility}`, inline: true },
        { name: '🧠 지능', value: `+${statIncreases.intelligence}`, inline: true },
        { name: '❤️ 체력', value: `+${statIncreases.vitality}`, inline: true },
        { name: '🍀 행운', value: `+${statIncreases.luck}`, inline: true },
        { name: '📊 총 증가량', value: `+${Object.values(statIncreases).reduce((a, b) => a + b, 0)}`, inline: true }
    );
    
    // 진행도
    if (nextTier) {
        const progressToNext = user.fitness.level - parseInt(Object.entries(EXERCISE_SYSTEM.levelTiers).find(([_, t]) => t === currentTier)[0]);
        const totalToNext = nextLevelReq - parseInt(Object.entries(EXERCISE_SYSTEM.levelTiers).find(([_, t]) => t === currentTier)[0]);
        const progressPercent = Math.floor((progressToNext / totalToNext) * 100);
        
        embed.addFields({
            name: '📊 다음 티어까지',
            value: `${nextTier.emoji} ${nextTier.name} (Lv.${nextLevelReq})\n${'█'.repeat(Math.floor(progressPercent/10))}${'░'.repeat(10-Math.floor(progressPercent/10))} ${progressPercent}%`,
            inline: false
        });
    }
    
    // 운동별 통계
    if (Object.keys(exerciseStats).length > 0) {
        const statTexts = Object.entries(exerciseStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([exerciseId, stats]) => {
                const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
                const minutes = Math.floor(stats.totalTime / 60000);
                return `${exercise?.emoji || '🏃'} **${exercise?.name || exerciseId}**: ${stats.count}회 (${minutes}분)`;
            });
        
        embed.addFields({
            name: '🏋️ 운동별 통계 (상위 5개)',
            value: statTexts.join('\n') || '운동 기록이 없습니다.',
            inline: false
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    // interaction이 이미 defer되었으므로 editReply 사용
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 피트니스 랭킹 표시
async function showExerciseRanking(interaction) {
    const User = require('../../models/User');
    
    try {
        // Defer if not already deferred
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
        
        // 피트니스 레벨 기준 상위 10명 조회
        const topUsers = await User.find({ 
            registered: true,
            'fitness.level': { $exists: true, $gt: 0 }
        })
        .sort({ 'fitness.level': -1, 'fitness.exp': -1 })
        .limit(10)
        .select('username nickname fitness.level fitness.exp fitness.totalExerciseTime');
        
        if (topUsers.length === 0) {
            return await interaction.editReply({ 
                content: '아직 랭킹 데이터가 없습니다!', 
                embeds: [],
                components: []
            });
        }
        
        // 현재 유저의 순위 찾기
        const currentUser = await getUser(interaction.user.id);
        const userRank = await User.countDocuments({
            registered: true,
            $or: [
                { 'fitness.level': { $gt: currentUser.fitness.level } },
                { 
                    'fitness.level': currentUser.fitness.level,
                    'fitness.exp': { $gt: currentUser.fitness.exp }
                }
            ]
        }) + 1;
        
        const embed = new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 피트니스 랭킹 TOP 10')
            .setDescription('레벨과 경험치 기준으로 순위가 결정됩니다.')
            .setTimestamp();
        
        // 랭킹 표시
        const rankEmojis = ['🥇', '🥈', '🥉'];
        const rankingText = topUsers.map((user, index) => {
            const rank = index + 1;
            const rankEmoji = rankEmojis[index] || `**${rank}.**`;
            const totalHours = Math.floor((user.fitness.totalExerciseTime || 0) / 3600000);
            
            // 현재 레벨 티어 확인
            let currentTier = null;
            for (const [level, tier] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
                if (user.fitness.level >= parseInt(level)) {
                    currentTier = tier;
                }
            }
            
            return `${rankEmoji} **${user.nickname || user.username}**\n` +
                   `　${currentTier.emoji} Lv.${user.fitness.level} | 운동 시간: ${totalHours}시간`;
        }).join('\n\n');
        
        embed.addFields({
            name: '🏅 명예의 전당',
            value: rankingText || '랭킹 정보가 없습니다.',
            inline: false
        });
        
        // 내 순위 표시
        if (currentUser && currentUser.fitness.level > 0) {
            
            let myTier = null;
            for (const [level, tier] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
                if (currentUser.fitness.level >= parseInt(level)) {
                    myTier = tier;
                }
            }
            
            embed.addFields({
                name: '📍 내 순위',
                value: `**${userRank}위** - ${myTier.emoji} Lv.${currentUser.fitness.level}`,
                inline: false
            });
        }
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('exercise_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        return await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
        
    } catch (error) {
        console.error('랭킹 조회 오류:', error);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({ 
                content: '❌ 랭킹을 불러오는 중 오류가 발생했습니다.',
                embeds: [],
                components: []
            });
        } else {
            return await interaction.reply({ 
                content: '❌ 랭킹을 불러오는 중 오류가 발생했습니다.', 
                flags: 64 
            });
        }
    }
}

// 운동 용품 구매
async function buyExerciseItem(interaction, itemIndex) {
    // 인터랙션 상태 확인
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: 64 });
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
        });
    }
    
    // showExerciseShop과 동일한 shopItems 배열 정의
    const shopItems = [
        // 🎫 특수 아이템
        { 
            name: '헬스장 VIP 회원권', 
            price: 100000000, // 1억
            emoji: '🎫', 
            description: '구독자 전용 혜택 - 골드로 구매 불가 (추후 구독자에게 지급 예정)',
            type: 'gym_pass',
            category: '특수'
        },
        { 
            name: '시간 연장권', 
            price: 300000000, // 3억
            emoji: '⏰', 
            description: '오늘 운동 시간 +60분 (즉시 적용)',
            type: 'time_extension',
            category: '특수'
        },
        { 
            name: '피로도 회복제', 
            price: 500000000, // 5억
            emoji: '💉', 
            description: '피로도 완전 회복 (100으로)',
            type: 'fatigue_reset',
            category: '특수'
        },
        
        // 🥤 보충제 카테고리
        { 
            name: '프로틴 쉐이크', 
            price: 200000000, // 2억
            emoji: '🥤', 
            description: '운동 효율 +20% (2시간)',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '슈퍼 프로틴', 
            price: 1000000000, // 10억
            emoji: '💪', 
            description: '운동 효율 +50% (4시간)',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '에너지 드링크', 
            price: 150000000, // 1.5억
            emoji: '🧃', 
            description: '즉시 피로도 -20',
            type: 'supplement',
            category: '보충제'
        },
        { 
            name: '울트라 에너지', 
            price: 800000000, // 8억
            emoji: '⚡', 
            description: '즉시 피로도 -50',
            type: 'supplement',
            category: '보충제'
        },
        
        // 👕 장비 카테고리 (영구)
        { 
            name: '운동복 세트', 
            price: 2000000000, // 20억
            emoji: '👕', 
            description: '모든 운동 효율 +10%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '프로 운동복 세트', 
            price: 5000000000, // 50억
            emoji: '🥋', 
            description: '모든 운동 효율 +25%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '러닝화', 
            price: 1500000000, // 15억
            emoji: '👟', 
            description: '유산소 운동 효율 +15%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '프로 러닝화', 
            price: 4000000000, // 40억
            emoji: '🏃', 
            description: '유산소 운동 효율 +35%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '스마트 워치', 
            price: 3000000000, // 30억
            emoji: '⌚', 
            description: '경험치 획득 +20%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '파워 벨트', 
            price: 8000000000, // 80억
            emoji: '🔗', 
            description: '힘 운동 효율 +40%',
            type: 'equipment',
            category: '장비'
        },
        { 
            name: '전설의 덤벨', 
            price: 10000000000, // 100억
            emoji: '🏆', 
            description: '모든 스탯 증가량 +50%',
            type: 'equipment',
            category: '장비'
        }
    ];
    
    const item = shopItems[itemIndex];
    
    if (!item) {
        return await interaction.editReply({ 
            content: '❌ 유효하지 않은 아이템입니다.'
        });
    }
    
    // 헬스장 VIP 회원권은 프리미엄 회원만 구매 가능
    if (item.name === '헬스장 VIP 회원권' && (!user.premium || user.premium.type !== 'premium')) {
        return await interaction.editReply({ 
            content: '❌ 헬스장 VIP 회원권은 프리미엄 회원만 구매할 수 있습니다!'
        });
    }
    
    // 구매 가능 여부 확인
    if (user.gold < item.price) {
        return await interaction.editReply({ 
            content: `❌ 골드가 부족합니다! (필요: ${formatNumber(item.price)}G, 보유: ${formatNumber(user.gold)}G)`
        });
    }
    
    // 장비류는 중복 구매 체크
    if (item.type === 'equipment') {
        const hasItem = user.fitness.exerciseInventory?.some(inv => inv.name === item.name) || false;
        if (hasItem) {
            return await interaction.editReply({ 
                content: '❌ 이미 보유한 아이템입니다!'
            });
        }
    }
    
    // 구매 처리
    user.gold -= item.price;
    
    // exerciseInventory 초기화 체크
    if (!user.fitness.exerciseInventory) {
        user.fitness.exerciseInventory = [];
    }
    
    // 아이템 효과 설정
    let effect = {};
    let expiresAt = null;
    
    switch(item.name) {
        // 특수 아이템
        case '헬스장 VIP 회원권':
            // 헬스장 운동 영구 해금
            if (!user.fitness.permanentGymAccess) {
                user.fitness.permanentGymAccess = true;
            }
            break;
        case '시간 연장권':
            // 오늘 사용한 운동 시간을 60분 차감
            const today = new Date().toDateString();
            const todayExercises = user.fitness.exerciseHistory.filter(
                ex => new Date(ex.date).toDateString() === today
            );
            
            if (todayExercises.length > 0) {
                // 가장 최근 운동 기록에서 60분(3600000ms) 차감
                const totalReduction = 60 * 60 * 1000; // 60분을 밀리초로
                let remainingReduction = totalReduction;
                
                // 최근 운동부터 시간 차감
                for (let i = todayExercises.length - 1; i >= 0 && remainingReduction > 0; i--) {
                    const exercise = todayExercises[i];
                    if (exercise.duration > remainingReduction) {
                        exercise.duration -= remainingReduction;
                        remainingReduction = 0;
                    } else {
                        remainingReduction -= exercise.duration;
                        // 운동 기록 자체를 제거
                        const index = user.fitness.exerciseHistory.findIndex(ex => 
                            ex.date === exercise.date && 
                            ex.exerciseType === exercise.exerciseType &&
                            ex.duration === exercise.duration
                        );
                        if (index > -1) {
                            user.fitness.exerciseHistory.splice(index, 1);
                        }
                    }
                }
            }
            break;
        case '피로도 회복제':
            // 피로도 완전 회복
            user.fitness.fatigue = 0;
            break;
            
        // 보충제류
        case '프로틴 쉐이크':
            effect = { efficiency: 1.2 }; // 20% 효율 증가
            expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2시간
            break;
        case '슈퍼 프로틴':
            effect = { efficiency: 1.5 }; // 50% 효율 증가
            expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4시간
            break;
        case '에너지 드링크':
            user.fitness.fatigue = Math.max(0, user.fitness.fatigue - 20);
            break;
        case '울트라 에너지':
            user.fitness.fatigue = Math.max(0, user.fitness.fatigue - 50);
            break;
            
        // 장비류 (영구)
        case '운동복 세트':
            effect = { allEfficiency: 1.1 }; // 10% 효율 증가
            break;
        case '프로 운동복 세트':
            effect = { allEfficiency: 1.25 }; // 25% 효율 증가
            break;
        case '러닝화':
            effect = { cardioEfficiency: 1.15 }; // 15% 유산소 효율 증가
            break;
        case '프로 러닝화':
            effect = { cardioEfficiency: 1.35 }; // 35% 유산소 효율 증가
            break;
        case '스마트 워치':
            effect = { expBonus: 1.2 }; // 경험치 20% 추가
            break;
        case '파워 벨트':
            effect = { strengthEfficiency: 1.4 }; // 힘 운동 40% 효율
            break;
        case '전설의 덤벨':
            effect = { statMultiplier: 1.5 }; // 모든 스탯 증가량 50% 추가
            break;
    }
    
    // 인벤토리에 추가 (즉시 사용 아이템 제외)
    const instantUseItems = ['에너지 드링크', '울트라 에너지', '시간 연장권', '피로도 회복제'];
    if (!instantUseItems.includes(item.name)) {
        user.fitness.exerciseInventory.push({
            name: item.name,
            type: item.type,
            emoji: item.emoji,
            effect: effect,
            expiresAt: expiresAt,
            purchasedAt: new Date(),
            equipped: item.type === 'equipment' ? true : false
        });
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🛒 구매 완료!')
        .setDescription(`${item.emoji} **${item.name}**을(를) 구매했습니다!`)
        .addFields(
            { name: '💰 가격', value: `${formatNumber(item.price)}G`, inline: true },
            { name: '💵 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
        );
    
    if (item.name === '에너지 드링크') {
        embed.addFields({ name: '😌 피로도', value: `${user.fitness.fatigue}/${MAX_FATIGUE} (-20)`, inline: true });
    } else if (item.name === '울트라 에너지') {
        embed.addFields({ name: '😌 피로도', value: `${user.fitness.fatigue}/${MAX_FATIGUE} (-50)`, inline: true });
    } else if (item.name === '시간 연장권') {
        const beforeUsed = getTodayUsedTime(user);
        const afterUsed = Math.max(0, beforeUsed - 60);
        const limit = getTodayTotalLimit(user);
        embed.addFields({ name: '⏰ 오늘 운동 시간', value: `사용 시간 -60분\n변경: ${beforeUsed}분 → ${afterUsed}분/${limit}분`, inline: true });
    } else if (item.name === '피로도 회복제') {
        embed.addFields({ name: '😌 피로도', value: `완전 회복! (0/${MAX_FATIGUE})`, inline: true });
    } else if (item.name === '헬스장 VIP 회원권') {
        embed.addFields({ name: '🎫 헬스장', value: `영구 이용 가능!`, inline: true });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_gym_shop')
                .setLabel('🔙 상점으로')
                .setStyle(ButtonStyle.Primary)
        );
    
    return await interaction.editReply({ 
        embeds: [embed],
        components: [buttons]
    });
}

// 운동 진행도 확인
async function checkExerciseProgress(interaction) {
    // 이미 interactionHandler에서 defer 처리됨
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered || !user.fitness || !user.fitness.currentExercise) {
        return await interaction.followUp({
            content: '❌ 진행 중인 운동이 없습니다!',
            flags: 64
        });
    }
    
    const currentExercise = user.fitness.currentExercise;
    const exercise = EXERCISE_SYSTEM.exercises[currentExercise.exerciseId];
    const now = Date.now();
    
    if (now >= currentExercise.endTime) {
        // 운동이 완료된 경우 자동으로 completeExercise 호출
        return await completeExercise(interaction);
    }
    
    const remainingTime = Math.ceil((currentExercise.endTime - now) / 60000);
    const progress = ((now - currentExercise.startTime) / (currentExercise.endTime - currentExercise.startTime)) * 100;
    
    const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
    
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(`${exercise.emoji} ${exercise.name} 진행 중`)
        .setDescription(`진행도: [${progressBar}] ${Math.floor(progress)}%`)
        .addFields(
            { name: '⏱️ 남은 시간', value: `${remainingTime}분`, inline: true },
            { name: '🏃 운동 시간', value: `${currentExercise.minutes}분`, inline: true }
        )
        .setFooter({ text: '운동이 자동으로 완료됩니다!' });
    
    return await interaction.followUp({
        embeds: [embed],
        flags: 64
    });
}

// 운동 완료 버튼 핸들러 (exercise_complete_early)
async function completeExerciseEarly(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered || !user.fitness || !user.fitness.currentExercise) {
        return await interaction.followUp({
            content: '❌ 진행 중인 운동이 없습니다!',
            flags: 64
        });
    }
    
    const currentExercise = user.fitness.currentExercise;
    const now = Date.now();
    
    // 운동이 이미 완료된 경우
    if (now >= currentExercise.endTime) {
        // completeExercise 함수 호출
        return await completeExercise(interaction);
    }
    
    // 조기 종료 확인
    const elapsedMinutes = Math.floor((now - currentExercise.startTime) / 60000);
    if (elapsedMinutes < 1) {
        return await interaction.followUp({
            content: '❌ 최소 1분은 운동해야 종료할 수 있습니다!',
            flags: 64
        });
    }
    
    // 조기 종료 처리
    return await completeExercise(interaction);
}

// 모달 제출 처리
async function handleExerciseModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const exerciseId = interaction.customId.split('_')[2];
    const minutes = parseInt(interaction.fields.getTextInputValue('exercise_minutes'));
    const user = await getUser(interaction.user.id);
    const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
    
    // 입력값 유효성 검사
    const remainingFatigue = MAX_FATIGUE - user.fitness.fatigue;
    if (isNaN(minutes) || minutes < 1 || minutes > remainingFatigue) {
        return await interaction.editReply({
            content: `❌ 잘못된 시간입니다! 1 ~ ${remainingFatigue}분 사이로 입력해주세요.`
        });
    }
    
    // 현재 운동 중인지 확인
    if (user.fitness?.currentExercise && user.fitness.currentExercise.endTime > Date.now()) {
        return await interaction.editReply({
            content: '❌ 이미 운동 중입니다!'
        });
    }
    
    // 운동 시작
    const startTime = Date.now();
    const endTime = startTime + (minutes * 60000);
    
    // 운동 상태 저장
    user.fitness.currentExercise = {
        exerciseId: exerciseId,
        startTime: startTime,
        endTime: endTime,
        minutes: minutes
    };
    await user.save();
    
    // 운동 시작 메시지
    const startEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle(`${exercise.emoji} ${exercise.name} 시작!`)
        .setDescription(`🏃 **${minutes}분** 동안 운동을 진행합니다!`)
        .addFields(
            { name: '⏰ 종료 시간', value: `<t:${Math.floor(endTime/1000)}:R>`, inline: true },
            { name: '😫 피로도 사용', value: `${minutes} / ${MAX_FATIGUE}`, inline: true }
        )
        .setFooter({ text: '운동이 끝나면 결과를 확인할 수 있습니다!' });
    
    const checkButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_check_progress')
                .setLabel('🔍 진행도 확인')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('exercise_complete_early')
                .setLabel('✅ 운동 종료')
                .setStyle(ButtonStyle.Success)
        );
    
    await interaction.editReply({
        embeds: [startEmbed],
        components: [checkButton]
    });
}

module.exports = {
    showExerciseMenu,
    executeExercise,
    showExerciseShop,
    showExerciseStats,
    showExerciseRanking,
    performExercise,
    buyExerciseItem,
    getTodayUsedTime,
    getTodayExerciseTime,
    checkExerciseProgress,
    completeExercise,
    completeExerciseEarly,
    handleExerciseModal
};