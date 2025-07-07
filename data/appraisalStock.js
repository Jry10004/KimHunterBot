// 감정 주식 시스템
const APPRAISAL_STOCK = {
    // 감정 창고 설정
    warehouse: {
        maxSlots: 50,                    // 최대 보관 슬롯
        storageFee: 10,                  // 슬롯당 일일 보관료
        upgradeSlotCost: 10000,          // 슬롯 확장 비용
        maxUpgrades: 100                 // 최대 150슬롯까지
    },
    
    // 감정 증서 조합법
    certificates: {
        // 기본 조합
        basic: {
            '재료 묶음 증서': {
                recipe: { materials: 5 },          // 일반 재료 5개
                value: 3000,                       // 고정가
                description: '기본 재료 묶음 증서'
            },
            '희귀 재료 증서': {
                recipe: { rare_materials: 3 },     // 희귀 재료 3개
                value: 10000,
                description: '희귀 재료 품질 보증서'
            },
            '변이 증서': {
                recipe: { mutation_drops: 2 },     // 변이 드롭 2개
                value: 20000,
                description: '변이 물질 연구 증서'
            }
        },
        
        // 특수 조합
        special: {
            '무지개 증서': {
                recipe: {
                    rainbow_flower: 1,
                    unicorn_hair: 1,
                    crystal_shard: 1
                },
                value: 50000,
                description: '환상의 재료 조합 증서'
            },
            '원소 증서': {
                recipe: {
                    blazing_essence: 1,
                    frozen_crystal: 1,
                    thunder_core: 1,
                    shadow_fragment: 1
                },
                value: 100000,
                description: '4원소 완전체 증서'
            },
            '전설 증서': {
                recipe: {
                    phoenix_feather: 1,
                    divine_grail: 1,
                    fate_dice: 1
                },
                value: 1000000,
                description: '전설급 보물 인증서'
            }
        },
        
        // 시즌 한정 조합
        seasonal: {
            '크리스마스 증서': {
                recipe: {
                    frozen_crystal: 2,
                    holy_orb: 1
                },
                value: 30000,
                description: '겨울 한정 특별 증서',
                season: 'winter'
            },
            '할로윈 증서': {
                recipe: {
                    shadow_fragment: 2,
                    venom_sac: 1
                },
                value: 35000,
                description: '공포의 밤 특별 증서',
                season: 'halloween'
            }
        }
    },
    
    // 시세 예측 시스템
    predictions: {
        // AI 감정사의 예측
        aiHints: [
            { pattern: '3일 연속 하락', hint: '반등 가능성 높음' },
            { pattern: '급등 후 정체', hint: '조정 예상' },
            { pattern: '거래량 급증', hint: '큰 변동 예고' },
            { pattern: '역대 최저가', hint: '바닥 확인 필요' },
            { pattern: '역대 최고가', hint: '차익실현 고려' }
        ],
        
        // 예측 정확도 (플레이어 레벨에 따라)
        accuracy: {
            novice: 0.3,      // 30% 정확도
            expert: 0.5,      // 50% 정확도
            master: 0.7,      // 70% 정확도
            legend: 0.9       // 90% 정확도
        }
    },
    
    // 특별 이벤트
    events: {
        // 감정 대란
        appraisalCrisis: {
            name: '감정 대란',
            description: '모든 아이템 시세 ±50% 급변동!',
            duration: 300000,  // 5분
            frequency: 0.01    // 1% 확률
        },
        
        // 황금 감정사
        goldenAppraiser: {
            name: '황금 감정사 방문',
            description: '모든 감정품 2배 가격 매입!',
            duration: 180000,  // 3분
            frequency: 0.005   // 0.5% 확률
        },
        
        // 감정 수수료 면제
        freeAppraisal: {
            name: '감정 수수료 면제',
            description: '보관료 무료 이벤트!',
            duration: 600000,  // 10분
            frequency: 0.02    // 2% 확률
        }
    },
    
    // 거래 전략
    strategies: {
        '단타 전략': {
            description: '10% 수익 시 즉시 매도',
            autoSell: { profit: 0.1 }
        },
        '존버 전략': {
            description: '50% 수익까지 보유',
            autoSell: { profit: 0.5 }
        },
        '손절 전략': {
            description: '10% 손실 시 매도',
            autoSell: { loss: -0.1 }
        },
        '물타기 전략': {
            description: '하락 시 추가 수집',
            autoBuy: { drop: -0.2 }
        }
    },
    
    // 감정 창고 등급
    warehouseGrades: {
        basic: {
            name: '기본 창고',
            slots: 50,
            fee: 10,
            features: []
        },
        premium: {
            name: '프리미엄 창고',
            slots: 100,
            fee: 5,
            features: ['자동 정리', '시세 알림'],
            upgradeCost: 100000
        },
        vip: {
            name: 'VIP 창고',
            slots: 200,
            fee: 0,
            features: ['자동 정리', '시세 알림', 'AI 예측', '자동 매매'],
            upgradeCost: 500000
        }
    }
};

// 감정 증서 생성 가능 확인
function canCreateCertificate(inventory, certificateId) {
    let certificate = null;
    
    // 모든 카테고리에서 증서 찾기
    for (const category of Object.values(APPRAISAL_STOCK.certificates)) {
        if (category[certificateId]) {
            certificate = category[certificateId];
            break;
        }
    }
    
    if (!certificate) return false;
    
    // 재료 확인
    for (const [itemId, required] of Object.entries(certificate.recipe)) {
        const owned = inventory.filter(item => item.id === itemId).length;
        if (owned < required) return false;
    }
    
    return true;
}

// 시세 예측 생성
function generatePrediction(itemHistory, playerLevel) {
    if (!itemHistory || itemHistory.length < 3) {
        return { hint: '데이터 부족', confidence: 0 };
    }
    
    // 패턴 분석
    const recent = itemHistory.slice(-3);
    const trend = recent[2].price - recent[0].price;
    const volatility = Math.abs(recent[1].price - recent[0].price) + Math.abs(recent[2].price - recent[1].price);
    
    let hint = '';
    let confidence = 0;
    
    // 트렌드 기반 예측
    if (trend > 0 && volatility < trend * 0.5) {
        hint = '상승 추세 지속 예상';
        confidence = 0.7;
    } else if (trend < 0 && volatility < Math.abs(trend) * 0.5) {
        hint = '하락 추세 지속 예상';
        confidence = 0.7;
    } else if (volatility > Math.abs(trend) * 2) {
        hint = '변동성 확대, 주의 필요';
        confidence = 0.5;
    } else {
        hint = '횡보 예상';
        confidence = 0.6;
    }
    
    // 플레이어 레벨에 따른 정확도 적용
    const accuracyLevel = playerLevel >= 100 ? 'legend' : 
                         playerLevel >= 50 ? 'master' :
                         playerLevel >= 20 ? 'expert' : 'novice';
    
    confidence *= APPRAISAL_STOCK.predictions.accuracy[accuracyLevel];
    
    return { hint, confidence: Math.floor(confidence * 100) };
}

// 자동 매매 체크
function checkAutoTrade(item, strategy, currentPrice) {
    const purchasePrice = item.appraisedPrice || item.basePrice;
    const profitRate = (currentPrice - purchasePrice) / purchasePrice;
    
    if (strategy.autoSell) {
        if (strategy.autoSell.profit && profitRate >= strategy.autoSell.profit) {
            return { action: 'sell', reason: `목표 수익률 ${strategy.autoSell.profit * 100}% 달성` };
        }
        if (strategy.autoSell.loss && profitRate <= strategy.autoSell.loss) {
            return { action: 'sell', reason: `손절선 ${strategy.autoSell.loss * 100}% 도달` };
        }
    }
    
    if (strategy.autoBuy && strategy.autoBuy.drop && profitRate <= strategy.autoBuy.drop) {
        return { action: 'buy', reason: `물타기 시점 ${strategy.autoBuy.drop * 100}% 도달` };
    }
    
    return null;
}

module.exports = {
    APPRAISAL_STOCK,
    canCreateCertificate,
    generatePrediction,
    checkAutoTrade
};