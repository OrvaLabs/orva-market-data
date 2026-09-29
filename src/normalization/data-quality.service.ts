import { Injectable, Logger } from '@nestjs/common';
import { CanonicalTick } from '../domain/tick.js';
import { DataQualityEvent, DataQualityStatus } from '../domain/data-quality.js';

const STALE_THRESHOLD_MS = 5_000;

@Injectable()
export class DataQualityService {
  private readonly logger = new Logger(DataQualityService.name);

  private readonly symbolState = new Map<
    string,
    {
      lastTickTimestamp: number;
      lastBid: number;
      lastAsk: number;
      seenMessageIds: Set<string>;
    }
  >();

  private readonly latestQuality = new Map<string, DataQualityEvent>();

  onTickAccepted(tick: CanonicalTick): DataQualityEvent {
    const now = Date.now();
    const state = this.getOrCreateState(tick.symbol);

    const clockDriftMs = tick.timestamp - now;
    const lastTickAgeMs = state.lastTickTimestamp > 0
      ? now - state.lastTickTimestamp
      : 0;

    const duplicateTick = state.seenMessageIds.has(tick.messageId);
    const gapDetected = false;

    if (!duplicateTick) {
      state.seenMessageIds.add(tick.messageId);
      if (state.seenMessageIds.size > 50_000) {
        const oldest = state.seenMessageIds.values().next().value;
        if (oldest !== undefined) state.seenMessageIds.delete(oldest);
      }
    }

    state.lastTickTimestamp = now;
    state.lastBid = tick.price.bid;
    state.lastAsk = tick.price.ask;

    const event = this.buildEvent(tick.symbol, 'HEALTHY', {
      lastTickAgeMs,
      gapDetected,
      duplicateTick,
      clockDriftMs,
      timestamp: tick.timestamp,
    });

    this.latestQuality.set(tick.symbol, event);
    return event;
  }

  onTickRejected(
    symbol: string,
    reason: DataQualityStatus,
    messageId?: string,
  ): DataQualityEvent {
    const now = Date.now();
    const state = this.getOrCreateState(symbol);

    const lastTickAgeMs = state.lastTickTimestamp > 0
      ? now - state.lastTickTimestamp
      : 0;

    const duplicateTick =
      reason === 'DUPLICATE' ||
      (messageId !== undefined && state.seenMessageIds.has(messageId));

    const gapDetected = reason === 'GAP';

    const event = this.buildEvent(symbol, reason, {
      lastTickAgeMs,
      gapDetected,
      duplicateTick,
      clockDriftMs: 0,
      timestamp: now,
    });

    this.latestQuality.set(symbol, event);
    this.logger.warn(
      `[DataQuality] ${symbol} rejected: ${reason}`,
    );
    return event;
  }

  getQuality(symbol: string): DataQualityEvent | undefined {
    return this.latestQuality.get(symbol);
  }

  isHealthy(symbol: string): boolean {
    const state = this.symbolState.get(symbol);
    if (!state || state.lastTickTimestamp === 0) return false;
    return Date.now() - state.lastTickTimestamp < STALE_THRESHOLD_MS;
  }

  private getOrCreateState(symbol: string) {
    if (!this.symbolState.has(symbol)) {
      this.symbolState.set(symbol, {
        lastTickTimestamp: 0,
        lastBid: 0,
        lastAsk: 0,
        seenMessageIds: new Set(),
      });
    }
    return this.symbolState.get(symbol)!;
  }

  private buildEvent(
    symbol: string,
    status: DataQualityStatus,
    opts: {
      lastTickAgeMs: number;
      gapDetected: boolean;
      duplicateTick: boolean;
      clockDriftMs: number;
      timestamp: number;
    },
  ): DataQualityEvent {
    return {
      type: 'data_quality',
      version: 1,
      timestamp: opts.timestamp,
      symbol,
      status,
      lastTickAgeMs: opts.lastTickAgeMs,
      gapDetected: opts.gapDetected,
      duplicateTick: opts.duplicateTick,
      clockDriftMs: opts.clockDriftMs,
    };
  }
}
