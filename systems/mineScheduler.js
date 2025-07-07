// 🏔️ 광산 스케줄러 시스템
const { MINE_SYSTEM, mineManager } = require('../data/mineSystem');
const { EmbedBuilder } = require('discord.js');

let client = null;
let schedulerInterval = null;
let newsChannelId = '1389401523418693723'; // 뉴스 채널 ID

// 광산 스케줄러 초기화
function initializeMineScheduler(discordClient) {
    client = discordClient;
    
    // 초보자 광산은 항상 열림
    mineManager.openMine('beginner', 24 * 60); // 24시간
    
    // 정기 스케줄 체크 (1분마다)
    schedulerInterval = setInterval(() => {
        checkScheduledMines();
        checkRandomMines();
        checkRareMines();
        checkClosingMines();
        checkDailyReset();
    }, 60000); // 1분마다
    
    // 초기 체크
    checkScheduledMines();
    
    console.log('⛏️ 광산 스케줄러가 시작되었습니다');
}

// 정기 개방 광산 체크
function checkScheduledMines() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    for (const [mineId, mine] of Object.entries(MINE_SYSTEM.mines)) {
        if (mine.openSchedule.type === 'scheduled' && !mineManager.isOpen(mineId)) {
            // 정확한 시간에 열기
            if (mine.openSchedule.times.includes(currentHour) && currentMinute === 0) {
                openMineWithNotification(mineId, mine.openSchedule.duration);
            }
        }
    }
}

// 랜덤 개방 광산 체크
function checkRandomMines() {
    for (const [mineId, mine] of Object.entries(MINE_SYSTEM.mines)) {
        if (mine.openSchedule.type === 'random' && !mineManager.isOpen(mineId)) {
            const lastOpen = mineManager.lastRandomOpen.get(mineId) || 0;
            const minInterval = mine.openSchedule.minInterval * 60 * 1000;
            const maxInterval = mine.openSchedule.maxInterval * 60 * 1000;
            
            if (Date.now() - lastOpen > minInterval) {
                // 랜덤 확률로 개방
                const chance = (Date.now() - lastOpen - minInterval) / (maxInterval - minInterval);
                if (Math.random() < chance) {
                    // 랜덤 이벤트 가능성
                    const event = Math.random() < 0.3 ? selectRandomEvent() : null;
                    openMineWithNotification(mineId, mine.openSchedule.duration, event);
                    mineManager.lastRandomOpen.set(mineId, Date.now());
                }
            }
        }
    }
}

// 희귀 광산 체크
function checkRareMines() {
    for (const [mineId, mine] of Object.entries(MINE_SYSTEM.mines)) {
        if (mine.openSchedule.type === 'rare' && !mineManager.isOpen(mineId)) {
            if (Math.random() < mine.openSchedule.chance) {
                // 극히 드물게 개방
                openMineWithNotification(mineId, mine.openSchedule.duration, 'special');
            }
        }
    }
}

// 곧 닫힐 광산 체크
function checkClosingMines() {
    for (const [mineId, mineState] of mineManager.openMines.entries()) {
        const timeLeft = mineState.closesAt - Date.now();
        
        // 10분 전 알림
        if (timeLeft <= 10 * 60 * 1000 && timeLeft > 9 * 60 * 1000 && !mineState.closingWarned) {
            sendMineNotification(
                MINE_SYSTEM.mines[mineId],
                MINE_SYSTEM.messages.closing[0],
                '#FFA500'
            );
            mineState.closingWarned = true;
        }
        
        // 폐쇄
        if (timeLeft <= 0) {
            closeMineWithNotification(mineId);
        }
    }
}

// 광산 개방 알림
function openMineWithNotification(mineId, duration, event = null) {
    const mine = MINE_SYSTEM.mines[mineId];
    mineManager.openMine(mineId, duration, event);
    
    let message = MINE_SYSTEM.messages.opened[Math.floor(Math.random() * MINE_SYSTEM.messages.opened.length)];
    let color = '#00FF00';
    
    if (event) {
        if (event === 'special') {
            message = `🌟 **전설의 ${mine.name}이(가) 나타났습니다!** 🌟\n서둘러 입장하세요!`;
            color = '#FFD700';
        } else {
            const eventData = MINE_SYSTEM.events[event];
            message += `\n${eventData.emoji} **이벤트**: ${eventData.name}`;
            color = '#FF69B4';
        }
    }
    
    // 입장 정보 추가
    if (mineId === 'beginner') {
        message += `\n🎫 하루 최대 20회 입장 가능`;
    } else {
        message += `\n🎫 이번 개방에 1회만 입장 가능`;
    }
    
    sendMineNotification(mine, message, color);
}

// 광산 폐쇄 알림
function closeMineWithNotification(mineId) {
    const mine = MINE_SYSTEM.mines[mineId];
    mineManager.closeMine(mineId);
    
    const message = MINE_SYSTEM.messages.closed[Math.floor(Math.random() * MINE_SYSTEM.messages.closed.length)];
    sendMineNotification(mine, message, '#FF0000');
}

// 랜덤 이벤트 선택
function selectRandomEvent() {
    const events = Object.keys(MINE_SYSTEM.events);
    return events[Math.floor(Math.random() * events.length)];
}

// 뉴스 채널에 알림 전송
async function sendMineNotification(mine, message, color) {
    if (!client) return;
    
    try {
        const channel = await client.channels.fetch(newsChannelId);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`${mine.emoji} ${mine.name}`)
            .setDescription(message)
            .addFields(
                { name: '입장료', value: `${mine.entryFee.toLocaleString()} 골드`, inline: true },
                { name: '필요 레벨', value: `Lv.${mine.requiredLevel}`, inline: true },
                { name: '난이도', value: '⭐'.repeat(mine.difficulty), inline: true }
            )
            .setFooter({ text: `/게임 유물탐사 에서 확인하세요!` })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('광산 알림 전송 실패:', error);
    }
}

// 특별 이벤트 트리거 (외부에서 호출 가능)
function triggerSpecialEvent(eventType) {
    if (eventType === 'volcanic_activity') {
        // 화산 광산 개방
        openMineWithNotification('volcanic', 30, 'volcanic_activity');
    }
}

// 일일 초기화 체크 (자정)
function checkDailyReset() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // 자정 0시 0분에 초기화
    if (hour === 0 && minute === 0) {
        mineManager.resetDailyEntries();
        console.log('✅ 초보자 광산 일일 입장 횟수가 초기화되었습니다');
        
        // 뉴스 채널에 알림
        if (client) {
            try {
                const channel = client.channels.cache.get(newsChannelId);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('⛏️ 초보자 광산 입장 초기화')
                        .setDescription('새로운 날이 시작되었습니다!\n초보자 광산 일일 입장 횟수(20회)가 초기화되었습니다.')
                        .setTimestamp();
                    
                    channel.send({ embeds: [embed] });
                }
            } catch (error) {
                console.error('일일 초기화 알림 전송 실패:', error);
            }
        }
    }
}

// 스케줄러 종료
function stopMineScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
    console.log('⛏️ 광산 스케줄러가 종료되었습니다');
}

module.exports = {
    initializeMineScheduler,
    triggerSpecialEvent,
    stopMineScheduler
};