require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];

// 명령어 폴더 재귀적으로 읽기
function loadCommands(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // 하위 디렉토리 재귀 탐색
            loadCommands(filePath);
        } else if (file.endsWith('.js')) {
            try {
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ 로드됨: ${command.data.name} (${filePath})`);
                } else {
                    console.log(`⚠️ ${file}에 필요한 "data" 또는 "execute" 속성이 없습니다.`);
                }
            } catch (error) {
                console.error(`❌ ${file} 로드 오류:`, error.message);
            }
        }
    }
}

// commands 폴더 로드
const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n🔄 ${commands.length}개의 슬래시 명령어를 등록하는 중...`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`\n✅ ${data.length}개의 슬래시 명령어가 성공적으로 등록되었습니다!`);
        
        // 등록된 명령어 목록 출력
        console.log('\n📋 등록된 명령어:');
        data.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
        
        // 버그발견 명령어 확인
        const hasBugReport = data.some(cmd => cmd.name === '버그발견');
        if (hasBugReport) {
            console.log('\n✅ /버그발견 명령어가 포함되어 있습니다!');
        } else {
            console.log('\n⚠️ /버그발견 명령어가 포함되지 않았습니다!');
        }
        
    } catch (error) {
        console.error('❌ 명령어 등록 중 오류 발생:', error);
    }
})();