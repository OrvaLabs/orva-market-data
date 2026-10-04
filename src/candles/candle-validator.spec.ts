import { describe, it, expect } from 'vitest';
import { validateCandle } from './candle-validator.js';
import { Candle } from '../domain/candle.js';

function makeValidCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    type: 'candle',
    version: 1,
    symbol: 'EURUSD',
    timeframe: 'M1',
    startTime: 60_000,
    endTime: 120_000,
    open: 1.1000,
    high: 1.1010,
    low: 1.0990,
    close: 1.1005,
    tickVolume: 10,
    realVolume: 5,
    spreadOpen: 0.0001,
    spreadHigh: 0.0003,
    spreadLow: 0.0001,
    spreadClose: 0.0002,
    spreadAverage: 0.0002,
    tickCount: 10,
    state: 'CLOSED',
    closedAt: 120_001,
    ...overrides,
  };
}

describe('validateCandle', () => {
  it('passes a valid candle', () => {
    expect(validateCandle(makeValidCandle()).valid).toBe(true);
  });

  it('fails when high < open', () => {
    const result = validateCandle(makeValidCandle({ high: 1.0999, open: 1.1000 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('HIGH_BELOW_OPEN');
  });

  it('fails when high < close', () => {
    const result = validateCandle(makeValidCandle({ high: 1.0999, close: 1.1005 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('HIGH_BELOW_CLOSE');
  });

  it('fails when low > open', () => {
    const result = validateCandle(makeValidCandle({ low: 1.1050, open: 1.1000 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('LOW_ABOVE_OPEN');
  });

  it('fails when low > close', () => {
    const result = validateCandle(makeValidCandle({ low: 1.1050, close: 1.1005 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('LOW_ABOVE_CLOSE');
  });

  it('fails when high < low', () => {
    const result = validateCandle(makeValidCandle({ high: 1.0990, low: 1.1000 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('HIGH_BELOW_LOW');
  });

  it('fails when tickVolume is negative', () => {
    const result = validateCandle(makeValidCandle({ tickVolume: -1 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('NEGATIVE_TICK_VOLUME');
  });

  it('fails when realVolume is negative', () => {
    const result = validateCandle(makeValidCandle({ realVolume: -0.5 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('NEGATIVE_REAL_VOLUME');
  });

  it('fails when startTime is negative', () => {
    const result = validateCandle(makeValidCandle({ startTime: -1 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('INVALID_TIMESTAMP');
  });

  it('accepts startTime of 0 (epoch midnight UTC)', () => {
    const result = validateCandle(makeValidCandle({ startTime: 0 }));
    expect(result.valid).toBe(true);
  });

  it('fails when symbol is empty', () => {
    const result = validateCandle(makeValidCandle({ symbol: '' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('INVALID_SYMBOL');
  });

  it('fails when a spread value is negative', () => {
    const result = validateCandle(makeValidCandle({ spreadOpen: -0.0001 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain('INVALID_SPREAD');
  });

  it('collects multiple errors in one pass', () => {
    const result = validateCandle(
      makeValidCandle({ symbol: '', tickVolume: -1, high: 0.9, low: 1.2 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.length).toBeGreaterThan(1);
  });
});
