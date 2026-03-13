-- 005_auth_revamp.sql
-- Auth revamp: Google Sign-In + Magic Link
-- Adds google_user_id, magic_link_codes table, makes password_hash nullable

-- Google Sign-In: partial unique allows re-registration after soft-delete
ALTER TABLE users ADD COLUMN google_user_id TEXT;
CREATE UNIQUE INDEX idx_users_google_user_id
    ON users (google_user_id) WHERE google_user_id IS NOT NULL;

-- Make password_hash nullable (magic link and Google users have no password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Magic link codes table
CREATE TABLE magic_link_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (attempts >= 0)
);

CREATE INDEX idx_magic_link_codes_email_active
    ON magic_link_codes (email, created_at DESC)
    WHERE used_at IS NULL;

-- Mark existing password users as email_verified (they proved email ownership at signup)
-- Do NOT mark all users — Apple relay emails are not truly verified for direct contact
UPDATE users SET email_verified = true
    WHERE email_verified = false
    AND password_hash IS NOT NULL;
