-- Seed data for development
-- Run after creating a test user via Supabase Auth

-- To use: replace USER_ID with your test user's UUID
-- INSERT INTO public.trades (user_id, symbol, side, size, entry_price, exit_price, pnl, pnl_percent, fees, entry_date, exit_date, status, setup_tags, mistake_tags, thesis, notes)
-- VALUES
--   ('USER_ID', 'BTC/USD', 'long', 0.5, 42000, 44100, 1040, 2.4762, 10, '2026-03-01T10:00:00Z', '2026-03-02T14:00:00Z', 'closed', '{breakout,trend}', '{}', 'BTC breaking above resistance with volume', 'Clean breakout, held overnight'),
--   ('USER_ID', 'ETH/USD', 'short', 5, 2800, 2650, 740, 5.2857, 10, '2026-03-03T08:00:00Z', '2026-03-03T16:00:00Z', 'closed', '{reversal}', '{oversized}', 'ETH showing bearish divergence on 4H', 'Should have taken smaller size'),
--   ('USER_ID', 'AAPL', 'long', 100, 175.50, 172.30, -330, -1.8803, 10, '2026-03-05T14:30:00Z', '2026-03-06T15:00:00Z', 'closed', '{earnings}', '{fomo,no stop loss}', 'Earnings play, expected beat', 'Entered too late, no stop loss set');
