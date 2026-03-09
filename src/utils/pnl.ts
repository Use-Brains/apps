interface PnlInput {
  side: 'long' | 'short';
  entry_price: number;
  exit_price: number;
  size: number;
  fees: number;
}

export function calculatePnl(input: PnlInput): { pnl: number; pnl_percent: number } {
  const { side, entry_price, exit_price, size, fees } = input;

  const rawPnl =
    side === 'long'
      ? (exit_price - entry_price) * size
      : (entry_price - exit_price) * size;

  const pnl = rawPnl - fees;
  const costBasis = entry_price * size;
  const pnl_percent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return {
    pnl: Math.round(pnl * 1e8) / 1e8,
    pnl_percent: Math.round(pnl_percent * 1e4) / 1e4,
  };
}
