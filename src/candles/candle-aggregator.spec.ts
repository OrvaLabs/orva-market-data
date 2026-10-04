import { describe, it, expect } from 'vitest';
import { CandleAggregator } from './candle-aggregator.js';
import { CanonicalTick } from '../domain/tick.js';

let seq = 0;

function tick(
  symbol: string,
  ts: number,
  mid: number,
  spread = 0.0001,
  idOverride?: string,
): CanonicalTick {
  seq++;
  return {
    type: 'tick',
    version: 1,
    messageId: idOverride ?? `${symbol}-${ts}-${seq}`,
    timestamp: ts,
    symbol,
    price: { bid: mid - spread / 2, ask: mid + spread / 2, last: mid, mid },
    spread: { absolute: spread, pips: spread / 0.0001 },
    volume: { tick: 1, real: 0.5 },
    source: { provider: 'MT5', brokerTime: Math.floor(ts / 1000) },
  };
}

describe('CandleAggregator — M1', () => {
  it('opens a forming candle on the first tick', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    const { closed, rejectedReason } = agg.addTick(tick('EURUSD', 60_001, 1.1));
    expect(rejectedReason).toBeUndefined();
    expect(closed).toHaveLength(0);
    expect(agg.getCurrent()?.open).toBeCloseTo(1.1);
    expect(agg.getCurrent()?.state).toBe('FORMING');
  });

  it('updates high/low/close on subsequent ticks in the same bucket', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1000));
    agg.addTick(tick('EURUSD', 60_300, 1.1010));
    agg.addTick(tick('EURUSD', 60_700, 1.0995));

    const c = agg.getCurrent()!;
    expect(c.open).toBeCloseTo(1.1000);
    expect(c.high).toBeCloseTo(1.1010);
    expect(c.low).toBeCloseTo(1.0995);
    expect(c.close).toBeCloseTo(1.0995);
    expect(c.tickVolume).toBe(3);
    expect(c.realVolume).toBeCloseTo(1.5);
  });

  it('closes a candle and opens a new one on bucket rollover', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    const { closed } = agg.addTick(tick('EURUSD', 120_001, 1.2));

    expect(closed).toHaveLength(1);
    expect(closed[0].startTime).toBe(60_000);
    expect(closed[0].endTime).toBe(120_000);
    expect(closed[0].state).toBe('CLOSED');
    expect(closed[0].closedAt).toBeDefined();
    expect(agg.getCurrent()!.startTime).toBe(120_000);
    expect(agg.getCurrent()!.open).toBeCloseTo(1.2);
  });

  it('rejects a duplicate messageId', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    const t = tick('EURUSD', 60_001, 1.1);
    agg.addTick(t);
    const result = agg.addTick(t);

    expect(result.rejectedReason).toBe('DUPLICATE');
    expect(agg.getCurrent()!.tickVolume).toBe(1);
  });

  it('rejects an out-of-order tick targeting a closed bucket', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    agg.addTick(tick('EURUSD', 120_001, 1.2));

    const result = agg.addTick(tick('EURUSD', 60_999, 9.9999));
    expect(result.rejectedReason).toBe('OUT_OF_ORDER');
    expect(agg.getCurrent()!.open).toBeCloseTo(1.2);
  });

  it('detects missing buckets between non-adjacent ticks', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    const { missingBuckets } = agg.addTick(tick('EURUSD', 300_001, 1.2));

    expect(missingBuckets).toEqual([120_000, 180_000, 240_000]);
  });

  it('does not report gaps when buckets are adjacent', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    const { missingBuckets } = agg.addTick(tick('EURUSD', 120_001, 1.2));
    expect(missingBuckets).toHaveLength(0);
  });

  it('closeIfExpired does nothing before bucket end', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    expect(agg.closeIfExpired(60_001)).toBeNull();
    expect(agg.getCurrent()).toBeDefined();
  });

  it('closeIfExpired closes a candle after bucket end', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    const result = agg.closeIfExpired(120_001);
    expect(result).not.toBeNull();
    expect(result!.state).toBe('CLOSED');
    expect(agg.getCurrent()).toBeUndefined();
  });

  it('tracks spread OHLC and rolling average correctly', () => {
    const agg = new CandleAggregator('EURUSD', 'M1');
    agg.addTick(tick('EURUSD', 60_001, 1.1, 0.0001));
    agg.addTick(tick('EURUSD', 60_200, 1.1, 0.0005));
    agg.addTick(tick('EURUSD', 60_400, 1.1, 0.0002));

    const c = agg.getCurrent()!;
    expect(c.spreadOpen).toBeCloseTo(0.0001);
    expect(c.spreadHigh).toBeCloseTo(0.0005);
    expect(c.spreadLow).toBeCloseTo(0.0001);
    expect(c.spreadClose).toBeCloseTo(0.0002);
    expect(c.spreadAverage).toBeCloseTo((0.0001 + 0.0005 + 0.0002) / 3, 6);
  });

  it('returns undefined from getCurrent() before any ticks', () => {
    expect(new CandleAggregator('EURUSD', 'M1').getCurrent()).toBeUndefined();
  });
});

describe('CandleAggregator — M5', () => {
  it('uses the correct M5 bucket boundaries', () => {
    const agg = new CandleAggregator('EURUSD', 'M5');
    agg.addTick(tick('EURUSD', 60_001, 1.1));
    const c = agg.getCurrent()!;
    expect(c.startTime).toBe(0);
    expect(c.endTime).toBe(300_000);
  });

  it('aggregates ticks across multiple M1 buckets into one M5 bucket', () => {
    const agg = new CandleAggregator('EURUSD', 'M5');
    agg.addTick(tick('EURUSD', 60_001, 1.1000));
    agg.addTick(tick('EURUSD', 120_001, 1.1010));
    agg.addTick(tick('EURUSD', 240_001, 1.0990));
    const { closed } = agg.addTick(tick('EURUSD', 300_001, 1.1005));

    expect(closed).toHaveLength(1);
    expect(closed[0].open).toBeCloseTo(1.1000);
    expect(closed[0].high).toBeCloseTo(1.1010);
    expect(closed[0].low).toBeCloseTo(1.0990);
    expect(closed[0].close).toBeCloseTo(1.0990);
    expect(closed[0].tickVolume).toBe(3);
  });
});
