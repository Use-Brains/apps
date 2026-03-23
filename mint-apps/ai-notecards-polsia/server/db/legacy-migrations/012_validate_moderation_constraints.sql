-- 012_validate_moderation_constraints.sql
-- Validate constraints in separate transaction (holds ShareUpdateExclusiveLock during scan
-- but does NOT block reads/writes — only blocks other DDL)

ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_status_check;
ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_moderation_status_check;
ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_status_moderation_coherence;
