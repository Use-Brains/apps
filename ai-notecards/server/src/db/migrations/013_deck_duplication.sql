-- 013: Deck duplication support
-- Adds 'duplicated' to origin CHECK, adds duplicated_from_deck_id FK

-- 1. Drop existing origin CHECK by catalog lookup (name may differ from assumed)
-- Pattern from migration 011 — never assume auto-generated constraint names
DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'decks'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%origin%'
      AND pg_get_constraintdef(con.oid) LIKE '%generated%'
  LOOP
    EXECUTE format('ALTER TABLE decks DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- 2. Add updated constraint (NOT VALID — instant, no table scan)
ALTER TABLE decks ADD CONSTRAINT decks_origin_check
  CHECK (origin IN ('generated', 'purchased', 'duplicated')) NOT VALID;

-- 3. Provenance column
ALTER TABLE decks ADD COLUMN IF NOT EXISTS duplicated_from_deck_id UUID
  REFERENCES decks(id) ON DELETE SET NULL;

-- 4. Index for FK cascade performance
CREATE INDEX IF NOT EXISTS idx_decks_duplicated_from
  ON decks (duplicated_from_deck_id) WHERE duplicated_from_deck_id IS NOT NULL;

-- ROLLBACK (manual):
-- Step 1: Check for existing duplicated rows
--   SELECT COUNT(*) FROM decks WHERE origin = 'duplicated';
--   If > 0, decide: convert to 'generated' or abort rollback
-- Step 2: Convert any duplicated rows
--   UPDATE decks SET origin = 'generated', duplicated_from_deck_id = NULL WHERE origin = 'duplicated';
-- Step 3: Remove schema objects
--   DROP INDEX IF EXISTS idx_decks_duplicated_from;
--   ALTER TABLE decks DROP COLUMN IF EXISTS duplicated_from_deck_id;
--   ALTER TABLE decks DROP CONSTRAINT decks_origin_check;
--   ALTER TABLE decks ADD CONSTRAINT decks_origin_check
--     CHECK (origin IN ('generated', 'purchased')) NOT VALID;
--   ALTER TABLE decks VALIDATE CONSTRAINT decks_origin_check;
-- Step 4: Clean up migration tracking
--   DELETE FROM schema_migrations WHERE version IN (13, 14);
