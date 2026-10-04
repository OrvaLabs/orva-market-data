import { Candle } from '../domain/candle.js';

export interface SymbolSpec {
  pipSize: number;
}

export interface PriceFeatures {
  symbol: string;
  timeframe: string;
  timestamp: number;
  featureSetVersion: 'price-v1';

  price: {
    open: number;
    high: number;
    low: number;
    close: number;
    change: number;
    changePercent: number;
  };

  candle: {
    direction: 'bullish' | 'bearish' | 'neutral';
    range: number;
    rangePips: number;
    body: number;
    bodyPips: number;
    bodyPercent: number | null;
    upperWick: number;
    upperWickPips: number;
    lowerWick: number;
    lowerWickPips: number;
    closePosition: number | null;
  };

  gap: {
    value: number;
    percent: number;
  } | null;
}
