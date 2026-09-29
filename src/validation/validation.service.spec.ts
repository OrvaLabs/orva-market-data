import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from './validation.service.js';
import { CanonicalTick } from '../domain/tick.js';

function makeTick(overrides: Partial<CanonicalTick> = {}): CanonicalTick {
  return {
    type: 'tick',
    version: 1,
    messageId: 'EURUSD-1726860000123',
    timestamp: Date.now(),
    symbol: 'EURUSD',
    price: { bid: 1.10000, ask: 1.10013, last: 1.10006, mid: 1.100065 },
    spread: { absolute: 0.00013, pips: 1.3 },
    volume: { tick: 12, real: 12.0 },
    source: { provider: 'MT5', brokerTime: 1726860000 },
    ...overrides,
  };
}

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(() => {
    service = new ValidationService();
  });

  it('accepts a valid canonical tick', () => {
    const result = service.validate(makeTick());
    expect(result.valid).toBe(true);
  });

  it('rejects a tick with timestamp too far in the future', () => {
    const result = service.validate(makeTick({ timestamp: Date.now() + 10_000 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('FUTURE_TICK');
  });

  it('rejects a stale tick older than 60 seconds', () => {
    const result = service.validate(makeTick({ timestamp: Date.now() - 70_000 }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('STALE');
  });

  it('rejects a tick with bid <= 0', () => {
    const result = service.validate(makeTick({ price: { bid: 0, ask: 1.1001, last: 1.1001, mid: 0.55005 } }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('INVALID_PRICE');
  });

  it('rejects a tick with ask < bid (inverted price)', () => {
    const result = service.validate(
      makeTick({ price: { bid: 1.10020, ask: 1.10010, last: 1.10015, mid: 1.10015 } }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('INVALID_PRICE');
  });

  it('rejects a tick with spread exceeding 500 pips', () => {
    const result = service.validate(
      makeTick({ spread: { absolute: 0.1, pips: 1000 } }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('SPREAD_TOO_WIDE');
  });

  it('rejects a tick with a price jump > 5% vs the prior tick', () => {
    service.validate(makeTick({ price: { bid: 1.10000, ask: 1.10013, last: 1.10006, mid: 1.100065 } }));
    
    const jumped = makeTick({
      price: { bid: 1.21000, ask: 1.21013, last: 1.21006, mid: 1.210065 },
    });
    const result = service.validate(jumped);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('GAP');
  });

  it('accepts consecutive ticks with a small price change', () => {
    service.validate(makeTick());
    const second = makeTick({
      messageId: 'EURUSD-1726860001000',
      timestamp: Date.now(),
      price: { bid: 1.10005, ask: 1.10018, last: 1.10011, mid: 1.100115 },
    });
    const result = service.validate(second);
    expect(result.valid).toBe(true);
  });
});
