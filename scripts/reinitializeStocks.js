const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const { COMPANIES } = require('../data/companiesData');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function reinitializeStocks() {
    try {
        // MongoDB 연결
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB 연결 성공');
        
        // 모든 주식 가져오기
        const allStocks = await Stock.find({});
        console.log(`\n📊 현재 Stock 컬렉션 문서 수: ${allStocks.length}개`);
        
        // companiesData에 있는 모든 회사 확인
        const companyIds = Object.keys(COMPANIES);
        console.log(`📊 companiesData 회사 수: ${companyIds.length}개`);
        
        // 누락된 회사 찾기
        const existingIds = allStocks.map(s => s.companyId);
        const missingIds = companyIds.filter(id => !existingIds.includes(id));
        
        if (missingIds.length > 0) {
            console.log(`\n⚠️ 누락된 회사 ${missingIds.length}개 발견:`);
            console.log(missingIds);
            
            console.log('\n🔧 누락된 회사 추가 중...');
            for (const companyId of missingIds) {
                const company = COMPANIES[companyId];
                const stock = new Stock({
                    companyId,
                    companyName: company.name,
                    companyType: company.type || 'general',
                    currentPrice: company.currentPrice || company.basePrice || 10000,
                    basePrice: company.basePrice || 10000,
                    shares: company.shares || 100000
                });
                
                // 초기 가격 히스토리 생성
                const basePrice = company.basePrice || 10000;
                for (let i = 30; i >= 0; i--) {
                    const price = basePrice * (1 + (Math.random() - 0.5) * 0.1);
                    stock.priceHistory.push({
                        price: Math.floor(price),
                        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                    });
                }
                
                await stock.save();
                console.log(`✅ ${company.name} 추가됨`);
            }
        }
        
        // 가격이 0이거나 NaN인 주식 수정
        const problematicStocks = await Stock.find({
            $or: [
                { currentPrice: 0 },
                { currentPrice: null },
                { currentPrice: { $type: "string" } }
            ]
        });
        
        if (problematicStocks.length > 0) {
            console.log(`\n⚠️ 문제가 있는 주식 ${problematicStocks.length}개 발견`);
            
            for (const stock of problematicStocks) {
                const company = COMPANIES[stock.companyId];
                stock.currentPrice = company?.currentPrice || company?.basePrice || 10000;
                stock.basePrice = company?.basePrice || 10000;
                stock.dailyChange = 0;
                stock.dailyChangePercent = 0;
                await stock.save();
                console.log(`✅ ${stock.companyName} 수정됨: ${stock.currentPrice}G`);
            }
        }
        
        // 최종 통계
        const finalStats = await Stock.getMarketStats();
        console.log('\n📊 최종 시장 통계:');
        console.log(`- 총 주식 수: ${finalStats.totalStocks}`);
        console.log(`- 총 시가총액: ${finalStats.totalMarketCap}`);
        console.log(`- 상승 종목: ${finalStats.gainers}`);
        console.log(`- 하락 종목: ${finalStats.losers}`);
        
        // 연결 종료
        await mongoose.connection.close();
        console.log('\n✅ 작업 완료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error);
        process.exit(1);
    }
}

reinitializeStocks();