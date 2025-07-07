class WaitingRoomCleanup {
    constructor(client, rpsMultiplayerSessions, mushroomMultiplayerSessions, wordGameSessions) {
        this.client = client;
        this.rpsMultiplayerSessions = rpsMultiplayerSessions;
        this.mushroomMultiplayerSessions = mushroomMultiplayerSessions;
        this.wordGameSessions = wordGameSessions || new Map();
        this.interval = null;
        this.cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
        this.waitingRoomChannelNames = ['대기실', 'waiting-room', '게임-대기실', 'game-waiting', '초성게임-대기실', '끝말잇기-대기실'];
        this.waitingRoomCategoryNames = ['게임', 'games', '미니게임', 'minigames'];
        this.gameChannelPatterns = [
            '독버섯게임', '슬롯머신', '가위바위보', '초성게임', '끝말잇기', 
            '-vs-', '몬스터배틀', '홀짝', 'mushroom', 'slot', 'rps', 
            'wordchain', 'chosung', 'monster', 'oddeven'
        ];
    }

    /**
     * Start the cleanup system
     */
    start() {
        if (this.interval) {
            console.log('[WaitingRoomCleanup] System already running');
            return;
        }

        // Run cleanup immediately on start
        this.performCleanup();

        // Set up interval for periodic cleanup
        this.interval = setInterval(() => {
            this.performCleanup();
        }, this.cleanupIntervalMs);

        console.log('[WaitingRoomCleanup] System started - cleaning every 5 minutes');
    }

    /**
     * Stop the cleanup system
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('[WaitingRoomCleanup] System stopped');
        }
    }

    /**
     * Check if there are any active waiting sessions
     */
    hasActiveWaitingSessions() {
        // Check RPS sessions
        for (const [channelId, session] of this.rpsMultiplayerSessions) {
            if (session.status === 'waiting') {
                return true;
            }
        }

        // Check Mushroom game sessions
        for (const [channelId, session] of this.mushroomMultiplayerSessions) {
            if (session.status === 'waiting') {
                return true;
            }
        }
        
        // Check Word game sessions
        for (const [sessionId, session] of this.wordGameSessions) {
            if (session.status === 'waiting') {
                return true;
            }
        }

        return false;
    }

    /**
     * Find all waiting room channels
     */
    findWaitingRoomChannels() {
        const waitingRoomChannels = [];

        this.client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                // Check if channel is a text channel
                if (channel.type !== 0) return; // 0 = GUILD_TEXT

                // Check by channel name
                const channelNameLower = channel.name.toLowerCase();
                const isWaitingRoomByName = this.waitingRoomChannelNames.some(name => 
                    channelNameLower.includes(name.toLowerCase())
                );

                // Check by category name
                let isWaitingRoomByCategory = false;
                if (channel.parent) {
                    const categoryNameLower = channel.parent.name.toLowerCase();
                    isWaitingRoomByCategory = this.waitingRoomCategoryNames.some(name =>
                        categoryNameLower.includes(name.toLowerCase())
                    );
                }

                if (isWaitingRoomByName || isWaitingRoomByCategory) {
                    waitingRoomChannels.push(channel);
                }
            });
        });

        return waitingRoomChannels;
    }

    /**
     * Get active session message IDs for a specific channel
     */
    getActiveSessionMessageIds(channelId) {
        const messageIds = new Set();

        // Check RPS sessions
        const rpsSession = this.rpsMultiplayerSessions.get(channelId);
        if (rpsSession && rpsSession.status === 'waiting' && rpsSession.waitingMessageId) {
            messageIds.add(rpsSession.waitingMessageId);
        }

        // Check Mushroom game sessions
        for (const [sessionId, session] of this.mushroomMultiplayerSessions) {
            if (session.tempChannel && session.tempChannel.id === channelId && 
                session.status === 'waiting' && session.waitingMessageId) {
                messageIds.add(session.waitingMessageId);
            }
        }
        
        // Check Word game sessions
        for (const [sessionId, session] of this.wordGameSessions) {
            if (session.status === 'waiting' && session.waitingChannel && session.waitingChannel.id === channelId && session.waitingMessage) {
                messageIds.add(session.waitingMessage.id);
            }
        }

        return messageIds;
    }

    /**
     * Perform the cleanup operation
     */
    async performCleanup() {
        try {
            // Clean up waiting room messages
            const waitingRoomChannels = this.findWaitingRoomChannels();
            
            if (waitingRoomChannels.length > 0) {
                console.log(`[WaitingRoomCleanup] Found ${waitingRoomChannels.length} waiting room channels`);
                
                // Clean up each waiting room channel
                for (const channel of waitingRoomChannels) {
                    await this.cleanupChannel(channel);
                }
            }

            // Clean up inactive game channels
            await this.cleanupInactiveGameChannels();
            
            // Clean up empty waiting room channels at startup
            await this.cleanupEmptyWaitingRoomChannels();

            console.log('[WaitingRoomCleanup] Cleanup completed');

        } catch (error) {
            console.error('[WaitingRoomCleanup] Error during cleanup:', error);
        }
    }

    /**
     * Clean up messages in a specific channel
     */
    async cleanupChannel(channel) {
        try {
            // Get active session message IDs for this channel
            const activeMessageIds = this.getActiveSessionMessageIds(channel.id);

            // Fetch messages from the channel
            const messages = await channel.messages.fetch({ limit: 100 });
            
            // Filter messages to delete (not from active sessions and not pinned)
            const messagesToDelete = messages.filter(msg => 
                !activeMessageIds.has(msg.id) && !msg.pinned
            );

            if (messagesToDelete.size === 0) {
                console.log(`[WaitingRoomCleanup] No messages to delete in ${channel.name}`);
                return;
            }

            // Delete messages in bulk (Discord limits bulk delete to messages < 14 days old)
            const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            const bulkDeletable = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
            const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

            // Bulk delete recent messages
            if (bulkDeletable.size > 0) {
                if (bulkDeletable.size === 1) {
                    // Delete single message
                    await bulkDeletable.first().delete();
                } else {
                    // Bulk delete multiple messages
                    await channel.bulkDelete(bulkDeletable);
                }
                console.log(`[WaitingRoomCleanup] Deleted ${bulkDeletable.size} messages from ${channel.name}`);
            }

            // Delete old messages individually
            if (oldMessages.size > 0) {
                for (const msg of oldMessages.values()) {
                    try {
                        await msg.delete();
                    } catch (err) {
                        console.error(`[WaitingRoomCleanup] Failed to delete old message: ${err.message}`);
                    }
                }
                console.log(`[WaitingRoomCleanup] Deleted ${oldMessages.size} old messages from ${channel.name}`);
            }

        } catch (error) {
            console.error(`[WaitingRoomCleanup] Error cleaning channel ${channel.name}:`, error);
        }
    }

    /**
     * Find all game channels
     */
    findGameChannels() {
        const gameChannels = [];

        this.client.guilds.cache.forEach(guild => {
            guild.channels.cache.forEach(channel => {
                // Check if channel is a text channel
                if (channel.type !== 0) return; // 0 = GUILD_TEXT

                // Skip waiting room channels
                const channelNameLower = channel.name.toLowerCase();
                const isWaitingRoom = this.waitingRoomChannelNames.some(name => 
                    channelNameLower.includes(name.toLowerCase())
                );
                if (isWaitingRoom) return;

                // Check if it's a game channel
                const isGameChannel = this.gameChannelPatterns.some(pattern => 
                    channelNameLower.includes(pattern.toLowerCase())
                );

                // Also check if it's in a game category
                let isInGameCategory = false;
                if (channel.parent) {
                    const categoryNameLower = channel.parent.name.toLowerCase();
                    isInGameCategory = this.waitingRoomCategoryNames.some(name =>
                        categoryNameLower.includes(name.toLowerCase())
                    ) || categoryNameLower.includes('pvp');
                }

                if (isGameChannel && isInGameCategory) {
                    gameChannels.push(channel);
                }
            });
        });

        return gameChannels;
    }

    /**
     * Clean up inactive game channels
     */
    async cleanupInactiveGameChannels() {
        try {
            const gameChannels = this.findGameChannels();
            
            if (gameChannels.length === 0) {
                console.log('[WaitingRoomCleanup] No game channels found');
                return;
            }

            console.log(`[WaitingRoomCleanup] Found ${gameChannels.length} game channels`);
            let deletedCount = 0;

            for (const channel of gameChannels) {
                try {
                    // Check channel age
                    const channelAge = Date.now() - channel.createdTimestamp;
                    if (channelAge < 30 * 60 * 1000) { // Skip channels younger than 30 minutes
                        continue;
                    }

                    // Check last message
                    const messages = await channel.messages.fetch({ limit: 1 });
                    const lastMessage = messages.first();
                    
                    // Check if there's an active game session
                    let hasActiveSession = false;
                    
                    // Check mushroom game sessions
                    for (const [sessionId, session] of global.mushroomMultiplayerSessions || new Map()) {
                        // 대기실 채널 또는 게임 채널 모두 확인
                        if ((session.tempChannelId === channel.id || session.gameChannelId === channel.id || 
                             session.tempChannel?.id === channel.id || session.gameChannel?.id === channel.id) && 
                            (session.gameStarted || session.players?.size > 0)) {
                            hasActiveSession = true;
                            break;
                        }
                    }
                    
                    // Check PVP sessions
                    const pvpSessions = global.pvpSystem?.waitingRooms || new Map();
                    for (const [sessionId, session] of pvpSessions) {
                        if (session.channelId === channel.id && session.battleStarted) {
                            hasActiveSession = true;
                            break;
                        }
                    }
                    
                    // Check word game sessions  
                    for (const [sessionId, session] of this.wordGameSessions) {
                        if (session.gameChannel && session.gameChannel.id === channel.id && session.status === 'playing') {
                            hasActiveSession = true;
                            break;
                        }
                    }
                    
                    // Delete if no messages or last message is older than 10 minutes AND no active session
                    if (!hasActiveSession && (!lastMessage || (Date.now() - lastMessage.createdTimestamp) > 10 * 60 * 1000)) {
                        await channel.delete('Inactive game channel - auto cleanup');
                        deletedCount++;
                        console.log(`[WaitingRoomCleanup] Deleted inactive channel: ${channel.name}`);
                    } else if (hasActiveSession) {
                        console.log(`[채널 정리] 활성 게임 세션이 있어 채널 유지: ${channel.name}`);
                    }
                } catch (error) {
                    console.error(`[WaitingRoomCleanup] Failed to delete channel ${channel.name}:`, error.message);
                }
            }

            if (deletedCount > 0) {
                console.log(`[WaitingRoomCleanup] Deleted ${deletedCount} inactive game channels`);
            }

        } catch (error) {
            console.error('[WaitingRoomCleanup] Error cleaning up game channels:', error);
        }
    }

    /**
     * Clean up empty waiting room channels
     */
    async cleanupEmptyWaitingRoomChannels() {
        try {
            const waitingRoomChannels = this.findWaitingRoomChannels();
            let deletedCount = 0;

            for (const channel of waitingRoomChannels) {
                try {
                    // Fetch recent messages
                    const messages = await channel.messages.fetch({ limit: 50 });
                    
                    // Check if channel has any active sessions
                    const hasActiveSession = this.hasActiveSessionInChannel(channel.id);
                    
                    // Check if channel is truly empty (no messages or only old bot messages)
                    const hasRecentActivity = messages.some(msg => {
                        const messageAge = Date.now() - msg.createdTimestamp;
                        return messageAge < 30 * 60 * 1000; // Messages less than 30 minutes old
                    });
                    
                    // Delete channel if it's empty and has no active sessions
                    if (!hasActiveSession && (!messages.size || !hasRecentActivity)) {
                        await channel.delete('Empty waiting room channel - auto cleanup at startup');
                        deletedCount++;
                        console.log(`[WaitingRoomCleanup] Deleted empty waiting room: ${channel.name}`);
                    }
                } catch (error) {
                    console.error(`[WaitingRoomCleanup] Failed to check/delete waiting room ${channel.name}:`, error.message);
                }
            }

            if (deletedCount > 0) {
                console.log(`[WaitingRoomCleanup] Deleted ${deletedCount} empty waiting room channels`);
            }

        } catch (error) {
            console.error('[WaitingRoomCleanup] Error cleaning up empty waiting rooms:', error);
        }
    }
    
    /**
     * Check if a channel has any active sessions
     */
    hasActiveSessionInChannel(channelId) {
        // Check RPS sessions
        for (const session of this.rpsMultiplayerSessions.values()) {
            if (session.channel && session.channel.id === channelId) return true;
        }
        
        // Check Mushroom sessions
        for (const session of this.mushroomMultiplayerSessions.values()) {
            // Check if it's a waiting room (tempChannel) that still has players waiting
            if (session.tempChannel && session.tempChannel.id === channelId && 
                !session.gameStarted && session.status === 'waiting') {
                return true;
            }
            // Check if it's an active game channel
            if (session.gameChannel && session.gameChannel.id === channelId && 
                session.gameStarted) {
                return true;
            }
        }
        
        // Check Word Game sessions
        for (const session of this.wordGameSessions.values()) {
            if (session.channel && session.channel.id === channelId) return true;
        }
        
        return false;
    }

    /**
     * Get cleanup status
     */
    getStatus() {
        return {
            running: this.interval !== null,
            intervalMs: this.cleanupIntervalMs,
            waitingRoomChannels: this.waitingRoomChannelNames,
            waitingRoomCategories: this.waitingRoomCategoryNames,
            gameChannelPatterns: this.gameChannelPatterns
        };
    }
}

// Export a factory function to create and initialize the cleanup system
module.exports = {
    createWaitingRoomCleanup: (client, rpsMultiplayerSessions, mushroomMultiplayerSessions, wordGameSessions) => {
        return new WaitingRoomCleanup(client, rpsMultiplayerSessions, mushroomMultiplayerSessions, wordGameSessions);
    }
};