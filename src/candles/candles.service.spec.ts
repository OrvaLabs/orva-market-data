import { Test, TestingModule } from '@nestjs/testing';
import { CandlesService } from './candles.service.js';
import { TickPipelineService } from '../normalization/tick-pipeline.service.js';

describe('CandlesService', () => {
  let service: CandlesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CandlesService],
    }).useMocker((token) => token === TickPipelineService ? { on: () => undefined } : undefined).compile();

    service = module.get<CandlesService>(CandlesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('aggregates accepted ticks into a one-minute candle', () => {
    const base = {
      type: 'tick' as const,
      version: 1 as const,
      symbol: 'EURUSD',
      spread: { absolute: 0.0001, pips: 1 },
      volume: { tick: 2, real: 1 },
      source: { provider: 'MT5' as const, brokerTime: 1 },
    };

    service.addTick({ ...base, messageId: '1', timestamp: 60_001, price: { bid: 1.1, ask: 1.1002, last: 1.1, mid: 1.1001 } });
    service.addTick({ ...base, messageId: '2', timestamp: 60_500, price: { bid: 1.1002, ask: 1.1004, last: 1.1003, mid: 1.1003 }, volume: { tick: 3, real: 2 } });
    service.addTick({ ...base, messageId: '3', timestamp: 120_001, price: { bid: 1.1005, ask: 1.1007, last: 1.1006, mid: 1.1006 } });

    expect(service.getRecent('EURUSD', 1)[0]).toMatchObject({
      time: 60_000,
      open: 1.1001,
      high: 1.1003,
      low: 1.1001,
      close: 1.1003,
      tickVolume: 5,
      realVolume: 3,
      closed: true,
    });
    expect(service.getCurrent('EURUSD')).toMatchObject({ time: 120_000, open: 1.1006 });
  });
});
