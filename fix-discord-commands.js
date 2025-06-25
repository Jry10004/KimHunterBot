const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: './.env.production.private' });

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const productionGuildId = process.env.PRODUCTION_GUILD_ID;
const testGuildId = process.env.TEST_GUILD_ID || '1371885859649097849';

console.log('🔧 Discord 명령어 완전 초기화 및 재등록 시작...\n');

const rest = new REST({ version: '10' }).setToken(token);

async function cleanAndRegister() {
    try {
        // 1. 모든 글로벌 명령어 삭제
        console.log('🌍 글로벌 명령어 삭제 중...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('✅ 글로벌 명령어 삭제 완료');

        // 2. 본서버 명령어 삭제
        console.log('\n🗑️ 본서버 명령어 삭제 중...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, productionGuildId),
            { body: [] }
        );
        console.log('✅ 본서버 명령어 삭제 완료');

        // 3. 테스트서버 명령어 삭제 (권한이 있는 경우만)
        try {
            console.log('\n🗑️ 테스트서버 명령어 삭제 시도 중...');
            await rest.put(
                Routes.applicationGuildCommands(clientId, testGuildId),
                { body: [] }
            );
            console.log('✅ 테스트서버 명령어 삭제 완료');
        } catch (error) {
            if (error.code === 50001) {
                console.log('⚠️ 테스트서버 접근 권한 없음 - 건너뜀');
            } else {
                throw error;
            }
        }

        // Discord API 캐시 반영을 위한 대기
        console.log('\n⏳ Discord API 캐시 갱신 대기 중... (5초)');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. commands.js에서 명령어 가져오기
        const { productionCommands } = require('./commands/commands');
        
        // 5. 본서버에 새로 등록
        console.log('\n📝 본서버에 명령어 등록 중...');
        const productionData = await rest.put(
            Routes.applicationGuildCommands(clientId, productionGuildId),
            { body: productionCommands }
        );
        console.log(`✅ 본서버에 ${productionData.length}개 명령어 등록 완료`);

        // 6. 테스트서버에도 등록 (권한이 있는 경우만)
        let testData = [];
        try {
            console.log('\n📝 테스트서버에 명령어 등록 시도 중...');
            testData = await rest.put(
                Routes.applicationGuildCommands(clientId, testGuildId),
                { body: productionCommands }
            );
            console.log(`✅ 테스트서버에 ${testData.length}개 명령어 등록 완료`);
        } catch (error) {
            if (error.code === 50001) {
                console.log('⚠️ 테스트서버 접근 권한 없음 - 건너뜀');
            } else {
                throw error;
            }
        }

        // 7. 등록된 명령어 확인
        console.log('\n📋 등록된 명령어 목록:');
        productionData.forEach((cmd, index) => {
            console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
            if (cmd.default_member_permissions) {
                console.log(`   권한: ${cmd.default_member_permissions === '8' ? '관리자' : cmd.default_member_permissions}`);
            }
        });

        // 8. 문제가 있는 명령어 특별 확인
        console.log('\n🔍 관리자 명령어 상태 확인:');
        const adminCommands = productionData.filter(cmd => cmd.default_member_permissions === '8');
        adminCommands.forEach(cmd => {
            console.log(`\n/${cmd.name}:`);
            console.log(`  ID: ${cmd.id}`);
            console.log(`  권한: ${cmd.default_member_permissions}`);
            console.log(`  옵션 수: ${cmd.options?.length || 0}`);
        });

        console.log('\n✨ 작업 완료!\n');
        console.log('🔄 다음 단계:');
        console.log('1. Discord 클라이언트를 완전히 종료 (작업 표시줄에서도 종료)');
        console.log('2. Discord를 다시 실행');
        console.log('3. 서버에서 나갔다가 다시 들어오기');
        console.log('4. 그래도 안 보이면 다른 기기나 웹 버전에서 확인');
        console.log('\n💡 팁: Discord 모바일 앱에서는 즉시 반영될 수 있습니다.');

    } catch (error) {
        console.error('❌ 오류 발생:', error);
    }
}

cleanAndRegister();