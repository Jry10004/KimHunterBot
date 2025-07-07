// 강화 시스템 설정

const ENHANCEMENT_RATES = {
    0: { success: 95, fail: 5, destroy: 0 },
    1: { success: 90, fail: 10, destroy: 0 },
    2: { success: 85, fail: 15, destroy: 0 },
    3: { success: 85, fail: 15, destroy: 0 },
    4: { success: 80, fail: 20, destroy: 0 },
    5: { success: 75, fail: 25, destroy: 0 },
    6: { success: 70, fail: 30, destroy: 0 },
    7: { success: 65, fail: 35, destroy: 0 },
    8: { success: 60, fail: 40, destroy: 0 },
    9: { success: 55, fail: 45, destroy: 0 },
    10: { success: 50, fail: 50, destroy: 0 },
    11: { success: 45, fail: 55, destroy: 0 },
    12: { success: 40, fail: 60, destroy: 0 },
    13: { success: 35, fail: 65, destroy: 0 },
    14: { success: 30, fail: 70, destroy: 0 },
    15: { success: 30, fail: 67.9, destroy: 2.1 },
    16: { success: 30, fail: 67.9, destroy: 2.1 },
    17: { success: 15, fail: 78.2, destroy: 6.8 },
    18: { success: 15, fail: 78.2, destroy: 6.8 },
    19: { success: 15, fail: 76.5, destroy: 8.5 },
    20: { success: 30, fail: 59.5, destroy: 10.5 },
    21: { success: 15, fail: 72.25, destroy: 12.75 },
    22: { success: 15, fail: 68, destroy: 17 },
    23: { success: 10, fail: 72, destroy: 18 },
    24: { success: 10, fail: 72, destroy: 18 },
    25: { success: 10, fail: 72, destroy: 18 },
    26: { success: 7, fail: 74.4, destroy: 18.6 },
    27: { success: 5, fail: 76, destroy: 19 },
    28: { success: 3, fail: 77.6, destroy: 19.4 },
    29: { success: 1, fail: 79.2, destroy: 19.8 },
    30: { success: 0, fail: 0, destroy: 0 } // 30강은 최대
};

// 메이플스토리 정확한 강화 비용 계수표
const COST_COEFFICIENTS = {
    0: 36, 1: 36, 2: 36, 3: 36, 4: 36, 5: 36, 6: 36, 7: 36, 8: 36, 9: 36, 10: 36,
    11: 571, 12: 314, 13: 157, 14: 107, 15: 200, 16: 200, 17: 150, 18: 70, 19: 45,
    20: 200, 21: 125, 22: 200, 23: 200, 24: 200, 25: 200, 26: 200, 27: 200, 28: 200, 29: 200
};

module.exports = {
    ENHANCEMENT_RATES,
    COST_COEFFICIENTS
};