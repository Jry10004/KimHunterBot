const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// 아이템 타입 결정 함수
function determineItemType(itemName) {
    const name = itemName.toLowerCase();
    
    // 무기
    if (name.includes('검') || name.includes('도끼') || name.includes('창') || 
        name.includes('활') || name.includes('지팡이') || name.includes('둔기') ||
        name.includes('단검') || name.includes('총') || name.includes('대검') ||
        name.includes('완드') || name.includes('스태프') || name.includes('메이스')) {
        return 'weapon';
    }
    
    // 갑옷
    if (name.includes('갑옷') || name.includes('로브') || name.includes('튜닉') ||
        name.includes('조끼') || name.includes('흉갑') || name.includes('판금') ||
        name.includes('체인메일') || name.includes('가죽옷')) {
        return 'armor';
    }
    
    // 투구
    if (name.includes('투구') || name.includes('모자') || name.includes('헬멧') ||
        name.includes('두건') || name.includes('관') || name.includes('후드') ||
        name.includes('모') || name.includes('캡') || name.includes('작업모')) {
        return 'helmet';
    }
    
    // 장갑
    if (name.includes('장갑') || name.includes('건틀렛') || name.includes('미튼') ||
        name.includes('글러브') || name.includes('주먹')) {
        return 'gloves';
    }
    
    // 신발
    if (name.includes('신발') || name.includes('부츠') || name.includes('구두') ||
        name.includes('샌들') || name.includes('슬리퍼') || name.includes('경보') ||
        name.includes('훈련화')) {
        return 'boots';
    }
    
    // 방패
    if (name.includes('방패') || name.includes('쉴드') || name.includes('버클러')) {
        return 'shield';
    }
    
    // 진짜 악세사리
    if (name.includes('반지') || name.includes('목걸이') || name.includes('귀걸이') ||
        name.includes('팔찌') || name.includes('브로치') || name.includes('펜던트') ||
        name.includes('벨트') || name.includes('띠') || name.includes('부적') ||
        name.includes('메달') || name.includes('훈장') || name.includes('휘장')) {
        return 'accessory';
    }
    
    // 기본값 - 이름에서 타입을 추론할 수 없는 경우
    return null;
}

async function fixAccessoryTypes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 유저 조회
        const users = await User.find({});
        console.log(`총 ${users.length}명의 유저 데이터를 검사합니다.`);
        
        let totalFixed = 0;
        let userFixed = 0;
        
        for (const user of users) {
            if (!user.inventory || user.inventory.length === 0) continue;
            
            let modified = false;
            let fixedInUser = 0;
            
            // 인벤토리의 각 아이템 확인
            for (let i = 0; i < user.inventory.length; i++) {
                const item = user.inventory[i];
                if (!item || !item.name) continue;
                
                // 현재 타입이 accessory인 아이템만 확인
                if (item.type === 'accessory') {
                    const correctType = determineItemType(item.name);
                    
                    // 악세사리가 아닌 다른 타입으로 판별된 경우
                    if (correctType && correctType !== 'accessory') {
                        console.log(`[${user.nickname || user.discordId}] "${item.name}": accessory → ${correctType}`);
                        user.inventory[i].type = correctType;
                        modified = true;
                        fixedInUser++;
                        totalFixed++;
                        
                        // 만약 이 아이템이 악세사리 슬롯에 장착되어 있다면 장착 해제
                        if (user.equipment && user.equipment.accessory === i) {
                            console.log(`  └─ 악세사리 슬롯에서 장착 해제`);
                            user.equipment.accessory = -1;
                            user.inventory[i].equipped = false;
                        }
                    }
                }
            }
            
            if (modified) {
                await user.save();
                userFixed++;
                console.log(`✅ ${user.nickname || user.discordId}: ${fixedInUser}개 아이템 수정 완료`);
            }
        }
        
        console.log('\n=== 수정 완료 ===');
        console.log(`총 ${userFixed}명의 유저 데이터 수정`);
        console.log(`총 ${totalFixed}개의 아이템 타입 수정`);
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB 연결 종료');
    }
}

// 스크립트 실행
fixAccessoryTypes();