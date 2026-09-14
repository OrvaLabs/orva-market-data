import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service.js';
import { MarketDataService } from './market-data.service.js';
import { MessageRouter } from './message-router.js';
import { Mt5TcpServer } from './mt5-tcp.server.js';
import { Mt5ProtocolValidator } from './protocol-validator.js';
import { Mt5HttpController } from './mt5-http.controller.js';

@Module({
  providers: [
    IngestionService,
    MarketDataService,
    MessageRouter,
    Mt5ProtocolValidator,
    Mt5TcpServer,
  ],
  controllers: [Mt5HttpController],
  exports: [IngestionService, MarketDataService],
})
export class IngestionModule {}
