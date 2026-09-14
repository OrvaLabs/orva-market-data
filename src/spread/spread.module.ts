import { Module } from '@nestjs/common';
import { SpreadService } from './spread.service.js';

@Module({
  providers: [SpreadService]
})
export class SpreadModule {}
