const { initializeAllEmblemShops } = require('../../systems/emblemShop');

// 관리자 전용 - 엠블럼 상점 새로고침
module.exports = {
    data: {
        name: '엠블럼상점새로고침',
        description: '영구 엠블럼 상점을 새로고침합니다',
    },
    async execute(interaction) {
        // 관리자 권한 체크
        const ADMIN_IDS = ['424480594542592009', '295980447849250817', '532128778175619084', '592659577384730645'];
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return await interaction.reply({ 
                content: '❌ 이 명령어는 관리자만 사용할 수 있습니다!', 
                flags: 64 
            });
        }

        try {
            await interaction.deferReply({ flags: 64 });
            
            // 엠블럼 상점 초기화
            const result = await initializeAllEmblemShops(interaction.client);
            
            if (result) {
                await interaction.editReply({
                    content: '✅ 모든 서버의 엠블럼 상점이 새로고침되었습니다!',
                    flags: 64
                });
            } else {
                await interaction.editReply({
                    content: '❌ 엠블럼 상점 새로고침 중 오류가 발생했습니다.',
                    flags: 64
                });
            }
        } catch (error) {
            console.error('엠블럼 상점 새로고침 오류:', error);
            
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ 엠블럼 상점 새로고침 중 오류가 발생했습니다.',
                    flags: 64
                });
            } else {
                await interaction.reply({
                    content: '❌ 엠블럼 상점 새로고침 중 오류가 발생했습니다.',
                    flags: 64
                });
            }
        }
    }
};