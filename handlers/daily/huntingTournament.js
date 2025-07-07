const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { HUNTING_TOURNAMENT, calculateSpeedRank, getTodaySpeedTarget } = require('../../data/huntingTournament');
const { huntingAreas } = require('../../data/huntingAreas');

// 토너먼트 메인 메뉴
async function showTournamentMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }
    
    // 레벨 확인 (테스트를 위해 임시 비활성화)
    /*
    if (user.level < HUNTING_TOURNAMENT.requirements.minLevel) {
        return await interaction.reply({
            content: `❌ 토너먼트는 레벨 ${HUNTING_TOURNAMENT.requirements.minLevel} 이상부터 참가 가능합니다!`,
            flags: 64
        });
    }
    
    // 사냥 횟수 확인 (테스트를 위해 임시 비활성화)
    if ((user.totalHunts || 0) < HUNTING_TOURNAMENT.requirements.minHunts) {
        return await interaction.reply({
            content: `❌ 토너먼트는 최소 ${HUNTING_TOURNAMENT.requirements.minHunts}회 이상 사냥 경험이 필요합니다! (현재: ${user.totalHunts || 0}회)`,
            flags: 64
        });
    }
    */
    
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
        await user.save();
    }
    
    const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('🏆 사냥 토너먼트')
        .setDescription('다양한 사냥 대회에 참가하여 명예와 보상을 획득하세요!')
        .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723793/tournament.png');
    
    // 주간 랭킹 정보
    const weeklyBadge = user.huntingTournament.weeklyBadge || '🎯';
    embed.addFields({
        name: `${weeklyBadge} 주간 사냥왕 랭킹`,
        value: `현재 점수: **${user.huntingTournament.weeklyScore}점**\n` +
               `현재 순위: ${user.huntingTournament.weeklyRank > 0 ? `**${user.huntingTournament.weeklyRank}위**` : '미집계'}\n` +
               `지난주 순위: ${user.huntingTournament.lastWeekRank > 0 ? `${user.huntingTournament.lastWeekRank}위` : '기록 없음'}`,
        inline: true
    });
    
    // 오늘의 속도 사냥 정보
    const todayTarget = getTodaySpeedTarget();
    const today = new Date().toDateString();
    const attemptsToday = user.huntingTournament.lastSpeedHuntDate === today ? 
                         user.huntingTournament.dailySpeedAttempts : 0;
    
    embed.addFields({
        name: '⚡ 오늘의 속도 사냥',
        value: `대상: **${todayTarget.name}** ${todayTarget.targetCount}마리\n` +
               `난이도: ${todayTarget.difficulty}\n` +
               `남은 도전: ${HUNTING_TOURNAMENT.speedHunt.dailyAttempts - attemptsToday}/${HUNTING_TOURNAMENT.speedHunt.dailyAttempts}회`,
        inline: true
    });
    
    // 특별 트로피
    if (user.huntingTournament.specialTrophies.length > 0) {
        const trophies = user.huntingTournament.specialTrophies
            .slice(-3)
            .map(t => `${t.emoji} ${t.name}`)
            .join('\n');
        embed.addFields({
            name: '🏅 획득한 트로피',
            value: trophies,
            inline: false
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('tournament_weekly')
                .setLabel('🏆 주간 랭킹')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('tournament_speed')
                .setLabel('⚡ 속도 사냥')
                .setStyle(ButtonStyle.Success)
                .setDisabled(attemptsToday >= HUNTING_TOURNAMENT.speedHunt.dailyAttempts),
            new ButtonBuilder()
                .setCustomId('tournament_rewards')
                .setLabel('🎁 보상 확인')
                .setStyle(ButtonStyle.Secondary),
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

// 주간 랭킹 표시
async function showWeeklyRanking(interaction) {
    await interaction.deferUpdate();
    
    // 상위 50명 조회
    const topPlayers = await User.find({
        'huntingTournament.weeklyScore': { $gt: 0 }
    })
    .sort({ 'huntingTournament.weeklyScore': -1 })
    .limit(50)
    .select('nickname huntingTournament.weeklyScore huntingTournament.weeklyBadge');
    
    const embed = new EmbedBuilder()
        .setColor('#ffdd44')
        .setTitle('🏆 주간 사냥왕 랭킹')
        .setDescription('매주 월요일 오전 6시에 초기화됩니다.')
        .setTimestamp();
    
    if (topPlayers.length === 0) {
        embed.addFields({
            name: '📊 랭킹',
            value: '아직 참가자가 없습니다.'
        });
    } else {
        let rankingText = '';
        const rewards = HUNTING_TOURNAMENT.weeklyRanking.rewards;
        
        for (let i = 0; i < Math.min(10, topPlayers.length); i++) {
            const player = topPlayers[i];
            let rankEmoji = '';
            
            if (i === 0) rankEmoji = rewards[1].badge;
            else if (i === 1) rankEmoji = rewards[2].badge;
            else if (i === 2) rankEmoji = rewards[3].badge;
            else if (i < 10) rankEmoji = rewards['4-10'].badge;
            
            rankingText += `${rankEmoji} **${i + 1}위** ${player.nickname} - ${player.huntingTournament.weeklyScore}점\n`;
        }
        
        embed.addFields({ name: '🏅 TOP 10', value: rankingText });
        
        // 보상 정보
        let rewardText = '';
        rewardText += `👑 **1위**: ${formatNumber(rewards[1].gold)}G + 사냥왕의 왕관\n`;
        rewardText += `🥈 **2위**: ${formatNumber(rewards[2].gold)}G + 은빛 사냥 훈장\n`;
        rewardText += `🥉 **3위**: ${formatNumber(rewards[3].gold)}G + 동빛 사냥 훈장\n`;
        rewardText += `🎖️ **4-10위**: ${formatNumber(rewards['4-10'].gold)}G\n`;
        rewardText += `🎯 **11-50위**: ${formatNumber(rewards['11-50'].gold)}G`;
        
        embed.addFields({ name: '🎁 주간 보상', value: rewardText });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('tournament_menu')
                .setLabel('🔙 토너먼트 메뉴')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('main_menu')
                .setLabel('🏠 메인 메뉴')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 속도 사냥 시작
async function startSpeedHunt(interaction) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const todayTarget = getTodaySpeedTarget();
    const targetArea = huntingAreas.find(a => a.id === todayTarget.area);
    
    if (!user.unlockedAreas.includes(todayTarget.area)) {
        return await interaction.editReply({
            content: `❌ ${targetArea.name} 지역이 잠겨있습니다! (필요 레벨: ${targetArea.unlockLevel})`,
            embeds: [],
            components: []
        });
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('⚡ 속도 사냥 도전!')
        .setDescription(`**목표**: ${todayTarget.name} ${todayTarget.targetCount}마리 처치\n**제한시간**: 5분\n**지역**: ${targetArea.name}`)
        .addFields(
            { name: '🏆 랭크별 보상', value: 
                `**S랭크** (1분 이내): ${formatNumber(HUNTING_TOURNAMENT.speedHunt.rewards.S.gold)}G + 번개의 부적\n` +
                `**A랭크** (2분 이내): ${formatNumber(HUNTING_TOURNAMENT.speedHunt.rewards.A.gold)}G + 바람의 깃털\n` +
                `**B랭크** (3분 이내): ${formatNumber(HUNTING_TOURNAMENT.speedHunt.rewards.B.gold)}G\n` +
                `**C랭크** (5분 이내): ${formatNumber(HUNTING_TOURNAMENT.speedHunt.rewards.C.gold)}G`
            },
            { name: '⏱️ 최고 기록', value: user.huntingTournament.speedHuntRecords.get(todayTarget.name)?.bestRank || '기록 없음', inline: true },
            { name: '🎯 도전 횟수', value: `${user.huntingTournament.speedHuntRecords.get(todayTarget.name)?.attempts || 0}회`, inline: true }
        )
        .setFooter({ text: '준비가 되면 시작 버튼을 누르세요!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`speed_hunt_start_${todayTarget.area}_${todayTarget.name}`)
                .setLabel('🏁 도전 시작!')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('tournament_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

// 속도 사냥 실행
async function executeSpeedHunt(interaction, areaId, targetName) {
    await interaction.deferUpdate();
    
    const user = await getUser(interaction.user.id);
    const todayTarget = getTodaySpeedTarget();
    const startTime = Date.now();
    
    // 오늘 시도 횟수 업데이트
    const today = new Date().toDateString();
    if (user.huntingTournament.lastSpeedHuntDate !== today) {
        user.huntingTournament.dailySpeedAttempts = 0;
        user.huntingTournament.lastSpeedHuntDate = today;
    }
    user.huntingTournament.dailySpeedAttempts++;
    
    let killedCount = 0;
    const targetCount = todayTarget.targetCount;
    
    // 진행 상황 표시
    const progressEmbed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('⚡ 속도 사냥 진행 중!')
        .setDescription(`목표: ${targetName} ${targetCount}마리`)
        .addFields(
            { name: '🎯 진행도', value: `${killedCount}/${targetCount}`, inline: true },
            { name: '⏱️ 경과 시간', value: '0:00', inline: true }
        )
        .setFooter({ text: '최대한 빨리 목표를 달성하세요!' });
    
    const message = await interaction.editReply({
        embeds: [progressEmbed],
        components: []
    });
    
    // 시뮬레이션 (실제로는 사냥 시스템과 연동 필요)
    const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        // 시간 초과 체크
        if (elapsed > HUNTING_TOURNAMENT.speedHunt.duration) {
            clearInterval(interval);
            
            const failEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('💀 시간 초과!')
                .setDescription('5분 안에 목표를 달성하지 못했습니다.')
                .addFields(
                    { name: '🎯 처치 수', value: `${killedCount}/${targetCount}`, inline: true },
                    { name: '⏱️ 소요 시간', value: '5:00+', inline: true }
                );
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tournament_speed')
                        .setLabel('🔄 다시 도전')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.huntingTournament.dailySpeedAttempts >= HUNTING_TOURNAMENT.speedHunt.dailyAttempts),
                    new ButtonBuilder()
                        .setCustomId('tournament_menu')
                        .setLabel('🔙 토너먼트 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await user.save();
            return await message.edit({
                embeds: [failEmbed],
                components: [buttons]
            });
        }
        
        // 랜덤하게 처치 (실제로는 사냥 결과에 따라)
        killedCount += Math.floor(Math.random() * 3) + 1;
        
        if (killedCount >= targetCount) {
            clearInterval(interval);
            killedCount = targetCount;
            
            // 랭크 계산
            const rank = calculateSpeedRank(elapsed);
            const reward = HUNTING_TOURNAMENT.speedHunt.rewards[rank];
            
            // 기록 업데이트
            const record = user.huntingTournament.speedHuntRecords.get(targetName) || {
                bestTime: Infinity,
                bestRank: 'F',
                attempts: 0,
                lastAttempt: null
            };
            
            record.attempts++;
            record.lastAttempt = new Date();
            
            let newRecord = false;
            if (elapsed < record.bestTime) {
                record.bestTime = elapsed;
                record.bestRank = rank;
                newRecord = true;
            }
            
            user.huntingTournament.speedHuntRecords.set(targetName, record);
            
            // 보상 지급
            if (reward) {
                user.gold += reward.gold;
                
                // 특별 아이템 (S, A 랭크)
                if (reward.items && newRecord) {
                    // 인벤토리에 아이템 추가 로직
                }
            }
            
            await user.save();
            
            const successEmbed = new EmbedBuilder()
                .setColor(rank === 'S' ? '#ffdd44' : rank === 'A' ? '#44ff44' : '#4444ff')
                .setTitle(`🎉 ${rank}랭크 달성!`)
                .setDescription(reward.title)
                .addFields(
                    { name: '⏱️ 소요 시간', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true },
                    { name: '💰 획득 골드', value: `+${formatNumber(reward.gold)}G`, inline: true },
                    { name: '🏆 신기록', value: newRecord ? '✅ 갱신!' : '❌', inline: true }
                );
            
            if (newRecord && rank === 'S') {
                successEmbed.setImage('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723794/speed_s_rank.gif');
            }
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tournament_speed')
                        .setLabel('🔄 다시 도전')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(user.huntingTournament.dailySpeedAttempts >= HUNTING_TOURNAMENT.speedHunt.dailyAttempts),
                    new ButtonBuilder()
                        .setCustomId('tournament_menu')
                        .setLabel('🔙 토너먼트 메뉴')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            return await message.edit({
                embeds: [successEmbed],
                components: [buttons]
            });
        }
        
        // 진행 상황 업데이트
        progressEmbed.setFields(
            { name: '🎯 진행도', value: `${killedCount}/${targetCount}`, inline: true },
            { name: '⏱️ 경과 시간', value: `${minutes}:${seconds.toString().padStart(2, '0')}`, inline: true }
        );
        
        await message.edit({
            embeds: [progressEmbed]
        });
        
    }, 1000); // 1초마다 업데이트
}

module.exports = {
    showTournamentMenu,
    showWeeklyRanking,
    startSpeedHunt,
    executeSpeedHunt
};