import { Module } from '@nestjs/common';
import { VolatilityService } from './volatility.service.js';

@Module({
  providers: [VolatilityService]
})
export class VolatilityModule {}
