import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MarketDataService } from '../ingestion/market-data.service.js';
import { TickMessage } from '../ingestion/protocol.js';
import { NormalizationService } from './normalization.service.js';
import { ValidationService } from '../validation/validation.service.js';
import { StorageService } from '../storage/storage.service.js';
import { DataQualityService } from './data-quality.service.js';
import { CanonicalTick } from '../domain/tick.js';
import { EventEmitter } from 'node:events';

@Injectable()
export class TickPipelineService extends EventEmitter implements OnModuleInit {
  private readonly logger = new Logger(TickPipelineService.name);

  constructor(
    private readonly marketData: MarketDataService,
    private readonly normalizer: NormalizationService,
    private readonly validator: ValidationService,
    private readonly storage: StorageService,
    private readonly quality: DataQualityService,
  ) {
    super();
  }

  onModuleInit(): void {
    this.marketData.on('market.tick', (message: TickMessage) => {
      this.processTick(message);
    });
    this.logger.log('Tick pipeline initialized — listening for market.tick events');
  }

  private processTick(message: TickMessage): void {
    const canonical = this.normalizer.normalize(message);

    const result = this.validator.validate(canonical);

    if (!result.valid) {
      this.quality.onTickRejected(canonical.symbol, result.reason, canonical.messageId);
      this.logger.debug(
        `Tick rejected [${canonical.symbol}]: ${result.reason} — ${result.detail}`,
      );
      this.emit('canonical.tick.rejected', { reason: result.reason, detail: result.detail, tick: canonical });
      return;
    }

    this.storage.store(canonical);
    const qualityEvent = this.quality.onTickAccepted(canonical);

    this.emit('canonical.tick', canonical);

    this.logger.debug(
      `canonical.tick ${canonical.symbol} ` +
      `bid=${canonical.price.bid} ask=${canonical.price.ask} ` +
      `mid=${canonical.price.mid.toFixed(5)} spread=${canonical.spread.pips.toFixed(1)}p ` +
      `quality=${qualityEvent.status}`,
    );
  }

  getLatest(symbol: string): CanonicalTick | undefined {
    return this.storage.getLatest(symbol);
  }

  getRecent(symbol: string, limit: number): CanonicalTick[] {
    return this.storage.getRecent(symbol, limit);
  }
}
