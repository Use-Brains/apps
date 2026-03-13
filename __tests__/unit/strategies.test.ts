import { describe, it, expect } from 'vitest';
import { strategyFormSchema, strategyPlaceholderSchema, STRATEGY_STATUSES } from '../../src/types/strategies';
import {
  compactFavoriteRanks,
  reorderFavorites,
  aggregateStrategyStats,
  dedupeByTradeId,
} from '../../src/utils/strategy-payloads';
import type { Strategy } from '../../src/types/strategies';
import type { Trade } from '../../src/types/trades';

// -- strategyFormSchema --

describe('strategyFormSchema', () => {
  const validData = {
    title: 'Breakout Retest',
    status: 'active' as const,
    market_conditions: [],
    asset_classes: [],
    timeframes: [],
  };

  it('valid full form data passes', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      emoji: '📈',
      color: '#4A90D9',
      description: 'Buy breakout retests on high volume',
      entry_criteria: 'Price breaks above resistance and retests',
      exit_criteria: 'Close below entry',
      expected_win_rate: 60,
      risk_reward_ratio: 2.5,
      market_conditions: ['trending'],
      asset_classes: ['crypto'],
      timeframes: ['1h', '4h'],
      notes: 'Works best in trending markets',
    });
    expect(result.success).toBe(true);
  });

  it('missing title fails', () => {
    const result = strategyFormSchema.safeParse({ ...validData, title: '' });
    expect(result.success).toBe(false);
  });

  it('active_to before active_from fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      active_from: '2026-06-01',
      active_to: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('active_to set without active_from fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      active_to: '2026-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('expected_win_rate > 100 fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      expected_win_rate: 101,
    });
    expect(result.success).toBe(false);
  });

  it('expected_win_rate = 0 passes', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      expected_win_rate: 0,
    });
    expect(result.success).toBe(true);
  });

  it('risk_reward_ratio <= 0 fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      risk_reward_ratio: 0,
    });
    expect(result.success).toBe(false);
  });

  it('emoji and color are optional', () => {
    const result = strategyFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('empty string for expected_win_rate produces undefined', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      expected_win_rate: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expected_win_rate).toBeUndefined();
    }
  });

  it('empty string for risk_reward_ratio produces undefined', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      risk_reward_ratio: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.risk_reward_ratio).toBeUndefined();
    }
  });

  it('active_from YYYY-MM-DD passes, non-ISO format fails', () => {
    const good = strategyFormSchema.safeParse({
      ...validData,
      active_from: '2026-03-10',
    });
    expect(good.success).toBe(true);

    const bad = strategyFormSchema.safeParse({
      ...validData,
      active_from: '03/10/2026',
    });
    expect(bad.success).toBe(false);
  });

  it('color must match #RRGGBB regex or be omitted', () => {
    const valid = strategyFormSchema.safeParse({ ...validData, color: '#FF0000' });
    expect(valid.success).toBe(true);

    const invalid = strategyFormSchema.safeParse({ ...validData, color: 'red' });
    expect(invalid.success).toBe(false);

    const short = strategyFormSchema.safeParse({ ...validData, color: '#FFF' });
    expect(short.success).toBe(false);
  });

  it('description > 2000 chars fails', () => {
    const result = strategyFormSchema.safeParse({
      ...validData,
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// -- strategyPlaceholderSchema --

describe('strategyPlaceholderSchema', () => {
  it('title only (no description) passes', () => {
    const result = strategyPlaceholderSchema.safeParse({
      title: 'Quick Setup',
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('archived status rejected', () => {
    const result = strategyPlaceholderSchema.safeParse({
      title: 'Test',
      status: 'archived',
    });
    expect(result.success).toBe(false);
  });

  it('derives from STRATEGY_STATUSES — active and testing pass', () => {
    for (const status of ['active', 'testing'] as const) {
      const result = strategyPlaceholderSchema.safeParse({ title: 'Test', status });
      expect(result.success).toBe(true);
    }
  });
});

// -- Favorite ordering --

describe('favorite ordering (strategy-payloads)', () => {
  const makeStrategy = (id: string, order: number | null): Strategy =>
    ({
      id,
      favorite_order: order,
      title: id,
      user_id: 'u1',
      status: 'active',
      emoji: null,
      color: null,
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
      created_at: '',
      updated_at: '',
    }) as Strategy;

  it('compactFavoriteRanks([1,3,5]) → [1,2,3]', () => {
    const input = [makeStrategy('A', 1), makeStrategy('B', 3), makeStrategy('C', 5)];
    const result = compactFavoriteRanks(input);
    expect(result.map((s) => s.favorite_order)).toEqual([1, 2, 3]);
  });

  it('reorderFavorites([A,B,C], 2, 0) → [C,A,B] with ranks 1,2,3', () => {
    const input = [makeStrategy('A', 1), makeStrategy('B', 2), makeStrategy('C', 3)];
    const result = reorderFavorites(input, 2, 0);
    expect(result.map((s) => s.id)).toEqual(['C', 'A', 'B']);
    expect(result.map((s) => s.favorite_order)).toEqual([1, 2, 3]);
  });

  it('remove rank from middle → remaining compacted', () => {
    const input = [makeStrategy('A', 1), makeStrategy('C', 3)];
    const result = compactFavoriteRanks(input);
    expect(result.map((s) => s.favorite_order)).toEqual([1, 2]);
  });
});

// -- aggregateStrategyStats --

describe('aggregateStrategyStats', () => {
  const makeTrade = (overrides: Partial<Trade> = {}): Trade =>
    ({
      id: Math.random().toString(),
      user_id: 'u1',
      symbol: 'BTC',
      asset_class: 'crypto',
      side: 'long',
      size: 1,
      entry_price: 100,
      exit_price: 110,
      pnl: 10,
      pnl_percent: 10,
      fees: 0,
      confidence: null,
      thesis: null,
      notes: null,
      setup_tags: [],
      mistake_tags: [],
      entry_date: '2026-01-01',
      exit_date: '2026-01-02',
      status: 'closed',
      created_at: '',
      updated_at: '',
      ...overrides,
    }) as Trade;

  it('0 trades → totalClosedTrades=0, winRate=null', () => {
    const stats = aggregateStrategyStats([]);
    expect(stats.totalClosedTrades).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.avgRealizedRR).toBeNull();
    expect(stats.totalPnl).toBe(0);
  });

  it('5 wins, 5 losses → 50% win rate', () => {
    const trades = [
      ...Array.from({ length: 5 }, () => makeTrade({ pnl: 10, pnl_percent: 10 })),
      ...Array.from({ length: 5 }, () => makeTrade({ pnl: -10, pnl_percent: -10 })),
    ];
    const stats = aggregateStrategyStats(trades);
    expect(stats.totalClosedTrades).toBe(10);
    expect(stats.winRate).toBe(50);
  });

  it('all trades open → winRate=null, avgRealizedRR=null', () => {
    const trades = [
      makeTrade({ status: 'open', exit_price: null, pnl: null, pnl_percent: null }),
      makeTrade({ status: 'open', exit_price: null, pnl: null, pnl_percent: null }),
    ];
    const stats = aggregateStrategyStats(trades);
    expect(stats.totalClosedTrades).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.avgRealizedRR).toBeNull();
  });

  it('mixed open and closed → only closed counted', () => {
    const trades = [
      makeTrade({ pnl: 20 }),
      makeTrade({ status: 'open', exit_price: null, pnl: null, pnl_percent: null }),
    ];
    const stats = aggregateStrategyStats(trades);
    expect(stats.totalClosedTrades).toBe(1);
    expect(stats.winRate).toBe(100);
  });

  it('P&L sum correct', () => {
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -30 }),
      makeTrade({ pnl: 50 }),
    ];
    const stats = aggregateStrategyStats(trades);
    expect(stats.totalPnl).toBe(120);
  });

  it('best/worst correctly identified with negative P&L trades', () => {
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: 20 }),
    ];
    const stats = aggregateStrategyStats(trades);
    expect(stats.bestTradePnl).toBe(100);
    expect(stats.worstTradePnl).toBe(-50);
  });
});

// -- dedupeByTradeId --

describe('dedupeByTradeId', () => {
  it('removes duplicates by id', () => {
    const a = [{ id: '1' }, { id: '2' }];
    const b = [{ id: '2' }, { id: '3' }];
    const result = dedupeByTradeId(a, b);
    expect(result.map((t) => t.id)).toEqual(['1', '2', '3']);
  });
});
