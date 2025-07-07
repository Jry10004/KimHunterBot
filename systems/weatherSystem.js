// 🌤️ 날씨 시스템
const EventEmitter = require('events');

class WeatherSystem extends EventEmitter {
    constructor() {
        super();
        this.currentWeather = 'SUNNY';
        this.forecast = [];
        this.lastUpdate = new Date();
        this.updateInterval = null;
        this.season = this.getCurrentSeason();
        
        // 초기 날씨 설정
        this.updateWeather();
    }

    // 날씨 종류 정의
    WEATHER_TYPES = {
        // 기본 날씨 (70% 확률)
        SUNNY: {
            name: '맑음',
            emoji: '☀️',
            probability: 0.30,
            effects: {
                visibility: 1.0,
                moveSpeed: 1.0,
                marketActivity: 1.1     // 시장 활동 10% 증가
            },
            description: '화창한 날씨입니다. 모험하기 좋은 날이네요!'
        },
        CLOUDY: {
            name: '흐림',
            emoji: '☁️',
            probability: 0.20,
            effects: {
                visibility: 0.9,        // 시야 10% 감소
                moveSpeed: 1.0,
                stealthBonus: 1.1       // 은신 10% 보너스
            },
            description: '구름이 많은 날씨입니다.'
        },
        RAINY: {
            name: '비',
            emoji: '🌧️',
            probability: 0.15,
            effects: {
                visibility: 0.8,        // 시야 20% 감소
                moveSpeed: 0.9,         // 이동속도 10% 감소
                waterDamage: 1.2,       // 물 속성 20% 증가
                fireDamage: 0.8,        // 불 속성 20% 감소
                indoorBonus: 1.15       // 실내 활동 15% 보너스
            },
            description: '비가 내립니다. 물 속성 공격이 강해집니다!'
        },
        SNOWY: {
            name: '눈',
            emoji: '❄️',
            probability: 0.05,      // 겨울에만 증가
            effects: {
                visibility: 0.85,
                moveSpeed: 0.85,        // 이동속도 15% 감소
                iceDamage: 1.2,         // 얼음 속성 20% 증가
                fireDamage: 1.1,        // 불 속성 10% 증가
                coldResistance: 0.8     // 추위 저항 필요
            },
            description: '눈이 내립니다. 얼음 속성 공격이 강해집니다!'
        },
        
        // 특수 날씨 (30% 확률)
        MANA_STORM: {
            name: '마나 폭풍',
            emoji: '🌀',
            probability: 0.08,
            special: true,
            effects: {
                magicDamage: 1.5,       // 마법 공격 50% 증가
                mpRegen: 2.0,           // MP 회복 2배
                skillCooldown: 0.8,     // 스킬 쿨다운 20% 감소
                marketVolatility: 2.0   // 시장 변동성 2배
            },
            description: '⚡ 특수 날씨! 마나 폭풍이 몰아칩니다! 마법의 힘이 증폭됩니다!'
        },
        HEAT_WAVE: {
            name: '열파',
            emoji: '🔥',
            probability: 0.07,
            special: true,
            effects: {
                fireDamage: 1.3,        // 불 속성 30% 증가
                waterDamage: 0.7,       // 물 속성 30% 감소
                staminaDrain: 1.2,      // 스태미나 소모 20% 증가
                desertMonster: 1.5      // 사막 몬스터 50% 강화
            },
            description: '🔥 특수 날씨! 극심한 더위가 계속됩니다! 화염 속성이 강화됩니다!'
        },
        FOG: {
            name: '짙은 안개',
            emoji: '🌫️',
            probability: 0.05,
            special: true,
            effects: {
                visibility: 0.5,        // 시야 50% 감소
                stealthBonus: 1.4,      // 은신 40% 보너스
                criticalRate: 1.2,      // 치명타율 20% 증가
                ambushChance: 1.3       // 기습 확률 30% 증가
            },
            description: '🌫️ 특수 날씨! 짙은 안개가 끼었습니다. 은신과 기습에 유리합니다!'
        },
        AURORA: {
            name: '오로라',
            emoji: '🌈',
            probability: 0.03,
            special: true,
            effects: {
                luckBonus: 2.0,         // 행운 100% 증가
                rareDropRate: 1.5,      // 희귀템 드롭 50% 증가
                expBonus: 1.3,          // 경험치 30% 증가
                marketBoom: 1.5         // 시장 호황
            },
            description: '🌈 특수 날씨! 신비로운 오로라가 나타났습니다! 모든 행운이 증가합니다!'
        },
        ECLIPSE: {
            name: '일식',
            emoji: '🌑',
            probability: 0.02,
            special: true,
            effects: {
                darkDamage: 1.5,        // 암흑 속성 50% 증가
                lightDamage: 0.5,       // 빛 속성 50% 감소
                monsterPower: 1.3,      // 모든 몬스터 30% 강화
                bossSpawn: 2.0          // 보스 출현율 2배
            },
            description: '🌑 특수 날씨! 일식이 시작되었습니다! 어둠의 힘이 강해집니다!'
        }
    };

    // 계절 시스템
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 5) return 'SPRING';
        if (month >= 6 && month <= 8) return 'SUMMER';
        if (month >= 9 && month <= 11) return 'AUTUMN';
        return 'WINTER';
    }

    // 계절별 날씨 확률 조정
    getSeasonalProbabilities() {
        const probs = {};
        
        // 기본 확률 복사
        for (const [key, weather] of Object.entries(this.WEATHER_TYPES)) {
            probs[key] = weather.probability;
        }
        
        // 계절별 조정
        switch(this.season) {
            case 'SPRING':
                probs.RAINY *= 1.5;
                probs.SUNNY *= 0.9;
                break;
            case 'SUMMER':
                probs.SUNNY *= 1.3;
                probs.HEAT_WAVE *= 2.0;
                probs.SNOWY = 0;
                break;
            case 'AUTUMN':
                probs.FOG *= 2.0;
                probs.CLOUDY *= 1.2;
                break;
            case 'WINTER':
                probs.SNOWY *= 5.0;
                probs.SUNNY *= 0.7;
                probs.HEAT_WAVE = 0;
                break;
        }
        
        return probs;
    }

    // 날씨 업데이트
    updateWeather() {
        const oldWeather = this.currentWeather;
        const probs = this.getSeasonalProbabilities();
        
        // 확률 기반 날씨 선택
        const rand = Math.random();
        let cumulative = 0;
        
        for (const [key, prob] of Object.entries(probs)) {
            cumulative += prob;
            if (rand < cumulative) {
                this.currentWeather = key;
                break;
            }
        }
        
        // 날씨 변경 시 이벤트 발생
        if (oldWeather !== this.currentWeather) {
            this.emit('weatherChanged', {
                from: this.WEATHER_TYPES[oldWeather],
                to: this.WEATHER_TYPES[this.currentWeather],
                time: new Date()
            });
            
            console.log(`🌤️ 날씨 변경: ${this.WEATHER_TYPES[oldWeather].name} → ${this.WEATHER_TYPES[this.currentWeather].name}`);
        }
        
        // 예보 생성 (다음 3시간)
        this.generateForecast();
        
        this.lastUpdate = new Date();
    }

    // 날씨 예보 생성
    generateForecast() {
        this.forecast = [];
        const probs = this.getSeasonalProbabilities();
        
        for (let i = 0; i < 3; i++) {
            const rand = Math.random();
            let cumulative = 0;
            
            for (const [key, prob] of Object.entries(probs)) {
                cumulative += prob;
                if (rand < cumulative) {
                    this.forecast.push(key);
                    break;
                }
            }
        }
    }

    // 시스템 시작
    start() {
        console.log('🌤️ 날씨 시스템 시작');
        console.log(`현재 날씨: ${this.WEATHER_TYPES[this.currentWeather].emoji} ${this.WEATHER_TYPES[this.currentWeather].name}`);
        console.log(`현재 계절: ${this.season}`);
        
        // 1시간마다 날씨 업데이트
        this.updateInterval = setInterval(() => {
            this.updateWeather();
        }, 3600000); // 1시간
        
        // 테스트를 위해 5분마다 업데이트 (실제로는 1시간)
        // this.updateInterval = setInterval(() => {
        //     this.updateWeather();
        // }, 300000); // 5분
    }

    // 시스템 중지
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('🌤️ 날씨 시스템 중지');
        }
    }

    // 현재 날씨 정보 가져오기
    getCurrentWeatherInfo() {
        return this.WEATHER_TYPES[this.currentWeather];
    }

    // 특정 효과 배율 가져오기
    getEffect(effectName) {
        const weather = this.WEATHER_TYPES[this.currentWeather];
        return weather.effects[effectName] || 1.0;
    }

    // 날씨 예보 가져오기
    getForecast() {
        return this.forecast.map(weather => this.WEATHER_TYPES[weather]);
    }

    // 특수 날씨 여부 확인
    isSpecialWeather() {
        return this.WEATHER_TYPES[this.currentWeather].special || false;
    }

    // 날씨에 따른 활동 추천
    getRecommendedActivities() {
        const weather = this.WEATHER_TYPES[this.currentWeather];
        const recommendations = [];
        
        switch(this.currentWeather) {
            case 'SUNNY':
                recommendations.push('☀️ 야외 사냥 추천', '🏃 필드 보스 레이드', '🛒 시장 거래 활발');
                break;
            case 'RAINY':
                recommendations.push('🏠 실내 활동 추천', '💧 물 속성 몬스터 사냥', '🛡️ 방어구 제작');
                break;
            case 'MANA_STORM':
                recommendations.push('✨ 마법 스킬 연습', '🔮 마법 아이템 제작', '📚 스킬북 사용');
                break;
            case 'AURORA':
                recommendations.push('🎯 보스 레이드 도전', '💎 희귀템 파밍', '🎰 행운 게임 도전');
                break;
        }
        
        return recommendations;
    }

    // 날씨 강제 변경 (관리자용)
    setWeather(weatherType) {
        if (this.WEATHER_TYPES[weatherType]) {
            const oldWeather = this.currentWeather;
            this.currentWeather = weatherType;
            
            this.emit('weatherChanged', {
                from: this.WEATHER_TYPES[oldWeather],
                to: this.WEATHER_TYPES[weatherType],
                time: new Date(),
                manual: true
            });
            
            console.log(`🌤️ 날씨 수동 변경: ${weatherType}`);
            return true;
        }
        return false;
    }
}

// 싱글톤 인스턴스
const weatherSystem = new WeatherSystem();

module.exports = weatherSystem;