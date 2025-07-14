const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const { COMPANIES } = require('../data/companiesData');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function cleanupDuplicateStocks() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 주식 가져오기
        const allStocks = await Stock.find({});
        console.log(`\n📊 현재 Stock 컬렉션 문서 수: ${allStocks.length}개`);
        
        // companiesData에 없는 주식 찾기
        const validCompanyIds = Object.keys(COMPANIES);
        const invalidStocks = allStocks.filter(stock => !validCompanyIds.includes(stock.companyId));
        
        if (invalidStocks.length > 0) {
            console.log(`\n⚠️ companiesData에 없는 주식 ${invalidStocks.length}개 발견:`);
            for (const stock of invalidStocks) {
                console.log(`- ${stock.companyId}: ${stock.companyName}`);
                await Stock.deleteOne({ _id: stock._id });
                console.log(`  ❌ 삭제됨`);
            }
        }
        
        // 중복된 companyId 찾기
        const companyIdCount = {};
        allStocks.forEach(stock => {
            companyIdCount[stock.companyId] = (companyIdCount[stock.companyId] || 0) + 1;
        });
        
        const duplicates = Object.entries(companyIdCount).filter(([id, count]) => count > 1);
        
        if (duplicates.length > 0) {
            console.log(`\n⚠️ 중복된 companyId ${duplicates.length}개 발견:`);
            for (const [companyId, count] of duplicates) {
                console.log(`- ${companyId}: ${count}개`);
                
                // 중복 중 첫 번째만 남기고 나머지 삭제
                const duplicateStocks = await Stock.find({ companyId }).sort({ _id: 1 });
                for (let i = 1; i < duplicateStocks.length; i++) {
                    await Stock.deleteOne({ _id: duplicateStocks[i]._id });
                    console.log(`  ❌ 중복 삭제됨`);
                }
            }
        }
        
        // 최종 확인
        const finalCount = await Stock.countDocuments();
        console.log(`\n✅ 정리 완료. 최종 주식 수: ${finalCount}개`);
        
        // 최종 통계
        const finalStats = await Stock.getMarketStats();
        console.log('\n📊 최종 시장 통계:');
        console.log(`- 총 주식 수: ${finalStats.totalStocks}`);
        console.log(`- 총 시가총액: ${finalStats.totalMarketCap}`);
        
        // 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

cleanupDuplicateStocks();