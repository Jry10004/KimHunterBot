const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const TIC_TAC_TOE_GAME = require('../../data/ticTacToeGame');

// 틱택토 대기열 및 세션 관리
const tictactoeMatchQueue = new Map(); // 유저 대전 대기열
const tictactoeGameSessions = new Map(); // 진행중인 게임 세션

// 틱택토 메인 메뉴
async function showTicTacToeMenu(interaction) {
    try {
        console.log('[TicTacToe] 메뉴 표시 시작:', interaction.user.username);
        
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        // 전적 계산
        const tictactoeData = user.tictactoeData || {
            wins: 0,
            losses: 0,
            draws: 0,
            currentStreak: 0,
            bestStreak: 0
        };
        
        const totalGames = tictactoeData.wins + tictactoeData.losses + tictactoeData.draws;
        const winRate = totalGames > 0 ? Math.round((tictactoeData.wins / totalGames) * 100) : 0;

        const embed = new EmbedBuilder()
            .setTitle('⭕ 틱택토 게임')
            .setDescription(
                '**🎯 게임 방식**: 3x3 격자에서 가로, 세로, 대각선으로 3개를 먼저 만들면 승리!\n' +
                '**⏱️ 제한 시간**: 각 턴마다 30초\n' +
                '**🏆 보상**: 승리 300,000G | 무승부 100,000G | 패배 50,000G\n\n' +
                '🎮 **플레이 모드를 선택하세요!**'
            )
            .addFields(
                { name: '💰 현재 골드', value: `${user.gold.toLocaleString()}G`, inline: true },
                { name: '🎯 승률', value: `${winRate}%`, inline: true },
                { name: '🔥 연승', value: `${tictactoeData.currentStreak || 0}회`, inline: true },
                { name: '🏆 전적', value: `${tictactoeData.wins}승 ${tictactoeData.draws}무 ${tictactoeData.losses}패`, inline: true },
                { name: '🎮 총 게임', value: `${totalGames}회`, inline: true },
                { name: '⭐ 최고 연승', value: `${tictactoeData.bestStreak || 0}회`, inline: true }
            )
            .setColor('#5865F2')
            .setFooter({ text: '프로필 사진이 게임판에 표시됩니다!' });

        const modeButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('tictactoe_bot')
                    .setLabel('🤖 봇과 플레이')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('tictactoe_user')
                    .setLabel('👥 유저와 플레이')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('tictactoe_stats')
                    .setLabel('📊 상세 통계')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [embed],
            components: [modeButtons]
        });

    } catch (error) {
        console.error('틱택토 메뉴 표시 오류:', error);
        console.error('상세 오류:', error.stack);
        
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({
                content: '❌ 메뉴를 표시하는 중 오류가 발생했습니다.',
                flags: 64
            });
        }
    }
}

// 유저 매칭 시작
async function startUserMatching(interaction) {
    try {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.reply({ content: '❌ 등록되지 않은 사용자입니다.', flags: 64 });
        }

        const userId = interaction.user.id;

        // 이미 게임 중인지 확인
        const existingGame = TIC_TAC_TOE_GAME.findGameByUserId(userId);
        if (existingGame) {
            // 기존 게임 강제 종료
            TIC_TAC_TOE_GAME.forceEndUserGames(userId);
            console.log(`[TicTacToe] 유저 ${userId}의 기존 게임 강제 종료`);
        }

        // 미니게임 채널로 이동
        const guild = interaction.guild;
        let gameCategory = guild.channels.cache.find(
            c => c.name === '🎮 미니게임' && c.type === 4
        );
        
        if (!gameCategory) {
            gameCategory = await guild.channels.create({
                name: '🎮 미니게임',
                type: 4,
                position: 99
            });
        }
        
        // 미니게임 채널 찾기 또는 생성
        let minigameChannel = guild.channels.cache.find(
            c => c.name === '🎮-대기실' && c.parentId === gameCategory.id
        );
        
        if (!minigameChannel) {
            minigameChannel = await guild.channels.create({
                name: '🎮-대기실',
                type: 0, // TEXT
                parent: gameCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['ViewChannel', 'SendMessages']
                    }
                ]
            });
        }

        // 대기열 확인
        if (tictactoeMatchQueue.size > 0) {
            // 대기 중인 상대가 있으면 즉시 매칭
            const [opponentId, opponentData] = tictactoeMatchQueue.entries().next().value;
            
            // 자기 자신과는 매칭하지 않음
            if (opponentId === userId) {
                return interaction.reply({
                    content: '❌ 다른 플레이어를 기다려주세요!',
                    flags: 64
                });
            }
            
            tictactoeMatchQueue.delete(opponentId);

            // 게임 시작
            await startGame(interaction, user, opponentData.user);
        } else {
            // 대기열에 추가
            tictactoeMatchQueue.set(userId, {
                user: user,
                interaction: interaction,
                timestamp: Date.now()
            });

            // 원래 채널에 안내 메시지
            await interaction.update({
                content: `⭕ 틱택토 대전 대기 중!\n<#${minigameChannel.id}>에서 상대를 기다리고 있습니다.`,
                embeds: [],
                components: []
            });

            // 미니게임 채널에 대기 메시지
            const sessionId = `tictactoe_${userId}_${Date.now()}`;
            const waitingEmbed = new EmbedBuilder()
                .setTitle('⭕ 틱택토 대기실')
                .setDescription(`**호스트**: ${user.nickname || interaction.user.username}`)
                .addFields(
                    { name: '🎮 게임', value: '틱택토', inline: true },
                    { name: '👥 현재 인원', value: `1/2명`, inline: true },
                    { name: '🏆 보상', value: '승리 300,000G', inline: true },
                    { name: '👥 참여자', value: `• ${user.nickname || interaction.user.username}`, inline: false }
                )
                .setColor('#5865F2')
                .setFooter({ text: '다른 플레이어를 기다리고 있습니다!' });

            const gameButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tictactoe_join_${sessionId}`)
                        .setLabel('🎮 참가하기')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`tictactoe_cancel_${sessionId}`)
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Danger)
                );

            const waitingMessage = await minigameChannel.send({
                embeds: [waitingEmbed],
                components: [gameButtons]
            });

            // 세션 정보 저장
            tictactoeGameSessions.set(sessionId, {
                host: user,
                hostId: userId,
                participant: null,
                participantId: null,
                waitingMessage: waitingMessage,
                timestamp: Date.now(),
                ready: false
            });

            // 30초 후 자동 취소
            setTimeout(async () => {
                if (tictactoeMatchQueue.has(userId)) {
                    tictactoeMatchQueue.delete(userId);
                    tictactoeGameSessions.delete(sessionId);
                    
                    try {
                        await waitingMessage.edit({
                            embeds: [
                                waitingEmbed.setColor('#808080')
                                    .setDescription('⏰ 시간 초과로 대기가 취소되었습니다.')
                            ],
                            components: []
                        });
                    } catch (error) {
                        console.error('대기 메시지 수정 오류:', error);
                    }
                }
            }, 30000);
        }

    } catch (error) {
        console.error('틱택토 매칭 오류:', error);
        return interaction.reply({
            content: '❌ 매칭 중 오류가 발생했습니다.',
            flags: 64
        });
    }
}

// 게임 시작
async function startGame(interaction, player1, player2) {
    try {
        console.log('[TicTacToe Handler] 게임 시작 함수 호출');
        console.log('[TicTacToe Handler] Player1:', player1.nickname || player1.discordId);
        console.log('[TicTacToe Handler] Player2:', player2.nickname || player2.discordId);
        
        // 임시 채널 생성
        const guild = interaction.guild;
        const gameCategory = guild.channels.cache.find(
            c => c.name === '🎮 미니게임' && c.type === 4
        );
        
        if (!gameCategory) {
            console.error('미니게임 카테고리를 찾을 수 없음');
            // 이미 응답된 상태이므로 return만 함
            return;
        }

        const tempChannel = await guild.channels.create({
            name: `⭕-틱택토-${player1.nickname || player1.discordId}-vs-${player2.nickname || player2.discordId}`,
            type: 0,
            parent: gameCategory,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel']
                },
                {
                    id: player1.discordId,
                    allow: ['ViewChannel', 'SendMessages']
                },
                {
                    id: player2.discordId,
                    allow: ['ViewChannel', 'SendMessages']
                }
            ]
        });

        // Discord 유저 객체 가져오기 (force: true로 최신 정보 강제 로드)
        let discordPlayer1, discordPlayer2;
        try {
            discordPlayer1 = await interaction.client.users.fetch(player1.discordId, { force: true });
            discordPlayer2 = await interaction.client.users.fetch(player2.discordId, { force: true });
        } catch (error) {
            console.error('[TicTacToe] 유저 정보 가져오기 실패:', error);
            // 에러 시 fallback 사용
            discordPlayer1 = {
                id: player1.discordId,
                username: player1.nickname || 'Player 1',
                displayAvatarURL: (options) => `https://cdn.discordapp.com/embed/avatars/${parseInt(player1.discordId) % 5}.png`
            };
            discordPlayer2 = {
                id: player2.discordId,
                username: player2.nickname || 'Player 2',
                displayAvatarURL: (options) => `https://cdn.discordapp.com/embed/avatars/${parseInt(player2.discordId) % 5}.png`
            };
        }
        
        // 채널에 사용자 멘션
        await tempChannel.send(`<@${player1.discordId}> vs <@${player2.discordId}> - 틱택토 게임이 시작됩니다!`);
        
        // 원래 채널에 게임 시작 알림
        if (interaction.channel) {
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('⭕ 틱택토 게임 시작!')
                        .setDescription(`${player1.nickname || player1.discordId} vs ${player2.nickname || player2.discordId}`)
                        .addFields({ name: '🎮 게임 채널', value: `<#${tempChannel.id}>`, inline: false })
                        .setColor('#00FF00')
                ]
            });
        }

        // 게임 생성 - tempChannel에 메시지 전송
        const game = TIC_TAC_TOE_GAME.createGame(discordPlayer1, discordPlayer2, tempChannel);

        // 게임 보드 표시
        const firstPlayer = game.currentTurn === 'X' ? game.player1 : game.player2;
        const secondPlayer = game.currentTurn === 'X' ? game.player2 : game.player1;
        
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('⭕ 틱택토 게임')
            .setDescription(`${firstPlayer.username}님의 차례입니다! (${game.currentTurn})`)
            .addFields(
                { name: '❌ 플레이어', value: `${game.player1.username}`, inline: true },
                { name: '⭕ 플레이어', value: `${game.player2.username}`, inline: true }
            );

        const boardImage = await TIC_TAC_TOE_GAME.createBoardImage(game.board, game.player1, game.player2);
        const buttons = TIC_TAC_TOE_GAME.createGameButtons(game.id, game.currentTurn, game.board);

        await tempChannel.send({
            embeds: [gameEmbed],
            files: [boardImage],
            components: buttons
        });

        // 대기 메시지들 삭제
        for (const [sessionId, session] of tictactoeGameSessions) {
            if (session.hostId === player1.discordId || session.hostId === player2.discordId) {
                try {
                    await session.waitingMessage.delete();
                } catch (error) {
                    console.error('대기 메시지 삭제 오류:', error);
                }
                tictactoeGameSessions.delete(sessionId);
            }
        }

        // 타임아웃 타이머 (10분 - 비정상 종료 대비)
        setTimeout(async () => {
            try {
                // 채널이 여전히 존재하는지 확인
                const channelStillExists = await interaction.guild.channels.fetch(tempChannel.id).catch(() => null);
                if (channelStillExists && !channelStillExists.deleted) {
                    await channelStillExists.delete('게임 타임아웃');
                }
            } catch (error) {
                // Unknown Channel 오류는 무시
                if (error.code !== 10003) {
                    console.error('채널 삭제 오류:', error);
                }
            }
        }, 600000); // 10분

    } catch (error) {
        console.error('게임 시작 오류:', error);
        console.error('상세 오류:', error.stack);
        
        // 채널에 오류 메시지 전송 시도
        try {
            if (interaction.channel) {
                await interaction.channel.send({
                    content: '❌ 게임 시작 중 오류가 발생했습니다. 다시 시도해주세요.',
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('⚠️ 틱택토 게임 오류')
                            .setDescription(`오류: ${error.message}`)
                            .setTimestamp()
                    ]
                });
            }
        } catch (sendError) {
            console.error('오류 메시지 전송 실패:', sendError);
        }
    }
}

// 봇과 플레이
async function playWithBot(interaction) {
    try {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return interaction.update({
                content: '❌ 등록되지 않은 사용자입니다.',
                embeds: [],
                components: []
            });
        }
        
        // 기존 게임 확인
        const existingGame = TIC_TAC_TOE_GAME.findGameByUserId(interaction.user.id);
        if (existingGame) {
            // 기존 게임 강제 종료
            TIC_TAC_TOE_GAME.forceEndUserGames(interaction.user.id);
            console.log(`[TicTacToe] 유저 ${interaction.user.id}의 기존 게임 강제 종료`);
        }

        // 임시 채널 생성
        const guild = interaction.guild;
        const gameCategory = guild.channels.cache.find(
            c => c.name === '🎮 미니게임' && c.type === 4
        );
        
        if (!gameCategory) {
            return interaction.update({
                content: '❌ 미니게임 카테고리를 찾을 수 없습니다.',
                embeds: [],
                components: []
            });
        }
        
        const tempChannel = await guild.channels.create({
            name: `⭕-틱택토-AI-${user.nickname || interaction.user.username}`,
            type: 0,
            parent: gameCategory,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['ViewChannel', 'SendMessages']
                }
            ]
        });
        
        // 업데이트 먼저
        await interaction.update({
            content: `⭕ AI와의 대전이 시작됩니다!\n<#${tempChannel.id}>`,
            embeds: [],
            components: []
        });
        
        // 최신 유저 정보 가져오기
        const freshUser = await interaction.client.users.fetch(interaction.user.id, { force: true });
        
        // 봇 게임 생성
        await TIC_TAC_TOE_GAME.createBotGame(freshUser, tempChannel);
        
        // 타임아웃 타이머 (10분 - 비정상 종료 대비)
        setTimeout(async () => {
            try {
                // 채널이 여전히 존재하는지 확인
                const channelStillExists = await interaction.guild.channels.fetch(tempChannel.id).catch(() => null);
                if (channelStillExists && !channelStillExists.deleted) {
                    await channelStillExists.delete('게임 타임아웃');
                }
            } catch (error) {
                // Unknown Channel 오류는 무시
                if (error.code !== 10003) {
                    console.error('채널 삭제 오류:', error);
                }
            }
        }, 600000); // 10분

    } catch (error) {
        console.error('봇 대전 오류:', error);
        if (!interaction.replied && !interaction.deferred) {
            return interaction.update({
                content: '❌ 게임을 시작하는 중 오류가 발생했습니다.',
                embeds: [],
                components: []
            });
        }
    }
}

// 틱택토 버튼 상호작용 처리
async function handleTicTacToeButton(interaction) {
    try {
        const customId = interaction.customId;
        const userId = interaction.user.id;

        // 유저와 플레이
        if (customId === 'tictactoe_user') {
            return await startUserMatching(interaction);
        }
        
        // 봇과 플레이
        else if (customId === 'tictactoe_bot') {
            return await playWithBot(interaction);
        }
        
        // 게임 참가
        else if (customId.startsWith('tictactoe_join_')) {
            const sessionId = customId.replace('tictactoe_join_', '');
            const session = tictactoeGameSessions.get(sessionId);
            
            if (!session) {
                // defer 상태인지 확인
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ 게임 세션을 찾을 수 없습니다.'
                    });
                } else {
                    return interaction.reply({
                        content: '❌ 게임 세션을 찾을 수 없습니다.',
                        flags: 64
                    });
                }
            }
            
            // 호스트는 참가할 수 없음
            if (session.hostId === userId) {
                return interaction.reply({
                    content: '❌ 자신이 만든 게임에는 참가할 수 없습니다!',
                    flags: 64
                });
            }
            
            // 대기열에서 호스트 제거
            tictactoeMatchQueue.delete(session.hostId);
            
            // 참가자 정보 가져오기
            const participant = await User.findOne({ discordId: userId });
            if (!participant) {
                return interaction.reply({
                    content: '❌ 등록되지 않은 사용자입니다.',
                    flags: 64
                });
            }
            
            // 이미 참가자가 있는지 확인
            if (session.participant) {
                return interaction.reply({
                    content: '❌ 이미 다른 플레이어가 참가했습니다!',
                    flags: 64
                });
            }
            
            // 참가자 정보 업데이트
            session.participant = participant;
            session.participantId = userId;
            session.ready = true;
            
            // 대기실 메시지 업데이트
            const updatedEmbed = new EmbedBuilder()
                .setTitle('⭕ 틱택토 대기실')
                .setDescription(`**호스트**: ${session.host.nickname || session.host.discordId}\n**참가자**: ${participant.nickname || participant.discordId}`)
                .addFields(
                    { name: '🎮 게임', value: '틱택토', inline: true },
                    { name: '👥 현재 인원', value: `2/2명`, inline: true },
                    { name: '🏆 보상', value: '승리 300,000G', inline: true },
                    { name: '👥 참여자', value: `• ${session.host.nickname || session.host.discordId}\n• ${participant.nickname || participant.discordId}`, inline: false }
                )
                .setColor('#00FF00')
                .setFooter({ text: '게임을 시작할 준비가 되었습니다!' });
            
            const gameButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tictactoe_start_${sessionId}`)
                        .setLabel('🎮 게임 시작')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`tictactoe_cancel_${sessionId}`)
                        .setLabel('❌ 취소')
                        .setStyle(ButtonStyle.Danger)
                );
            
            await session.waitingMessage.edit({
                embeds: [updatedEmbed],
                components: [gameButtons]
            });
            
            // defer 상태인지 확인
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: '✅ 게임에 참가했습니다! 호스트가 게임을 시작할 때까지 기다려주세요.'
                });
            } else {
                await interaction.reply({
                    content: '✅ 게임에 참가했습니다! 호스트가 게임을 시작할 때까지 기다려주세요.',
                    flags: 64
                });
            }
        }
        
        // 게임 시작
        else if (customId.startsWith('tictactoe_start_')) {
            const sessionId = customId.replace('tictactoe_start_', '');
            const session = tictactoeGameSessions.get(sessionId);
            
            if (!session) {
                // defer 상태인지 확인
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ 게임 세션을 찾을 수 없습니다.'
                    });
                } else {
                    return interaction.reply({
                        content: '❌ 게임 세션을 찾을 수 없습니다.',
                        flags: 64
                    });
                }
            }
            
            // 호스트만 시작할 수 있음
            if (session.hostId !== userId) {
                // defer 상태인지 확인
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ 호스트만 게임을 시작할 수 있습니다!'
                    });
                } else {
                    return interaction.reply({
                        content: '❌ 호스트만 게임을 시작할 수 있습니다!',
                        flags: 64
                    });
                }
            }
            
            // 참가자가 있는지 확인
            if (!session.participant) {
                // defer 상태인지 확인
                if (interaction.deferred || interaction.replied) {
                    return interaction.editReply({
                        content: '❌ 아직 참가자가 없습니다!'
                    });
                } else {
                    return interaction.reply({
                        content: '❌ 아직 참가자가 없습니다!',
                        flags: 64
                    });
                }
            }
            
            // 대기 메시지 삭제를 위해 먼저 응답
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('🎮 게임 시작 중...')
                        .setDescription('잠시만 기다려주세요. 게임 채널을 생성하고 있습니다.')
                        .setColor('#00FF00')
                ],
                components: []
            });
            
            // 게임 시작
            await startGame(interaction, session.host, session.participant);
        }
        
        // 대기 취소
        else if (customId.startsWith('tictactoe_cancel_')) {
            const sessionId = customId.replace('tictactoe_cancel_', '');
            const session = tictactoeGameSessions.get(sessionId);
            
            if (!session || session.hostId !== userId) {
                return interaction.reply({
                    content: '❌ 취소할 수 있는 권한이 없습니다.',
                    flags: 64
                });
            }
            
            tictactoeMatchQueue.delete(userId);
            tictactoeGameSessions.delete(sessionId);
            
            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ 대기 취소')
                        .setDescription('게임 대기가 취소되었습니다.')
                        .setColor('#FF0000')
                ],
                components: []
            });
        }
        
        // 대전 수락/거절 (이전 코드 호환성)
        else if (customId.startsWith('tictactoe_accept_') || customId.startsWith('tictactoe_decline_')) {
            const challengerId = customId.split('_')[2];
            const isAccept = customId.startsWith('tictactoe_accept_');
            
            if (userId === challengerId) {
                return interaction.reply({
                    content: '❌ 자신의 대전 신청은 수락할 수 없습니다!',
                    flags: 64
                });
            }
            
            if (isAccept) {
                const challenger = await interaction.client.users.fetch(challengerId);
                const game = await TIC_TAC_TOE_GAME.createGame(challenger, interaction.user, interaction.channel);
            } else {
                const declineEmbed = new EmbedBuilder()
                    .setTitle('❌ 대전 거절')
                    .setDescription(`**${interaction.user.username}**님이 틱택토 대전을 거절했습니다.`)
                    .setColor('#FF0000')
                    .setTimestamp();
                
                await interaction.update({
                    embeds: [declineEmbed],
                    components: []
                });
            }
            
            return;
        }
        
        // 게임 중 버튼 처리
        if (customId.startsWith('tictactoe_move_') || customId.startsWith('tictactoe_forfeit_')) {
            
            // 포기 버튼
            if (customId.startsWith('tictactoe_forfeit_')) {
                const forfeitGameId = customId.replace('tictactoe_forfeit_', '');
                const game = TIC_TAC_TOE_GAME.getGame(forfeitGameId);
                if (!game) {
                    // defer 상태인지 확인
                    if (interaction.deferred || interaction.replied) {
                        return interaction.editReply({
                            content: '❌ 게임을 찾을 수 없습니다.'
                        });
                    } else {
                        return interaction.reply({
                            content: '❌ 게임을 찾을 수 없습니다.',
                            flags: 64
                        });
                    }
                }
                
                // 포기 처리
                const winnerPlayer = game.player1.id === userId ? game.player2 : game.player1;
                const loserPlayer = game.player1.id === userId ? game.player1 : game.player2;
                
                // 게임 종료 메시지
                const forfeitEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🏳️ 게임 포기')
                    .setDescription(`${loserPlayer.username}님이 포기했습니다.\n${winnerPlayer.username}님의 승리!`)
                    .addFields(
                        { name: '🏆 승자 보상', value: `${TIC_TAC_TOE_GAME.config.winReward.toLocaleString()}G`, inline: true }
                    );
                
                await interaction.update({
                    embeds: [forfeitEmbed],
                    components: []
                });
                
                // 보상 지급
                if (winnerPlayer.id !== 'bot') {
                    const winner = await User.findOne({ discordId: winnerPlayer.id });
                    if (winner) {
                        winner.gold = (winner.gold || 0) + result.rewards.winner;
                        
                        // 전적 업데이트
                        if (!winner.tictactoeData) {
                            winner.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        winner.tictactoeData.wins++;
                        winner.tictactoeData.currentStreak++;
                        if (winner.tictactoeData.currentStreak > winner.tictactoeData.bestStreak) {
                            winner.tictactoeData.bestStreak = winner.tictactoeData.currentStreak;
                        }
                        winner.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!winner.gameStats) winner.gameStats = {};
                        if (!winner.gameStats.tictactoe) winner.gameStats.tictactoe = { played: 0, won: 0 };
                        winner.gameStats.tictactoe.played++;
                        winner.gameStats.tictactoe.won++;
                        
                        await winner.save();
                    }
                }
                
                if (loserPlayer.id !== 'bot') {
                    const loser = await User.findOne({ discordId: loserPlayer.id });
                    if (loser) {
                        if (!loser.tictactoeData) {
                            loser.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        loser.tictactoeData.losses++;
                        loser.tictactoeData.currentStreak = 0;
                        loser.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!loser.gameStats) loser.gameStats = {};
                        if (!loser.gameStats.tictactoe) loser.gameStats.tictactoe = { played: 0, won: 0 };
                        loser.gameStats.tictactoe.played++;
                        
                        await loser.save();
                    }
                }
                
                // 게임 종료
                TIC_TAC_TOE_GAME.endGame(forfeitGameId);
                
                // 3초 후 채널 삭제
                setTimeout(async () => {
                    try {
                        const channel = interaction.channel;
                        if (channel && !channel.deleted) {
                            await channel.send('🎮 3초 후 채널이 삭제됩니다...');
                            setTimeout(async () => {
                                try {
                                    // 채널이 여전히 존재하는지 확인
                                    const channelStillExists = await channel.guild.channels.fetch(channel.id).catch(() => null);
                                    if (channelStillExists && !channelStillExists.deleted) {
                                        await channelStillExists.delete('틱택토 게임 포기로 인한 종료');
                                    }
                                } catch (err) {
                                    // Unknown Channel 오류는 무시
                                    if (err.code !== 10003) {
                                        console.error('포기 시 채널 삭제 실패:', err);
                                    }
                                }
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('게임 채널 삭제 실패:', error);
                    }
                }, 2000);
                
                return;
            }
            
            // 게임 보드 클릭  
            if (customId.startsWith('tictactoe_move_')) {
                // customId 형식: tictactoe_move_gameId_position
                const movePrefix = 'tictactoe_move_';
                const remainingId = customId.substring(movePrefix.length);
                const lastUnderscoreIndex = remainingId.lastIndexOf('_');
                const moveGameId = remainingId.substring(0, lastUnderscoreIndex);
                const position = parseInt(remainingId.substring(lastUnderscoreIndex + 1));
                
                // 먼저 defer
                await interaction.deferUpdate();
                
                // 봇 게임인지 확인하고 handleMove 사용
                const gameData = TIC_TAC_TOE_GAME.getGame(moveGameId);
                let result;
                
                if (gameData && gameData.player2.id === 'bot') {
                    result = await TIC_TAC_TOE_GAME.handleMove(moveGameId, position, userId, interaction.message);
                    
                    if (!result.success) {
                        try {
                            // 버튼을 유지하면서 에러 메시지만 표시
                            await interaction.followUp({
                                content: `❌ ${result.error || result.reason}`,
                                ephemeral: true
                            });
                        } catch (e) {
                            // 응답 실패 무시
                        }
                        return;
                    }
                } else {
                    result = TIC_TAC_TOE_GAME.makeMove(moveGameId, position, userId);
                    
                    if (!result.success) {
                        try {
                            // 버튼을 유지하면서 에러 메시지만 표시
                            await interaction.followUp({
                                content: `❌ ${result.error || result.reason}`,
                                ephemeral: true
                            });
                        } catch (e) {
                            // 응답 실패 무시
                        }
                        return;
                    }
                    
                    // 유저 대전에서도 게임 보드 업데이트
                    if (!result.gameOver) {
                        // 게임 데이터 다시 가져오기 (업데이트된 상태)
                        const updatedGame = TIC_TAC_TOE_GAME.getGame(moveGameId);
                        if (!updatedGame) return;
                        
                        const currentPlayer = updatedGame.currentTurn === 'X' ? updatedGame.player1 : updatedGame.player2;
                        const gameEmbed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setTitle('⭕ 틱택토 게임')
                            .setDescription(`${currentPlayer.username}님의 차례입니다! (${updatedGame.currentTurn})`)
                            .addFields(
                                { name: '❌ 플레이어', value: `${updatedGame.player1.username}`, inline: true },
                                { name: '⭕ 플레이어', value: `${updatedGame.player2.username}`, inline: true }
                            );
                        
                        const boardImage = await TIC_TAC_TOE_GAME.createBoardImage(updatedGame.board, updatedGame.player1, updatedGame.player2, [], updatedGame.lastMovePosition);
                        const buttons = TIC_TAC_TOE_GAME.createGameButtons(moveGameId, updatedGame.currentTurn, updatedGame.board);
                        
                        // 타격감을 위한 이펙트 메시지
                        const effectMessages = [
                            '💥 **탁!** 강렬한 한 수!',
                            '⚡ **짠!** 번개같은 수!',
                            '🔥 **팍!** 불타는 수!',
                            '💫 **휙!** 순식간의 수!',
                            '🌟 **빵!** 화려한 수!'
                        ];
                        const randomEffect = effectMessages[Math.floor(Math.random() * effectMessages.length)];
                        
                        // 먼저 메시지 편집
                        try {
                            await interaction.message.edit({
                                content: randomEffect,
                                embeds: [gameEmbed],
                                files: [boardImage],
                                components: buttons
                            });
                            
                            // 2초 후 이펙트 메시지 제거
                            setTimeout(async () => {
                                try {
                                    await interaction.message.edit({
                                        content: null,
                                        embeds: [gameEmbed],
                                        files: [boardImage],
                                        components: buttons
                                    });
                                } catch (error) {
                                    // 에러 무시
                                }
                            }, 2000);
                        } catch (error) {
                            console.error('틱택토 메시지 업데이트 오류:', error);
                        }
                    }
                }
                
                // 게임 종료 시 보상 지급
                if (result.winner || result.isDraw) {
                    const gameForReward = TIC_TAC_TOE_GAME.getGame(moveGameId);
                    if (!gameForReward) return;
                    
                    // 게임 종료 메시지
                    let gameEndEmbed;
                    if (result.isDraw) {
                        gameEndEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('🤝 무승부!')
                            .setDescription('아무도 승리하지 못했습니다!')
                            .addFields(
                                { name: '🏆 보상', value: `${TIC_TAC_TOE_GAME.config.drawReward.toLocaleString()}G`, inline: true }
                            );
                    } else {
                        const winnerUser = await User.findOne({ discordId: result.winner });
                        const winnerName = winnerUser ? winnerUser.nickname || 'Unknown' : 'Unknown';
                        gameEndEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle(`🎉 ${winnerName}님의 승리!`)
                            .setDescription(`게임이 종료되었습니다.`)
                            .addFields(
                                { name: '🏆 승자 보상', value: `${TIC_TAC_TOE_GAME.config.winReward.toLocaleString()}G`, inline: true },
                                { name: '💔 패자 보상', value: `${TIC_TAC_TOE_GAME.config.loseReward.toLocaleString()}G`, inline: true }
                            );
                    }
                    
                    const finalBoardImage = await TIC_TAC_TOE_GAME.createBoardImage(
                        gameForReward.board, 
                        gameForReward.player1, 
                        gameForReward.player2,
                        result.winPattern || []
                    );
                    
                    // 게임 종료 메시지도 message.edit 사용
                    try {
                        await interaction.message.edit({
                            embeds: [gameEndEmbed],
                            files: [finalBoardImage],
                            components: []
                        });
                    } catch (error) {
                        console.error('틱택토 게임 종료 메시지 업데이트 오류:', error);
                    }
                
                const user1 = await User.findOne({ discordId: gameForReward.player1.id });
                const user2 = await User.findOne({ discordId: gameForReward.player2.id });
                
                if (result.isDraw) {
                    // 무승부 보상
                    if (user1) {
                        const prevGold = user1.gold || 0;
                        user1.gold = prevGold + result.rewards.winner;
                        console.log(`[TicTacToe] 무승부 골드 지급: ${user1.nickname} ${prevGold} -> ${user1.gold} (+${result.rewards.winner})`);
                        if (!user1.tictactoeData) {
                            user1.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        user1.tictactoeData.draws++;
                        user1.tictactoeData.currentStreak = 0;
                        user1.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!user1.gameStats) user1.gameStats = {};
                        if (!user1.gameStats.tictactoe) user1.gameStats.tictactoe = { played: 0, won: 0 };
                        user1.gameStats.tictactoe.played++;
                        
                        await user1.save();
                    }
                    if (user2) {
                        const prevGold = user2.gold || 0;
                        user2.gold = prevGold + result.rewards.winner;
                        console.log(`[TicTacToe] 무승부 골드 지급: ${user2.nickname} ${prevGold} -> ${user2.gold} (+${result.rewards.winner})`);
                        if (!user2.tictactoeData) {
                            user2.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        user2.tictactoeData.draws++;
                        user2.tictactoeData.currentStreak = 0;
                        user2.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!user2.gameStats) user2.gameStats = {};
                        if (!user2.gameStats.tictactoe) user2.gameStats.tictactoe = { played: 0, won: 0 };
                        user2.gameStats.tictactoe.played++;
                        
                        await user2.save();
                    }
                } else {
                    // 승리/패배 보상
                    const winner = result.winner !== 'bot' ? await User.findOne({ discordId: result.winner }) : null;
                    const loser = result.loser !== 'bot' ? await User.findOne({ discordId: result.loser }) : null;
                    
                    if (winner) {
                        const prevGold = winner.gold || 0;
                        winner.gold = prevGold + result.rewards.winner;
                        console.log(`[TicTacToe] 승리 골드 지급: ${winner.nickname} ${prevGold} -> ${winner.gold} (+${result.rewards.winner})`);
                        if (!winner.tictactoeData) {
                            winner.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        winner.tictactoeData.wins++;
                        winner.tictactoeData.currentStreak++;
                        if (winner.tictactoeData.currentStreak > winner.tictactoeData.bestStreak) {
                            winner.tictactoeData.bestStreak = winner.tictactoeData.currentStreak;
                        }
                        winner.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!winner.gameStats) winner.gameStats = {};
                        if (!winner.gameStats.tictactoe) winner.gameStats.tictactoe = { played: 0, won: 0 };
                        winner.gameStats.tictactoe.played++;
                        winner.gameStats.tictactoe.won++;
                        
                        await winner.save();
                    }
                    if (loser && result.rewards.loser > 0) {
                        const prevGold = loser.gold || 0;
                        loser.gold = prevGold + result.rewards.loser;
                        console.log(`[TicTacToe] 패배 골드 지급: ${loser.nickname} ${prevGold} -> ${loser.gold} (+${result.rewards.loser})`);
                        if (!loser.tictactoeData) {
                            loser.tictactoeData = {
                                wins: 0,
                                losses: 0,
                                draws: 0,
                                currentStreak: 0,
                                bestStreak: 0
                            };
                        }
                        loser.tictactoeData.losses++;
                        loser.tictactoeData.currentStreak = 0;
                        loser.tictactoeData.lastPlayed = new Date();
                        
                        // gameStats 업데이트
                        if (!loser.gameStats) loser.gameStats = {};
                        if (!loser.gameStats.tictactoe) loser.gameStats.tictactoe = { played: 0, won: 0 };
                        loser.gameStats.tictactoe.played++;
                        
                        await loser.save();
                    }
                }
                
                // 게임 종료
                TIC_TAC_TOE_GAME.endGame(moveGameId);
                
                // 3초 후 채널 삭제
                setTimeout(async () => {
                    try {
                        const channel = interaction.channel;
                        if (channel && !channel.deleted) {
                            await channel.send('🎮 3초 후 채널이 삭제됩니다...');
                            setTimeout(async () => {
                                try {
                                    // 채널이 여전히 존재하는지 확인
                                    const channelStillExists = await channel.guild.channels.fetch(channel.id).catch(() => null);
                                    if (channelStillExists && !channelStillExists.deleted) {
                                        await channelStillExists.delete('틱택토 게임 종료');
                                    }
                                } catch (err) {
                                    // Unknown Channel 오류는 무시
                                    if (err.code !== 10003) {
                                        console.error('게임 종료 채널 삭제 실패:', err);
                                    }
                                }
                            }, 3000);
                        }
                    } catch (error) {
                        console.error('게임 채널 삭제 실패:', error);
                    }
                }, 2000);
            }
            }
        }
        
        // 통계 보기
        else if (customId === 'tictactoe_stats') {
            const user = await User.findOne({ discordId: userId });
            if (!user) {
                return interaction.reply({
                    content: '❌ 등록되지 않은 사용자입니다.',
                    flags: 64
                });
            }
            
            const tictactoeData = user.tictactoeData || {
                wins: 0,
                losses: 0,
                draws: 0,
                currentStreak: 0,
                bestStreak: 0
            };
            
            const totalGames = tictactoeData.wins + tictactoeData.losses + tictactoeData.draws;
            const winRate = totalGames > 0 ? Math.round((tictactoeData.wins / totalGames) * 100) : 0;
            
            const statsEmbed = new EmbedBuilder()
                .setTitle('📊 틱택토 상세 통계')
                .setDescription(`**${user.nickname || interaction.user.username}**님의 게임 기록`)
                .addFields(
                    { name: '🏆 총 승리', value: `${tictactoeData.wins}회`, inline: true },
                    { name: '💔 총 패배', value: `${tictactoeData.losses}회`, inline: true },
                    { name: '🤝 무승부', value: `${tictactoeData.draws}회`, inline: true },
                    { name: '🎮 총 게임', value: `${totalGames}회`, inline: true },
                    { name: '🎯 승률', value: `${winRate}%`, inline: true },
                    { name: '🔥 현재 연승', value: `${tictactoeData.currentStreak}회`, inline: true },
                    { name: '⭐ 최고 연승', value: `${tictactoeData.bestStreak}회`, inline: true },
                    { name: '💰 예상 수익', value: `${((tictactoeData.wins * 300000) + (tictactoeData.draws * 100000) + (tictactoeData.losses * 50000)).toLocaleString()}G`, inline: true }
                )
                .setColor('#5865F2')
                .setTimestamp();
            
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tictactoe_game')
                        .setLabel('⬅️ 돌아가기')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await interaction.update({
                embeds: [statsEmbed],
                components: [backButton]
            });
        }
        
    } catch (error) {
        console.error('틱택토 버튼 처리 오류:', error);
        
        // 게임 이동 중 오류가 발생한 경우 버튼을 유지해야 함
        if (customId.startsWith('tictactoe_move_')) {
            // 아무 작업도 하지 않음 - 게임 상태 유지
            console.log('[틱택토] 게임 이동 중 오류 발생, 게임 상태 유지');
            return;
        }
        
        // 이미 응답한 상태인지 확인
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ 처리 중 오류가 발생했습니다.',
                    flags: 64
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ 처리 중 오류가 발생했습니다.'
                });
            }
        } catch (replyError) {
            // 응답 실패 무시
            console.error('오류 응답 실패:', replyError);
        }
    }
}

module.exports = {
    showTicTacToeMenu,
    handleTicTacToeButton
};