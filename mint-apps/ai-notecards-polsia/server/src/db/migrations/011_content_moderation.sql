-- 011_content_moderation.sql
-- Adds content moderation columns + NOT VALID constraints (fast, minimal locks)

-- 1. Add moderation columns (safe in PG 11+, no table rewrite for NOT NULL DEFAULT)
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_requested_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop existing inline CHECK on status (find by catalog, not by assumed name)
DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'marketplace_listings'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%moderation_status%'
  LOOP
    EXECUTE format('ALTER TABLE marketplace_listings DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- 3. Add NOT VALID constraints (instant — no full table scan)
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_check
  CHECK (status IN ('active', 'delisted', 'removed', 'pending_review')) NOT VALID;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected')) NOT VALID;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_moderation_coherence
  CHECK (
    (status = 'active' AND moderation_status = 'approved')
    OR (status = 'pending_review' AND moderation_status IN ('pending', 'rejected'))
    OR (status IN ('delisted', 'removed'))
  ) NOT VALID;

-- 4. Index for admin moderation queue
CREATE INDEX IF NOT EXISTS idx_listings_moderation_pending
  ON marketplace_listings (moderation_requested_at)
  WHERE moderation_status = 'pending';
