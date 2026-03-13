import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  strategyKeys,
  type Strategy,
  type StrategyFilters,
} from '@/types/strategies';
import { buildStrategyFilterQuery } from '@/utils/strategy-query';
import { aggregateStrategyStats } from '@/utils/strategy-payloads';

export function useStrategies(filters?: StrategyFilters) {
  return useQuery({
    queryKey: strategyKeys.list(filters),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await buildStrategyFilterQuery(supabase, user.id, filters);
      if (error) throw error;
      return data as Strategy[];
    },
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: strategyKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Strategy;
    },
    enabled: !!id,
  });
}

export function useStrategyStats(id: string) {
  return useQuery({
    queryKey: strategyKeys.stats(id),
    queryFn: async () => {
      const { data: links, error: linkError } = await supabase
        .from('trade_strategies')
        .select('trade_id')
        .eq('strategy_id', id);
      if (linkError) throw linkError;

      const tradeIds = (links ?? []).map((r) => r.trade_id);
      if (tradeIds.length === 0) {
        return aggregateStrategyStats([]);
      }

      const { data: trades, error: tradeError } = await supabase
        .from('trades')
        .select('id, pnl, pnl_percent, status')
        .in('id', tradeIds);
      if (tradeError) throw tradeError;

      return aggregateStrategyStats(trades as any[]);
    },
    enabled: !!id,
  });
}

export function useStrategiesForTrade(tradeId: string) {
  return useQuery({
    queryKey: [...strategyKeys.all, 'trade', tradeId] as const,
    queryFn: async () => {
      const { data: links, error: linkError } = await supabase
        .from('trade_strategies')
        .select('strategy_id')
        .eq('trade_id', tradeId);
      if (linkError) throw linkError;

      const ids = (links ?? []).map((r) => r.strategy_id);
      if (ids.length === 0) return [] as Strategy[];

      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .in('id', ids);
      if (error) throw error;
      return data as Strategy[];
    },
    enabled: !!tradeId,
  });
}
