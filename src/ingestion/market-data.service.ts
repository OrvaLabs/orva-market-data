import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { CandleMessage, Mt5Message, TickMessage } from './protocol.js';

@Injectable()
export class MarketDataService extends EventEmitter {
  private readonly latestTicks = new Map<string, TickMessage>();
  private readonly latestCandles = new Map<string, CandleMessage>();
  private readonly latestMessages = new Map<string, Mt5Message>();

  update(message: Mt5Message): void {
    if (message.type === 'TICK') {
      this.latestTicks.set(message.symbol, message);
      this.latestMessages.set(message.symbol, message);
      this.emit('market.tick', message);
    } else if (message.type === 'CANDLE') {
      this.latestCandles.set(`${message.symbol}:${message.timeframe}`, message);
      this.latestMessages.set(`${message.symbol}:${message.timeframe}`, message);
      this.emit('market.candle', message);
    } else if (message.type !== 'AUTH' && message.type !== 'HEARTBEAT') {
      const symbol = message.type === 'SYMBOL_INFO' ? message.symbol : undefined;
      if (symbol) this.latestMessages.set(symbol, message);
      this.emit(`market.${message.type.toLowerCase()}`, message);
    }
  }
  getLatestTick(symbol: string) { return this.latestTicks.get(symbol); }
  getLatestCandle(symbol: string, timeframe: string) { return this.latestCandles.get(`${symbol}:${timeframe}`); }
}
