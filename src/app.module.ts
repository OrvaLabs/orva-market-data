import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { NormalizationModule } from './normalization/normalization.module.js';
import { ValidationModule } from './validation/validation.module.js';
import { StorageModule } from './storage/storage.module.js';
import { RetrievalModule } from './retrieval/retrieval.module.js';
import { CandlesModule } from './candles/candles.module.js';
import { SpreadModule } from './spread/spread.module.js';
import { VolatilityModule } from './volatility/volatility.module.js';
import { HealthModule } from './health/health.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'xHJ3UHE^jy9S9waS',
      appSecret: 'AK3f&!2NpyzbWy5gwT2V^aF5%Z2kTyPG2AB8DsAgIc4EH',
      serviceId: 'market-data',
    }),
    IngestionModule,
    NormalizationModule,
    ValidationModule,
    StorageModule,
    RetrievalModule,
    CandlesModule,
    SpreadModule,
    VolatilityModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
