const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const EXERCISE_SYSTEM = require('../../data/exerciseSystem');
const GAME_GIFS = require('../../data/gameGifs');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../../utils/levelCapHelper');

// 피로도 업데이트
function updateFatigue(user) {
    const now = Date.now();
    const lastUpdate = user.fitness.lastFatigueUpdate || now;
    const timePassed = now - lastUpdate;
    
    // 10분당 1 피로도 회복
    const fatigueRecovered = Math.floor(timePassed / (10 * 60 * 1000));
    
    if (fatigueRecovered > 0) {
        user.fitness.fatigue = Math.max(0, user.fitness.fatigue - fatigueRecovered);
        user.fitness.lastFatigueUpdate = now;
    }
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
        await user.save();
    }
    
    // exerciseInventory 초기화 체크
    if (!user.fitness.exerciseInventory) {
        user.fitness.exerciseInventory = [];
        await user.save();
    }
    
    // 피로도 업데이트
    updateFatigue(user);
    
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
    
    let embedDescription = `**${currentTier.emoji} ${currentTier.name}** Lv.${user.fitness.level}\n\n오늘 운동 시간: ${todayMinutes}분`;
    
    if (isExercising) {
        const currentExercise = EXERCISE_SYSTEM.exercises[user.fitness.currentExercise.exerciseId];
        const remainingTime = Math.ceil((user.fitness.currentExercise.endTime - Date.now()) / 60000);
        embedDescription += `\n\n🏃 **현재 운동 중:** ${currentExercise?.emoji || '🏃'} ${currentExercise?.name || '운동'}\n⏱️ 남은 시간: ${remainingTime}분`;
    }
    
    const embed = new EmbedBuilder()
        .setColor(isExercising ? '#FFA500' : '#00ff7f')
        .setTitle('🏃 운동하기')
        .setDescription(embedDescription)
        .addFields(
            { name: '💪 근력', value: `${user.fitness.stats.strength}`, inline: true },
            { name: '🏃 체력', value: `${user.fitness.stats.stamina}`, inline: true },
            { name: '🧘 유연성', value: `${user.fitness.stats.flexibility}`, inline: true },
            { name: '⚡ 민첩', value: `${user.fitness.stats.agility}`, inline: true },
            { name: '🧠 정신력', value: `${user.fitness.stats.mental}`, inline: true },
            { name: '😫 피로도', value: `${user.fitness.fatigue}/${EXERCISE_SYSTEM.fatigue.maxFatigue}`, inline: true }
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
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const user = await getUser(interaction.user.id);
    const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
    
    if (!exercise) {
        return await interaction.reply({ 
            content: '❌ 잘못된 운동입니다!', 
            flags: 64 
        });
    }
    
    // 현재 운동 중인지 확인
    if (user.fitness?.currentExercise && user.fitness.currentExercise.endTime > Date.now()) {
        return await interaction.reply({ 
            content: '❌ 이미 운동 중입니다! 운동을 완료한 후 다시 시도해주세요.', 
            flags: 64 
        });
    }
    
    // 헬스장 운동 체크
    if (exercise.category === 'gym') {
        const hasGymPass = user.fitness?.exerciseInventory?.some(item => 
            item.name === '헬스장 일일 이용권' && 
            (!item.expiresAt || new Date(item.expiresAt) > new Date())
        ) || false;
        if (!hasGymPass) {
            return await interaction.reply({ 
                content: '❌ 헬스장 일일 이용권이 필요합니다!', 
                flags: 64 
            });
        }
    }
    
    // 현재 피로도 확인
    const currentFatigue = user.fitness.fatigue || 0;
    const remainingFatigue = EXERCISE_SYSTEM.fatigue.maxFatigue - currentFatigue;
    
    if (remainingFatigue <= 0) {
        return await interaction.reply({ 
            content: '😫 피로도가 최대치입니다! 휴식이 필요합니다.', 
            flags: 64 
        });
    }
    
    // 운동 시간 입력 모달
    const modal = new ModalBuilder()
        .setCustomId(`exercise_time_${exerciseId}`)
        .setTitle(`${exercise.emoji} ${exercise.name} 시간 설정`);
    
    const timeInput = new TextInputBuilder()
        .setCustomId('exercise_minutes')
        .setLabel('운동 시간 (분)')
        .setPlaceholder(`1 ~ ${remainingFatigue} 분`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4)
        .setValue(Math.min(30, remainingFatigue).toString());
    
    const row = new ActionRowBuilder().addComponents(timeInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
    // 모달 표시 후 여기서 함수 종료 - 실제 운동은 performExercise에서 처리
    return;
    
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
    
    equipment.forEach(equip => {
        if (equip.effect.allEfficiency) {
            efficiencyMultiplier *= equip.effect.allEfficiency;
        }
        if (equip.effect.cardioEfficiency && (exercise.category === 'basic' || exercise.id === 'treadmill' || exercise.id === 'spinning')) {
            efficiencyMultiplier *= equip.effect.cardioEfficiency;
        }
    });
    
    // 보상 계산
    const goldReward = Math.floor(exercise.rewards.goldPerMinute * minutes * efficiencyMultiplier);
    const expReward = Math.floor(exercise.rewards.expPerMinute * minutes * efficiencyMultiplier);
    const fitnessExpReward = Math.floor(exercise.rewards.fitnessExpPerMinute * minutes * efficiencyMultiplier);
    
    // 스탯 증가 계산
    const statGains = {};
    Object.entries(exercise.efficiency).forEach(([stat, value]) => {
        const statGain = Math.random() < (value * 0.3) ? 1 : 0; // 효율성에 따른 확률로 스탯 증가
        if (statGain > 0) {
            statGains[stat] = statGain;
            user.fitness.stats[stat] = (user.fitness.stats[stat] || 1) + statGain;
        }
    });
    
    // 피로도 증가
    const fatigueIncrease = Math.floor(exercise.fatigueRate * minutes);
    user.fitness.fatigue = Math.min(EXERCISE_SYSTEM.fatigue.maxFatigue, user.fitness.fatigue + fatigueIncrease);
    
    // 보상 지급
    user.gold += goldReward;
    // 레벨 100 체크 후 경험치 추가
    if (user.level < MAX_LEVEL) {
        user.exp += expReward;
    } else {
        expReward = 0; // 만렙인 경우 경험치 획득량 0으로 표시
    }
    user.fitness.exp += fitnessExpReward;
    user.fitness.totalExerciseTime += duration;
    
    // 레벨업 체크
    const requiredExp = user.fitness.level * 100;
    if (user.fitness.exp >= requiredExp) {
        user.fitness.level++;
        user.fitness.exp -= requiredExp;
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
    
    // 골드 획득 미션 업데이트
    if (goldReward > 0) {
        await MissionHelper.updateGoldEarned(interaction.user.id, goldReward);
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`${exercise.emoji} ${exercise.name} 완료!`)
        .setDescription(`${minutes}분 동안 운동했습니다!`)
        .setImage(GAME_GIFS.exercise.workout)
        .addFields(
            { name: '💰 골드', value: `+${formatNumber(goldReward)}G`, inline: true },
            { name: '⭐ 경험치', value: `+${expReward} EXP`, inline: true },
            { name: '💪 피트니스 EXP', value: `+${fitnessExpReward}`, inline: true },
            { name: '😫 피로도', value: `+${fatigueIncrease} (${user.fitness.fatigue}/${EXERCISE_SYSTEM.fatigue.maxFatigue})`, inline: true }
        );
    
    if (Object.keys(statGains).length > 0) {
        const statText = Object.entries(statGains)
            .map(([stat, gain]) => `${getStatEmoji(stat)} ${getStatName(stat)} +${gain}`)
            .join('\n');
        embed.addFields({ name: '📈 스탯 증가', value: statText, inline: false });
    }
    
    // 보충제/장비 효과 표시
    if (efficiencyMultiplier > 1.0) {
        embed.addFields({ 
            name: '🌟 보너스 효율', 
            value: `x${efficiencyMultiplier.toFixed(2)} (보충제/장비 효과)`, 
            inline: false 
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🏃 계속 운동')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.fitness.fatigue >= EXERCISE_SYSTEM.fatigue.maxFatigue - 10),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 운동 용품점
async function showExerciseShop(interaction) {
    // Defer if not already deferred
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isButton()) {
            await interaction.deferUpdate();
        } else {
            await interaction.deferReply({ flags: 64 });
        }
    }
    
    const user = await getUser(interaction.user.id);
    
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
    
    const shopItems = [
        { 
            name: '헬스장 일일 이용권', 
            price: 5000, 
            emoji: '🎫', 
            description: '헬스장 운동 1일 이용',
            type: 'gym_pass'
        },
        { 
            name: '프로틴 쉐이크', 
            price: 3000, 
            emoji: '🥤', 
            description: '운동 효율 +20% (2시간)',
            type: 'supplement'
        },
        { 
            name: '에너지 드링크', 
            price: 2000, 
            emoji: '🧃', 
            description: '즉시 피로도 -20',
            type: 'supplement'
        },
        { 
            name: '운동복 세트', 
            price: 10000, 
            emoji: '👕', 
            description: '모든 운동 효율 +10%',
            type: 'equipment'
        },
        { 
            name: '러닝화', 
            price: 15000, 
            emoji: '👟', 
            description: '유산소 운동 효율 +15%',
            type: 'equipment'
        }
    ];
    
    const embed = new EmbedBuilder()
        .setColor('#00ff7f')
        .setTitle('🏪 운동 용품점')
        .setDescription(`💰 보유 골드: ${formatNumber(user.gold)}G\n😫 현재 피로도: ${user.fitness.fatigue}/${EXERCISE_SYSTEM.fatigue.maxFatigue}`)
        .addFields(
            shopItems.map((item, index) => {
                // 보유 수량 확인
                const owned = user.fitness.exerciseInventory.filter(inv => inv.name === item.name);
                let ownedText = '';
                
                if (owned.length > 0) {
                    if (item.type === 'equipment') {
                        ownedText = ' ✅ 보유중';
                    } else {
                        const totalQuantity = owned.reduce((sum, inv) => sum + (inv.quantity || 1), 0);
                        ownedText = ` (보유: ${totalQuantity}개)`;
                    }
                }
                
                return {
                    name: `${item.emoji} ${item.name}${ownedText}`,
                    value: `${formatNumber(item.price)}G - ${item.description}`,
                    inline: false
                };
            })
        );
    
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
    
    const buttons = new ActionRowBuilder();
    shopItems.slice(0, 5).forEach((item, index) => {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(`exercise_buy_${index}`)
                .setLabel(item.emoji)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(user.gold < item.price)
        );
    });
    
    const backButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('exercise_inventory')
                .setLabel('🎒 인벤토리 관리')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('exercise_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons, backButton]
    });
}

// 스탯 이모지 헬퍼
function getStatEmoji(stat) {
    const emojis = {
        strength: '💪',
        stamina: '🏃',
        flexibility: '🧘',
        agility: '⚡',
        mental: '🧠'
    };
    return emojis[stat] || '📊';
}

// 스탯 이름 헬퍼
function getStatName(stat) {
    const names = {
        strength: '근력',
        stamina: '체력',
        flexibility: '유연성',
        agility: '민첩',
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
    
    // 피로도 업데이트
    updateFatigue(user);
    
    // 전체 운동 시간 계산
    const totalMinutes = Math.floor(user.fitness.totalExerciseTime / 60000);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    
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
                value: `${totalHours}시간 ${remainingMinutes}분`, 
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
    
    // 스탯 정보
    embed.addFields(
        { name: '\u200B', value: '**📈 피트니스 스탯**', inline: false },
        { name: '💪 근력', value: `${user.fitness.stats.strength}`, inline: true },
        { name: '🏃 체력', value: `${user.fitness.stats.stamina}`, inline: true },
        { name: '🧘 유연성', value: `${user.fitness.stats.flexibility}`, inline: true },
        { name: '⚡ 민첩', value: `${user.fitness.stats.agility}`, inline: true },
        { name: '🧠 정신력', value: `${user.fitness.stats.mental}`, inline: true },
        { name: '📊 총합', value: `${user.fitness.stats.strength + user.fitness.stats.stamina + user.fitness.stats.flexibility + user.fitness.stats.agility + user.fitness.stats.mental}`, inline: true }
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
    
    return await interaction.update({
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
        .select('username nickname fitness.level fitness.exp fitness.stats fitness.totalExerciseTime');
        
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
            const totalStats = user.fitness.stats.strength + user.fitness.stats.stamina + 
                             user.fitness.stats.flexibility + user.fitness.stats.agility + 
                             user.fitness.stats.mental;
            const totalHours = Math.floor((user.fitness.totalExerciseTime || 0) / 3600000);
            
            // 현재 레벨 티어 확인
            let currentTier = null;
            for (const [level, tier] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
                if (user.fitness.level >= parseInt(level)) {
                    currentTier = tier;
                }
            }
            
            return `${rankEmoji} **${user.nickname || user.username}**\n` +
                   `　${currentTier.emoji} Lv.${user.fitness.level} | 총 스탯: ${totalStats} | ${totalHours}시간`;
        }).join('\n\n');
        
        embed.addFields({
            name: '🏅 명예의 전당',
            value: rankingText || '랭킹 정보가 없습니다.',
            inline: false
        });
        
        // 내 순위 표시
        if (currentUser && currentUser.fitness.level > 0) {
            const myTotalStats = currentUser.fitness.stats.strength + currentUser.fitness.stats.stamina + 
                               currentUser.fitness.stats.flexibility + currentUser.fitness.stats.agility + 
                               currentUser.fitness.stats.mental;
            
            let myTier = null;
            for (const [level, tier] of Object.entries(EXERCISE_SYSTEM.levelTiers)) {
                if (currentUser.fitness.level >= parseInt(level)) {
                    myTier = tier;
                }
            }
            
            embed.addFields({
                name: '📍 내 순위',
                value: `**${userRank}위** - ${myTier.emoji} Lv.${currentUser.fitness.level} (총 스탯: ${myTotalStats})`,
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
    await interaction.deferReply({ flags: 64 });
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
        });
    }
    
    const items = EXERCISE_SYSTEM.shop.items;
    const item = items[itemIndex];
    
    if (!item) {
        return await interaction.editReply({ 
            content: '❌ 유효하지 않은 아이템입니다.'
        });
    }
    
    // 구매 가능 여부 확인
    if (user.gold < item.price) {
        return await interaction.editReply({ 
            content: `❌ 골드가 부족합니다! (필요: ${formatNumber(item.price)}G, 보유: ${formatNumber(user.gold)}G)`
        });
    }
    
    // 레벨 제한 확인
    if (item.requiredLevel && user.fitness.level < item.requiredLevel) {
        return await interaction.editReply({ 
            content: `❌ 레벨이 부족합니다! (필요: Lv.${item.requiredLevel})`
        });
    }
    
    // 이미 보유한 경우
    if (user.fitness.items.includes(item.id)) {
        return await interaction.editReply({ 
            content: '❌ 이미 보유한 아이템입니다!'
        });
    }
    
    // 구매 처리
    user.gold -= item.price;
    user.fitness.items.push(item.id);
    user.fitness.powerBoost += item.powerBoost;
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🛒 구매 완료!')
        .setDescription(`${item.emoji} **${item.name}**을(를) 구매했습니다!`)
        .addFields(
            { name: '💰 가격', value: `${formatNumber(item.price)}G`, inline: true },
            { name: '💪 파워 부스트', value: `+${item.powerBoost}%`, inline: true },
            { name: '💵 남은 골드', value: `${formatNumber(user.gold)}G`, inline: true }
        );
    
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

// 운동 수행 (모달 제출 처리 또는 진행도 확인에서 호출)
async function performExercise(interaction, exerciseType) {
    // defer 처리
    if (!interaction.deferred && !interaction.replied) {
        if (interaction.isModalSubmit()) {
            await interaction.deferReply({ flags: 64 });
        } else {
            await interaction.deferUpdate();
        }
    }
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
        });
    }
    
    const exercise = EXERCISE_SYSTEM.exercises[exerciseType];
    if (!exercise) {
        return await interaction.editReply({ 
            content: '❌ 유효하지 않은 운동입니다.'
        });
    }
    
    // 피로도 업데이트
    updateFatigue(user);
    
    let minutes;
    
    // 모달 제출인 경우
    if (interaction.isModalSubmit()) {
        const minutesInput = interaction.fields.getTextInputValue('exercise_minutes');
        minutes = parseInt(minutesInput);
        
        if (isNaN(minutes) || minutes < 1) {
            return await interaction.editReply({ 
                content: '❌ 올바른 운동 시간을 입력해주세요!'
            });
        }
    } 
    // 진행도 확인에서 호출된 경우 (currentExercise에서 시간 가져오기)
    else if (user.fitness?.currentExercise) {
        const now = Date.now();
        const currentExercise = user.fitness.currentExercise;
        const elapsedTime = now - currentExercise.startTime;
        minutes = Math.min(currentExercise.minutes, Math.floor(elapsedTime / 60000));
        
        if (minutes < 1) {
            return await interaction.editReply({ 
                content: '❌ 최소 1분은 운동해야 보상을 받을 수 있습니다!'
            });
        }
    } else {
        return await interaction.editReply({ 
            content: '❌ 오류: 운동 시간을 확인할 수 없습니다.'
        });
    }
    
    const currentFatigue = user.fitness.fatigue || 0;
    const remainingFatigue = EXERCISE_SYSTEM.fatigue.maxFatigue - currentFatigue;
    
    // 모달에서 호출된 경우만 피로도 검사
    if (interaction.isModalSubmit() && minutes > remainingFatigue) {
        return await interaction.editReply({ 
            content: `❌ 남은 피로도(${remainingFatigue})보다 많은 시간을 운동할 수 없습니다!`
        });
    }
    
    const duration = minutes * 60000; // 분을 밀리초로 변환
    const fatigueCost = minutes;
    
    // 헬스장 운동 체크
    if (exercise.category === 'gym') {
        const hasGymPass = user.fitness?.exerciseInventory?.some(item => 
            item.name === '헬스장 일일 이용권' && 
            (!item.expiresAt || new Date(item.expiresAt) > new Date())
        ) || false;
        if (!hasGymPass) {
            return await interaction.editReply({ 
                content: '❌ 헬스장 일일 이용권이 필요합니다!'
            });
        }
    }
    
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
    
    equipment.forEach(equip => {
        if (equip.effect.allEfficiency) {
            efficiencyMultiplier *= equip.effect.allEfficiency;
        }
        if (equip.effect.cardioEfficiency && (exercise.category === 'basic' || exercise.id === 'treadmill' || exercise.id === 'spinning')) {
            efficiencyMultiplier *= equip.effect.cardioEfficiency;
        }
    });
    
    // 보상 계산
    const goldReward = Math.floor(exercise.rewards.goldPerMinute * minutes * efficiencyMultiplier);
    const expReward = Math.floor(exercise.rewards.expPerMinute * minutes * efficiencyMultiplier);
    const fitnessExpReward = Math.floor(exercise.rewards.fitnessExpPerMinute * minutes * efficiencyMultiplier);
    
    // 스탯 증가 계산
    const statGains = {};
    Object.entries(exercise.efficiency).forEach(([stat, value]) => {
        const statGain = Math.random() < (value * 0.3) ? 1 : 0; // 효율성에 따른 확률로 스탯 증가
        if (statGain > 0) {
            statGains[stat] = statGain;
            user.fitness.stats[stat] = (user.fitness.stats[stat] || 1) + statGain;
        }
    });
    
    // 피로도 증가
    const fatigueIncrease = Math.floor(exercise.fatigueRate * minutes);
    user.fitness.fatigue = Math.min(EXERCISE_SYSTEM.fatigue.maxFatigue, user.fitness.fatigue + fatigueIncrease);
    
    // 보상 지급
    user.gold += goldReward;
    // 레벨 100 체크 후 경험치 추가
    if (user.level < MAX_LEVEL) {
        user.exp += expReward;
    } else {
        expReward = 0; // 만렙인 경우 경험치 획득량 0으로 표시
    }
    user.fitness.exp += fitnessExpReward;
    user.fitness.totalExerciseTime += duration;
    
    // 레벨업 체크
    const requiredExp = user.fitness.level * 100;
    if (user.fitness.exp >= requiredExp) {
        user.fitness.level++;
        user.fitness.exp -= requiredExp;
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
    
    // 운동 상태 초기화 (중요! 운동 완료 처리)
    user.fitness.currentExercise = null;
    delete user.fitness.isExercising;  // isExercising 필드 제거
    
    // 일일 미션 업데이트
    await User.updateOne(
        { discordId: interaction.user.id },
        { $inc: { 'dailyMissions.exercise.current': minutes } }
    );
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`${exercise.emoji} ${exercise.name} 완료!`)
        .setDescription(`${minutes}분 동안 운동했습니다!`)
        .setImage(GAME_GIFS.exercise.workout)
        .addFields(
            { name: '💰 골드', value: `+${formatNumber(goldReward)}G`, inline: true },
            { name: '⭐ 경험치', value: `+${expReward} EXP`, inline: true },
            { name: '💪 피트니스 EXP', value: `+${fitnessExpReward}`, inline: true },
            { name: '😫 피로도', value: `+${fatigueIncrease} (${user.fitness.fatigue}/${EXERCISE_SYSTEM.fatigue.maxFatigue})`, inline: true }
        );
    
    if (Object.keys(statGains).length > 0) {
        const statText = Object.entries(statGains)
            .map(([stat, gain]) => `${getStatEmoji(stat)} ${getStatName(stat)} +${gain}`)
            .join('\n');
        embed.addFields({ name: '📈 스탯 증가', value: statText, inline: false });
    }
    
    return await interaction.editReply({
        embeds: [embed]
    });
}

// 운동 진행도 확인
async function checkExerciseProgress(interaction) {
    await interaction.deferUpdate();
    
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
        // 운동이 완료된 경우 자동으로 performExercise 호출
        return await performExercise(interaction, currentExercise.exerciseId);
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

// 운동 조기 완료
async function completeExercise(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered || !user.fitness || !user.fitness.currentExercise) {
        return await interaction.followUp({
            content: '❌ 진행 중인 운동이 없습니다!',
            flags: 64
        });
    }
    
    // 운동 상태 초기화
    user.fitness.currentExercise = null;
    await user.save();
    
    await interaction.followUp({
        content: '✅ 운동을 완료했습니다!',
        flags: 64
    });
    
    // 운동 메뉴로 돌아가기
    return await showExerciseMenu(interaction);
}

// 모달 제출 처리
async function handleExerciseModal(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const exerciseId = interaction.customId.split('_')[2];
    const minutes = parseInt(interaction.fields.getTextInputValue('exercise_minutes'));
    const user = await getUser(interaction.user.id);
    const exercise = EXERCISE_SYSTEM.exercises[exerciseId];
    
    // 입력값 유효성 검사
    const remainingFatigue = EXERCISE_SYSTEM.fatigue.maxFatigue - user.fitness.fatigue;
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
            { name: '😫 피로도 사용', value: `${minutes} / ${EXERCISE_SYSTEM.fatigue.maxFatigue}`, inline: true }
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
    updateFatigue,
    getTodayExerciseTime,
    checkExerciseProgress,
    completeExercise,
    handleExerciseModal
};