import { Mt5HttpController } from './mt5-http.controller.js';
import { MessageRouter } from './message-router.js';
import { Mt5ProtocolValidator } from './protocol-validator.js';
import { MarketDataService } from './market-data.service.js';

describe('Mt5HttpController', () => {
  it('accepts an authenticated HTTP tick', () => {
    process.env.MT5_TCP_AUTH_TOKEN = 'test-token';
    const controller = new Mt5HttpController(
      new Mt5ProtocolValidator(),
      new MessageRouter(new MarketDataService()),
    );
    const body = {
      type: 'TICK', version: 1, messageId: 'http-1', timestamp: Date.now(),
      symbol: 'EURUSD', timeframe: 'M1',
      tick: { time: 1, timeMsc: 1, bid: 1.1, ask: 1.2, last: 1.15, volume: 1, volumeReal: 1, flags: 6 },
      spread: 0.1,
    };
    expect(controller.ingest(body, 'test-token')).toEqual({ accepted: true, messageId: 'http-1' });
  });
});
