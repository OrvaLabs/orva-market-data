import { describe, it, expect } from 'vitest';
import { NormalizationService } from './normalization.service.js';
import { TickMessage } from '../ingestion/protocol.js';

const sampleTick: TickMessage = {
  type: 'TICK',
  version: 1,
  messageId: 'unique-id',
  timestamp: 1726860000000,
  symbol: 'EURUSD',
  timeframe: 'M1',
  tick: {
    time: 1726860000,
    timeMsc: 1726860000123,
    bid: 1.10000,
    ask: 1.10013,
    last: 1.10006,
    volume: 12,
    volumeReal: 12.0,
    flags: 6,
  },
  spread: 0.00013,
};

describe('NormalizationService', () => {
  const service = new NormalizationService();

  it('produces a canonical tick with correct type and version', () => {
    const result = service.normalize(sampleTick);
    expect(result.type).toBe('tick');
    expect(result.version).toBe(1);
  });

  it('uses timeMsc as the canonical timestamp', () => {
    const result = service.normalize(sampleTick);
    expect(result.timestamp).toBe(1726860000123);
  });

  it('builds messageId as "<symbol>-<timeMsc>"', () => {
    const result = service.normalize(sampleTick);
    expect(result.messageId).toBe('EURUSD-1726860000123');
  });

  it('calculates mid price correctly', () => {
    const result = service.normalize(sampleTick);
    expect(result.price.mid).toBeCloseTo((1.10000 + 1.10013) / 2, 8);
  });

  it('calculates absolute spread correctly', () => {
    const result = service.normalize(sampleTick);
    expect(result.spread.absolute).toBeCloseTo(0.00013, 8);
  });

  it('calculates pip spread correctly for EURUSD (pipSize=0.0001)', () => {
    const result = service.normalize(sampleTick);
    expect(result.spread.pips).toBeCloseTo(1.3, 4);
  });

  it('maps volume correctly', () => {
    const result = service.normalize(sampleTick);
    expect(result.volume.tick).toBe(12);
    expect(result.volume.real).toBe(12.0);
  });

  it('preserves broker time in source', () => {
    const result = service.normalize(sampleTick);
    expect(result.source.provider).toBe('MT5');
    expect(result.source.brokerTime).toBe(1726860000);
  });

  it('does NOT include timeframe on canonical tick', () => {
    const result = service.normalize(sampleTick);
    expect(result).not.toHaveProperty('timeframe');
  });
});
