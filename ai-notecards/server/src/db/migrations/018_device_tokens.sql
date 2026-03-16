-- 018_device_tokens.sql
-- Push notification device token registry for iOS launch.

CREATE TABLE IF NOT EXISTS device_tokens (
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

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
  ON device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_active_user
  ON device_tokens (user_id, status)
  WHERE status = 'active';
