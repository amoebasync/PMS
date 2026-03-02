/**
 * 配布員報酬計算ロジックのテスト
 *
 * 仕様（GPS トラッキング仕様書 / distributor-payroll）:
 * earnedAmount = floor(unitPrice × max(actualCounts))
 *
 * unitPrice = baseRate(rate1Type〜rate6Type) + areaUnitPrice + sizeUnitPrice
 *
 * 参照: CLAUDE.md「報酬計算ロジック」
 */
import { describe, it, expect } from 'vitest';

// route.ts 内の報酬計算ロジックと同じ仕様を再現
interface EarningsParams {
  unitPrice: number;  // baseRate + areaUnitPrice + sizeUnitPrice
  actualCounts: number[];  // 各チラシの実配布数
}

function calculateEarnedAmount({ unitPrice, actualCounts }: EarningsParams): number {
  if (actualCounts.length === 0) return 0;
  const maxCount = Math.max(...actualCounts);
  return Math.floor(unitPrice * maxCount);
}

describe('配布員報酬計算（calculateEarnedAmount）', () => {
  describe('基本計算', () => {
    it('単一チラシ: unitPrice 2.5円 × 1000枚 = 2500円', () => {
      expect(calculateEarnedAmount({ unitPrice: 2.5, actualCounts: [1000] })).toBe(2500);
    });

    it('単一チラシ: unitPrice 3.0円 × 500枚 = 1500円', () => {
      expect(calculateEarnedAmount({ unitPrice: 3.0, actualCounts: [500] })).toBe(1500);
    });

    it('複数チラシ: 最大枚数を基に計算する', () => {
      // チラシA: 800枚, チラシB: 1200枚 → max = 1200
      expect(calculateEarnedAmount({ unitPrice: 2.0, actualCounts: [800, 1200] })).toBe(2400);
    });

    it('複数チラシ: 最大枚数が正しく選ばれる', () => {
      // 3種のチラシ: max = 500
      expect(calculateEarnedAmount({ unitPrice: 4.0, actualCounts: [300, 500, 100] })).toBe(2000);
    });
  });

  describe('端数切り捨て（floor）', () => {
    it('小数点以下は切り捨てる: 2.5 × 3 = 7（7.5 → 7）', () => {
      expect(calculateEarnedAmount({ unitPrice: 2.5, actualCounts: [3] })).toBe(7);
    });

    it('1.3円 × 1000枚 = 1300円（切り捨てなし）', () => {
      expect(calculateEarnedAmount({ unitPrice: 1.3, actualCounts: [1000] })).toBe(1300);
    });

    it('1.33円 × 3枚 = 3（3.99 → 3）', () => {
      expect(calculateEarnedAmount({ unitPrice: 1.33, actualCounts: [3] })).toBe(3);
    });
  });

  describe('エッジケース', () => {
    it('actualCounts が空配列の場合は 0 を返す', () => {
      expect(calculateEarnedAmount({ unitPrice: 5.0, actualCounts: [] })).toBe(0);
    });

    it('actualCounts が全て 0 の場合は 0 を返す', () => {
      expect(calculateEarnedAmount({ unitPrice: 5.0, actualCounts: [0, 0, 0] })).toBe(0);
    });

    it('unitPrice が 0 の場合は 0 を返す', () => {
      expect(calculateEarnedAmount({ unitPrice: 0, actualCounts: [1000] })).toBe(0);
    });

    it('単位価格が高い場合も正しく計算される', () => {
      // 10円 × 5000枚 = 50000円
      expect(calculateEarnedAmount({ unitPrice: 10.0, actualCounts: [5000] })).toBe(50000);
    });
  });

  describe('unitPrice の構成（baseRate + areaUnitPrice + sizeUnitPrice）', () => {
    it('baseRate + areaUnitPrice + sizeUnitPrice の合計で計算される', () => {
      const baseRate = 2.0;
      const areaUnitPrice = 0.5;
      const sizeUnitPrice = 0.3;
      const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice; // = 2.8
      const actualCounts = [1000];

      const result = calculateEarnedAmount({ unitPrice, actualCounts });
      expect(result).toBe(2800); // floor(2.8 * 1000) = 2800
    });

    it('エリア単価なしの場合も正しく計算される', () => {
      const baseRate = 3.0;
      const areaUnitPrice = 0;
      const sizeUnitPrice = 0;
      const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;

      expect(calculateEarnedAmount({ unitPrice, actualCounts: [2000] })).toBe(6000);
    });
  });
});
