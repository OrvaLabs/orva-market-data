import { Injectable } from '@nestjs/common';
import { TickMessage } from '../ingestion/protocol.js';
import { CanonicalTick } from '../domain/tick.js';
import { getPipSize } from './pip-size.js';

@Injectable()
export class NormalizationService {
  normalize(message: TickMessage): CanonicalTick {
    const { symbol, tick } = message;
    const { bid, ask, last, volume, volumeReal, time, timeMsc } = tick;

    const mid = (bid + ask) / 2;
    const absolute = ask - bid;
    const pips = absolute / getPipSize(symbol);

    return {
      type: 'tick',
      version: 1,
      messageId: `${symbol}-${timeMsc}`,
      timestamp: timeMsc,

      symbol,

      price: {
        bid,
        ask,
        last,
        mid,
      },

      spread: {
        absolute,
        pips,
      },

      volume: {
        tick: volume,
        real: volumeReal,
      },

      source: {
        provider: 'MT5',
        brokerTime: time,
      },
    };
  }
}
