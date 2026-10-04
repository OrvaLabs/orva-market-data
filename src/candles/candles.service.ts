import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import { Candle, CandleTimeframe, CANDLE_TIMEFRAMES } from '../domain/candle.js';
import { CanonicalTick } from '../domain/tick.js';
import { TickPipelineService } from '../normalization/tick-pipeline.service.js';
import { CandleAggregator } from './candle-aggregator.js';
import { CandleStore } from './candle-store.js';
import { CandlePersistenceService } from './candle-persistence.service.js';
import { validateCandle } from './candle-validator.js';

export interface CandleClosedEvent {
  symbol: string;
  timeframe: CandleTimeframe;
  candle: Candle;
}

export interface CandleGapEvent {
  symbol: string;
  timeframe: CandleTimeframe;
  missingBucketStarts: number[];
}

export interface CandleInvalidEvent {
  symbol: string;
  timeframe: CandleTimeframe;
  candle: Candle;
  errors: string[];
  detail: string;
}

const FINALIZATION_INTERVAL_MS = 1_000;

@Injectable()
export class CandlesService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CandlesService.name);
  private readonly aggregators = new Map<string, CandleAggregator>();
  private readonly store: CandleStore;
  private finalizationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tickPipeline: TickPipelineService,
    private readonly persistence: CandlePersistenceService,
  ) {
    super();
    this.store = new CandleStore();
  }

  onModuleInit(): void {
    this.seedFromDisk();
    this.tickPipeline.on('canonical.tick', (tick: CanonicalTick) => this.addTick(tick));
    this.finalizationTimer = setInterval(() => this.finalizeExpired(), FINALIZATION_INTERVAL_MS);
    this.logger.log(`Candle engine initialized — timeframes: ${CANDLE_TIMEFRAMES.join(', ')}`);
  }

  onModuleDestroy(): void {
    if (this.finalizationTimer) {
      clearInterval(this.finalizationTimer);
      this.finalizationTimer = null;
    }
  }

  addTick(tick: CanonicalTick): void {
    for (const timeframe of CANDLE_TIMEFRAMES) {
      this.addTickForTimeframe(tick, timeframe);
    }
  }

  getCurrent(symbol: string, timeframe: CandleTimeframe): Candle | undefined {
    return this.getOrCreateAggregator(symbol, timeframe).getCurrent();
  }

  getRecent(symbol: string, timeframe: CandleTimeframe, limit: number): Candle[] {
    return this.store.getRecent(symbol, timeframe, limit);
  }

  private addTickForTimeframe(tick: CanonicalTick, timeframe: CandleTimeframe): void {
    const aggregator = this.getOrCreateAggregator(tick.symbol, timeframe);
    const result = aggregator.addTick(tick);

    if (result.rejectedReason) {
      this.logger.debug(
        `Tick ${tick.messageId} rejected for ${tick.symbol}/${timeframe}: ${result.rejectedReason}`,
      );
      return;
    }

    if (result.missingBuckets.length > 0) {
      this.emit('candle.gap', {
        symbol: tick.symbol,
        timeframe,
        missingBucketStarts: result.missingBuckets,
      } satisfies CandleGapEvent);
      this.logger.warn(
        `Gap detected — ${tick.symbol}/${timeframe}: ` +
          `${result.missingBuckets.length} missing bucket(s) starting at ` +
          result.missingBuckets.map((t) => new Date(t).toISOString()).join(', '),
      );
    }

    for (const closed of result.closed) {
      this.publishClosed(closed);
    }
  }

  private finalizeExpired(): void {
    const now = Date.now();
    for (const aggregator of this.aggregators.values()) {
      const closed = aggregator.closeIfExpired(now);
      if (closed) this.publishClosed(closed);
    }
  }

  private publishClosed(candle: Candle): void {
    const result = validateCandle(candle);
    if (!result.valid) {
      this.emit('candle.invalid', {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
        candle,
        errors: result.errors,
        detail: result.detail,
      } satisfies CandleInvalidEvent);
      this.logger.error(`Invalid candle dropped — ${result.detail}`);
      return;
    }

    this.store.push(candle);
    this.persistence.persist(candle);

    this.emit('candle.closed', {
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      candle,
    } satisfies CandleClosedEvent);

    this.logger.debug(
      `candle.closed ${candle.symbol}/${candle.timeframe} ` +
        `O=${candle.open} H=${candle.high} L=${candle.low} C=${candle.close} ` +
        `ticks=${candle.tickCount}`,
    );
  }

  private getOrCreateAggregator(symbol: string, timeframe: CandleTimeframe): CandleAggregator {
    const key = `${symbol}::${timeframe}`;
    let aggregator = this.aggregators.get(key);
    if (!aggregator) {
      aggregator = new CandleAggregator(symbol, timeframe);
      this.aggregators.set(key, aggregator);
    }
    return aggregator;
  }

  private seedFromDisk(): void {
    const dataDir = this.persistence.dataRoot;
    if (!dataDir) return;

    let symbols: string[] = [];
    try {
      symbols = fs
        .readdirSync(dataDir)
        .filter((d) => fs.statSync(`${dataDir}/${d}`).isDirectory());
    } catch {
      return;
    }

    let total = 0;
    for (const symbol of symbols) {
      for (const tf of CANDLE_TIMEFRAMES) {
        const candles = this.persistence.loadRecent(symbol, tf, 10_000);
        for (const candle of candles) {
          this.store.push(candle);
        }
        total += candles.length;
      }
    }

    if (total > 0) {
      this.logger.log(`Recovery: seeded ${total} historical candles from disk`);
    }
  }
}
