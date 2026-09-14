import { Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

@Module({
  providers: [StorageService]
})
export class StorageModule {}
