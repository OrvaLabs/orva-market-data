export const TIMEFRAMES = [
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M10', 'M12', 'M15', 'M20', 'M30',
  'H1', 'H2', 'H3', 'H4', 'H6', 'H8', 'H12', 'D1', 'W1', 'MN1',
] as const;

export type Timeframe = typeof TIMEFRAMES[number];
export type MessageType =
  | 'AUTH' | 'HEARTBEAT' | 'TICK' | 'CANDLE' | 'SYMBOL_INFO'
  | 'ACCOUNT_INFO' | 'POSITION' | 'ORDER' | 'DEAL';

export interface Envelope {
  type: MessageType;
  version: 1;
  messageId: string;
  timestamp: number;
}

export interface AuthMessage extends Envelope {
  type: 'AUTH';
  clientId: string;
  token: string;
}
export interface TickMessage extends Envelope {
  type: 'TICK'; symbol: string; timeframe: Timeframe;
  tick: { time: number; timeMsc: number; bid: number; ask: number; last: number; volume: number; volumeReal: number; flags: number };
  spread: number;
}
export interface CandleMessage extends Envelope {
  type: 'CANDLE'; symbol: string; timeframe: Timeframe;
  candle: { time: number; open: number; high: number; low: number; close: number; tickVolume: number; realVolume: number; spread: number };
}
export interface SymbolInfoMessage extends Envelope {
  type: 'SYMBOL_INFO'; symbol: string; info: SymbolInfo;
}
export interface AccountInfoMessage extends Envelope {
  type: 'ACCOUNT_INFO'; account: AccountInfo;
}
export interface PositionMessage extends Envelope {
  type: 'POSITION'; position: PositionInfo;
}
export interface OrderMessage extends Envelope {
  type: 'ORDER'; order: OrderInfo;
}
export interface DealMessage extends Envelope {
  type: 'DEAL'; deal: DealInfo;
}
export interface SymbolInfo {
  digits?: number; point?: number; tickSize?: number; tickValue?: number; contractSize?: number;
  volumeMin?: number; volumeMax?: number; volumeStep?: number; tradeMode?: number;
  currencyBase?: string; currencyProfit?: string; currencyMargin?: string;
  [key: string]: string | number | boolean | null | undefined;
}
export interface AccountInfo {
  login?: number; balance?: number; equity?: number; margin?: number; freeMargin?: number;
  marginLevel?: number; profit?: number; currency?: string; leverage?: number;
  [key: string]: string | number | boolean | null | undefined;
}
export interface PositionInfo {
  ticket?: number; symbol?: string; type?: 'BUY' | 'SELL' | string; volume?: number;
  openPrice?: number; currentPrice?: number; stopLoss?: number; takeProfit?: number;
  profit?: number; swap?: number; commission?: number; openTime?: number;
  [key: string]: string | number | boolean | null | undefined;
}
export interface OrderInfo {
  ticket?: number; symbol?: string; type?: string; volume?: number; price?: number;
  stopLoss?: number; takeProfit?: number; state?: string; time?: number; profit?: number;
  commission?: number; swap?: number; magic?: number; comment?: string;
  [key: string]: string | number | boolean | null | undefined;
}
export interface DealInfo extends OrderInfo { dealTicket?: number; }
export type Mt5Message = AuthMessage | TickMessage | CandleMessage | SymbolInfoMessage |
  AccountInfoMessage | PositionMessage | OrderMessage | DealMessage | (Envelope & { type: 'HEARTBEAT' });

export interface AuthAck { type: 'AUTH_ACK'; version: 1; messageId: string; timestamp: number; success: boolean; error?: string }
