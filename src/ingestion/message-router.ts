import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from './market-data.service.js';
import { Mt5Message } from './protocol.js';

@Injectable()
export class MessageRouter {
  private readonly logger = new Logger(MessageRouter.name);
  constructor(private readonly marketData: MarketDataService) {}
  route(message: Mt5Message): void {
    this.marketData.update(message);
    if (message.type === 'TICK') {
      if (process.env.MT5_TCP_LOG_TICKS !== 'false') {
        this.logger.log(
          `MT5 TICK received: ${message.symbol}:${message.timeframe} ` +
          `bid=${message.tick.bid} ask=${message.tick.ask}`,
        );
      }
      return;
    }
    if (message.type === 'CANDLE') {
      this.logger.log(`MT5 CANDLE received: ${message.symbol}:${message.timeframe}`);
      return;
    }
    this.logger.log(`MT5 ${message.type} received`);
  }
}
