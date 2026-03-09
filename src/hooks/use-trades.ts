import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { tradeKeys, type Trade, type TradeInsert, type TradeUpdate } from '@/types/trades';
import { calculatePnl } from '@/utils/pnl';

export interface TradeFilters {
  search?: string;
  side?: 'long' | 'short';
  status?: 'open' | 'closed';
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: unknown;
}

const PAGE_SIZE = 20;

export function useTrades(filters: TradeFilters = {}) {
  return useQuery({
    queryKey: tradeKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from('trades')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(PAGE_SIZE);

      if (filters.search) {
        query = query.ilike('symbol', `%${filters.search}%`);
      }
      if (filters.side) {
        query = query.eq('side', filters.side);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.tag) {
        query = query.or(
          `setup_tags.cs.{${filters.tag}},mistake_tags.cs.{${filters.tag}}`
        );
      }
      if (filters.dateFrom) {
        query = query.gte('entry_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('entry_date', filters.dateTo);
      }

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

      let pnl: number | null = null;
      let pnl_percent: number | null = null;

      if (input.status === 'closed' && input.exit_price != null) {
        const result = calculatePnl({
          side: input.side,
          entry_price: input.entry_price,
          exit_price: input.exit_price,
          size: input.size,
          fees: input.fees ?? 0,
        });
        pnl = result.pnl;
        pnl_percent = result.pnl_percent;
      }

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
      // Recalculate PnL if relevant fields changed
      let updates: TradeUpdate = { ...input };

      if (input.status === 'closed' && input.exit_price != null && input.entry_price != null && input.size != null && input.side != null) {
        const result = calculatePnl({
          side: input.side,
          entry_price: input.entry_price,
          exit_price: input.exit_price,
          size: input.size,
          fees: input.fees ?? 0,
        });
        updates.pnl = result.pnl;
        updates.pnl_percent = result.pnl_percent;
      }

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
    },
  });
}

export function useTradeStats(filters: TradeFilters = {}) {
  return useQuery({
    queryKey: tradeKeys.stats(filters),
    queryFn: async () => {
      let query = supabase
        .from('trades')
        .select('pnl, status')
        .eq('status', 'closed');

      if (filters.search) {
        query = query.ilike('symbol', `%${filters.search}%`);
      }
      if (filters.side) {
        query = query.eq('side', filters.side);
      }
      if (filters.tag) {
        query = query.or(
          `setup_tags.cs.{${filters.tag}},mistake_tags.cs.{${filters.tag}}`
        );
      }
      if (filters.dateFrom) {
        query = query.gte('entry_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('entry_date', filters.dateTo);
      }

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
