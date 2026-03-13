-- ============================================
-- TRADES (core entity — the only real table)
-- ============================================
create table public.trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,

  -- Instrument
  symbol text not null,
  asset_class text not null default 'crypto'
    check (asset_class in ('crypto', 'stocks', 'options', 'futures', 'forex')),

  -- Direction
  side text not null check (side in ('long', 'short')),

  -- Prices (NUMERIC with precision — never use float for money)
  size numeric(20, 8) not null check (size > 0),
  entry_price numeric(20, 8) not null check (entry_price > 0),
  exit_price numeric(20, 8) check (exit_price is null or exit_price > 0),

  -- Outcome (computed in app, stored for fast aggregation)
  pnl numeric(20, 8),
  pnl_percent numeric(10, 4),
  fees numeric(20, 8) not null default 0 check (fees >= 0),

  -- Journal fields
  confidence integer check (confidence between 1 and 5),
  thesis text,
  notes text,

  -- Tags (free-text array — simple, no join table)
  setup_tags text[] default '{}',
  mistake_tags text[] default '{}',

  -- Timing
  entry_date timestamptz not null,
  exit_date timestamptz,
  status text not null default 'closed'
    check (status in ('open', 'closed')),

  -- Closed trades must have exit data
  check (status = 'open' or (exit_price is not null and exit_date is not null)),
  -- Exit must be after entry
  check (exit_date is null or exit_date >= entry_date),

  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.trades enable row level security;
create policy "Users can manage own trades"
  on public.trades for all using (auth.uid() = user_id);

-- Indexes for common queries
create index idx_trades_user_date on public.trades (user_id, exit_date desc nulls last);
create index idx_trades_user_entry_date on public.trades (user_id, entry_date desc);
create index idx_trades_user_symbol on public.trades (user_id, symbol);
create index idx_trades_user_status on public.trades (user_id, status);
create index idx_trades_setup_tags on public.trades using gin (setup_tags);
create index idx_trades_mistake_tags on public.trades using gin (mistake_tags);

-- ============================================
-- TRADE_IMAGES (chart screenshots)
-- ============================================
create table public.trade_images (
  id uuid default gen_random_uuid() primary key,
  trade_id uuid references public.trades on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  storage_path text not null check (storage_path <> ''),
  caption text,
  sort_order integer default 0,
  created_at timestamptz default now() not null
);

alter table public.trade_images enable row level security;
create policy "Users can manage own trade_images"
  on public.trade_images for all using (auth.uid() = user_id);

create index idx_trade_images_trade on public.trade_images (trade_id);
create index idx_trade_images_user on public.trade_images (user_id);

-- ============================================
-- Updated_at trigger
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  if new is distinct from old then
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trades_updated_at
  before update on public.trades
  for each row execute function public.update_updated_at();

-- ============================================
-- Supabase Storage bucket policies
-- (Bucket created via config.toml)
-- ============================================
create policy "Users can upload trade images"
  on storage.objects for insert
  with check (
    bucket_id = 'trade-images'
    and auth.role() = 'authenticated'
    and auth.uid()::text = (storage.foldername(name))[1]
    and name !~ '\.\.'
  );

create policy "Users can view own trade images"
  on storage.objects for select
  using (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own trade images"
  on storage.objects for delete
  using (
    bucket_id = 'trade-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
