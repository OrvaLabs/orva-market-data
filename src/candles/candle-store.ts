import { Candle, CandleTimeframe } from '../domain/candle.js';

const DEFAULT_MAX_PER_KEY = 10_000;

export class CandleStore {
  private readonly maxPerKey: number;
  private readonly store = new Map<string, Candle[]>();

  constructor(maxPerKey = DEFAULT_MAX_PER_KEY) {
    this.maxPerKey = maxPerKey;
  }

  push(candle: Candle): void {
    const key = storeKey(candle.symbol, candle.timeframe);
    let ring = this.store.get(key);
    if (!ring) {
      ring = [];
      this.store.set(key, ring);
    }
    ring.push(candle);
    if (ring.length > this.maxPerKey) {
      ring.shift();
    }
  }

  getRecent(symbol: string, timeframe: CandleTimeframe, limit: number): Candle[] {
    const ring = this.store.get(storeKey(symbol, timeframe)) ?? [];
    const n = Math.max(0, Math.min(limit, ring.length));
    return ring.slice(ring.length - n).reverse();
  }

  getTimeframes(symbol: string): CandleTimeframe[] {
    const result: CandleTimeframe[] = [];
    for (const key of this.store.keys()) {
      const [sym, tf] = key.split('::') as [string, CandleTimeframe];
      if (sym === symbol) result.push(tf);
    }
    return result;
  }

  count(symbol: string, timeframe: CandleTimeframe): number {
    return this.store.get(storeKey(symbol, timeframe))?.length ?? 0;
  }
}

function storeKey(symbol: string, timeframe: CandleTimeframe): string {
  return `${symbol}::${timeframe}`;
}
