import { connect, Socket } from 'node:net';
import { MarketDataService } from './market-data.service.js';
import { MessageRouter } from './message-router.js';
import { Mt5ProtocolValidator } from './protocol-validator.js';
import { Mt5TcpServer } from './mt5-tcp.server.js';

const frame = (value: Record<string, unknown>) => `${JSON.stringify(value)}\n`;
const envelope = (type: string, extra: Record<string, unknown> = {}) => ({
  type, version: 1, messageId: `${type}-${Math.random()}`, timestamp: Date.now(), ...extra,
});

describe('Mt5TcpServer', () => {
  let server: Mt5TcpServer;
  let socket: Socket;
  const port = 18080;
  const previous = { token: process.env.MT5_TCP_AUTH_TOKEN, port: process.env.MT5_TCP_PORT };

  beforeAll(async () => {
    process.env.MT5_TCP_AUTH_TOKEN = 'test-token';
    process.env.MT5_TCP_PORT = String(port);
    const marketData = new MarketDataService();
    server = new Mt5TcpServer(new Mt5ProtocolValidator(), new MessageRouter(marketData));
    server.onModuleInit();
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    socket = await new Promise<Socket>((resolve, reject) => {
      const client = connect(port, '127.0.0.1');
      client.once('connect', () => resolve(client));
      client.once('error', reject);
    });
    socket.setEncoding('utf8');
  });
  afterAll(async () => {
    socket?.destroy();
    await server.onModuleDestroy();
    if (previous.token === undefined) delete process.env.MT5_TCP_AUTH_TOKEN; else process.env.MT5_TCP_AUTH_TOKEN = previous.token;
    if (previous.port === undefined) delete process.env.MT5_TCP_PORT; else process.env.MT5_TCP_PORT = previous.port;
  });

  it('authenticates and handles split plus batched NDJSON frames', async () => {
    const auth = envelope('AUTH', { clientId: 'test-client', token: 'test-token' });
    const tick = envelope('TICK', {
      symbol: 'EURUSD', timeframe: 'M1',
      tick: { time: 1, timeMsc: 1, bid: 1.1, ask: 1.2, last: 1.15, volume: 1, volumeReal: 1, flags: 6 }, spread: 0.1,
    });
    const responses: string[] = [];
    socket.on('data', (data) => responses.push(...data.split('\n').filter(Boolean)));
    const authFrame = frame(auth);
    socket.write(authFrame.slice(0, 8));
    socket.write(authFrame.slice(8) + frame(tick) + frame({ ...tick, messageId: 'second', symbol: 'GBPUSD' }));
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(JSON.parse(responses[0]).success).toBe(true);
    expect(responses).toHaveLength(1);
  });
});
