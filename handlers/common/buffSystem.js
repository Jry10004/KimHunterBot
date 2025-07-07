// 버프/디버프 시스템
class BuffSystem {
    constructor() {
        // 버프 타입 정의
        this.buffTypes = {
            // 스탯 증가
            ATTACK_UP: { stat: 'attack', icon: '⚔️' },
            DEFENSE_UP: { stat: 'defense', icon: '🛡️' },
            SPEED_UP: { stat: 'agility', icon: '💨' },
            CRITICAL_UP: { stat: 'critical', icon: '⚡' },
            
            // 스탯 감소
            ATTACK_DOWN: { stat: 'attack', icon: '🔻' },
            DEFENSE_DOWN: { stat: 'defense', icon: '🔻' },
            SPEED_DOWN: { stat: 'agility', icon: '🐌' },
            
            // 특수 효과
            POISON: { type: 'dot', icon: '☠️' },
            BURN: { type: 'dot', icon: '🔥' },
            FREEZE: { type: 'cc', icon: '❄️' },
            STUN: { type: 'cc', icon: '💫' },
            SHIELD: { type: 'shield', icon: '🛡️' },
            REGEN: { type: 'hot', icon: '💚' }
        };
    }

    // 버프 적용
    applyBuff(target, buffType, value, duration, source = null) {
        if (!target.activeBuffs) {
            target.activeBuffs = [];
        }

        const buff = {
            id: Date.now() + Math.random(),
            type: buffType,
            value: value,
            duration: duration,
            remainingTurns: duration,
            source: source,
            appliedAt: Date.now()
        };

        // 중복 버프 처리 (같은 타입의 버프는 더 강한 것으로 교체)
        const existingIndex = target.activeBuffs.findIndex(b => b.type === buffType);
        if (existingIndex !== -1) {
            if (target.activeBuffs[existingIndex].value < value) {
                target.activeBuffs[existingIndex] = buff;
            }
        } else {
            target.activeBuffs.push(buff);
        }

        return buff;
    }

    // 디버프 적용 (저항 계산 포함)
    applyDebuff(target, debuffType, value, duration, source = null) {
        // 디버프 저항 계산 (체력 스탯 기반)
        const resistance = (target.stats?.vitality || 10) / 200; // 최대 20% 저항
        if (Math.random() < resistance) {
            return { resisted: true };
        }

        // 디버프 수치 감소
        const reducedValue = Math.floor(value * (1 - resistance * 0.5));
        
        return this.applyBuff(target, debuffType, -reducedValue, duration, source);
    }

    // 턴 종료 시 버프 처리
    processBuffsEndTurn(target) {
        if (!target.activeBuffs) return;

        const expiredBuffs = [];
        const ongoingEffects = [];

        target.activeBuffs = target.activeBuffs.filter(buff => {
            // 지속 시간 감소
            buff.remainingTurns--;

            // 지속 효과 처리
            const buffInfo = this.buffTypes[buff.type];
            if (buffInfo) {
                switch (buffInfo.type) {
                    case 'dot': // Damage over Time
                        ongoingEffects.push({
                            type: 'damage',
                            value: buff.value,
                            source: buff.type
                        });
                        break;
                    case 'hot': // Heal over Time
                        ongoingEffects.push({
                            type: 'heal',
                            value: buff.value,
                            source: buff.type
                        });
                        break;
                }
            }

            // 만료된 버프
            if (buff.remainingTurns <= 0) {
                expiredBuffs.push(buff);
                return false;
            }
            return true;
        });

        return { expiredBuffs, ongoingEffects };
    }

    // 현재 버프/디버프로 인한 스탯 계산
    calculateBuffedStats(baseStats, activeBuffs = []) {
        const buffedStats = { ...baseStats };

        activeBuffs.forEach(buff => {
            const buffInfo = this.buffTypes[buff.type];
            if (buffInfo && buffInfo.stat) {
                if (!buffedStats[buffInfo.stat]) {
                    buffedStats[buffInfo.stat] = 0;
                }
                buffedStats[buffInfo.stat] += buff.value;
            }
        });

        // 음수 방지
        Object.keys(buffedStats).forEach(stat => {
            buffedStats[stat] = Math.max(0, buffedStats[stat]);
        });

        return buffedStats;
    }

    // 버프 제거
    removeBuff(target, buffId) {
        if (!target.activeBuffs) return false;
        
        const index = target.activeBuffs.findIndex(b => b.id === buffId);
        if (index !== -1) {
            target.activeBuffs.splice(index, 1);
            return true;
        }
        return false;
    }

    // 모든 디버프 제거 (정화)
    cleanse(target) {
        if (!target.activeBuffs) return;
        
        target.activeBuffs = target.activeBuffs.filter(buff => {
            const buffInfo = this.buffTypes[buff.type];
            // 디버프나 상태이상만 제거
            return !(buff.value < 0 || ['dot', 'cc'].includes(buffInfo?.type));
        });
    }

    // 버프 설명 생성
    getBuffDescription(buff) {
        const buffInfo = this.buffTypes[buff.type];
        if (!buffInfo) return '알 수 없는 효과';

        let description = `${buffInfo.icon} `;
        
        switch (buff.type) {
            case 'ATTACK_UP':
                description += `공격력 +${buff.value} (${buff.remainingTurns}턴)`;
                break;
            case 'DEFENSE_UP':
                description += `방어력 +${buff.value} (${buff.remainingTurns}턴)`;
                break;
            case 'POISON':
                description += `독 데미지 ${buff.value}/턴 (${buff.remainingTurns}턴)`;
                break;
            case 'BURN':
                description += `화상 데미지 ${buff.value}/턴 (${buff.remainingTurns}턴)`;
                break;
            case 'FREEZE':
                description += `동결 (${buff.remainingTurns}턴)`;
                break;
            case 'STUN':
                description += `기절 (${buff.remainingTurns}턴)`;
                break;
            case 'SHIELD':
                description += `보호막 ${buff.value} (${buff.remainingTurns}턴)`;
                break;
            case 'REGEN':
                description += `재생 ${buff.value}/턴 (${buff.remainingTurns}턴)`;
                break;
            default:
                description += `${buff.type} ${buff.value > 0 ? '+' : ''}${buff.value} (${buff.remainingTurns}턴)`;
        }

        return description;
    }

    // 상태이상 체크
    isIncapacitated(target) {
        if (!target.activeBuffs) return false;
        
        return target.activeBuffs.some(buff => {
            const buffInfo = this.buffTypes[buff.type];
            return buffInfo?.type === 'cc'; // Crowd Control
        });
    }
}

module.exports = new BuffSystem();