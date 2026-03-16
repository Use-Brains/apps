-- 017_study_sync.sql
-- Support idempotent offline study session sync with historical snapshot metadata.

ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS client_session_id UUID,
  ADD COLUMN IF NOT EXISTS deck_snapshot_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_user_client_session
  ON study_sessions (user_id, client_session_id)
  WHERE client_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_completed_at_asc
  ON study_sessions (user_id, completed_at ASC)
  WHERE completed_at IS NOT NULL;
