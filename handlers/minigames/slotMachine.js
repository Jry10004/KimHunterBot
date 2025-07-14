const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const { applyMinigameBonus } = require('../common/specialEffects');
const ActivityLog = require('../../models/ActivityLog');

// 김헌터 슬롯머신 시스템
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

// 슬롯머신 세션 관리
const slotMachineSessions = new Map();
const slotMachineHistory = new Map(); // 유저별 스핀 기록

class SlotMachineSystem {
    constructor() {
        this.sessions = slotMachineSessions;
        this.history = slotMachineHistory;
    }

    // 슬롯머신 메인 화면
    async showSlotMachine(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 슬롯 통계 초기화
        if (!user.slotStats) {
            user.slotStats = {
                totalSpins: 0,
                totalBet: 0,
                totalWon: 0,
                biggestWin: 0,
                currentStreak: 0,
                bestStreak: 0,
                jackpotWins: 0,
                lastSpin: null
            };
            await user.save();
        }

        const winRate = user.slotStats.totalSpins > 0 
            ? ((user.slotStats.totalWon / user.slotStats.totalBet) * 100).toFixed(1) 
            : '0.0';

        const embed = new EmbedBuilder()
            .setTitle('🎰 김헌터 슬롯머신 🎰')
            .setDescription(
                '**🎯 게임 방식**: 3개의 릴이 회전하며 같은 심볼이 나오면 승리!\n' +
                '**🐕 잭팟**: 김헌터 3개 조합시 현재 잭팟 획득!\n' +
                '**🍀 특수 조합**: 2개 맞춰도 베팅금의 50% 반환!\n\n' +
                '🎮 **플레이 모드를 선택하세요!**'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 승률', value: `${winRate}%`, inline: true },
                { name: '🏆 현재 잭팟', value: `${SLOT_MACHINE.jackpot.currentAmount.toLocaleString()}G`, inline: true },
                { name: '🎰 총 스핀', value: `${user.slotStats.totalSpins}회`, inline: true },
                { name: '💎 최대 당첨', value: `${user.slotStats.biggestWin.toLocaleString()}G`, inline: true },
                { name: '🔥 잭팟 당첨', value: `${user.slotStats.jackpotWins}회`, inline: true }
            )
            .setColor('#FFD700');

        const gameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_solo_play')
                    .setLabel('🎰 혼자하기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('slot_tournament')
                    .setLabel('🏆 토너먼트 (준비중)')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('slot_history')
                    .setLabel('📜 플레이 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('slot_stats')
                    .setLabel('📊 상세 통계')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        // interaction 응답 처리
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                embeds: [embed],
                components: [gameButtons]
            });
        } else {
            await interaction.update({
                embeds: [embed],
                components: [gameButtons]
            });
        }
    }

    // 솔로 플레이 시작
    async handleSoloPlay(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎰 베팅 금액 선택')
            .setDescription('스핀할 금액을 선택하세요!\n\n' +
                '🎯 **심볼 배당률**\n' +
                Object.entries(SLOT_MACHINE.symbols)
                    .sort((a, b) => b[1].payout - a[1].payout)
                    .map(([symbol, data]) => `${symbol} ${data.name} - x${data.payout}`)
                    .join('\n')
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700');

        const betButtons = new ActionRowBuilder()
            .addComponents(
                SLOT_MACHINE.betAmounts.slice(0, 5).map(amount => 
                    new ButtonBuilder()
                        .setCustomId(`slot_bet_${amount}`)
                        .setLabel(`${(amount/1000)}K`)
                        .setStyle(amount <= user.gold ? ButtonStyle.Primary : ButtonStyle.Secondary)
                        .setDisabled(amount > user.gold)
                )
            );

        const controlButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_auto')
                    .setLabel('🔄 자동 스핀')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('slot_machine')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [betButtons, controlButtons]
        });
    }

    // 스핀 실행
    async executeSpin(interaction, betAmount) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        if (user.gold < betAmount) {
            return interaction.reply({ content: '❌ 골드가 부족합니다!', flags: 64 });
        }

        // 스핀 애니메이션 시작
        const spinningEmbed = new EmbedBuilder()
            .setTitle('🎰 슬롯 머신 회전 중... 🎰')
            .setDescription('🎲 🎲 🎲\n회전하는 중...')
            .setColor('#FF6B6B');

        await interaction.update({
            embeds: [spinningEmbed],
            components: []
        });

        // 스핀 실행
        const result = await this.performSpin(user, betAmount);

        // 애니메이션 효과 (2초 대기)
        await new Promise(resolve => setTimeout(resolve, SLOT_MACHINE.spinAnimation.duration));

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle(result.isJackpot ? '🎊 잭팟! 🎊' : (result.winAmount > 0 ? '🎉 당첨!' : '😢 꽝!'))
            .setDescription(
                `**[ ${result.symbols.join(' | ')} ]**\n\n` +
                (result.isJackpot 
                    ? `🏆 **잭팟 당첨!** ${result.winAmount.toLocaleString()}G 획득!`
                    : result.winAmount > 0 
                        ? `💰 ${result.winAmount.toLocaleString()}G 획득!`
                        : '다음 기회에...') +
                (result.bonusApplied ? `\n\n🏷️ **버그 사냥꾼 칭호 효과** +${result.bonusAmount.toLocaleString()}G` : '')
            )
            .addFields(
                { name: '💸 베팅', value: `${betAmount.toLocaleString()}G`, inline: true },
                { name: '💰 획득', value: `${result.winAmount.toLocaleString()}G`, inline: true },
                { name: '💎 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor(result.winAmount > 0 ? '#00FF00' : '#FF0000');

        if (result.isJackpot) {
            resultEmbed.setImage('attachment://jackpot.gif');
        }

        const continueButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`slot_spin_${betAmount}`)
                    .setLabel('🔁 다시 스핀')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < betAmount),
                new ButtonBuilder()
                    .setCustomId('slot_solo_play')
                    .setLabel('💰 베팅 변경')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('slot_machine')
                    .setLabel('🔙 메인 메뉴')
                    .setStyle(ButtonStyle.Secondary)
            );

        const files = [];
        if (result.isJackpot) {
            // 잭팟 GIF 파일 첨부 (있는 경우)
            try {
                const fs = require('fs');
                const path = require('path');
                const gifPath = path.join(__dirname, '../../resource/jackpot.gif');
                if (fs.existsSync(gifPath)) {
                    files.push(new AttachmentBuilder(gifPath, { name: 'jackpot.gif' }));
                }
            } catch (error) {
                console.error('잭팟 GIF 로드 실패:', error);
            }
        }

        await interaction.editReply({
            embeds: [resultEmbed],
            components: [continueButtons],
            files
        });

        // 잭팟 당첨시 전체 알림
        if (result.isJackpot) {
            const channel = interaction.channel;
            const jackpotAnnounce = new EmbedBuilder()
                .setTitle('🎊 잭팟 당첨! 🎊')
                .setDescription(`🎉 **${user.nickname || interaction.user.username}**님이 **${result.winAmount.toLocaleString()}G** 잭팟에 당첨되었습니다!`)
                .setColor('#FFD700')
                .setTimestamp();

            await channel.send({ embeds: [jackpotAnnounce] });
        }
    }

    // 실제 스핀 처리
    async performSpin(user, betAmount) {
        // 골드 차감
        user.gold -= betAmount;
        
        // 잭팟에 기여
        SLOT_MACHINE.jackpot.currentAmount += Math.floor(betAmount * SLOT_MACHINE.jackpot.contribution);
        
        // 심볼 가중치 계산
        const symbolWeights = [];
        const symbols = [];
        
        for (const [symbol, data] of Object.entries(SLOT_MACHINE.symbols)) {
            symbols.push(symbol);
            symbolWeights.push(data.weight);
        }
        
        // 가중치 기반 랜덤 선택
        function getRandomSymbol() {
            const totalWeight = symbolWeights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < symbols.length; i++) {
                random -= symbolWeights[i];
                if (random <= 0) {
                    return symbols[i];
                }
            }
            return symbols[symbols.length - 1];
        }
        
        // 3개의 릴 결과 생성
        const reelResults = [];
        for (let i = 0; i < SLOT_MACHINE.reels; i++) {
            reelResults.push(getRandomSymbol());
        }
        
        // 당첨 계산
        let winAmount = 0;
        let isJackpot = false;
        
        // 3개 모두 같은 경우
        if (reelResults[0] === reelResults[1] && reelResults[1] === reelResults[2]) {
            const symbol = reelResults[0];
            const symbolData = SLOT_MACHINE.symbols[symbol];
            
            if (symbol === SLOT_MACHINE.jackpot.symbol) {
                // 잭팟!
                winAmount = SLOT_MACHINE.jackpot.currentAmount;
                isJackpot = true;
                SLOT_MACHINE.jackpot.currentAmount = SLOT_MACHINE.jackpot.baseAmount;
            } else {
                winAmount = betAmount * symbolData.payout;
            }
        }
        // 2개가 같은 경우 (부분 당첨)
        else if (reelResults[0] === reelResults[1] || reelResults[1] === reelResults[2] || reelResults[0] === reelResults[2]) {
            // 2개 매칭시 베팅금의 50% 반환
            winAmount = Math.floor(betAmount * 0.5);
        }
        
        // 미니게임 보상 특수 효과 적용 (잭팟 제외) - 버그 사냥꾼 칭호 효과 포함
        let bonusApplied = false;
        let bonusAmount = 0;
        if (winAmount > 0 && !isJackpot) {
            const originalWin = winAmount;
            winAmount = applyMinigameBonus(winAmount, user);
            
            if (winAmount > originalWin) {
                bonusApplied = true;
                bonusAmount = winAmount - originalWin;
                console.log(`[SlotMachine] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalWin} → ${winAmount} (+${bonusAmount})`);
            }
        }
        
        // 골드 지급
        if (winAmount > 0) {
            user.gold += winAmount;
        }
        
        // 통계 업데이트
        if (!user.slotStats) {
            user.slotStats = {
                totalSpins: 0,
                totalBet: 0,
                totalWon: 0,
                biggestWin: 0,
                currentStreak: 0,
                bestStreak: 0,
                jackpotWins: 0,
                lastSpin: null
            };
        }
        
        user.slotStats.totalSpins++;
        user.slotStats.totalBet += betAmount;
        user.slotStats.totalWon += winAmount;
        user.slotStats.lastSpin = new Date();
        
        if (winAmount > 0) {
            user.slotStats.currentStreak++;
            if (user.slotStats.currentStreak > user.slotStats.bestStreak) {
                user.slotStats.bestStreak = user.slotStats.currentStreak;
            }
            if (winAmount > user.slotStats.biggestWin) {
                user.slotStats.biggestWin = winAmount;
            }
            if (isJackpot) {
                user.slotStats.jackpotWins++;
            }
        } else {
            user.slotStats.currentStreak = 0;
        }
        
        // gameStats 업데이트
        if (!user.gameStats) user.gameStats = {};
        if (!user.gameStats.slot) user.gameStats.slot = { played: 0, won: 0 };
        user.gameStats.slot.played++;
        if (winAmount > 0) {
            user.gameStats.slot.won++;
        }
        
        // 활동 로그 기록
        await ActivityLog.create({
            userId: user.discordId,
            nickname: user.nickname,
            activityType: 'minigame',
            details: {
                gameType: 'slot',
                gameResult: winAmount > 0 ? 'win' : 'lose',
                betAmount: betAmount,
                winAmount: winAmount,
                goldChange: winAmount - betAmount,
                expGained: 0
            }
        });
        
        await user.save();
        
        // 미션 진행도 업데이트
        const MissionHelper = require('../../utils/missionHelper');
        await MissionHelper.updateMiniGame(interaction.user.id);
        
        // 골드 획득 미션 업데이트 (순수익이 있을 때만)
        const netWin = winAmount - betAmount;
        if (netWin > 0) {
            await MissionHelper.updateGoldEarned(interaction.user.id, netWin);
        }
        
        // 스핀 기록 저장
        const spinHistory = this.history.get(user.discordId) || [];
        spinHistory.push({
            symbols: reelResults,
            bet: betAmount,
            win: winAmount,
            isJackpot: isJackpot,
            time: new Date()
        });
        if (spinHistory.length > 100) {
            spinHistory.shift(); // 최대 100개만 유지
        }
        this.history.set(user.discordId, spinHistory);
        
        return {
            symbols: reelResults,
            winAmount: winAmount,
            isJackpot: isJackpot,
            bonusApplied: bonusApplied,
            bonusAmount: bonusAmount
        };
    }

    // 자동 스핀
    async startAutoSpin(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 자동 스핀 설정 UI
        const autoSpinEmbed = new EmbedBuilder()
            .setTitle('🔄 자동 스핀 설정')
            .setDescription('자동 스핀 옵션을 선택하세요.\n\n⚠️ 골드가 부족하거나 잭팟 당첨시 자동 중지됩니다.')
            .setColor('#00CED1');

        const betRow = new ActionRowBuilder()
            .addComponents(
                SLOT_MACHINE.betAmounts.slice(0, 5).map(amount => 
                    new ButtonBuilder()
                        .setCustomId(`auto_bet_${amount}`)
                        .setLabel(`${(amount/1000)}K`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(amount > user.gold)
                )
            );

        const speedRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('auto_speed_fast')
                    .setLabel('⚡ 빠름 (1초)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('auto_speed_normal')
                    .setLabel('🚶 보통 (2초)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('auto_speed_slow')
                    .setLabel('🐌 느림 (3초)')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('slot_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({
            embeds: [autoSpinEmbed],
            components: [betRow, speedRow]
        });
    }

    // 스핀 기록 표시
    async showHistory(interaction) {
        const userId = interaction.user.id;
        const history = this.history.get(userId) || [];

        if (history.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle('📜 스핀 기록')
                .setDescription('아직 스핀 기록이 없습니다.')
                .setColor('#808080');

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('slot_main')
                        .setLabel('🔙 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );

            return interaction.update({
                embeds: [emptyEmbed],
                components: [backButton]
            });
        }

        // 최근 10개 기록만 표시
        const recentHistory = history.slice(-10).reverse();
        
        const historyEmbed = new EmbedBuilder()
            .setTitle('📜 최근 스핀 기록')
            .setDescription(
                recentHistory.map((spin, index) => {
                    const time = new Date(spin.time).toLocaleTimeString('ko-KR');
                    const result = spin.win > 0 ? '✅ 당첨' : '❌ 꽝';
                    return `${index + 1}. [${spin.symbols.join('|')}] ${result} (${spin.win.toLocaleString()}G) - ${time}`;
                }).join('\n')
            )
            .setColor('#4682B4')
            .setFooter({ text: '최근 10개 기록만 표시됩니다.' });

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [historyEmbed],
            components: [backButton]
        });
    }

    // 통계 표시
    async showStats(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const stats = user.slotStats || {
            totalSpins: 0,
            totalBet: 0,
            totalWon: 0,
            biggestWin: 0,
            currentStreak: 0,
            bestStreak: 0,
            jackpotWins: 0
        };

        const profit = stats.totalWon - stats.totalBet;
        const avgWin = stats.totalSpins > 0 ? Math.floor(stats.totalWon / stats.totalSpins) : 0;
        const winRate = stats.totalSpins > 0 ? ((stats.totalWon / stats.totalBet) * 100).toFixed(1) : '0.0';

        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 슬롯머신 통계')
            .setDescription(`${user.nickname || interaction.user.username}님의 슬롯머신 기록`)
            .addFields(
                { name: '🎲 총 스핀', value: `${stats.totalSpins}회`, inline: true },
                { name: '💸 총 베팅', value: `${stats.totalBet.toLocaleString()}G`, inline: true },
                { name: '💰 총 획득', value: `${stats.totalWon.toLocaleString()}G`, inline: true },
                { name: '📈 순수익', value: `${profit.toLocaleString()}G`, inline: true },
                { name: '📊 승률', value: `${winRate}%`, inline: true },
                { name: '💵 평균 획득', value: `${avgWin.toLocaleString()}G`, inline: true },
                { name: '💎 최대 당첨', value: `${stats.biggestWin.toLocaleString()}G`, inline: true },
                { name: '🔥 최고 연승', value: `${stats.bestStreak}회`, inline: true },
                { name: '🎯 잭팟 당첨', value: `${stats.jackpotWins}회`, inline: true }
            )
            .setColor('#9370DB')
            .setTimestamp();

        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_main')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [statsEmbed],
            components: [backButton]
        });
    }

    // 자동 스핀 실행
    async executeAutoSpin(interaction, betAmount, speed) {
        const userId = interaction.user.id;
        const delay = speed === 'fast' ? 1000 : speed === 'slow' ? 3000 : 2000;
        
        // 세션 생성
        const session = {
            userId,
            betAmount,
            delay,
            isRunning: true,
            spins: 0,
            totalWon: 0,
            totalBet: 0
        };
        
        this.sessions.set(userId, session);

        // 자동 스핀 시작 UI
        const autoSpinEmbed = new EmbedBuilder()
            .setTitle('🔄 자동 스핀 진행 중...')
            .setDescription('중지하려면 아래 버튼을 누르세요.')
            .addFields(
                { name: '💰 베팅 금액', value: `${betAmount.toLocaleString()}G`, inline: true },
                { name: '⚡ 속도', value: speed === 'fast' ? '빠름' : speed === 'slow' ? '느림' : '보통', inline: true },
                { name: '🎲 스핀 횟수', value: '0회', inline: true }
            )
            .setColor('#00CED1');

        const stopButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_stop_auto')
                    .setLabel('⏹️ 중지')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({
            embeds: [autoSpinEmbed],
            components: [stopButton]
        });

        // 자동 스핀 루프
        const runAutoSpin = async () => {
            if (!session.isRunning) return;

            const user = await User.findOne({ discordId: userId });
            if (!user || user.gold < betAmount) {
                session.isRunning = false;
                await this.stopAutoSpin(interaction, session, user ? '골드 부족' : '사용자 오류');
                return;
            }

            // 스핀 실행
            const result = await this.performSpin(user, betAmount);
            session.spins++;
            session.totalBet += betAmount;
            session.totalWon += result.winAmount;

            // UI 업데이트
            const updateEmbed = new EmbedBuilder()
                .setTitle('🔄 자동 스핀 진행 중...')
                .setDescription(
                    `**[ ${result.symbols.join(' | ')} ]**\n` +
                    (result.winAmount > 0 ? `💰 ${result.winAmount.toLocaleString()}G 획득!` : '꽝...')
                )
                .addFields(
                    { name: '🎲 스핀 횟수', value: `${session.spins}회`, inline: true },
                    { name: '💸 총 베팅', value: `${session.totalBet.toLocaleString()}G`, inline: true },
                    { name: '💰 총 획득', value: `${session.totalWon.toLocaleString()}G`, inline: true },
                    { name: '📈 순수익', value: `${(session.totalWon - session.totalBet).toLocaleString()}G`, inline: true },
                    { name: '💎 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
                )
                .setColor(result.winAmount > 0 ? '#00FF00' : '#FF6B6B');

            if (result.isJackpot) {
                // 잭팟 당첨시 자동 중지
                session.isRunning = false;
                updateEmbed.setTitle('🎊 잭팟 당첨! 🎊');
                await this.stopAutoSpin(interaction, session, '잭팟 당첨!');
                return;
            }

            try {
                await interaction.editReply({
                    embeds: [updateEmbed]
                });
            } catch (error) {
                console.error('자동 스핀 UI 업데이트 오류:', error);
                session.isRunning = false;
                return;
            }

            // 다음 스핀 예약
            setTimeout(() => runAutoSpin(), delay);
        };

        // 첫 스핀 시작
        setTimeout(() => runAutoSpin(), 1000);
    }

    // 자동 스핀 중지
    async stopAutoSpin(interaction, session, reason = '수동 중지') {
        session.isRunning = false;
        this.sessions.delete(session.userId);

        const profit = session.totalWon - session.totalBet;
        
        const stopEmbed = new EmbedBuilder()
            .setTitle('⏹️ 자동 스핀 종료')
            .setDescription(`**종료 사유:** ${reason}`)
            .addFields(
                { name: '🎲 총 스핀', value: `${session.spins}회`, inline: true },
                { name: '💸 총 베팅', value: `${session.totalBet.toLocaleString()}G`, inline: true },
                { name: '💰 총 획득', value: `${session.totalWon.toLocaleString()}G`, inline: true },
                { name: '📈 최종 수익', value: `${profit.toLocaleString()}G`, inline: true }
            )
            .setColor(profit > 0 ? '#00FF00' : '#FF0000')
            .setTimestamp();

        const menuButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('slot_main')
                    .setLabel('🎰 슬롯머신으로')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [stopEmbed],
            components: [menuButton]
        });
    }
}

// 싱글톤 인스턴스
const slotMachine = new SlotMachineSystem();

// 인터랙션 핸들러
async function handleSlotMachineInteraction(interaction) {
    const customId = interaction.customId;

    // 메인 화면
    if (customId === 'slot_machine' || customId === 'slot_main' || customId === 'slot_change_bet') {
        return await slotMachine.showSlotMachine(interaction);
    }
    
    // 솔로 플레이 선택
    else if (customId === 'slot_solo_play') {
        return await slotMachine.handleSoloPlay(interaction);
    }
    
    // 베팅 선택
    else if (customId.startsWith('slot_bet_')) {
        const betAmount = parseInt(customId.replace('slot_bet_', ''));
        return await slotMachine.executeSpin(interaction, betAmount);
    }
    
    // 재스핀
    else if (customId.startsWith('slot_spin_')) {
        const betAmount = parseInt(customId.replace('slot_spin_', ''));
        return await slotMachine.executeSpin(interaction, betAmount);
    }
    
    // 자동 스핀
    else if (customId === 'slot_auto') {
        return await slotMachine.startAutoSpin(interaction);
    }
    
    // 자동 스핀 베팅 선택
    else if (customId.startsWith('auto_bet_')) {
        const betAmount = parseInt(customId.replace('auto_bet_', ''));
        // 속도 선택을 위해 세션에 저장
        slotMachine.sessions.set(interaction.user.id, { betAmount, step: 'speed' });
        return interaction.reply({ 
            content: '속도를 선택하세요.', 
            flags: 64 
        });
    }
    
    // 자동 스핀 속도 선택
    else if (customId.startsWith('auto_speed_')) {
        const speed = customId.replace('auto_speed_', '');
        const session = slotMachine.sessions.get(interaction.user.id);
        if (session && session.step === 'speed') {
            return await slotMachine.executeAutoSpin(interaction, session.betAmount, speed);
        }
    }
    
    // 자동 스핀 중지
    else if (customId === 'slot_stop_auto') {
        const session = slotMachine.sessions.get(interaction.user.id);
        if (session) {
            session.isRunning = false;
            return interaction.reply({ 
                content: '⏹️ 자동 스핀을 중지합니다...', 
                flags: 64 
            });
        }
    }
    
    // 기록 보기
    else if (customId === 'slot_history') {
        return await slotMachine.showHistory(interaction);
    }
    
    // 통계 보기
    else if (customId === 'slot_stats') {
        return await slotMachine.showStats(interaction);
    }
}

module.exports = {
    handleSlotMachineInteraction,
    slotMachine,
    SLOT_MACHINE
};