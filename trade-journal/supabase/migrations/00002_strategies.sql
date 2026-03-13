-- ============================================
-- STRATEGIES
-- ============================================
create table public.strategies (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users on delete cascade not null,
  title             text not null,
  emoji             text,
  color             text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  status            text not null default 'active'
                      check (status in ('active', 'testing', 'archived')),
  active_from       date,
  active_to         date,
  description       text check (description is null or char_length(description) <= 2000),
  entry_criteria    text check (entry_criteria is null or char_length(entry_criteria) <= 2000),
  exit_criteria     text check (exit_criteria is null or char_length(exit_criteria) <= 2000),
  expected_win_rate numeric(5,2)
                      check (expected_win_rate between 0 and 100),
  risk_reward_ratio numeric(10,4)
                      check (risk_reward_ratio > 0),
  market_conditions text[] default '{}',
  asset_classes     text[] default '{}',
  timeframes        text[] default '{}',
  notes             text check (notes is null or char_length(notes) <= 2000),
  favorite_order    integer check (favorite_order > 0 and favorite_order <= 100),
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null,
  check (char_length(title) >= 1 and char_length(title) <= 100),
  check (active_to is null or active_from is null or active_to >= active_from),
  check (active_from is not null or active_to is null)
);

alter table public.strategies enable row level security;

-- Split policies with (SELECT auth.uid()) optimization
create policy "strategies_select"
  on public.strategies for select to authenticated
  using (user_id = (select auth.uid()));
create policy "strategies_insert"
  on public.strategies for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "strategies_update"
  on public.strategies for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "strategies_delete"
  on public.strategies for delete to authenticated
  using (user_id = (select auth.uid()));

-- Case-insensitive unique title per user
create unique index idx_strategies_user_title_ci
  on public.strategies (user_id, lower(title));
create index idx_strategies_user on public.strategies (user_id);
create index idx_strategies_user_status on public.strategies (user_id, status);

-- Unique partial index enforces favorite_order uniqueness at DB level
create unique index uq_strategies_user_favorite_order
  on public.strategies (user_id, favorite_order)
  where favorite_order is not null;

create trigger strategies_updated_at
  before update on public.strategies
  for each row execute function public.update_updated_at();

-- ============================================
-- TRADE_STRATEGIES (junction)
-- ============================================
create table public.trade_strategies (
  trade_id    uuid references public.trades on delete cascade not null,
  strategy_id uuid references public.strategies on delete cascade not null,
  primary key (trade_id, strategy_id)
);

alter table public.trade_strategies enable row level security;

-- Both trade AND strategy must belong to auth.uid() (prevents cross-user junction rows)
-- Uses IN subquery with (SELECT auth.uid()) for performance (evaluated once per statement)
create policy "trade_strategies_select"
  on public.trade_strategies for select to authenticated
  using (
    trade_id in (select id from public.trades where user_id = (select auth.uid()))
  );
create policy "trade_strategies_insert"
  on public.trade_strategies for insert to authenticated
  with check (
    trade_id in (select id from public.trades where user_id = (select auth.uid()))
    and strategy_id in (select id from public.strategies where user_id = (select auth.uid()))
  );
create policy "trade_strategies_delete"
  on public.trade_strategies for delete to authenticated
  using (
    trade_id in (select id from public.trades where user_id = (select auth.uid()))
  );

create index idx_trade_strategies_trade on public.trade_strategies (trade_id);
create index idx_trade_strategies_strategy on public.trade_strategies (strategy_id);

-- ============================================
-- STRATEGY_IMAGES
-- ============================================
create table public.strategy_images (
  id           uuid default gen_random_uuid() primary key,
  strategy_id  uuid references public.strategies on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  storage_path text not null check (storage_path <> ''),
  caption      text,
  sort_order   integer default 0,
  created_at   timestamptz default now() not null
);

alter table public.strategy_images enable row level security;

-- WITH CHECK verifies strategy_id ownership (prevents cross-user image insertion)
create policy "strategy_images_select"
  on public.strategy_images for select to authenticated
  using (user_id = (select auth.uid()));
create policy "strategy_images_insert"
  on public.strategy_images for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and strategy_id in (select id from public.strategies where user_id = (select auth.uid()))
  );
create policy "strategy_images_update"
  on public.strategy_images for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "strategy_images_delete"
  on public.strategy_images for delete to authenticated
  using (user_id = (select auth.uid()));

create index idx_strategy_images_strategy on public.strategy_images (strategy_id);
create index idx_strategy_images_user on public.strategy_images (user_id);

-- ============================================
-- STORAGE: strategy-images bucket policies
-- (Bucket must be created in config.toml FIRST — private, not public)
-- ============================================
create policy "Users can upload strategy images"
  on storage.objects for insert
  with check (
    bucket_id = 'strategy-images'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f-]+/[0-9a-z_.]+$')
  );

create policy "Users can view own strategy images"
  on storage.objects for select
  using (
    bucket_id = 'strategy-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own strategy images"
  on storage.objects for delete
  using (
    bucket_id = 'strategy-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- compact_favorites RPC (atomic rank compaction)
-- ============================================
create or replace function public.compact_favorites(p_user_id uuid, p_strategy_id uuid)
returns void as $$
begin
  -- Clear the target strategy's favorite_order
  update public.strategies
  set favorite_order = null
  where id = p_strategy_id and user_id = p_user_id;

  -- Renumber remaining favorites atomically
  with ranked as (
    select id, row_number() over (order by favorite_order) as new_rank
    from public.strategies
    where user_id = p_user_id and favorite_order is not null
  )
  update public.strategies s
  set favorite_order = r.new_rank
  from ranked r
  where s.id = r.id;
end;
$$ language plpgsql security definer;
