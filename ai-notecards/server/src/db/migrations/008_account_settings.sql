-- 008_account_settings.sql
-- Avatar, preferences, Google avatar, soft-delete for account/settings experience

-- Avatar storage path (relative path in Supabase Storage, e.g. "avatars/uuid.png")
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Google profile photo URL (captured at OAuth login)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_avatar_url TEXT;

-- User preferences (JSONB — extensible without migrations)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

-- Soft-delete timestamp (required because purchases FK uses RESTRICT)
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Token revocation timestamp (for invalidating sessions on password change)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_revoked_at TIMESTAMPTZ;

-- Cursor pagination for study history (composite for tie-breaking)
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_completed
  ON study_sessions (user_id, completed_at DESC, id DESC)
  WHERE completed_at IS NOT NULL;

-- Prevent JSONB bloat
ALTER TABLE users ADD CONSTRAINT preferences_size
  CHECK (pg_column_size(preferences) < 1024);
