const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const { COMPANIES } = require('../data/companiesData');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fixZeroPriceStocks() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 가격이 0인 주식 찾기
        const zeroStocks = await Stock.find({ currentPrice: 0 });
        console.log(`\n⚠️ 가격이 0원인 주식 수: ${zeroStocks.length}개`);
        
        if (zeroStocks.length > 0) {
            console.log('\n🔧 가격 수정 시작...');
            
            for (const stock of zeroStocks) {
                // companiesData에서 기본 가격 찾기
                const companyData = COMPANIES[stock.companyId];
                
                if (companyData) {
                    // 기본 가격으로 복원
                    stock.currentPrice = companyData.basePrice || companyData.currentPrice || 10000;
                    stock.basePrice = companyData.basePrice || 10000;
                    stock.dailyChange = 0;
                    stock.dailyChangePercent = 0;
                    
                    await stock.save();
                    console.log(`✅ ${stock.companyName}: ${stock.currentPrice}G로 복원`);
                } else {
                    // 데이터가 없으면 기본값 10000G
                    stock.currentPrice = 10000;
                    stock.basePrice = 10000;
                    stock.dailyChange = 0;
                    stock.dailyChangePercent = 0;
                    
                    await stock.save();
                    console.log(`✅ ${stock.companyName}: 10000G로 기본값 설정`);
                }
            }
            
            console.log('\n✅ 모든 0원 주식 수정 완료');
        } else {
            console.log('✅ 수정할 주식이 없습니다.');
        }
        
        // 수정 후 통계
        const afterStats = await Stock.getMarketStats();
        console.log('\n📊 수정 후 시장 통계:');
        console.log(`- 총 주식 수: ${afterStats.totalStocks}`);
        console.log(`- 총 시가총액: ${afterStats.totalMarketCap}`);
        
        // 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

fixZeroPriceStocks();