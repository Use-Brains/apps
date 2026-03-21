-- 015_mobile_auth_sessions.sql
-- Native iOS auth: Apple Sign-In + refresh-token-backed mobile sessions

ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_user_id TEXT;

DROP INDEX IF EXISTS users_apple_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_user_id_active
  ON users (apple_user_id)
  WHERE apple_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
  ON refresh_tokens (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
  ON refresh_tokens (expires_at);
