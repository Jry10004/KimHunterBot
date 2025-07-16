const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { QUEST_SYSTEM } = require('../../data/questSystem');
const MissionHelper = require('../../utils/missionHelper');
const { MAX_LEVEL, canGainExperience, addExperienceSafely } = require('../../utils/levelCapHelper');

// 퀘스트 메인 메뉴
async function showQuestMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }

    // 활성 퀘스트 초기화
    if (!user.activeQuests) {
        user.activeQuests = [];
    }
    
    // 일일 퀘스트 갱신
    refreshDailyQuests(user);
    
    const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('📜 퀘스트')
        .setDescription('다양한 퀘스트를 완료하고 보상을 획득하세요!');
    
    // 활성 퀘스트 표시
    if (user.activeQuests.length > 0) {
        const questList = user.activeQuests.map(q => {
            const quest = QUEST_SYSTEM[q.category].find(quest => quest.id === q.questId);
            if (!quest) return null;
            
            const progress = Math.min(q.progress, quest.requirement);
            const isComplete = q.progress >= quest.requirement;
            const icon = isComplete ? '✅' : '🔄';
            
            return `${icon} **${quest.name}**\n　　${quest.description}\n　　진행도: ${progress}/${quest.requirement}`;
        }).filter(q => q !== null).join('\n\n');
        
        embed.addFields({ 
            name: '📋 진행 중인 퀘스트', 
            value: questList || '없음', 
            inline: false 
        });
    } else {
        embed.addFields({ 
            name: '📋 진행 중인 퀘스트', 
            value: '진행 중인 퀘스트가 없습니다.', 
            inline: false 
        });
    }
    
    // 퀘스트 통계
    const completedQuests = user.completedQuests || [];
    embed.addFields(
        { name: '📊 완료한 퀘스트', value: `${completedQuests.length}개`, inline: true },
        { name: '🎖️ 퀘스트 포인트', value: `${user.questPoints || 0}점`, inline: true }
    );
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_daily')
                .setLabel('📅 일일 퀘스트')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('quest_weekly')
                .setLabel('📆 주간 퀘스트')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('quest_special')
                .setLabel('⭐ 특별 퀘스트')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('quest_rewards')
                .setLabel('🎁 보상 수령')
                .setStyle(ButtonStyle.Success),
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

// 일일 퀘스트 표시
async function showDailyQuests(interaction) {
    const user = await getUser(interaction.user.id);
    const dailyQuests = QUEST_SYSTEM.daily;
    
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('📅 일일 퀘스트')
        .setDescription('매일 오전 5시에 초기화됩니다.');
    
    dailyQuests.forEach(quest => {
        const userQuest = user.activeQuests.find(q => q.questId === quest.id);
        const progress = userQuest ? userQuest.progress : 0;
        const isComplete = progress >= quest.requirement;
        const isAccepted = userQuest !== undefined;
        
        embed.addFields({
            name: `${isComplete ? '✅' : '🔄'} ${quest.name}`,
            value: `${quest.description}\n진행도: ${progress}/${quest.requirement}\n보상: ${formatRewards(quest.rewards)}`,
            inline: false
        });
    });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('quest_accept_daily')
                .setLabel('📝 퀘스트 수락')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('quest_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 퀘스트 수락
async function acceptQuest(interaction, category, questId) {
    const user = await getUser(interaction.user.id);
    const quest = QUEST_SYSTEM[category].find(q => q.id === questId);
    
    if (!quest) {
        return await interaction.reply({ 
            content: '❌ 퀘스트를 찾을 수 없습니다!', 
            flags: 64 
        });
    }
    
    // 이미 진행 중인지 확인
    if (user.activeQuests.some(q => q.questId === questId)) {
        return await interaction.reply({ 
            content: '❌ 이미 진행 중인 퀘스트입니다!', 
            flags: 64 
        });
    }
    
    // 퀘스트 추가
    user.activeQuests.push({
        questId: quest.id,
        category: category,
        progress: 0,
        startDate: new Date()
    });
    
    await user.save();
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📜 퀘스트 수락!')
        .setDescription(`**${quest.name}** 퀘스트를 시작했습니다!`)
        .addFields(
            { name: '📋 목표', value: quest.description, inline: false },
            { name: '🎁 보상', value: formatRewards(quest.rewards), inline: false }
        );
    
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
    
    return await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 퀘스트 보상 수령
async function claimQuestRewards(interaction) {
    const user = await getUser(interaction.user.id);
    const completedQuests = [];
    
    // 완료된 퀘스트 확인
    for (const userQuest of user.activeQuests) {
        const quest = QUEST_SYSTEM[userQuest.category].find(q => q.id === userQuest.questId);
        if (quest && userQuest.progress >= quest.requirement) {
            completedQuests.push({ userQuest, quest });
        }
    }
    
    if (completedQuests.length === 0) {
        return await interaction.reply({ 
            content: '❌ 완료된 퀘스트가 없습니다!', 
            flags: 64 
        });
    }
    
    let totalRewards = {
        gold: 0,
        exp: 0,
        items: [],
        bonusGold: 0
    };
    
    // 보상 지급
    for (const { userQuest, quest } of completedQuests) {
        // 골드 보상
        if (quest.rewards.gold) {
            // 버그 사냥꾼 칭호 효과 적용
            const { applyGoldBonus } = require('../common/specialEffects');
            const originalGold = quest.rewards.gold;
            const finalGold = applyGoldBonus(quest.rewards.gold, user);
            
            if (finalGold > originalGold) {
                totalRewards.bonusGold += (finalGold - originalGold);
                console.log(`[Quest] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalGold} → ${finalGold} (+${finalGold - originalGold})`);
            }
            
            totalRewards.gold += finalGold;
            user.gold += finalGold;
        }
        
        // 경험치 보상
        if (quest.rewards.exp) {
            // 만렙 체크 후 경험치 추가
            if (user.level < MAX_LEVEL) {
                user.exp += quest.rewards.exp;
                totalRewards.exp += quest.rewards.exp;
            } else {
                // 만렙인 경우 보상 표시를 0으로
                totalRewards.exp += 0;
            }
        }
        
        // 아이템 보상
        if (quest.rewards.items) {
            for (const item of quest.rewards.items) {
                totalRewards.items.push(item);
                user.inventory.push({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity || 1,
                    category: 'quest_reward'
                });
            }
        }
        
        // 퀘스트 포인트
        user.questPoints = (user.questPoints || 0) + (quest.rewards.questPoints || 10);
        
        // 완료 목록에 추가
        if (!user.completedQuests) user.completedQuests = [];
        user.completedQuests.push({
            questId: quest.id,
            completedDate: new Date()
        });
        
        // 활성 퀘스트에서 제거
        user.activeQuests = user.activeQuests.filter(q => q.questId !== userQuest.questId);
    }
    
    await user.save();
    
    // 골드 획득 미션 업데이트
    if (totalRewards.gold > 0) {
        await MissionHelper.updateGoldEarned(interaction.user.id, totalRewards.gold);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎁 퀘스트 보상 수령!')
        .setDescription(`${completedQuests.length}개의 퀘스트를 완료했습니다!` +
            (totalRewards.bonusGold > 0 ? `\n\n🏷️ **버그 사냥꾼 칭호 효과** +${formatNumber(totalRewards.bonusGold)}G` : ''))
        .addFields(
            { name: '💰 골드', value: `+${formatNumber(totalRewards.gold)}G`, inline: true },
            { name: '⭐ 경험치', value: `+${totalRewards.exp} EXP`, inline: true }
        );
    
    if (totalRewards.items.length > 0) {
        const itemText = totalRewards.items.map(item => `${item.emoji || '📦'} ${item.name} x${item.quantity || 1}`).join('\n');
        embed.addFields({ name: '🎁 아이템', value: itemText, inline: false });
    }
    
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
    
    return await interaction.reply({
        embeds: [embed],
        components: [buttons],
        flags: 64
    });
}

// 일일 퀘스트 갱신
function refreshDailyQuests(user) {
    const today = new Date().toDateString();
    if (user.lastQuestRefresh !== today) {
        // 일일 퀘스트 제거
        user.activeQuests = user.activeQuests.filter(q => q.category !== 'daily');
        user.lastQuestRefresh = today;
    }
}

// 보상 포맷팅
function formatRewards(rewards) {
    const parts = [];
    if (rewards.gold) parts.push(`💰 ${formatNumber(rewards.gold)}G`);
    if (rewards.exp) parts.push(`⭐ ${rewards.exp} EXP`);
    if (rewards.items) parts.push(`🎁 ${rewards.items.length}개 아이템`);
    if (rewards.questPoints) parts.push(`🎖️ ${rewards.questPoints}점`);
    return parts.join(' | ');
}

module.exports = {
    showQuestMenu,
    showDailyQuests,
    acceptQuest,
    claimQuestRewards
};