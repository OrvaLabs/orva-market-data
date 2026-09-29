import { Injectable } from '@nestjs/common';
import { CanonicalTick } from '../domain/tick.js';
import { DataQualityStatus } from '../domain/data-quality.js';

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: DataQualityStatus; detail: string };

const MAX_FUTURE_DRIFT_MS = 5_000;

const MAX_TICK_AGE_MS = 60_000;

const MAX_SPREAD_PIPS = 500;

const MAX_PRICE_JUMP_PCT = 0.05;

export type SymbolPriceState = {
  lastBid: number;
  lastAsk: number;
  lastTimestamp: number;
};

@Injectable()
export class ValidationService {
  private readonly priceState = new Map<string, SymbolPriceState>();

  validate(tick: CanonicalTick): ValidationResult {
    const now = Date.now();
    const { symbol, price, spread, timestamp, messageId } = tick;

    if (timestamp > now + MAX_FUTURE_DRIFT_MS) {
      return {
        valid: false,
        reason: 'FUTURE_TICK',
        detail: `Tick timestamp ${timestamp} is ${timestamp - now}ms ahead of wall clock`,
      };
    }

    if (timestamp < now - MAX_TICK_AGE_MS) {
      return {
        valid: false,
        reason: 'STALE',
        detail: `Tick timestamp ${timestamp} is ${now - timestamp}ms old (max ${MAX_TICK_AGE_MS}ms)`,
      };
    }

    if (!symbol || symbol.trim().length === 0) {
      return { valid: false, reason: 'INVALID_PRICE', detail: 'Symbol is empty' };
    }
    if (price.bid <= 0 || price.ask <= 0) {
      return {
        valid: false,
        reason: 'INVALID_PRICE',
        detail: `bid=${price.bid} ask=${price.ask} — prices must be > 0`,
      };
    }

    if (price.ask < price.bid) {
      return {
        valid: false,
        reason: 'INVALID_PRICE',
        detail: `Inverted price: bid=${price.bid} > ask=${price.ask} for ${symbol}`,
      };
    }

    if (spread.pips > MAX_SPREAD_PIPS) {
      return {
        valid: false,
        reason: 'SPREAD_TOO_WIDE',
        detail: `Spread of ${spread.pips.toFixed(1)} pips exceeds cap of ${MAX_SPREAD_PIPS} pips for ${symbol}`,
      };
    }

    const state = this.priceState.get(symbol);
    if (state) {
      const bidJump = Math.abs(price.bid - state.lastBid) / state.lastBid;
      const askJump = Math.abs(price.ask - state.lastAsk) / state.lastAsk;
      if (bidJump > MAX_PRICE_JUMP_PCT || askJump > MAX_PRICE_JUMP_PCT) {
        return {
          valid: false,
          reason: 'GAP',
          detail:
            `Price jump detected for ${symbol}: ` +
            `bid ${state.lastBid} → ${price.bid} (${(bidJump * 100).toFixed(2)}%), ` +
            `ask ${state.lastAsk} → ${price.ask} (${(askJump * 100).toFixed(2)}%)`,
        };
      }
    }

    this.priceState.set(symbol, {
      lastBid: price.bid,
      lastAsk: price.ask,
      lastTimestamp: timestamp,
    });

    void messageId;

    return { valid: true };
  }

  getPriceState(symbol: string): SymbolPriceState | undefined {
    return this.priceState.get(symbol);
  }
}
