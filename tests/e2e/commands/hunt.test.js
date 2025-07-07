const { createMockInteraction, waitForReply } = require('../../utils/discordMocks');
const { handleHuntCommand } = require('../../../commands/hunt');
const User = require('../../../models/User');

describe('Hunt Command E2E', () => {
    let mockInteraction;
    let testUser;
    
    beforeEach(async () => {
        testUser = await createTestUser({
            level: 5,
            gold: 1000,
            stats: {
                str: 30,
                dex: 25,
                int: 20,
                luk: 15
            }
        });
        
        mockInteraction = createMockInteraction({
            userId: testUser.discordId,
            command: 'hunt',
            options: new Map()
        });
    });
    
    describe('사냥 시작', () => {
        test('사냥터 선택 UI 표시', async () => {
            await handleHuntCommand(mockInteraction);
            
            const reply = mockInteraction.getLastReply();
            expect(reply.embeds).toHaveLength(1);
            expect(reply.embeds[0].title).toContain('사냥터 선택');
            expect(reply.components).toHaveLength(1);
            expect(reply.components[0].components[0].options.length).toBeGreaterThan(0);
        });
        
        test('레벨 제한 확인', async () => {
            // 낮은 레벨 유저
            const lowLevelUser = await createTestUser({
                discordId: '111111111111111111',
                level: 1
            });
            
            const lowLevelInteraction = createMockInteraction({
                userId: lowLevelUser.discordId,
                command: 'hunt'
            });
            
            await handleHuntCommand(lowLevelInteraction);
            
            // 선택 가능한 사냥터가 제한됨
            const reply = lowLevelInteraction.getLastReply();
            const selectMenu = reply.components[0].components[0];
            const availableAreas = selectMenu.options.filter(opt => !opt.disabled);
            
            expect(availableAreas.length).toBeLessThan(selectMenu.options.length);
        });
    });
    
    describe('사냥 진행', () => {
        test('몬스터 조우 및 전투', async () => {
            // 사냥터 선택
            await mockInteraction.selectMenu('hunting_area_select', ['forest']);
            
            const battleReply = await waitForReply(mockInteraction);
            
            // 전투 UI 확인
            expect(battleReply.embeds[0].title).toContain('몬스터 조우');
            expect(battleReply.components).toHaveLength(1);
            
            const buttons = battleReply.components[0].components;
            expect(buttons.find(b => b.customId === 'hunt_attack')).toBeDefined();
            expect(buttons.find(b => b.customId === 'hunt_skill')).toBeDefined();
            expect(buttons.find(b => b.customId === 'hunt_run')).toBeDefined();
        });
        
        test('전투 승리 및 보상', async () => {
            await mockInteraction.selectMenu('hunting_area_select', ['forest']);
            
            // 공격
            await mockInteraction.clickButton('hunt_attack');
            
            // 전투가 끝날 때까지 반복
            let battleEnded = false;
            let rewards = null;
            
            while (!battleEnded) {
                const reply = mockInteraction.getLastReply();
                
                if (reply.embeds[0].title.includes('승리') || reply.embeds[0].title.includes('패배')) {
                    battleEnded = true;
                    
                    if (reply.embeds[0].title.includes('승리')) {
                        // 보상 확인
                        const rewardField = reply.embeds[0].fields.find(f => f.name.includes('보상'));
                        expect(rewardField).toBeDefined();
                        
                        // 유저 데이터 업데이트 확인
                        const updatedUser = await User.findOne({ discordId: testUser.discordId });
                        expect(updatedUser.exp).toBeGreaterThan(testUser.exp);
                    }
                } else {
                    // 계속 공격
                    await mockInteraction.clickButton('hunt_attack');
                }
            }
        });
        
        test('도망 기능', async () => {
            await mockInteraction.selectMenu('hunting_area_select', ['desert']);
            
            // 도망 시도
            await mockInteraction.clickButton('hunt_run');
            
            const reply = mockInteraction.getLastReply();
            
            // 도망 성공 또는 실패 메시지
            expect(reply.embeds[0].description).toMatch(/도망쳤습니다|도망치지 못했습니다/);
        });
    });
    
    describe('아이템 드롭', () => {
        test('아이템 획득 확률', async () => {
            // 행운 스탯이 높은 유저
            const luckyUser = await createTestUser({
                discordId: '222222222222222222',
                level: 10,
                stats: { luk: 100 }
            });
            
            const luckyInteraction = createMockInteraction({
                userId: luckyUser.discordId
            });
            
            let itemDropped = false;
            
            // 여러 번 사냥하여 아이템 드롭 테스트
            for (let i = 0; i < 10; i++) {
                await luckyInteraction.selectMenu('hunting_area_select', ['cave']);
                
                // 빠른 전투 진행
                while (true) {
                    const reply = luckyInteraction.getLastReply();
                    
                    if (reply.embeds[0].title.includes('승리')) {
                        const itemField = reply.embeds[0].fields.find(f => 
                            f.name.includes('아이템') || f.value.includes('획득')
                        );
                        
                        if (itemField) {
                            itemDropped = true;
                            break;
                        }
                    }
                    
                    if (reply.embeds[0].title.includes('패배') || 
                        reply.embeds[0].title.includes('승리')) {
                        break;
                    }
                    
                    await luckyInteraction.clickButton('hunt_attack');
                }
                
                if (itemDropped) break;
            }
            
            // 높은 행운으로 적어도 한 번은 아이템이 드롭되어야 함
            expect(itemDropped).toBe(true);
        });
    });
    
    describe('에너지 시스템', () => {
        test('에너지 소모', async () => {
            const initialEnergy = testUser.energy;
            
            await mockInteraction.selectMenu('hunting_area_select', ['forest']);
            
            const updatedUser = await User.findOne({ discordId: testUser.discordId });
            expect(updatedUser.energy).toBeLessThan(initialEnergy);
        });
        
        test('에너지 부족 시 사냥 불가', async () => {
            // 에너지를 0으로 설정
            await User.updateOne(
                { discordId: testUser.discordId },
                { energy: 0 }
            );
            
            await handleHuntCommand(mockInteraction);
            
            const reply = mockInteraction.getLastReply();
            expect(reply.embeds[0].description).toContain('에너지가 부족');
        });
    });
});