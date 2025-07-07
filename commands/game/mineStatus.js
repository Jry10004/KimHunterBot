const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MINE_SYSTEM, mineManager } = require('../data/mineSystem');
const MineEntry = require('../models/MineEntry');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minestatus')
        .setNameLocalizations({
            ko: '광산상태'
        })
        .setDescription('Check current mine status and your entries')
        .setDescriptionLocalizations({
            ko: '현재 광산 상태와 입장 기록을 확인합니다'
        }),
    
    async execute(interaction) {
        const userId = interaction.user.id;
        
        const embed = new EmbedBuilder()
            .setColor('#8B4513')
            .setTitle('⛏️ 광산 상태 정보')
            .setDescription('현재 열려있는 광산과 입장 기록')
            .setTimestamp();
        
        // 현재 열린 광산들
        let openMinesInfo = '';
        for (const [mineId, mineState] of mineManager.openMines.entries()) {
            const mine = MINE_SYSTEM.mines[mineId];
            const timeLeft = Math.max(0, mineState.closesAt - Date.now());
            const minutes = Math.floor(timeLeft / 60000);
            
            openMinesInfo += `${mine.emoji} **${mine.name}**\n`;
            openMinesInfo += `└ 남은 시간: ${minutes}분\n`;
            openMinesInfo += `└ 방문자: ${mineState.visitors.size}명\n`;
            
            if (mineState.event && MINE_SYSTEM.events[mineState.event]) {
                openMinesInfo += `└ 이벤트: ${MINE_SYSTEM.events[mineState.event].name}\n`;
            }
            
            // 해당 광산에 입장 가능한지 확인
            const canEnter = await mineManager.canEnter(userId, mineId);
            openMinesInfo += `└ 입장 가능: ${canEnter.canEnter ? '✅' : `❌ (${canEnter.reason})`}\n\n`;
        }
        
        embed.addFields({
            name: '🏔️ 현재 열린 광산',
            value: openMinesInfo || '현재 열린 광산이 없습니다.',
            inline: false
        });
        
        // 오늘의 초보자 광산 입장 횟수
        if (mineManager.isOpen('beginner')) {
            const todayEntries = mineManager.getTodayBeginnerEntries(userId);
            embed.addFields({
                name: '🎫 초보자 광산 입장 현황',
                value: `오늘 입장: ${todayEntries}/20회`,
                inline: true
            });
        }
        
        // 최근 입장 기록 (DB에서 조회)
        try {
            const recentEntries = await MineEntry.find({ userId })
                .sort({ enteredAt: -1 })
                .limit(5);
            
            if (recentEntries.length > 0) {
                let entryHistory = '';
                for (const entry of recentEntries) {
                    const mine = MINE_SYSTEM.mines[entry.mineId];
                    if (mine) {
                        const entryTime = new Date(entry.enteredAt);
                        entryHistory += `${mine.emoji} ${mine.name} - ${entryTime.toLocaleString('ko-KR')}\n`;
                    }
                }
                
                embed.addFields({
                    name: '📜 최근 입장 기록',
                    value: entryHistory,
                    inline: false
                });
            }
        } catch (error) {
            console.error('Failed to fetch mine entries:', error);
        }
        
        // 다음 개방 예정 광산
        let upcomingMines = '';
        for (const [mineId, mine] of Object.entries(MINE_SYSTEM.mines)) {
            if (!mineManager.isOpen(mineId) && mine.openSchedule.type === 'scheduled') {
                const nextOpen = mineManager.getNextOpenTime(mineId);
                if (nextOpen.nextOpen) {
                    const timeUntil = nextOpen.nextOpen - Date.now();
                    const hours = Math.floor(timeUntil / 3600000);
                    const minutes = Math.floor((timeUntil % 3600000) / 60000);
                    upcomingMines += `${mine.emoji} ${mine.name} - ${hours}시간 ${minutes}분 후\n`;
                }
            }
        }
        
        if (upcomingMines) {
            embed.addFields({
                name: '⏰ 다음 개방 예정',
                value: upcomingMines,
                inline: false
            });
        }
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};