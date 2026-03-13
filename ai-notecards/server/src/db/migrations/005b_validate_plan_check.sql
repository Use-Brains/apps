-- Migration 005b: Validate plan CHECK constraint in separate transaction
-- Must be separate from 005 because VALIDATE CONSTRAINT inside the same
-- transaction as ADD CONSTRAINT NOT VALID defeats the NOT VALID pattern
-- (holds ACCESS EXCLUSIVE lock for full table scan).
-- VALIDATE takes only SHARE UPDATE EXCLUSIVE lock — allows reads/writes.

ALTER TABLE users VALIDATE CONSTRAINT users_plan_check;
