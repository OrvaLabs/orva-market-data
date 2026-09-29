export interface OneMinuteCandle {
  type: 'candle';
  version: 1;
  symbol: string;
  timeframe: 'M1';
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
  realVolume: number;
  spread: number;
  closed: boolean;
}
