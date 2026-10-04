export const CANDLE_TIMEFRAMES = ['M1', 'M5', 'M15', 'H1'] as const;
export type CandleTimeframe = (typeof CANDLE_TIMEFRAMES)[number];

export type CandleState = 'FORMING' | 'CLOSED';

export interface Candle {
  type: 'candle';
  version: 1;

  symbol: string;
  timeframe: CandleTimeframe;

  startTime: number;
  endTime: number;

  open: number;
  high: number;
  low: number;
  close: number;

  tickVolume: number;
  realVolume: number;

  spreadOpen: number;
  spreadHigh: number;
  spreadLow: number;
  spreadClose: number;
  spreadAverage: number;

  tickCount: number;

  state: CandleState;
  closedAt?: number;
}
