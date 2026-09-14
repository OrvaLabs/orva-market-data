import { MarketDataService } from './market-data.service.js';

describe('MarketDataService', () => {
  it('keeps the latest tick by symbol and candle by symbol/timeframe', () => {
    const service = new MarketDataService();
    const base = { version: 1 as const, timestamp: 1, symbol: 'EURUSD', timeframe: 'M1' as const };
    const tick = { ...base, type: 'TICK' as const, messageId: 't', tick: { time: 1, timeMsc: 1, bid: 1, ask: 1, last: 1, volume: 1, volumeReal: 1, flags: 0 }, spread: 0 };
    const candle = { ...base, type: 'CANDLE' as const, messageId: 'c', candle: { time: 1, open: 1, high: 2, low: 1, close: 1, tickVolume: 1, realVolume: 0, spread: 0 } };
    service.update(tick); service.update(candle);
    expect(service.getLatestTick('EURUSD')).toBe(tick);
    expect(service.getLatestCandle('EURUSD', 'M1')).toBe(candle);
  });
});
