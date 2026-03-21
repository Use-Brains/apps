-- 001_initial.sql
-- Squashed draft migration for Polsia handoff.
-- Source of truth: current sandbox schema state after migrations 001-019.
-- NOTE: schema_migrations is intentionally NOT created here; the migration runner owns it.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- DEFERRED: Seller payout metadata and native billing fields are retained here
-- so the handoff schema matches the current sandbox even though those workflows
-- are not active in the first Polsia web-core runtime.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  -- DEFERRED: Legacy plan states retained for schema stability while Polsia v1
  -- payment wiring is still placeholder-only. Active plan semantics may change
  -- once Polsia billing replaces the current historical Stripe-era model.
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'trial', 'pro')),
  -- DEFERRED: Stripe billing columns (replaced by Polsia payments in v1).
  -- Columns retained for schema stability. Not populated or read by any active
  -- v1 route in the Polsia handoff runtime.
  stripe_customer_id TEXT,
  daily_generation_count INT NOT NULL DEFAULT 0,
  last_generation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_connect_account_id TEXT,
  connect_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  connect_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  study_score INT NOT NULL DEFAULT 0,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspended_reason TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  google_user_id TEXT,
  -- DEFERRED: Seller agreement fields for future marketplace seller activation.
  -- Retained for schema completeness. No active v1 web route requires them.
  seller_terms_accepted_at TIMESTAMPTZ,
  seller_terms_version INT,
  avatar_url TEXT,
  google_avatar_url TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_study_date DATE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancel_at TIMESTAMPTZ,
  -- DEFERRED: Apple/RevenueCat native billing fields (v1.1+).
  -- Columns retained for schema completeness. No active v1 web route
  -- references these fields in the Polsia handoff runtime.
  apple_user_id TEXT,
  subscription_platform TEXT
    CHECK (subscription_platform IN ('stripe', 'apple') OR subscription_platform IS NULL),
  revenuecat_app_user_id TEXT,
  stripe_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_cancel_at TIMESTAMPTZ,
  apple_subscription_active BOOLEAN NOT NULL DEFAULT FALSE,
  apple_entitlement_id TEXT,
  apple_product_id TEXT,
  apple_cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  apple_cancel_at TIMESTAMPTZ,
  apple_expires_at TIMESTAMPTZ,
  apple_last_synced_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_google_user_id
  ON users (google_user_id)
  WHERE google_user_id IS NOT NULL;

CREATE UNIQUE INDEX idx_users_apple_user_id_active
  ON users (apple_user_id)
  WHERE apple_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_users_subscription_platform
  ON users (subscription_platform)
  WHERE subscription_platform IS NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT preferences_size
  CHECK (pg_column_size(preferences) < 1024);

CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origin TEXT NOT NULL DEFAULT 'generated' CHECK (origin IN ('generated', 'purchased', 'duplicated')),
  purchased_from_listing_id UUID,
  duplicated_from_deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_decks_duplicated_from
  ON decks (duplicated_from_deck_id)
  WHERE duplicated_from_deck_id IS NOT NULL;

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_deck_id ON cards(deck_id);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  total_cards INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  mode TEXT NOT NULL DEFAULT 'flip'
    CHECK (mode IN ('flip', 'multiple_choice', 'type_answer', 'match')),
  client_session_id UUID,
  deck_snapshot_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_user_deck ON study_sessions (user_id, deck_id);
CREATE INDEX idx_study_sessions_user_completed
  ON study_sessions (user_id, completed_at DESC, id DESC)
  WHERE completed_at IS NOT NULL;
CREATE INDEX idx_study_sessions_last_studied
  ON study_sessions (user_id, deck_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
CREATE UNIQUE INDEX idx_study_sessions_user_client_session
  ON study_sessions (user_id, client_session_id)
  WHERE client_session_id IS NOT NULL;
CREATE INDEX idx_study_sessions_user_completed_at_asc
  ON study_sessions (user_id, completed_at ASC)
  WHERE completed_at IS NOT NULL;

CREATE TABLE magic_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_magic_link_codes_email_active
  ON magic_link_codes (email, created_at DESC)
  WHERE used_at IS NULL;

CREATE TABLE deck_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  times_completed INT NOT NULL DEFAULT 0 CHECK (times_completed >= 0),
  best_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (best_accuracy >= 0 AND best_accuracy <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, deck_id)
);

CREATE INDEX idx_deck_stats_deck ON deck_stats (deck_id);

CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID UNIQUE NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES marketplace_categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Intentional v1 marketplace ceiling: seller pricing is constrained to
  -- $1.00-$5.00 USD in the current product strategy and seller-facing copy.
  price_cents INT NOT NULL CHECK (price_cents BETWEEN 100 AND 500),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'delisted', 'removed', 'pending_review')),
  delisted_at TIMESTAMPTZ,
  purchase_count INT NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  rating_count INT NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  moderation_requested_at TIMESTAMPTZ DEFAULT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT marketplace_listings_status_moderation_coherence CHECK (
    (status = 'active' AND moderation_status = 'approved')
    OR (status = 'pending_review' AND moderation_status IN ('pending', 'rejected'))
    OR (status IN ('delisted', 'removed'))
  )
);

CREATE INDEX idx_listings_search ON marketplace_listings USING GIN (search_vector);
CREATE INDEX idx_listings_cat_popular
  ON marketplace_listings (category_id, purchase_count DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_cat_newest
  ON marketplace_listings (category_id, created_at DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_popular
  ON marketplace_listings (purchase_count DESC)
  WHERE status = 'active';
CREATE INDEX idx_listings_moderation_pending
  ON marketplace_listings (moderation_requested_at)
  WHERE moderation_status = 'pending';

CREATE TABLE listing_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE (listing_id, tag)
);

CREATE INDEX idx_listing_tags_listing ON listing_tags (listing_id);

-- DEFERRED: Buyer marketplace purchases (Polsia payments wiring)
-- Purchase endpoints return placeholder responses in v1. Table exists for schema completeness.
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id),
  deck_id UUID NOT NULL REFERENCES decks(id),
  price_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  seller_payout_cents INT NOT NULL,
  payment_reference_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id, listing_id)
);

CREATE INDEX idx_purchases_seller_date ON purchases (seller_id, created_at DESC);
CREATE INDEX idx_purchases_buyer ON purchases (buyer_id);

-- DEFERRED: Ratings and moderation flows remain in-schema for marketplace realism
-- even though the first handoff keeps seller/admin tooling in shell mode.
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review_text TEXT CHECK (length(review_text) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_ratings_listing ON ratings (listing_id);

CREATE TABLE content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'dismissed')),
  admin_notes TEXT,
  flag_type TEXT NOT NULL DEFAULT 'listing' CHECK (flag_type IN ('listing', 'review')),
  rating_id UUID REFERENCES ratings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (listing_id, reporter_id, flag_type)
);

CREATE INDEX idx_flags_pending
  ON content_flags (listing_id, status)
  WHERE status = 'pending';

-- DEFERRED: Native-session auth support (v1.1+)
-- Table exists for schema completeness. No active v1 web route requires refresh-token sessions.
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_active
  ON refresh_tokens (user_id, created_at DESC)
  WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- DEFERRED: RevenueCat native billing (v1.1+)
-- Table exists for schema completeness. No active routes reference it in v1.
CREATE TABLE revenuecat_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEFERRED: Mobile push notifications (v1.1+)
-- Table exists for schema completeness. No active routes reference it in v1.
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios')),
  provider TEXT NOT NULL CHECK (provider IN ('expo')),
  token TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  permission_status TEXT NOT NULL DEFAULT 'granted' CHECK (permission_status IN ('granted', 'denied', 'undetermined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens (user_id);
CREATE INDEX idx_device_tokens_active_user
  ON device_tokens (user_id, status)
  WHERE status = 'active';
