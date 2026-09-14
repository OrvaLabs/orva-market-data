export interface Tick {
  timestamp: Date
  symbol: string
  bid: number
  ask: number
  bidSize?: number
  askSize?: number
  lastPrice?: number
  volume?: number
  midPrice: number
  spread: number
  spreadPips: number
}
