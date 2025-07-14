const { 
    EmbedBuilder, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const User = require('../../models/User');
const { 
    LOL_INHOUSE_DATA, 
    balanceTeams, 
    randomizeTeams, 
    calculateWinners, 
    distributeRewards 
} = require('../../data/lolInhouseData');
const MissionHelper = require('../../utils/missionHelper');

// 진행중인 세션 관리
const activeSessions = new Map();

class LolInhouseSystem {
    constructor() {
        this.sessions = activeSessions;
    }

    // 메인 메뉴 표시
    async showMainMenu(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎮 LOL 내전 게임')
            .setDescription(
                '**League of Legends 내전을 즐겨보세요!**\n\n' +
                '📋 **게임 방식**\n' +
                '• 호스트가 방을 생성하고 배팅 금액을 설정\n' +
                '• 참가자들이 롤 닉네임과 티어를 입력하여 참가\n' +
                '• 팀 배정 후 실제 게임 진행\n' +
                '• 라운드별 승리 기록\n' +
                '• 최종 최다 승리자들이 상금을 나눠 가짐\n\n' +
                '💰 **배팅 옵션**: 5만 / 10만 / 30만 / 50만 / 100만 골드'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎮 진행중인 방', value: `${this.sessions.size}개`, inline: true },
                { name: '👥 최대 인원', value: '10명 (5v5)', inline: true }
            )
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lol_create_room')
                    .setLabel('🏠 방 만들기')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('lol_room_list')
                    .setLabel('📋 방 목록')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('lol_my_stats')
                    .setLabel('📊 내 전적')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });
    }

    // 방 만들기
    async createRoom(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 배팅 금액 선택 메뉴
        const betEmbed = new EmbedBuilder()
            .setTitle('💰 배팅 금액 선택')
            .setDescription('방에 참가하는 모든 플레이어가 지불할 금액을 선택하세요.')
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        const betButtons = new ActionRowBuilder();
        LOL_INHOUSE_DATA.betAmounts.forEach((bet, index) => {
            betButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_bet_${bet.value}`)
                    .setLabel(`${bet.emoji} ${bet.label}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(user.gold < bet.value)
            );
        });

        const cancelButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lol_main_menu')
                    .setLabel('❌ 취소')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.reply({
            embeds: [betEmbed],
            components: [betButtons, cancelButton]
        });
    }

    // 배팅 금액 선택 후 모드 선택
    async selectGameMode(interaction, betAmount) {
        const sessionId = `lol_${Date.now()}_${interaction.user.id}`;
        
        // 세션 초기화
        this.sessions.set(sessionId, {
            id: sessionId,
            host: interaction.user.id,
            betAmount: betAmount,
            participants: [],
            rounds: [],
            status: 'setting',
            createdAt: Date.now(),
            mode: null,
            balanceMode: null
        });

        const modeEmbed = new EmbedBuilder()
            .setTitle('⚙️ 게임 모드 설정')
            .setDescription(`배팅 금액: **${betAmount.toLocaleString()}** 골드\n\n팀 구성 방식을 선택하세요.`)
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        const modeButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_mode_random_${sessionId}`)
                    .setLabel('🎲 팀 랜덤')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`lol_mode_manual_${sessionId}`)
                    .setLabel('✋ 팀 수동')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [modeEmbed],
            components: [modeButtons]
        });
    }

    // 랜덤 모드 선택 시 밸런싱 옵션
    async selectBalanceMode(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        session.mode = 'random';

        const balanceEmbed = new EmbedBuilder()
            .setTitle('⚖️ 팀 밸런싱 설정')
            .setDescription('랜덤 팀 구성 시 실력 밸런싱 여부를 선택하세요.')
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        const balanceButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_balance_on_${sessionId}`)
                    .setLabel('⚖️ 실력 맞추기')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`lol_balance_off_${sessionId}`)
                    .setLabel('🎲 완전 랜덤')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [balanceEmbed],
            components: [balanceButtons]
        });
    }

    // 방 생성 완료
    async finalizeRoom(interaction, sessionId, balanceMode = null) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        const user = await User.findOne({ discordId: interaction.user.id });
        
        // 호스트 참가 처리
        session.balanceMode = balanceMode;
        session.status = 'waiting';
        session.participants.push({
            userId: interaction.user.id,
            username: interaction.user.username,
            lolNickname: '호스트',
            tier: 'UNRANKED',
            wins: 0,
            currentTeam: null,
            isHost: true
        });

        // 호스트 골드 차감
        user.gold -= session.betAmount;
        await user.save();

        await this.showRoomLobby(interaction, sessionId);
    }

    // 방 로비 표시
    async showRoomLobby(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        const host = await interaction.client.users.fetch(session.host);
        const modeText = session.mode === 'random' ? 
            `🎲 팀 랜덤 (${session.balanceMode === 'balanced' ? '실력 맞추기' : '완전 랜덤'})` : 
            '✋ 팀 수동';

        const lobbyEmbed = new EmbedBuilder()
            .setTitle(`🏠 LOL 내전 대기실`)
            .setDescription(
                `**호스트**: ${host.username}\n` +
                `**배팅 금액**: ${session.betAmount.toLocaleString()} 골드\n` +
                `**모드**: ${modeText}\n` +
                `**참가자**: ${session.participants.length}/${LOL_INHOUSE_DATA.settings.maxPlayers}명`
            )
            .setColor(LOL_INHOUSE_DATA.colors.primary)
            .setFooter({ text: `방 ID: ${sessionId}` });

        // 참가자 목록
        if (session.participants.length > 0) {
            const participantList = session.participants.map((p, i) => {
                const tierData = LOL_INHOUSE_DATA.tiers.find(t => t.value === p.tier) || LOL_INHOUSE_DATA.tiers[10];
                return `${i + 1}. **${p.username}** - ${p.lolNickname} ${tierData.emoji} ${tierData.label}`;
            }).join('\n');
            
            lobbyEmbed.addFields({
                name: '👥 참가자 목록',
                value: participantList || '없음',
                inline: false
            });
        }

        const lobbyButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_join_${sessionId}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(session.participants.length >= LOL_INHOUSE_DATA.settings.maxPlayers),
                new ButtonBuilder()
                    .setCustomId(`lol_leave_${sessionId}`)
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`lol_start_${sessionId}`)
                    .setLabel('🚀 게임 시작')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(session.participants.length < LOL_INHOUSE_DATA.settings.minPlayers || interaction.user.id !== session.host)
            );

        const hostButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_cancel_${sessionId}`)
                    .setLabel('❌ 방 폭파')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(interaction.user.id !== session.host)
            );

        await interaction.update({
            embeds: [lobbyEmbed],
            components: [lobbyButtons, hostButtons]
        });
    }

    // 참가 모달 생성
    async showJoinModal(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        // 이미 참가했는지 확인
        if (session.participants.find(p => p.userId === interaction.user.id)) {
            return interaction.reply({ 
                content: LOL_INHOUSE_DATA.messages.alreadyJoined, 
                flags: 64 
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`lol_join_modal_${sessionId}`)
            .setTitle('LOL 내전 참가');

        const nicknameInput = new TextInputBuilder()
            .setCustomId('lol_nickname')
            .setLabel('롤 닉네임')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Hide on bush')
            .setRequired(true)
            .setMaxLength(16);

        const tierSelect = new TextInputBuilder()
            .setCustomId('lol_tier')
            .setLabel('최고 티어 (영문 대문자로 입력)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('DIAMOND, PLATINUM, GOLD 등')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(nicknameInput),
            new ActionRowBuilder().addComponents(tierSelect)
        );

        await interaction.showModal(modal);
    }

    // 참가 처리
    async handleJoin(interaction, sessionId, lolNickname, tier) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 골드 확인
        if (user.gold < session.betAmount) {
            return interaction.reply({ 
                content: LOL_INHOUSE_DATA.messages.insufficientGold, 
                flags: 64 
            });
        }

        // 티어 유효성 검사
        const upperTier = tier.toUpperCase();
        if (!LOL_INHOUSE_DATA.tierPoints.hasOwnProperty(upperTier)) {
            return interaction.reply({ 
                content: '❌ 올바른 티어를 입력해주세요. (예: DIAMOND, GOLD)', 
                flags: 64 
            });
        }

        // 참가 처리
        session.participants.push({
            userId: interaction.user.id,
            username: interaction.user.username,
            lolNickname: lolNickname,
            tier: upperTier,
            wins: 0,
            currentTeam: null,
            isHost: false
        });

        // 골드 차감
        user.gold -= session.betAmount;
        await user.save();

        // 로비 업데이트
        await this.updateLobby(interaction, sessionId);
    }

    // 로비 업데이트
    async updateLobby(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const host = await interaction.client.users.fetch(session.host);
        const modeText = session.mode === 'random' ? 
            `🎲 팀 랜덤 (${session.balanceMode === 'balanced' ? '실력 맞추기' : '완전 랜덤'})` : 
            '✋ 팀 수동';

        const lobbyEmbed = new EmbedBuilder()
            .setTitle(`🏠 LOL 내전 대기실`)
            .setDescription(
                `**호스트**: ${host.username}\n` +
                `**배팅 금액**: ${session.betAmount.toLocaleString()} 골드\n` +
                `**모드**: ${modeText}\n` +
                `**참가자**: ${session.participants.length}/${LOL_INHOUSE_DATA.settings.maxPlayers}명`
            )
            .setColor(LOL_INHOUSE_DATA.colors.primary)
            .setFooter({ text: `방 ID: ${sessionId}` });

        // 참가자 목록
        const participantList = session.participants.map((p, i) => {
            const tierData = LOL_INHOUSE_DATA.tiers.find(t => t.value === p.tier) || LOL_INHOUSE_DATA.tiers[10];
            return `${i + 1}. **${p.username}** - ${p.lolNickname} ${tierData.emoji} ${tierData.label}`;
        }).join('\n');
        
        lobbyEmbed.addFields({
            name: '👥 참가자 목록',
            value: participantList || '없음',
            inline: false
        });

        const lobbyButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_join_${sessionId}`)
                    .setLabel('🎮 참가하기')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(session.participants.length >= LOL_INHOUSE_DATA.settings.maxPlayers),
                new ButtonBuilder()
                    .setCustomId(`lol_leave_${sessionId}`)
                    .setLabel('🚪 나가기')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`lol_start_${sessionId}`)
                    .setLabel('🚀 게임 시작')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(session.participants.length < LOL_INHOUSE_DATA.settings.minPlayers || interaction.user.id !== session.host)
            );

        const hostButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_cancel_${sessionId}`)
                    .setLabel('❌ 방 폭파')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(interaction.user.id !== session.host)
            );

        await interaction.update({
            embeds: [lobbyEmbed],
            components: [lobbyButtons, hostButtons]
        });
    }

    // 게임 시작
    async startGame(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return interaction.reply({ content: '❌ 세션을 찾을 수 없습니다.', flags: 64 });
        }

        session.status = 'playing';
        session.rounds.push({
            roundNumber: 1,
            teams: { blue: [], red: [] },
            winner: null,
            timestamp: Date.now()
        });

        // 팀 배정
        if (session.mode === 'random') {
            if (session.balanceMode === 'balanced') {
                const balanced = balanceTeams(session.participants);
                session.rounds[0].teams.blue = balanced.blueTeam;
                session.rounds[0].teams.red = balanced.redTeam;
            } else {
                const randomized = randomizeTeams(session.participants);
                session.rounds[0].teams.blue = randomized.blueTeam;
                session.rounds[0].teams.red = randomized.redTeam;
            }
        }

        await this.showGameScreen(interaction, sessionId);
    }

    // 게임 화면 표시
    async showGameScreen(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const currentRound = session.rounds[session.rounds.length - 1];
        const totalPot = session.betAmount * session.participants.length;

        const gameEmbed = new EmbedBuilder()
            .setTitle(`⚔️ LOL 내전 - 라운드 ${currentRound.roundNumber}`)
            .setDescription(`총 상금: **${totalPot.toLocaleString()}** 골드`)
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        // 블루팀
        const blueTeamText = currentRound.teams.blue.map(p => {
            const tierData = LOL_INHOUSE_DATA.tiers.find(t => t.value === p.tier) || LOL_INHOUSE_DATA.tiers[10];
            return `${tierData.emoji} **${p.lolNickname}** (${p.username})`;
        }).join('\n');

        // 레드팀
        const redTeamText = currentRound.teams.red.map(p => {
            const tierData = LOL_INHOUSE_DATA.tiers.find(t => t.value === p.tier) || LOL_INHOUSE_DATA.tiers[10];
            return `${tierData.emoji} **${p.lolNickname}** (${p.username})`;
        }).join('\n');

        gameEmbed.addFields(
            { 
                name: '🔵 블루팀', 
                value: blueTeamText || '없음', 
                inline: true 
            },
            { 
                name: '🔴 레드팀', 
                value: redTeamText || '없음', 
                inline: true 
            }
        );

        // 현재 승수 표시
        const winCounts = session.participants.map(p => 
            `**${p.username}**: ${p.wins}승`
        ).join(' | ');
        
        gameEmbed.addFields({
            name: '🏆 현재 승수',
            value: winCounts,
            inline: false
        });

        const gameButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_winner_blue_${sessionId}`)
                    .setLabel('🔵 블루팀 승리')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(interaction.user.id !== session.host || currentRound.winner !== null),
                new ButtonBuilder()
                    .setCustomId(`lol_winner_red_${sessionId}`)
                    .setLabel('🔴 레드팀 승리')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(interaction.user.id !== session.host || currentRound.winner !== null)
            );

        const nextButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_next_round_${sessionId}`)
                    .setLabel('➡️ 다음 라운드')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(interaction.user.id !== session.host || currentRound.winner === null),
                new ButtonBuilder()
                    .setCustomId(`lol_end_game_${sessionId}`)
                    .setLabel('🏁 게임 종료')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(interaction.user.id !== session.host || currentRound.winner === null)
            );

        await interaction.update({
            embeds: [gameEmbed],
            components: [gameButtons, nextButtons]
        });
    }

    // 승자 선택
    async selectWinner(interaction, sessionId, winnerTeam) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const currentRound = session.rounds[session.rounds.length - 1];
        currentRound.winner = winnerTeam;

        // 승리 카운트 증가
        currentRound.teams[winnerTeam].forEach(participant => {
            const p = session.participants.find(part => part.userId === participant.userId);
            if (p) p.wins++;
        });

        await this.showGameScreen(interaction, sessionId);
    }

    // 다음 라운드 선택
    async showNextRoundOptions(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const optionsEmbed = new EmbedBuilder()
            .setTitle('🔄 다음 라운드 설정')
            .setDescription('팀을 유지하시겠습니까, 아니면 다시 섞으시겠습니까?')
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        const optionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`lol_keep_teams_${sessionId}`)
                    .setLabel('👥 팀 유지')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`lol_shuffle_teams_${sessionId}`)
                    .setLabel('🔄 팀 섞기')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [optionsEmbed],
            components: [optionButtons]
        });
    }

    // 다음 라운드 시작
    async startNextRound(interaction, sessionId, keepTeams) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const lastRound = session.rounds[session.rounds.length - 1];
        const newRound = {
            roundNumber: lastRound.roundNumber + 1,
            teams: { blue: [], red: [] },
            winner: null,
            timestamp: Date.now()
        };

        if (keepTeams) {
            // 팀 유지
            newRound.teams = { ...lastRound.teams };
        } else {
            // 팀 재배정
            if (session.balanceMode === 'balanced') {
                const balanced = balanceTeams(session.participants);
                newRound.teams.blue = balanced.blueTeam;
                newRound.teams.red = balanced.redTeam;
            } else {
                const randomized = randomizeTeams(session.participants);
                newRound.teams.blue = randomized.blueTeam;
                newRound.teams.red = randomized.redTeam;
            }
        }

        session.rounds.push(newRound);
        await this.showGameScreen(interaction, sessionId);
    }

    // 게임 종료
    async endGame(interaction, sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.status = 'finished';

        // 승자 계산
        const winners = calculateWinners(session.participants);
        const totalPot = session.betAmount * session.participants.length;
        const rewards = distributeRewards(winners, totalPot);

        // 보상 지급
        const bonusRewards = new Map(); // 칭호 효과로 추가된 보상 저장
        for (const reward of rewards) {
            const user = await User.findOne({ discordId: reward.userId });
            if (user) {
                // 버그 사냥꾼 칭호 효과 적용
                const { applyMinigameBonus } = require('../common/specialEffects');
                const originalReward = reward.reward;
                const finalReward = applyMinigameBonus(reward.reward, user);
                
                if (finalReward > originalReward) {
                    const bonusAmount = finalReward - originalReward;
                    bonusRewards.set(reward.userId, bonusAmount);
                    console.log(`[LolInhouse] ${user.nickname || user.discordId} - 특수 효과 적용: ${originalReward} → ${finalReward} (+${bonusAmount})`);
                }
                
                user.gold += finalReward;
                reward.reward = finalReward; // 표시를 위해 reward 객체 업데이트
                await user.save();
                
                // 골드 획득 미션 업데이트
                await MissionHelper.updateGoldEarned(reward.userId, finalReward);
            }
        }
        
        // 모든 참가자의 미니게임 미션 업데이트
        for (const participant of session.participants) {
            await MissionHelper.updateMiniGame(participant.userId);
        }

        // 결과 표시
        const resultEmbed = new EmbedBuilder()
            .setTitle('🏆 게임 종료!')
            .setDescription(`총 ${session.rounds.length}라운드가 진행되었습니다.`)
            .setColor(LOL_INHOUSE_DATA.colors.success);

        // 최종 순위
        const sortedParticipants = [...session.participants].sort((a, b) => b.wins - a.wins);
        
        // 유저 정보 가져오기
        const userIds = sortedParticipants.map(p => p.userId);
        const users = await User.find({ discordId: { $in: userIds } });
        const userMap = {};
        users.forEach(user => {
            userMap[user.discordId] = user;
        });
        
        const rankingText = sortedParticipants.map((p, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const isWinner = winners.some(w => w.userId === p.userId);
            const rewardText = isWinner ? ` (+${rewards.find(r => r.userId === p.userId).reward.toLocaleString()}G)` : '';
            const user = userMap[p.userId];
            const displayName = user?.nickname || user?.username || p.username;
            const bonusText = bonusRewards.has(p.userId) ? ` 🏷️` : '';
            return `${medal} **${displayName}** - ${p.wins}승${rewardText}${bonusText}`;
        }).join('\n');

        resultEmbed.addFields({
            name: '📊 최종 순위',
            value: rankingText,
            inline: false
        });
        
        if (bonusRewards.size > 0) {
            const bonusText = Array.from(bonusRewards.entries()).map(([userId, bonus]) => {
                const user = userMap[userId];
                const displayName = user?.nickname || user?.username || 'Unknown';
                return `**${displayName}**: +${bonus.toLocaleString()}G`;
            }).join('\n');
            
            resultEmbed.addFields({
                name: '🏷️ 버그 사냥꾼 칭호 효과',
                value: bonusText,
                inline: false
            });
        }

        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lol_main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Primary)
            );

        // 세션 삭제
        this.sessions.delete(sessionId);

        await interaction.update({
            embeds: [resultEmbed],
            components: [endButtons]
        });
    }

    // 방 목록 표시
    async showRoomList(interaction) {
        const activeRooms = Array.from(this.sessions.values()).filter(s => s.status === 'waiting');

        const listEmbed = new EmbedBuilder()
            .setTitle('📋 활성 방 목록')
            .setDescription(activeRooms.length > 0 ? '참가 가능한 방 목록입니다.' : '현재 활성화된 방이 없습니다.')
            .setColor(LOL_INHOUSE_DATA.colors.primary);

        if (activeRooms.length > 0) {
            activeRooms.forEach((room, index) => {
                const modeText = room.mode === 'random' ? 
                    `🎲 팀 랜덤 (${room.balanceMode === 'balanced' ? '실력 맞추기' : '완전 랜덤'})` : 
                    '✋ 팀 수동';
                
                listEmbed.addFields({
                    name: `🏠 방 ${index + 1}`,
                    value: `호스트: **${room.host}**\n` +
                           `배팅: ${room.betAmount.toLocaleString()}G\n` +
                           `모드: ${modeText}\n` +
                           `인원: ${room.participants.length}/${LOL_INHOUSE_DATA.settings.maxPlayers}명`,
                    inline: true
                });
            });
        }

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lol_main_menu')
                    .setLabel('🏠 메인 메뉴')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.reply({
            embeds: [listEmbed],
            components: [buttons]
        });
    }
}

// 인터랙션 핸들러
async function handleLolInhouseInteraction(interaction) {
    const system = new LolInhouseSystem();
    const customId = interaction.customId;

    // 메인 메뉴
    if (customId === 'lol_inhouse') {
        return await system.showMainMenu(interaction);
    }

    // 방 만들기
    if (customId === 'lol_create_room') {
        return await system.createRoom(interaction);
    }

    // 배팅 금액 선택
    if (customId.startsWith('lol_bet_')) {
        const betAmount = parseInt(customId.split('_')[2]);
        return await system.selectGameMode(interaction, betAmount);
    }

    // 게임 모드 선택
    if (customId.startsWith('lol_mode_')) {
        const parts = customId.split('_');
        const mode = parts[2];
        const sessionId = parts.slice(3).join('_');
        
        if (mode === 'random') {
            return await system.selectBalanceMode(interaction, sessionId);
        } else {
            return await system.finalizeRoom(interaction, sessionId, null);
        }
    }

    // 밸런싱 모드 선택
    if (customId.startsWith('lol_balance_')) {
        const parts = customId.split('_');
        const balanceMode = parts[2] === 'on' ? 'balanced' : 'random';
        const sessionId = parts.slice(3).join('_');
        return await system.finalizeRoom(interaction, sessionId, balanceMode);
    }

    // 참가하기
    if (customId.startsWith('lol_join_')) {
        const sessionId = customId.split('lol_join_')[1];
        return await system.showJoinModal(interaction, sessionId);
    }

    // 게임 시작
    if (customId.startsWith('lol_start_')) {
        const sessionId = customId.split('lol_start_')[1];
        return await system.startGame(interaction, sessionId);
    }

    // 승자 선택
    if (customId.startsWith('lol_winner_')) {
        const parts = customId.split('_');
        const team = parts[2];
        const sessionId = parts.slice(3).join('_');
        return await system.selectWinner(interaction, sessionId, team);
    }

    // 다음 라운드
    if (customId.startsWith('lol_next_round_')) {
        const sessionId = customId.split('lol_next_round_')[1];
        return await system.showNextRoundOptions(interaction, sessionId);
    }

    // 팀 유지/섞기
    if (customId.startsWith('lol_keep_teams_')) {
        const sessionId = customId.split('lol_keep_teams_')[1];
        return await system.startNextRound(interaction, sessionId, true);
    }
    if (customId.startsWith('lol_shuffle_teams_')) {
        const sessionId = customId.split('lol_shuffle_teams_')[1];
        return await system.startNextRound(interaction, sessionId, false);
    }

    // 게임 종료
    if (customId.startsWith('lol_end_game_')) {
        const sessionId = customId.split('lol_end_game_')[1];
        return await system.endGame(interaction, sessionId);
    }

    // 방 목록
    if (customId === 'lol_room_list') {
        return await system.showRoomList(interaction);
    }

    // 메인 메뉴로
    if (customId === 'lol_main_menu') {
        return await system.showMainMenu(interaction);
    }
}

// 모달 처리
async function handleLolInhouseModal(interaction) {
    const customId = interaction.customId;
    
    if (customId.startsWith('lol_join_modal_')) {
        const sessionId = customId.split('lol_join_modal_')[1];
        const lolNickname = interaction.fields.getTextInputValue('lol_nickname');
        const tier = interaction.fields.getTextInputValue('lol_tier');
        
        const system = new LolInhouseSystem();
        return await system.handleJoin(interaction, sessionId, lolNickname, tier);
    }
}

module.exports = {
    handleLolInhouseInteraction,
    handleLolInhouseModal
};