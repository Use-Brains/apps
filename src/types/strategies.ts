import { z } from 'zod';
import type { Database } from './database';
import { ASSET_CLASS_VALUES, TIMEFRAME_VALUES } from './common';

// -- Enum constants --

export const STRATEGY_STATUSES = ['active', 'testing', 'archived'] as const;
export const MARKET_CONDITIONS = [
  'trending', 'choppy', 'high_volatility', 'low_volatility', 'range_bound',
] as const;
export const ASSET_CLASSES = ASSET_CLASS_VALUES;
export const TIMEFRAMES = TIMEFRAME_VALUES;

// -- Full strategy form schema --

export const strategyFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100),
  emoji: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color').optional(),
  status: z.enum(STRATEGY_STATUSES),
  active_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  active_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  description: z.string().max(2000).optional(),
  entry_criteria: z.string().max(2000).optional(),
  exit_criteria: z.string().max(2000).optional(),
  expected_win_rate: z.union([z.literal(''), z.coerce.number().min(0).max(100)]).optional()
    .transform(v => v === '' ? undefined : v),
  risk_reward_ratio: z.union([z.literal(''), z.coerce.number().positive()]).optional()
    .transform(v => v === '' ? undefined : v),
  market_conditions: z.array(z.enum(MARKET_CONDITIONS)).default([]),
  asset_classes: z.array(z.enum(ASSET_CLASS_VALUES)).default([]),
  timeframes: z.array(z.enum(TIMEFRAME_VALUES)).default([]),
  notes: z.string().max(2000).optional(),
}).refine(
  (d) => !d.active_from || !d.active_to || new Date(d.active_to) >= new Date(d.active_from),
  { message: 'End date must be after start date', path: ['active_to'] }
).refine(
  (d) => d.active_from != null || d.active_to == null,
  { message: 'Cannot set end date without a start date', path: ['active_to'] }
);

export type StrategyFormData = z.output<typeof strategyFormSchema>;

// Minimal schema for placeholder creation from trade entry
export const strategyPlaceholderSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'testing'] as [
    typeof STRATEGY_STATUSES[0],
    typeof STRATEGY_STATUSES[1]
  ]),
});
export type StrategyPlaceholderData = z.output<typeof strategyPlaceholderSchema>;

// -- DB type aliases --

export type Strategy = Database['public']['Tables']['strategies']['Row'];
export type StrategyInsert = Database['public']['Tables']['strategies']['Insert'];
export type StrategyUpdate = Database['public']['Tables']['strategies']['Update'];
export type TradeStrategy = Database['public']['Tables']['trade_strategies']['Row'];
export type StrategyImage = Database['public']['Tables']['strategy_images']['Row'];

// -- Typed filter interface --

export interface StrategyFilters {
  status?: typeof STRATEGY_STATUSES[number] | 'all';
  sortBy?: 'status' | 'win_rate' | 'most_recently_used';
}

// -- Query key factory --

export const strategyKeys = {
  all: ['strategies'] as const,
  lists: () => [...strategyKeys.all, 'list'] as const,
  list: (filters?: StrategyFilters) =>
    [...strategyKeys.lists(), filters ?? {}] as const,
  details: () => [...strategyKeys.all, 'detail'] as const,
  detail: (id: string) => [...strategyKeys.details(), id] as const,
  stats: (id: string) => [...strategyKeys.all, 'stats', id] as const,
};

// -- Computed stats type --

export const strategyStatsSchema = z.object({
  totalClosedTrades: z.number().int().nonnegative(),
  winRate: z.number().nullable(),
  avgRealizedRR: z.number().nullable(),
  totalPnl: z.number(),
  bestTradePnl: z.number().nullable(),
  worstTradePnl: z.number().nullable(),
});
export type StrategyStats = z.infer<typeof strategyStatsSchema>;

// -- Mutation input types --

export interface SetStrategyOnTradeInput {
  tradeId: string;
  strategyIds: string[];
}
export interface RemoveStrategyFromTradeInput {
  tradeId: string;
  strategyId: string;
}
