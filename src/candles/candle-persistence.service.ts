import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Candle, CandleTimeframe } from '../domain/candle.js';

@Injectable()
export class CandlePersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CandlePersistenceService.name);
  private readonly rootDir: string;
  private readonly streams = new Map<string, fs.WriteStream>();

  constructor() {
    this.rootDir = path.resolve(process.cwd(), 'data', 'candles');
  }

  get dataRoot(): string {
    return this.rootDir;
  }

  onModuleInit(): void {
    fs.mkdirSync(this.rootDir, { recursive: true });
    this.logger.log(`Candle persistence root: ${this.rootDir}`);
  }

  onModuleDestroy(): void {
    for (const [filePath, stream] of this.streams.entries()) {
      stream.end();
      this.logger.debug(`Closed stream: ${filePath}`);
    }
    this.streams.clear();
  }

  persist(candle: Candle): void {
    const filePath = this.filePath(candle.symbol, candle.timeframe);
    this.ensureDir(candle.symbol);
    try {
      const stream = this.getOrOpenStream(filePath);
      stream.write(JSON.stringify(candle) + '\n');
    } catch (err) {
      this.logger.error(
        `Failed to persist candle ${candle.symbol}/${candle.timeframe}@${candle.startTime}: ${String(err)}`,
      );
    }
  }

  loadRecent(symbol: string, timeframe: CandleTimeframe, limit: number): Candle[] {
    const filePath = this.filePath(symbol, timeframe);
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const tail = lines.slice(Math.max(0, lines.length - limit));
      const candles: Candle[] = [];
      for (const line of tail) {
        try {
          candles.push(JSON.parse(line) as Candle);
        } catch {
          this.logger.warn(`Skipping malformed line in ${filePath}`);
        }
      }
      return candles;
    } catch (err) {
      this.logger.error(`Failed to load candles from ${filePath}: ${String(err)}`);
      return [];
    }
  }

  private filePath(symbol: string, timeframe: CandleTimeframe): string {
    return path.join(this.rootDir, symbol, `${timeframe}.ndjson`);
  }

  private ensureDir(symbol: string): void {
    fs.mkdirSync(path.join(this.rootDir, symbol), { recursive: true });
  }

  private getOrOpenStream(filePath: string): fs.WriteStream {
    let stream = this.streams.get(filePath);
    if (!stream || stream.destroyed) {
      stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
      stream.on('error', (err) => {
        this.logger.error(`Stream error on ${filePath}: ${String(err)}`);
        this.streams.delete(filePath);
      });
      this.streams.set(filePath, stream);
    }
    return stream;
  }
}
