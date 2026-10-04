import { Candle } from '../domain/candle.js';

export type CandleValidationError =
  | 'HIGH_BELOW_OPEN'
  | 'HIGH_BELOW_CLOSE'
  | 'LOW_ABOVE_OPEN'
  | 'LOW_ABOVE_CLOSE'
  | 'HIGH_BELOW_LOW'
  | 'NEGATIVE_TICK_VOLUME'
  | 'NEGATIVE_REAL_VOLUME'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_SYMBOL'
  | 'INVALID_SPREAD';

export type CandleValidationResult =
  | { valid: true }
  | { valid: false; errors: CandleValidationError[]; detail: string };

export function validateCandle(candle: Candle): CandleValidationResult {
  const errors: CandleValidationError[] = [];

  if (!candle.symbol || candle.symbol.trim().length === 0) {
    errors.push('INVALID_SYMBOL');
  }

  if (!Number.isFinite(candle.startTime) || candle.startTime < 0) {
    errors.push('INVALID_TIMESTAMP');
  }

  if (candle.high < candle.open) errors.push('HIGH_BELOW_OPEN');
  if (candle.high < candle.close) errors.push('HIGH_BELOW_CLOSE');
  if (candle.low > candle.open) errors.push('LOW_ABOVE_OPEN');
  if (candle.low > candle.close) errors.push('LOW_ABOVE_CLOSE');
  if (candle.high < candle.low) errors.push('HIGH_BELOW_LOW');

  if (candle.tickVolume < 0) errors.push('NEGATIVE_TICK_VOLUME');
  if (candle.realVolume < 0) errors.push('NEGATIVE_REAL_VOLUME');

  if (
    candle.spreadOpen < 0 ||
    candle.spreadHigh < 0 ||
    candle.spreadLow < 0 ||
    candle.spreadClose < 0 ||
    candle.spreadAverage < 0
  ) {
    errors.push('INVALID_SPREAD');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      detail: `Candle ${candle.symbol}/${candle.timeframe}@${candle.startTime} failed: ${errors.join(', ')}`,
    };
  }

  return { valid: true };
}
