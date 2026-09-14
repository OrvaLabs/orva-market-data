export interface Mt5TcpConfig {
  host: string;
  port: number;
  authToken: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  logTicks: boolean;
  maxMessageBytes: number;
}

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadMt5TcpConfig(env: NodeJS.ProcessEnv = process.env): Mt5TcpConfig {
  return {
    host: env.MT5_TCP_HOST || '127.0.0.1',
    port: positiveInt(env.MT5_TCP_PORT, 8080),
    authToken: env.MT5_TCP_AUTH_TOKEN || '',
    heartbeatIntervalMs: positiveInt(env.MT5_TCP_HEARTBEAT_INTERVAL_MS, 10000),
    heartbeatTimeoutMs: positiveInt(env.MT5_TCP_HEARTBEAT_TIMEOUT_MS, 30000),
    logTicks: env.MT5_TCP_LOG_TICKS === 'true',
    maxMessageBytes: positiveInt(env.MT5_TCP_MAX_MESSAGE_BYTES, 1024 * 1024),
  };
}
