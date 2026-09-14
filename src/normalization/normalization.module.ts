import { Module } from '@nestjs/common';
import { NormalizationService } from './normalization.service.js';

@Module({
  providers: [NormalizationService]
})
export class NormalizationModule {}
