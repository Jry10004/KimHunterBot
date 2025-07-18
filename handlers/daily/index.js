const { showAttendanceMenu, claimDailyReward, showAttendanceRanking } = require('./attendance');
const { showHuntingMenu, executeHunt } = require('./hunting');
const { showExerciseMenu, executeExercise, showExerciseShop, showExerciseStats, showExerciseRanking, performExercise, buyExerciseItem, checkExerciseProgress, completeExercise, completeExerciseEarly, getTodayUsedTime } = require('./exercise');
const { showQuestMenu, showDailyQuests, acceptQuest, claimQuestRewards } = require('./quest');
const { showAppraisalMenu, executeAppraisal } = require('./lootAppraisal');
const { showTournamentMenu, showWeeklyRanking, startSpeedHunt, executeSpeedHunt } = require('./huntingTournament');
const { greetAppraiser, showMarketPrices, showCategoryPrices, sellItems, showPriceChart, executeSell } = require('./appraiserInteraction');
const { showWarehouse, depositToWarehouse, executeDeposit, withdrawFromWarehouse, showCertificates } = require('./appraisalWarehouse');
const { sellFromWarehouse, withdrawToInventory, createCertificate, payWarehouseFee } = require('./warehouseTrade');
const { showStrategyMenu, selectStrategy, applyStrategy, showPredictions, upgradeWarehouse } = require('./warehouseStrategy');
const { showMarketPrices: showMarketCenter, handleMarketInteraction } = require('./lootMarket');
const { getUser } = require('../common/utils');
const { EXERCISE_SYSTEM } = require('../../data/exerciseSystem');
const { showDailyMissions, showWeeklyMissions, claimDailyMissionReward, claimWeeklyMissionReward } = require('./missions');
const { showLockerRoom, showEquipmentManagement, showSupplementMenu, handleEquipmentSelection, handleSupplementUse } = require('./lockerRoom');

// 일일 활동 인터랙션 핸들러
async function handleDailyInteraction(interaction) {
    const customId = interaction.customId;
    
    // 일일활동 메뉴
    if (customId === 'daily') {
        return await showDailyMenu(interaction);
    }
    
    // 일일미션 관련
    else if (customId === 'daily_missions') {
        return await showDailyMissions(interaction);
    } else if (customId === 'weekly_missions') {
        return await showWeeklyMissions(interaction);
    } else if (customId === 'claim_daily_mission_reward') {
        return await claimDailyMissionReward(interaction);
    } else if (customId === 'claim_weekly_mission_reward') {
        return await claimWeeklyMissionReward(interaction);
    }
    
    // 출석 관련
    else if (customId === 'attendance' || customId === 'attendance_menu') {
        return await showAttendanceMenu(interaction);
    } else if (customId === 'claim_daily_reward') {
        return await claimDailyReward(interaction);
    } else if (customId === 'attendance_ranking') {
        return await showAttendanceRanking(interaction);
    }
    
    // 사냥 관련
    else if (customId === 'hunting') {
        return await showHuntingMenu(interaction);
    } else if (customId.startsWith('hunting_prev_')) {
        const currentPage = parseInt(customId.replace('hunting_prev_', ''));
        const newPage = Math.max(0, currentPage - 1);
        return await showHuntingMenu(interaction, newPage);
    } else if (customId.startsWith('hunting_next_')) {
        const currentPage = parseInt(customId.replace('hunting_next_', ''));
        const newPage = currentPage + 1;
        return await showHuntingMenu(interaction, newPage);
    } else if (customId.startsWith('hunt_area_')) {
        // 즉시 defer 처리
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }
        } catch (error) {
            if (error.code === 10062) {
                console.log('[Hunt] Interaction expired');
                return;
            }
        }
        const areaId = customId.replace('hunt_area_', '');
        return await executeHunt(interaction, areaId);
    }
    
    // 전리품 감정 관련
    else if (customId === 'appraisal_menu') {
        return await showAppraisalMenu(interaction);
    } else if (customId === 'appraise_single') {
        return await executeAppraisal(interaction, 1);
    } else if (customId === 'appraise_bulk') {
        return await executeAppraisal(interaction, 10);
    } else if (customId === 'appraise_all') {
        const user = await getUser(interaction.user.id);
        const count = user.lootAppraisal?.unidentifiedItems?.length || 0;
        return await executeAppraisal(interaction, count);
    }
    
    // 사냥 토너먼트 관련
    else if (customId === 'tournament_menu') {
        return await showTournamentMenu(interaction);
    } else if (customId === 'tournament_weekly') {
        return await showWeeklyRanking(interaction);
    } else if (customId === 'tournament_speed') {
        return await startSpeedHunt(interaction);
    } else if (customId.startsWith('speed_hunt_start_')) {
        const parts = customId.replace('speed_hunt_start_', '').split('_');
        const areaId = parts[0];
        const targetName = parts.slice(1).join('_');
        return await executeSpeedHunt(interaction, areaId, targetName);
    } else if (customId === 'tournament_rewards') {
        // 보상 확인 (추후 구현)
        return await interaction.reply({ content: '🎁 보상 시스템은 준비 중입니다!', flags: 64 });
    }
    
    // 운동 관련
    else if (customId === 'work' || customId === 'exercise_menu') {
        return await showExerciseMenu(interaction);
    } else if (customId === 'exercise_gym_shop') {
        console.log('[Daily Handler] Processing exercise_gym_shop interaction');
        try {
            return await showExerciseShop(interaction);
        } catch (error) {
            console.error('[Daily Handler] Error in showExerciseShop:', error);
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    content: '❌ 운동 용품점을 여는 중 오류가 발생했습니다.',
                    flags: 64
                });
            } else {
                return await interaction.editReply({
                    content: '❌ 운동 용품점을 여는 중 오류가 발생했습니다.'
                });
            }
        }
    } else if (customId === 'exercise_stats') {
        return await showExerciseStats(interaction);
    } else if (customId === 'exercise_ranking') {
        return await showExerciseRanking(interaction);
    } else if (customId.startsWith('exercise_buy_')) {
        // 운동 용품 구매 처리
        const itemIndex = parseInt(customId.replace('exercise_buy_', ''));
        return await buyExerciseItem(interaction, itemIndex);
    } else if (customId.startsWith('exercise_time_')) {
        // 운동 시간 선택 처리
        const exerciseType = customId.replace('exercise_time_', '');
        return await performExercise(interaction, exerciseType);
    } else if (customId === 'exercise_check_progress') {
        return await checkExerciseProgress(interaction);
    } else if (customId === 'exercise_complete_early') {
        return await completeExerciseEarly(interaction);
    } else if (customId === 'exercise_inventory') {
        return await showLockerRoom(interaction);
    } else if (customId === 'locker_equip_manage') {
        return await showEquipmentManagement(interaction);
    } else if (customId === 'locker_use_supplement') {
        return await showSupplementMenu(interaction);
    }
    
    // 퀘스트 관련
    else if (customId === 'quest' || customId === 'quest_menu') {
        return await showQuestMenu(interaction);
    } else if (customId === 'quest_daily') {
        return await showDailyQuests(interaction);
    } else if (customId === 'quest_rewards') {
        return await claimQuestRewards(interaction);
    } else if (customId === 'quest_accept_daily') {
        // 일일 퀘스트 일괄 수락
        return await acceptAllDailyQuests(interaction);
    }
    
    // 감정사 관련
    else if (customId === 'appraiser_greet') {
        return await greetAppraiser(interaction);
    } else if (customId === 'appraiser_market') {
        return await showMarketPrices(interaction);
    } else if (customId === 'appraiser_sell') {
        return await sellItems(interaction);
    } else if (customId === 'appraiser_chart') {
        return await showPriceChart(interaction);
    } else if (customId === 'appraiser_detailed_chart') {
        return await showPriceChart(interaction);
    } else if (customId === 'appraiser_appraise') {
        return await showAppraisalMenu(interaction);
    } else if (customId === 'appraiser_sell_all') {
        return await executeSell(interaction, [], true);
    } else if (customId === 'appraiser_warehouse' || customId === 'warehouse_main') {
        return await showWarehouse(interaction);
    } else if (customId === 'warehouse_deposit') {
        return await depositToWarehouse(interaction);
    } else if (customId === 'warehouse_withdraw') {
        return await withdrawFromWarehouse(interaction);
    } else if (customId === 'warehouse_certificate' || customId === 'appraiser_certificate') {
        return await showCertificates(interaction);
    }
    
    // 창고 거래 관련
    else if (customId === 'warehouse_sell_selected') {
        const selectedIndices = interaction.values.map(v => parseInt(v));
        return await sellFromWarehouse(interaction, selectedIndices);
    } else if (customId === 'warehouse_withdraw_selected') {
        const selectedIndices = interaction.values.map(v => parseInt(v));
        return await withdrawToInventory(interaction, selectedIndices);
    } else if (customId === 'warehouse_pay_fee') {
        return await payWarehouseFee(interaction);
    } else if (customId === 'warehouse_sell_certificate') {
        // 증서 현금화 (추후 구현)
        return await interaction.reply({ content: '📜 증서 현금화는 준비 중입니다!', flags: 64 });
    }
    
    // 시세 확인 관련
    else if (customId === 'market_prices') {
        return await showMarketCenter(interaction);
    } else if (customId.startsWith('market_')) {
        return await handleMarketInteraction(interaction);
    }
    
    // 창고 전략 관련
    else if (customId === 'warehouse_strategy') {
        return await showStrategyMenu(interaction);
    } else if (customId === 'strategy_remove_all') {
        // 모든 전략 제거 (간단한 구현)
        const user = await getUser(interaction.user.id);
        user.appraisalWarehouse.items.forEach(item => {
            item.strategy = null;
        });
        await user.save();
        return await showStrategyMenu(interaction);
    } else if (customId === 'warehouse_upgrade') {
        return await upgradeWarehouse(interaction);
    } else if (customId.startsWith('confirm_warehouse_upgrade_')) {
        const grade = customId.replace('confirm_warehouse_upgrade_', '');
        const user = await getUser(interaction.user.id);
        const { APPRAISAL_STOCK } = require('../../data/appraisalStock');
        const upgradeCost = APPRAISAL_STOCK.warehouseGrades[grade].upgradeCost;
        
        if (user.gold >= upgradeCost) {
            user.gold -= upgradeCost;
            user.appraisalWarehouse.grade = grade;
            user.appraisalWarehouse.slots = APPRAISAL_STOCK.warehouseGrades[grade].slots;
            await user.save();
            return await showWarehouse(interaction);
        }
    } else if (customId.startsWith('apply_strategy_')) {
        const parts = customId.replace('apply_strategy_', '').split('_');
        const strategyName = parts[0];
        const itemIndices = parts.slice(1).join('_');
        return await applyStrategy(interaction, strategyName, itemIndices);
    } else if (customId.startsWith('toggle_lock_')) {
        const itemIndices = customId.replace('toggle_lock_', '').split(',');
        const user = await getUser(interaction.user.id);
        itemIndices.forEach(idx => {
            const item = user.appraisalWarehouse.items[parseInt(idx)];
            if (item) item.locked = !item.locked;
        });
        await user.save();
        return await selectStrategy(interaction, itemIndices);
    } else if (customId.startsWith('remove_strategy_')) {
        const itemIndices = customId.replace('remove_strategy_', '').split(',');
        const user = await getUser(interaction.user.id);
        itemIndices.forEach(idx => {
            const item = user.appraisalWarehouse.items[parseInt(idx)];
            if (item) item.strategy = null;
        });
        await user.save();
        return await showStrategyMenu(interaction);
    }
    
    // 운동 시간 선택 버튼 처리
    else if (customId.startsWith('exercise_start_')) {
        const parts = customId.split('_');
        const exerciseId = parts[2];
        const minutes = parseInt(parts[3]);
        const { performExercise } = require('./exercise');
        return await performExercise(interaction, exerciseId, minutes);
    } else if (customId === 'exercise_cancel') {
        return await showExerciseMenu(interaction);
    } else if (customId.startsWith('exercise_custom_')) {
        const exerciseId = customId.replace('exercise_custom_', '');
        // 사용자 정의 시간 입력을 위한 모달 표시
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const user = await getUser(interaction.user.id);
        const todayUsedMinutes = getTodayUsedTime(user);
        const userType = user.premium?.type || 'basic';
        const dailyLimit = EXERCISE_SYSTEM.dailyLimits[userType] || 60;
        const remainingMinutes = dailyLimit - todayUsedMinutes;
        
        const modal = new ModalBuilder()
            .setCustomId(`exercise_time_${exerciseId}`)
            .setTitle('운동 시간 입력');
        
        const timeInput = new TextInputBuilder()
            .setCustomId('exercise_minutes')
            .setLabel('운동 시간 (분)')
            .setPlaceholder(`1 ~ ${remainingMinutes} 분`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3)
            .setValue('30');
        
        const row = new ActionRowBuilder().addComponents(timeInput);
        modal.addComponents(row);
        
        return await interaction.showModal(modal);
    }
    
    // 드롭다운 메뉴 처리
    else if (interaction.isStringSelectMenu()) {
        if (customId === 'exercise_select') {
            const exerciseId = interaction.values[0];
            return await executeExercise(interaction, exerciseId);
        } else if (customId === 'appraiser_category_select') {
            const categoryId = interaction.values[0];
            return await showCategoryPrices(interaction, categoryId);
        } else if (customId === 'appraiser_sell_select') {
            const selectedIndices = interaction.values;
            return await executeSell(interaction, selectedIndices);
        } else if (customId === 'warehouse_deposit_select') {
            const selectedIndices = interaction.values;
            return await executeDeposit(interaction, selectedIndices);
        } else if (customId === 'strategy_item_select') {
            const itemIndices = interaction.values;
            return await selectStrategy(interaction, itemIndices);
        } else if (customId === 'certificate_create_select') {
            const certificateName = interaction.values[0];
            return await createCertificate(interaction, certificateName);
        } else if (customId === 'market_type_select') {
            const { handleMarketInteraction } = require('./lootMarket');
            return await handleMarketInteraction(interaction);
        } else if (customId === 'market_category_select') {
            const { handleMarketInteraction } = require('./lootMarket');
            return await handleMarketInteraction(interaction);
        } else if (customId === 'locker_equip_select') {
            return await handleEquipmentSelection(interaction);
        } else if (customId === 'locker_supplement_select') {
            return await handleSupplementUse(interaction);
        }
    }
}

// 일일 퀘스트 일괄 수락
async function acceptAllDailyQuests(interaction) {
    const User = require('../../models/User');
    const { getUser } = require('../common/utils');
    const { QUEST_SYSTEM } = require('../../data/questSystem');
    const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
    
    const user = await getUser(interaction.user.id);
    const dailyQuests = QUEST_SYSTEM.daily;
    let acceptedCount = 0;
    
    for (const quest of dailyQuests) {
        // 이미 진행 중이 아닌 퀘스트만 수락
        if (!user.activeQuests.some(q => q.questId === quest.id)) {
            user.activeQuests.push({
                questId: quest.id,
                category: 'daily',
                progress: 0,
                startDate: new Date()
            });
            acceptedCount++;
        }
    }
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📅 일일 퀘스트 수락!')
        .setDescription(`${acceptedCount}개의 일일 퀘스트를 수락했습니다!`)
        .setFooter({ text: '퀘스트를 완료하고 보상을 받으세요!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_menu')
                .setLabel('📜 퀘스트 목록')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 일일활동 메뉴
async function showDailyMenu(interaction) {
    // interaction이 이미 처리되지 않았다면 defer
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
    }
    
    const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
    const DailyMission = require('../../models/DailyMission');
    const user = await getUser(interaction.user.id);
    
    if (!user || !user.registered) {
        return await interaction.editReply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.'
        });
    }
    
    // 일일미션 데이터 가져오기 또는 생성
    let missionData = await DailyMission.findOne({ userId: interaction.user.id });
    if (!missionData) {
        missionData = new DailyMission({ userId: interaction.user.id });
        await missionData.save();
    }
    
    // 리셋 체크
    missionData.resetDaily();
    missionData.resetWeekly();
    await missionData.save();
    
    // 진행률 계산
    const dailyProgress = Math.floor((missionData.dailyCompletedCount / 10) * 100);
    const weeklyProgress = Math.floor((missionData.weeklyCompletedCount / 6) * 100);
    
    // 보상 정보
    const dailyReward = missionData.dailyCompletedCount >= 10 && !missionData.dailyRewardClaimed;
    const weeklyReward = missionData.weeklyCompletedCount >= 6 && !missionData.weeklyRewardClaimed;
    
    const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setAuthor({ 
            name: `${interaction.user.username}의 일일활동`, 
            iconURL: interaction.user.displayAvatarURL() 
        })
        .setTitle('📅 일일활동 센터')
        .setDescription('매일 미션을 완료하고 풍성한 보상을 받아가세요!')
        .addFields(
            { 
                name: '📊 오늘의 진행도', 
                value: `${'█'.repeat(Math.floor(dailyProgress/10))}${'░'.repeat(10-Math.floor(dailyProgress/10))} ${dailyProgress}%\n완료: ${missionData.dailyCompletedCount}/10 미션`, 
                inline: false 
            },
            { 
                name: '📈 주간 진행도', 
                value: `${'█'.repeat(Math.floor(weeklyProgress/10))}${'░'.repeat(10-Math.floor(weeklyProgress/10))} ${weeklyProgress}%\n완료: ${missionData.weeklyCompletedCount}/6 미션`, 
                inline: false 
            },
            { 
                name: '🔥 연속 출석', 
                value: `${missionData.dailyStreak}일 연속`, 
                inline: true 
            },
            { 
                name: '💰 일일 보상', 
                value: dailyReward ? '✅ 수령 가능!' : missionData.dailyRewardClaimed ? '✓ 수령 완료' : '🔒 미완료', 
                inline: true 
            },
            { 
                name: '💎 주간 보상', 
                value: weeklyReward ? '✅ 수령 가능!' : missionData.weeklyRewardClaimed ? '✓ 수령 완료' : '🔒 미완료', 
                inline: true 
            }
        )
        .setThumbnail('https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif')
        .setFooter({ 
            text: `일일 리셋: 매일 자정 | 주간 리셋: 매주 월요일`, 
            iconURL: interaction.client.user.displayAvatarURL() 
        })
        .setTimestamp();
    
    // 보상 수령 가능한 경우 반짝이는 효과 추가
    if (dailyReward || weeklyReward) {
        embed.setImage('https://media.giphy.com/media/3o7TKU8RvQuomFfUUU/giphy.gif');
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('attendance')
                .setLabel('📅 출석체크')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✨'),
            new ButtonBuilder()
                .setCustomId('daily_missions')
                .setLabel('🎯 일일미션')
                .setStyle(ButtonStyle.Success)
                .setEmoji(dailyReward ? '🎁' : '📋'),
            new ButtonBuilder()
                .setCustomId('weekly_missions')
                .setLabel('🏆 주간미션')
                .setStyle(ButtonStyle.Success)
                .setEmoji(weeklyReward ? '💎' : '📊'),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('메인메뉴')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏠')
        );
    
    // interaction이 이미 deferred된 경우 editReply 사용
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
            embeds: [embed],
            components: [buttons]
        });
    } else {
        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            flags: 64
        });
    }
}

module.exports = {
    handleDailyInteraction
};