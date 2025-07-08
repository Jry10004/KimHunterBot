const fs = require('fs').promises;
const path = require('path');
const { DATA_FILES, initializeTestDataFolder } = require('../config/dataFiles');

class DogBotStateManager {
    constructor() {
        // 환경별 데이터 파일 경로 사용
        this.statePath = DATA_FILES.DOGBOT_RESCUE_STATE();
        this.state = this.getDefaultState(); // 기본 상태로 초기화
        this.saveInterval = null;
        this.isLoaded = false; // 로드 완료 플래그 추가
        
        // 동기적으로 초기 로드 시도
        this.initializeState();
    }

    // 동기적 초기 상태 로드
    initializeState() {
        const fsSync = require('fs');
        try {
            if (fsSync.existsSync(this.statePath)) {
                const data = fsSync.readFileSync(this.statePath, 'utf8');
                const loadedState = JSON.parse(data);
                
                // 로드된 상태가 유효한지 확인
                if (loadedState && loadedState.status && loadedState.statistics) {
                    // 기본 구조 먼저 생성
                    this.state = this.getDefaultState();
                    
                    // 로드된 데이터를 안전하게 병합
                    this.state.status = { ...this.state.status, ...loadedState.status };
                    this.state.floors = { ...this.state.floors, ...loadedState.floors };
                    
                    // statistics는 더 신중하게 병합
                    if (loadedState.statistics) {
                        this.state.statistics = {
                            ...this.state.statistics,
                            ...loadedState.statistics,
                            // 객체 타입 필드는 개별적으로 병합
                            userDamage: { ...(loadedState.statistics.userDamage || {}) },
                            userAttackCount: { ...(loadedState.statistics.userAttackCount || {}) },
                            lastAttackTime: { ...(loadedState.statistics.lastAttackTime || {}) },
                            floorMVP: { ...(loadedState.statistics.floorMVP || {}) }
                        };
                        
                        // 배열은 직접 할당
                        if (loadedState.statistics.participants) {
                            this.state.statistics.participants = [...loadedState.statistics.participants];
                        }
                        if (loadedState.statistics.attackLog) {
                            this.state.statistics.attackLog = [...loadedState.statistics.attackLog];
                        }
                    }
                    
                    if (loadedState.hostages) {
                        this.state.hostages = {
                            ...this.state.hostages,
                            ...loadedState.hostages
                        };
                    }
                    
                    console.log('[DogBot] 초기 상태 로드 완료');
                    console.log('[DogBot] 이벤트 활성화:', this.state.status.isActive);
                    console.log('[DogBot] 현재 층:', this.state.status.currentFloor);
                    console.log('[DogBot] 총 공격:', this.state.statistics.totalAttacks);
                    console.log('[DogBot] 총 데미지:', this.state.statistics.totalDamage);
                    console.log('[DogBot] 공격 횟수 데이터:', this.state.statistics.userAttackCount);
                    
                    // 데이터 무결성 검사
                    this.validateAndRepairData();
                    
                    this.isLoaded = true;
                } else {
                    console.log('[DogBot] 상태 파일이 손상됨, 백업에서 복원 시도');
                    this.tryRestoreFromBackup();
                }
            } else {
                console.log('[DogBot] 상태 파일이 없음, 백업에서 복원 시도');
                this.tryRestoreFromBackup();
            }
            
            // 자동 저장 설정 (30초마다)
            if (this.saveInterval) clearInterval(this.saveInterval);
            this.saveInterval = setInterval(() => this.saveState(), 30000);
        } catch (error) {
            console.error('[DogBot] 초기 상태 로드 실패:', error);
            this.tryRestoreFromBackup();
        }
    }
    
    // 백업에서 복원 시도
    tryRestoreFromBackup() {
        try {
            const dogBotAutoBackup = require('./dogBotAutoBackup');
            const fsSync = require('fs');
            const path = require('path');
            
            // 백업 디렉토리에서 최신 백업 찾기
            const backupDir = path.join(__dirname, '../backups/dogbot');
            if (fsSync.existsSync(backupDir)) {
                const files = fsSync.readdirSync(backupDir);
                const backupFiles = files
                    .filter(f => f.startsWith('dogbot_') && f.endsWith('.json'))
                    .sort()
                    .reverse();
                
                if (backupFiles.length > 0) {
                    const latestBackup = backupFiles[0];
                    const backupData = fsSync.readFileSync(path.join(backupDir, latestBackup), 'utf8');
                    const backupState = JSON.parse(backupData);
                    
                    if (backupState && backupState.status && backupState.statistics) {
                        // 기본 구조 먼저 생성
                        this.state = this.getDefaultState();
                        
                        // 백업 데이터를 안전하게 병합
                        this.state.status = { ...this.state.status, ...backupState.status };
                        this.state.floors = { ...this.state.floors, ...backupState.floors };
                        
                        // statistics는 더 신중하게 병합
                        if (backupState.statistics) {
                            this.state.statistics = {
                                ...this.state.statistics,
                                ...backupState.statistics,
                                // 객체 타입 필드는 개별적으로 병합
                                userDamage: { ...backupState.statistics.userDamage },
                                userAttackCount: { ...backupState.statistics.userAttackCount },
                                lastAttackTime: { ...backupState.statistics.lastAttackTime },
                                floorMVP: { ...backupState.statistics.floorMVP }
                            };
                            
                            // 배열은 직접 할당
                            if (backupState.statistics.participants) {
                                this.state.statistics.participants = [...backupState.statistics.participants];
                            }
                            if (backupState.statistics.attackLog) {
                                this.state.statistics.attackLog = [...backupState.statistics.attackLog];
                            }
                        }
                        
                        if (backupState.hostages) {
                            this.state.hostages = {
                                ...this.state.hostages,
                                ...backupState.hostages
                            };
                        }
                        
                        // 백업 데이터를 현재 상태 파일에 저장
                        fsSync.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
                        console.log('[DogBot] 백업에서 복원 성공:', latestBackup);
                        console.log('[DogBot] 이벤트 활성화:', this.state.status.isActive);
                        console.log('[DogBot] 현재 층:', this.state.status.currentFloor);
                        console.log('[DogBot] 총 공격:', this.state.statistics.totalAttacks);
                        console.log('[DogBot] 공격 횟수 데이터:', Object.keys(this.state.statistics.userAttackCount).length);
                        
                        // 데이터 무결성 검사
                        this.validateAndRepairData();
                        
                        return;
                    }
                }
            }
            
            // 백업도 없으면 기본값 사용
            console.log('[DogBot] 백업 파일도 없음, 기본값 사용');
            this.state = this.getDefaultState();
            fsSync.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('[DogBot] 백업 복원 실패:', error);
            this.state = this.getDefaultState();
        }
    }

    // 비동기 상태 로드 (나중에 사용)
    async loadState() {
        try {
            const data = await fs.readFile(this.statePath, 'utf8');
            this.state = JSON.parse(data);
            console.log('[DogBot] 상태 로드 완료');
            this.isLoaded = true;
            
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
        console.log(`[DogBot] recordDamage 호출 - userId: ${userId}, damage: ${damage}, floor: ${floor}`);
        console.log(`[DogBot] 현재 userAttackCount:`, this.state.statistics.userAttackCount);
        
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
            console.log(`[DogBot] 새로운 유저 ${userId}의 공격 횟수 초기화`);
            this.state.statistics.userAttackCount[userId] = 0;
        }
        const previousCount = this.state.statistics.userAttackCount[userId];
        this.state.statistics.userAttackCount[userId]++;
        console.log(`[DogBot] ${userId}의 공격 횟수: ${previousCount} -> ${this.state.statistics.userAttackCount[userId]}`);
        
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

    // 상태 초기화 (관리자용) - 수정: 기존 데이터 유지
    async resetState(preserveData = true) {
        if (preserveData && this.state.statistics.totalAttacks > 0) {
            // 이벤트 상태만 재활성화하고 기존 데이터는 유지
            console.log('[DogBot] 이벤트 재시작 - 기존 데이터 유지');
            this.state.status.isActive = true;
            this.state.status.startTime = this.state.status.startTime || Date.now();
            this.state.status.rescueComplete = false;
        } else {
            // 완전 초기화
            console.log('[DogBot] 이벤트 완전 초기화');
            this.state = this.getDefaultState();
        }
        await this.saveState();
    }
    
    // 데이터 강제 리로드
    async forceReloadData() {
        console.log('[DogBot] 데이터 강제 리로드 시작');
        try {
            // 현재 save interval 정리
            if (this.saveInterval) {
                clearInterval(this.saveInterval);
                this.saveInterval = null;
            }
            
            // 파일에서 직접 읽기
            const fsSync = require('fs');
            if (fsSync.existsSync(this.statePath)) {
                const data = fsSync.readFileSync(this.statePath, 'utf8');
                const reloadedState = JSON.parse(data);
                
                // 완전히 새로운 state로 교체
                this.state = reloadedState;
                
                console.log('[DogBot] 리로드 완료 - 데이터 확인:');
                console.log('  - 총 공격:', this.state.statistics.totalAttacks);
                console.log('  - 총 데미지:', this.state.statistics.totalDamage);
                console.log('  - userDamage:', this.state.statistics.userDamage);
                console.log('  - userAttackCount:', this.state.statistics.userAttackCount);
                
                // 자동 저장 재설정
                this.saveInterval = setInterval(() => this.saveState(), 30000);
                
                return true;
            }
        } catch (error) {
            console.error('[DogBot] 데이터 리로드 실패:', error);
        }
        return false;
    }
    
    // 데이터 무결성 검사 및 복구
    validateAndRepairData() {
        console.log('[DogBot] 데이터 무결성 검사 시작');
        
        // userDamage에 있는 모든 유저가 userAttackCount에도 있는지 확인
        for (const userId of Object.keys(this.state.statistics.userDamage)) {
            if (!this.state.statistics.userAttackCount[userId]) {
                console.log(`[DogBot] ${userId}의 공격 횟수 데이터 누락 발견`);
                // attackLog에서 실제 공격 횟수 계산
                const actualAttacks = this.state.statistics.attackLog.filter(log => log.userId === userId).length;
                this.state.statistics.userAttackCount[userId] = actualAttacks || 1;
                console.log(`[DogBot] ${userId}의 공격 횟수를 ${actualAttacks || 1}로 복구`);
            }
        }
        
        // participants 배열과 userDamage 동기화
        for (const userId of Object.keys(this.state.statistics.userDamage)) {
            if (!this.state.statistics.participants.includes(userId)) {
                this.state.statistics.participants.push(userId);
                console.log(`[DogBot] ${userId}를 participants에 추가`);
            }
        }
        
        this.saveState();
        console.log('[DogBot] 데이터 무결성 검사 완료');
    }
    
    // 중복 유저 데이터 병합 (관리자용)
    async mergeUserData(oldUserId, newUserId) {
        console.log(`[DogBot] 유저 데이터 병합: ${oldUserId} -> ${newUserId}`);
        
        // 데미지 병합
        if (this.state.statistics.userDamage[oldUserId]) {
            this.state.statistics.userDamage[newUserId] = 
                (this.state.statistics.userDamage[newUserId] || 0) + 
                this.state.statistics.userDamage[oldUserId];
            delete this.state.statistics.userDamage[oldUserId];
        }
        
        // 공격 횟수 병합
        if (this.state.statistics.userAttackCount[oldUserId]) {
            this.state.statistics.userAttackCount[newUserId] = 
                (this.state.statistics.userAttackCount[newUserId] || 0) + 
                this.state.statistics.userAttackCount[oldUserId];
            delete this.state.statistics.userAttackCount[oldUserId];
        }
        
        // 마지막 공격 시간 업데이트
        if (this.state.statistics.lastAttackTime[oldUserId]) {
            const oldTime = this.state.statistics.lastAttackTime[oldUserId];
            const newTime = this.state.statistics.lastAttackTime[newUserId] || 0;
            this.state.statistics.lastAttackTime[newUserId] = Math.max(oldTime, newTime);
            delete this.state.statistics.lastAttackTime[oldUserId];
        }
        
        // participants 배열 정리
        this.state.statistics.participants = this.state.statistics.participants.filter(id => id !== oldUserId);
        if (!this.state.statistics.participants.includes(newUserId) && this.state.statistics.userDamage[newUserId]) {
            this.state.statistics.participants.push(newUserId);
        }
        
        // attackLog의 userId 변경
        this.state.statistics.attackLog.forEach(log => {
            if (log.userId === oldUserId) {
                log.userId = newUserId;
            }
        });
        
        // 층별 MVP 업데이트
        for (const [floor, mvp] of Object.entries(this.state.statistics.floorMVP)) {
            if (mvp.userId === oldUserId) {
                mvp.userId = newUserId;
            }
        }
        
        // 전체 MVP 업데이트
        if (this.state.statistics.mvp.userId === oldUserId) {
            this.state.statistics.mvp.userId = newUserId;
        }
        
        await this.saveState();
        console.log(`[DogBot] 데이터 병합 완료`);
        console.log(`  - ${newUserId}의 총 데미지: ${this.state.statistics.userDamage[newUserId]}`);
        console.log(`  - ${newUserId}의 총 공격 횟수: ${this.state.statistics.userAttackCount[newUserId]}`);
    }
}

// 싱글톤 인스턴스
const stateManager = new DogBotStateManager();

// 프로세스 종료 시 상태 저장
process.on('SIGINT', async () => {
    console.log('[DogBot] 프로세스 종료, 상태 저장 중...');
    await stateManager.saveState();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[DogBot] 프로세스 종료, 상태 저장 중...');
    await stateManager.saveState();
    process.exit(0);
});

module.exports = stateManager;