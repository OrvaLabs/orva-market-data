import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CandlesService, CandleGapEvent } from './candles.service.js';
import { CanonicalTick } from '../domain/tick.js';
import { CandleTimeframe } from '../domain/candle.js';

function makeTickPipelineStub() {
  let listener: ((tick: CanonicalTick) => void) | null = null;
  return {
    on: vi.fn((event: string, cb: (tick: CanonicalTick) => void) => {
      if (event === 'canonical.tick') listener = cb;
    }),
    emit: (tick: CanonicalTick) => listener?.(tick),
  };
}

function makePersistenceStub() {
  return {
    persist: vi.fn(),
    loadRecent: vi.fn().mockReturnValue([]),
    dataRoot: '',
    onModuleInit: vi.fn(),
    onModuleDestroy: vi.fn(),
  };
}

let msgSeq = 0;

function makeTick(
  symbol: string,
  timestampMs: number,
  mid: number,
  spread = 0.0001,
  idOverride?: string,
): CanonicalTick {
  msgSeq++;
  return {
    type: 'tick',
    version: 1,
    messageId: idOverride ?? `${symbol}-${timestampMs}-${msgSeq}`,
    timestamp: timestampMs,
    symbol,
    price: { bid: mid - spread / 2, ask: mid + spread / 2, last: mid, mid },
    spread: { absolute: spread, pips: spread / 0.0001 },
    volume: { tick: 1, real: 0.5 },
    source: { provider: 'MT5', brokerTime: Math.floor(timestampMs / 1000) },
  };
}

function makeService() {
  const pipelineStub = makeTickPipelineStub();
  const persistenceStub = makePersistenceStub();
  const service = new CandlesService(pipelineStub as never, persistenceStub as never);
  return { service, pipelineStub, persistenceStub };
}

describe('CandlesService', () => {
  let service: CandlesService;
  let persistenceStub: ReturnType<typeof makePersistenceStub>;

  beforeEach(() => {
    msgSeq = 0;
    vi.useFakeTimers();
    const s = makeService();
    service = s.service;
    persistenceStub = s.persistenceStub;
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    vi.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('aggregates OHLCV correctly within one M1 bucket', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1000));
    service.addTick(makeTick('EURUSD', 60_500, 1.1005));
    service.addTick(makeTick('EURUSD', 60_999, 1.0999));

    const forming = service.getCurrent('EURUSD', 'M1');
    expect(forming).toBeDefined();
    expect(forming!.open).toBeCloseTo(1.1000);
    expect(forming!.high).toBeCloseTo(1.1005);
    expect(forming!.low).toBeCloseTo(1.0999);
    expect(forming!.close).toBeCloseTo(1.0999);
    expect(forming!.tickVolume).toBe(3);
    expect(forming!.state).toBe('FORMING');
  });

  it('closes M1 candle on tick arriving in the next bucket', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 60_500, 1.1003));
    service.addTick(makeTick('EURUSD', 120_001, 1.1006));

    const closed = service.getRecent('EURUSD', 'M1', 1);
    expect(closed).toHaveLength(1);
    expect(closed[0].startTime).toBe(60_000);
    expect(closed[0].endTime).toBe(120_000);
    expect(closed[0].open).toBeCloseTo(1.1001);
    expect(closed[0].high).toBeCloseTo(1.1003);
    expect(closed[0].close).toBeCloseTo(1.1003);
    expect(closed[0].state).toBe('CLOSED');

    const forming = service.getCurrent('EURUSD', 'M1')!;
    expect(forming.startTime).toBe(120_000);
    expect(forming.open).toBeCloseTo(1.1006);
  });

  it('closes a stale forming candle via the finalization timer', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    expect(service.getRecent('EURUSD', 'M1', 10)).toHaveLength(0);

    vi.setSystemTime(130_000);
    vi.advanceTimersByTime(1_001);

    expect(service.getRecent('EURUSD', 'M1', 10)).toHaveLength(1);
    expect(service.getRecent('EURUSD', 'M1', 10)[0].state).toBe('CLOSED');
  });

  it('rejects a late tick targeting an already-closed bucket', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 120_001, 1.1006));

    const closedBefore = service.getRecent('EURUSD', 'M1', 1)[0].close;
    service.addTick(makeTick('EURUSD', 60_999, 9999.0));

    expect(service.getRecent('EURUSD', 'M1', 1)[0].close).toBe(closedBefore);
    expect(service.getRecent('EURUSD', 'M1', 10)).toHaveLength(1);
  });

  it('ignores a tick with a duplicate messageId', () => {
    const tick = makeTick('EURUSD', 60_001, 1.1001);
    service.addTick(tick);
    service.addTick(tick);

    expect(service.getCurrent('EURUSD', 'M1')!.tickVolume).toBe(1);
  });

  it('emits candle.gap when M1 buckets are skipped', () => {
    const gapEvents: CandleGapEvent[] = [];
    service.on('candle.gap', (e) => gapEvents.push(e));

    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 300_001, 1.1005));

    const m1Gap = gapEvents.find((e) => e.timeframe === 'M1');
    expect(m1Gap).toBeDefined();
    expect(m1Gap!.missingBucketStarts).toEqual([120_000, 180_000, 240_000]);
  });

  it('emits candle.closed with { symbol, timeframe, candle }', () => {
    const events: { symbol: string; timeframe: CandleTimeframe; candle: object }[] = [];
    service.on('candle.closed', (e) => events.push(e));

    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 120_001, 1.1005));

    const m1Event = events.find((e) => e.timeframe === 'M1');
    expect(m1Event).toBeDefined();
    expect(m1Event!.symbol).toBe('EURUSD');
    expect(m1Event!.candle).toBeDefined();
  });

  it('tracks spreadOpen, spreadHigh, spreadLow, spreadClose, spreadAverage', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1000, 0.0001));
    service.addTick(makeTick('EURUSD', 60_200, 1.1001, 0.0005));
    service.addTick(makeTick('EURUSD', 60_400, 1.1000, 0.0002));

    const c = service.getCurrent('EURUSD', 'M1')!;
    expect(c.spreadOpen).toBeCloseTo(0.0001);
    expect(c.spreadHigh).toBeCloseTo(0.0005);
    expect(c.spreadLow).toBeCloseTo(0.0001);
    expect(c.spreadClose).toBeCloseTo(0.0002);
    expect(c.spreadAverage).toBeCloseTo((0.0001 + 0.0005 + 0.0002) / 3, 6);
  });

  it('produces independent M1 and M5 candles from the same tick stream', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 120_001, 1.1002));
    service.addTick(makeTick('EURUSD', 180_001, 1.1003));
    service.addTick(makeTick('EURUSD', 300_001, 1.1010));

    const m1Closed = service.getRecent('EURUSD', 'M1', 10);
    const m5Closed = service.getRecent('EURUSD', 'M5', 10);

    expect(m1Closed).toHaveLength(3);
    expect(m5Closed).toHaveLength(1);
    expect(m5Closed[0].startTime).toBe(0);
    expect(m5Closed[0].endTime).toBe(300_000);
    expect(m5Closed[0].open).toBeCloseTo(1.1001);
    expect(m5Closed[0].close).toBeCloseTo(1.1003);
    expect(m5Closed[0].tickVolume).toBe(3);
  });

  it('maintains completely independent state per symbol', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1000));
    service.addTick(makeTick('GBPUSD', 60_001, 1.2500));
    service.addTick(makeTick('USDJPY', 60_001, 155.00));

    expect(service.getCurrent('EURUSD', 'M1')!.open).toBeCloseTo(1.1000);
    expect(service.getCurrent('GBPUSD', 'M1')!.open).toBeCloseTo(1.2500);
    expect(service.getCurrent('USDJPY', 'M1')!.open).toBeCloseTo(155.00);
  });

  it('produces correct UTC bucket startTime and endTime for M1', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1));
    const c = service.getCurrent('EURUSD', 'M1')!;
    expect(c.startTime).toBe(60_000);
    expect(c.endTime).toBe(120_000);
  });

  it('produces correct UTC bucket startTime and endTime for H1', () => {
    service.addTick(makeTick('EURUSD', 3_600_001, 1.1));
    const c = service.getCurrent('EURUSD', 'H1')!;
    expect(c.startTime).toBe(3_600_000);
    expect(c.endTime).toBe(7_200_000);
  });

  it('getRecent returns newest-first and respects the limit', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1));
    service.addTick(makeTick('EURUSD', 120_001, 1.2));
    service.addTick(makeTick('EURUSD', 180_001, 1.3));
    service.addTick(makeTick('EURUSD', 240_001, 1.4));

    const recent = service.getRecent('EURUSD', 'M1', 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].startTime).toBe(180_000);
    expect(recent[1].startTime).toBe(120_000);
  });

  it('does not mutate a closed candle when a late tick arrives for it', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1000));
    service.addTick(makeTick('EURUSD', 120_001, 1.1010));

    const snapshot = { ...service.getRecent('EURUSD', 'M1', 1)[0] };
    service.addTick(makeTick('EURUSD', 60_999, 9.9999));

    const after = service.getRecent('EURUSD', 'M1', 1)[0];
    expect(after.close).toBe(snapshot.close);
    expect(after.high).toBe(snapshot.high);
    expect(after.low).toBe(snapshot.low);
  });

  it('calls persistence.persist once for each closed candle', () => {
    service.addTick(makeTick('EURUSD', 60_001, 1.1001));
    service.addTick(makeTick('EURUSD', 120_001, 1.1005));

    expect(persistenceStub.persist).toHaveBeenCalledTimes(1);
  });

  it('returns undefined from getCurrent before any ticks', () => {
    expect(service.getCurrent('EURUSD', 'M1')).toBeUndefined();
    expect(service.getCurrent('GBPUSD', 'H1')).toBeUndefined();
  });

  it('produces the same closed candle given the same tick stream', () => {
    const ticks = [
      makeTick('EURUSD', 60_001, 1.1000),
      makeTick('EURUSD', 60_300, 1.1005),
      makeTick('EURUSD', 60_700, 1.0998),
    ];

    ticks.forEach((t) => service.addTick(t));
    service.addTick(makeTick('EURUSD', 120_001, 1.1002));
    const run1 = service.getRecent('EURUSD', 'M1', 1)[0];

    service.onModuleDestroy();
    vi.useRealTimers();
    vi.useFakeTimers();

    const { service: svc2 } = makeService();
    svc2.onModuleInit();
    ticks.forEach((t) => svc2.addTick(t));
    svc2.addTick(makeTick('EURUSD', 120_001, 1.1002));
    const run2 = svc2.getRecent('EURUSD', 'M1', 1)[0];
    svc2.onModuleDestroy();

    expect(run2.open).toBe(run1.open);
    expect(run2.high).toBe(run1.high);
    expect(run2.low).toBe(run1.low);
    expect(run2.close).toBe(run1.close);
    expect(run2.tickVolume).toBe(run1.tickVolume);
  });
});
