import { Injectable } from '@nestjs/common';
import { TIMEFRAMES, Mt5Message, MessageType } from './protocol.js';

const TYPES: MessageType[] = ['AUTH', 'HEARTBEAT', 'TICK', 'CANDLE', 'SYMBOL_INFO', 'ACCOUNT_INFO', 'POSITION', 'ORDER', 'DEAL'];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

@Injectable()
export class Mt5ProtocolValidator {
  validate(value: unknown): { valid: true; message: Mt5Message } | { valid: false; error: string } {
    if (!object(value)) return { valid: false, error: 'MESSAGE_MUST_BE_OBJECT' };
    if (!TYPES.includes(value.type as MessageType)) return { valid: false, error: 'INVALID_MESSAGE_TYPE' };
    if (value.version !== 1 || typeof value.messageId !== 'string' || !value.messageId ||
      !finite(value.timestamp) || value.timestamp < 0) return { valid: false, error: 'INVALID_ENVELOPE' };
    if (value.type === 'AUTH') {
      if (typeof value.clientId !== 'string' || !value.clientId || typeof value.token !== 'string' || !value.token) {
        return { valid: false, error: 'INVALID_AUTH' };
      }
    } else if (value.type === 'TICK') {
      const tick = value.tick as Record<string, unknown>;
      if (!this.symbolAndTimeframe(value) || !object(tick) ||
        !['time', 'timeMsc', 'bid', 'ask', 'last', 'volume', 'volumeReal', 'flags'].every((key) => finite(tick[key])) ||
        !finite(value.spread) || value.spread < 0 || !finite(tick.bid) || !finite(tick.ask) ||
        tick.bid < 0 || tick.ask < 0) return { valid: false, error: 'INVALID_TICK' };
    } else if (value.type === 'CANDLE') {
      const candle = value.candle as Record<string, unknown>;
      if (!this.symbolAndTimeframe(value) || !object(candle) ||
        !['time', 'open', 'high', 'low', 'close', 'tickVolume', 'realVolume', 'spread'].every((key) => finite(candle[key])) ||
        !this.ohlc(candle)) return { valid: false, error: 'INVALID_CANDLE' };
    } else if (['SYMBOL_INFO', 'ACCOUNT_INFO', 'POSITION', 'ORDER', 'DEAL'].includes(value.type as string)) {
      const messageType = value.type as MessageType;
      const key = messageType === 'SYMBOL_INFO' ? 'info' : messageType.toLowerCase();
      if (!object(value[key])) return { valid: false, error: `INVALID_${value.type}` };
      if (value.type === 'SYMBOL_INFO' && typeof value.symbol !== 'string' || value.type === 'SYMBOL_INFO' && !value.symbol) {
        return { valid: false, error: 'INVALID_SYMBOL' };
      }
    }
    return { valid: true, message: value as unknown as Mt5Message };
  }

  private symbolAndTimeframe(value: Record<string, unknown>): boolean {
    return typeof value.symbol === 'string' && value.symbol.trim().length > 0 &&
      typeof value.timeframe === 'string' && (TIMEFRAMES as readonly string[]).includes(value.timeframe);
  }
  private ohlc(candle: Record<string, unknown>): boolean {
    const { open, high, low, close } = candle;
    return (high as number) >= (open as number) && (high as number) >= (close as number) &&
      (high as number) >= (low as number) && (low as number) <= (open as number) &&
      (low as number) <= (close as number) && (low as number) <= (high as number);
  }
}
