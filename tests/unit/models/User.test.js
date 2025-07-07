const User = require('../../../models/User');
const mongoose = require('mongoose');

describe('User Model', () => {
    describe('Schema Validation', () => {
        test('필수 필드가 있어야 함', async () => {
            const user = new User({
                discordId: '123456789012345678',
                username: 'testuser'
            });
            
            const savedUser = await user.save();
            expect(savedUser.discordId).toBe('123456789012345678');
            expect(savedUser.username).toBe('testuser');
            expect(savedUser.level).toBe(1); // 기본값
            expect(savedUser.gold).toBe(0); // 기본값
        });
        
        test('discordId 없이는 생성 불가', async () => {
            const user = new User({
                username: 'testuser'
            });
            
            await expect(user.save()).rejects.toThrow();
        });
        
        test('중복된 discordId 불가', async () => {
            await User.create({
                discordId: '123456789012345678',
                username: 'testuser1'
            });
            
            const duplicateUser = new User({
                discordId: '123456789012345678',
                username: 'testuser2'
            });
            
            await expect(duplicateUser.save()).rejects.toThrow();
        });
    });
    
    describe('Methods', () => {
        test('addGold 메서드', async () => {
            const user = await createTestUser({ gold: 1000 });
            
            user.addGold(500);
            expect(user.gold).toBe(1500);
            
            user.addGold(-200);
            expect(user.gold).toBe(1300);
            
            // 음수로 가지 않음
            user.addGold(-2000);
            expect(user.gold).toBe(0);
        });
        
        test('addExp 메서드와 레벨업', async () => {
            const user = await createTestUser({ 
                level: 1, 
                exp: 90,
                expToNext: 100 
            });
            
            // 레벨업 테스트
            const leveledUp = user.addExp(20);
            expect(leveledUp).toBe(true);
            expect(user.level).toBe(2);
            expect(user.exp).toBe(10); // 초과분
            expect(user.expToNext).toBe(120); // 다음 레벨 요구치
        });
        
        test('calculateCombatPower 메서드', async () => {
            const user = await createTestUser({
                level: 10,
                stats: {
                    str: 50,
                    dex: 30,
                    int: 20,
                    luk: 40
                },
                equipment: {
                    weapon: { 
                        stats: { attack: 100, str: 10 } 
                    }
                }
            });
            
            const combatPower = user.calculateCombatPower();
            expect(combatPower).toBeGreaterThan(0);
            expect(typeof combatPower).toBe('number');
        });
    });
    
    describe('Inventory Management', () => {
        test('아이템 추가', async () => {
            const user = await createTestUser();
            
            const item = {
                name: '테스트 검',
                type: 'weapon',
                rarity: 'common',
                stats: { attack: 10 }
            };
            
            const success = user.addItem(item);
            expect(success).toBe(true);
            expect(user.inventory.length).toBe(1);
            expect(user.inventory[0].name).toBe('테스트 검');
        });
        
        test('인벤토리 용량 제한', async () => {
            const user = await createTestUser();
            user.inventorySize = 5;
            
            // 5개 아이템 추가
            for (let i = 0; i < 5; i++) {
                user.addItem({ name: `아이템${i}`, type: 'item' });
            }
            
            // 6번째 아이템은 실패
            const success = user.addItem({ name: '초과아이템', type: 'item' });
            expect(success).toBe(false);
            expect(user.inventory.length).toBe(5);
        });
    });
    
    describe('Daily Limits', () => {
        test('일일 제한 확인', async () => {
            const user = await createTestUser({
                dailyLimits: {
                    questsCompleted: 5,
                    maxQuests: 10
                }
            });
            
            expect(user.canDoQuest()).toBe(true);
            
            user.dailyLimits.questsCompleted = 10;
            expect(user.canDoQuest()).toBe(false);
        });
        
        test('일일 리셋', async () => {
            const user = await createTestUser({
                dailyLimits: {
                    questsCompleted: 10,
                    workCount: 5,
                    dailyRewardClaimed: true
                }
            });
            
            user.resetDailyLimits();
            
            expect(user.dailyLimits.questsCompleted).toBe(0);
            expect(user.dailyLimits.workCount).toBe(0);
            expect(user.dailyLimits.dailyRewardClaimed).toBe(false);
        });
    });
});