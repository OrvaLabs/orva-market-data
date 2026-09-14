import { connect } from 'node:net';
import { randomUUID } from 'node:crypto';

const token = process.env.MT5_TCP_AUTH_TOKEN || 'change-me';
const socket = connect(Number(process.env.MT5_TCP_PORT || 8080), process.env.MT5_TCP_HOST || '127.0.0.1');
socket.setEncoding('utf8');
socket.on('data', (data) => process.stdout.write(`gateway: ${data}`));
socket.on('error', (error) => { console.error(error.message); process.exitCode = 1; });

const envelope = (type: string, extra: Record<string, unknown> = {}) => ({
  type, version: 1, messageId: randomUUID(), timestamp: Date.now(), ...extra,
});
socket.on('connect', () => {
  socket.write(`${JSON.stringify(envelope('AUTH', { clientId: 'mt5-development-client', token }))}\n`);
  const symbols = ['EURUSD', 'GBPUSD', 'USDCHF', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD'];
  const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4'];
  for (const [index, symbol] of symbols.entries()) {
    const timeframe = timeframes[index % timeframes.length];
    socket.write(`${JSON.stringify(envelope('TICK', {
      symbol, timeframe,
      tick: { time: Math.floor(Date.now() / 1000), timeMsc: Date.now(), bid: 1.1 + index / 100, ask: 1.10013 + index / 100, last: 1.10005 + index / 100, volume: 1, volumeReal: 1, flags: 6 },
      spread: 0.00013,
    }))}\n`);
  }
  setInterval(() => socket.write(`${JSON.stringify(envelope('HEARTBEAT'))}\n`), 10000);
});
