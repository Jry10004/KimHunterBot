// 🌟 라이프 시스템 통합 모듈
const timeSystem = require('./timeSystem');
const weatherSystem = require('./weatherSystem');
const newsSystem = require('./newsSystem');
const { updateCompanyPrice, getAllCompanies, getCompaniesBySector, getCompanyById } = require('../data/companiesData');

class LifeSystemIntegration {
    constructor() {
        this.isInitialized = false;
        this.client = null;
        this.marketUpdateInterval = null;
    }

    // 시스템 초기화
    initialize(client) {
        if (this.isInitialized) return;
        
        this.client = client;
        
        // 각 시스템 시작
        timeSystem.start();
        weatherSystem.start();
        newsSystem.start(client);
        
        // 실시간 주식 동기화 시작
        const realStockSync = require('./realStockSync');
        realStockSync.start();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 시장 업데이트 시작
        this.startMarketUpdates();
        
        this.isInitialized = true;
        console.log('🌟 라이프 시스템 통합 완료');
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 시간대 변경 이벤트
        timeSystem.on('periodChanged', (data) => {
            this.handleTimeChange(data);
        });

        // 날씨 변경 이벤트
        weatherSystem.on('weatherChanged', (data) => {
            this.handleWeatherChange(data);
        });

        // 뉴스 시장 영향 이벤트
        newsSystem.on('marketImpact', (impact) => {
            this.handleMarketImpact(impact);
        });

        // 속보 이벤트
        newsSystem.on('breakingNews', (news) => {
            this.handleBreakingNews(news);
        });
    }

    // 시간대 변경 처리
    handleTimeChange(data) {
        console.log(`⏰ 시간대 변경: ${data.from.name} → ${data.to.name}`);
        
        // 시간대에 민감한 기업들 가격 조정
        getAllCompanies().forEach(company => {
            const timeSensitivity = company.sensitivity.time;
            if (timeSensitivity) {
                // 현재 시간대 효과
                const currentEffect = timeSensitivity[timeSystem.currentPeriod] || 1.0;
                // 이전 시간대 효과
                const previousEffect = timeSensitivity[data.from.name.toUpperCase()] || 1.0;
                
                // 상대적 변화 계산
                const priceChange = (currentEffect / previousEffect - 1) * 0.1; // 10% 반영
                updateCompanyPrice(company.id, priceChange);
            }
        });

        // 시간대 변경 뉴스 (특별한 경우만)
        if (data.to.name === '새벽' && weatherSystem.isSpecialWeather()) {
            newsSystem.addNews('special_time', {
                time: data.to.name,
                weather: weatherSystem.getCurrentWeatherInfo().name,
                effect: '특수 몬스터 출현 확률 증가'
            });
        }
    }

    // 날씨 변경 처리
    handleWeatherChange(data) {
        console.log(`🌤️ 날씨 변경: ${data.from.name} → ${data.to.name}`);
        
        // 날씨에 민감한 기업들 가격 조정
        getAllCompanies().forEach(company => {
            const weatherSensitivity = company.sensitivity.weather;
            if (weatherSensitivity) {
                // 현재 날씨 효과
                const currentEffect = weatherSensitivity[weatherSystem.currentWeather] || 1.0;
                // 이전 날씨 효과
                const previousEffect = weatherSensitivity[data.from.name.toUpperCase().replace(' ', '_')] || 1.0;
                
                // 상대적 변화 계산
                const priceChange = (currentEffect / previousEffect - 1) * 0.15; // 15% 반영
                updateCompanyPrice(company.id, priceChange);
            }
        });

        // 특수 날씨 뉴스
        if (data.to.special) {
            newsSystem.addNews('special_weather', {
                weather: data.to.name,
                effect: data.to.description
            });
        }
    }

    // 뉴스 시장 영향 처리
    handleMarketImpact(impact) {
        if (impact.companies) {
            // 특정 기업 영향
            impact.companies.forEach(companyId => {
                updateCompanyPrice(companyId, impact.impact);
            });
        }
        
        if (impact.sectors) {
            // 섹터별 영향
            impact.sectors.forEach(sector => {
                getCompaniesBySector(sector).forEach(company => {
                    updateCompanyPrice(company.id, impact.impact);
                });
            });
        }
    }

    // 속보 처리
    handleBreakingNews(news) {
        // 속보에 따른 추가 효과
        console.log(`📢 속보 발생: ${news.content}`);
        
        // 방송국 주가 상승
        updateCompanyPrice('HBC', 0.05); // 헌터 방송국 5% 상승
    }

    // 주기적인 시장 업데이트
    startMarketUpdates() {
        // 5분마다 시장 업데이트
        this.marketUpdateInterval = setInterval(() => {
            this.updateMarket();
        }, 300000); // 5분

        // 즉시 한번 실행
        this.updateMarket();
    }

    // 시장 업데이트
    updateMarket() {
        const weather = weatherSystem.getCurrentWeatherInfo();
        const time = timeSystem.getCurrentPeriodInfo();
        const volatility = weather.effects.marketVolatility || 1.0;
        
        getAllCompanies().forEach(company => {
            // 기본 변동성 (±2%)
            const baseChange = (Math.random() - 0.5) * 0.04 * volatility;
            
            // 시간대 보너스
            const timeBonus = (company.sensitivity.time?.[timeSystem.currentPeriod] || 1.0) - 1;
            
            // 날씨 보너스
            const weatherBonus = (company.sensitivity.weather?.[weatherSystem.currentWeather] || 1.0) - 1;
            
            // 최종 변화율
            const totalChange = baseChange + (timeBonus * 0.1) + (weatherBonus * 0.1);
            
            updateCompanyPrice(company.id, totalChange);
        });
    }

    // 게임 이벤트 연동 함수들
    
    // 강화 성공/실패 뉴스
    reportEnhancement(user, item, level, success) {
        if (success && level >= 10) {
            newsSystem.addNews('enhancement_success', {
                player: user.nickname,
                item: item.name,
                level: level
            });
        } else if (!success && level >= 15) {
            newsSystem.addNews('enhancement_destroy', {
                player: user.nickname,
                item: item.name,
                level: level
            });
        }
    }

    // 희귀 아이템 획득 뉴스
    reportRareDrop(user, item, location, amount = 1) {
        if (item.rarity === '레전드리') {
            newsSystem.addNews('legendary_drop', {
                player: user.nickname,
                item: item.name,
                location: location
            });
        } else if (item.rarity === '에픽' && amount >= 5) {
            newsSystem.addNews('rare_material', {
                player: user.nickname,
                item: item.name,
                amount: amount
            });
        }
    }

    // 보스 처치 뉴스
    reportBossKill(user, boss, isFirst, isSolo) {
        if (isFirst) {
            newsSystem.addNews('boss_first_kill', {
                player: user.nickname,
                boss: boss.name
            });
        } else if (isSolo) {
            newsSystem.addNews('boss_solo_kill', {
                player: user.nickname,
                boss: boss.name
            });
        }
    }

    // 대규모 거래 뉴스
    reportTransaction(user, amount, item = null) {
        if (amount >= 10000000) {
            newsSystem.addNews('huge_transaction', {
                player: user.nickname,
                amount: formatNumber(amount)
            });
        }
    }

    // PVP 연승 뉴스
    reportPVPStreak(winner, streak) {
        if (streak >= 5) {
            newsSystem.addNews('pvp_streak', {
                player: winner.nickname,
                streak: streak
            });
        }
    }

    // PVP 역전 뉴스
    reportPVPUpset(winner, loser, loserRank) {
        if (loserRank <= 10) {
            newsSystem.addNews('pvp_upset', {
                winner: winner.nickname,
                loser: loser.nickname,
                rank: loserRank
            });
        }
    }

    // 길드 레벨업 뉴스
    reportGuildLevelUp(guild, level) {
        if (level % 10 === 0 || level >= 50) {
            newsSystem.addNews('guild_level_up', {
                guild: guild.name,
                level: level
            });
        }
    }

    // 던전 신기록 뉴스
    reportDungeonRecord(user, dungeon, time) {
        newsSystem.addNews('speed_record', {
            player: user.nickname,
            dungeon: dungeon.name,
            time: time
        });
    }

    // 레벨 신기록 뉴스
    reportLevelRecord(user, level) {
        if (level % 50 === 0 || level >= 100) {
            newsSystem.addNews('level_record', {
                player: user.nickname,
                level: level
            });
        }
    }

    // 시장 조작 뉴스
    reportMarketManipulation(user, item, changePercent) {
        if (Math.abs(changePercent) >= 30) {
            newsSystem.addNews('market_manipulation', {
                player: user.nickname,
                item: item,
                change: changePercent.toFixed(1)
            });
        }
    }

    // 뉴스 채널 설정
    setNewsChannel(channelId) {
        newsSystem.addNewsChannel(channelId);
    }

    // 시스템 종료
    shutdown() {
        if (this.marketUpdateInterval) {
            clearInterval(this.marketUpdateInterval);
        }
        
        timeSystem.stop();
        weatherSystem.stop();
        newsSystem.stop();
        
        const realStockSync = require('./realStockSync');
        realStockSync.stop();
        
        console.log('🌟 라이프 시스템 종료');
    }
}

// 싱글톤 인스턴스
const lifeSystem = new LifeSystemIntegration();

// 숫자 포맷팅 헬퍼
function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + '억';
    if (num >= 10000) return (num / 10000).toFixed(1) + '만';
    return num.toLocaleString();
}

module.exports = lifeSystem;