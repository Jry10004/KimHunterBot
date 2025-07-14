const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('내티켓')
        .setDescription('🎫 보유한 티켓 정보를 확인합니다'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const user = await User.findOne({ discordId: interaction.user.id });
            
            if (!user) {
                return await interaction.editReply({
                    content: '❌ 먼저 `/회원가입` 명령어로 가입해주세요!'
                });
            }
            
            // 현재 시간
            const now = new Date();
            
            // 티켓 재생성 시간 계산 함수
            const calculateRegenTime = (lastRegen, currentTickets, maxTickets, regenMinutes) => {
                if (currentTickets >= maxTickets) return null;
                
                const lastRegenTime = lastRegen || now;
                const timePassed = now - lastRegenTime;
                const ticketsToRegen = maxTickets - currentTickets;
                const minutesPassed = Math.floor(timePassed / (1000 * 60));
                const ticketsRegened = Math.floor(minutesPassed / regenMinutes);
                
                if (ticketsRegened < 1) {
                    // 다음 티켓까지 남은 시간
                    const nextTicketMinutes = regenMinutes - (minutesPassed % regenMinutes);
                    return {
                        nextTicket: nextTicketMinutes,
                        fullRegen: nextTicketMinutes + ((ticketsToRegen - 1) * regenMinutes)
                    };
                } else {
                    // 이미 재생성된 티켓이 있는 경우
                    const remainingTickets = ticketsToRegen - ticketsRegened;
                    return {
                        nextTicket: regenMinutes - (minutesPassed % regenMinutes),
                        fullRegen: remainingTickets > 0 ? remainingTickets * regenMinutes : 0
                    };
                }
            };
            
            // PVP 티켓 정보
            const pvpTickets = user.pvp?.duelTickets ?? user.pvpTickets ?? 20;
            const maxPvpTickets = 20;
            const pvpRegenTime = calculateRegenTime(user.pvp?.lastTicketRegen || user.lastTicketRegen, pvpTickets, maxPvpTickets, 30);
            
            // 미니게임 티켓 정보
            const minigameTickets = user.minigame?.tickets ?? 20;
            const maxMinigameTickets = 20;
            const minigameRegenTime = calculateRegenTime(user.minigame?.lastTicketUse, minigameTickets, maxMinigameTickets, 15);
            
            // 사냥 티켓 정보
            const huntingTickets = user.huntingTickets ?? 20;
            const maxHuntingTickets = 20;
            const huntingRegenTime = calculateRegenTime(user.lastHunt ? new Date(user.lastHunt) : null, huntingTickets, maxHuntingTickets, 5);
            
            // 던전 티켓 정보
            const dungeonTickets = user.dungeonTickets ?? 5;
            const maxDungeonTickets = 5;
            const dungeonRegenTime = calculateRegenTime(user.lastDungeonTicketRegen, dungeonTickets, maxDungeonTickets, 30);
            
            // 실제로 티켓 재생성 처리 (서버 재시작 후 업데이트)
            if (pvpTickets < maxPvpTickets && pvpRegenTime) {
                const lastRegen = user.pvp?.lastTicketRegen || user.lastTicketRegen || now;
                const minutesPassed = Math.floor((now - lastRegen) / (1000 * 60));
                const ticketsToAdd = Math.min(Math.floor(minutesPassed / 30), maxPvpTickets - pvpTickets);
                
                if (ticketsToAdd > 0) {
                    if (user.pvp) {
                        user.pvp.duelTickets = Math.min(pvpTickets + ticketsToAdd, maxPvpTickets);
                        user.pvp.lastTicketRegen = now;
                    } else {
                        user.pvpTickets = Math.min(pvpTickets + ticketsToAdd, maxPvpTickets);
                        user.lastTicketRegen = now;
                    }
                    await user.save();
                }
            }
            
            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle('🎫 내 티켓 정보')
                .setColor('#9C27B0')
                .setTimestamp()
                .setThumbnail(interaction.user.displayAvatarURL());
            
            // PVP 티켓
            let pvpValue = `보유: **${pvpTickets}/${maxPvpTickets}장**\n`;
            if (pvpTickets < maxPvpTickets && pvpRegenTime) {
                pvpValue += `다음 티켓: **${pvpRegenTime.nextTicket}분 후**\n`;
                if (pvpRegenTime.fullRegen > 0) {
                    pvpValue += `전체 충전: **${Math.floor(pvpRegenTime.fullRegen / 60)}시간 ${pvpRegenTime.fullRegen % 60}분 후**`;
                }
            } else {
                pvpValue += '✅ 최대 보유중';
            }
            
            embed.addFields({
                name: '⚔️ PVP 결투 티켓',
                value: pvpValue,
                inline: false
            });
            
            // 미니게임 티켓
            let minigameValue = `보유: **${minigameTickets}/${maxMinigameTickets}장**\n`;
            if (minigameTickets < maxMinigameTickets && minigameRegenTime) {
                minigameValue += `다음 티켓: **${minigameRegenTime.nextTicket}분 후**\n`;
                if (minigameRegenTime.fullRegen > 0) {
                    minigameValue += `전체 충전: **${Math.floor(minigameRegenTime.fullRegen / 60)}시간 ${minigameRegenTime.fullRegen % 60}분 후**`;
                }
            } else {
                minigameValue += '✅ 최대 보유중';
            }
            
            embed.addFields({
                name: '🎮 미니게임 티켓',
                value: minigameValue,
                inline: false
            });
            
            // 사냥 티켓
            let huntingValue = `보유: **${huntingTickets}/${maxHuntingTickets}장**\n`;
            if (huntingTickets < maxHuntingTickets && huntingRegenTime) {
                huntingValue += `다음 티켓: **${huntingRegenTime.nextTicket}분 후**\n`;
                if (huntingRegenTime.fullRegen > 0) {
                    huntingValue += `전체 충전: **${Math.floor(huntingRegenTime.fullRegen / 60)}시간 ${huntingRegenTime.fullRegen % 60}분 후**`;
                }
            } else {
                huntingValue += '✅ 최대 보유중';
            }
            
            embed.addFields({
                name: '🏹 사냥 티켓',
                value: huntingValue,
                inline: false
            });
            
            // 던전 티켓
            let dungeonValue = `보유: **${dungeonTickets}/${maxDungeonTickets}장**\n`;
            if (dungeonTickets < maxDungeonTickets && dungeonRegenTime) {
                dungeonValue += `다음 티켓: **${dungeonRegenTime.nextTicket}분 후**\n`;
                if (dungeonRegenTime.fullRegen > 0) {
                    dungeonValue += `전체 충전: **${Math.floor(dungeonRegenTime.fullRegen / 60)}시간 ${dungeonRegenTime.fullRegen % 60}분 후**`;
                }
            } else {
                dungeonValue += '✅ 최대 보유중';
            }
            
            embed.addFields({
                name: '🏰 던전 티켓',
                value: dungeonValue,
                inline: false
            });
            
            // 티켓 충전 정보
            embed.addFields({
                name: '⏱️ 티켓 충전 시간',
                value: '**PVP 티켓**: 30분마다 1장\n**미니게임 티켓**: 15분마다 1장\n**사냥 티켓**: 5분마다 1장\n**던전 티켓**: 30분마다 1장',
                inline: false
            });
            
            // 티켓 사용처
            embed.addFields({
                name: '📍 티켓 사용처',
                value: '**PVP 티켓**\n' +
                       '• `/결투` - 다른 플레이어와 대결 (1장)\n' +
                       '• PVP 랭킹전 참여\n\n' +
                       '**미니게임 티켓**\n' +
                       '• `/홀짝` - 홀짝 게임 (1장)\n' +
                       '• `/독버섯` - 독버섯 게임 (1장)\n' +
                       '• 기타 미니게임 참여\n\n' +
                       '**사냥 티켓**\n' +
                       '• `/사냥` - 몬스터 사냥 (1장)\n' +
                       '• 지역별 보스 사냥\n' +
                       '• 레어 몬스터 추적',
                inline: false
            });
            
            embed.setFooter({ 
                text: '💡 티켓은 자동으로 충전됩니다!' 
            });
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('티켓 정보 조회 오류:', error);
            await interaction.editReply({
                content: '❌ 티켓 정보를 불러오는 중 오류가 발생했습니다.'
            });
        }
    }
};