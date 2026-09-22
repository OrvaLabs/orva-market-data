import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from './storage.service.js';
import { CanonicalTick } from '../domain/tick.js';

function makeTick(symbol: string, timestamp: number): CanonicalTick {
  return {
    type: 'tick',
    version: 1,
    messageId: `${symbol}-${timestamp}`,
    timestamp,
    symbol,
    price: { bid: 1.1, ask: 1.1001, last: 1.10005, mid: 1.10005 },
    spread: { absolute: 0.0001, pips: 1.0 },
    volume: { tick: 1, real: 1.0 },
    source: { provider: 'MT5', brokerTime: Math.floor(timestamp / 1000) },
  };
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService(); 
  });

  it('returns undefined for unknown symbol', () => {
    expect(service.getLatest('EURUSD')).toBeUndefined();
  });

  it('stores and retrieves the latest tick', () => {
    const tick = makeTick('EURUSD', 1000);
    service.store(tick);
    expect(service.getLatest('EURUSD')).toBe(tick);
  });

  it('overwrites the latest on each store', () => {
    service.store(makeTick('EURUSD', 1000));
    const latest = makeTick('EURUSD', 2000);
    service.store(latest);
    expect(service.getLatest('EURUSD')).toBe(latest);
  });

  it('returns recent ticks newest-first', () => {
    service.store(makeTick('EURUSD', 1000));
    service.store(makeTick('EURUSD', 2000));
    service.store(makeTick('EURUSD', 3000));
    const recent = service.getRecent('EURUSD', 2);
    expect(recent[0].timestamp).toBe(3000);
    expect(recent[1].timestamp).toBe(2000);
  });

  it('isolates ticks by symbol', () => {
    service.store(makeTick('EURUSD', 1000));
    service.store(makeTick('GBPUSD', 2000));
    expect(service.getLatest('EURUSD')!.symbol).toBe('EURUSD');
    expect(service.getLatest('GBPUSD')!.symbol).toBe('GBPUSD');
  });

  it('wraps around when ring is full', () => {
    const RING = 10_000;
    for (let i = 0; i <= RING; i++) {
      service.store(makeTick('EURUSD', i * 1000));
    }
    expect(service.getCount('EURUSD')).toBe(RING);
    const latest = service.getLatest('EURUSD');
    expect(latest?.timestamp).toBe(RING * 1000);
  });

  it('returns empty array for unknown symbol in getRecent', () => {
    expect(service.getRecent('GBPJPY', 10)).toEqual([]);
  });

  it('tracks all symbols', () => {
    service.store(makeTick('EURUSD', 1000));
    service.store(makeTick('GBPUSD', 1000));
    expect(service.getSymbols()).toContain('EURUSD');
    expect(service.getSymbols()).toContain('GBPUSD');
  });
});
