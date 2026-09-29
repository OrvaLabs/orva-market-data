import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { OneMinuteCandle } from '../domain/candle.js';
import { CanonicalTick } from '../domain/tick.js';
import { TickPipelineService } from '../normalization/tick-pipeline.service.js';

@Injectable()
export class CandlesService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(CandlesService.name);
  private readonly active = new Map<string, OneMinuteCandle>();
  private readonly completed = new Map<string, OneMinuteCandle[]>();
  private readonly maxCompletedPerSymbol = 10_000;

  constructor(private readonly tickPipeline: TickPipelineService) {
    super();
  }

  onModuleInit(): void {
    this.tickPipeline.on('canonical.tick', (tick: CanonicalTick) => this.addTick(tick));
    this.logger.log('1M candle aggregation initialized');
  }

  addTick(tick: CanonicalTick): void {
    const bucket = Math.floor(tick.timestamp / 60_000) * 60_000;
    const current = this.active.get(tick.symbol);

    if (current && bucket < current.time) return;

    if (!current || bucket > current.time) {
      if (current) {
        current.closed = true;
        this.saveCompleted(current);
        this.emit('candle.closed', current);
      }

      this.active.set(tick.symbol, {
        type: 'candle',
        version: 1,
        symbol: tick.symbol,
        timeframe: 'M1',
        time: bucket,
        open: tick.price.mid,
        high: tick.price.mid,
        low: tick.price.mid,
        close: tick.price.mid,
        tickVolume: tick.volume.tick,
        realVolume: tick.volume.real,
        spread: tick.spread.absolute,
        closed: false,
      });
      return;
    }

    current.high = Math.max(current.high, tick.price.mid);
    current.low = Math.min(current.low, tick.price.mid);
    current.close = tick.price.mid;
    current.tickVolume += tick.volume.tick;
    current.realVolume += tick.volume.real;
    current.spread = tick.spread.absolute;
  }

  getCurrent(symbol: string): OneMinuteCandle | undefined {
    return this.active.get(symbol);
  }

  getRecent(symbol: string, limit: number): OneMinuteCandle[] {
    const candles = this.completed.get(symbol) ?? [];
    return candles.slice(Math.max(0, candles.length - Math.max(0, limit))).reverse();
  }

  private saveCompleted(candle: OneMinuteCandle): void {
    const candles = this.completed.get(candle.symbol) ?? [];
    candles.push(candle);
    if (candles.length > this.maxCompletedPerSymbol) candles.shift();
    this.completed.set(candle.symbol, candles);
  }
}
