-- 014: Validate NOT VALID constraint from 013
-- SHARE UPDATE EXCLUSIVE lock — allows concurrent reads and writes
ALTER TABLE decks VALIDATE CONSTRAINT decks_origin_check;
