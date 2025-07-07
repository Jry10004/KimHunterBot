// 🕐 시간대 시스템
const EventEmitter = require('events');

class TimeSystem extends EventEmitter {
    constructor() {
        super();
        this.currentPeriod = this.getCurrentPeriod();
        this.lastCheck = new Date();
        this.checkInterval = null;
    }

    // 시간대 정의
    TIME_PERIODS = {
        DAWN: {
            name: '새벽',
            emoji: '🌙',
            hours: [0, 1, 2, 3, 4, 5],
            effects: {
                monsterPower: 1.2,      // 몬스터 20% 강화
                rareDropRate: 1.1,      // 희귀템 10% 증가
                expRate: 0.8,           // 경험치 20% 감소
                marketVolatility: 1.5   // 시장 변동성 50% 증가
            },
            description: '조용하고 위험한 시간... 강력한 야행성 몬스터들이 활동합니다.'
        },
        MORNING: {
            name: '아침',
            emoji: '🌅',
            hours: [6, 7, 8, 9, 10, 11],
            effects: {
                monsterPower: 1.0,
                rareDropRate: 1.0,
                expRate: 1.15,          // 경험치 15% 증가
                energyRecovery: 1.2,    // 활력 회복 20% 증가
                marketActivity: 1.3     // 시장 활동 30% 증가
            },
            description: '상쾌한 아침! 모험을 시작하기 좋은 시간입니다.'
        },
        AFTERNOON: {
            name: '오후',
            emoji: '☀️',
            hours: [12, 13, 14, 15, 16, 17],
            effects: {
                monsterPower: 1.0,
                rareDropRate: 1.0,
                craftingSuccess: 1.05,  // 제작 성공률 5% 증가
                tradeFeeDiscount: 0.9,  // 거래 수수료 10% 할인
                shopPrices: 0.95        // 상점 가격 5% 할인
            },
            description: '활발한 오후 시간대! 거래와 제작에 보너스가 있습니다.'
        },
        EVENING: {
            name: '저녁',
            emoji: '🌆',
            hours: [18, 19, 20, 21, 22, 23],
            effects: {
                monsterPower: 1.1,      // 몬스터 10% 강화
                goldRate: 1.1,          // 골드 획득 10% 증가
                pvpReward: 1.2,         // PVP 보상 20% 증가
                dungeonReward: 1.15     // 던전 보상 15% 증가
            },
            description: '노을이 지는 저녁... 전투의 보상이 증가합니다!'
        }
    };

    // 현재 시간대 확인
    getCurrentPeriod() {
        const hour = new Date().getHours();
        
        for (const [key, period] of Object.entries(this.TIME_PERIODS)) {
            if (period.hours.includes(hour)) {
                return key;
            }
        }
        
        return 'MORNING'; // 기본값
    }

    // 시간대 변경 체크
    checkTimeChange() {
        const newPeriod = this.getCurrentPeriod();
        
        if (newPeriod !== this.currentPeriod) {
            const oldPeriod = this.currentPeriod;
            this.currentPeriod = newPeriod;
            
            // 시간대 변경 이벤트 발생
            this.emit('periodChanged', {
                from: this.TIME_PERIODS[oldPeriod],
                to: this.TIME_PERIODS[newPeriod],
                time: new Date()
            });
            
            console.log(`⏰ 시간대 변경: ${this.TIME_PERIODS[oldPeriod].name} → ${this.TIME_PERIODS[newPeriod].name}`);
        }
    }

    // 시스템 시작
    start() {
        console.log('🕐 시간대 시스템 시작');
        console.log(`현재 시간대: ${this.TIME_PERIODS[this.currentPeriod].emoji} ${this.TIME_PERIODS[this.currentPeriod].name}`);
        
        // 1분마다 시간대 체크
        this.checkInterval = setInterval(() => {
            this.checkTimeChange();
        }, 60000);
        
        // 즉시 한번 체크
        this.checkTimeChange();
    }

    // 시스템 중지
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('🕐 시간대 시스템 중지');
        }
    }

    // 현재 시간대 정보 가져오기
    getCurrentPeriodInfo() {
        return this.TIME_PERIODS[this.currentPeriod];
    }

    // 특정 효과 배율 가져오기
    getEffect(effectName) {
        const period = this.TIME_PERIODS[this.currentPeriod];
        return period.effects[effectName] || 1.0;
    }

    // 다음 시간대 예고
    getNextPeriod() {
        const currentHour = new Date().getHours();
        const nextHour = (currentHour + 1) % 24;
        
        for (const [key, period] of Object.entries(this.TIME_PERIODS)) {
            if (period.hours.includes(nextHour) && key !== this.currentPeriod) {
                return {
                    period: period,
                    hoursUntil: period.hours[0] - currentHour
                };
            }
        }
        
        return null;
    }

    // 시간대별 활동 추천
    getRecommendedActivities() {
        const period = this.TIME_PERIODS[this.currentPeriod];
        const recommendations = [];
        
        switch(this.currentPeriod) {
            case 'DAWN':
                recommendations.push(
                    '🌙 희귀 몬스터 사냥 (드롭률 증가)',
                    '💎 특수 던전 탐험',
                    '🦇 야행성 보스 레이드'
                );
                break;
            case 'MORNING':
                recommendations.push(
                    '📚 경험치 파밍 (경험치 보너스)',
                    '🏃 일일 퀘스트 수행',
                    '💪 운동으로 스탯 상승'
                );
                break;
            case 'AFTERNOON':
                recommendations.push(
                    '🛠️ 아이템 제작 (성공률 보너스)',
                    '💰 거래소 이용 (수수료 할인)',
                    '🛒 상점 쇼핑 (가격 할인)'
                );
                break;
            case 'EVENING':
                recommendations.push(
                    '⚔️ PVP 대전 (보상 증가)',
                    '🏰 던전 공략 (보상 증가)',
                    '💰 골드 파밍 (획득량 증가)'
                );
                break;
        }
        
        return recommendations;
    }
}

// 싱글톤 인스턴스
const timeSystem = new TimeSystem();

module.exports = timeSystem;