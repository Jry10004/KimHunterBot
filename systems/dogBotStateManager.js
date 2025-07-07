const fs = require('fs').promises;
const path = require('path');

class DogBotStateManager {
    constructor() {
        this.statePath = path.join(__dirname, '../data/dogBotRescueState.json');
        this.state = this.getDefaultState(); // 기본 상태로 초기화
        this.saveInterval = null;
        this.loadState();
    }

    // 상태 로드
    async loadState() {
        try {
            const data = await fs.readFile(this.statePath, 'utf8');
            this.state = JSON.parse(data);
            console.log('[DogBot] 상태 로드 완료');
            
            // 자동 저장 설정 (30초마다)
            if (this.saveInterval) clearInterval(this.saveInterval);
            this.saveInterval = setInterval(() => this.saveState(), 30000);
        } catch (error) {
            console.error('[DogBot] 상태 로드 실패:', error);
            // 기본 상태로 초기화
            this.state = this.getDefaultState();
            await this.saveState();
        }
    }

    // 상태 저장
    async saveState() {
        try {
            await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
            console.log('[DogBot] 상태 저장 완료');
        } catch (error) {
            console.error('[DogBot] 상태 저장 실패:', error);
        }
    }

    // 기본 상태 반환
    getDefaultState() {
        return {
            status: {
                isActive: false,
                startTime: null,
                currentFloor: 1,
                totalFloors: 5,
                rescueComplete: false
            },
            floors: {
                "1": { currentHP: 120000 },
                "2": { currentHP: 180000 },
                "3": { currentHP: 240000 },
                "4": { currentHP: 300000 },
                "5": { currentHP: 360000 }
            },
            statistics: {
                totalAttacks: 0,
                totalDamage: 0,
                participants: [],
                attackLog: [],
                mvp: { userId: null, damage: 0 },
                floorMVP: {},
                userDamage: {},
                userAttackCount: {},
                lastAttackTime: {}
            },
            hostages: {
                activeHostages: {},
                hostageHistory: []
            }
        };
    }

    // 이벤트 시작
    startEvent() {
        this.state.status.isActive = true;
        this.state.status.startTime = Date.now();
        this.state.status.rescueComplete = false;
        this.saveState();
    }

    // 이벤트 종료
    endEvent() {
        this.state.status.isActive = false;
        this.state.status.rescueComplete = true;
        this.saveState();
    }

    // 데미지 기록
    recordDamage(userId, damage, floor, isCritical = false) {
        // 통계 업데이트
        this.state.statistics.totalAttacks++;
        this.state.statistics.totalDamage += damage;
        
        // 참가자 추가
        if (!this.state.statistics.participants.includes(userId)) {
            this.state.statistics.participants.push(userId);
        }
        
        // 유저별 데미지 누적
        if (!this.state.statistics.userDamage[userId]) {
            this.state.statistics.userDamage[userId] = 0;
        }
        this.state.statistics.userDamage[userId] += damage;
        
        // 유저별 공격 횟수
        if (!this.state.statistics.userAttackCount[userId]) {
            this.state.statistics.userAttackCount[userId] = 0;
        }
        this.state.statistics.userAttackCount[userId]++;
        
        // 마지막 공격 시간
        this.state.statistics.lastAttackTime[userId] = Date.now();
        
        // 공격 로그 추가 (최대 100개 유지)
        this.state.statistics.attackLog.push({
            userId,
            damage,
            floor,
            timestamp: Date.now(),
            isCritical
        });
        
        if (this.state.statistics.attackLog.length > 100) {
            this.state.statistics.attackLog.shift();
        }
        
        // MVP 확인
        if (this.state.statistics.userDamage[userId] > this.state.statistics.mvp.damage) {
            this.state.statistics.mvp = {
                userId,
                damage: this.state.statistics.userDamage[userId]
            };
        }
        
        // 층별 MVP
        const floorKey = `floor${floor}`;
        if (!this.state.statistics.floorMVP[floorKey]) {
            this.state.statistics.floorMVP[floorKey] = { userId: null, damage: 0 };
        }
        
        const floorDamage = this.state.statistics.attackLog
            .filter(log => log.floor === floor && log.userId === userId)
            .reduce((sum, log) => sum + log.damage, 0);
            
        if (floorDamage > this.state.statistics.floorMVP[floorKey].damage) {
            this.state.statistics.floorMVP[floorKey] = { userId, damage: floorDamage };
        }
        
        this.saveState();
    }

    // 층 HP 업데이트
    updateFloorHP(floor, newHP) {
        this.state.floors[floor.toString()].currentHP = newHP;
        this.saveState();
    }

    // 현재 층 진행
    advanceFloor() {
        if (this.state.status.currentFloor < this.state.status.totalFloors) {
            this.state.status.currentFloor++;
            this.saveState();
        }
    }

    // 인질 추가
    addHostage(userId) {
        this.state.hostages.activeHostages[userId] = {
            startTime: Date.now(),
            responded: false
        };
        this.saveState();
    }

    // 인질 응답
    respondHostage(userId) {
        if (this.state.hostages.activeHostages[userId]) {
            this.state.hostages.activeHostages[userId].responded = true;
            this.state.hostages.hostageHistory.push({
                userId,
                timestamp: Date.now(),
                success: true
            });
            delete this.state.hostages.activeHostages[userId];
            this.saveState();
        }
    }

    // 인질 실패
    failHostage(userId) {
        if (this.state.hostages.activeHostages[userId]) {
            this.state.hostages.hostageHistory.push({
                userId,
                timestamp: Date.now(),
                success: false
            });
            delete this.state.hostages.activeHostages[userId];
            this.saveState();
        }
    }

    // 딜 순위 가져오기
    getDamageRanking() {
        const rankings = Object.entries(this.state.statistics.userDamage)
            .map(([userId, damage]) => ({
                userId,
                damage,
                attacks: this.state.statistics.userAttackCount[userId] || 0,
                avgDamage: Math.floor(damage / (this.state.statistics.userAttackCount[userId] || 1))
            }))
            .sort((a, b) => b.damage - a.damage);
            
        return rankings;
    }

    // 상태 초기화 (관리자용)
    async resetState() {
        this.state = this.getDefaultState();
        await this.saveState();
    }
}

// 싱글톤 인스턴스
const stateManager = new DogBotStateManager();

module.exports = stateManager;