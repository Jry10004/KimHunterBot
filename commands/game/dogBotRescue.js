const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DOGBOT_RESCUE_EVENT, calculateDamage, getCurrentFloor, getHPPercentage, createProgressBar } = require('../../data/dogBotRescueEvent');
const User = require('../../models/User');
const stateManager = require('../../systems/dogBotStateManager');

// 쿨다운 관리
const attackCooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('댕댕봇납치')
        .setDescription('납치된 댕댕봇을 구출하는 이벤트에 참여합니다')
        .addSubcommand(subcommand =>
            subcommand
                .setName('공격')
                .setDescription('댕댕봇을 구출하기 위해 공격합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('순위')
                .setDescription('댕댕봇 구출 딜 순위를 확인합니다'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('현황')
                .setDescription('댕댕봇 구출 현황을 확인합니다')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        // 이벤트 활성화 체크 (순위/현황은 항상 볼 수 있음)
        if (subcommand === '공격' && !stateManager.state.status.isActive) {
            return await interaction.reply({
                content: '🚫 현재 댕댕봇 구출 이벤트가 진행중이지 않습니다.',
                ephemeral: true
            });
        }
        
        // 이미 구출 완료
        if (subcommand === '공격' && stateManager.state.status.rescueComplete) {
            return await interaction.reply({
                content: '🎉 댕댕봇은 이미 구출되었습니다!',
                ephemeral: true
            });
        }
        
        if (subcommand === '공격') {
            return await this.handleAttack(interaction);
        } else if (subcommand === '순위') {
            return await this.showRanking(interaction);
        } else if (subcommand === '현황') {
            return await this.showStatus(interaction);
        }
    },
    
    // 공격 처리
    async handleAttack(interaction) {
        await interaction.deferReply();
        
        const userId = interaction.user.id;
        const user = await User.findOne({ discordId: userId });
        
        if (!user || !user.registered) {
            return await interaction.editReply('❌ 먼저 회원가입을 해주세요!');
        }
        
        // 쿨다운 체크
        const now = Date.now();
        const cooldownEnd = attackCooldowns.get(userId);
        
        if (cooldownEnd && cooldownEnd > now) {
            const remainingTime = Math.ceil((cooldownEnd - now) / 1000 / 60);
            return await interaction.editReply(`⏰ 다음 공격까지 ${remainingTime}분 남았습니다!`);
        }
        
        // 현재 층 정보
        const currentFloor = getCurrentFloor();
        const floorNum = stateManager.state.status.currentFloor;
        
        // 무기 정보 가져오기
        let weaponData = null;
        let weaponName = '맨손';
        let enhanceLevel = 0;
        
        if (user.equipment && user.equipment.weapon !== undefined && user.equipment.weapon !== -1) {
            const weapon = user.inventory[user.equipment.weapon];
            if (weapon) {
                weaponName = weapon.name;
                enhanceLevel = weapon.enhancement || 0;
                weaponData = DOGBOT_RESCUE_EVENT.attack.weaponDamage[weapon.name];
            }
        }
        
        // 데미지 계산
        const damageResult = calculateDamage(
            DOGBOT_RESCUE_EVENT.attack.baseDamage.min,
            DOGBOT_RESCUE_EVENT.attack.baseDamage.max,
            weaponData,
            enhanceLevel
        );
        
        // HP 감소
        currentFloor.currentHP = Math.max(0, currentFloor.currentHP - damageResult.damage);
        stateManager.updateFloorHP(floorNum, currentFloor.currentHP);
        
        // 통계 기록
        stateManager.recordDamage(userId, damageResult.damage, floorNum, damageResult.isCritical);
        
        // 쿨다운 설정
        attackCooldowns.set(userId, now + DOGBOT_RESCUE_EVENT.attack.cooldown);
        
        // 결과 임베드
        const hpPercentage = getHPPercentage(currentFloor);
        const progressBar = createProgressBar(hpPercentage);
        
        // 재미있는 메시지 선택
        const attackMessages = [
            `🔨 **${user.nickname}**님이 ${weaponName}${enhanceLevel > 0 ? `+${enhanceLevel}` : ''}(으)로 펀치!`,
            `⚔️ **${user.nickname}**님의 화려한 ${weaponName} 콤보!`,
            `💥 **${user.nickname}**님이 ${weaponName}(으)로 강력한 일격!`,
            `🎯 **${user.nickname}**님의 정확한 ${weaponName} 공격!`,
            `🌟 **${user.nickname}**님이 ${weaponName}(으)로 멋진 한 방!`
        ];
        
        const embed = new EmbedBuilder()
            .setColor(damageResult.isCritical ? '#FFD700' : currentFloor.color)
            .setTitle(`${damageResult.isCritical ? '💥 크리티컬!' : '⚔️ 공격!'} ${currentFloor.name}`)
            .setDescription(attackMessages[Math.floor(Math.random() * attackMessages.length)])
            .addFields(
                { 
                    name: '💢 가한 데미지', 
                    value: `**${damageResult.damage.toLocaleString()}**${damageResult.isCritical ? ' (크리티컬!)' : ''}`, 
                    inline: true 
                },
                {
                    name: '🏹 무기 정보',
                    value: `${weaponName}${enhanceLevel > 0 ? `+${enhanceLevel}` : ''}`,
                    inline: true
                },
                {
                    name: '⚔️ 총 공격 횟수',
                    value: `${stateManager.state.statistics.userAttackCount[userId] || 1}회`,
                    inline: true
                }
            )
            .addFields({
                name: `${currentFloor.emoji || '🏰'} ${floorNum}층 보스 체력`,
                value: `${progressBar} ${hpPercentage}%\n${currentFloor.currentHP.toLocaleString()}/${currentFloor.maxHP.toLocaleString()} HP`,
                inline: false
            });
        
        // 보스 대사
        if (hpPercentage > 70) {
            embed.addFields({
                name: '💬 보스의 반응',
                value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.high[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.high.length)]}"*`,
                inline: false
            });
        } else if (hpPercentage > 30) {
            embed.addFields({
                name: '💬 보스의 반응',
                value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.medium.length)]}"*`,
                inline: false
            });
        } else {
            embed.addFields({
                name: '💬 보스의 반응',
                value: `*"${DOGBOT_RESCUE_EVENT.messages.developerQuotes.low[Math.floor(Math.random() * DOGBOT_RESCUE_EVENT.messages.developerQuotes.low.length)]}"*`,
                inline: false
            });
        }
        
        // 층 클리어 체크
        if (currentFloor.currentHP <= 0) {
            if (floorNum < stateManager.state.status.totalFloors) {
                // 다음 층으로
                stateManager.advanceFloor();
                embed.setColor('#00FF00')
                    .setTitle('🎉 층 돌파!')
                    .setDescription(DOGBOT_RESCUE_EVENT.messages.floorClear[floorNum]);
                
                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('dogbot_next_floor')
                            .setLabel(`${floorNum + 1}층으로 이동`)
                            .setEmoji('🔼')
                            .setStyle(ButtonStyle.Primary)
                    );
                
                return await interaction.editReply({ embeds: [embed], components: [buttons] });
            } else {
                // 이벤트 완료
                stateManager.endEvent();
                embed.setColor('#FFD700')
                    .setTitle('🎊 댕댕봇 구출 성공!')
                    .setDescription(DOGBOT_RESCUE_EVENT.messages.floorClear[5])
                    .addFields({
                        name: '🏆 최종 MVP',
                        value: `<@${stateManager.state.statistics.mvp.userId}> - ${stateManager.state.statistics.mvp.damage.toLocaleString()} 데미지`,
                        inline: false
                    });
            }
        }
        
        return await interaction.editReply({ embeds: [embed] });
    },
    
    // 딜 순위 표시
    async showRanking(interaction) {
        await interaction.deferReply();
        
        const rankings = stateManager.getDamageRanking();
        
        if (rankings.length === 0) {
            return await interaction.editReply({
                content: '📊 아직 아무도 공격하지 않았습니다!',
                ephemeral: true
            });
        }
        
        // 순위별 메달
        const medals = ['🥇', '🥈', '🥉'];
        
        // 순위 텍스트 생성
        let rankingText = '';
        for (let i = 0; i < Math.min(10, rankings.length); i++) {
            const rank = rankings[i];
            const medal = medals[i] || `**${i + 1}.**`;
            const user = await User.findOne({ discordId: rank.userId });
            const nickname = user?.nickname || '알 수 없음';
            
            rankingText += `${medal} **${nickname}**\n`;
            rankingText += `　　💥 총 데미지: **${rank.damage.toLocaleString()}**\n`;
            rankingText += `　　⚔️ 공격 횟수: ${rank.attacks}회 (평균: ${rank.avgDamage.toLocaleString()})\n\n`;
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 댕댕봇 구출 딜량 순위')
            .setDescription(rankingText || '아직 데이터가 없습니다.')
            .addFields({
                name: '📊 전체 통계',
                value: `👥 참여자: **${stateManager.state.statistics.participants.length}명**\n` +
                       `⚔️ 총 공격: **${stateManager.state.statistics.totalAttacks}회**\n` +
                       `💥 총 데미지: **${stateManager.state.statistics.totalDamage.toLocaleString()}**`,
                inline: false
            })
            .setFooter({ text: '10분마다 공격 가능 • 무기 강화로 데미지 증가!' })
            .setTimestamp();
        
        // 층별 MVP
        const floorMVPs = Object.entries(stateManager.state.statistics.floorMVP);
        if (floorMVPs.length > 0) {
            let mvpText = '';
            for (const [floor, mvp] of floorMVPs) {
                if (mvp.userId) {
                    const user = await User.findOne({ discordId: mvp.userId });
                    const floorNum = floor.replace('floor', '');
                    mvpText += `**${floorNum}층**: ${user?.nickname || '알 수 없음'} (${mvp.damage.toLocaleString()})\n`;
                }
            }
            if (mvpText) {
                embed.addFields({
                    name: '🌟 층별 MVP',
                    value: mvpText,
                    inline: false
                });
            }
        }
        
        return await interaction.editReply({ embeds: [embed] });
    },
    
    // 현황 표시
    async showStatus(interaction) {
        await interaction.deferReply();
        
        const currentFloor = getCurrentFloor();
        const floorNum = stateManager.state.status.currentFloor;
        const hpPercentage = getHPPercentage(currentFloor);
        const progressBar = createProgressBar(hpPercentage, 30);
        
        const embed = new EmbedBuilder()
            .setColor(currentFloor.color)
            .setTitle(`🏰 댕댕봇 구출 작전 현황`)
            .setDescription(stateManager.state.status.isActive ? 
                '🚨 **현재 진행 중!**' : 
                stateManager.state.status.rescueComplete ? 
                '✅ **구출 완료!**' : 
                '⏸️ **대기 중**')
            .setThumbnail('https://cdn.discordapp.com/attachments/1291053400540090481/1291446516283723787/dogbot.png');
        
        if (stateManager.state.status.isActive) {
            embed.addFields(
                {
                    name: `📍 현재 위치: ${floorNum}층 - ${currentFloor.name}`,
                    value: currentFloor.description,
                    inline: false
                },
                {
                    name: '💀 보스 정보',
                    value: `${currentFloor.bossQuote}`,
                    inline: false
                },
                {
                    name: '❤️ 보스 체력',
                    value: `${progressBar}\n**${hpPercentage}%** (${currentFloor.currentHP.toLocaleString()}/${currentFloor.maxHP.toLocaleString()} HP)`,
                    inline: false
                }
            );
            
            // 최근 공격 로그
            const recentAttacks = stateManager.state.statistics.attackLog.slice(-5).reverse();
            if (recentAttacks.length > 0) {
                let logText = '';
                for (const attack of recentAttacks) {
                    const user = await User.findOne({ discordId: attack.userId });
                    const timeAgo = Math.floor((Date.now() - attack.timestamp) / 1000 / 60);
                    logText += `• **${user?.nickname || '알 수 없음'}** - ${attack.damage.toLocaleString()}${attack.isCritical ? ' 💥' : ''} (${timeAgo}분 전)\n`;
                }
                embed.addFields({
                    name: '📜 최근 공격 기록',
                    value: logText,
                    inline: false
                });
            }
        }
        
        // 진행 상황
        let progressText = '';
        for (let i = 1; i <= stateManager.state.status.totalFloors; i++) {
            const floor = stateManager.state.floors[i];
            const cleared = i < floorNum || (i === floorNum && floor.currentHP <= 0);
            progressText += cleared ? '✅ ' : i === floorNum ? '🔥 ' : '⬜ ';
            progressText += `**${i}층** ${DOGBOT_RESCUE_EVENT.floors[i].name}\n`;
        }
        
        embed.addFields({
            name: '🗺️ 전체 진행도',
            value: progressText,
            inline: false
        });
        
        // 인질 정보
        const activeHostages = Object.keys(stateManager.state.hostages.activeHostages);
        if (activeHostages.length > 0) {
            embed.addFields({
                name: '🚨 현재 인질',
                value: `${activeHostages.length}명이 붙잡혀 있습니다! 빨리 응답해주세요!`,
                inline: false
            });
        }
        
        return await interaction.editReply({ embeds: [embed] });
    }
};