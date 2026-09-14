import { Module } from '@nestjs/common';
import { CandlesService } from './candles.service.js';

@Module({
  providers: [CandlesService]
})
export class CandlesModule {}
