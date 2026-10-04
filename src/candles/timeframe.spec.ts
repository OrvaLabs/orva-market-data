import { describe, it, expect } from 'vitest';
import { bucketStart, bucketEnd, getMissingBuckets } from './timeframe.js';

describe('bucketStart', () => {
  it('floors an M1 timestamp to the minute', () => {
    expect(bucketStart(60_001, 'M1')).toBe(60_000);
    expect(bucketStart(119_999, 'M1')).toBe(60_000);
    expect(bucketStart(120_000, 'M1')).toBe(120_000);
  });

  it('floors an M5 timestamp to the 5-minute mark', () => {
    expect(bucketStart(299_999, 'M5')).toBe(0);
    expect(bucketStart(300_001, 'M5')).toBe(300_000);
  });

  it('floors an M15 timestamp correctly', () => {
    expect(bucketStart(900_000, 'M15')).toBe(900_000);
    expect(bucketStart(1_799_999, 'M15')).toBe(900_000);
  });

  it('floors an H1 timestamp correctly', () => {
    expect(bucketStart(3_600_000, 'H1')).toBe(3_600_000);
    expect(bucketStart(7_199_999, 'H1')).toBe(3_600_000);
  });
});

describe('bucketEnd', () => {
  it('returns start + duration for M1', () => {
    expect(bucketEnd(60_001, 'M1')).toBe(120_000);
  });

  it('returns start + duration for H1', () => {
    expect(bucketEnd(3_600_001, 'H1')).toBe(7_200_000);
  });
});

describe('getMissingBuckets', () => {
  it('returns empty when buckets are adjacent', () => {
    expect(getMissingBuckets(60_000, 120_000, 'M1')).toEqual([]);
  });

  it('returns one missing bucket when one is skipped', () => {
    expect(getMissingBuckets(60_000, 180_000, 'M1')).toEqual([120_000]);
  });

  it('returns multiple missing buckets', () => {
    expect(getMissingBuckets(60_000, 300_000, 'M1')).toEqual([120_000, 180_000, 240_000]);
  });

  it('returns empty when prev === new', () => {
    expect(getMissingBuckets(60_000, 60_000, 'M1')).toEqual([]);
  });

  it('caps output at 1000 buckets', () => {
    const result = getMissingBuckets(0, 999_999_999_999, 'M1');
    expect(result.length).toBeLessThanOrEqual(1000);
  });
});
