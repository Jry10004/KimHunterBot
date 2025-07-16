const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ChannelType } = require('discord.js');
const User = require('../models/User');
const { createPVPWaitingRoom } = require('../handlers/pvp/pvpWaitingRoom');
const { calculateCombatPower } = require('../handlers/common/utils');
const ActivityLog = require('../models/ActivityLog');
const { applyPVPBonus } = require('../handlers/common/specialEffects');
const lifeSystem = require('./lifeSystemIntegration');
const { 
    calculatePvPDamage, 
    calculateDodgeChance,
    applyWarriorDamageReduction,
    calculateDefenderShield,
    calculateDefenderDamageReduction,
    calculateDefenderCounterAttack,
    calculateThiefDodgeCounter
} = require('../handlers/common/damageCalculator');
const buffSystem = require('../handlers/common/buffSystem');

class PVPSystem {
    constructor() {
        this.matchmakingQueue = new Map(); // userId -> {rating, timestamp, preference}
        this.activeMatches = new Map(); // matchId -> match data
        this.botUsers = new Map(); // 봇 유저 데이터 캐시
        this.tierRanges = {
            'Bronze': { min: 0, max: 1199 },
            'Silver': { min: 1200, max: 1399 },
            'Gold': { min: 1400, max: 1599 },
            'Platinum': { min: 1600, max: 1799 },
            'Master': { min: 1800, max: 1999 },
            'Grandmaster': { min: 2000, max: 2299 },
            'Challenger': { min: 2300, max: 9999 }
        };
        this.initializeBotUsers();
        
        // 오래된 매치 정리 (매 1분마다)
        setInterval(() => this.cleanupOldMatches(), 1 * 60 * 1000);
        
        // PVP 채널 정리 (매 10분마다)
        setInterval(() => this.cleanupPVPChannels(), 10 * 60 * 1000);
    }

    // 오래된 매치 정리
    cleanupOldMatches() {
        const now = Date.now();
        const timeout = 10 * 60 * 1000; // 10분
        
        for (const [matchId, match] of this.activeMatches.entries()) {
            if (now - match.startTime > timeout) {
                console.log(`[PVP] 오래된 매치 제거: ${matchId}`);
                if (match.roundTimer) {
                    clearTimeout(match.roundTimer);
                }
                
                // 활성 매치인 경우 무승부 처리
                if (match.status === 'active') {
                    this.endMatchAsDraw(match, '시간 초과');
                    continue;
                }
                
                // 이미 종료된 매치의 채널 정리
                if (match.tempChannelCreated && match.pvpChannel) {
                    try {
                        match.pvpChannel.delete().catch(err => 
                            console.error('[PVP] 채널 삭제 오류:', err)
                        );
                    } catch (err) {
                        console.error('[PVP] 채널 삭제 실패:', err);
                    }
                }
                this.activeMatches.delete(matchId);
            }
        }
    }
    
    // PVP 채널 정리
    async cleanupPVPChannels() {
        try {
            const client = require('../index').client;
            if (!client || !client.guilds) {
                console.log('[PVP] 클라이언트가 준비되지 않아 채널 정리를 건너뜁니다.');
                return;
            }
            
            let totalCleaned = 0;
            
            for (const guild of client.guilds.cache.values()) {
                // PVP 경기장 카테고리 찾기
                const pvpCategory = guild.channels.cache.find(c => 
                    c.name === '🔥 PVP 경기장' && c.type === 4 // ChannelType.GuildCategory = 4
                );
                
                if (!pvpCategory) {
                    continue;
                }
                
                // 카테고리 내 모든 채널 확인
                const channels = guild.channels.cache.filter(c => 
                    c.parentId === pvpCategory.id && c.type === 0 // ChannelType.GuildText = 0
                );
                
                console.log(`[PVP] ${guild.name} 서버에서 ${channels.size}개의 PVP 채널 확인 중...`);
                
                for (const channel of channels.values()) {
                    try {
                        // 채널에서 마지막 메시지 확인
                        const messages = await channel.messages.fetch({ limit: 1 });
                        const lastMessage = messages.first();
                        
                        const now = Date.now();
                        const lastActivity = lastMessage ? lastMessage.createdTimestamp : channel.createdTimestamp;
                        const inactiveTime = now - lastActivity;
                        
                        // 10분 이상 활동이 없는 채널 삭제
                        if (inactiveTime > 10 * 60 * 1000) {
                            console.log(`[PVP] 비활성 PVP 채널 삭제: ${channel.name} (비활성 시간: ${Math.floor(inactiveTime / 60000)}분)`);
                            await channel.delete('비활성 PVP 채널 자동 정리');
                            totalCleaned++;
                        }
                    } catch (err) {
                        console.error(`[PVP] 채널 정리 오류 (${channel.name}):`, err.message);
                    }
                }
            }
            
            if (totalCleaned > 0) {
                console.log(`[PVP] 총 ${totalCleaned}개의 비활성 채널 정리 완료`);
            }
        } catch (error) {
            console.error('[PVP] 채널 정리 중 오류:', error);
        }
    }
    
    // 봇 유저 데이터 초기화
    async initializeBotUsers() {
        const botProfiles = [
            { name: '강화왕', rating: 1500, tier: 'Gold' },
            { name: '검성', rating: 1800, tier: 'Master' },
            { name: '마검사', rating: 1350, tier: 'Silver' },
            { name: '전설의기사', rating: 2100, tier: 'Grandmaster' },
            { name: '초보냥이', rating: 1000, tier: 'Bronze' },
            { name: '사냥꾼', rating: 1600, tier: 'Platinum' },
            { name: '마법사', rating: 1400, tier: 'Gold' },
            { name: '암살자', rating: 1750, tier: 'Master' }
        ];

        for (const bot of botProfiles) {
            const botData = {
                discordId: `bot_${bot.name}`,
                username: bot.name,
                nickname: bot.name,
                gold: 0,
                level: Math.floor(bot.rating / 20),
                exp: 0,
                isBot: true,
                pvpRating: bot.rating,
                pvpTier: bot.tier,
                pvpWins: Math.floor(Math.random() * 100),
                pvpLosses: Math.floor(Math.random() * 100),
                stats: this.generateBotStats(bot.rating),
                equipment: this.generateBotEquipment(bot.rating)
            };
            this.botUsers.set(botData.discordId, botData);
        }
    }
    
    // 봇 스탯 생성
    generateBotStats(rating) {
        const baseStats = Math.floor(rating / 10);
        return {
            strength: baseStats + Math.floor(Math.random() * 20),
            agility: baseStats + Math.floor(Math.random() * 20),
            intelligence: baseStats + Math.floor(Math.random() * 20),
            vitality: baseStats + Math.floor(Math.random() * 20),
            luck: baseStats + Math.floor(Math.random() * 20)
        };
    }
    
    // 봇 장비 생성
    generateBotEquipment(rating) {
        const quality = rating < 1200 ? 'common' : 
                       rating < 1600 ? 'rare' :
                       rating < 2000 ? 'epic' : 'legendary';
        
        return {
            weapon: { 
                name: `${quality} 무기`, 
                attack: Math.floor(rating / 5) 
            },
            armor: { 
                name: `${quality} 갑옷`, 
                defense: Math.floor(rating / 8) 
            }
        };
    }
    
    // 티어 계산
    getTierByRating(rating) {
        for (const [tier, range] of Object.entries(this.tierRanges)) {
            if (rating >= range.min && rating <= range.max) {
                return tier;
            }
        }
        return 'Bronze';
    }
    
    // 티어 이모지 가져오기
    getTierEmoji(tier) {
        const emojis = {
            'Bronze': '🥉',
            'Silver': '🥈',
            'Gold': '🥇',
            'Platinum': '💎',
            'Master': '🏆',
            'Grandmaster': '👑',
            'Challenger': '🌟'
        };
        return emojis[tier] || '🥉';
    }
    
    // 티켓 재생성
    async regenerateTickets(user) {
        const now = Date.now();
        const lastRegen = user.lastTicketRegen || 0;
        const timePassed = now - lastRegen;
        const regenInterval = 5 * 60 * 1000; // 5분
        
        if (timePassed >= regenInterval) {
            const ticketsToAdd = Math.floor(timePassed / regenInterval);
            user.pvpTickets = Math.min(20, (user.pvpTickets || 0) + ticketsToAdd);
            user.lastTicketRegen = now;
            await user.save();
        }
    }
    
    // PVP 대기실 생성
    async createWaitingRoom(interaction, user) {
        console.log('[PVPSystem] createWaitingRoom called');
        return await createPVPWaitingRoom(interaction, user, this);
    }
    
    // 펜들럼 선택 처리
    async handlePendulumChoice(interaction, matchId, position, userId = null) {
        // 매치 ID 검증
        if (!matchId) {
            console.error('[PVP] 펜들럼 선택 오류: matchId가 없습니다');
            if (interaction) {
                return await interaction.reply({ 
                    content: '❌ 오류가 발생했습니다. 다시 시도해주세요.', 
                    flags: 64 
                });
            }
            return;
        }
        
        const match = this.activeMatches.get(matchId);
        
        // 디버깅 로그
        console.log(`[PVP] 펜들럼 선택 시도 - matchId: ${matchId}, 매치 존재: ${!!match}, 상태: ${match?.status}`);
        
        if (!match) {
            console.error(`[PVP] 매치를 찾을 수 없음: ${matchId}`);
            console.log('[PVP] 현재 활성 매치들:', Array.from(this.activeMatches.keys()));
            if (interaction) {
                try {
                    if (interaction.deferred) {
                        return await interaction.editReply({ 
                            content: '❌ 매치가 종료되었거나 찾을 수 없습니다.'
                        });
                    } else if (!interaction.replied) {
                        return await interaction.reply({ 
                            content: '❌ 매치가 종료되었거나 찾을 수 없습니다.', 
                            flags: 64 
                        });
                    }
                } catch (error) {
                    console.error('[PVP] 매치 없음 응답 오류:', error.code);
                }
            }
            return;
        }
        
        if (match.status !== 'active') {
            console.error(`[PVP] 매치가 활성 상태가 아님: ${matchId}, 현재 상태: ${match.status}`);
            if (interaction) {
                try {
                    if (interaction.deferred) {
                        return await interaction.editReply({ 
                            content: '❌ 매치가 아직 시작되지 않았거나 이미 종료되었습니다.'
                        });
                    } else if (!interaction.replied) {
                        return await interaction.reply({ 
                            content: '❌ 매치가 아직 시작되지 않았거나 이미 종료되었습니다.', 
                            flags: 64 
                        });
                    }
                } catch (error) {
                    console.error('[PVP] 매치 상태 응답 오류:', error.code);
                }
            }
            return;
        }

        const actualUserId = userId || interaction?.user.id;
        if (!actualUserId) return;
        
        // 참가자인지 확인
        if (actualUserId !== match.player1.user.discordId && 
            (!match.player2.isBot && actualUserId !== match.player2.user.discordId)) {
            if (interaction) {
                return await interaction.reply({ 
                    content: '❌ 이 매치의 참가자가 아닙니다.', 
                    flags: 64 
                });
            }
            return;
        }

        // 이미 선택했는지 확인
        if (match.pendingActions.has(actualUserId)) {
            if (interaction) {
                try {
                    if (interaction.deferred) {
                        return await interaction.editReply({ 
                            content: '⚠️ 이미 선택하셨습니다!'
                        });
                    } else if (!interaction.replied) {
                        return await interaction.reply({ 
                            content: '⚠️ 이미 선택하셨습니다!', 
                            flags: 64 
                        });
                    }
                } catch (error) {
                    console.error('[PVP] 중복 선택 응답 오류:', error.code);
                }
            }
            return;
        }

        // 선택 저장
        match.pendingActions.set(actualUserId, position);
        
        if (interaction) {
            const positionLabels = {
                'high': '🗿 강공',
                'middle': '⚖️ 균형',
                'low': '💨 회피'
            };
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply({ 
                        content: `✅ **${positionLabels[position]}**를 선택했습니다!` 
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({ 
                        content: `✅ **${positionLabels[position]}**를 선택했습니다!`, 
                        flags: 64 
                    });
                }
            } catch (error) {
                console.error('[PVP] 펜들럼 선택 응답 오류:', error.code);
            }
        }

        // 두 플레이어 모두 선택했는지 확인
        this.checkRoundComplete(match);
    }
    
    // 라운드 완료 확인
    checkRoundComplete(match) {
        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;

        if (match.pendingActions.has(p1Id) && match.pendingActions.has(p2Id)) {
            if (match.roundTimer) {
                clearTimeout(match.roundTimer);
                match.roundTimer = null;
            }
            this.resolveRound(match);
        }
    }
    
    // 강제 라운드 종료
    forceRoundEnd(match) {
        // 매치 상태 확인
        if (!match || match.status !== 'active') {
            console.log(`[PVP] 강제 라운드 종료 취소 - 매치 상태: ${match?.status}`);
            return;
        }
        
        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;

        // 선택하지 않은 플레이어는 중단 선택
        if (!match.pendingActions.has(p1Id)) {
            match.pendingActions.set(p1Id, 'middle');
            console.log(`[PVP] ${match.player1.user.nickname} 시간 초과 - 자동으로 중간 선택`);
        }
        if (!match.pendingActions.has(p2Id)) {
            match.pendingActions.set(p2Id, 'middle');
            console.log(`[PVP] ${match.player2.user.nickname} 시간 초과 - 자동으로 중간 선택`);
        }

        this.resolveRound(match);
    }
    
    // 위치 이름 변환
    getPositionName(position) {
        const names = {
            'high': '🗡️ 강공',
            'middle': '⚖️ 균형',
            'low': '💨 회피'
        };
        return names[position] || position;
    }
    
    // 라운드 결과 처리
    async resolveRound(match) {
        const channel = match.pvpChannel;
        if (!channel) return;
        
        // 라운드 진행 중 플래그 해제
        match.roundInProgress = false;

        const p1Id = match.player1.user.discordId;
        const p2Id = match.player2.user.discordId;
        const p1Choice = match.pendingActions.get(p1Id);
        const p2Choice = match.pendingActions.get(p2Id);

        // 버프 적용된 스탯 계산
        const p1BaseStats = this.calculateCombatStats(match.player1);
        const p2BaseStats = this.calculateCombatStats(match.player2);
        const p1Stats = this.applyBuffsToStats(p1BaseStats, match.player1Buffs);
        const p2Stats = this.applyBuffsToStats(p2BaseStats, match.player2Buffs);

        let p1Damage = 0;
        let p2Damage = 0;
        let p1Effects = [];
        let p2Effects = [];
        let resultText = '';

        // 새로운 스킬 시스템 - 레벨 기반 스케일링
        const p1Level = match.player1.user.level;
        const p2Level = match.player2.user.level;
        
        // 라운드 기반 증폭 (고스펙 전투를 빨리 끝내기 위해)
        const roundAmplifier = 1 + (match.round * 0.1); // 매 라운드 10% 증폭
        
        const getSkillStats = (level) => ({
            'high': { 
                damage: 1.05 + (level * 0.0025),     // 1.05 → 1.30 (레벨 100)
                accuracy: 0.70 + (level * 0.001),     // 70% → 80%
                successBuff: 0.05 + (level * 0.001),  // 5% → 15% 공격력 증가
                failDebuff: 0.05 + (level * 0.001),   // 5% → 15% 받는 피해 증가
                name: '🗡️ 강공' 
            },
            'middle': { 
                damage: 0.85 + (level * 0.001),      // 0.85 → 0.95
                accuracy: 1.0,                        // 100% 고정
                penetration: 0.05 + (level * 0.0015), // 5% → 20% 방어 무시
                nextTurnDefense: 0.05 + (level * 0.001), // 5% → 15% 방어력 증가
                name: '⚖️ 균형' 
            },
            'low': { 
                damage: 0.3 + (level * 0.002),       // 0.3 → 0.5
                accuracy: 1.0,                        // 100% 고정
                dodgeRate: 0.15 + (level * 0.0025),  // 15% → 40% 회피율
                counterMultiplier: 1.3 + (level * 0.005), // 1.3 → 1.8배 반격
                name: '💨 회피' 
            }
        });
        
        const p1SkillBonus = getSkillStats(p1Level)[p1Choice];
        const p2SkillBonus = getSkillStats(p2Level)[p2Choice];
        
        // 강화 효과 적용
        const p1Enhancement = match.player1.user.pvpEnhancement || { high: 0, middle: 0, low: 0 };
        const p2Enhancement = match.player2.user.pvpEnhancement || { high: 0, middle: 0, low: 0 };
        
        // Player 1 강화 적용 (곡괭이와 유사한 수치)
        if (p1Choice === 'high') {
            p1SkillBonus.damage += (p1Enhancement.high * 0.004); // 레벨당 0.4% (100레벨 = 40%)
            p1SkillBonus.accuracy += (p1Enhancement.high * 0.002); // 레벨당 0.2% (100레벨 = 20%)
        } else if (p1Choice === 'middle') {
            p1SkillBonus.penetration += (p1Enhancement.middle * 0.005); // 레벨당 0.5% (100레벨 = 50%)
            p1SkillBonus.nextTurnDefense += (p1Enhancement.middle * 0.003); // 레벨당 0.3% (100레벨 = 30%)
        } else if (p1Choice === 'low') {
            p1SkillBonus.dodgeRate += (p1Enhancement.low * 0.006); // 레벨당 0.6% (100레벨 = 60%)
            p1SkillBonus.counterMultiplier += (p1Enhancement.low * 0.004); // 레벨당 0.4% (100레벨 = 40%)
        }
        
        // Player 2 강화 적용
        // Player 2 강화 적용 (곡괭이와 유사한 수치)
        if (p2Choice === 'high') {
            p2SkillBonus.damage += (p2Enhancement.high * 0.004); // 레벨당 0.4% (100레벨 = 40%)
            p2SkillBonus.accuracy += (p2Enhancement.high * 0.002); // 레벨당 0.2% (100레벨 = 20%)
        } else if (p2Choice === 'middle') {
            p2SkillBonus.penetration += (p2Enhancement.middle * 0.005); // 레벨당 0.5% (100레벨 = 50%)
            p2SkillBonus.nextTurnDefense += (p2Enhancement.middle * 0.003); // 레벨당 0.3% (100레벨 = 30%)
        } else if (p2Choice === 'low') {
            p2SkillBonus.dodgeRate += (p2Enhancement.low * 0.006); // 레벨당 0.6% (100레벨 = 60%)
            p2SkillBonus.counterMultiplier += (p2Enhancement.low * 0.004); // 레벨당 0.4% (100레벨 = 40%)
        }

        // 공격 결과 계산
        if (p1Choice === p2Choice) {
            resultText = `🛡️ **페리!** 두 플레이어가 ${p1SkillBonus.name}를 동시에 사용!\n💥 공격이 충돌하며 서로를 밀어냅니다!\n\n`;
            
            // 새로운 페리 시스템 - 각자의 스킬 효과는 적용되지만 데미지는 50% 감소
            const reflectDamage1 = Math.floor(p1Stats.attack * p1SkillBonus.damage * 0.5 * roundAmplifier);
            const reflectDamage2 = Math.floor(p2Stats.attack * p2SkillBonus.damage * 0.5 * roundAmplifier);
            
            match.player1HP = Math.max(0, match.player1HP - reflectDamage2);
            match.player2HP = Math.max(0, match.player2HP - reflectDamage1);
            
            resultText += `⚡ 충돌로 인한 반동 데미지!\n`;
            resultText += `💥 ${match.player1.user.nickname}: -${reflectDamage2} HP\n`;
            resultText += `💥 ${match.player2.user.nickname}: -${reflectDamage1} HP`;
        } else {
            resultText = '🎯 **공방 교환!**\n\n';
            
            // Player 1 공격
            const skill1 = p1SkillBonus;
                // 통합 데미지 계산 시스템 사용
                const p1DamageResult = calculatePvPDamage(match.player1.user, match.player2.user, p1Choice, match);
                
                if (p1DamageResult.isDodged) {
                    match.lastP1Hit = false; // 강공 실패 기록
                    resultText += `🌀 **${match.player2.user.nickname}**이(가) ${match.player1.user.nickname}의 ${skill1.name}를 회피!\n\n`;
                    
                    // 회피 스킬 사용 시 반격
                    if (p2Choice === 'low') {
                        const level = match.player2.user.level || 1;
                        const counterMultiplier = 1.3 + (level * 0.005); // 1.3 → 1.8배
                        const counterDamage = Math.floor(p2Stats.attack * 0.5 * counterMultiplier * roundAmplifier);
                        match.player1HP = Math.max(0, match.player1HP - counterDamage);
                        resultText += `💨 **회피 반격!** ${match.player2.user.nickname}이(가) ${counterDamage} 데미지로 반격!\n\n`;
                    }
                    
                    // 도적 회피 반격 체크
                    const dodgeCounter = calculateThiefDodgeCounter(match.player1.user, match.player2.user);
                    if (dodgeCounter.hasCounter) {
                        const amplifiedCounterDamage = Math.floor(dodgeCounter.counterDamage * roundAmplifier);
                        match.player1HP = Math.max(0, match.player1HP - amplifiedCounterDamage);
                        resultText += `🗡️ **도적 반격!** ${match.player2.user.nickname}이(가) ${amplifiedCounterDamage} 데미지로 추가 반격!\n\n`;
                    }
                } else if (p1DamageResult.damage > 0) {
                    match.lastP1Hit = true; // 강공 성공 기록
                    p1Damage = p1DamageResult.damage;
                    
                    // 크리티컬 표시
                    if (p1DamageResult.isCritical) {
                        p1Effects.push('🎆 크리티컬!');
                    }
                    
                    // 궁수 2연타 체크
                    if (p1DamageResult.hasDoubleHit) {
                        p1Effects.push('🏹 2연타!');
                        p1Damage = p1DamageResult.totalDamage;
                    }
                    
                    // 도적 추가 공격 체크
                    if (p1DamageResult.hasExtraAttack) {
                        p1Effects.push('🗡️ 그림자 공격!');
                        p1Damage = p1DamageResult.totalDamage;
                    }
                    
                    // 라운드별 데미지 증가 (라운드당 10%씩 누적 증가)
                    if (match.round >= 2) {
                        const roundMultiplier = 1 + ((match.round - 1) * 0.10);
                        p1Damage = Math.floor(p1Damage * roundMultiplier);
                        if (match.round >= 5) {
                            p1Effects.push(`🔥 전투 격화! x${roundMultiplier.toFixed(2)}`);
                        }
                    }
                    
                    // 수호자 보호막 적용
                    const shieldReduction = calculateDefenderShield(match.player2.user);
                    const baseReduction = calculateDefenderDamageReduction(match.player2.user);
                    const totalReduction = shieldReduction + baseReduction;
                    
                    if (totalReduction > 0) {
                        const reducedDamage = Math.floor(p1Damage * (1 - totalReduction));
                        const absorbed = p1Damage - reducedDamage;
                        p1Damage = reducedDamage;
                        p2Effects.push(`🛡️ 보호막 흡수 -${absorbed}`);
                    }
                    
                    // 전사 불굴의 의지 체크
                    const warriorReduction = applyWarriorDamageReduction(p1Damage, match.player2.user);
                    if (warriorReduction.reduced) {
                        p1Damage = warriorReduction.damage;
                        p2Effects.push(`⚔️ 불굴의 의지! -${warriorReduction.reductionAmount}`);
                    }
                    
                    // 최종 데미지 적용
                    match.player2HP = Math.max(0, match.player2HP - p1Damage);
                    
                    // 수호자 반격 체크
                    const counterAttack = calculateDefenderCounterAttack(p1Damage, match.player2.user);
                    if (counterAttack.hasCounter && match.player2HP > 0) {
                        match.player1HP = Math.max(0, match.player1HP - counterAttack.counterDamage);
                        p2Effects.push(`🛡️ 반격! ${counterAttack.counterDamage} 데미지`);
                    }
                
                // 흡혈 처리 (HP가 0이 아닐 때만)
                if (p1Stats.lifesteal > 0 && match.player1HP > 0) {
                    // 최대 회복량 제한 (데미지의 50% 까지만)
                    const maxHeal = Math.floor(p1Damage * 0.5);
                    const baseHeal = Math.floor(p1Damage * p1Stats.lifesteal);
                    const heal = Math.min(baseHeal, maxHeal);
                    
                    // 연속 회복 페널티 (3라운드 이내 재사용시 50% 감소)
                    const healPenalty = (match.round - match.player1LastHealRound <= 3) ? 0.5 : 1;
                    const finalHeal = Math.floor(heal * healPenalty);
                    
                    if (finalHeal > 0) {
                        match.player1HP = Math.min(p1Stats.maxHp, match.player1HP + finalHeal);
                        match.player1HealCount++;
                        match.player1LastHealRound = match.round;
                        
                        if (healPenalty < 1) {
                            p1Effects.push(`🩸 흡혈 +${finalHeal} (연속 사용 페널티)`);
                        } else {
                            p1Effects.push(`🩸 흡혈 +${finalHeal}`);
                        }
                    }
                }
                
                // 스킬 버프 효과
                const skillEffect = this.applySkillBuffs(p1Stats, p2Stats, p1Choice, true, match);
                if (skillEffect) {
                    p1Effects.push(skillEffect);
                }
                
                resultText += `⚔️ **${match.player1.user.nickname}**의 ${skill1.name}!\n`;
                resultText += `💥 ${p1Damage} 데미지! ${p1Effects.join(' ')}\n\n`;
            } else {
                resultText += `❌ **${match.player1.user.nickname}**의 ${skill1.name}이 빗나갔습니다!\n\n`;
            }

            // Player 2 공격
            const skill2 = p2SkillBonus;
                // 통합 데미지 계산 시스템 사용
                const p2DamageResult = calculatePvPDamage(match.player2.user, match.player1.user, p2Choice, match);
                
                if (p2DamageResult.isDodged) {
                    match.lastP2Hit = false; // 강공 실패 기록
                    resultText += `🌀 **${match.player1.user.nickname}**이(가) ${match.player2.user.nickname}의 ${skill2.name}를 회피!\n\n`;
                    
                    // 회피 스킬 사용 시 반격
                    if (p1Choice === 'low') {
                        const level = match.player1.user.level || 1;
                        const counterMultiplier = 1.3 + (level * 0.005); // 1.3 → 1.8배
                        const counterDamage = Math.floor(p1Stats.attack * 0.5 * counterMultiplier * roundAmplifier);
                        match.player2HP = Math.max(0, match.player2HP - counterDamage);
                        resultText += `💨 **회피 반격!** ${match.player1.user.nickname}이(가) ${counterDamage} 데미지로 반격!\n\n`;
                    }
                    
                    // 도적 회피 반격 체크
                    const dodgeCounter = calculateThiefDodgeCounter(match.player2.user, match.player1.user);
                    if (dodgeCounter.hasCounter) {
                        const amplifiedCounterDamage = Math.floor(dodgeCounter.counterDamage * roundAmplifier);
                        match.player2HP = Math.max(0, match.player2HP - amplifiedCounterDamage);
                        resultText += `🗡️ **도적 반격!** ${match.player1.user.nickname}이(가) ${amplifiedCounterDamage} 데미지로 추가 반격!\n\n`;
                    }
                } else if (p2DamageResult.damage > 0) {
                    match.lastP2Hit = true; // 강공 성공 기록
                    p2Damage = p2DamageResult.damage;
                    
                    // 크리티컬 표시
                    if (p2DamageResult.isCritical) {
                        p2Effects.push('🎆 크리티컬!');
                    }
                    
                    // 궁수 2연타 체크
                    if (p2DamageResult.hasDoubleHit) {
                        p2Effects.push('🏹 2연타!');
                        p2Damage = p2DamageResult.totalDamage;
                    }
                    
                    // 도적 추가 공격 체크
                    if (p2DamageResult.hasExtraAttack) {
                        p2Effects.push('🗡️ 그림자 공격!');
                        p2Damage = p2DamageResult.totalDamage;
                    }
                    
                    // 라운드별 데미지 증가 (라운드당 10%씩 누적 증가)
                    if (match.round >= 2) {
                        const roundMultiplier = 1 + ((match.round - 1) * 0.10);
                        p2Damage = Math.floor(p2Damage * roundMultiplier);
                        if (match.round >= 5) {
                            p2Effects.push(`🔥 전투 격화! x${roundMultiplier.toFixed(2)}`);
                        }
                    }
                    
                    // 수호자 보호막 적용
                    const shieldReduction = calculateDefenderShield(match.player1.user);
                    const baseReduction = calculateDefenderDamageReduction(match.player1.user);
                    const totalReduction = shieldReduction + baseReduction;
                    
                    if (totalReduction > 0) {
                        const reducedDamage = Math.floor(p2Damage * (1 - totalReduction));
                        const absorbed = p2Damage - reducedDamage;
                        p2Damage = reducedDamage;
                        p1Effects.push(`🛡️ 보호막 흡수 -${absorbed}`);
                    }
                    
                    // 전사 불굴의 의지 체크
                    const warriorReduction = applyWarriorDamageReduction(p2Damage, match.player1.user);
                    if (warriorReduction.reduced) {
                        p2Damage = warriorReduction.damage;
                        p1Effects.push(`⚔️ 불굴의 의지! -${warriorReduction.reductionAmount}`);
                    }
                    
                    // 최종 데미지 적용
                    match.player1HP = Math.max(0, match.player1HP - p2Damage);
                    
                    // 수호자 반격 체크
                    const counterAttack = calculateDefenderCounterAttack(p2Damage, match.player1.user);
                    if (counterAttack.hasCounter && match.player1HP > 0) {
                        match.player2HP = Math.max(0, match.player2HP - counterAttack.counterDamage);
                        p1Effects.push(`🛡️ 반격! ${counterAttack.counterDamage} 데미지`);
                    }
                
                // 흡혈 처리 (HP가 0이 아닐 때만)
                if (p2Stats.lifesteal > 0 && match.player2HP > 0) {
                    // 최대 회복량 제한 (데미지의 50% 까지만)
                    const maxHeal = Math.floor(p2Damage * 0.5);
                    const baseHeal = Math.floor(p2Damage * p2Stats.lifesteal);
                    const heal = Math.min(baseHeal, maxHeal);
                    
                    // 연속 회복 페널티 (3라운드 이내 재사용시 50% 감소)
                    const healPenalty = (match.round - match.player2LastHealRound <= 3) ? 0.5 : 1;
                    const finalHeal = Math.floor(heal * healPenalty);
                    
                    if (finalHeal > 0) {
                        match.player2HP = Math.min(p2Stats.maxHp, match.player2HP + finalHeal);
                        match.player2HealCount++;
                        match.player2LastHealRound = match.round;
                        
                        if (healPenalty < 1) {
                            p2Effects.push(`🩸 흡혈 +${finalHeal} (연속 사용 페널티)`);
                        } else {
                            p2Effects.push(`🩸 흡혈 +${finalHeal}`);
                        }
                    }
                }
                
                // 스킬 버프 효과
                const skillEffect = this.applySkillBuffs(p2Stats, p1Stats, p2Choice, false, match);
                if (skillEffect) {
                    p2Effects.push(skillEffect);
                }
                
                resultText += `⚔️ **${match.player2.user.nickname}**의 ${skill2.name}!\n`;
                resultText += `💥 ${p2Damage} 데미지! ${p2Effects.join(' ')}`;
            } else {
                resultText += `❌ **${match.player2.user.nickname}**의 ${skill2.name}이 빗나갔습니다!`;
            }
        }

        // HP 바 생성
        const createHPBar = (current, max) => {
            const percentage = Math.max(0, Math.floor((current / max) * 100));
            const filled = Math.floor(percentage / 10);
            const empty = 10 - filled;
            let barColor = '🟩';
            if (percentage <= 20) barColor = '🟥';
            else if (percentage <= 50) barColor = '🟨';
            const bar = barColor.repeat(filled) + '⬜'.repeat(empty);
            return bar;
        };

        const resultEmbed = new EmbedBuilder()
            .setColor(p1Choice === p2Choice ? '#3498db' : '#e74c3c')
            .setTitle(`⚔️ 【라운드 ${match.round} 결과】⚔️`)
            .setDescription(resultText)
            .addFields(
                {
                    name: `👤 ${match.player1.user.nickname}`,
                    value: `기술: ${this.getPositionName(p1Choice)}\nHP: ${createHPBar(match.player1HP, p1Stats.maxHp)} ${match.player1HP}/${p1Stats.maxHp}`,
                    inline: true
                },
                {
                    name: 'VS',
                    value: `🎯 대미지\n${p1Damage} ↔️ ${p2Damage}`,
                    inline: true
                },
                {
                    name: `👤 ${match.player2.user.nickname}`,
                    value: `기술: ${this.getPositionName(p2Choice)}\nHP: ${createHPBar(match.player2HP, p2Stats.maxHp)} ${match.player2HP}/${p2Stats.maxHp}`,
                    inline: true
                }
            )
            .setTimestamp();


        // 버프 지속시간 감소
        if (match.player1Buffs) {
            match.player1Buffs = match.player1Buffs.filter(buff => {
                buff.duration--;
                return buff.duration > 0;
            });
        }
        if (match.player2Buffs) {
            match.player2Buffs = match.player2Buffs.filter(buff => {
                buff.duration--;
                return buff.duration > 0;
            });
        }
        
        // 라운드 제한 체크
        if (match.round >= match.maxRounds) {
            await channel.send({ embeds: [resultEmbed] });
            await this.endMatchAsDraw(match, '최대 라운드 도달');
            return;
        }

        // 먼저 전투 데미지로 인한 사망 체크
        if (match.player1HP <= 0 || match.player2HP <= 0) {
            // 전투로 끝난 경우 바로 종료
            await channel.send({ embeds: [resultEmbed] });
            if (match.status === 'active') {
                await this.endMatch(match);
            }
            return;
        }

        // 턴 종료 버프 처리 (독 데미지 등)
        const buffEffects = await this.processEndTurnBuffs(match);
        if (buffEffects.length > 0) {
            resultEmbed.addFields({
                name: '🌟 지속 효과',
                value: buffEffects.join('\n'),
                inline: false
            });
        }

        // 독 데미지로 인한 사망 체크
        if (match.player1HP <= 0 || match.player2HP <= 0) {
            // 독으로 끝난 경우에만 최종 결과 전송
            await channel.send({ embeds: [resultEmbed] });
            if (match.status === 'active') {
                await this.endMatch(match);
            }
            return;
        }

        // 아직 게임이 계속되는 경우에만 결과 전송
        if (match.status === 'active') {
            await channel.send({ embeds: [resultEmbed] });
            match.round++;
            setTimeout(() => this.startRound(match), 3000);
        }
    }
    
    // 무승부로 매치 종료
    async endMatchAsDraw(match, reason = '시간 초과') {
        // 이미 종료된 매치인지 확인
        if (match.status === 'finished' || match.status === 'ending') {
            console.log('[PVP] 이미 종료된 매치입니다:', match.matchId);
            return;
        }
        
        // 종료 중 상태로 변경
        match.status = 'ending';
        
        const channel = match.pvpChannel;
        if (!channel) return;

        // 무승부 결과 임베드
        const drawEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🤝 무승부!')
            .setDescription(`${reason}으로 인해 경기가 무승부로 종료되었습니다.`)
            .addFields(
                {
                    name: '📊 최종 상태',
                    value: `${match.player1.user.nickname}: ${match.player1HP} HP\n${match.player2.user.nickname}: ${match.player2HP} HP`,
                    inline: true
                },
                {
                    name: '⏱️ 경기 정보',
                    value: `총 라운드: ${match.round}\n경기 시간: ${Math.floor((Date.now() - match.startTime) / 1000)}초`,
                    inline: true
                }
            )
            .setFooter({ text: '양쪽 모두 레이팅 변화 없음' });

        await channel.send({ embeds: [drawEmbed] });

        // 무승부 기록 업데이트
        if (!match.player1.isBot) {
            match.player1.user.pvp.draws = (match.player1.user.pvp.draws || 0) + 1;
            match.player1.user.pvp.totalDuels = (match.player1.user.pvp.totalDuels || 0) + 1;
            match.player1.user.pvp.winStreak = 0; // 연승 초기화
            await match.player1.user.save();
        }

        if (!match.player2.isBot) {
            match.player2.user.pvp.draws = (match.player2.user.pvp.draws || 0) + 1;
            match.player2.user.pvp.totalDuels = (match.player2.user.pvp.totalDuels || 0) + 1;
            match.player2.user.pvp.winStreak = 0; // 연승 초기화
            await match.player2.user.save();
        }

        // 임시 채널 10초 후 삭제
        if (match.tempChannelCreated && channel) {
            setTimeout(async () => {
                try {
                    await channel.send('📢 이 채널은 10초 후 삭제됩니다.');
                    setTimeout(async () => {
                        await channel.delete().catch(console.error);
                    }, 10000);
                } catch (error) {
                    console.error('채널 삭제 예고 실패:', error);
                }
            }, 5000);
        }

        // 매치 정리
        match.status = 'finished';
        
        // 타이머 정리
        if (match.roundTimer) {
            clearTimeout(match.roundTimer);
            match.roundTimer = null;
        }
        
        setTimeout(() => {
            console.log(`[PVP] 매치 정리 (surrender): ${match.matchId}`);
            this.activeMatches.delete(match.matchId);
        }, 20000);
    }

    // 매치 종료
    async endMatch(match) {
        // 이미 종료된 매치인지 확인
        if (match.status === 'finished' || match.status === 'ending') {
            console.log('[PVP] 이미 종료된 매치입니다:', match.matchId);
            return;
        }
        
        // 종료 중 상태로 변경하여 중복 호출 방지
        match.status = 'ending';
        
        const channel = match.pvpChannel;
        if (!channel) return;

        const winner = match.player1HP > 0 ? match.player1 : match.player2;
        const loser = match.player1HP > 0 ? match.player2 : match.player1;

        // 현재 레이팅 가져오기
        const winnerRating = winner.user.pvpRating || 1000;
        const loserRating = loser.user.pvpRating || 1000;

        // 레이팅 변경 계산
        const K = 32; // ELO K-factor
        const expectedWin = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
        const ratingChange = Math.round(K * (1 - expectedWin));

        // 랜덤 골드 보상 계산 (승자만) - 10배 증가
        const winnerGoldReward = Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000; // 1,000 ~ 1,000,000
        const loserGoldPenalty = 0; // 패자 골드 차감 제거
        
        // 패자의 실제 차감 가능 금액 계산 (미리 계산)
        const loserCurrentGold = loser.user.gold || 0;
        const actualLoserPenalty = 0; // 차감 없음

        // 승자 보상
        if (!winner.isBot) {
            const newWinnerRating = winnerRating + ratingChange;
            winner.user.pvpRating = newWinnerRating;
            winner.user.pvpWins = (winner.user.pvpWins || 0) + 1;
            winner.user.gold = (winner.user.gold || 0) + winnerGoldReward;
            
            // 골드 통계 업데이트
            winner.user.pvpTotalGoldWon = (winner.user.pvpTotalGoldWon || 0) + winnerGoldReward;
            
            // 연승 업데이트
            winner.user.pvpWinStreak = (winner.user.pvpWinStreak || 0) + 1;
            if (winner.user.pvpWinStreak > (winner.user.pvpMaxWinStreak || 0)) {
                winner.user.pvpMaxWinStreak = winner.user.pvpWinStreak;
            }
            
            // 라이프 시스템 뉴스 연동 - PVP 연승
            if (winner.user.pvpWinStreak >= 5) {
                lifeSystem.reportPVPStreak(winner.user, winner.user.pvpWinStreak);
            }
            
            // 라이프 시스템 뉴스 연동 - 역전 (낮은 레이팅이 높은 레이팅 이김)
            if (winnerRating < loserRating && (loserRating - winnerRating) >= 200) {
                // 패자가 상위 10위 이내인지 확인 (추후 랭킹 시스템 구현 시 활용)
                const loserRank = await this.getPlayerRank(loser.user.discordId);
                if (loserRank <= 10) {
                    lifeSystem.reportPVPUpset(winner.user, loser.user, loserRank);
                }
            }
            
            // 티어 업데이트
            winner.user.pvpTier = this.getTierByRating(newWinnerRating);
            
            // 매치 기록 추가
            if (!winner.user.pvp) winner.user.pvp = {};
            if (!winner.user.pvp.matchHistory) winner.user.pvp.matchHistory = [];
            winner.user.pvp.matchHistory.unshift({
                opponent: loser.user.nickname,
                opponentRating: loserRating,
                result: 'win',
                ratingChange: ratingChange,
                goldChange: winnerGoldReward,
                date: new Date()
            });
            // 최근 10경기만 유지
            if (winner.user.pvp.matchHistory.length > 10) {
                winner.user.pvp.matchHistory = winner.user.pvp.matchHistory.slice(0, 10);
            }
            
            // 활동 로그 기록 (승자)
            await ActivityLog.create({
                userId: winner.user.discordId,
                nickname: winner.user.nickname,
                activityType: 'pvp',
                details: {
                    opponent: loser.user.nickname,
                    pvpResult: 'win',
                    ratingChange: ratingChange,
                    goldChange: winnerGoldReward,
                    expGained: 0
                }
            });
            
            await winner.user.save();
            console.log(`[PVP] ${winner.user.nickname} 승리: ${winnerRating} → ${newWinnerRating} (+${ratingChange}), 골드 +${winnerGoldReward}`);
        }

        // 패자 처리 (온라인/오프라인 통합)
        if (!loser.isBot || (loser.isBot && loser.isOfflineUser)) {
            const newLoserRating = Math.max(0, loserRating - ratingChange);
            loser.user.pvpRating = newLoserRating;
            loser.user.pvpLosses = (loser.user.pvpLosses || 0) + 1;
            
            // 골드 차감 제거 - 레이팅만 변경
            // 골드는 차감하지 않음
            
            // 연승 초기화
            loser.user.pvpWinStreak = 0;
            
            // 티어 업데이트
            loser.user.pvpTier = this.getTierByRating(newLoserRating);
            
            // 매치 기록 추가
            if (!loser.user.pvp) loser.user.pvp = {};
            if (!loser.user.pvp.matchHistory) loser.user.pvp.matchHistory = [];
            loser.user.pvp.matchHistory.unshift({
                opponent: winner.user.nickname,
                opponentRating: winnerRating,
                result: 'lose',
                ratingChange: -ratingChange,
                goldChange: 0,
                date: new Date()
            });
            // 최근 10경기만 유지
            if (loser.user.pvp.matchHistory.length > 10) {
                loser.user.pvp.matchHistory = loser.user.pvp.matchHistory.slice(0, 10);
            }
            
            // 활동 로그 기록 (패자)
            await ActivityLog.create({
                userId: loser.user.discordId,
                nickname: loser.user.nickname,
                activityType: 'pvp',
                details: {
                    opponent: winner.user.nickname,
                    pvpResult: 'lose',
                    ratingChange: -ratingChange,
                    goldChange: 0,
                    expGained: 0
                }
            });
            
            await loser.user.save();
            
            if (loser.isBot && loser.isOfflineUser) {
                console.log(`[PVP] 오프라인 유저 ${loser.user.nickname} 패배: ${loserRating} → ${newLoserRating} (-${ratingChange})`);
            } else {
                console.log(`[PVP] ${loser.user.nickname} 패배: ${loserRating} → ${newLoserRating} (-${ratingChange})`);
            }
        }

        // 결과 발표 (PVP 채널)
        const endEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 PVP 결과')
            .setDescription(`**${winner.user.nickname}**님의 승리!`)
            .addFields(
                {
                    name: '🎯 레이팅 변화',
                    value: `${winner.user.nickname}: +${ratingChange}\n${loser.user.nickname}: -${ratingChange}`,
                    inline: true
                },
                {
                    name: '💰 골드 변화',
                    value: `${winner.user.nickname}: +${winnerGoldReward.toLocaleString()}G 💰\n${loser.user.nickname}: -${actualLoserPenalty.toLocaleString()}G 💸`,
                    inline: true
                }
            )
            .setFooter({ text: '수고하셨습니다!' });

        await channel.send({ embeds: [endEmbed] });
        
        // 원래 채널에도 결과 공유 (미니게임처럼)
        const originalChannel = match.originalChannel;
        if (originalChannel && originalChannel.id !== channel.id) {
            // 티어 이모지 가져오기 (업데이트된 티어 사용)
            const winnerTierEmoji = this.getTierEmoji(winner.user.pvpTier);
            const loserTierEmoji = this.getTierEmoji(loser.user.pvpTier);
            
            // 최종 레이팅 (이미 저장된 값 사용)
            const winnerFinalRating = winner.user.pvpRating;
            const loserFinalRating = loser.user.pvpRating;
            
            // HP 표시 정리
            const winnerHP = match.player1HP > 0 ? match.player1HP : match.player2HP;
            const loserHP = match.player1HP > 0 ? match.player2HP : match.player1HP;
            
            // 실제 차감된 골드 계산
            const actualLoserPenalty = !loser.isBot ? Math.min(loserGoldPenalty, (loserRating < loserFinalRating ? 0 : loserGoldPenalty)) : 0;
            
            const publicResultEmbed = new EmbedBuilder()
                .setColor('#FF4500')
                .setTitle('⚔️ PVP 대전 종료!')
                .setDescription(`**${winner.user.nickname}** ${winnerTierEmoji} VS **${loser.user.nickname}** ${loserTierEmoji}`)
                .addFields(
                    {
                        name: '🎉 승자',
                        value: `🏆 **${winner.user.nickname}**님 축하합니다! 🎊\n💪 화려한 승리였어요!`,
                        inline: false
                    },
                    {
                        name: '😭 패자',
                        value: `💀 **${loser.user.nickname}**님 아쉽네요... 😢\n🔥 다음엔 꼭 이기세요!`,
                        inline: false
                    },
                    {
                        name: '📊 최종 스코어',
                        value: `**${winner.user.nickname}**: ❤️ ${winnerHP} HP (남음)\n**${loser.user.nickname}**: 💀 0 HP (전투불능)`,
                        inline: false
                    },
                    {
                        name: '🎯 레이팅 변화',
                        value: `**${winner.user.nickname}**: ${winnerFinalRating}점 (+${ratingChange}) ⬆️\n**${loser.user.nickname}**: ${loserFinalRating}점 (-${ratingChange}) ⬇️`,
                        inline: false
                    },
                    {
                        name: '💰 골드 변화',
                        value: `🏆 **${winner.user.nickname}**: +${winnerGoldReward.toLocaleString()} 골드 💰\n💀 **${loser.user.nickname}**: -${actualLoserPenalty.toLocaleString()} 골드 💸${actualLoserPenalty < loserGoldPenalty ? ` (원래 -${loserGoldPenalty.toLocaleString()}G)` : ''}`,
                        inline: false
                    }
                )
                .setFooter({ text: '🎮 다음 대전도 기대해주세요!' })
                .setTimestamp();
                
            await originalChannel.send({ embeds: [publicResultEmbed] });
        }
        
        // 관전자 베팅 정산
        try {
            const spectatorBetting = require('../data/spectatorBetting');
            const pool = spectatorBetting.bettingPools.get(match.matchId);
            if (pool && pool.status === 'closed') {
                const winnerId = winner.user.discordId || winner.id;
                await spectatorBetting.resolveBetting('pvp', match.matchId, winnerId);
            }
        } catch (error) {
            console.error('[PVP] 베팅 정산 오류:', error);
        }

        // 게임 종료 버튼 (채널은 삭제하지 않음)
        const endButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pvp_play_again')
                    .setLabel('🔄 다시 대전')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('pvp_menu')
                    .setLabel('⚔️ PVP 메뉴')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('minigame_menu')
                    .setLabel('🎮 게임 목록')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        // 3초 후 채널 삭제 (임시 채널인 경우)
        setTimeout(async () => {
            try {
                if (match.tempChannelCreated && match.pvpChannel) {
                    await match.pvpChannel.delete().catch(console.error);
                    console.log('[PVP] 임시 채널 삭제 완료');
                }
                
                // 모든 처리가 완료된 후 상태를 finished로 변경
                match.status = 'finished';
                
                // 매치 정리
                this.activeMatches.delete(match.matchId);
            } catch (error) {
                console.error('[PVP] 채널 메시지 전송 오류:', error);
                // 오류가 발생해도 매치는 정리
                match.status = 'finished';
                this.activeMatches.delete(match.matchId);
            }
        }, 1000);
    }
    
    // 오프라인 상대 찾기
    async findOfflineOpponent(user) {
        const playerRating = user.pvpRating || 1000;
        
        try {
            // 최근 상대 목록 가져오기 (최근 3경기)
            const recentOpponents = new Set();
            const recentOpponentIds = new Set();
            
            // 최신 유저 데이터 다시 조회 (matchHistory 확실히 가져오기)
            const freshUser = await User.findOne({ discordId: user.discordId });
            
            if (freshUser.pvp?.matchHistory) {
                freshUser.pvp.matchHistory.slice(0, 3).forEach(match => {
                    if (match.opponent) {
                        recentOpponents.add(match.opponent);
                    }
                });
            }
            
            console.log(`[PVP] ${user.nickname}의 최근 상대들:`, Array.from(recentOpponents));
            
            // 먼저 전체 레이팅 순위 확인
            const higherRatedCount = await User.countDocuments({
                discordId: { $ne: user.discordId },
                pvpRating: { $gt: playerRating },
                registered: true
            });
            
            // 상위 랭커일수록 더 좁은 범위에서 매칭
            let ratingRange = 100; // 기본 범위
            if (higherRatedCount <= 10) { // 상위 10명 이내
                ratingRange = 50; // 매우 좁은 범위
            } else if (higherRatedCount <= 50) { // 상위 50명 이내
                ratingRange = 100;
            } else {
                ratingRange = 200;
            }
            
            let opponents = [];
            let searchAttempts = 0;
            
            // 범위를 점진적으로 확대하며 상대 찾기
            while (opponents.length === 0 && searchAttempts < 10) {
                const currentRange = ratingRange * Math.pow(2, searchAttempts); // 지수적으로 증가
                
                // 레이팅이 비슷한 상대 찾기 (최근 상대 제외)
                const query = {
                    discordId: { $ne: user.discordId },
                    $or: [
                        { pvpRating: { $gte: playerRating - currentRange, $lte: playerRating + currentRange } },
                        { 'pvp.rating': { $gte: playerRating - currentRange, $lte: playerRating + currentRange } }
                    ],
                    registered: true
                };
                
                // 최근 상대 제외
                if (recentOpponents.size > 0 && searchAttempts < 3) { // 처음 3번까지만 최근 상대 제외
                    query.nickname = { $nin: Array.from(recentOpponents) };
                }
                
                opponents = await User.find(query).limit(100); // 더 많은 후보 확보
                
                console.log(`[PVP] 범위 ±${currentRange}에서 ${opponents.length}명 발견 (최근 상대 ${recentOpponents.size}명 제외)`);
                
                searchAttempts++;
            }
            
            // 그래도 없으면 최근 상대 포함해서 다시 검색
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: user.discordId },
                    $or: [
                        { pvpRating: { $gte: playerRating - 1000, $lte: playerRating + 1000 } },
                        { 'pvp.rating': { $gte: playerRating - 1000, $lte: playerRating + 1000 } }
                    ],
                    registered: true
                }).limit(50);
            }
            
            // 아무도 없으면 전체에서 찾기
            if (opponents.length === 0) {
                opponents = await User.find({
                    discordId: { $ne: user.discordId },
                    registered: true
                }).limit(100); // 더 많은 후보 확보
            }
            
            if (opponents.length === 0) {
                throw new Error('매칭 가능한 상대가 없습니다');
            }
            
            // 최근 상대 다시 한번 필터링 (확실하게)
            const filteredOpponents = opponents.filter(opp => {
                const isRecent = recentOpponents.has(opp.nickname);
                if (isRecent) {
                    console.log(`[PVP] ${opp.nickname}은(는) 최근 상대이므로 제외`);
                }
                return !isRecent;
            });
            
            // 필터링 후 상대가 없으면 최근 상대 중 가장 오래된 것 선택
            let finalOpponents;
            if (filteredOpponents.length > 0) {
                finalOpponents = filteredOpponents;
            } else if (opponents.length > recentOpponents.size) {
                // 최근 상대가 아닌 사람이 더 있을 때
                console.log(`[PVP] 필터링 후 상대가 없어서 전체 목록에서 선택`);
                finalOpponents = opponents;
            } else {
                // 정말 모든 사람이 최근 상대일 때
                console.log(`[PVP] 모든 상대가 최근 상대이므로 전체에서 선택`);
                finalOpponents = opponents;
            }
            
            console.log(`[PVP] 최종 매칭 후보: ${finalOpponents.map(o => `${o.nickname}(${o.pvpRating})`).join(', ')}`);
            
            // 레이팅 기반 가중치 선택
            let selectedOpponent;
            
            // 레이팅 차이에 따른 가중치 계산
            const weights = finalOpponents.map(opp => {
                // pvpRating 또는 pvp.rating 중 존재하는 값 사용
                const oppRating = opp.pvpRating || opp.pvp?.rating || 1000;
                const ratingDiff = Math.abs(oppRating - playerRating);
                // 레이팅 차이가 작을수록 높은 가중치
                // 사람이 적으면 차이가 큰 상대도 매칭 가능
                const maxDiff = searchAttempts > 5 ? 2000 : 500; // 검색 범위가 넓어질수록 허용 범위 증가
                return Math.max(1, maxDiff - ratingDiff);
            });
            
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < finalOpponents.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                    selectedOpponent = finalOpponents[i];
                    break;
                }
            }
            
            if (!selectedOpponent) {
                selectedOpponent = finalOpponents[0];
            }
            
            const isRecentOpponent = recentOpponents.has(selectedOpponent.nickname);
            const selectedRating = selectedOpponent.pvpRating || selectedOpponent.pvp?.rating || 1000;
            console.log(`[PVP] 오프라인 매칭 완료: ${user.nickname}(${playerRating}) vs ${selectedOpponent.nickname}(${selectedRating}) - 랭킹 ${higherRatedCount + 1}위 ${isRecentOpponent ? '[최근 상대와 재매칭]' : ''}`);
            
            return selectedOpponent;
            
        } catch (error) {
            console.error('[PVP] 오프라인 상대 찾기 오류:', error);
            throw error;
        }
    }
    
    // 큐 참가
    async joinQueue(userId, user, channel) {
        await this.regenerateTickets(user);
        
        if (user.pvpTickets <= 0) {
            return {
                success: false,
                message: '🎫 PVP 티켓이 부족합니다! (5분마다 1개씩 재생성)'
            };
        }
        
        // 이미 큐에 있는지 확인
        if (this.matchmakingQueue.has(userId)) {
            return {
                success: false,
                message: '⏳ 이미 매치메이킹 중입니다!'
            };
        }
        
        // 활성 매치가 있는지 확인
        for (const [matchId, match] of this.activeMatches.entries()) {
            if (match.player1.id === userId || match.player2.id === userId) {
                return {
                    success: false,
                    message: '⚔️ 이미 진행 중인 매치가 있습니다!'
                };
            }
        }
        
        // 유저 스탯 초기화
        if (!user.pvpRating) user.pvpRating = 1000;
        if (!user.pvpTier) user.pvpTier = 'Bronze';
        if (!user.pvpWins) user.pvpWins = 0;
        if (!user.pvpLosses) user.pvpLosses = 0;
        
        // 큐에 추가
        const playerData = {
            id: userId,
            rating: user.pvpRating,
            tier: user.pvpTier,
            timestamp: Date.now(),
            user: user,
            channel: channel
        };
        
        this.matchmakingQueue.set(userId, playerData);
        
        // 매칭 시도
        const matchResult = await this.tryMatchmaking(playerData);
        
        if (matchResult.matched) {
            return {
                success: true,
                matched: true,
                message: '⚔️ 매치가 성사되었습니다!'
            };
        }
        
        // 5초 후 봇 매칭
        setTimeout(async () => {
            if (this.matchmakingQueue.has(userId)) {
                this.matchmakingQueue.delete(userId);
                await this.createBotMatch(userId);
            }
        }, 5000);
        
        return {
            success: true,
            matched: false,
            message: '🔍 상대를 찾는 중... (5초 후 봇과 매칭됩니다)'
        };
    }
    
    // 매치메이킹 시도
    async tryMatchmaking(player) {
        const opponent = this.findOpponent(player);
        
        if (opponent) {
            // 큐에서 제거
            this.matchmakingQueue.delete(player.id);
            this.matchmakingQueue.delete(opponent.id);
            
            // 매치 생성
            await this.createMatch(player, opponent);
            
            return { matched: true };
        }
        
        return { matched: false };
    }
    
    // 상대 찾기
    findOpponent(player) {
        const maxRatingDiff = 300;
        return this.findOpponentWithRange(player, maxRatingDiff);
    }
    
    // 레이팅 범위 내에서 상대 찾기
    findOpponentWithRange(player, maxRatingDiff) {
        let bestMatch = null;
        let bestDiff = maxRatingDiff + 1;
        
        for (const [opponentId, opponent] of this.matchmakingQueue.entries()) {
            if (opponentId === player.id) continue;
            
            const ratingDiff = Math.abs(player.rating - opponent.rating);
            
            if (ratingDiff <= maxRatingDiff && ratingDiff < bestDiff) {
                bestMatch = opponent;
                bestDiff = ratingDiff;
            }
        }
        
        return bestMatch;
    }
    
    // 봇과 매치 생성
    async createBotMatch(userId) {
        const user = await User.findOne({ discordId: userId });
        if (!user) return;
        
        const userRating = user.pvpRating || 1200;
        
        // 비슷한 레이팅의 봇 찾기
        let closestBot = null;
        let closestDiff = 9999;
        
        for (const [botId, bot] of this.botUsers.entries()) {
            const diff = Math.abs(userRating - bot.pvpRating);
            if (diff < closestDiff) {
                closestBot = bot;
                closestDiff = diff;
            }
        }
        
        const playerData = {
            id: userId,
            rating: userRating,
            tier: user.pvpTier || 'Silver',
            user: user,
            channel: this.matchmakingQueue.get(userId)?.channel
        };
        
        const botData = {
            id: closestBot.discordId,
            rating: closestBot.pvpRating,
            tier: closestBot.pvpTier,
            user: closestBot,
            isBot: true
        };
        
        await this.createMatch(playerData, botData);
    }
    
    // 매치 생성
    async createMatch(player1, player2) {
        const matchId = `pvp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // 플레이어 스탯 계산
        const p1Stats = this.calculateCombatStats(player1);
        const p2Stats = this.calculateCombatStats(player2);
        
        // PVP 임시 채널 생성
        let pvpChannel = null;
        const player1Name = player1.user.nickname || player1.user.username || 'Player1';
        const player2Name = player2.user.nickname || player2.user.username || 'Player2';
        
        try {
            const guild = player1.channel.guild;
            
            // PVP 카테고리 찾기 (고정 ID 사용)
            const PVP_CATEGORY_ID = '1388326369242517597';
            let pvpCategory = guild.channels.cache.get(PVP_CATEGORY_ID);
            if (!pvpCategory || pvpCategory.type !== ChannelType.GuildCategory) {
                console.log('[PVP] PVP 경기장 카테고리를 찾을 수 없습니다. ID로 다시 시도:', PVP_CATEGORY_ID);
                // ID로 다시 fetch 시도
                try {
                    pvpCategory = await guild.channels.fetch(PVP_CATEGORY_ID);
                } catch (error) {
                    console.log('[PVP] 카테고리 fetch 실패, 이름으로 검색');
                    pvpCategory = guild.channels.cache.find(c => c.name === '🔥 PVP 경기장' && c.type === ChannelType.GuildCategory);
                }
                
                if (!pvpCategory) {
                    console.log('[PVP] PVP 경기장 카테고리가 없으므로 새로 생성');
                    pvpCategory = await guild.channels.create({
                        name: '🔥 PVP 경기장',
                        type: ChannelType.GuildCategory,
                        reason: 'PVP 전용 카테고리'
                    });
                    console.log('[PVP] 새 카테고리 생성됨:', pvpCategory.id);
                }
            }
            
            // 임시 채널 생성
            pvpChannel = await guild.channels.create({
                name: `⚔️│${player1Name}-vs-${player2Name}`,
                type: ChannelType.GuildText,
                parent: pvpCategory.id,
                topic: `PVP 전투 | ${player1Name} vs ${player2Name}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: ['ViewChannel', 'ReadMessageHistory'],
                        deny: ['SendMessages']
                    },
                    {
                        id: player1.user.discordId || player1.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    ...(player2.isBot ? [] : [{
                        id: player2.user.discordId,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    }])
                ],
                reason: 'PVP 매치 임시 채널'
            });
            console.log('[PVP] PVP 전투 채널 생성됨:', pvpChannel.id);
            
            // 참가자들에게 채널 안내
            const joinEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ PVP 매치 시작!')
                .setDescription(`${pvpChannel}에서 대결이 시작됩니다!`)
                .addFields(
                    { name: '🥊 대결', value: `**${player1Name}** VS **${player2Name}**`, inline: false },
                    { name: '📍 전투 채널', value: `${pvpChannel}로 이동하세요!`, inline: false }
                )
                .setFooter({ text: '5초 후 자동으로 시작됩니다!' });
            
            // 원래 채널에 안내 메시지
            if (player1.channel) {
                await player1.channel.send({ embeds: [joinEmbed] });
            }
            if (!player2.isBot && player2.channel && player2.channel.id !== player1.channel.id) {
                await player2.channel.send({ embeds: [joinEmbed] });
            }
            
        } catch (error) {
            console.error('PVP 채널 생성 오류:', error);
            pvpChannel = player1.channel;
        }
        
        // match 객체 생성
        const match = {
            matchId: matchId,
            player1: player1,
            player2: player2,
            status: 'preparing',
            startTime: Date.now(),
            round: 0,
            battleLog: [],
            pendingActions: new Map(),
            roundTimer: null,
            roundInProgress: false,
            player1HP: p1Stats.maxHp,
            player2HP: p2Stats.maxHp,
            pvpChannel: pvpChannel,
            originalChannel: player1.channel, // 원래 채널 저장
            tempChannelCreated: pvpChannel !== player1.channel,
            bettingEnabled: false,
            bettingDelay: 0,
            // 버프/디버프 시스템
            player1Buffs: [],
            player2Buffs: [],
            // 회복 제한 시스템
            player1HealCount: 0, // 회복 사용 횟수
            player2HealCount: 0,
            player1LastHealRound: 0, // 마지막 회복 라운드
            player2LastHealRound: 0,
            // 최대 라운드 제한
            maxRounds: 30 // 30라운드 제한
        };

        this.activeMatches.set(matchId, match);
        
        // 게임 시작 메시지
        if (pvpChannel) {
            const startEmbed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('⚔️ PVP 대전 준비')
                .setDescription('곧 전투가 시작됩니다!')
                .addFields(
                    { name: '🥊 대결', value: `**${player1Name}** VS **${player2Name}**`, inline: false },
                    { name: '⏰ 시작까지', value: '10초', inline: true }
                )
                .setFooter({ text: '준비하세요!' });
            
            await pvpChannel.send({ embeds: [startEmbed] });
        }
        
        // 5초 후 시작
        setTimeout(async () => {
            await this.startPendulumBattle(match);
        }, 5000);
        
        return { 
            success: true, 
            message: '매치가 성사되었습니다!',
            matchId 
        };
    }
    
    // 펜들럼 배틀 시작
    async startPendulumBattle(match) {
        // 매치 상태 로깅
        console.log(`[PVP] 펜들럼 배틀 시작 - matchId: ${match.matchId}, 이전 상태: ${match.status}`);
        
        match.status = 'active';
        match.round = 1;
        
        // 매치가 activeMatches에 제대로 저장되어 있는지 확인
        if (!this.activeMatches.has(match.matchId)) {
            console.error(`[PVP] 경고: 매치가 activeMatches에 없음! matchId: ${match.matchId}`);
            this.activeMatches.set(match.matchId, match);
        }
        
        const channel = match.pvpChannel;
        if (!channel) {
            console.error('[PVP] 펜들럼 배틀 시작 실패 - 채널 없음');
            return;
        }

        const p1Stats = this.calculateCombatStats(match.player1);
        const p2Stats = this.calculateCombatStats(match.player2);
        const p1Name = match.player1.user.nickname || 'Player 1';
        const p2Name = match.player2.isBot ? match.player2.user.nickname : match.player2.user.nickname || 'Player 2';

        // 전투력 비교
        const powerDiff = p1Stats.combatPower - p2Stats.combatPower;
        let matchPrediction = '';
        if (Math.abs(powerDiff) < 100) {
            matchPrediction = '🎆 **백중세!** 누가 이길지 예측할 수 없습니다!';
        } else if (powerDiff > 0) {
            matchPrediction = `🔮 ${p1Name}이(가) 우세해 보입니다!`;
        } else {
            matchPrediction = `🔮 ${p2Name}이(가) 우세해 보입니다!`;
        }

        const battleEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🎆 【PVP 대전 시작!】 🎆')
            .setDescription(`🔥 **전설적인 대결이 시작됩니다!** 🔥\n${matchPrediction}`)
            .addFields(
                { 
                    name: '🥊 대전 카드', 
                    value: `┏━━━━━━━━━━━━━━━━━━┓\n` +
                           `┃ **${p1Name}** [레벨 ${p1Stats.level}]\n` +
                           `┃ ✨ 전투력: ${p1Stats.combatPower}\n` +
                           `┃ ❤️ HP: ${p1Stats.maxHp}\n` +
                           `┗━━━━━━━━━━━━━━━━━━┛\n` +
                           `　　　　**VS**\n` +
                           `┏━━━━━━━━━━━━━━━━━━┓\n` +
                           `┃ **${p2Name}** [레벨 ${p2Stats.level}]\n` +
                           `┃ ✨ 전투력: ${p2Stats.combatPower}\n` +
                           `┃ ❤️ HP: ${p2Stats.maxHp}\n` +
                           `┗━━━━━━━━━━━━━━━━━━┛`, 
                    inline: false 
                },
                {
                    name: '⚡ 전투 시스템',
                    value: '🎯 **전략적 3스킬 배틀** - 상대의 선택을 예측하라!\n\n' +
                           '• 🗡️ **강공**: 높은 피해(70~80% 명중) - 성공시 공격력↑, 실패시 방어력↓\n' +
                           '• ⚖️ **균형**: 안정적 공격(100% 명중) - 방어 무시 + 다음턴 방어↑\n' +
                           '• 💨 **회피**: 약한 공격(100% 명중) - 다음턴 회피 준비 + 반격',
                    inline: false
                },
                {
                    name: '🏆 보상',
                    value: '💰 승자: 100~100,000 골드 획득\n🎯 레이팅 포인트 변동\n🎫 결투권 소모 (1개)',
                    inline: true
                },
                {
                    name: '⏱️ 제한시간',
                    value: '각 라운드 10초',
                    inline: true
                }
            )
            .setFooter({ text: '3초 후 첫 라운드가 시작됩니다!' })
            .setTimestamp();

        await channel.send({ embeds: [battleEmbed] });

        // 카운트다운
        const countdownMsg = await channel.send('🔥 **3**...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await countdownMsg.edit('🔥 **2**...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await countdownMsg.edit('🔥 **1**...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await countdownMsg.edit('⚔️ **FIGHT!**');
        
        // 첫 라운드 시작
        setTimeout(() => this.startRound(match), 1000);
    }
    
    // 라운드 시작  
    async startRound(match) {
        // 매치 상태 체크
        if (match.status !== 'active') {
            console.log(`[PVP] 라운드 시작 취소 - 매치 상태: ${match.status}`);
            return;
        }
        
        const channel = match.pvpChannel;
        if (!channel) {
            console.log('[PVP] 라운드 시작 취소 - 채널 없음');
            return;
        }
        
        // 이미 라운드가 진행 중인지 확인
        if (match.roundInProgress) {
            console.log('[PVP] 라운드가 이미 진행 중입니다. 중복 실행 방지.');
            return;
        }
        match.roundInProgress = true;

        match.pendingActions.clear();

        const p1Stats = this.calculateCombatStats(match.player1);
        const p2Stats = this.calculateCombatStats(match.player2);
        const p1Name = match.player1.user.nickname;
        const p2Name = match.player2.isBot ? match.player2.user.nickname : match.player2.user.nickname;

        // HP 바 생성
        const createHPBar = (current, max) => {
            const percentage = Math.max(0, Math.floor((current / max) * 100));
            const filled = Math.floor(percentage / 5);
            const empty = 20 - filled;
            const bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);
            return `${bar} ${current}/${max} (${percentage}%)`;
        };

        // 전투력 표시 (법사는 마력으로 표시)
        const createPowerDisplay = (stats, playerUser) => {
            const emblemLower = playerUser.emblem?.toLowerCase() || '';
            const isMage = emblemLower.includes('마법사') || emblemLower.includes('현자') || 
                          emblemLower.includes('메이지') || emblemLower.includes('술사');
            
            const attackLabel = isMage ? '🔮 마력' : '⚔️ 공격력';
            return `${attackLabel}: ${stats.attack} | 🛡️ 방어력: ${stats.defense} | ✨ 전투력: ${stats.combatPower}`;
        };

        // 버프 표시 생성
        const createBuffDisplay = (buffs) => {
            if (!buffs || buffs.length === 0) return '';
            return '\n' + buffs.map(buff => buffSystem.getBuffDescription(buff)).join('\n');
        };

        const roundEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle(`⚔️ 【라운드 ${match.round}/${match.maxRounds}】⚔️`)
            .setDescription(`🔥 **전투가 치열해지고 있습니다!** 🔥\n\n🎯 적의 공격을 예측하고 반격하세요!`)
            .addFields(
                {
                    name: `👤 ${p1Name} [레벨 ${p1Stats.level}]`,
                    value: `${createHPBar(match.player1HP, p1Stats.maxHp)}\n${createPowerDisplay(p1Stats, match.player1.user)}${createBuffDisplay(match.player1Buffs)}`,
                    inline: false
                },
                {
                    name: 'VS',
                    value: '​',
                    inline: false
                },
                {
                    name: `👤 ${p2Name} [레벨 ${p2Stats.level}]`,
                    value: `${createHPBar(match.player2HP, p2Stats.maxHp)}\n${createPowerDisplay(p2Stats, match.player2.user)}${createBuffDisplay(match.player2Buffs)}`,
                    inline: false
                }
            )
            .setFooter({ text: '⏱️ 10초 안에 기술을 선택하세요! | 🎯 상대와 같은 기술 = 방어' })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_high`)
                    .setLabel('🗡️ 강공')
                    .setEmoji('⚔️')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_middle`)
                    .setLabel('⚖️ 균형')
                    .setEmoji('🛡️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`pvp_pendulum_${match.matchId}_low`)
                    .setLabel('💨 회피')
                    .setEmoji('🌀')
                    .setStyle(ButtonStyle.Secondary)
            );

        await channel.send({
            embeds: [roundEmbed],
            components: [buttons]
        });

        // 봇인 경우 자동 선택 (전략적 선택)
        if (match.player2.isBot) {
            setTimeout(() => {
                // 봇의 전략적 선택
                const botChoices = ['high', 'middle', 'low'];
                let botChoice;
                
                // 상대 HP가 낮으면 공격적으로
                if (match.player1HP < p1Stats.maxHp * 0.3) {
                    botChoice = Math.random() < 0.7 ? 'high' : botChoices[Math.floor(Math.random() * 3)];
                } else {
                    botChoice = botChoices[Math.floor(Math.random() * 3)];
                }
                
                match.pendingActions.set(match.player2.user.discordId, botChoice);
                this.checkRoundComplete(match);
            }, Math.random() * 3000 + 1000);
        }

        // 10초 타이머
        match.roundTimer = setTimeout(() => {
            this.forceRoundEnd(match);
        }, 10000);
    }
    
    // 전투력 계산
    calculateCombatStats(player) {
        const user = player.user;
        
        // 중앙 전투력 시스템 사용
        const totalCombatPower = calculateCombatPower(user);
        
        // 기본 스탯 (레벨 보정 추가)
        const level = user.level || 1;
        const baseStats = {
            str: (user.stats?.strength || 10) + level * 2,
            def: (user.stats?.vitality || 10) + level,
            hp: (user.stats?.vitality || 10) + level * 5,
            int: (user.stats?.intelligence || 10) + level,
            dex: (user.stats?.agility || 10) + level,
            luk: (user.stats?.luck || 10) + Math.floor(level / 2)
        };

        // 장비 스탯
        let equipmentStats = {
            str: 0,
            def: 0,
            hp: 0,
            int: 0,
            dex: 0,
            luk: 0,
            weaponDamage: 0
        };

        // 장비 효과 적용
        if (user.equipment) {
            // 무기
            const weapon = this.getEquippedItem(user, 'weapon');
            if (weapon) {
                // 무기 스탯 확인 (stats 객체 내부에 있을 수 있음)
                const weaponStats = weapon.stats || weapon;
                equipmentStats.weaponDamage = weaponStats.attack || weapon.attack || 0;
                equipmentStats.str += weaponStats.strength || weapon.strength || 0;
                equipmentStats.dex += weaponStats.agility || weapon.agility || 0;
                equipmentStats.int += weaponStats.intelligence || weapon.intelligence || 0;
                
                // 강화 보너스
                const enhanceLevel = weapon.enhancement || weapon.enhanceLevel || 0;
                if (enhanceLevel > 0) {
                    equipmentStats.weaponDamage += enhanceLevel * 3; // 5 -> 3으로 하향
                }
                
                // 무기 데미지가 비정상적으로 높은 경우 제한
                equipmentStats.weaponDamage = Math.min(equipmentStats.weaponDamage, 5000);
            }
            
            // 방어구들
            const armorTypes = ['armor', 'helmet', 'gloves', 'boots'];
            for (const type of armorTypes) {
                const item = this.getEquippedItem(user, type);
                if (item) {
                    const itemStats = item.stats || item;
                    equipmentStats.def += itemStats.defense || item.defense || 0;
                    equipmentStats.hp += itemStats.vitality || item.vitality || 0;
                    equipmentStats.str += itemStats.strength || item.strength || 0;
                    equipmentStats.dex += itemStats.agility || item.agility || 0;
                    equipmentStats.int += itemStats.intelligence || item.intelligence || 0;
                    equipmentStats.luk += itemStats.luck || item.luck || 0;
                    
                    // 강화 보너스
                    const enhanceLevel = item.enhancement || item.enhanceLevel || 0;
                    if (enhanceLevel > 0) {
                        equipmentStats.def += enhanceLevel * 2; // 3 -> 2로 하향
                    }
                }
            }
            
            // 악세서리
            const accessory = this.getEquippedItem(user, 'accessory');
            if (accessory) {
                const accStats = accessory.stats || accessory;
                equipmentStats.str += accStats.strength || accessory.strength || 0;
                equipmentStats.dex += accStats.agility || accessory.agility || 0;
                equipmentStats.int += accStats.intelligence || accessory.intelligence || 0;
                equipmentStats.luk += accStats.luck || accessory.luck || 0;
            }
        }
        
        // 장신구 효과 추가
        if (user.equippedAccessories) {
            for (const slot of Object.keys(user.equippedAccessories)) {
                const acc = user.equippedAccessories[slot];
                if (acc && acc.stats) {
                    const stats = acc.stats instanceof Map ? Object.fromEntries(acc.stats) : acc.stats;
                    equipmentStats.str += stats.strength || 0;
                    equipmentStats.dex += stats.agility || 0;
                    equipmentStats.int += stats.intelligence || 0;
                    equipmentStats.luk += stats.luck || 0;
                    equipmentStats.def += stats.defense || 0;
                    equipmentStats.hp += stats.vitality || 0;
                }
            }
        }

        // PVP 강화 보너스 (각 기술별로 적용)
        const attackEnhancement = user.pvpEnhancement || { high: 0, middle: 0, low: 0 };
        const totalEnhancement = (attackEnhancement.high || 0) + 
                                (attackEnhancement.middle || 0) + 
                                (attackEnhancement.low || 0);
        
        // 엠블럼 강화 보너스
        const emblemBonus = user.emblemEnhancement?.level || 0;
        
        // 에너지 조각 보너스
        const energyBonus = user.energyFragments?.highestLevel ? 
            Math.floor(Math.pow(user.energyFragments.highestLevel, 1.5)) : 0;
        
        // 운동 시스템 보너스
        const fitnessBonus = {
            attack: (user.fitness?.stats?.strength || 0) * 2,
            defense: (user.fitness?.stats?.stamina || 0) * 1.5,
            hp: (user.fitness?.stats?.agility || 0) * 10
        };
        
        // 최종 스탯 계산
        const totalStr = baseStats.str + equipmentStats.str;
        const totalDef = baseStats.def + equipmentStats.def;
        const totalDex = baseStats.dex + equipmentStats.dex;
        const totalLuk = baseStats.luk + equipmentStats.luk;
        const totalInt = baseStats.int + equipmentStats.int;
        
        // 전투력 기반 보정 계수 (5000 전투력 = 1.0배, 최대 1.5배)
        const powerMultiplier = Math.max(0.8, Math.min(1.5, totalCombatPower / 5000));
        
        // 직업 확인 (법사는 지능 기반 공격력)
        const emblemLower = user.emblem?.toLowerCase() || '';
        const isMage = emblemLower.includes('마법사') || emblemLower.includes('현자') || 
                       emblemLower.includes('메이지') || emblemLower.includes('술사');
        
        // 디버그 로그 추가
        if (user.emblem?.includes('전사')) {
            console.log('[PVP Debug] 전사 공격력 계산:', {
                userId: user.discordId,
                totalStr,
                weaponDamage: equipmentStats.weaponDamage,
                totalEnhancement,
                emblemBonus,
                energyBonus,
                fitnessAttack: fitnessBonus.attack,
                powerMultiplier,
                combatPower: totalCombatPower,
                rawAttack: (totalStr * 2 + equipmentStats.weaponDamage) * (1 + totalEnhancement * 0.02),
                finalFormula: `((${totalStr} * 2 + ${equipmentStats.weaponDamage}) * ${1 + totalEnhancement * 0.02} + ${emblemBonus * 3} + ${energyBonus * 0.3} + ${fitnessBonus.attack}) * ${powerMultiplier}`
            });
        }
        
        const totalStats = {
            attack: Math.floor(Math.min(20000,  // 최대 공격력 20000으로 제한
                isMage ? 
                // 법사: 지능 기반 공격력
                ((totalInt * 2 + equipmentStats.weaponDamage) * (1 + totalEnhancement * 0.02) + 
                emblemBonus * 3 + energyBonus * 0.3 + fitnessBonus.attack) * powerMultiplier :
                // 다른 직업: 힘 기반 공격력
                ((totalStr * 2 + equipmentStats.weaponDamage) * (1 + totalEnhancement * 0.02) + 
                emblemBonus * 3 + energyBonus * 0.3 + fitnessBonus.attack) * powerMultiplier
            )),
            defense: Math.floor(
                (totalDef * 1.5 + emblemBonus * 2 + fitnessBonus.defense) * powerMultiplier
            ),
            maxHp: Math.floor(
                ((baseStats.hp + equipmentStats.hp) * 15 + level * 40 + 
                emblemBonus * 15 + fitnessBonus.hp) * powerMultiplier
            ),
            critRate: Math.min(0.6, 0.05 + (totalLuk * 0.002)),
            critDamage: 1.5 + (totalLuk * 0.01),
            accuracy: Math.min(0.95, 0.7 + (totalDex * 0.003)),
            evasion: Math.min(0.4, (totalDex * 0.002)),
            blockRate: Math.min(0.3, totalDef * 0.001),
            lifesteal: Math.min(0.2, totalStr * 0.0005),
            level: level,
            combatPower: totalCombatPower // 중앙 시스템의 전투력 사용
        };

        return totalStats;
    }

    // 장비 아이템 조회
    getEquippedItem(user, equipmentType) {
        const slotIndex = user.equipment?.[equipmentType];
        
        if (slotIndex === -1 || slotIndex === null || slotIndex === undefined || 
            typeof slotIndex === 'object' || isNaN(Number(slotIndex))) {
            return null;
        }
        
        const slotNumber = Number(slotIndex);
        const item = user.inventory?.find(item => item.inventorySlot === slotNumber);
        
        if (!item || item.type !== equipmentType) {
            return null;
        }
        
        return item;
    }
    
    // 데미지 계산
    calculateDamage(attacker, defender) {
        let damage = attacker.attack - defender.defense / 2;
        damage = Math.max(1, damage); // 최소 1 데미지
        
        // 크리티컬 판정
        if (Math.random() * 100 < attacker.critRate) {
            damage *= 1.5;
        }
        
        // 약간의 랜덤성
        damage = Math.floor(damage * (0.9 + Math.random() * 0.2));
        
        return damage;
    }
    
    // 플레이어 랭킹 조회 (추후 구현)
    async getPlayerRank(discordId) {
        // TODO: 실제 랭킹 시스템 구현 시 업데이트
        // 현재는 임시로 높은 순위 반환 (뉴스 테스트용)
        return 999;
    }
    
    // 버프를 스탯에 적용
    applyBuffsToStats(baseStats, buffs) {
        const buffedStats = { ...baseStats };
        
        // 각 버프의 효과 적용
        buffs.forEach(buff => {
            switch (buff.type) {
                case 'ATTACK_UP':
                    buffedStats.attack += buff.value;
                    break;
                case 'ATTACK_DOWN':
                    buffedStats.attack = Math.max(1, buffedStats.attack - Math.abs(buff.value));
                    break;
                case 'DEFENSE_UP':
                    buffedStats.defense += buff.value;
                    break;
                case 'DEFENSE_DOWN':
                    buffedStats.defense = Math.max(0, buffedStats.defense - Math.abs(buff.value));
                    break;
                case 'SPEED_UP':
                    buffedStats.dodge += buff.value * 0.5;
                    break;
                case 'SPEED_DOWN':
                    buffedStats.dodge = Math.max(0, buffedStats.dodge - Math.abs(buff.value) * 0.5);
                    break;
                case 'CRITICAL_UP':
                    buffedStats.critRate += buff.value;
                    break;
                case 'SHIELD':
                    // 실드는 별도 처리 필요
                    buffedStats.shield = (buffedStats.shield || 0) + buff.value;
                    break;
            }
        });
        
        return buffedStats;
    }
    
    // 턴 종료 시 버프 처리
    async processEndTurnBuffs(match) {
        const effects = [];
        
        // Player 1 버프 처리
        const p1Results = buffSystem.processBuffsEndTurn({ activeBuffs: match.player1Buffs });
        // processBuffsEndTurn은 원본 배열을 직접 수정하므로 재할당 불필요
        
        p1Results.ongoingEffects?.forEach(effect => {
            if (effect.type === 'damage') {
                match.player1HP = Math.max(0, match.player1HP - effect.value);
                effects.push(`🔥 ${match.player1.user.nickname}이(가) ${effect.value}의 지속 피해를 받았습니다!`);
            } else if (effect.type === 'heal') {
                // HP가 0이 아닐 때만 회복
                if (match.player1HP > 0) {
                    const maxHp = this.calculateCombatStats(match.player1).maxHp;
                    match.player1HP = Math.min(maxHp, match.player1HP + effect.value);
                    effects.push(`💚 ${match.player1.user.nickname}이(가) ${effect.value}만큼 회복했습니다!`);
                }
            }
        });
        
        // Player 2 버프 처리
        const p2Results = buffSystem.processBuffsEndTurn({ activeBuffs: match.player2Buffs });
        // processBuffsEndTurn은 원본 배열을 직접 수정하므로 재할당 불필요
        
        p2Results.ongoingEffects?.forEach(effect => {
            if (effect.type === 'damage') {
                match.player2HP = Math.max(0, match.player2HP - effect.value);
                effects.push(`🔥 ${match.player2.user.nickname}이(가) ${effect.value}의 지속 피해를 받았습니다!`);
            } else if (effect.type === 'heal') {
                // HP가 0이 아닐 때만 회복
                if (match.player2HP > 0) {
                    const maxHp = this.calculateCombatStats(match.player2).maxHp;
                    match.player2HP = Math.min(maxHp, match.player2HP + effect.value);
                    effects.push(`💚 ${match.player2.user.nickname}이(가) ${effect.value}만큼 회복했습니다!`);
                }
            }
        });
        
        return effects;
    }
    
    // 스킬에 따른 버프 적용
    applySkillBuffs(attacker, defender, skill, isPlayer1, match) {
        const level = attacker.level || 1;
        const buffKey = isPlayer1 ? 'player1Buffs' : 'player2Buffs';
        
        // 스킬별 특수 효과
        const skillEffects = {
            'high': (hit) => {
                // 강공 - 성공/실패에 따른 버프/디버프
                if (hit) {
                    // 성공 시 다음 턴 공격력 증가
                    const attackBuff = 0.05 + (level * 0.001); // 5% → 15%
                    if (!match[buffKey]) match[buffKey] = [];
                    match[buffKey].push({
                        type: 'attackBoost',
                        value: attackBuff,
                        duration: 1,
                        name: '강공 성공'
                    });
                    return `⚔️ 공격력 +${(attackBuff * 100).toFixed(0)}%`;
                } else {
                    // 실패 시 다음 턴 받는 피해 증가
                    const defensePenalty = 0.05 + (level * 0.001); // 5% → 15%
                    if (!match[buffKey]) match[buffKey] = [];
                    match[buffKey].push({
                        type: 'defenseReduction',
                        value: defensePenalty,
                        duration: 1,
                        name: '강공 실패'
                    });
                    return `🛡️ 방어력 -${(defensePenalty * 100).toFixed(0)}%`;
                }
            },
            'middle': (hit) => {
                // 균형 - 다음 턴 방어력 증가
                const defenseBoost = 0.05 + (level * 0.001); // 5% → 15%
                if (!match[buffKey]) match[buffKey] = [];
                match[buffKey].push({
                    type: 'defenseBoost',
                    value: defenseBoost,
                    duration: 1,
                    name: '균형 방어'
                });
                return `🛡️ 방어력 +${(defenseBoost * 100).toFixed(0)}%`;
            },
            'low': (hit) => {
                // 회피 - 다음 턴 회피율 증가
                const dodgeBoost = 0.15 + (level * 0.0025); // 15% → 40%
                if (!match[buffKey]) match[buffKey] = [];
                match[buffKey].push({
                    type: 'dodgeBoost',
                    value: dodgeBoost,
                    duration: 1,
                    name: '회피 준비'
                });
                return `💨 회피율 +${(dodgeBoost * 100).toFixed(0)}%`;
            }
        };
        
        const effect = skillEffects[skill];
        if (effect) {
            // Player 1 공격의 경우 p1DamageResult가 있는지 확인
            const hit = isPlayer1 ? (match.lastP1Hit !== false) : (match.lastP2Hit !== false);
            return effect(hit);
        }
        return null;
    }
    
    // PVP 정보 조회
    async getPVPInfo(user) {
        // PVP 통계 초기화
        if (!user.pvpRating) user.pvpRating = 1000;
        if (!user.pvpTier) user.pvpTier = 'Bronze';
        if (!user.pvpWins) user.pvpWins = 0;
        if (!user.pvpLosses) user.pvpLosses = 0;
        if (!user.pvpWinStreak) user.pvpWinStreak = 0;
        if (!user.pvpMaxWinStreak) user.pvpMaxWinStreak = 0;
        if (!user.pvpTotalGoldWon) user.pvpTotalGoldWon = 0;
        if (!user.pvpTotalGoldLost) user.pvpTotalGoldLost = 0;
        
        // 승률 계산
        const totalGames = user.pvpWins + user.pvpLosses;
        const winRate = totalGames > 0 ? (user.pvpWins / totalGames * 100).toFixed(1) : 0;
        
        // 티어 정보
        const tierInfo = this.tierRanges[user.pvpTier] || this.tierRanges['Bronze'];
        const tierEmoji = this.getTierEmoji(user.pvpTier);
        
        // 다음 티어까지 필요한 점수
        let pointsToNextTier = 0;
        const tierOrder = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Master', 'Grandmaster', 'Challenger'];
        const currentTierIndex = tierOrder.indexOf(user.pvpTier);
        if (currentTierIndex < tierOrder.length - 1) {
            const nextTier = tierOrder[currentTierIndex + 1];
            pointsToNextTier = this.tierRanges[nextTier].min - user.pvpRating;
        }
        
        // 매치 기록 가져오기 (pvp 객체 내부에 있을 수 있음)
        const matchHistory = user.pvp?.matchHistory || user.pvpMatchHistory || [];
        
        return {
            rating: user.pvpRating,
            tier: user.pvpTier,
            tierEmoji: tierEmoji,
            wins: user.pvpWins,
            losses: user.pvpLosses,
            totalGames: totalGames,
            winRate: winRate,
            winStreak: user.pvpWinStreak,
            maxWinStreak: user.pvpMaxWinStreak,
            tickets: user.pvpTickets || 20,
            pointsToNextTier: pointsToNextTier,
            totalGoldWon: user.pvpTotalGoldWon || 0,
            totalGoldLost: user.pvpTotalGoldLost || 0,
            netGold: (user.pvpTotalGoldWon || 0) - (user.pvpTotalGoldLost || 0),
            matchHistory: matchHistory
        };
    }
}

const pvpSystem = new PVPSystem();

// 싱글톤 인스턴스 getter 추가
pvpSystem.getInstance = function() {
    return pvpSystem;
};

module.exports = pvpSystem;