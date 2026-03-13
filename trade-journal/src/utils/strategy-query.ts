import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { StrategyFilters } from '@/types/strategies';

export function buildStrategyFilterQuery(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters?: StrategyFilters
) {
  let query = supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId);

  // Status filter
  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  } else if (!filters?.status || filters.status === 'all') {
    // Default: exclude archived
    query = query.neq('status', 'archived');
  }

  // Sort order
  switch (filters?.sortBy) {
    case 'win_rate':
      // Flat list, favorites pinned at top
      query = query
        .order('favorite_order', { ascending: true, nullsFirst: false })
        .order('title', { ascending: true });
      break;
    case 'most_recently_used':
      // Flat list, favorites pinned at top
      query = query
        .order('favorite_order', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false });
      break;
    case 'status':
    default:
      // Grouped view: favorites first, then by status, then alphabetical
      query = query
        .order('favorite_order', { ascending: true, nullsFirst: false })
        .order('status', { ascending: true })
        .order('title', { ascending: true });
      break;
  }

  return query;
}
