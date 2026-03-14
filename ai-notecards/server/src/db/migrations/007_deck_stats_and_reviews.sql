-- 007_deck_stats_and_reviews.sql

-- Per-user, per-deck aggregate stats
CREATE TABLE deck_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  times_completed INT NOT NULL DEFAULT 0 CHECK (times_completed >= 0),
  best_accuracy NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (best_accuracy >= 0 AND best_accuracy <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, deck_id)
);

-- Only need deck_id index — UNIQUE(user_id, deck_id) already creates
-- a composite index that covers user_id lookups
CREATE INDEX idx_deck_stats_deck ON deck_stats (deck_id);

-- Composite index for rating eligibility check (WHERE user_id = $1 AND deck_id = $2)
CREATE INDEX idx_study_sessions_user_deck ON study_sessions (user_id, deck_id);

-- Add review text to ratings with length constraint
ALTER TABLE ratings ADD COLUMN review_text TEXT CHECK (length(review_text) <= 200);

-- Add review flagging support to content_flags
ALTER TABLE content_flags
  ADD COLUMN flag_type TEXT NOT NULL DEFAULT 'listing' CHECK (flag_type IN ('listing', 'review')),
  ADD COLUMN rating_id UUID REFERENCES ratings(id) ON DELETE SET NULL;

-- Replace UNIQUE constraint to allow same user to flag both listing and review
ALTER TABLE content_flags DROP CONSTRAINT content_flags_listing_id_reporter_id_key;
ALTER TABLE content_flags ADD CONSTRAINT content_flags_listing_reporter_type_key
  UNIQUE(listing_id, reporter_id, flag_type);
