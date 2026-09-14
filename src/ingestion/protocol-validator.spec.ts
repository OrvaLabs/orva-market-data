import { Mt5ProtocolValidator } from './protocol-validator.js';

describe('Mt5ProtocolValidator', () => {
  const validator = new Mt5ProtocolValidator();
  const tick = {
    type: 'TICK', version: 1, messageId: '1', timestamp: Date.now(), symbol: 'EURUSD', timeframe: 'M1',
    tick: { time: 1, timeMsc: 2, bid: 1.1, ask: 1.2, last: 1.15, volume: 1, volumeReal: 1, flags: 6 }, spread: 0.1,
  };
  it('accepts a valid tick and rejects non-finite prices', () => {
    expect(validator.validate(tick).valid).toBe(true);
    expect(validator.validate({ ...tick, tick: { ...tick.tick, bid: Number.NaN } }).valid).toBe(false);
  });
  it('validates candle OHLC consistency and timeframes', () => {
    const candle = { type: 'CANDLE', version: 1, messageId: '2', timestamp: Date.now(), symbol: 'EURUSD', timeframe: 'H1',
      candle: { time: 1, open: 2, high: 3, low: 1, close: 2.5, tickVolume: 1, realVolume: 0, spread: 1 } };
    expect(validator.validate(candle).valid).toBe(true);
    expect(validator.validate({ ...candle, timeframe: 'BAD' }).valid).toBe(false);
    expect(validator.validate({ ...candle, candle: { ...candle.candle, low: 2.6 } }).valid).toBe(false);
  });
});
