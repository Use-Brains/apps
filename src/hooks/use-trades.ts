import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { tradeKeys, type Trade, type TradeInsert, type TradeUpdate } from '@/types/trades';
import { strategyKeys } from '@/types/strategies';
import {
  applyTradeFilterOperations,
  buildTradeFilterOperations,
  type TradeFilters,
} from '@/utils/trade-query';
import {
  applyDerivedMetricsToTradeUpdate,
  deriveTradeMetricsForCreate,
} from '@/utils/trade-payloads';

const PAGE_SIZE = 20;

export type { TradeFilters };

export function useTrades(filters: TradeFilters = {}) {
  return useQuery({
    queryKey: tradeKeys.list(filters),
    queryFn: async () => {
      const baseQuery = supabase
        .from('trades')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(PAGE_SIZE);

      const query = applyTradeFilterOperations(baseQuery, buildTradeFilterOperations(filters));

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useTrade(id: string) {
  return useQuery({
    queryKey: tradeKeys.detail(id),
    queryFn: async () => {
      const [tradeResult, imagesResult] = await Promise.all([
        supabase.from('trades').select('*').eq('id', id).single(),
        supabase.from('trade_images').select('*').eq('trade_id', id).order('sort_order'),
      ]);
      if (tradeResult.error) throw tradeResult.error;
      return {
        ...tradeResult.data,
        trade_images: imagesResult.data ?? [],
      };
    },
    enabled: !!id,
  });
}

export function useCreateTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<TradeInsert, 'user_id' | 'pnl' | 'pnl_percent'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { pnl, pnl_percent } = deriveTradeMetricsForCreate(input);

      const { data, error } = await supabase
        .from('trades')
        .insert({ ...input, user_id: user.id, pnl, pnl_percent })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradeKeys.all });
    },
  });
}

export function useUpdateTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: TradeUpdate & { id: string }) => {
      const updates = applyDerivedMetricsToTradeUpdate(input);

      const { data, error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tradeKeys.all });
      queryClient.setQueryData(tradeKeys.detail(data.id), data);
    },
  });
}

export function useDeleteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradeKeys.all });
      // Invalidate strategy stats since linked trades may have been deleted
      queryClient.invalidateQueries({ queryKey: strategyKeys.all });
    },
  });
}

export function useTradeStats(filters: TradeFilters = {}) {
  return useQuery({
    queryKey: tradeKeys.stats(filters),
    queryFn: async () => {
      const baseQuery = supabase
        .from('trades')
        .select('pnl, status')
        .eq('status', 'closed');

      const operations = buildTradeFilterOperations({
        ...filters,
        status: undefined,
      });
      const query = applyTradeFilterOperations(baseQuery, operations);

      const { data, error } = await query;
      if (error) throw error;

      const trades = data ?? [];
      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

      return {
        totalPnl,
        winRate,
        tradeCount: trades.length,
      };
    },
  });
}

export function useDistinctTags() {
  return useQuery({
    queryKey: tradeKeys.tags(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('setup_tags, mistake_tags');
      if (error) throw error;

      const setupTags = new Set<string>();
      const mistakeTags = new Set<string>();
      for (const row of data ?? []) {
        row.setup_tags?.forEach((t: string) => setupTags.add(t));
        row.mistake_tags?.forEach((t: string) => mistakeTags.add(t));
      }

      return {
        setupTags: Array.from(setupTags).sort(),
        mistakeTags: Array.from(mistakeTags).sort(),
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
