import { Candle, CandleTimeframe } from '../domain/candle.js';
import { CanonicalTick } from '../domain/tick.js';
import { bucketStart, bucketEnd, getMissingBuckets } from './timeframe.js';

export interface AddTickResult {
  closed: Candle[];
  missingBuckets: number[];
  rejectedReason?: 'OUT_OF_ORDER' | 'DUPLICATE';
}

export class CandleAggregator {
  private forming: Candle | null = null;
  private lastClosedBucketStart = -Infinity;
  private readonly seenIds = new Set<string>();
  private static readonly MAX_SEEN_IDS = 50_000;

  constructor(
    readonly symbol: string,
    readonly timeframe: CandleTimeframe,
  ) {}

  addTick(tick: CanonicalTick): AddTickResult {
    const bucket = bucketStart(tick.timestamp, this.timeframe);

    if (this.seenIds.has(tick.messageId)) {
      return { closed: [], missingBuckets: [], rejectedReason: 'DUPLICATE' };
    }

    if (this.seenIds.size >= CandleAggregator.MAX_SEEN_IDS) {
      const oldest = this.seenIds.values().next().value;
      if (oldest !== undefined) this.seenIds.delete(oldest);
    }
    this.seenIds.add(tick.messageId);

    if (bucket <= this.lastClosedBucketStart) {
      return { closed: [], missingBuckets: [], rejectedReason: 'OUT_OF_ORDER' };
    }

    const closed: Candle[] = [];
    const missingBuckets: number[] = [];

    if (this.forming && bucket > this.forming.startTime) {
      const finalized = this.finalize(this.forming);
      closed.push(finalized);
      this.lastClosedBucketStart = finalized.startTime;
      missingBuckets.push(...getMissingBuckets(finalized.startTime, bucket, this.timeframe));
      this.forming = null;
    }

    if (!this.forming) {
      this.forming = openCandle(tick, bucket, this.timeframe);
    } else {
      updateCandle(this.forming, tick);
    }

    return { closed, missingBuckets };
  }

  closeIfExpired(nowMs: number): Candle | null {
    if (!this.forming) return null;
    if (nowMs < this.forming.endTime) return null;

    const finalized = this.finalize(this.forming);
    this.lastClosedBucketStart = finalized.startTime;
    this.forming = null;
    return finalized;
  }

  getCurrent(): Candle | undefined {
    return this.forming ?? undefined;
  }

  private finalize(candle: Candle): Candle {
    candle.state = 'CLOSED';
    candle.closedAt = Date.now();
    return candle;
  }
}

function openCandle(tick: CanonicalTick, bucket: number, timeframe: CandleTimeframe): Candle {
  const spread = tick.spread.absolute;
  return {
    type: 'candle',
    version: 1,
    symbol: tick.symbol,
    timeframe,
    startTime: bucket,
    endTime: bucketEnd(tick.timestamp, timeframe),
    open: tick.price.mid,
    high: tick.price.mid,
    low: tick.price.mid,
    close: tick.price.mid,
    tickVolume: tick.volume.tick,
    realVolume: tick.volume.real,
    spreadOpen: spread,
    spreadHigh: spread,
    spreadLow: spread,
    spreadClose: spread,
    spreadAverage: spread,
    tickCount: 1,
    state: 'FORMING',
  };
}

function updateCandle(candle: Candle, tick: CanonicalTick): void {
  const mid = tick.price.mid;
  const spread = tick.spread.absolute;

  if (mid > candle.high) candle.high = mid;
  if (mid < candle.low) candle.low = mid;
  candle.close = mid;
  candle.tickVolume += tick.volume.tick;
  candle.realVolume += tick.volume.real;

  if (spread > candle.spreadHigh) candle.spreadHigh = spread;
  if (spread < candle.spreadLow) candle.spreadLow = spread;
  candle.spreadClose = spread;

  candle.tickCount += 1;
  candle.spreadAverage += (spread - candle.spreadAverage) / candle.tickCount;
}
