const fs = require('fs').promises;
const path = require('path');

class QALogger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs/qa');
        this.currentLogFile = null;
        this.initializeLogger();
    }

    async initializeLogger() {
        try {
            // logs/qa 디렉토리 생성
            await fs.mkdir(this.logDir, { recursive: true });
            
            // 오늘 날짜로 로그 파일 생성
            const today = new Date().toISOString().split('T')[0];
            this.currentLogFile = path.join(this.logDir, `qa_${today}.log`);
            
            await this.writeLog('=== QA 로깅 시스템 시작 ===');
        } catch (error) {
            console.error('QA Logger 초기화 실패:', error);
        }
    }

    async writeLog(message, data = null) {
        try {
            const timestamp = new Date().toISOString();
            let logEntry = `[${timestamp}] ${message}\n`;
            
            if (data) {
                logEntry += `데이터: ${JSON.stringify(data, null, 2)}\n`;
            }
            
            logEntry += '---\n';
            
            await fs.appendFile(this.currentLogFile, logEntry, 'utf8');
        } catch (error) {
            console.error('로그 작성 실패:', error);
        }
    }

    // 에러 로깅
    async logError(feature, error, context = {}) {
        const errorData = {
            기능: feature,
            에러메시지: error.message,
            스택: error.stack,
            컨텍스트: context,
            심각도: '❌ 오류'
        };
        
        await this.writeLog(`[오류 발생] ${feature}`, errorData);
    }

    // 경고 로깅
    async logWarning(feature, message, context = {}) {
        const warningData = {
            기능: feature,
            경고: message,
            컨텍스트: context,
            심각도: '⚠️ 경고'
        };
        
        await this.writeLog(`[경고] ${feature}`, warningData);
    }

    // 기능 테스트 로깅
    async logFeatureTest(feature, testResult, details = {}) {
        const testData = {
            기능: feature,
            결과: testResult ? '✅ 성공' : '❌ 실패',
            상세내용: details,
            테스트시간: new Date().toISOString()
        };
        
        await this.writeLog(`[기능 테스트] ${feature}`, testData);
    }

    // 사용자 피드백 로깅
    async logUserFeedback(userId, feature, feedback) {
        const feedbackData = {
            사용자ID: userId,
            기능: feature,
            피드백: feedback,
            시간: new Date().toISOString()
        };
        
        await this.writeLog(`[사용자 피드백] ${feature}`, feedbackData);
    }

    // 성능 문제 로깅
    async logPerformance(feature, executionTime, threshold = 1000) {
        if (executionTime > threshold) {
            const perfData = {
                기능: feature,
                실행시간: `${executionTime}ms`,
                임계값: `${threshold}ms`,
                초과시간: `${executionTime - threshold}ms`,
                심각도: executionTime > threshold * 2 ? '❌ 심각' : '⚠️ 경고'
            };
            
            await this.writeLog(`[성능 문제] ${feature}`, perfData);
        }
    }

    // 버그 리포트 생성
    async generateBugReport(startDate = null, endDate = null) {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files.filter(f => f.startsWith('qa_') && f.endsWith('.log'));
            
            let allLogs = [];
            
            for (const file of logFiles) {
                const content = await fs.readFile(path.join(this.logDir, file), 'utf8');
                const logs = content.split('---\n').filter(log => log.trim());
                allLogs = allLogs.concat(logs);
            }
            
            // 날짜 필터링
            if (startDate || endDate) {
                allLogs = allLogs.filter(log => {
                    const match = log.match(/\[([\d-T:.]+Z)\]/);
                    if (!match) return false;
                    
                    const logDate = new Date(match[1]);
                    if (startDate && logDate < new Date(startDate)) return false;
                    if (endDate && logDate > new Date(endDate)) return false;
                    return true;
                });
            }
            
            // 카테고리별 분류
            const report = {
                오류: allLogs.filter(log => log.includes('[오류 발생]')),
                경고: allLogs.filter(log => log.includes('[경고]')),
                실패한테스트: allLogs.filter(log => log.includes('[기능 테스트]') && log.includes('❌ 실패')),
                성능문제: allLogs.filter(log => log.includes('[성능 문제]')),
                사용자피드백: allLogs.filter(log => log.includes('[사용자 피드백]'))
            };
            
            // 리포트 파일 생성
            const reportDate = new Date().toISOString().split('T')[0];
            const reportPath = path.join(this.logDir, `bug_report_${reportDate}.md`);
            
            let reportContent = '# 🐛 김헌터 버그 리포트\n\n';
            reportContent += `생성일: ${new Date().toLocaleString('ko-KR')}\n\n`;
            
            // 요약
            reportContent += '## 📊 요약\n';
            reportContent += `- 총 오류: ${report.오류.length}건\n`;
            reportContent += `- 총 경고: ${report.경고.length}건\n`;
            reportContent += `- 실패한 테스트: ${report.실패한테스트.length}건\n`;
            reportContent += `- 성능 문제: ${report.성능문제.length}건\n`;
            reportContent += `- 사용자 피드백: ${report.사용자피드백.length}건\n\n`;
            
            // 상세 내용
            for (const [category, logs] of Object.entries(report)) {
                if (logs.length > 0) {
                    reportContent += `## ${this.getCategoryEmoji(category)} ${category}\n\n`;
                    logs.forEach((log, index) => {
                        reportContent += `### ${index + 1}. ${this.extractTitle(log)}\n`;
                        reportContent += '```\n' + log + '\n```\n\n';
                    });
                }
            }
            
            await fs.writeFile(reportPath, reportContent, 'utf8');
            
            return {
                success: true,
                reportPath,
                summary: {
                    오류: report.오류.length,
                    경고: report.경고.length,
                    실패한테스트: report.실패한테스트.length,
                    성능문제: report.성능문제.length,
                    사용자피드백: report.사용자피드백.length
                }
            };
            
        } catch (error) {
            console.error('버그 리포트 생성 실패:', error);
            return { success: false, error: error.message };
        }
    }
    
    getCategoryEmoji(category) {
        const emojis = {
            오류: '❌',
            경고: '⚠️',
            실패한테스트: '🔴',
            성능문제: '🐌',
            사용자피드백: '💬'
        };
        return emojis[category] || '📌';
    }
    
    extractTitle(log) {
        const match = log.match(/\[([\d-T:.]+Z)\]\s*\[([^\]]+)\]\s*(.+)/);
        if (match) {
            return match[3].split('\n')[0];
        }
        return '제목 없음';
    }
}

// 싱글톤 인스턴스
const qaLogger = new QALogger();

module.exports = qaLogger;