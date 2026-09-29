import { Module } from '@nestjs/common';
import { CandlesService } from './candles.service.js';
import { NormalizationModule } from '../normalization/normalization.module.js';

@Module({
  imports: [NormalizationModule],
  providers: [CandlesService],
  exports: [CandlesService],
})
export class CandlesModule {}
