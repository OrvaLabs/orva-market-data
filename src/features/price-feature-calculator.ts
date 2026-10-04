import { Candle } from '../domain/candle.js';
import { PriceFeatures, SymbolSpec } from './price-features.js';

export class PriceFeatureCalculator {
  private readonly pipSize: number;

  constructor(spec: SymbolSpec) {
    this.pipSize = spec.pipSize;
  }

  calculate(candle: Candle, previousClose?: number): PriceFeatures {
    return {
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      timestamp: candle.startTime,
      featureSetVersion: 'price-v1',
      price: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        change: this.calculatePriceChange(candle),
        changePercent: this.calculatePriceChangePercent(candle),
      },
      candle: {
        direction: this.calculateDirection(candle),
        range: this.calculateRange(candle),
        rangePips: this.calculateRange(candle) / this.pipSize,
        body: this.calculateBody(candle),
        bodyPips: this.calculateBody(candle) / this.pipSize,
        bodyPercent: this.calculateBodyPercent(candle),
        upperWick: this.calculateUpperWick(candle),
        upperWickPips: this.calculateUpperWick(candle) / this.pipSize,
        lowerWick: this.calculateLowerWick(candle),
        lowerWickPips: this.calculateLowerWick(candle) / this.pipSize,
        closePosition: this.calculateClosePosition(candle),
      },
      gap: previousClose !== undefined ? this.calculateGap(candle, previousClose) : null,
    };
  }

  calculateRange(candle: Candle): number {
    return candle.high - candle.low;
  }

  calculateBody(candle: Candle): number {
    return Math.abs(candle.close - candle.open);
  }

  calculateBodyPercent(candle: Candle): number | null {
    const range = this.calculateRange(candle);
    if (range === 0) return null;
    return (this.calculateBody(candle) / range) * 100;
  }

  calculateDirection(candle: Candle): 'bullish' | 'bearish' | 'neutral' {
    if (candle.close > candle.open) return 'bullish';
    if (candle.close < candle.open) return 'bearish';
    return 'neutral';
  }

  calculateUpperWick(candle: Candle): number {
    return candle.high - Math.max(candle.open, candle.close);
  }

  calculateLowerWick(candle: Candle): number {
    return Math.min(candle.open, candle.close) - candle.low;
  }

  calculateClosePosition(candle: Candle): number | null {
    const range = this.calculateRange(candle);
    if (range === 0) return null;
    return (candle.close - candle.low) / range;
  }

  calculatePriceChange(candle: Candle): number {
    return candle.close - candle.open;
  }

  calculatePriceChangePercent(candle: Candle): number {
    return ((candle.close - candle.open) / candle.open) * 100;
  }

  calculateGap(candle: Candle, previousClose: number): { value: number; percent: number } {
    return {
      value: candle.open - previousClose,
      percent: ((candle.open - previousClose) / previousClose) * 100,
    };
  }
}
