const { SlashCommandBuilder } = require('discord.js');
const { spawn } = require('child_process');
const autoMigrationSystem = require('../../systems/autoMigration');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('데이터마이그레이션')
        .setDescription('관리자 전용 - 데이터베이스 마이그레이션 실행')
        .addStringOption(option => 
            option.setName('타입')
                .setDescription('마이그레이션 타입 선택')
                .setRequired(true)
                .addChoices(
                    { name: 'baseStats - 강화 원본 스탯 추가', value: 'basestats' },
                    { name: 'accessories - 장신구 시스템 통합', value: 'accessories' },
                    { name: 'auto - 자동 마이그레이션 즉시 실행', value: 'auto' }
                )),
    
    category: 'admin',
    adminOnly: true,
    
    async execute(interaction) {
        // 관리자 확인
        const adminIds = ['364197967114272769', '1234567890']; // 관리자 Discord ID
        if (!adminIds.includes(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.', 
                ephemeral: true 
            });
        }

        const migrationType = interaction.options.getString('타입');
        
        await interaction.deferReply();
        
        // 자동 마이그레이션 즉시 실행
        if (migrationType === 'auto') {
            const result = await autoMigrationSystem.manualRun();
            return await interaction.editReply(result.message);
        }
        
        let scriptPath;
        let scriptName;
        
        switch (migrationType) {
            case 'basestats':
                scriptPath = 'scripts/migrateBaseStats.js';
                scriptName = 'baseStats 마이그레이션';
                break;
            case 'accessories':
                scriptPath = 'scripts/migrateAccessories.js';
                scriptName = '장신구 시스템 마이그레이션';
                break;
            default:
                return await interaction.editReply('❌ 알 수 없는 마이그레이션 타입입니다.');
        }
        
        try {
            // 마이그레이션 스크립트 실행
            const migrationProcess = spawn('node', [scriptPath]);
            
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
                if (code === 0) {
                    // 성공
                    const successMessage = `✅ **${scriptName} 완료!**\n\`\`\`\n${output.slice(-1500)}\n\`\`\``;
                    await interaction.editReply(successMessage);
                } else {
                    // 실패
                    const errorMessage = `❌ **${scriptName} 실패!**\n\`\`\`\n${errorOutput || output}\n\`\`\``;
                    await interaction.editReply(errorMessage);
                }
            });
            
            // 타임아웃 (30초)
            setTimeout(() => {
                migrationProcess.kill();
                interaction.editReply('⏱️ 마이그레이션이 시간 초과되었습니다.').catch(() => {});
            }, 30000);
            
        } catch (error) {
            console.error('마이그레이션 실행 오류:', error);
            await interaction.editReply(`❌ 마이그레이션 실행 중 오류가 발생했습니다:\n\`\`\`${error.message}\`\`\``);
        }
    }
};