export type DataQualityStatus =
  | 'HEALTHY'
  | 'STALE'
  | 'GAP'
  | 'DUPLICATE'
  | 'INVALID_PRICE'
  | 'FUTURE_TICK'
  | 'SPREAD_TOO_WIDE';

export interface DataQualityEvent {
  type: 'data_quality';
  version: 1;
  timestamp: number;
  symbol: string;

  status: DataQualityStatus;
  lastTickAgeMs: number;
  gapDetected: boolean;
  duplicateTick: boolean;
  clockDriftMs: number;
}
