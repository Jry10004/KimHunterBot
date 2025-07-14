const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkBugHunterTitle() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');

        // 버그 사냥꾼 칭호를 가진 모든 유저 찾기
        const usersWithTitle = await User.find({ titles: '버그 사냥꾼' });
        console.log(`\n버그 사냥꾼 칭호를 가진 유저 수: ${usersWithTitle.length}`);

        // 버그 사냥꾼 칭호를 장착한 유저 찾기
        const usersEquipped = await User.find({ equippedTitle: '버그 사냥꾼' });
        console.log(`버그 사냥꾼 칭호를 장착한 유저 수: ${usersEquipped.length}`);

        if (usersEquipped.length > 0) {
            console.log('\n장착한 유저 목록:');
            for (const user of usersEquipped) {
                console.log(`- ${user.nickname || user.discordId}: 레벨 ${user.level}, 골드 ${user.gold.toLocaleString()}`);
                console.log(`  equippedTitle: "${user.equippedTitle}" (타입: ${typeof user.equippedTitle})`);
                console.log(`  titles: ${JSON.stringify(user.titles)}`);
            }
        }

        // 칭호는 있지만 장착하지 않은 유저
        const usersNotEquipped = usersWithTitle.filter(user => user.equippedTitle !== '버그 사냥꾼');
        if (usersNotEquipped.length > 0) {
            console.log('\n칭호는 있지만 장착하지 않은 유저:');
            for (const user of usersNotEquipped) {
                console.log(`- ${user.nickname || user.discordId}: 현재 장착 칭호 "${user.equippedTitle || '없음'}"`);
            }
        }

        // 모든 유니크한 칭호 확인
        const allUsers = await User.find({ titles: { $exists: true, $ne: [] } });
        const allTitles = new Set();
        allUsers.forEach(user => {
            if (user.titles && Array.isArray(user.titles)) {
                user.titles.forEach(title => allTitles.add(title));
            }
        });
        
        console.log('\n모든 유니크한 칭호:');
        Array.from(allTitles).forEach(title => {
            console.log(`- "${title}"`);
        });

        // equippedTitle 필드의 모든 유니크 값
        const allEquippedTitles = await User.distinct('equippedTitle');
        console.log('\n모든 장착된 칭호 (유니크):');
        allEquippedTitles.forEach(title => {
            if (title) console.log(`- "${title}"`);
        });

    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nMongoDB 연결 종료');
    }
}

checkBugHunterTitle();