import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createServer, Server, Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { loadMt5TcpConfig, Mt5TcpConfig } from './mt5-config.js';
import { AuthAck } from './protocol.js';
import { MessageRouter } from './message-router.js';
import { Mt5ProtocolValidator } from './protocol-validator.js';

interface ClientState {
  socket: Socket; buffer: string; authenticated: boolean; clientId?: string;
  connectedAt: number; lastMessageAt: number; lastHeartbeatAt: number; messageIds: Set<string>;
}

@Injectable()
export class Mt5TcpServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Mt5TcpServer.name);
  private readonly clients = new Set<ClientState>();
  private server?: Server;
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly config: Mt5TcpConfig;
  constructor(private readonly validator: Mt5ProtocolValidator, private readonly router: MessageRouter) {
    this.config = loadMt5TcpConfig();
  }
  onModuleInit(): void {
    if (!this.config.authToken) this.logger.warn('MT5_TCP_AUTH_TOKEN is not configured; all AUTH attempts will fail');
    this.server = createServer((socket) => this.connect(socket));
    this.server.on('error', (error) => this.logger.error(`TCP server error: ${error.message}`));
    this.server.listen(this.config.port, this.config.host, () => this.logger.log(`MT5 TCP server listening on ${this.config.host}:${this.config.port}`));
    this.heartbeatTimer = setInterval(() => this.checkHeartbeats(), this.config.heartbeatIntervalMs);
  }
  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const client of this.clients) client.socket.destroy();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }
  private connect(socket: Socket): void {
    const now = Date.now();
    const state: ClientState = { socket, buffer: '', authenticated: false, connectedAt: now, lastMessageAt: now, lastHeartbeatAt: now, messageIds: new Set() };
    this.clients.add(state);
    this.logger.log(`MT5 client connected: ${socket.remoteAddress}:${socket.remotePort}`);
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.receive(state, chunk));
    socket.on('error', (error) => this.logger.warn(`MT5 TCP client error: ${error.message}`));
    socket.on('close', () => { this.clients.delete(state); this.logger.log(`MT5 client disconnected: ${state.clientId ?? 'unauthenticated'}`); });
  }
  private receive(state: ClientState, chunk: string): void {
    state.buffer += chunk;
    if (Buffer.byteLength(state.buffer) > this.config.maxMessageBytes) {
      this.logger.warn('MT5 message buffer exceeded maximum size'); state.socket.destroy(); return;
    }
    let newline = state.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = state.buffer.slice(0, newline).replace(/\r$/, '').trim();
      state.buffer = state.buffer.slice(newline + 1);
      if (line) this.processLine(state, line);
      newline = state.buffer.indexOf('\n');
    }
  }
  private processLine(state: ClientState, line: string): void {
    state.lastMessageAt = Date.now();
    let value: unknown;
    try { value = JSON.parse(line); } catch { this.logger.warn('Malformed MT5 JSON message'); return; }
    const result = this.validator.validate(value);
    if (!result.valid) { this.logger.warn(`Invalid MT5 message schema: ${result.error}`); return; }
    const message = result.message;
    if (state.messageIds.has(message.messageId)) { this.logger.warn(`Duplicate MT5 message ID: ${message.messageId}`); return; }
    state.messageIds.add(message.messageId);
    if (state.messageIds.size > 10000) state.messageIds.delete(state.messageIds.values().next().value as string);
    if (!state.authenticated) {
      if (message.type !== 'AUTH' || message.token !== this.config.authToken) {
        this.send(state.socket, { type: 'AUTH_ACK', version: 1, messageId: randomUUID(), timestamp: Date.now(), success: false, error: 'AUTHENTICATION_FAILED' });
        this.logger.warn('Invalid MT5 authentication'); state.socket.end(); return;
      }
      state.authenticated = true; state.clientId = message.clientId;
      this.send(state.socket, { type: 'AUTH_ACK', version: 1, messageId: randomUUID(), timestamp: Date.now(), success: true });
      this.logger.log(`MT5 client authenticated: ${state.clientId}`); return;
    }
    if (message.type === 'AUTH') return;
    if (message.type === 'HEARTBEAT') {
      state.lastHeartbeatAt = Date.now();
      this.send(state.socket, { type: 'HEARTBEAT_ACK', version: 1, messageId: randomUUID(), timestamp: Date.now() });
      this.logger.debug(`Heartbeat received: ${state.clientId}`); return;
    }
    this.router.route(message);
  }
  private send(socket: Socket, message: AuthAck | object): void { socket.write(`${JSON.stringify(message)}\n`); }
  private checkHeartbeats(): void {
    const cutoff = Date.now() - this.config.heartbeatTimeoutMs;
    for (const client of this.clients) if (client.authenticated && client.lastHeartbeatAt < cutoff) {
      this.logger.warn(`MT5 heartbeat timeout: ${client.clientId}`); client.socket.destroy();
    }
  }
}
