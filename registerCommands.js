require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✅ 로드됨: ${command.data.name}`);
    } else {
        console.log(`⚠️ ${file}에 필요한 "data" 또는 "execute" 속성이 없습니다.`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🔄 ${commands.length}개의 슬래시 명령어를 등록하는 중...`);

        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ ${data.length}개의 슬래시 명령어가 성공적으로 등록되었습니다!`);
        
        // 등록된 명령어 목록 출력
        console.log('\n📋 등록된 명령어:');
        data.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('❌ 명령어 등록 중 오류 발생:', error);
    }
})();