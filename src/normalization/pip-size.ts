const PIP_SIZE_TABLE: Record<string, number> = {
  EURUSD: 0.0001,
  GBPUSD: 0.0001,
  AUDUSD: 0.0001,
  NZDUSD: 0.0001,
  USDCAD: 0.0001,
  USDCHF: 0.0001,

  USDJPY: 0.01,
  EURJPY: 0.01,
  GBPJPY: 0.01,
  AUDJPY: 0.01,
  NZDJPY: 0.01,
  CADJPY: 0.01,
  CHFJPY: 0.01,

  EURGBP: 0.0001,
  EURAUD: 0.0001,
  EURNZD: 0.0001,
  EURCAD: 0.0001,
  EURCHF: 0.0001,
  GBPAUD: 0.0001,
  GBPNZD: 0.0001,
  GBPCAD: 0.0001,
  GBPCHF: 0.0001,
  AUDNZD: 0.0001,
  AUDCAD: 0.0001,
  AUDCHF: 0.0001,
  NZDCAD: 0.0001,
  NZDCHF: 0.0001,
  CADCHF: 0.0001,
};

const DEFAULT_PIP_SIZE = 0.0001;

export function getPipSize(symbol: string): number {
  const normalized = symbol.replace(/[^A-Z]/g, '').toUpperCase();
  return PIP_SIZE_TABLE[normalized] ?? DEFAULT_PIP_SIZE;
}
