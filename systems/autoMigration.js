// 자동 마이그레이션 시스템
const cron = require('node-cron');
const { spawn } = require('child_process');
const { EmbedBuilder } = require('discord.js');

class AutoMigrationSystem {
    constructor() {
        this.client = null;
        this.logChannelId = '1387550842554421378'; // 로그를 보낼 채널 ID
        this.cronJob = null;
        this.isRunning = false;
    }

    // 시스템 초기화
    initialize(client) {
        this.client = client;
        console.log('[AutoMigration] 자동 마이그레이션 시스템 초기화');
        
        // 매일 새벽 4시에 실행 (서버 부하가 적은 시간)
        this.cronJob = cron.schedule('0 4 * * *', () => {
            this.runMigration();
        }, {
            scheduled: true,
            timezone: "Asia/Seoul"
        });

        // 봇 시작 후 5분 뒤에 한 번 실행 (테스트 및 즉시 적용)
        setTimeout(() => {
            console.log('[AutoMigration] 초기 마이그레이션 실행');
            this.runMigration();
        }, 5 * 60 * 1000); // 5분

        console.log('[AutoMigration] 자동 마이그레이션 스케줄 등록 (매일 오전 4시)');
    }

    // 마이그레이션 실행
    async runMigration() {
        if (this.isRunning) {
            console.log('[AutoMigration] 이미 마이그레이션이 진행 중입니다.');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            console.log('[AutoMigration] baseStats 마이그레이션 시작');
            
            // 마이그레이션 스크립트 실행
            const migrationProcess = spawn('node', ['scripts/migrateBaseStats.js']);
            
            let output = '';
            let errorOutput = '';
            
            // 출력 수집
            migrationProcess.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            migrationProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            // 프로세스 종료 시
            migrationProcess.on('close', async (code) => {
                const endTime = Date.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);
                
                if (code === 0) {
                    // 성공
                    console.log('[AutoMigration] 마이그레이션 성공');
                    await this.sendLog(true, output, duration);
                } else {
                    // 실패
                    console.error('[AutoMigration] 마이그레이션 실패:', errorOutput);
                    await this.sendLog(false, errorOutput || output, duration);
                }
                
                this.isRunning = false;
            });
            
            // 타임아웃 (5분)
            setTimeout(() => {
                if (this.isRunning) {
                    migrationProcess.kill();
                    console.error('[AutoMigration] 마이그레이션 타임아웃');
                    this.sendLog(false, '마이그레이션이 시간 초과되었습니다.', 300);
                    this.isRunning = false;
                }
            }, 5 * 60 * 1000);
            
        } catch (error) {
            console.error('[AutoMigration] 마이그레이션 실행 오류:', error);
            await this.sendLog(false, error.message, 0);
            this.isRunning = false;
        }
    }

    // 로그 전송
    async sendLog(success, message, duration) {
        try {
            const logChannel = this.client.channels.cache.get(this.logChannelId);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setTitle(success ? '✅ 자동 마이그레이션 완료' : '❌ 자동 마이그레이션 실패')
                .setColor(success ? '#00FF00' : '#FF0000')
                .setDescription('baseStats 마이그레이션 자동 실행 결과')
                .setTimestamp();

            // 결과 파싱
            if (success && message.includes('마이그레이션 완료!')) {
                const lines = message.split('\n');
                const userLine = lines.find(line => line.includes('명의 유저 데이터 수정'));
                const itemLine = lines.find(line => line.includes('개의 아이템에 baseStats 추가'));
                
                embed.addFields(
                    { name: '⏱️ 소요 시간', value: `${duration}초`, inline: true },
                    { name: '👥 수정된 유저', value: userLine || '0명', inline: true },
                    { name: '📦 수정된 아이템', value: itemLine || '0개', inline: true }
                );
            } else {
                embed.addFields(
                    { name: '❌ 오류 내용', value: `\`\`\`${message.slice(0, 1000)}\`\`\``, inline: false }
                );
            }

            embed.setFooter({ text: '다음 실행: 매일 오전 4시' });

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[AutoMigration] 로그 전송 오류:', error);
        }
    }

    // 수동 실행 (관리자 명령용)
    async manualRun() {
        if (this.isRunning) {
            return { success: false, message: '이미 마이그레이션이 진행 중입니다.' };
        }
        
        console.log('[AutoMigration] 수동 마이그레이션 실행');
        await this.runMigration();
        return { success: true, message: '마이그레이션을 시작했습니다. 완료 시 로그 채널에 결과가 전송됩니다.' };
    }

    // 시스템 종료
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('[AutoMigration] 자동 마이그레이션 스케줄 중지');
        }
    }
}

// 싱글톤 인스턴스
const autoMigrationSystem = new AutoMigrationSystem();

module.exports = autoMigrationSystem;