const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType } = require('discord.js');
const User = require('../../models/User');
const spectatorBetting = require('../../data/spectatorBetting');

// PVP 대기실 관리
const pvpWaitingRooms = new Map();

class PVPWaitingRoom {
    constructor(hostId, hostUser, channel) {
        this.roomId = `pvp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        this.host = {
            id: hostId,
            user: hostUser,
            ready: true
        };
        this.opponent = null;
        this.channel = channel;
        this.createdAt = Date.now();
        this.startTimer = null;
        this.gameStarted = false;
        this.tempChannel = null;
        this.waitingMessage = null;
    }

    // 대기실 임베드 생성
    createWaitingEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('⚔️ PVP 대전방')
            .setDescription(`**${this.host.user.nickname}**님의 대전방`)
            .addFields(
                {
                    name: '👥 참가자',
                    value: `1️⃣ ${this.host.user.nickname} (방장) ✅\n` +
                           `2️⃣ ${this.opponent ? `${this.opponent.user.nickname} ${this.opponent.ready ? '✅' : '❌'}` : '대기중...'}`,
                    inline: false
                },
                {
                    name: '📊 방장 정보',
                    value: `레이팅: ${this.host.user.pvp?.rating || 1000}점\n` +
                           `티어: ${this.host.user.pvp?.tier || 'Bronze'}\n` +
                           `전적: ${this.host.user.pvp?.wins || 0}승 ${this.host.user.pvp?.losses || 0}패`,
                    inline: true
                },
                {
                    name: '⏱️ 대기 시간',
                    value: this.getWaitTime(),
                    inline: true
                }
            )
            .setFooter({ text: '최대 1분간 대기 가능 | 참가자가 없으면 오프라인 유저와 매칭됩니다' });

        if (this.opponent) {
            embed.addFields({
                name: '📊 상대 정보',
                value: `레이팅: ${this.opponent.user.pvp?.rating || 1000}점\n` +
                       `티어: ${this.opponent.user.pvp?.tier || 'Bronze'}\n` +
                       `전적: ${this.opponent.user.pvp?.wins || 0}승 ${this.opponent.user.pvp?.losses || 0}패`,
                inline: true
            });
        }

        return embed;
    }

    // 대기실 버튼 생성
    createWaitingButtons() {
        const buttons = [];

        // 참가 버튼 (상대가 없을 때만)
        if (!this.opponent) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`pvp_join_${this.roomId}`)
                    .setLabel('⚔️ 대전 참가')
                    .setStyle(ButtonStyle.Primary)
            );
        }

        // 시작 버튼 (방장만, 상대가 있을 때)
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`pvp_start_${this.roomId}`)
                .setLabel('🚀 게임 시작')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!this.opponent || !this.opponent.ready)
        );

        // 오프라인 대전 버튼 (방장만, 상대가 없을 때)
        if (!this.opponent) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`pvp_offline_${this.roomId}`)
                    .setLabel('🤖 오프라인 유저와 대전')
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        // 나가기 버튼
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`pvp_leave_${this.roomId}`)
                .setLabel('🚪 나가기')
                .setStyle(ButtonStyle.Danger)
        );

        // 관전자 참여 버튼
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`pvp_spectate_${this.roomId}`)
                .setLabel('👁️ 관전자로 참여')
                .setStyle(ButtonStyle.Secondary)
        );

        return new ActionRowBuilder().addComponents(buttons);
    }

    // 대기 시간 계산
    getWaitTime() {
        const elapsed = Math.floor((Date.now() - this.createdAt) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        return `${elapsed}초 경과 (남은 시간: ${remaining}초)`;
    }

    // 참가자 추가
    async addOpponent(userId, user) {
        if (this.opponent) {
            return { success: false, message: '이미 상대가 있습니다!' };
        }

        if (userId === this.host.id) {
            return { success: false, message: '자기 자신과는 대전할 수 없습니다!' };
        }

        // PVP 티켓 재생성
        const now = Date.now();
        const lastRegen = user.lastPvpTicketRegen || now;
        const timePassed = now - lastRegen;
        const REGEN_TIME = 30 * 60 * 1000; // 30분
        const ticketsToAdd = Math.floor(timePassed / REGEN_TIME);
        
        if (ticketsToAdd > 0) {
            const currentTickets = user.pvpTickets || 0;
            user.pvpTickets = Math.min(20, currentTickets + ticketsToAdd);
            user.lastPvpTicketRegen = now - (timePassed % REGEN_TIME);
            await user.save();
            console.log(`[PVP Waiting Room] Regenerated ${ticketsToAdd} tickets for ${user.nickname}. Total: ${user.pvpTickets}`);
        }

        // pvp 객체 초기화
        if (!user.pvp) {
            user.pvp = {
                rating: 1000,
                tier: 'Bronze',
                wins: 0,
                losses: 0,
                duelTickets: user.pvpTickets || 20
            };
        }
        
        // pvpTickets를 pvp.duelTickets로 동기화
        if (user.pvpTickets !== undefined) {
            user.pvp.duelTickets = user.pvpTickets;
        }

        if (!user.pvp.duelTickets || user.pvp.duelTickets <= 0) {
            // 다음 티켓 재생성까지 남은 시간 계산
            const now = Date.now();
            const REGEN_TIME = 30 * 60 * 1000; // 30분
            const lastRegen = user.lastPvpTicketRegen || now;
            const nextRegenTime = lastRegen + REGEN_TIME;
            const timeUntilRegen = Math.max(0, nextRegenTime - now);
            const minutesLeft = Math.ceil(timeUntilRegen / 60000);
            
            return { success: false, message: `결투권이 부족합니다!\n🕐 다음 티켓 재생성까지: **${minutesLeft}분**\n💡 PVP 티켓은 30분마다 1장씩 재생성됩니다. (최대 20장)` };
        }

        this.opponent = {
            id: userId,
            user: user,
            ready: true
        };

        return { success: true, message: '대전에 참가했습니다!' };
    }

    // 게임 시작
    async startGame(pvpSystem) {
        if (!this.opponent || this.gameStarted) {
            return { success: false, message: '게임을 시작할 수 없습니다.' };
        }

        this.gameStarted = true;

        // 결투권 차감 (TicketManager 사용)
        const TicketManager = require('../../utils/ticketManager');
        const hostTicketResult = await TicketManager.useTicket(this.host.id, 'pvp');
        const opponentTicketResult = await TicketManager.useTicket(this.opponent.id, 'pvp');
        
        if (!hostTicketResult.success || !opponentTicketResult.success) {
            this.gameStarted = false;
            return { success: false, message: 'PVP 티켓이 부족합니다.' };
        }
        
        this.host.user = hostTicketResult.user;
        this.opponent.user = opponentTicketResult.user;

        // PVP 매치 생성
        const player1Data = {
            id: this.host.id,
            userId: this.host.id,
            user: this.host.user,
            rating: this.host.user.pvp?.rating || 1000,
            tier: this.host.user.pvp?.tier || 'Bronze',
            isBot: false,
            channel: this.channel
        };

        const player2Data = {
            id: this.opponent.id,
            userId: this.opponent.id,
            user: this.opponent.user,
            rating: this.opponent.user.pvp?.rating || 1000,
            tier: this.opponent.user.pvp?.tier || 'Bronze',
            isBot: false,
            channel: this.channel
        };

        // 매치 생성
        await pvpSystem.createMatch(player1Data, player2Data);

        // 대기실 정리
        pvpWaitingRooms.delete(this.roomId);
        if (this.startTimer) {
            clearTimeout(this.startTimer);
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        return { success: true };
    }

    // 오프라인 유저와 대전
    async startOfflineMatch(pvpSystem) {
        if (this.opponent || this.gameStarted) {
            return { success: false, message: '이미 상대가 있거나 게임이 시작되었습니다.' };
        }

        this.gameStarted = true;

        // 결투권 차감 (TicketManager 사용)
        const TicketManager = require('../../utils/ticketManager');
        const ticketResult = await TicketManager.useTicket(this.host.id, 'pvp');
        
        if (!ticketResult.success) {
            this.gameStarted = false;
            return { success: false, message: ticketResult.error };
        }
        
        this.host.user = ticketResult.user;

        // 오프라인 유저 찾기
        const offlineUser = await pvpSystem.findOfflineOpponent(this.host.user);

        const player1Data = {
            id: this.host.id,
            userId: this.host.id,
            user: this.host.user,
            rating: this.host.user.pvp?.rating || 1000,
            tier: this.host.user.pvp?.tier || 'Bronze',
            isBot: false,
            channel: this.channel
        };

        const player2Data = {
            id: offlineUser.discordId,
            userId: offlineUser.discordId,
            user: offlineUser,
            rating: offlineUser.pvpRating || 1000,
            tier: offlineUser.pvpTier || 'Bronze',
            isBot: true,
            isOfflineUser: true
        };

        // 매치 생성
        await pvpSystem.createMatch(player1Data, player2Data);

        // 대기실 정리
        pvpWaitingRooms.delete(this.roomId);
        if (this.startTimer) {
            clearTimeout(this.startTimer);
        }

        return { success: true };
    }

    // 대기실 업데이트
    async updateWaitingRoom() {
        if (this.waitingMessage) {
            try {
                // 메시지가 삭제되었는지 먼저 확인
                await this.waitingMessage.fetch().catch(() => null);
                
                await this.waitingMessage.edit({
                    embeds: [this.createWaitingEmbed()],
                    components: [this.createWaitingButtons()]
                });
            } catch (error) {
                // Unknown Message 에러는 무시 (메시지가 삭제된 경우)
                if (error.code === 10008) {
                    console.log('[PVP Waiting Room] 대기실 메시지가 삭제되었습니다. 업데이트 중단.');
                    this.waitingMessage = null;
                    // 대기실도 정리
                    pvpWaitingRooms.delete(this.roomId);
                } else {
                    console.error('대기실 업데이트 오류:', error);
                }
            }
        }
    }
}

// PVP 대기실 생성
async function createPVPWaitingRoom(interaction, user, pvpSystem) {
    console.log('[PVP Waiting Room] Creating waiting room for user:', user.nickname);
    console.log('[PVP Waiting Room] Interaction state - replied:', interaction.replied, 'deferred:', interaction.deferred);
    
    // 이미 대기실이 있는지 확인
    for (const room of pvpWaitingRooms.values()) {
        if (room.host.id === user.discordId || (room.opponent && room.opponent.id === user.discordId)) {
            console.log('[PVP Waiting Room] User already in a room');
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ 
                    content: '❌ 이미 다른 대전방에 참가중입니다!', 
                    flags: 64 
                });
            } else {
                return interaction.editReply({ 
                    content: '❌ 이미 다른 대전방에 참가중입니다!' 
                });
            }
        }
    }

    // PVP 티켓 재생성 (TicketManager 사용)
    const TicketManager = require('../../utils/ticketManager');
    const ticketInfo = await TicketManager.getTicketInfo(user.discordId);
    user.pvpTickets = ticketInfo.pvp;
    
    // pvp 객체 초기화
    if (!user.pvp) {
        user.pvp = {
            rating: 1000,
            tier: 'Bronze',
            wins: 0,
            losses: 0,
            duelTickets: user.pvpTickets || 20
        };
    } else {
        // pvpTickets를 pvp.duelTickets로 동기화
        user.pvp.duelTickets = user.pvpTickets;
    }
    
    console.log(`[PVP Waiting Room] ${user.nickname}의 PVP 티켓: ${user.pvp.duelTickets}`);
    await user.save();

    if (!user.pvp.duelTickets || user.pvp.duelTickets <= 0) {
        // 다음 티켓 재생성까지 남은 시간 계산
        const now = Date.now();
        const REGEN_TIME = 30 * 60 * 1000; // 30분
        const lastRegen = user.lastPvpTicketRegen || now;
        const nextRegenTime = lastRegen + REGEN_TIME;
        const timeUntilRegen = Math.max(0, nextRegenTime - now);
        const minutesLeft = Math.ceil(timeUntilRegen / 60000);
        
        const errorMessage = `❌ 결투권이 부족합니다!\n🕐 다음 티켓 재생성까지: **${minutesLeft}분**\n💡 PVP 티켓은 30분마다 1장씩 재생성됩니다. (최대 20장)`;
        
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({ 
                content: errorMessage, 
                flags: 64 
            });
        } else {
            return interaction.editReply({ 
                content: errorMessage 
            });
        }
    }

    // 대기실 생성
    const room = new PVPWaitingRoom(user.discordId, user, interaction.channel);
    pvpWaitingRooms.set(room.roomId, room);

    // 대기실 메시지 전송
    console.log('[PVP Waiting Room] Sending waiting room message');
    try {
        let waitingMessage;
        
        // 먼저 원래 메시지를 업데이트하여 버튼을 비활성화
        if (!interaction.replied) {
            await interaction.update({
                embeds: interaction.message.embeds,
                components: [] // 버튼 제거
            }).catch(() => {});
        }
        
        // 새로운 공개 메시지로 대기실 생성
        console.log('[PVP Waiting Room] Creating public waiting room message');
        waitingMessage = await interaction.channel.send({
            embeds: [room.createWaitingEmbed()],
            components: [room.createWaitingButtons()]
        });
        
        room.waitingMessage = waitingMessage;
    } catch (error) {
        console.error('[PVP Waiting Room] Error sending message:', error);
        console.error('[PVP Waiting Room] Error details:', error.message);
        throw error;
    }

    // 1분 타이머 설정
    room.startTimer = setTimeout(async () => {
        if (!room.gameStarted) {
            // 자동으로 오프라인 매칭
            if (!room.opponent) {
                try {
                    await room.startOfflineMatch(pvpSystem);
                    await interaction.channel.send({
                        content: '⏰ 대기 시간이 종료되어 오프라인 유저와 자동 매칭되었습니다!'
                    });
                } catch (error) {
                    console.error('자동 오프라인 매칭 오류:', error);
                }
            }
            // 타이머와 인터벌 정리
            if (room.updateInterval) {
                clearInterval(room.updateInterval);
            }
            pvpWaitingRooms.delete(room.roomId);
        }
    }, 60000);

    // 대기실 상태 업데이트 (5초마다)
    const updateInterval = setInterval(async () => {
        if (pvpWaitingRooms.has(room.roomId) && room.waitingMessage) {
            await room.updateWaitingRoom();
        } else {
            clearInterval(updateInterval);
        }
    }, 5000);
    
    // 룸에 인터벌 저장 (나중에 정리용)
    room.updateInterval = updateInterval;
}

// PVP 대기실 인터랙션 처리
async function handlePVPWaitingRoomInteraction(interaction, pvpSystem) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    const action = parts[1];
    const roomId = parts.slice(2).join('_');

    const room = pvpWaitingRooms.get(roomId);
    if (!room) {
        return interaction.reply({ 
            content: '❌ 대전방을 찾을 수 없습니다.', 
            flags: 64 
        });
    }

    const userId = interaction.user.id;
    const user = await User.findOne({ discordId: userId });

    switch (action) {
        case 'join':
            if (!user) {
                return interaction.reply({ 
                    content: '❌ 먼저 회원가입을 해주세요!',
                    flags: 64
                });
            }

            const joinResult = await room.addOpponent(userId, user);
            if (joinResult.success) {
                await room.updateWaitingRoom();
                return interaction.reply({ 
                    content: '✅ ' + joinResult.message,
                    flags: 64
                });
            } else {
                return interaction.reply({ 
                    content: '❌ ' + joinResult.message,
                    flags: 64
                });
            }

        case 'start':
            if (userId !== room.host.id) {
                return interaction.reply({ 
                    content: '❌ 방장만 게임을 시작할 수 있습니다!',
                    flags: 64
                });
            }

            const startResult = await room.startGame(pvpSystem);
            if (startResult.success) {
                return interaction.reply({ 
                    content: '✅ 게임을 시작합니다!',
                    flags: 64
                });
            } else {
                return interaction.reply({ 
                    content: '❌ ' + startResult.message,
                    flags: 64
                });
            }

        case 'offline':
            if (userId !== room.host.id) {
                return interaction.reply({ 
                    content: '❌ 방장만 오프라인 대전을 시작할 수 있습니다!', 
                    flags: 64 
                });
            }

            const offlineResult = await room.startOfflineMatch(pvpSystem);
            if (offlineResult.success) {
                return interaction.reply({ 
                    content: '✅ 오프라인 유저와 대전을 시작합니다!', 
                    flags: 64 
                });
            } else {
                return interaction.reply({ 
                    content: '❌ ' + offlineResult.message, 
                    flags: 64 
                });
            }

        case 'leave':
            if (userId === room.host.id) {
                // 방장이 나가면 방 삭제
                pvpWaitingRooms.delete(roomId);
                if (room.startTimer) {
                    clearTimeout(room.startTimer);
                }
                if (room.updateInterval) {
                    clearInterval(room.updateInterval);
                }
                // 대기실 메시지 삭제
                if (room.waitingMessage) {
                    try {
                        await room.waitingMessage.delete();
                    } catch (error) {
                        console.error('대기실 메시지 삭제 오류:', error);
                    }
                }
                return interaction.reply({ 
                    content: '✅ 대전방을 닫았습니다.', 
                    flags: 64 
                });
            } else if (room.opponent && userId === room.opponent.id) {
                // 상대가 나가면
                room.opponent = null;
                await room.updateWaitingRoom();
                return interaction.reply({ 
                    content: '✅ 대전방에서 나갔습니다.', 
                    flags: 64 
                });
            }
            break;

        case 'spectate':
            // 관전자 시스템 연동
            const { handleSpectatorInteraction } = require('../../systems/spectatorBettingHandler');
            
            // 이미 참가자인지 확인
            if (userId === room.host.id || (room.opponent && userId === room.opponent.id)) {
                return interaction.reply({ 
                    content: '❌ 이미 경기에 참가중입니다!', 
                    flags: 64 
                });
            }
            
            const sessionData = {
                players: [
                    {
                        id: room.host.id,
                        userId: room.host.id,
                        name: room.host.user.nickname,
                        rating: room.host.user.pvp?.rating || 1000
                    }
                ],
                channel: room.channel
            };
            
            if (room.opponent) {
                sessionData.players.push({
                    id: room.opponent.id,
                    userId: room.opponent.id,
                    name: room.opponent.user.nickname,
                    rating: room.opponent.user.pvp?.rating || 1000
                });
            }
            
            return await handleSpectatorInteraction(interaction, 'pvp', sessionData);
    }
}

module.exports = {
    pvpWaitingRooms,
    createPVPWaitingRoom,
    handlePVPWaitingRoomInteraction
};