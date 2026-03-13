import { describe, it, expect } from 'vitest';
import {
  strategyFormSchema,
  strategyPlaceholderSchema,
  strategyStatsSchema,
  type StrategyFormData,
} from '../../src/types/strategies';
import {
  aggregateStrategyStats,
  compactFavoriteRanks,
  reorderFavorites,
  dedupeByTradeId,
} from '../../src/utils/strategy-payloads';
import { buildStrategyFilterQuery } from '../../src/utils/strategy-query';

// -- Helpers --

interface FakeCall {
  method: string;
  args: unknown[];
}

function createFakeSupabase() {
  const calls: FakeCall[] = [];
  const fakeQuery = {
    select(...args: unknown[]) { calls.push({ method: 'select', args }); return this; },
    eq(...args: unknown[]) { calls.push({ method: 'eq', args }); return this; },
    neq(...args: unknown[]) { calls.push({ method: 'neq', args }); return this; },
    order(...args: unknown[]) { calls.push({ method: 'order', args }); return this; },
  };
  const supabase = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      return fakeQuery;
    },
  };
  return { supabase, calls };
}

const makeTrade = (overrides: Record<string, unknown> = {}) => ({
  id: Math.random().toString(36).slice(2),
  user_id: 'u1',
  symbol: 'BTC',
  asset_class: 'crypto' as const,
  side: 'long' as const,
  size: 1,
  entry_price: 100,
  exit_price: 110,
  pnl: 0,
  pnl_percent: 0,
  fees: 0,
  confidence: null,
  thesis: null,
  notes: null,
  setup_tags: [],
  mistake_tags: [],
  entry_date: '2026-01-01',
  exit_date: '2026-01-02',
  status: 'closed' as const,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// -- Integration: Form → Payload Pipeline --

describe('strategy form → payload pipeline', () => {
  const validForm: Record<string, unknown> = {
    title: 'Breakout Retest',
    status: 'active',
    emoji: '📈',
    color: '#4A90D9',
    description: 'Wait for retest of breakout level',
    entry_criteria: 'Price retests breakout level with confirmation',
    exit_criteria: 'Target 2R or trail stop',
    expected_win_rate: '65',
    risk_reward_ratio: '2.5',
    market_conditions: ['trending'],
    asset_classes: ['crypto'],
    timeframes: ['1h', '4h'],
    notes: 'Works best in strong trends',
  };

  it('valid form parses and transforms numeric fields', () => {
    const result = strategyFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.expected_win_rate).toBe(65);
    expect(result.data.risk_reward_ratio).toBe(2.5);
    expect(typeof result.data.expected_win_rate).toBe('number');
  });

  it('empty string numerics transform to undefined', () => {
    const result = strategyFormSchema.safeParse({
      ...validForm,
      expected_win_rate: '',
      risk_reward_ratio: '',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.expected_win_rate).toBeUndefined();
    expect(result.data.risk_reward_ratio).toBeUndefined();
  });

  it('date refinement: active_to before active_from fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validForm,
      active_from: '2026-06-01',
      active_to: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('date refinement: active_to without active_from fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validForm,
      active_to: '2026-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('placeholder schema accepts minimal input', () => {
    const result = strategyPlaceholderSchema.safeParse({
      title: 'Quick Setup',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('placeholder schema rejects archived status', () => {
    const result = strategyPlaceholderSchema.safeParse({
      title: 'Quick Setup',
      status: 'archived',
    });
    expect(result.success).toBe(false);
  });

  it('stats schema validates aggregated stats shape', () => {
    const stats = aggregateStrategyStats([
      makeTrade({ pnl: 50, pnl_percent: 5 }),
      makeTrade({ pnl: -20, pnl_percent: -2 }),
    ]);
    const result = strategyStatsSchema.safeParse(stats);
    expect(result.success).toBe(true);
  });
});

// -- Integration: Filter Query Builder --

describe('buildStrategyFilterQuery', () => {
  it('no filters → selects all, orders by favorite then status', () => {
    const { supabase, calls } = createFakeSupabase();
    buildStrategyFilterQuery(supabase as any, 'user-1');

    expect(calls[0]).toEqual({ method: 'from', args: ['strategies'] });
    expect(calls[1]).toEqual({ method: 'select', args: ['*'] });
    expect(calls[2]).toEqual({ method: 'eq', args: ['user_id', 'user-1'] });
  });

  it('status filter adds eq clause', () => {
    const { supabase, calls } = createFakeSupabase();
    buildStrategyFilterQuery(supabase as any, 'user-1', { status: 'active' });

    const eqCalls = calls.filter((c) => c.method === 'eq');
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['status', 'active'] });
  });

  it('status "all" does not add status eq', () => {
    const { supabase, calls } = createFakeSupabase();
    buildStrategyFilterQuery(supabase as any, 'user-1', { status: 'all' });

    const statusEqs = calls.filter(
      (c) => c.method === 'eq' && c.args[0] === 'status'
    );
    expect(statusEqs).toHaveLength(0);
  });

  it('neq filter for archived excludes archived strategies', () => {
    const { supabase, calls } = createFakeSupabase();
    buildStrategyFilterQuery(supabase as any, 'user-1', { status: undefined });

    const neqCalls = calls.filter((c) => c.method === 'neq');
    expect(neqCalls).toContainEqual({ method: 'neq', args: ['status', 'archived'] });
  });
});

// -- Integration: Favorite Reorder Pipeline --

describe('favorite reorder pipeline', () => {
  it('compact + reorder produces valid ranks for upsert', () => {
    const makeStrategy = (id: string, order: number) => ({
      id,
      user_id: 'u1',
      title: id,
      emoji: null,
      color: null,
      status: 'active' as const,
      active_from: null,
      active_to: null,
      description: null,
      entry_criteria: null,
      exit_criteria: null,
      expected_win_rate: null,
      risk_reward_ratio: null,
      market_conditions: [],
      asset_classes: [],
      timeframes: [],
      notes: null,
      favorite_order: order,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const strategies = [
      makeStrategy('a', 1),
      makeStrategy('b', 3),
      makeStrategy('c', 5),
    ];

    // Compact first (simulates DB compaction)
    const compacted = compactFavoriteRanks(strategies);
    expect(compacted.map((s) => s.favorite_order)).toEqual([1, 2, 3]);

    // Move a (index 0) to position 2 → [b, c, a]
    const reordered = reorderFavorites(compacted, 0, 2);
    expect(reordered[0].id).toBe('b');
    expect(reordered[1].id).toBe('c');
    expect(reordered[2].id).toBe('a');
    expect(reordered.map((s) => s.favorite_order)).toEqual([1, 2, 3]);
  });

  it('reorder is a no-op when from === to', () => {
    const items = [
      { id: 'x', favorite_order: 1 },
      { id: 'y', favorite_order: 2 },
    ] as any[];
    const result = reorderFavorites(items, 0, 0);
    expect(result[0].id).toBe('x');
    expect(result[1].id).toBe('y');
  });
});

// -- Integration: Stats Aggregation End-to-End --

describe('stats aggregation end-to-end', () => {
  it('mixed trades produce correct win rate and P&L', () => {
    const trades = [
      makeTrade({ pnl: 100, pnl_percent: 10 }),
      makeTrade({ pnl: 50, pnl_percent: 5 }),
      makeTrade({ pnl: -30, pnl_percent: -3 }),
      makeTrade({ pnl: -20, pnl_percent: -2 }),
    ];

    const stats = aggregateStrategyStats(trades);
    expect(stats.totalClosedTrades).toBe(4);
    expect(stats.winRate).toBe(50); // 2 wins / 4 total
    expect(stats.totalPnl).toBe(100);
    expect(stats.bestTradePnl).toBe(100);
    expect(stats.worstTradePnl).toBe(-30);
  });

  it('open trades are filtered out', () => {
    const trades = [
      makeTrade({ pnl: 100, status: 'closed' }),
      makeTrade({ pnl: null, status: 'open' }),
      makeTrade({ pnl: -50, status: 'closed' }),
    ];

    const stats = aggregateStrategyStats(trades);
    expect(stats.totalClosedTrades).toBe(2);
    expect(stats.totalPnl).toBe(50);
  });

  it('stats with zero closed trades return null rates', () => {
    const stats = aggregateStrategyStats([]);
    expect(stats.totalClosedTrades).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.avgRealizedRR).toBeNull();
    expect(stats.totalPnl).toBe(0);
    expect(stats.bestTradePnl).toBeNull();
    expect(stats.worstTradePnl).toBeNull();
  });

  it('stats schema validates the output', () => {
    const trades = [
      makeTrade({ pnl: 200, pnl_percent: 20 }),
      makeTrade({ pnl: -100, pnl_percent: -10 }),
    ];
    const stats = aggregateStrategyStats(trades);
    const validation = strategyStatsSchema.safeParse(stats);
    expect(validation.success).toBe(true);
  });
});

// -- Integration: Dedupe Pipeline --

describe('dedupeByTradeId pipeline', () => {
  it('deduplicates junction rows by id across two arrays', () => {
    const a = [
      { id: 't1', strategy_id: 's1' },
      { id: 't2', strategy_id: 's1' },
    ];
    const b = [
      { id: 't1', strategy_id: 's2' }, // duplicate id
      { id: 't3', strategy_id: 's1' },
    ];
    const result = dedupeByTradeId(a, b);
    expect(result).toHaveLength(3);
    const ids = result.map((r) => r.id);
    expect(ids).toEqual(['t1', 't2', 't3']);
  });

  it('empty inputs returns empty array', () => {
    expect(dedupeByTradeId([], [])).toEqual([]);
  });
});
