-- Study mode tracking (split ADD COLUMN from CHECK for minimal lock duration)
ALTER TABLE study_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'flip';

ALTER TABLE study_sessions
  ADD CONSTRAINT chk_study_session_mode
  CHECK (mode IN ('flip', 'multiple_choice', 'type_answer', 'match')) NOT VALID;

ALTER TABLE study_sessions
  VALIDATE CONSTRAINT chk_study_session_mode;

-- Streak tracking on users
ALTER TABLE users
  ADD COLUMN current_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN longest_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN last_study_date DATE;

-- Covering index for last_studied_at subquery (Dashboard sort)
CREATE INDEX IF NOT EXISTS idx_study_sessions_last_studied
  ON study_sessions (user_id, deck_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
