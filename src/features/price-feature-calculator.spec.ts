import { describe, it, expect } from 'vitest';
import { PriceFeatureCalculator } from './price-feature-calculator.js';
import { Candle } from '../domain/candle.js';

const EURUSD_SPEC = { pipSize: 0.0001 };

function makeCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    type: 'candle',
    version: 1,
    symbol: 'EURUSD',
    timeframe: 'M1',
    startTime: 1726860060000,
    endTime: 1726860120000,
    open: 1.1,
    high: 1.1008,
    low: 1.0996,
    close: 1.1005,
    tickVolume: 100,
    realVolume: 0,
    spreadOpen: 0.0001,
    spreadHigh: 0.0002,
    spreadLow: 0.0001,
    spreadClose: 0.0001,
    spreadAverage: 0.00015,
    tickCount: 50,
    state: 'CLOSED',
    closedAt: 1726860120000,
    ...overrides,
  };
}

describe('PriceFeatureCalculator', () => {
  const calc = new PriceFeatureCalculator(EURUSD_SPEC);

  describe('calculateRange', () => {
    it('returns high minus low', () => {
      const candle = makeCandle();
      expect(calc.calculateRange(candle)).toBeCloseTo(0.0012);
    });

    it('returns 0 for a doji with equal high and low', () => {
      const candle = makeCandle({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 });
      expect(calc.calculateRange(candle)).toBe(0);
    });
  });

  describe('calculateBody', () => {
    it('returns absolute difference between close and open', () => {
      expect(calc.calculateBody(makeCandle())).toBeCloseTo(0.0005);
    });

    it('is positive for a bearish candle', () => {
      const candle = makeCandle({ open: 1.1005, close: 1.1 });
      expect(calc.calculateBody(candle)).toBeCloseTo(0.0005);
    });
  });

  describe('calculateBodyPercent', () => {
    it('returns body as a percentage of range', () => {
      expect(calc.calculateBodyPercent(makeCandle())).toBeCloseTo(41.67, 1);
    });

    it('returns null when range is zero', () => {
      const candle = makeCandle({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 });
      expect(calc.calculateBodyPercent(candle)).toBeNull();
    });
  });

  describe('calculateDirection', () => {
    it('returns bullish when close > open', () => {
      expect(calc.calculateDirection(makeCandle())).toBe('bullish');
    });

    it('returns bearish when close < open', () => {
      const candle = makeCandle({ open: 1.1005, close: 1.1 });
      expect(calc.calculateDirection(candle)).toBe('bearish');
    });

    it('returns neutral when close === open', () => {
      const candle = makeCandle({ open: 1.1, close: 1.1 });
      expect(calc.calculateDirection(candle)).toBe('neutral');
    });
  });

  describe('calculateUpperWick', () => {
    it('returns high minus max(open, close)', () => {
      expect(calc.calculateUpperWick(makeCandle())).toBeCloseTo(0.0003);
    });
  });

  describe('calculateLowerWick', () => {
    it('returns min(open, close) minus low', () => {
      expect(calc.calculateLowerWick(makeCandle())).toBeCloseTo(0.0004);
    });
  });

  describe('calculateClosePosition', () => {
    it('returns normalized position of close within range', () => {
      expect(calc.calculateClosePosition(makeCandle())).toBeCloseTo(0.75);
    });

    it('returns 0 when close equals low', () => {
      const candle = makeCandle({ close: 1.0996 });
      expect(calc.calculateClosePosition(candle)).toBeCloseTo(0);
    });

    it('returns 1 when close equals high', () => {
      const candle = makeCandle({ close: 1.1008 });
      expect(calc.calculateClosePosition(candle)).toBeCloseTo(1);
    });

    it('returns null when range is zero', () => {
      const candle = makeCandle({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 });
      expect(calc.calculateClosePosition(candle)).toBeNull();
    });
  });

  describe('calculatePriceChange', () => {
    it('returns signed close minus open', () => {
      expect(calc.calculatePriceChange(makeCandle())).toBeCloseTo(0.0005);
    });

    it('is negative for a bearish candle', () => {
      const candle = makeCandle({ open: 1.1005, close: 1.1 });
      expect(calc.calculatePriceChange(candle)).toBeCloseTo(-0.0005);
    });
  });

  describe('calculatePriceChangePercent', () => {
    it('returns percentage change from open to close', () => {
      expect(calc.calculatePriceChangePercent(makeCandle())).toBeCloseTo(0.04545, 4);
    });
  });

  describe('calculateGap', () => {
    it('returns gap value and percent relative to previous close', () => {
      const gap = calc.calculateGap(makeCandle(), 1.0998);
      expect(gap.value).toBeCloseTo(0.0002);
      expect(gap.percent).toBeCloseTo(0.01818, 4);
    });

    it('returns negative gap for a downward gap', () => {
      const gap = calc.calculateGap(makeCandle({ open: 1.0995 }), 1.1);
      expect(gap.value).toBeCloseTo(-0.0005);
    });
  });

  describe('calculate (full snapshot)', () => {
    it('produces a complete PriceFeatures snapshot', () => {
      const candle = makeCandle();
      const features = calc.calculate(candle, 1.0998);

      expect(features.featureSetVersion).toBe('price-v1');
      expect(features.symbol).toBe('EURUSD');
      expect(features.timeframe).toBe('M1');
      expect(features.timestamp).toBe(1726860060000);

      expect(features.price.open).toBe(1.1);
      expect(features.price.close).toBe(1.1005);

      expect(features.candle.direction).toBe('bullish');
      expect(features.candle.rangePips).toBeCloseTo(12);
      expect(features.candle.bodyPips).toBeCloseTo(5);
      expect(features.candle.upperWickPips).toBeCloseTo(3);
      expect(features.candle.lowerWickPips).toBeCloseTo(4);

      expect(features.gap).not.toBeNull();
      expect(features.gap!.value).toBeCloseTo(0.0002);
    });

    it('sets gap to null when no previous close provided', () => {
      const features = calc.calculate(makeCandle());
      expect(features.gap).toBeNull();
    });

    it('sets bodyPercent and closePosition to null for a doji', () => {
      const candle = makeCandle({ open: 1.1, high: 1.1, low: 1.1, close: 1.1 });
      const features = calc.calculate(candle);
      expect(features.candle.bodyPercent).toBeNull();
      expect(features.candle.closePosition).toBeNull();
    });
  });
});
