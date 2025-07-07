const fs = require('fs');
const path = require('path');

// 카테고리별 명령어 로더
class CommandLoader {
    constructor() {
        this.commands = new Map();
        this.categories = ['game', 'admin', 'economy', 'utility', 'test'];
    }

    // 모든 명령어 로드
    loadAllCommands() {
        console.log('📂 명령어 로딩 시작...');
        
        for (const category of this.categories) {
            this.loadCategoryCommands(category);
        }
        
        console.log(`✅ 총 ${this.commands.size}개의 명령어 로드 완료`);
        return this.commands;
    }

    // 카테고리별 명령어 로드
    loadCategoryCommands(category) {
        const categoryPath = path.join(__dirname, category);
        
        // 카테고리 폴더가 없으면 스킵
        if (!fs.existsSync(categoryPath)) {
            return;
        }

        const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            try {
                const filePath = path.join(categoryPath, file);
                const command = require(filePath);
                
                if (command.data && command.data.name) {
                    // 명령어에 카테고리 정보 추가
                    command.category = category;
                    this.commands.set(command.data.name, command);
                    console.log(`  ✅ [${category}] ${command.data.name} 로드됨`);
                }
            } catch (error) {
                console.error(`  ❌ [${category}] ${file} 로드 실패:`, error.message);
            }
        }
    }

    // 카테고리별 명령어 목록 가져오기
    getCommandsByCategory(category) {
        const commands = [];
        for (const [name, command] of this.commands) {
            if (command.category === category) {
                commands.push(command);
            }
        }
        return commands;
    }

    // 명령어 검색
    findCommand(name) {
        return this.commands.get(name);
    }

    // 명령어 목록 표시 (디버깅용)
    displayCommands() {
        console.log('\n📋 로드된 명령어 목록:');
        for (const category of this.categories) {
            const commands = this.getCommandsByCategory(category);
            if (commands.length > 0) {
                console.log(`\n[${category.toUpperCase()}]`);
                commands.forEach(cmd => {
                    console.log(`  - ${cmd.data.name}: ${cmd.data.description || '설명 없음'}`);
                });
            }
        }
    }
}

module.exports = new CommandLoader();