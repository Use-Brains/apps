-- Migration 005: BYOK, Apple IAP, SIWA, soft-delete, auth improvements
-- Part of iOS Swift rewrite + BYOK feature

-- BYOK columns
ALTER TABLE users ADD COLUMN openrouter_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN preferred_model TEXT;

-- Apple IAP columns
ALTER TABLE users ADD COLUMN apple_original_transaction_id TEXT;
ALTER TABLE users ADD COLUMN apple_subscription_product_id TEXT;
ALTER TABLE users ADD COLUMN apple_subscription_expires_at TIMESTAMPTZ;

-- Sign in with Apple support
ALTER TABLE users ADD COLUMN apple_user_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Soft-delete support (purchases.seller_id has NO CASCADE — cannot hard-delete sellers)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Token revocation kill switch (replaces refresh tokens — simpler for v1)
-- On logout/deletion/compromise: set token_revoked_at = NOW(), all JWTs issued before are rejected
ALTER TABLE users ADD COLUMN token_revoked_at TIMESTAMPTZ;

-- Plan CHECK constraint update (add 'byok_pro')
-- Use NOT VALID to avoid table scan under ACCESS EXCLUSIVE lock
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'trial', 'pro', 'byok_pro')) NOT VALID;
-- NOTE: VALIDATE CONSTRAINT is in 005b (must run in separate transaction)

-- Purchases table: add iap_transaction_id for Apple IAP purchases
ALTER TABLE purchases ADD COLUMN apple_iap_transaction_id TEXT;
ALTER TABLE purchases ALTER COLUMN stripe_payment_intent_id DROP NOT NULL;

-- Exactly one of stripe or apple must be set (XOR)
ALTER TABLE purchases ADD CONSTRAINT purchases_payment_source_check
  CHECK (
    (stripe_payment_intent_id IS NOT NULL AND apple_iap_transaction_id IS NULL)
    OR (stripe_payment_intent_id IS NULL AND apple_iap_transaction_id IS NOT NULL)
  );
ALTER TABLE purchases ADD CONSTRAINT purchases_apple_unique UNIQUE (apple_iap_transaction_id);

-- Seller payout hold (prevent refund fraud — 14 day hold before payout)
ALTER TABLE purchases ADD COLUMN seller_payout_eligible_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN seller_payout_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (seller_payout_status IN ('pending', 'eligible', 'paid', 'refunded'));

-- Backfill existing Stripe purchases as 'paid' (already settled)
UPDATE purchases SET seller_payout_status = 'paid' WHERE stripe_payment_intent_id IS NOT NULL;

-- Fix purchases.deck_id FK to allow buyer deck deletion
-- Default RESTRICT blocks DELETE; change to SET NULL so purchase audit trail persists
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_deck_id_fkey;
ALTER TABLE purchases ALTER COLUMN deck_id DROP NOT NULL;
ALTER TABLE purchases ADD CONSTRAINT purchases_deck_id_fkey
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL;

-- Apple webhook idempotency + ordering
CREATE TABLE processed_apple_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_uuid TEXT UNIQUE NOT NULL,
  notification_type TEXT NOT NULL,
  signed_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for new columns
CREATE INDEX idx_users_apple_original_txn ON users (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
CREATE INDEX idx_users_deleted_at ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_purchases_payout_status ON purchases (seller_payout_status)
  WHERE seller_payout_status = 'pending';
