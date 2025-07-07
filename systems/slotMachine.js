// 슬롯머신 게임 시스템
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');

// 슬롯머신 설정
const SLOT_MACHINE = {
    symbols: {
        '🐕': { name: '김헌터', weight: 10, payout: 100 },
        '💎': { name: '다이아몬드', weight: 20, payout: 50 },
        '🌟': { name: '스타', weight: 30, payout: 20 },
        '🍒': { name: '체리', weight: 40, payout: 10 },
        '🍋': { name: '레몬', weight: 50, payout: 5 },
        '🔔': { name: '벨', weight: 60, payout: 3 },
        '7️⃣': { name: '럭키7', weight: 15, payout: 77 },
        '💰': { name: '머니백', weight: 25, payout: 30 }
    },
    reels: 3,
    betAmounts: [1000, 5000, 10000, 50000, 100000],
    autoSpinDelays: [1000, 2000, 3000], // 자동 스핀 속도
    jackpot: {
        baseAmount: 1000000,
        currentAmount: 1000000,
        symbol: '🐕', // 김헌터 3개 = 잭팟
        contribution: 0.01 // 베팅금의 1% 잭팟 기여
    },
    spinAnimation: {
        duration: 2000,
        frames: 10
    }
};

// 세션 관리
const slotMachineSessions = new Map();
const slotMachineHistory = new Map();

// 가중치 기반 랜덤 심볼 선택
function getRandomSymbol() {
    const symbols = Object.entries(SLOT_MACHINE.symbols);
    const totalWeight = symbols.reduce((sum, [_, data]) => sum + data.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [symbol, data] of symbols) {
        random -= data.weight;
        if (random <= 0) return symbol;
    }
    
    return symbols[0][0]; // 기본값
}

// 슬롯머신 스핀 실행
async function executeSlotSpin(user, betAmount) {
    // 베팅금 차감
    user.gold -= betAmount;
    
    // 잭팟에 기여
    const jackpotContribution = Math.floor(betAmount * SLOT_MACHINE.jackpot.contribution);
    SLOT_MACHINE.jackpot.currentAmount += jackpotContribution;
    
    // 릴 결과 생성
    const reels = [];
    for (let i = 0; i < SLOT_MACHINE.reels; i++) {
        reels.push(getRandomSymbol());
    }
    
    // 승리 판정
    let payout = 0;
    let isWin = false;
    let isJackpot = false;
    
    // 모든 릴이 같은 심볼인지 확인
    if (reels.every(symbol => symbol === reels[0])) {
        const symbol = reels[0];
        const symbolData = SLOT_MACHINE.symbols[symbol];
        
        if (symbol === SLOT_MACHINE.jackpot.symbol) {
            // 잭팟!
            payout = SLOT_MACHINE.jackpot.currentAmount;
            SLOT_MACHINE.jackpot.currentAmount = SLOT_MACHINE.jackpot.baseAmount;
            isJackpot = true;
        } else {
            // 일반 승리
            payout = betAmount * symbolData.payout;
        }
        isWin = true;
    }
    
    // 보상 지급
    if (payout > 0) {
        user.gold += payout;
    }
    
    // 기록 저장
    if (!slotMachineHistory.has(user.discordId)) {
        slotMachineHistory.set(user.discordId, []);
    }
    const history = slotMachineHistory.get(user.discordId);
    history.push({
        time: Date.now(),
        bet: betAmount,
        reels: reels,
        payout: payout,
        isWin: isWin,
        isJackpot: isJackpot
    });
    
    // 최근 10개만 유지
    if (history.length > 10) {
        history.shift();
    }
    
    await user.save();
    
    return {
        reels,
        payout,
        isWin,
        isJackpot,
        newBalance: user.gold,
        jackpotAmount: SLOT_MACHINE.jackpot.currentAmount
    };
}

// 슬롯머신 UI 생성
function createSlotMachineEmbed(result, betAmount, userName) {
    const embed = new EmbedBuilder()
        .setTitle('🎰 김헌터 슬롯머신')
        .setColor(result.isJackpot ? '#FFD700' : result.isWin ? '#00FF00' : '#FF0000');
    
    // 릴 표시
    const reelDisplay = result.reels.join(' | ');
    embed.addFields(
        { name: '결과', value: `## ${reelDisplay}`, inline: false }
    );
    
    // 결과 메시지
    let resultMessage = '';
    if (result.isJackpot) {
        resultMessage = `🎉 **잭팟!!! ${result.payout.toLocaleString()}G 획득!!!** 🎉`;
    } else if (result.isWin) {
        resultMessage = `✨ **승리! ${result.payout.toLocaleString()}G 획득!** ✨`;
    } else {
        resultMessage = `💸 아쉽네요... 다시 도전하세요!`;
    }
    
    embed.addFields(
        { name: '베팅', value: `${betAmount.toLocaleString()}G`, inline: true },
        { name: '획득', value: `${result.payout.toLocaleString()}G`, inline: true },
        { name: '잔액', value: `${result.newBalance.toLocaleString()}G`, inline: true },
        { name: '결과', value: resultMessage, inline: false },
        { name: '🏆 잭팟', value: `${result.jackpotAmount.toLocaleString()}G`, inline: false }
    );
    
    embed.setFooter({ text: `플레이어: ${userName}` });
    embed.setTimestamp();
    
    return embed;
}

// 슬롯머신 버튼 생성
function createSlotMachineButtons(sessionId, autoSpin = false) {
    const buttons = new ActionRowBuilder();
    
    // 베팅 금액 선택
    const betSelect = new StringSelectMenuBuilder()
        .setCustomId(`slot_bet_${sessionId}`)
        .setPlaceholder('베팅 금액 선택')
        .addOptions(
            SLOT_MACHINE.betAmounts.map(amount => ({
                label: `${amount.toLocaleString()}G`,
                value: amount.toString(),
                emoji: '💰'
            }))
        );
    
    const betRow = new ActionRowBuilder().addComponents(betSelect);
    
    // 스핀 버튼
    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId(`slot_spin_${sessionId}`)
            .setLabel('🎰 스핀!')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`slot_auto_${sessionId}`)
            .setLabel(autoSpin ? '⏸️ 자동 중지' : '▶️ 자동 스핀')
            .setStyle(autoSpin ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`slot_history_${sessionId}`)
            .setLabel('📊 기록')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`slot_quit_${sessionId}`)
            .setLabel('🚪 나가기')
            .setStyle(ButtonStyle.Danger)
    );
    
    return [betRow, buttons];
}

// 슬롯머신 시작
async function startSlotMachine(interaction, user) {
    const sessionId = `${interaction.user.id}_${Date.now()}`;
    
    const session = {
        userId: interaction.user.id,
        userName: user.nickname || interaction.user.username,
        betAmount: SLOT_MACHINE.betAmounts[0],
        autoSpin: false,
        autoSpinDelay: SLOT_MACHINE.autoSpinDelays[1],
        startTime: Date.now()
    };
    
    slotMachineSessions.set(sessionId, session);
    
    const embed = new EmbedBuilder()
        .setTitle('🎰 김헌터 슬롯머신')
        .setDescription('베팅 금액을 선택하고 스핀 버튼을 눌러주세요!')
        .setColor('#FFD700')
        .addFields(
            { name: '잔액', value: `${user.gold.toLocaleString()}G`, inline: true },
            { name: '🏆 현재 잭팟', value: `${SLOT_MACHINE.jackpot.currentAmount.toLocaleString()}G`, inline: true }
        )
        .setFooter({ text: '🐕 김헌터 3개 = 잭팟!' });
    
    const components = createSlotMachineButtons(sessionId);
    
    await interaction.reply({
        embeds: [embed],
        components: components,
        flags: 64
    });
}

// 세션 정리
function cleanupSession(sessionId) {
    const session = slotMachineSessions.get(sessionId);
    if (session && session.autoSpinInterval) {
        clearInterval(session.autoSpinInterval);
    }
    slotMachineSessions.delete(sessionId);
}

// 기록 표시
function createHistoryEmbed(userId, userName) {
    const history = slotMachineHistory.get(userId) || [];
    
    const embed = new EmbedBuilder()
        .setTitle('📊 슬롯머신 플레이 기록')
        .setColor('#00BFFF')
        .setFooter({ text: userName });
    
    if (history.length === 0) {
        embed.setDescription('아직 플레이 기록이 없습니다.');
        return embed;
    }
    
    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;
    let jackpots = 0;
    
    history.forEach((record, index) => {
        totalBet += record.bet;
        totalWin += record.payout;
        if (record.isWin) wins++;
        if (record.isJackpot) jackpots++;
    });
    
    embed.addFields(
        { name: '총 게임 수', value: `${history.length}회`, inline: true },
        { name: '승리', value: `${wins}회 (${Math.round(wins/history.length*100)}%)`, inline: true },
        { name: '잭팟', value: `${jackpots}회`, inline: true },
        { name: '총 베팅', value: `${totalBet.toLocaleString()}G`, inline: true },
        { name: '총 획득', value: `${totalWin.toLocaleString()}G`, inline: true },
        { name: '순손익', value: `${(totalWin - totalBet).toLocaleString()}G`, inline: true }
    );
    
    // 최근 5개 기록
    embed.addFields({ name: '\\u200b', value: '**최근 기록**', inline: false });
    
    history.slice(-5).reverse().forEach((record, index) => {
        const time = new Date(record.time).toLocaleTimeString('ko-KR');
        const result = record.reels.join(' | ');
        const outcome = record.isJackpot ? '🎉 잭팟!' : record.isWin ? '✨ 승리' : '💸 패배';
        
        embed.addFields({
            name: `${time}`,
            value: `${result} - ${outcome} (${record.payout.toLocaleString()}G)`,
            inline: false
        });
    });
    
    return embed;
}

module.exports = {
    SLOT_MACHINE,
    slotMachineSessions,
    slotMachineHistory,
    startSlotMachine,
    executeSlotSpin,
    createSlotMachineEmbed,
    createSlotMachineButtons,
    createHistoryEmbed,
    cleanupSession
};