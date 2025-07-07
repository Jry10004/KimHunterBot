const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { LOOT_MARKET } = require('../data/lootMarket');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('감정테스트')
        .setDescription('테스트용 미확인 아이템 생성'),
    
    async execute(interaction) {
        const user = await User.findOne({ discordId: interaction.user.id });
        if (!user) {
            return await interaction.reply({ 
                content: '❌ 먼저 회원가입을 해주세요!', 
                ephemeral: true 
            });
        }
        
        // lootAppraisal 초기화
        if (!user.lootAppraisal) {
            user.lootAppraisal = {
                unidentifiedItems: [],
                identifiedItems: [],
                totalAppraised: 0,
                bestFind: null
            };
        }
        
        // 테스트용 미확인 아이템 4개 생성
        const testItems = [
            {
                id: `test_${Date.now()}_1`,
                grade: 'common',
                obtainedFrom: '불타는 늑대',
                obtainedAt: new Date(),
                identified: false
            },
            {
                id: `test_${Date.now()}_2`,
                grade: 'mysterious',
                obtainedFrom: '얼음 거미',
                obtainedAt: new Date(),
                identified: false
            },
            {
                id: `test_${Date.now()}_3`,
                grade: 'ancient',
                obtainedFrom: '독성 슬라임',
                obtainedAt: new Date(),
                identified: false
            },
            {
                id: `test_${Date.now()}_4`,
                grade: 'divine',
                obtainedFrom: '번개 고블린',
                obtainedAt: new Date(),
                identified: false
            }
        ];
        
        // 사용자의 미확인 아이템에 추가
        user.lootAppraisal.unidentifiedItems.push(...testItems);
        await user.save();
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎁 테스트 미확인 아이템 생성 완료!')
            .setDescription('4개의 미확인 아이템이 추가되었습니다.')
            .addFields(
                { 
                    name: '📦 추가된 아이템', 
                    value: testItems.map((item, index) => 
                        `${index + 1}. **${item.grade}** 등급 - ${item.obtainedFrom}에서 획득`
                    ).join('\n')
                },
                {
                    name: '🔍 감정 방법',
                    value: '감정사를 찾아가서 "감정 의뢰" 버튼을 클릭하세요!'
                }
            )
            .setFooter({ text: '이제 감정 시스템을 테스트할 수 있습니다!' });
        
        return await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};