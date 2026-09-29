export interface CanonicalTick {
  type: 'tick';
  version: 1;
  messageId: string;
  timestamp: number;

  symbol: string;

  price: {
    bid: number;
    ask: number;
    last: number;
    mid: number;
  };

  spread: {
    absolute: number;
    pips: number;
  };

  volume: {
    tick: number;
    real: number;
  };

  source: {
    provider: 'MT5';
    brokerTime: number;
  };
}
