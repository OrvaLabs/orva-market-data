import { Injectable } from '@nestjs/common';
import { CanonicalTick } from '../domain/tick.js';

const DEFAULT_RING_SIZE = 10_000;

@Injectable()
export class StorageService {
  private readonly ringSize = DEFAULT_RING_SIZE;
  private readonly buffers = new Map<string, CanonicalTick[]>();
  private readonly heads = new Map<string, number>();
  private readonly counts = new Map<string, number>();
  private readonly latestTick = new Map<string, CanonicalTick>();

  store(tick: CanonicalTick): void {
    const { symbol } = tick;

    if (!this.buffers.has(symbol)) {
      this.buffers.set(symbol, new Array<CanonicalTick>(this.ringSize));
      this.heads.set(symbol, 0);
      this.counts.set(symbol, 0);
    }

    const buffer = this.buffers.get(symbol)!;
    const head = this.heads.get(symbol)!;

    buffer[head] = tick;
    this.heads.set(symbol, (head + 1) % this.ringSize);
    this.counts.set(symbol, Math.min((this.counts.get(symbol) ?? 0) + 1, this.ringSize));
    this.latestTick.set(symbol, tick);
  }

  getLatest(symbol: string): CanonicalTick | undefined {
    return this.latestTick.get(symbol);
  }

  getRecent(symbol: string, limit: number): CanonicalTick[] {
    const buffer = this.buffers.get(symbol);
    const count = this.counts.get(symbol) ?? 0;
    const head = this.heads.get(symbol) ?? 0;

    if (!buffer || count === 0) return [];

    const n = Math.min(limit, count);
    const result: CanonicalTick[] = [];

    for (let i = 0; i < n; i++) {
      const idx = (head - 1 - i + this.ringSize) % this.ringSize;
      result.push(buffer[idx]);
    }

    return result;
  }

  getSymbols(): string[] {
    return [...this.latestTick.keys()];
  }
  
  getCount(symbol: string): number {
    return this.counts.get(symbol) ?? 0;
  }
}
