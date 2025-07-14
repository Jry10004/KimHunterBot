const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { getUser, formatNumber } = require('../common/utils');
const { applyDailyBonus } = require('../common/specialEffects');

// 출석체크 메인 메뉴
async function showAttendanceMenu(interaction) {
    const user = await getUser(interaction.user.id);
    if (!user || !user.registered) {
        return await interaction.reply({ 
            content: '먼저 회원가입을 해주세요! `/회원가입` 명령어를 사용하세요.', 
            flags: 64 
        });
    }

    const today = new Date().toDateString();
    const hasAttended = user.lastDaily === today;
    
    // 주간 출석 체크
    const currentWeek = new Date();
    currentWeek.setHours(0, 0, 0, 0);
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
    
    if (!user.weekStart || new Date(user.weekStart) < currentWeek) {
        user.weeklyAttendance = new Array(7).fill(false);
        user.weekStart = currentWeek;
        await user.save();
    }
    
    const weeklyProgress = user.weeklyAttendance ? user.weeklyAttendance.filter(x => x).length : 0;
    
    // 출석 달력 생성
    const calendar = generateAttendanceCalendar(user.weeklyAttendance);
    
    const embed = new EmbedBuilder()
        .setColor(hasAttended ? '#00ff00' : '#ff9900')
        .setTitle('📅 김헌터 출석체크')
        .setDescription(hasAttended ? '✅ 오늘 출석 완료!' : '📢 아직 출석하지 않았습니다!')
        .addFields(
            { name: '📅 이번 주 출석 현황', value: calendar, inline: false },
            { name: '🔥 연속 출석', value: `${user.attendanceStreak || 0}일`, inline: true },
            { name: '📊 주간 출석', value: `${weeklyProgress}/7일`, inline: true },
            { name: '💰 보유 골드', value: `${formatNumber(user.gold)}G`, inline: true }
        );
    
    if (!hasAttended) {
        embed.addFields({ 
            name: '🎁 출석 보상', 
            value: '• 기본 보상: 10,000G\n• 연속 출석 보너스: 1일당 +1,000G\n• 주간 개근 보너스: 50,000G', 
            inline: false 
        });
    }
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('claim_daily_reward')
                .setLabel('🎁 일일 보상 받기')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(hasAttended),
            new ButtonBuilder()
                .setCustomId('attendance_ranking')
                .setLabel('🏆 출석 랭킹')
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

// 출석 보상 받기
async function claimDailyReward(interaction) {
    const user = await getUser(interaction.user.id);
    const today = new Date().toDateString();
    
    if (user.lastDaily === today) {
        return await interaction.reply({ 
            content: '오늘은 이미 일일 보상을 받으셨습니다!', 
            flags: 64 
        });
    }
    
    // 연속 출석 체크
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    if (user.lastDaily === yesterdayStr) {
        // 연속 출석
        user.attendanceStreak = (user.attendanceStreak || 0) + 1;
    } else {
        // 연속 출석 끊김
        user.attendanceStreak = 1;
    }
    
    // 보상 계산
    const baseReward = 10000;
    const streakBonus = Math.min(user.attendanceStreak * 1000, 30000); // 최대 30일 보너스
    const totalReward = baseReward + streakBonus;
    
    // 특수 효과 적용 (일일 보상 보너스)
    const bonusReward = applyDailyBonus(totalReward, user);
    
    // 일일 보상 지급
    user.lastDaily = today;
    user.gold += bonusReward;
    
    // 주간 출석 업데이트
    const currentWeek = new Date();
    currentWeek.setHours(0, 0, 0, 0);
    currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
    
    if (!user.weekStart || new Date(user.weekStart) < currentWeek) {
        user.weeklyAttendance = new Array(7).fill(false);
        user.weekStart = currentWeek;
    }
    
    const dayOfWeek = new Date().getDay();
    user.weeklyAttendance[dayOfWeek] = true;
    
    // 주간 개근 보너스 체크
    let weeklyBonus = 0;
    if (user.weeklyAttendance.every(day => day === true)) {
        weeklyBonus = 50000;
        // 특수 효과 적용
        const bonusWeeklyReward = applyDailyBonus(weeklyBonus, user);
        user.gold += bonusWeeklyReward;
        weeklyBonus = bonusWeeklyReward; // 표시용
    }
    
    await user.save();
    
    // 미션 진행도 업데이트
    const MissionHelper = require('../../utils/missionHelper');
    await MissionHelper.updateAttendance(interaction.user.id);
    
    // 골드 획득 미션 업데이트
    const totalGoldEarned = bonusReward + weeklyBonus;
    if (totalGoldEarned > 0) {
        await MissionHelper.updateGoldEarned(interaction.user.id, totalGoldEarned);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎁 일일 보상 수령!')
        .setDescription('오늘의 일일 보상을 받았습니다!')
        .addFields(
            { name: '💰 기본 보상', value: `+${formatNumber(baseReward)}G`, inline: true },
            { name: '🔥 연속 보너스', value: `+${formatNumber(streakBonus)}G (${user.attendanceStreak}일)`, inline: true }
        );
    
    if (weeklyBonus > 0) {
        embed.addFields({ name: '🌟 주간 개근 보너스', value: `+${formatNumber(weeklyBonus)}G`, inline: false });
    }
    
    embed.addFields({ name: '💎 총 획득', value: `+${formatNumber(bonusReward + weeklyBonus)}G`, inline: false });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('attendance_menu')
                .setLabel('📅 출석 현황')
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

// 출석 랭킹
async function showAttendanceRanking(interaction) {
    // 상위 10명의 연속 출석자 조회
    const topUsers = await User.find({ registered: true })
        .sort({ attendanceStreak: -1 })
        .limit(10)
        .select('discordId username nickname attendanceStreak');
    
    let rankingText = '';
    for (let i = 0; i < topUsers.length; i++) {
        const user = topUsers[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const displayName = user.nickname || user.username || 'Unknown User';
        rankingText += `${medal} **${displayName}** - ${user.attendanceStreak || 0}일\n`;
    }
    
    const embed = new EmbedBuilder()
        .setColor('#ffd700')
        .setTitle('🏆 출석 랭킹 TOP 10')
        .setDescription(rankingText || '아직 랭킹이 없습니다.')
        .setFooter({ text: '매일 출석하여 연속 출석 기록을 늘려보세요!' });
    
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('attendance_menu')
                .setLabel('🔙 돌아가기')
                .setStyle(ButtonStyle.Secondary)
        );
    
    return await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}

// 출석 달력 생성 헬퍼
function generateAttendanceCalendar(weeklyAttendance) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date().getDay();
    
    let calendar = '```\n';
    calendar += days.map((day, index) => {
        const attended = weeklyAttendance && weeklyAttendance[index];
        const isToday = index === today;
        
        if (isToday) {
            return attended ? `[${day}✅]` : `[${day}❓]`;
        } else {
            return attended ? ` ${day}✅ ` : ` ${day}❌ `;
        }
    }).join(' ');
    calendar += '\n```';
    
    return calendar;
}

module.exports = {
    showAttendanceMenu,
    claimDailyReward,
    showAttendanceRanking
};