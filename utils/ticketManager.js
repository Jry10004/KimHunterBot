// 티켓 재생성 관리 유틸리티
const User = require('../models/User');

const TICKET_REGEN_TIME = 30 * 60 * 1000; // 30분
const MAX_TICKETS = 20;

class TicketManager {
    // 티켓 재생성 함수
    static async regenerateTickets(user) {
        const now = Date.now();
        let updated = false;

        // 미니게임 티켓 재생성
        if (!user.minigameTickets) {
            // minigameTickets 필드가 없는 경우 초기화
            user.minigameTickets = {
                tickets: 20,
                lastRegen: new Date()
            };
            updated = true;
            console.log(`[TicketManager] ${user.discordId} 미니게임 티켓 초기화: 20장`);
        } else {
            // 티켓이 20개 미만일 때만 재생성 체크
            if (user.minigameTickets.tickets < MAX_TICKETS) {
                // lastRegen이 없거나 잘못된 경우 현재 시간으로 설정
                if (!user.minigameTickets.lastRegen || isNaN(new Date(user.minigameTickets.lastRegen).getTime())) {
                    user.minigameTickets.lastRegen = new Date();
                    updated = true;
                    console.log(`[TicketManager] ${user.discordId} lastRegen 초기화`);
                } else {
                    const lastRegenTime = new Date(user.minigameTickets.lastRegen).getTime();
                    const timeSinceLastRegen = now - lastRegenTime;
                    const ticketsToRegen = Math.floor(timeSinceLastRegen / TICKET_REGEN_TIME);

                    if (ticketsToRegen > 0) {
                        const previousTickets = user.minigameTickets.tickets;
                        const maxTicketsToAdd = MAX_TICKETS - previousTickets;
                        const actualTicketsToAdd = Math.min(ticketsToRegen, maxTicketsToAdd);
                        
                        user.minigameTickets.tickets += actualTicketsToAdd;
                        // 실제로 추가된 티켓 수만큼만 시간 업데이트
                        user.minigameTickets.lastRegen = new Date(lastRegenTime + (actualTicketsToAdd * TICKET_REGEN_TIME));
                        updated = true;
                        
                        console.log(`[TicketManager] ${user.discordId} 미니게임 티켓 재생성: ${previousTickets} → ${user.minigameTickets.tickets} (+${actualTicketsToAdd})`);
                        console.log(`[TicketManager] 재생성 시간: ${timeSinceLastRegen}ms, 재생성 가능: ${ticketsToRegen}장, 실제 추가: ${actualTicketsToAdd}장`);
                    }
                }
            } else if (user.minigameTickets.tickets === MAX_TICKETS && user.minigameTickets.lastRegen) {
                // 티켓이 최대치인 경우 lastRegen을 null로 설정하여 다음에 티켓을 사용할 때부터 재생성 시작
                user.minigameTickets.lastRegen = null;
                updated = true;
                console.log(`[TicketManager] ${user.discordId} 티켓 최대치 도달, lastRegen 초기화`);
            }
        }

        // 사냥 티켓 재생성
        if (user.huntingTickets !== undefined) {
            if (user.huntingTickets < MAX_TICKETS) {
                // lastHuntingTicketRegen이 없거나 잘못된 경우 현재 시간으로 설정
                if (!user.lastHuntingTicketRegen || isNaN(new Date(user.lastHuntingTicketRegen).getTime())) {
                    user.lastHuntingTicketRegen = new Date();
                    updated = true;
                    console.log(`[TicketManager] ${user.discordId} 사냥 티켓 lastRegen 초기화`);
                } else {
                    const lastRegenTime = new Date(user.lastHuntingTicketRegen).getTime();
                    const timeSinceLastRegen = now - lastRegenTime;
                    const ticketsToRegen = Math.floor(timeSinceLastRegen / TICKET_REGEN_TIME);

                    if (ticketsToRegen > 0) {
                        const previousTickets = user.huntingTickets;
                        const maxTicketsToAdd = MAX_TICKETS - previousTickets;
                        const actualTicketsToAdd = Math.min(ticketsToRegen, maxTicketsToAdd);
                        
                        user.huntingTickets += actualTicketsToAdd;
                        user.lastHuntingTicketRegen = new Date(lastRegenTime + (actualTicketsToAdd * TICKET_REGEN_TIME));
                        updated = true;
                        
                        console.log(`[TicketManager] ${user.discordId} 사냥 티켓 재생성: ${previousTickets} → ${user.huntingTickets} (+${actualTicketsToAdd})`);
                    }
                }
            } else if (user.huntingTickets === MAX_TICKETS && user.lastHuntingTicketRegen) {
                // 티켓이 최대치인 경우 lastRegen을 null로 설정
                user.lastHuntingTicketRegen = null;
                updated = true;
                console.log(`[TicketManager] ${user.discordId} 사냥 티켓 최대치 도달, lastRegen 초기화`);
            }
        }

        // 가위바위보 티켓 재생성
        if (user.rpsGameData) {
            // 봇 티켓
            const botLastRegenTime = new Date(user.rpsGameData.lastBotTicketRegen || Date.now()).getTime();
            const botTimeSinceLastRegen = now - botLastRegenTime;
            const botTicketsToRegen = Math.floor(botTimeSinceLastRegen / TICKET_REGEN_TIME);

            if (botTicketsToRegen > 0 && user.rpsGameData.botTickets < MAX_TICKETS) {
                const previousBotTickets = user.rpsGameData.botTickets;
                user.rpsGameData.botTickets = Math.min(
                    user.rpsGameData.botTickets + botTicketsToRegen,
                    MAX_TICKETS
                );
                const botTicketsAdded = user.rpsGameData.botTickets - previousBotTickets;
                user.rpsGameData.lastBotTicketRegen = new Date(botLastRegenTime + (botTicketsAdded * TICKET_REGEN_TIME));
                updated = true;
            }

            // 유저 티켓
            const userLastRegenTime = new Date(user.rpsGameData.lastUserTicketRegen || Date.now()).getTime();
            const userTimeSinceLastRegen = now - userLastRegenTime;
            const userTicketsToRegen = Math.floor(userTimeSinceLastRegen / TICKET_REGEN_TIME);

            if (userTicketsToRegen > 0 && user.rpsGameData.userTickets < MAX_TICKETS) {
                const previousUserTickets = user.rpsGameData.userTickets;
                user.rpsGameData.userTickets = Math.min(
                    user.rpsGameData.userTickets + userTicketsToRegen,
                    MAX_TICKETS
                );
                const userTicketsAdded = user.rpsGameData.userTickets - previousUserTickets;
                user.rpsGameData.lastUserTicketRegen = new Date(userLastRegenTime + (userTicketsAdded * TICKET_REGEN_TIME));
                updated = true;
            }
        }

        // 던전 티켓 재생성
        if (user.dungeonTickets !== undefined) {
            const MAX_DUNGEON_TICKETS = 5; // 던전 티켓 최대치는 5개
            if (user.dungeonTickets < MAX_DUNGEON_TICKETS) {
                // lastDungeonTicketRegen이 없거나 잘못된 경우 현재 시간으로 설정
                if (!user.lastDungeonTicketRegen || isNaN(new Date(user.lastDungeonTicketRegen).getTime())) {
                    user.lastDungeonTicketRegen = new Date();
                    updated = true;
                    console.log(`[TicketManager] ${user.discordId} 던전 티켓 lastRegen 초기화`);
                } else {
                    const lastRegenTime = new Date(user.lastDungeonTicketRegen).getTime();
                    const timeSinceLastRegen = now - lastRegenTime;
                    const ticketsToRegen = Math.floor(timeSinceLastRegen / TICKET_REGEN_TIME);

                    if (ticketsToRegen > 0) {
                        const previousTickets = user.dungeonTickets;
                        const maxTicketsToAdd = MAX_DUNGEON_TICKETS - previousTickets;
                        const actualTicketsToAdd = Math.min(ticketsToRegen, maxTicketsToAdd);
                        
                        user.dungeonTickets += actualTicketsToAdd;
                        user.lastDungeonTicketRegen = new Date(lastRegenTime + (actualTicketsToAdd * TICKET_REGEN_TIME));
                        updated = true;
                        
                        console.log(`[TicketManager] ${user.discordId} 던전 티켓 재생성: ${previousTickets} → ${user.dungeonTickets} (+${actualTicketsToAdd})`);
                    }
                }
            } else if (user.dungeonTickets === MAX_DUNGEON_TICKETS && user.lastDungeonTicketRegen) {
                // 티켓이 최대치인 경우 lastRegen을 null로 설정
                user.lastDungeonTicketRegen = null;
                updated = true;
                console.log(`[TicketManager] ${user.discordId} 던전 티켓 최대치 도달, lastRegen 초기화`);
            }
        }

        // PVP 티켓 재생성
        if (user.pvpTickets !== undefined) {
            if (user.pvpTickets < MAX_TICKETS) {
                // lastPvpTicketRegen이 없거나 잘못된 경우 현재 시간으로 설정
                if (!user.lastPvpTicketRegen || isNaN(new Date(user.lastPvpTicketRegen).getTime())) {
                    user.lastPvpTicketRegen = new Date();
                    updated = true;
                    console.log(`[TicketManager] ${user.discordId} PVP 티켓 lastRegen 초기화`);
                } else {
                    const lastRegenTime = new Date(user.lastPvpTicketRegen).getTime();
                    const timeSinceLastRegen = now - lastRegenTime;
                    const ticketsToRegen = Math.floor(timeSinceLastRegen / TICKET_REGEN_TIME);

                    if (ticketsToRegen > 0) {
                        const previousTickets = user.pvpTickets;
                        const maxTicketsToAdd = MAX_TICKETS - previousTickets;
                        const actualTicketsToAdd = Math.min(ticketsToRegen, maxTicketsToAdd);
                        
                        user.pvpTickets += actualTicketsToAdd;
                        user.lastPvpTicketRegen = new Date(lastRegenTime + (actualTicketsToAdd * TICKET_REGEN_TIME));
                        updated = true;
                        
                        console.log(`[TicketManager] ${user.discordId} PVP 티켓 재생성: ${previousTickets} → ${user.pvpTickets} (+${actualTicketsToAdd})`);
                    }
                }
            } else if (user.pvpTickets === MAX_TICKETS && user.lastPvpTicketRegen) {
                // 티켓이 최대치인 경우 lastRegen을 null로 설정
                user.lastPvpTicketRegen = null;
                updated = true;
                console.log(`[TicketManager] ${user.discordId} PVP 티켓 최대치 도달, lastRegen 초기화`);
            }
        }

        // 레이드 티켓은 재생성 안함

        if (updated) {
            await user.save();
        }

        return user;
    }

    // 티켓 사용 함수
    static async useTicket(userId, ticketType = 'minigame') {
        let user = await User.findOne({ discordId: userId });
        if (!user) return { success: false, error: '사용자를 찾을 수 없습니다.' };

        // 티켓 재생성 먼저 처리
        user = await this.regenerateTickets(user);

        switch (ticketType) {
            case 'minigame':
                if (!user.minigameTickets) {
                    user.minigameTickets = { tickets: 20, lastRegen: null };
                }
                if (user.minigameTickets.tickets <= 0) {
                    return { success: false, error: '미니게임 티켓이 부족합니다.' };
                }
                
                const previousTickets = user.minigameTickets.tickets;
                user.minigameTickets.tickets--;
                
                // 처음으로 20개에서 줄어들 때 재생성 타이머 시작
                if (previousTickets === MAX_TICKETS && !user.minigameTickets.lastRegen) {
                    user.minigameTickets.lastRegen = new Date();
                    console.log(`[TicketManager] ${userId} 미니게임 티켓 타이머 시작: ${previousTickets} → ${user.minigameTickets.tickets}`);
                }
                
                console.log(`[TicketManager] ${userId} 미니게임 티켓 사용: ${previousTickets} → ${user.minigameTickets.tickets}`);
                console.log(`[TicketManager] lastRegen: ${user.minigameTickets.lastRegen}`);
                break;

            case 'hunting':
                if (user.huntingTickets <= 0) {
                    return { success: false, error: '사냥 티켓이 부족합니다.' };
                }
                const previousHuntingTickets = user.huntingTickets;
                user.huntingTickets--;
                
                // 처음으로 20개에서 줄어들 때 재생성 타이머 시작
                if (previousHuntingTickets === MAX_TICKETS && !user.lastHuntingTicketRegen) {
                    user.lastHuntingTicketRegen = new Date();
                    console.log(`[TicketManager] ${userId} 사냥 티켓 타이머 시작: ${previousHuntingTickets} → ${user.huntingTickets}`);
                }
                
                console.log(`[TicketManager] ${userId} 사냥 티켓 사용: ${previousHuntingTickets} → ${user.huntingTickets}`);
                break;

            case 'rps_bot':
                if (!user.rpsGameData || user.rpsGameData.botTickets <= 0) {
                    return { success: false, error: '가위바위보 봇 티켓이 부족합니다.' };
                }
                user.rpsGameData.botTickets--;
                break;

            case 'rps_user':
                if (!user.rpsGameData || user.rpsGameData.userTickets <= 0) {
                    return { success: false, error: '가위바위보 유저 티켓이 부족합니다.' };
                }
                user.rpsGameData.userTickets--;
                break;

            case 'dungeon':
                if (user.dungeonTickets <= 0) {
                    return { success: false, error: '던전 티켓이 부족합니다.' };
                }
                const previousDungeonTickets = user.dungeonTickets;
                user.dungeonTickets--;
                
                // 처음으로 5개에서 줄어들 때 재생성 타이머 시작
                const MAX_DUNGEON_TICKETS = 5;
                if (previousDungeonTickets === MAX_DUNGEON_TICKETS && !user.lastDungeonTicketRegen) {
                    user.lastDungeonTicketRegen = new Date();
                    console.log(`[TicketManager] ${userId} 던전 티켓 타이머 시작: ${previousDungeonTickets} → ${user.dungeonTickets}`);
                }
                
                console.log(`[TicketManager] ${userId} 던전 티켓 사용: ${previousDungeonTickets} → ${user.dungeonTickets}`);
                break;

            case 'pvp':
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
                if (user.pvpTickets !== undefined && user.pvp.duelTickets !== user.pvpTickets) {
                    user.pvp.duelTickets = user.pvpTickets;
                }
                
                if (!user.pvp.duelTickets || user.pvp.duelTickets <= 0) {
                    return { success: false, error: 'PVP 티켓이 부족합니다.' };
                }
                
                const previousPvpTickets = user.pvp.duelTickets;
                user.pvp.duelTickets--;
                user.pvpTickets = user.pvp.duelTickets; // 역동기화
                
                // 처음으로 20개에서 줄어들 때 재생성 타이머 시작
                if (previousPvpTickets === MAX_TICKETS && !user.lastPvpTicketRegen) {
                    user.lastPvpTicketRegen = new Date();
                    console.log(`[TicketManager] ${userId} PVP 티켓 타이머 시작: ${previousPvpTickets} → ${user.pvp.duelTickets}`);
                }
                
                console.log(`[TicketManager] ${userId} PVP 티켓 사용: ${previousPvpTickets} → ${user.pvp.duelTickets}`);
                break;

            default:
                return { success: false, error: '잘못된 티켓 타입입니다.' };
        }

        const savedUser = await user.save();
        
        // 티켓 타입별로 적절한 로그 표시
        let remainingTickets;
        switch (ticketType) {
            case 'minigame':
                remainingTickets = savedUser.minigameTickets?.tickets;
                break;
            case 'hunting':
                remainingTickets = savedUser.huntingTickets;
                break;
            case 'dungeon':
                remainingTickets = savedUser.dungeonTickets;
                break;
            case 'pvp':
                remainingTickets = savedUser.pvpTickets;
                break;
            case 'rps_bot':
                remainingTickets = savedUser.rpsGameData?.botTickets;
                break;
            case 'rps_user':
                remainingTickets = savedUser.rpsGameData?.userTickets;
                break;
            default:
                remainingTickets = 'unknown';
        }
        
        console.log(`[TicketManager] 티켓 사용 후 저장 완료:`, {
            type: ticketType,
            remainingTickets: remainingTickets
        });
        return { success: true, user: savedUser };
    }

    // 티켓 정보 조회
    static async getTicketInfo(userId) {
        let user = await User.findOne({ discordId: userId });
        if (!user) return null;
        
        // minigameTickets이 없으면 초기화
        if (!user.minigameTickets) {
            user.minigameTickets = {
                tickets: 20,
                lastRegen: null
            };
            user = await user.save();
        }

        console.log(`[TicketManager] ${userId} 티켓 조회 전:`, {
            minigame: user.minigameTickets?.tickets,
            lastRegen: user.minigameTickets?.lastRegen,
            now: new Date()
        });

        // 티켓 재생성
        const updatedUser = await this.regenerateTickets(user);

        const info = {
            minigame: updatedUser.minigameTickets?.tickets || 0,
            hunting: updatedUser.huntingTickets || 0,
            dungeon: updatedUser.dungeonTickets || 0,
            rps_bot: updatedUser.rpsGameData?.botTickets || 0,
            rps_user: updatedUser.rpsGameData?.userTickets || 0,
            pvp: updatedUser.pvpTickets || 0,
            duel: updatedUser.pvp?.duelTickets || 0,
            raid: updatedUser.raidTickets || 0
        };
        
        console.log(`[TicketManager] ${userId} 티켓 조회 후:`, {
            minigame: info.minigame,
            lastRegen: updatedUser.minigameTickets?.lastRegen
        });
        
        return info;
    }
}

module.exports = TicketManager;