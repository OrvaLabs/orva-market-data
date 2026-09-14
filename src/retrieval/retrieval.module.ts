import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service.js';
import { RetrievalController } from './retrieval.controller.js';

@Module({
  providers: [RetrievalService],
  controllers: [RetrievalController]
})
export class RetrievalModule {}
