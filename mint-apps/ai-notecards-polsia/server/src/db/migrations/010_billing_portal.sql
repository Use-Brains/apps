-- 010_billing_portal.sql
-- Track subscription cancellation state for billing portal + webhook sync

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;
