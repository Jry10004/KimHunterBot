const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const path = require('path');
const MissionHelper = require('../../utils/missionHelper');

// 몬스터 배틀 아레나 설정 (원본 그대로)
const MONSTER_BATTLE = {
    betOptions: {
        odd: { name: '홀수 레벨 몬스터', multiplier: 1.95, emoji: '⚡' },
        even: { name: '짝수 레벨 몬스터', multiplier: 1.95, emoji: '🌙' },
        small: { name: '약한 몬스터 (1-50)', multiplier: 1.95, emoji: '🐛' },
        big: { name: '강한 몬스터 (51-100)', multiplier: 1.95, emoji: '🐲' },
        lucky7: { name: '세븐 배수 몬스터', multiplier: 13.0, emoji: '🍀' },
        jackpot: { name: '정확한 레벨 예측', multiplier: 99.0, emoji: '💎' }
    },
    monsters: {
        weak: [
            { name: '슬라임', emoji: '🟢' },
            { name: '고블린', emoji: '👺' },
            { name: '늑대', emoji: '🐺' },
            { name: '오크', emoji: '🐗' },
            { name: '트롤', emoji: '👹' }
        ],
        strong: [
            { name: '오우거', emoji: '👾' },
            { name: '와이번', emoji: '🦅' },
            { name: '미노타우로스', emoji: '🐃' },
            { name: '리치', emoji: '💀' },
            { name: '드래곤', emoji: '🐉' }
        ]
    },
    streakBonus: {
        3: { multiplier: 1.2, message: '🔥 3연승 보너스!' },
        5: { multiplier: 1.5, message: '🌟 5연승 보너스!' },
        10: { multiplier: 2.0, message: '💎 10연승 보너스!' }
    },
    specialEvents: [
        {
            name: '💥 치명타!',
            chance: 0.1,
            multiplierBoost: 0.5,
            description: '치명타가 발동하여 추가 보상을 획득했습니다!'
        },
        {
            name: '🛡️ 몬스터의 분노',
            chance: 0.05,
            multiplierBoost: -0.5,
            description: '몬스터가 분노하여 보상이 감소했습니다...'
        },
        {
            name: '🌈 차원의 균열',
            chance: 0.03,
            multiplierBoost: 2.0,
            description: '차원의 균열이 열려 대량의 보상이 쏟아집니다!'
        }
    ]
};

// 🐉 몬스터 배틀 아레나 시스템 클래스
class MonsterBattleSystem {
    constructor() {
        this.gameStats = {
            totalGames: 0,
            recentNumbers: [], // 최근 100개 결과
            hotNumbers: new Map(), // 숫자별 등장 횟수
            biggestWins: [] // 최대 당첨 기록
        };
        this.activeGames = new Map(); // userId -> 게임 상태
    }

    // 몬스터 배틀 아레나 메인 메뉴
    async showMonsterBattleMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌  등록되지 않은 사용자입니다.', flags: 64 });
        }

        const stats = user.oddEvenStats || {};
        const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';

        const embed = new EmbedBuilder()
            .setTitle('🐉 몬스터 배틀 아레나 🐉')
            .setDescription('**⚔️ 배틀 방식:** 1~100 레벨 몬스터가 랜덤 등장! 몬스터의 특성을 예측하여 승부!\n' +
                '**✨ 다중 예측:** 여러 특성에 동시 예측 가능! (예: 홀수레벨+약한몬스터)\n\n' +
                '**🎯 예측 옵션:**\n' +
                '⚡ **홀수 레벨** (1,3,5,7...) - 보상 1.95배\n' +
                '🌙 **짝수 레벨** (2,4,6,8...) - 보상 1.95배\n' +
                '🐛 **약한 몬스터** (1~50레벨) - 보상 1.95배\n' +
                '🐲 **강한 몬스터** (51~100레벨) - 보상 1.95배\n' +
                '🍀 **세븐 배수 레벨** (7,14,21...) - 보상 13.0배\n' +
                '💎 **정확한 레벨 예측** (1~100레벨) - 보상 99.0배\n\n' +
                '**🗡️ 등장 몬스터:**\n' +
                '약한: 🟢슬라임 👺고블린 🐺늑대 🐗오크 👹트롤\n' +
                '강한: 👾오우거 🦅와이번 🐃미노타우로스 💀리치 🐉드래곤')
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 승률', value: `${winRate}%`, inline: true },
                { name: '🔥 연승', value: `${stats.currentStreak || 0}회`, inline: true },
                { name: '⚔️ 총 배틀', value: `${stats.totalGames || 0}회`, inline: true },
                { name: '💎 최대 보상', value: `${(stats.biggestWin || 0).toLocaleString()}G`, inline: true },
                { name: '📈 총 수익', value: `${((stats.totalWinnings || 0) - (stats.totalBets || 0)).toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700')
            .setImage('attachment://kim_battle_start.gif');

        // 최근 몬스터 등장 기록
        if (this.gameStats.recentNumbers.length > 0) {
            const recent = this.gameStats.recentNumbers.slice(-10).reverse();
            embed.addFields({
                name: '👹 최근 등장 몬스터',
                value: recent.map(level => {
                    const isOdd = level % 2 === 1;
                    const isWeak = level <= 50;
                    return `\`Lv.${level}\` ${isOdd ? '⚡' : '🌙'}${isWeak ? '🐛' : '🐲'}`;
                }).join(' '),
                inline: false
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_battle_start')
                    .setLabel('⚔️ 배틀 참가')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_stats')
                    .setLabel('📊 헌터 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('monster_history')
                    .setLabel('📜 배틀 기록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        // GIF 파일 첨부
        const files = [];
        try {
            const gifPath = path.join(__dirname, '../../resource', 'kim_battle_start.gif');
            if (require('fs').existsSync(gifPath)) {
                files.push(new AttachmentBuilder(gifPath, { name: 'kim_battle_start.gif' }));
            }
        } catch (error) {
            console.error('GIF 파일 로드 오류:', error);
        }

        // interaction 응답 처리
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ 
                embeds: [embed], 
                components: [row], 
                files
            });
        } else {
            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                files,
                flags: 64 
            });
        }
    }

    // 배틀 시작 버튼 처리
    async handleBattleStart(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ 몬스터와의 대결 준비')
            .setDescription('어떤 특성의 몬스터가 나올지 예측하세요!\n여러 옵션에 동시 베팅이 가능합니다.')
            .addFields(
                { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700');

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_bet_odd')
                    .setLabel('⚡ 홀수 레벨 (x1.95)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_bet_even')
                    .setLabel('🌙 짝수 레벨 (x1.95)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_bet_small')
                    .setLabel('🐛 약한 몬스터 (x1.95)')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_bet_big')
                    .setLabel('🐲 강한 몬스터 (x1.95)')
                    .setStyle(ButtonStyle.Primary)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_bet_lucky7')
                    .setLabel('🍀 세븐 배수 (x13.0)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('monster_bet_jackpot')
                    .setLabel('💎 정확한 레벨 (x99.0)')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('monster_cancel')
                    .setLabel('❌ 취소')
                    .setStyle(ButtonStyle.Secondary)
            );

        // 현재 베팅 상태 초기화
        this.activeGames.set(interaction.user.id, {
            bets: new Map(),
            totalBet: 0,
            startTime: Date.now()
        });

        await interaction.update({ embeds: [embed], components: [row1, row2] });
    }

    // 베팅 옵션 선택 처리
    async handleBetOption(interaction, betType) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const gameState = this.activeGames.get(interaction.user.id);
        if (!gameState) {
            return interaction.reply({ content: '❌ 게임 상태를 찾을 수 없습니다.', flags: 64 });
        }

        // 베팅 금액 입력 버튼 생성
        const embed = new EmbedBuilder()
            .setTitle(`${MONSTER_BATTLE.betOptions[betType].emoji} ${MONSTER_BATTLE.betOptions[betType].name}`)
            .setDescription('베팅할 골드를 선택하세요.')
            .addFields(
                { name: '💰 보유 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '📊 배율', value: `${MONSTER_BATTLE.betOptions[betType].multiplier}x`, inline: true }
            )
            .setColor('#FFD700');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`monster_amount_${betType}_1000`)
                    .setLabel('1,000G')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`monster_amount_${betType}_5000`)
                    .setLabel('5,000G')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`monster_amount_${betType}_10000`)
                    .setLabel('10,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`monster_amount_${betType}_50000`)
                    .setLabel('50,000G')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`monster_amount_${betType}_all`)
                    .setLabel('올인')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({ embeds: [embed], components: [row] });
    }

    // 베팅 금액 처리 및 게임 진행
    async handleBetAmount(interaction, betType, amount) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const gameState = this.activeGames.get(interaction.user.id);
        if (!gameState) {
            return interaction.reply({ content: '❌ 게임 상태를 찾을 수 없습니다.', flags: 64 });
        }

        // 올인 처리
        let betAmount = amount === 'all' ? user.gold : parseInt(amount);
        
        if (betAmount > user.gold) {
            return interaction.reply({ content: '❌ 골드가 부족합니다!', flags: 64 });
        }

        if (betAmount <= 0) {
            return interaction.reply({ content: '❌ 올바른 금액을 입력하세요!', flags: 64 });
        }

        // 베팅 저장
        gameState.bets.set(betType, betAmount);
        gameState.totalBet += betAmount;

        // 추가 베팅 또는 게임 시작
        const embed = new EmbedBuilder()
            .setTitle('⚔️ 베팅 완료')
            .setDescription('추가로 베팅하시거나 배틀을 시작하세요!')
            .addFields(
                { name: '💰 총 베팅액', value: `${gameState.totalBet.toLocaleString()}G`, inline: true },
                { name: '🎯 현재 베팅', value: Array.from(gameState.bets.entries())
                    .map(([type, amt]) => `${MONSTER_BATTLE.betOptions[type].emoji} ${MONSTER_BATTLE.betOptions[type].name}: ${amt.toLocaleString()}G`)
                    .join('\n'), inline: false }
            )
            .setColor('#FFD700');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_more_bet')
                    .setLabel('➕ 추가 베팅')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_start_battle')
                    .setLabel('⚔️ 배틀 시작!')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('monster_cancel')
                    .setLabel('❌ 취소')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({ embeds: [embed], components: [row] });
    }

    // 실제 배틀 진행
    async executeBattle(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const gameState = this.activeGames.get(interaction.user.id);
        if (!gameState || gameState.bets.size === 0) {
            return interaction.reply({ content: '❌ 먼저 베팅을 해주세요!', flags: 64 });
        }

        // 골드 차감
        if (user.gold < gameState.totalBet) {
            return interaction.reply({ content: '❌ 골드가 부족합니다!', flags: 64 });
        }

        user.gold -= gameState.totalBet;

        // 몬스터 레벨 결정 (1-100)
        const resultNumber = Math.floor(Math.random() * 100) + 1;
        const isOdd = resultNumber % 2 === 1;
        const isSmall = resultNumber <= 50;
        const isLucky7 = resultNumber % 7 === 0;

        // 몬스터 선택
        const monsterArray = isSmall ? MONSTER_BATTLE.monsters.weak : MONSTER_BATTLE.monsters.strong;
        const monster = monsterArray[Math.floor(Math.random() * monsterArray.length)];

        // 결과 계산
        let totalWin = 0;
        const winningBets = [];

        for (const [betType, betAmount] of gameState.bets) {
            let won = false;
            let multiplier = MONSTER_BATTLE.betOptions[betType].multiplier;

            switch (betType) {
                case 'odd': won = isOdd; break;
                case 'even': won = !isOdd; break;
                case 'small': won = isSmall; break;
                case 'big': won = !isSmall; break;
                case 'lucky7': won = isLucky7; break;
                case 'jackpot':
                    // 잭팟은 정확한 숫자를 맞춰야 함 (사용자가 입력한 숫자와 비교)
                    // 임시로 1% 확률로 설정
                    won = Math.random() < 0.01;
                    break;
            }

            if (won) {
                const winAmount = Math.floor(betAmount * multiplier);
                totalWin += winAmount;
                winningBets.push(`${MONSTER_BATTLE.betOptions[betType].emoji} ${MONSTER_BATTLE.betOptions[betType].name}: ${winAmount.toLocaleString()}G`);
            }
        }

        // 연승 처리
        const stats = user.oddEvenStats || {
            totalGames: 0,
            wins: 0,
            losses: 0,
            currentStreak: 0,
            bestStreak: 0,
            totalBets: 0,
            totalWinnings: 0,
            biggestWin: 0
        };

        stats.totalGames++;
        stats.totalBets += gameState.totalBet;

        let specialEvent = null;
        let finalMultiplier = 1.0;
        let bonusApplied = false;
        let bonusAmount = 0;

        if (totalWin > 0) {
            stats.wins++;
            stats.currentStreak++;
            stats.totalWinnings += totalWin;

            if (stats.currentStreak > stats.bestStreak) {
                stats.bestStreak = stats.currentStreak;
            }

            if (totalWin > stats.biggestWin) {
                stats.biggestWin = totalWin;
            }

            // 연승 보너스
            for (const [streakNum, bonus] of Object.entries(MONSTER_BATTLE.streakBonus)) {
                if (stats.currentStreak >= parseInt(streakNum)) {
                    finalMultiplier = bonus.multiplier;
                    totalWin = Math.floor(totalWin * bonus.multiplier);
                }
            }

            // 특별 이벤트
            for (const event of MONSTER_BATTLE.specialEvents) {
                if (Math.random() < event.chance) {
                    specialEvent = event;
                    totalWin = Math.floor(totalWin * (1 + event.multiplierBoost));
                    break;
                }
            }

            // 버그 사냥꾼 칭호 효과 적용
            const { applyMinigameBonus } = require('../common/specialEffects');
            const originalWin = totalWin;
            totalWin = applyMinigameBonus(totalWin, user);
            
            if (totalWin > originalWin) {
                bonusApplied = true;
                bonusAmount = totalWin - originalWin;
                console.log(`[MonsterBattle] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalWin} → ${totalWin} (+${bonusAmount})`);
            }
            
            user.gold += totalWin;
            
            // 미션 업데이트
            await MissionHelper.updateMiniGame(interaction.user.id);
            await MissionHelper.updateGoldEarned(interaction.user.id, totalWin);
        } else {
            stats.losses++;
            stats.currentStreak = 0;
            
            // 미션 업데이트 (패배해도 미니게임 플레이 카운트)
            await MissionHelper.updateMiniGame(interaction.user.id);
        }

        user.oddEvenStats = stats;

        // 통계 업데이트
        this.gameStats.totalGames++;
        this.gameStats.recentNumbers.push(resultNumber);
        if (this.gameStats.recentNumbers.length > 100) {
            this.gameStats.recentNumbers.shift();
        }

        const hotCount = this.gameStats.hotNumbers.get(resultNumber) || 0;
        this.gameStats.hotNumbers.set(resultNumber, hotCount + 1);

        await user.save();

        // 결과 표시
        const won = totalWin > 0;
        const payout = totalWin;

        const embed = new EmbedBuilder()
            .setTitle('⚔️ 몬스터 배틀 아레나 결과 ⚔️')
            .setDescription(`**${monster.emoji} Lv.${resultNumber} ${monster.name} 등장!**\n\n${isOdd ? '⚡ 홀수 레벨' : '🌙 짝수 레벨'} | ${isSmall ? '🐛 약한 몬스터' : '🐲 강한 몬스터'}`)
            .addFields(
                { name: '🎯 베팅', value: Array.from(gameState.bets.entries())
                    .map(([type, amt]) => `${MONSTER_BATTLE.betOptions[type].emoji} ${MONSTER_BATTLE.betOptions[type].name}: ${amt.toLocaleString()}G`)
                    .join('\n'), inline: true },
                { name: '📊 결과', value: won ? '🎉 승리!' : '💀 패배!', inline: true },
                { name: '💰 골드', value: `${user.gold.toLocaleString()}G`, inline: true }
            )
            .setColor(won ? '#00FF00' : '#FF0000')
            .setThumbnail(`attachment://${won ? 'kim_battle_victory.gif' : 'kim_battle_defeat.gif'}`);

        if (won) {
            embed.addFields(
                { name: '💎 당첨금', value: `${payout.toLocaleString()}G`, inline: true },
                { name: '📈 배율', value: `${finalMultiplier.toFixed(2)}x`, inline: true },
                { name: '🔥 연승', value: `${stats.currentStreak}회`, inline: true }
            );

            if (winningBets.length > 0) {
                embed.addFields({
                    name: '🏆 당첨 내역',
                    value: winningBets.join('\n'),
                    inline: false
                });
            }
            
            if (bonusApplied) {
                embed.addFields({
                    name: '🏷️ 칭호 효과',
                    value: `**버그 사냥꾼** 효과로 +${bonusAmount.toLocaleString()}G 추가 획득!`,
                    inline: false
                });
            }
        }

        if (specialEvent) {
            embed.addFields({
                name: `✨ ${specialEvent.name}`,
                value: specialEvent.description,
                inline: false
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_battle_start')
                    .setLabel('🔄 다시 도전')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('monster_menu')
                    .setLabel('📋 메뉴로')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        // GIF 파일 첨부
        const files = [];
        try {
            const gifName = won ? 'kim_battle_victory.gif' : 'kim_battle_defeat.gif';
            const gifPath = path.join(__dirname, '../../resource', gifName);
            if (require('fs').existsSync(gifPath)) {
                files.push(new AttachmentBuilder(gifPath, { name: gifName }));
            }
        } catch (error) {
            console.error('GIF 파일 로드 오류:', error);
        }

        // 게임 상태 정리
        this.activeGames.delete(interaction.user.id);

        await interaction.update({ embeds: [embed], components: [row], files });
    }

    // 취소 처리
    async handleCancel(interaction) {
        this.activeGames.delete(interaction.user.id);
        await this.showMonsterBattleMenu(interaction);
    }

    // 통계 표시
    async showStats(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const stats = user.oddEvenStats || {
            totalGames: 0,
            wins: 0,
            losses: 0,
            currentStreak: 0,
            bestStreak: 0,
            totalBets: 0,
            totalWinnings: 0,
            biggestWin: 0
        };

        const winRate = stats.totalGames > 0 ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0.0';
        const profit = stats.totalWinnings - stats.totalBets;
        const avgBet = stats.totalGames > 0 ? Math.floor(stats.totalBets / stats.totalGames) : 0;

        const embed = new EmbedBuilder()
            .setTitle('📊 몬스터 배틀 아레나 전적 📊')
            .setDescription(`${interaction.user.username}님의 헌터 기록`)
            .addFields(
                { name: '⚔️ 총 배틀', value: `${stats.totalGames}회`, inline: true },
                { name: '🏆 승리', value: `${stats.wins}회`, inline: true },
                { name: '💀 패배', value: `${stats.losses}회`, inline: true },
                { name: '🎯 승률', value: `${winRate}%`, inline: true },
                { name: '🔥 현재 연승', value: `${stats.currentStreak}회`, inline: true },
                { name: '⭐ 최고 연승', value: `${stats.bestStreak}회`, inline: true },
                { name: '💰 총 베팅', value: `${stats.totalBets.toLocaleString()}G`, inline: true },
                { name: '💎 총 획득', value: `${stats.totalWinnings.toLocaleString()}G`, inline: true },
                { name: '📈 순수익', value: `${profit.toLocaleString()}G`, inline: true },
                { name: '💸 평균 베팅', value: `${avgBet.toLocaleString()}G`, inline: true },
                { name: '🏅 최대 당첨', value: `${stats.biggestWin.toLocaleString()}G`, inline: true }
            )
            .setColor('#FFD700')
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({ embeds: [embed], components: [row] });
    }

    // 히스토리 표시
    async showHistory(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📜 몬스터 배틀 히스토리 📜')
            .setDescription('최근 100회 몬스터 등장 기록')
            .setColor('#FFD700');

        if (this.gameStats.recentNumbers.length === 0) {
            embed.addFields({
                name: '📊 기록',
                value: '아직 배틀 기록이 없습니다.',
                inline: false
            });
        } else {
            // 최근 50개 표시
            const recent = this.gameStats.recentNumbers.slice(-50).reverse();
            const chunks = [];
            for (let i = 0; i < recent.length; i += 10) {
                chunks.push(recent.slice(i, i + 10));
            }

            chunks.forEach((chunk, index) => {
                embed.addFields({
                    name: `📊 ${index * 10 + 1}-${index * 10 + chunk.length}번째`,
                    value: chunk.map(level => {
                        const isOdd = level % 2 === 1;
                        const isWeak = level <= 50;
                        return `\`${String(level).padStart(3)}\` ${isOdd ? '⚡' : '🌙'}${isWeak ? '🐛' : '🐲'}`;
                    }).join(' '),
                    inline: false
                });
            });

            // 통계
            const oddCount = recent.filter(n => n % 2 === 1).length;
            const evenCount = recent.filter(n => n % 2 === 0).length;
            const weakCount = recent.filter(n => n <= 50).length;
            const strongCount = recent.filter(n => n > 50).length;

            embed.addFields({
                name: '📈 통계 (최근 50회)',
                value: `⚡ 홀수: ${oddCount}회 (${(oddCount/50*100).toFixed(1)}%)\n` +
                       `🌙 짝수: ${evenCount}회 (${(evenCount/50*100).toFixed(1)}%)\n` +
                       `🐛 약한: ${weakCount}회 (${(weakCount/50*100).toFixed(1)}%)\n` +
                       `🐲 강한: ${strongCount}회 (${(strongCount/50*100).toFixed(1)}%)`,
                inline: false
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('monster_menu')
                    .setLabel('🔙 돌아가기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({ embeds: [embed], components: [row] });
    }
}

// 싱글톤 인스턴스
const monsterBattle = new MonsterBattleSystem();

// 인터랙션 핸들러
async function handleMonsterBattleInteraction(interaction) {
    const customId = interaction.customId;

    if (customId === 'monster_menu' || customId === 'monster_battle') {
        return await monsterBattle.showMonsterBattleMenu(interaction);
    } else if (customId.startsWith('monster_bet_')) {
        const betType = customId.replace('monster_bet_', '');
        return await monsterBattle.handleBetOption(interaction, betType);
    } else if (customId.startsWith('monster_amount_')) {
        const parts = customId.split('_');
        const betType = parts[2];
        const amount = parts[3];
        return await monsterBattle.handleBetAmount(interaction, betType, amount);
    } else if (customId === 'monster_battle_start' || customId === 'monster_more_bet') {
        return await monsterBattle.handleBattleStart(interaction);
    } else if (customId === 'monster_start_battle') {
        return await monsterBattle.executeBattle(interaction);
    } else if (customId === 'monster_cancel') {
        return await monsterBattle.handleCancel(interaction);
    } else if (customId === 'monster_stats') {
        return await monsterBattle.showStats(interaction);
    } else if (customId === 'monster_history') {
        return await monsterBattle.showHistory(interaction);
    }
}

module.exports = {
    handleMonsterBattleInteraction,
    monsterBattle,
    MONSTER_BATTLE
};