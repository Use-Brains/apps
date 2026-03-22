-- backfill_deck_stats.sql
-- Run manually after migration 007, before deploying new code.
-- Usage: psql $DATABASE_URL_DIRECT -f server/db/scripts/backfill_deck_stats.sql

-- Safety check: abort if deck_stats already has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM deck_stats LIMIT 1) THEN
    RAISE EXCEPTION 'deck_stats already has data. Backfill may overwrite. Aborting.';
  END IF;
END $$;

INSERT INTO deck_stats (user_id, deck_id, times_completed, best_accuracy)
SELECT
  ss.user_id,
  ss.deck_id,
  COUNT(*) AS times_completed,
  COALESCE(LEAST(MAX(ss.correct::numeric / NULLIF(ss.total_cards, 0) * 100), 100), 0) AS best_accuracy
FROM study_sessions ss
WHERE ss.completed_at IS NOT NULL
GROUP BY ss.user_id, ss.deck_id
ON CONFLICT (user_id, deck_id) DO UPDATE SET
  times_completed = EXCLUDED.times_completed,
  best_accuracy = EXCLUDED.best_accuracy,
  updated_at = NOW();
