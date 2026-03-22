-- 016_billing_platforms_and_revenuecat.sql
-- Add platform-aware billing state for Stripe + Apple/RevenueCat

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_platform TEXT
    CHECK (subscription_platform IN ('stripe', 'apple') OR subscription_platform IS NULL),
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_cancel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apple_subscription_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apple_entitlement_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_product_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apple_cancel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apple_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS apple_last_synced_at TIMESTAMPTZ;

UPDATE users
SET stripe_cancel_at_period_end = cancel_at_period_end,
    stripe_cancel_at = cancel_at
WHERE stripe_subscription_id IS NOT NULL;

UPDATE users
SET revenuecat_app_user_id = id::text
WHERE revenuecat_app_user_id IS NULL;

CREATE TABLE IF NOT EXISTS revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_subscription_platform
  ON users(subscription_platform)
  WHERE subscription_platform IS NOT NULL;
