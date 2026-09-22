import { Module } from '@nestjs/common';
import { NormalizationService } from './normalization.service.js';
import { DataQualityService } from './data-quality.service.js';
import { TickPipelineService } from './tick-pipeline.service.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { ValidationModule } from '../validation/validation.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [
    IngestionModule,    
    ValidationModule,   
    StorageModule,      
  ],
  providers: [
    NormalizationService,
    DataQualityService,
    TickPipelineService,
  ],
  exports: [
    NormalizationService,
    DataQualityService,
    TickPipelineService,
  ],
})
export class NormalizationModule {}
