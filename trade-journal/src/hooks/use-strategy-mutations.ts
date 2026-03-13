import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  strategyKeys,
  type Strategy,
  type StrategyInsert,
  type StrategyUpdate,
  type SetStrategyOnTradeInput,
  type RemoveStrategyFromTradeInput,
} from '@/types/strategies';
import { tradeKeys } from '@/types/trades';

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<StrategyInsert, 'user_id'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('strategies')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;

      // One-time setup_tags migration: link existing trades with matching tags
      const { data: matchingTrades } = await supabase
        .from('trades')
        .select('id')
        .eq('user_id', user.id)
        .ilike('setup_tags', `%${data.title}%`);

      if (matchingTrades && matchingTrades.length > 0) {
        await supabase.from('trade_strategies').upsert(
          matchingTrades.map((t) => ({ trade_id: t.id, strategy_id: data.id })),
          { onConflict: 'trade_id,strategy_id', ignoreDuplicates: true }
        );
      }

      return data as Strategy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: StrategyUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('strategies')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Strategy;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
      queryClient.setQueryData(strategyKeys.detail(data.id), data);
    },
  });
}

export function useArchiveStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('strategies')
        .update({ status: 'archived', favorite_order: null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Strategy;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
      queryClient.setQueryData(strategyKeys.detail(data.id), data);
    },
  });
}

export function useReorderFavorites() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reordered: { id: string; favorite_order: number }[]) => {
      // Only updating id + favorite_order, cast to satisfy full row type
      const { error } = await supabase
        .from('strategies')
        .upsert(reordered as any[], { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
    },
  });
}

export function useFavoriteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current max favorite_order
      const { data: existing } = await supabase
        .from('strategies')
        .select('favorite_order')
        .eq('user_id', user.id)
        .not('favorite_order', 'is', null)
        .order('favorite_order', { ascending: false })
        .limit(1);

      const maxOrder = existing?.[0]?.favorite_order ?? 0;

      const { data, error } = await supabase
        .from('strategies')
        .update({ favorite_order: maxOrder + 1 })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Strategy;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
    },
  });
}

export function useUnfavoriteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.rpc('compact_favorites', {
        p_user_id: user.id,
        p_strategy_id: strategyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.lists() });
    },
  });
}

export function useSetStrategyOnTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tradeId, strategyIds }: SetStrategyOnTradeInput) => {
      // Delete existing associations then insert new ones
      await supabase.from('trade_strategies').delete().eq('trade_id', tradeId);

      if (strategyIds.length > 0) {
        const { error } = await supabase
          .from('trade_strategies')
          .upsert(
            strategyIds.map((id) => ({ trade_id: tradeId, strategy_id: id })),
            { onConflict: 'trade_id,strategy_id', ignoreDuplicates: true }
          );
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      // Invalidate stats for all affected strategies
      for (const id of variables.strategyIds) {
        queryClient.invalidateQueries({ queryKey: strategyKeys.stats(id) });
      }
      queryClient.invalidateQueries({ queryKey: tradeKeys.all });
    },
  });
}

export function useRemoveStrategyFromTrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tradeId, strategyId }: RemoveStrategyFromTradeInput) => {
      const { error } = await supabase
        .from('trade_strategies')
        .delete()
        .eq('trade_id', tradeId)
        .eq('strategy_id', strategyId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.stats(variables.strategyId) });
    },
  });
}
