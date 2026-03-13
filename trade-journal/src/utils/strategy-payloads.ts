import type { Strategy, StrategyStats } from '@/types/strategies';
import type { Trade } from '@/types/trades';

export function compactFavoriteRanks(strategies: Strategy[]): Strategy[] {
  return strategies
    .filter((s) => s.favorite_order != null)
    .sort((a, b) => (a.favorite_order ?? 0) - (b.favorite_order ?? 0))
    .map((s, i) => ({ ...s, favorite_order: i + 1 }));
}

export function reorderFavorites(
  strategies: Strategy[],
  fromIndex: number,
  toIndex: number
): Strategy[] {
  const items = [...strategies];
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return items.map((s, i) => ({ ...s, favorite_order: i + 1 }));
}

export function aggregateStrategyStats(trades: Trade[]): StrategyStats {
  const closed = trades.filter((t) => t.status === 'closed');
  const totalClosedTrades = closed.length;

  if (totalClosedTrades === 0) {
    return {
      totalClosedTrades: 0,
      winRate: null,
      avgRealizedRR: null,
      totalPnl: 0,
      bestTradePnl: null,
      worstTradePnl: null,
    };
  }

  const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = (wins / totalClosedTrades) * 100;

  const pnls = closed.map((t) => t.pnl ?? 0);
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
  const bestTradePnl = Math.max(...pnls);
  const worstTradePnl = Math.min(...pnls);

  const rrValues = closed
    .map((t) => t.pnl_percent)
    .filter((v): v is number => v != null);
  const avgRealizedRR = rrValues.length > 0
    ? rrValues.reduce((sum, v) => sum + v, 0) / rrValues.length
    : null;

  return { totalClosedTrades, winRate, avgRealizedRR, totalPnl, bestTradePnl, worstTradePnl };
}

export function dedupeByTradeId<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Set(a.map((t) => t.id));
  return [...a, ...b.filter((t) => !seen.has(t.id))];
}
