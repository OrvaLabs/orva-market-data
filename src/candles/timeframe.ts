import { CandleTimeframe } from '../domain/candle.js';

export const TIMEFRAME_DURATION_MS: Record<CandleTimeframe, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  H1: 60 * 60_000,
};

export function bucketStart(timestampMs: number, timeframe: CandleTimeframe): number {
  const d = TIMEFRAME_DURATION_MS[timeframe];
  return Math.floor(timestampMs / d) * d;
}

export function bucketEnd(timestampMs: number, timeframe: CandleTimeframe): number {
  return bucketStart(timestampMs, timeframe) + TIMEFRAME_DURATION_MS[timeframe];
}

export function getMissingBuckets(
  prevClosedBucketStart: number,
  newBucketStart: number,
  timeframe: CandleTimeframe,
): number[] {
  const d = TIMEFRAME_DURATION_MS[timeframe];
  const missing: number[] = [];
  const maxGap = 1000;
  let count = 0;
  for (
    let t = prevClosedBucketStart + d;
    t < newBucketStart && count < maxGap;
    t += d, count++
  ) {
    missing.push(t);
  }
  return missing;
}
