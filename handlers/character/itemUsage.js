const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');
const { formatNumber } = require('../common/utils');

// 아이템 사용 처리
async function useItem(interaction, itemIndex) {
    // Safe defer handling
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch (error) {
        if (error.code === 10062) {
            console.log('[ItemUsage] Interaction expired');
            return;
        }
        console.error('[ItemUsage] Defer error:', error);
    }
    
    const user = await User.findOne({ discordId: interaction.user.id });
    if (!user || !user.inventory || !user.inventory[itemIndex]) {
        return await interaction.followUp({
            content: '❌ 아이템을 찾을 수 없습니다.',
            flags: 64
        });
    }
    
    const item = user.inventory[itemIndex];
    
    // 소비 아이템이 아니면 사용 불가
    if (item.type !== 'consumable') {
        return await interaction.followUp({
            content: '❌ 이 아이템은 사용할 수 없습니다.',
            flags: 64
        });
    }
    
    // 아이템 효과 적용
    const result = await applyItemEffect(user, item);
    
    if (!result.success) {
        return await interaction.followUp({
            content: `❌ ${result.message}`,
            flags: 64
        });
    }
    
    // 아이템 제거
    user.inventory.splice(itemIndex, 1);
    await user.save();
    
    // 성공 메시지
    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ 아이템 사용 완료')
        .setDescription(result.message)
        .setTimestamp();
    
    await interaction.followUp({
        embeds: [embed],
        flags: 64
    });
    
    // 인벤토리 화면 갱신
    const { showInventory } = require('./inventory');
    await showInventory(interaction, user.currentCategory || 'all');
}

// 아이템 효과 적용
async function applyItemEffect(user, item) {
    const effect = item.effect;
    if (!effect) {
        return { success: false, message: '이 아이템은 효과가 없습니다.' };
    }
    
    try {
        // 스탯 초기화
        if (effect.resetStats) {
            const currentStats = user.stats || {
                strength: 10,
                agility: 10,
                intelligence: 10,
                vitality: 10,
                luck: 10
            };
            
            const totalStatPoints = 
                (currentStats.strength - 10) +
                (currentStats.agility - 10) +
                (currentStats.intelligence - 10) +
                (currentStats.vitality - 10) +
                (currentStats.luck - 10);
            
            if (totalStatPoints <= 0) {
                return { success: false, message: '초기화할 스탯이 없습니다.' };
            }
            
            // 골드 비용 확인
            const goldCost = effect.goldCost || 0;
            if (goldCost > 0 && user.gold < goldCost) {
                return { success: false, message: `골드가 부족합니다. (필요: ${formatNumber(goldCost)}G)` };
            }
            
            // 스탯 초기화
            user.stats = {
                strength: 10,
                agility: 10,
                intelligence: 10,
                vitality: 10,
                luck: 10
            };
            
            // 엠블럼 강화 스탯 재적용
            if (user.emblem && user.emblemEnhancement) {
                const { EMBLEMS } = require('../../systems/emblemShop');
                const emblemType = Object.keys(EMBLEMS).find(type => 
                    EMBLEMS[type].emblems.some(e => e.name === user.emblem)
                );
                
                if (emblemType) {
                    const { applyEmblemStats } = require('./emblem');
                    await applyEmblemStats(user, emblemType);
                }
            }
            
            // 포인트 회수 및 골드 차감
            user.statPoints = (user.statPoints || 0) + totalStatPoints;
            if (goldCost > 0) {
                user.gold -= goldCost;
            }
            
            return { 
                success: true, 
                message: `스탯이 초기화되었습니다!\n회수된 포인트: ${totalStatPoints}점${goldCost > 0 ? `\n사용 골드: ${formatNumber(goldCost)}G` : ''}` 
            };
        }
        
        // 경험치 부스터
        if (effect.expBoost) {
            user.buffs = user.buffs || {};
            user.buffs.expBoost = {
                multiplier: effect.expBoost,
                expiresAt: new Date(Date.now() + (effect.duration || 3600000))
            };
            
            const duration = effect.duration ? `${effect.duration / 60000}분` : '1시간';
            return { 
                success: true, 
                message: `경험치 ${effect.expBoost}배 버프가 ${duration} 동안 적용되었습니다!` 
            };
        }
        
        // 골드 부스터
        if (effect.goldBoost) {
            user.buffs = user.buffs || {};
            user.buffs.goldBoost = {
                multiplier: effect.goldBoost,
                expiresAt: new Date(Date.now() + (effect.duration || 3600000))
            };
            
            const duration = effect.duration ? `${effect.duration / 60000}분` : '1시간';
            return { 
                success: true, 
                message: `골드 ${effect.goldBoost}배 버프가 ${duration} 동안 적용되었습니다!` 
            };
        }
        
        // 티켓 지급
        if (effect.huntingTickets) {
            user.huntingTickets = Math.min((user.huntingTickets || 0) + effect.huntingTickets, 20);
            return { success: true, message: `사냥 티켓 ${effect.huntingTickets}장을 획득했습니다!` };
        }
        
        if (effect.dungeonTickets) {
            user.dungeonTickets = Math.min((user.dungeonTickets || 0) + effect.dungeonTickets, 5);
            return { success: true, message: `던전 티켓 ${effect.dungeonTickets}장을 획득했습니다!` };
        }
        
        if (effect.pvpTickets) {
            user.pvpTickets = Math.min((user.pvpTickets || 0) + effect.pvpTickets, 20);
            return { success: true, message: `PVP 티켓 ${effect.pvpTickets}장을 획득했습니다!` };
        }
        
        // 스탯 포인트 지급
        if (effect.statPoints) {
            user.statPoints = (user.statPoints || 0) + effect.statPoints;
            return { success: true, message: `스탯 포인트 ${effect.statPoints}점을 획득했습니다!` };
        }
        
        // 버프 아이템
        if (effect.attackBuff) {
            user.buffs = user.buffs || {};
            user.buffs.attackBuff = {
                value: effect.attackBuff,
                expiresAt: new Date(Date.now() + (effect.duration || 1800000))
            };
            
            const duration = effect.duration ? `${effect.duration / 60000}분` : '30분';
            return { 
                success: true, 
                message: `공격력이 ${effect.attackBuff} 증가했습니다! (${duration})` 
            };
        }
        
        if (effect.defenseBuff) {
            user.buffs = user.buffs || {};
            user.buffs.defenseBuff = {
                value: effect.defenseBuff,
                expiresAt: new Date(Date.now() + (effect.duration || 1800000))
            };
            
            const duration = effect.duration ? `${effect.duration / 60000}분` : '30분';
            return { 
                success: true, 
                message: `방어력이 ${effect.defenseBuff} 증가했습니다! (${duration})` 
            };
        }
        
        if (effect.allStatBuff) {
            user.buffs = user.buffs || {};
            user.buffs.allStatBuff = {
                value: effect.allStatBuff,
                expiresAt: new Date(Date.now() + (effect.duration || 3600000))
            };
            
            const duration = effect.duration ? `${effect.duration / 60000}분` : '1시간';
            return { 
                success: true, 
                message: `모든 스탯이 ${effect.allStatBuff} 증가했습니다! (${duration})` 
            };
        }
        
        // 관리자 아이템 효과
        if (effect.allStats) {
            user.stats.strength += effect.allStats;
            user.stats.agility += effect.allStats;
            user.stats.intelligence += effect.allStats;
            user.stats.vitality += effect.allStats;
            user.stats.luck += effect.allStats;
            return { success: true, message: `모든 스탯이 ${effect.allStats} 증가했습니다!` };
        }
        
        if (effect.gold) {
            user.gold += effect.gold;
            return { success: true, message: `${formatNumber(effect.gold)}G를 획득했습니다!` };
        }
        
        if (effect.instantLevel) {
            const oldLevel = user.level;
            user.level = Math.max(user.level, effect.instantLevel);
            const levelUp = user.level - oldLevel;
            
            if (levelUp > 0) {
                // 레벨업 보상 계산
                user.statPoints = (user.statPoints || 0) + (levelUp * 5);
                user.gold += levelUp * 10000;
                
                return { 
                    success: true, 
                    message: `레벨이 ${oldLevel}에서 ${user.level}로 상승했습니다!\n스탯 포인트 +${levelUp * 5}\n골드 +${formatNumber(levelUp * 10000)}G` 
                };
            } else {
                return { success: false, message: '이미 해당 레벨 이상입니다.' };
            }
        }
        
        if (effect.premiumDays) {
            user.premiumExpires = user.premiumExpires || new Date();
            if (user.premiumExpires < new Date()) {
                user.premiumExpires = new Date();
            }
            user.premiumExpires.setDate(user.premiumExpires.getDate() + effect.premiumDays);
            
            return { 
                success: true, 
                message: `프리미엄 패스가 ${effect.premiumDays}일 연장되었습니다!\n만료일: ${user.premiumExpires.toLocaleDateString('ko-KR')}` 
            };
        }
        
        // 엠블럼 강화석
        if (effect.emblemEnhance) {
            // 기존 엠블럼 강화석 시스템과 호환
            user.items = user.items || {};
            user.items.emblemEnhanceStone = (user.items.emblemEnhanceStone || 0) + effect.emblemEnhance;
            
            return { 
                success: true, 
                message: `엠블럼 강화석 ${effect.emblemEnhance}개를 획득했습니다!\n엠블럼 강화 메뉴에서 사용할 수 있습니다.` 
            };
        }
        
        // 엠블럼 축복/보호 주문서
        if (effect.emblemBless || effect.emblemProtect || effect.emblemReset) {
            return { 
                success: false, 
                message: '엠블럼 주문서는 엠블럼 강화 메뉴에서 직접 사용해주세요.' 
            };
        }
        
        // 일반 강화석/보호 주문서
        if (effect.enhance || effect.protectEnhance) {
            return { 
                success: false, 
                message: '강화석과 보호 주문서는 강화 메뉴에서 직접 사용해주세요.' 
            };
        }
        
        // 이벤트 박스
        if (effect.eventBox) {
            // 이벤트 박스는 별도 처리 필요
            return { success: false, message: '이벤트 박스는 아직 구현되지 않았습니다.' };
        }
        
        return { success: false, message: '알 수 없는 아이템 효과입니다.' };
        
    } catch (error) {
        console.error('[ItemUsage] Effect application error:', error);
        return { success: false, message: '아이템 사용 중 오류가 발생했습니다.' };
    }
}

module.exports = {
    useItem,
    applyItemEffect
};